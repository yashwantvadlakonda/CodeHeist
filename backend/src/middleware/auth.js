import jwt from 'jsonwebtoken';

/**
 * Signs a minimal JWT containing only user id and tokenVersion.
 * Authorization roles are NEVER trusted from JWT claims; they are always loaded from PostgreSQL.
 */
export function signAccessToken(user, env) {
  return jwt.sign(
    {
      sub: user.id,
      tokenVersion: user.token_version,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: 'codeheist-api',
      audience: 'codeheist-clients',
    }
  );
}

/**
 * Queries PostgreSQL for authoritative user state and roles.
 */
export async function fetchAuthoritativeUser(pool, userId) {
  const res = await pool.query(
    `SELECT u.id, u.username, u.email, u.status, u.token_version, u.last_login_at, u.created_at,
            COALESCE(ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );
  return res.rows[0] || null;
}

export function createAuthMiddleware(pool, env) {
  async function verifyBearerToken(token) {
    if (!token) {
      const err = new Error('Authentication token is required');
      err.statusCode = 401;
      throw err;
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, {
        issuer: 'codeheist-api',
        audience: 'codeheist-clients',
      });
    } catch {
      const err = new Error('Invalid or expired authentication token');
      err.statusCode = 401;
      throw err;
    }

    if (!payload?.sub) {
      const err = new Error('Malformed authentication token');
      err.statusCode = 401;
      throw err;
    }

    const user = await fetchAuthoritativeUser(pool, payload.sub);
    if (!user) {
      const err = new Error('Authenticated user no longer exists');
      err.statusCode = 401;
      throw err;
    }

    if (user.token_version !== payload.tokenVersion) {
      const err = new Error('Session has been revoked; please sign in again');
      err.statusCode = 401;
      throw err;
    }

    if (user.status !== 'active') {
      const err = new Error('Account is suspended');
      err.statusCode = 403;
      throw err;
    }

    return user;
  }

  async function requireAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      req.user = await verifyBearerToken(token);
      next();
    } catch (err) {
      res.status(err.statusCode || 401).json({ error: err.message });
    }
  }

  async function optionalAuth(req, _res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      req.user = null;
      return next();
    }
    try {
      req.user = await verifyBearerToken(token);
    } catch {
      req.user = null;
    }
    next();
  }

  function requireAdmin(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.status !== 'active') {
      return res.status(403).json({ error: 'Administrator account is suspended' });
    }
    if (!Array.isArray(req.user.roles) || !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Forbidden: Administrator role required' });
    }
    return next();
  }

  return {
    verifyBearerToken,
    requireAuth,
    optionalAuth,
    requireAdmin,
  };
}
