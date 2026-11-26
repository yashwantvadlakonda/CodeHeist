import express from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { withTransaction } from '../db/pool.js';
import { validateBody } from '../middleware/validate.js';
import { signAccessToken, fetchAuthoritativeUser } from '../middleware/auth.js';
import { getSystemSetting } from '../services/gameEngine.js';
import { recordAuditLog } from '../services/auditService.js';

const BCRYPT_ROUNDS = 12;

// Strict schema: rejects any attempt to send `role` or `roles` during registration
const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, _ and -'),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
    displayName: z.string().trim().min(2).max(50).optional(),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(128),
  })
  .strict();

function buildSafeUserPayload(user, profile) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    status: user.status,
    roles: user.roles,
    profile: profile
      ? {
          displayName: profile.display_name,
          avatarSeed: profile.avatar_seed,
          bio: profile.bio,
          totalXp: profile.total_xp,
          coins: profile.coins ?? 100,
          level: profile.level,
          rankTitle: profile.rank_title,
          gamesPlayed: profile.games_played,
          gamesWon: profile.games_won,
          currentStreak: profile.current_streak,
          bestStreak: profile.best_streak,
          dailyStreak: profile.daily_streak ?? 0,
        }
      : null,
  };
}

export function createAuthRouter(pool, env, authMiddleware) {
  const router = express.Router();

  // Public player registration ONLY (always assigns 'player' role in PostgreSQL)
  router.post('/register', validateBody(registerSchema), async (req, res, next) => {
    try {
      const { username, email, password, displayName } = req.validatedBody;
      const normalizedEmail = email.toLowerCase();

      const result = await withTransaction(pool, async (client) => {
        const regEnabled = await getSystemSetting(client, 'registration_enabled', true);
        if (regEnabled === false) {
          const err = new Error('Player registration is currently disabled by an administrator');
          err.statusCode = 403;
          throw err;
        }

        const dupCheck = await client.query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)',
          [normalizedEmail, username]
        );
        if (dupCheck.rowCount > 0) {
          const err = new Error('An account with that email or username already exists');
          err.statusCode = 409;
          throw err;
        }

        const roleRes = await client.query("SELECT id FROM roles WHERE name = 'player'");
        if (roleRes.rowCount === 0) {
          throw new Error('Player role is missing in database');
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const userRes = await client.query(
          `INSERT INTO users (username, email, password_hash, status)
           VALUES ($1, $2, $3, 'active')
           RETURNING id, username, email, status, token_version, created_at`,
          [username, normalizedEmail, passwordHash]
        );
        const newUser = userRes.rows[0];

        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [newUser.id, roleRes.rows[0].id]
        );

        const profileRes = await client.query(
          `INSERT INTO player_profiles (user_id, display_name, avatar_seed)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [newUser.id, displayName || username, username.toLowerCase()]
        );

        newUser.roles = ['player'];
        return { user: newUser, profile: profileRes.rows[0] };
      });

      const token = signAccessToken(result.user, env);
      return res.status(201).json({
        token,
        user: buildSafeUserPayload(result.user, result.profile),
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      return next(err);
    }
  });

  // Public player login
  router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      const { email, password } = req.validatedBody;
      const userRes = await pool.query(
        'SELECT id, password_hash, status, token_version FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      if (userRes.rowCount === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const rawUser = userRes.rows[0];
      const passwordValid = await bcrypt.compare(password, rawUser.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (rawUser.status !== 'active') {
        return res.status(403).json({ error: 'Account is suspended' });
      }

      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [rawUser.id]);
      const authUser = await fetchAuthoritativeUser(pool, rawUser.id);
      const profileRes = await pool.query('SELECT * FROM player_profiles WHERE user_id = $1', [
        rawUser.id,
      ]);

      const token = signAccessToken(authUser, env);
      return res.json({
        token,
        user: buildSafeUserPayload(authUser, profileRes.rows[0]),
      });
    } catch (err) {
      return next(err);
    }
  });

  // Separate Admin Portal login - enforces admin role in PostgreSQL
  router.post('/admin/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      const { email, password } = req.validatedBody;
      const userRes = await pool.query(
        'SELECT id, password_hash, status, token_version FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      if (userRes.rowCount === 0) {
        return res.status(401).json({ error: 'Invalid administrator credentials' });
      }

      const rawUser = userRes.rows[0];
      const passwordValid = await bcrypt.compare(password, rawUser.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid administrator credentials' });
      }

      if (rawUser.status !== 'active') {
        return res.status(403).json({ error: 'Administrator account is suspended' });
      }

      const authUser = await fetchAuthoritativeUser(pool, rawUser.id);
      if (!authUser || !authUser.roles.includes('admin')) {
        return res.status(403).json({ error: 'Forbidden: Account lacks administrator privileges' });
      }

      await withTransaction(pool, async (client) => {
        await client.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [authUser.id]);
        await recordAuditLog(client, {
          adminId: authUser.id,
          action: 'ADMIN_LOGIN',
          entityType: 'session',
          entityId: authUser.id,
          details: { email: authUser.email },
          req,
        });
      });

      const profileRes = await pool.query('SELECT * FROM player_profiles WHERE user_id = $1', [
        authUser.id,
      ]);
      const token = signAccessToken(authUser, env);
      return res.json({
        token,
        user: buildSafeUserPayload(authUser, profileRes.rows[0]),
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/me', authMiddleware.requireAuth, async (req, res, next) => {
    try {
      const profileRes = await pool.query('SELECT * FROM player_profiles WHERE user_id = $1', [
        req.user.id,
      ]);
      return res.json({
        user: buildSafeUserPayload(req.user, profileRes.rows[0]),
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
