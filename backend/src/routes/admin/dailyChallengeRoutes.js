import express from 'express';
import { z } from 'zod';
import { withTransaction } from '../../db/pool.js';
import { validateBody } from '../../middleware/validate.js';
import { recordAuditLog } from '../../services/auditService.js';

const createDailySchema = z.object({
  puzzleId: z.string().uuid(),
  challengeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  title: z.string().trim().min(3).max(150),
  bonusXp: z.number().int().min(0).max(2000).default(75),
  publishImmediately: z.boolean().default(false),
});

const updateDailySchema = z.object({
  puzzleId: z.string().uuid().optional(),
  challengeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  title: z.string().trim().min(3).max(150).optional(),
  bonusXp: z.number().int().min(0).max(2000).optional(),
});

export function createAdminDailyChallengeRouter(pool) {
  const router = express.Router();

  router.get('/', async (_req, res, next) => {
    try {
      const result = await pool.query(`
        SELECT dc.*, pq.title AS puzzle_title, pq.puzzle_type, pq.difficulty,
               COUNT(DISTINCT m.id)::int AS attempts_count,
               COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed' AND mp.correct_count > 0)::int AS completions_count,
               ROUND(AVG(mp.completion_time_ms) FILTER (WHERE m.status = 'completed' AND mp.correct_count > 0))::int AS avg_completion_ms
        FROM daily_challenges dc
        JOIN puzzle_questions pq ON pq.id = dc.puzzle_id
        LEFT JOIN matches m ON m.daily_challenge_id = dc.id
        LEFT JOIN match_players mp ON mp.match_id = m.id
        GROUP BY dc.id, pq.id
        ORDER BY dc.challenge_date DESC
      `);
      return res.json({ dailyChallenges: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/', validateBody(createDailySchema), async (req, res, next) => {
    try {
      const { puzzleId, challengeDate, title, bonusXp, publishImmediately } = req.validatedBody;
      const created = await withTransaction(pool, async (client) => {
        const dupDate = await client.query(
          'SELECT id FROM daily_challenges WHERE challenge_date = $1::date',
          [challengeDate]
        );
        if (dupDate.rowCount > 0) {
          const err = new Error(`A daily challenge already exists for ${challengeDate}`);
          err.statusCode = 409;
          throw err;
        }

        const puzzleRes = await client.query(
          'SELECT id, is_archived FROM puzzle_questions WHERE id = $1',
          [puzzleId]
        );
        if (puzzleRes.rowCount === 0 || puzzleRes.rows[0].is_archived) {
          const err = new Error('Selected puzzle was not found or is archived');
          err.statusCode = 404;
          throw err;
        }

        const status = publishImmediately ? 'published' : 'scheduled';
        const publishedAt = publishImmediately ? new Date() : null;
        const insertRes = await client.query(
          `INSERT INTO daily_challenges (puzzle_id, challenge_date, title, bonus_xp, status, published_at, created_by)
           VALUES ($1, $2::date, $3, $4, $5, $6, $7)
           RETURNING *`,
          [puzzleId, challengeDate, title, bonusXp, status, publishedAt, req.user.id]
        );
        const row = insertRes.rows[0];

        await recordAuditLog(client, {
          adminId: req.user.id,
          action: publishImmediately ? 'DAILY_CHALLENGE_PUBLISHED' : 'DAILY_CHALLENGE_SCHEDULED',
          entityType: 'daily_challenge',
          entityId: row.id,
          details: { challengeDate, title, puzzleId },
          req,
        });

        return row;
      });

      return res.status(201).json({ dailyChallenge: created });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      if (err.code === '23505') {
        return res.status(409).json({ error: 'A daily challenge already exists for that date' });
      }
      return next(err);
    }
  });

  // Update ONLY unpublished (scheduled) daily challenges
  router.patch('/:id', validateBody(updateDailySchema), async (req, res, next) => {
    try {
      const d = req.validatedBody;
      const updated = await withTransaction(pool, async (client) => {
        const existing = await client.query('SELECT * FROM daily_challenges WHERE id = $1 FOR UPDATE', [
          req.params.id,
        ]);
        if (existing.rowCount === 0) {
          const err = new Error('Daily challenge not found');
          err.statusCode = 404;
          throw err;
        }
        const cur = existing.rows[0];
        if (cur.status !== 'scheduled') {
          const err = new Error('Only unpublished (scheduled) daily challenges can be edited');
          err.statusCode = 409;
          throw err;
        }

        const resUpdate = await client.query(
          `UPDATE daily_challenges
           SET puzzle_id = $2,
               challenge_date = $3::date,
               title = $4,
               bonus_xp = $5,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            req.params.id,
            d.puzzleId ?? cur.puzzle_id,
            d.challengeDate ?? cur.challenge_date,
            d.title ?? cur.title,
            d.bonusXp ?? cur.bonus_xp,
          ]
        );

        await recordAuditLog(client, {
          adminId: req.user.id,
          action: 'DAILY_CHALLENGE_UPDATED',
          entityType: 'daily_challenge',
          entityId: req.params.id,
          details: d,
          req,
        });

        return resUpdate.rows[0];
      });

      return res.json({ dailyChallenge: updated });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Another daily challenge already exists for that date' });
      }
      return next(err);
    }
  });

  router.post('/:id/publish', async (req, res, next) => {
    try {
      const published = await withTransaction(pool, async (client) => {
        const resUpdate = await client.query(
          `UPDATE daily_challenges
           SET status = 'published', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [req.params.id]
        );
        if (resUpdate.rowCount === 0) {
          const err = new Error('Daily challenge not found');
          err.statusCode = 404;
          throw err;
        }

        await recordAuditLog(client, {
          adminId: req.user.id,
          action: 'DAILY_CHALLENGE_PUBLISHED',
          entityType: 'daily_challenge',
          entityId: req.params.id,
          details: { title: resUpdate.rows[0].title, challengeDate: resUpdate.rows[0].challenge_date },
          req,
        });

        return resUpdate.rows[0];
      });
      return res.json({ dailyChallenge: published });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  return router;
}
