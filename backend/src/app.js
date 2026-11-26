import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyDatabaseConnection } from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { createAuthMiddleware } from './middleware/auth.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createMissionRouter } from './routes/missionRoutes.js';
import { createLeaderboardRouter } from './routes/leaderboardRoutes.js';
import { createPlayerRouter } from './routes/playerRoutes.js';
import { createAdminOverviewRouter } from './routes/admin/overviewRoutes.js';
import { createAdminPuzzleRouter } from './routes/admin/puzzleRoutes.js';
import { createAdminDailyChallengeRouter } from './routes/admin/dailyChallengeRoutes.js';
import { createAdminPlayerRouter } from './routes/admin/playerRoutes.js';
import { createAdminMatchRouter } from './routes/admin/matchRoutes.js';
import { createAdminReportRouter } from './routes/admin/reportRoutes.js';

export function createApp({ pool, env, io = null }) {
  const app = express();
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Explicit CORS origin allowlist for Game and Admin frontends only
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (env.ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '4mb' }));
  app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

  const isTest = env.NODE_ENV === 'test';
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isTest ? 5000 : 400,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isTest ? 1000 : 40,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again shortly.' },
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter);

  const authMiddleware = createAuthMiddleware(pool, env);

  app.get('/api/health', async (_req, res) => {
    try {
      const dbInfo = await verifyDatabaseConnection(pool);
      return res.json({
        ok: true,
        service: 'codeheist-api',
        database: 'connected',
        serverTime: dbInfo.server_time,
      });
    } catch (err) {
      return res.status(503).json({
        ok: false,
        service: 'codeheist-api',
        database: 'disconnected',
        error: err.message,
      });
    }
  });

  // Public & player routes
  app.use('/api/auth', createAuthRouter(pool, env, authMiddleware));
  app.use('/api/missions', createMissionRouter(pool, authMiddleware, io));
  app.use('/api/leaderboard', createLeaderboardRouter(pool));
  app.use('/api/player', createPlayerRouter(pool, authMiddleware));

  // Admin routes - EVERY endpoint strictly guarded by server-side PostgreSQL admin authorization
  const adminRouter = express.Router();
  adminRouter.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  adminRouter.use(authMiddleware.requireAuth);
  adminRouter.use(authMiddleware.requireAdmin);

  adminRouter.use('/', createAdminOverviewRouter(pool));
  adminRouter.use('/puzzles', createAdminPuzzleRouter(pool));
  adminRouter.use('/daily-challenges', createAdminDailyChallengeRouter(pool));
  adminRouter.use('/players', createAdminPlayerRouter(pool));
  adminRouter.use('/matches', createAdminMatchRouter(pool, io));
  adminRouter.use('/', createAdminReportRouter(pool));

  app.use('/api/admin', adminRouter);

  // Fallback 404
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Global error handler
  app.use((err, _req, res, _next) => {
    if (err.message?.includes('not allowed by CORS')) {
      return res.status(403).json({ error: err.message });
    }
    const status = err.statusCode || 500;
    if (status >= 500) {
      console.error('[API Error]', err);
    }
    return res.status(status).json({
      error: status >= 500 && env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });

  return { app, authMiddleware };
}
