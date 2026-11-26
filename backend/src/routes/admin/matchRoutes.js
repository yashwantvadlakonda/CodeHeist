import express from 'express';
import { z } from 'zod';
import { withTransaction } from '../../db/pool.js';
import { validateBody } from '../../middleware/validate.js';
import { recordAuditLog } from '../../services/auditService.js';

const terminateSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export function createAdminMatchRouter(pool, io) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const status = String(req.query.status || '').trim();
      const conditions = [];
      const params = [];

      if (['waiting', 'active', 'completed', 'terminated'].includes(status)) {
        params.push(status);
        conditions.push(`m.status = $${params.length}`);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await pool.query(
        `SELECT m.id, m.match_type, m.status, m.room_code, m.max_players,
                m.started_at, m.ended_at, m.termination_reason, m.created_at,
                COALESCE(mi.title, dc.title, 'Match') AS title,
                COUNT(DISTINCT mp.id)::int AS player_count,
                COUNT(DISTINCT asub.id) FILTER (WHERE asub.is_flagged_suspicious = TRUE)::int AS suspicious_count
         FROM matches m
         LEFT JOIN missions mi ON mi.id = m.mission_id
         LEFT JOIN daily_challenges dc ON dc.id = m.daily_challenge_id
         LEFT JOIN match_players mp ON mp.match_id = m.id
         LEFT JOIN answer_submissions asub ON asub.match_id = m.id
         ${whereClause}
         GROUP BY m.id, mi.title, dc.title
         ORDER BY m.created_at DESC
         LIMIT 100`,
        params
      );

      return res.json({ matches: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const [matchRes, participantsRes, submissionsRes] = await Promise.all([
        pool.query(
          `SELECT m.*, COALESCE(mi.title, dc.title, 'Match') AS title,
                  tu.username AS terminated_by_username
           FROM matches m
           LEFT JOIN missions mi ON mi.id = m.mission_id
           LEFT JOIN daily_challenges dc ON dc.id = m.daily_challenge_id
           LEFT JOIN users tu ON tu.id = m.terminated_by
           WHERE m.id = $1`,
          [req.params.id]
        ),
        pool.query(
          `SELECT mp.*, u.username, u.email, pp.display_name
           FROM match_players mp
           JOIN users u ON u.id = mp.user_id
           LEFT JOIN player_profiles pp ON pp.user_id = u.id
           WHERE mp.match_id = $1
           ORDER BY mp.score DESC, mp.joined_at ASC`,
          [req.params.id]
        ),
        pool.query(
          `SELECT asub.*, u.username, pq.title AS puzzle_title, pq.puzzle_type
           FROM answer_submissions asub
           JOIN users u ON u.id = asub.user_id
           JOIN puzzle_questions pq ON pq.id = asub.puzzle_id
           WHERE asub.match_id = $1
           ORDER BY asub.created_at DESC`,
          [req.params.id]
        ),
      ]);

      if (matchRes.rowCount === 0) {
        return res.status(404).json({ error: 'Match not found' });
      }

      return res.json({
        match: matchRes.rows[0],
        participants: participantsRes.rows,
        submissions: submissionsRes.rows,
      });
    } catch (err) {
      return next(err);
    }
  });

  // Note: Admins CANNOT modify player scores; they may only terminate a broken/cheated match with a recorded reason.
  router.post('/:id/terminate', validateBody(terminateSchema), async (req, res, next) => {
    try {
      const { reason } = req.validatedBody;
      const terminated = await withTransaction(pool, async (client) => {
        const check = await client.query('SELECT * FROM matches WHERE id = $1 FOR UPDATE', [
          req.params.id,
        ]);
        if (check.rowCount === 0) {
          const err = new Error('Match not found');
          err.statusCode = 404;
          throw err;
        }
        const cur = check.rows[0];
        if (!['waiting', 'active'].includes(cur.status)) {
          const err = new Error(`Cannot terminate match in status "${cur.status}"`);
          err.statusCode = 409;
          throw err;
        }

        const updatedRes = await client.query(
          `UPDATE matches
           SET status = 'terminated',
               ended_at = NOW(),
               terminated_by = $2,
               termination_reason = $3,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [req.params.id, req.user.id, reason]
        );

        await recordAuditLog(client, {
          adminId: req.user.id,
          action: 'MATCH_TERMINATED',
          entityType: 'match',
          entityId: req.params.id,
          details: { reason, previousStatus: cur.status },
          req,
        });

        return updatedRes.rows[0];
      });

      io?.to(`match:${terminated.id}`).emit('match:terminated', {
        matchId: terminated.id,
        reason: terminated.termination_reason,
      });
      io?.emit('lobby:updated');

      return res.json({ match: terminated });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  return router;
}
