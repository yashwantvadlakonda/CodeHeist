import express from 'express';
import { z } from 'zod';
import { withTransaction } from '../../db/pool.js';
import { validateBody } from '../../middleware/validate.js';
import { recordAuditLog } from '../../services/auditService.js';

const updateStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().trim().min(3).max(300).optional(),
});

const reviewReportSchema = z.object({
  status: z.enum(['reviewed', 'resolved', 'dismissed']),
});

export function createAdminPlayerRouter(pool) {
  const router = express.Router();

  // Search players (NEVER exposes password_hash)
  router.get('/', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim();
      const conditions = [];
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(u.username ILIKE $${params.length} OR u.email ILIKE $${params.length} OR pp.display_name ILIKE $${params.length})`
        );
      }
      if (status === 'active' || status === 'suspended') {
        params.push(status);
        conditions.push(`u.status = $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT u.id, u.username, u.email, u.status, u.last_login_at, u.created_at,
                COALESCE(ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
                pp.display_name, pp.total_xp, pp.level, pp.rank_title, pp.games_played, pp.games_won,
                (SELECT COUNT(*)::int FROM player_reports pr WHERE pr.reported_user_id = u.id) AS reports_count
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         LEFT JOIN player_profiles pp ON pp.user_id = u.id
         ${whereClause}
         GROUP BY u.id, pp.user_id
         ORDER BY u.created_at DESC
         LIMIT 100`,
        params
      );

      return res.json({ players: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  // View reported players queue
  router.get('/reports/list', async (_req, res, next) => {
    try {
      const result = await pool.query(`
        SELECT pr.*,
               ru.username AS reported_username, ru.email AS reported_email, ru.status AS reported_status,
               rep.username AS reporter_username
        FROM player_reports pr
        JOIN users ru ON ru.id = pr.reported_user_id
        JOIN users rep ON rep.id = pr.reporter_user_id
        ORDER BY pr.created_at DESC
        LIMIT 100
      `);
      return res.json({ reports: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  router.patch('/reports/:reportId', validateBody(reviewReportSchema), async (req, res, next) => {
    try {
      const updated = await withTransaction(pool, async (client) => {
        const resUpdate = await client.query(
          `UPDATE player_reports
           SET status = $2, reviewed_by = $3, reviewed_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [req.params.reportId, req.validatedBody.status, req.user.id]
        );
        if (resUpdate.rowCount === 0) {
          const err = new Error('Player report not found');
          err.statusCode = 404;
          throw err;
        }
        await recordAuditLog(client, {
          adminId: req.user.id,
          action: 'PLAYER_REPORT_REVIEWED',
          entityType: 'player_report',
          entityId: req.params.reportId,
          details: { status: req.validatedBody.status },
          req,
        });
        return resUpdate.rows[0];
      });
      return res.json({ report: updated });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  // Player detail: profile, match history, XP history, reports (NEVER exposes password_hash)
  router.get('/:id', async (req, res, next) => {
    try {
      const [userRes, matchesRes, xpRes, reportsRes] = await Promise.all([
        pool.query(
          `SELECT u.id, u.username, u.email, u.status, u.last_login_at, u.created_at,
                  COALESCE(ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
                  pp.display_name, pp.avatar_seed, pp.bio, pp.total_xp, pp.level, pp.rank_title,
                  pp.games_played, pp.games_won, pp.current_streak, pp.best_streak
           FROM users u
           LEFT JOIN user_roles ur ON ur.user_id = u.id
           LEFT JOIN roles r ON r.id = ur.role_id
           LEFT JOIN player_profiles pp ON pp.user_id = u.id
           WHERE u.id = $1
           GROUP BY u.id, pp.user_id`,
          [req.params.id]
        ),
        pool.query(
          `SELECT m.id, m.match_type, m.status, m.started_at, m.ended_at,
                  COALESCE(mi.title, dc.title, 'Match') AS title,
                  mp.score, mp.xp_earned, mp.correct_count, mp.attempt_count, mp.is_winner
           FROM match_players mp
           JOIN matches m ON m.id = mp.match_id
           LEFT JOIN missions mi ON mi.id = m.mission_id
           LEFT JOIN daily_challenges dc ON dc.id = m.daily_challenge_id
           WHERE mp.user_id = $1
           ORDER BY mp.joined_at DESC
           LIMIT 30`,
          [req.params.id]
        ),
        pool.query(
          `SELECT id, match_id, source_type, amount, description, created_at
           FROM xp_transactions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 30`,
          [req.params.id]
        ),
        pool.query(
          `SELECT pr.*, rep.username AS reporter_username
           FROM player_reports pr
           JOIN users rep ON rep.id = pr.reporter_user_id
           WHERE pr.reported_user_id = $1
           ORDER BY pr.created_at DESC`,
          [req.params.id]
        ),
      ]);

      if (userRes.rowCount === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }

      return res.json({
        player: userRes.rows[0],
        matches: matchesRes.rows,
        xpHistory: xpRes.rows,
        reports: reportsRes.rows,
      });
    } catch (err) {
      return next(err);
    }
  });

  // Suspend or reactivate account (increments token_version on suspension to revoke active tokens)
  router.patch('/:id/status', validateBody(updateStatusSchema), async (req, res, next) => {
    try {
      const { status, reason } = req.validatedBody;
      if (req.params.id === req.user.id && status === 'suspended') {
        return res.status(400).json({ error: 'Administrators cannot suspend their own active session' });
      }

      const updated = await withTransaction(pool, async (client) => {
        const resUpdate = await client.query(
          `UPDATE users
           SET status = $2,
               token_version = CASE WHEN $2 = 'suspended' THEN token_version + 1 ELSE token_version END,
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, username, email, status, updated_at`,
          [req.params.id, status]
        );
        if (resUpdate.rowCount === 0) {
          const err = new Error('Player not found');
          err.statusCode = 404;
          throw err;
        }

        await recordAuditLog(client, {
          adminId: req.user.id,
          action: status === 'suspended' ? 'PLAYER_SUSPENDED' : 'PLAYER_REACTIVATED',
          entityType: 'user',
          entityId: req.params.id,
          details: { username: resUpdate.rows[0].username, reason: reason || null },
          req,
        });

        return resUpdate.rows[0];
      });

      return res.json({ player: updated });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  return router;
}
