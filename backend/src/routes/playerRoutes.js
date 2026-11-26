import express from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';

const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(50).optional(),
    avatarSeed: z.string().trim().min(2).max(50).optional(),
    bio: z.string().trim().max(300).optional(),
  })
  .strict();

const reportPlayerSchema = z.object({
  reportedUserId: z.string().uuid(),
  matchId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(100),
  details: z.string().trim().max(500).default(''),
});

export function createPlayerRouter(pool, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware.requireAuth);

  router.get('/dashboard', async (req, res, next) => {
    try {
      const [profileRes, recentMatchesRes, achCountRes, dailyDoneRes] = await Promise.all([
        pool.query('SELECT * FROM player_profiles WHERE user_id = $1', [req.user.id]),
        pool.query(
          `SELECT m.id, m.match_type, m.status, m.started_at, m.ended_at,
                  COALESCE(mi.title, dc.title, 'Arena Operation') AS title,
                  mp.score, mp.xp_earned, mp.correct_count, mp.is_winner
           FROM match_players mp
           JOIN matches m ON m.id = mp.match_id
           LEFT JOIN missions mi ON mi.id = m.mission_id
           LEFT JOIN daily_challenges dc ON dc.id = m.daily_challenge_id
           WHERE mp.user_id = $1
           ORDER BY mp.joined_at DESC
           LIMIT 5`,
          [req.user.id]
        ),
        pool.query(
          'SELECT COUNT(*)::int AS unlocked_count FROM player_achievements WHERE user_id = $1',
          [req.user.id]
        ),
        pool.query(
          `SELECT dc.id, dc.title, dc.challenge_date, dc.bonus_xp,
                  EXISTS (
                    SELECT 1 FROM matches m
                    JOIN match_players mp ON mp.match_id = m.id
                    WHERE m.daily_challenge_id = dc.id AND mp.user_id = $1
                      AND m.status = 'completed' AND mp.correct_count > 0
                  ) AS completed
           FROM daily_challenges dc
           WHERE dc.status = 'published' AND dc.challenge_date <= CURRENT_DATE
           ORDER BY dc.challenge_date DESC
           LIMIT 1`,
          [req.user.id]
        ),
      ]);

      return res.json({
        profile: profileRes.rows[0] || null,
        recentMatches: recentMatchesRes.rows,
        unlockedAchievements: achCountRes.rows[0]?.unlocked_count || 0,
        dailyChallenge: dailyDoneRes.rows[0] || null,
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/profile', async (req, res, next) => {
    try {
      const profileRes = await pool.query('SELECT * FROM player_profiles WHERE user_id = $1', [
        req.user.id,
      ]);
      return res.json({
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          status: req.user.status,
          createdAt: req.user.created_at,
        },
        profile: profileRes.rows[0] || null,
      });
    } catch (err) {
      return next(err);
    }
  });

  router.patch('/profile', validateBody(updateProfileSchema), async (req, res, next) => {
    try {
      const { displayName, avatarSeed, bio } = req.validatedBody;
      const updated = await pool.query(
        `UPDATE player_profiles
         SET display_name = COALESCE($2, display_name),
             avatar_seed = COALESCE($3, avatar_seed),
             bio = COALESCE($4, bio),
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [req.user.id, displayName ?? null, avatarSeed ?? null, bio ?? null]
      );
      return res.json({ profile: updated.rows[0] });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/history', async (req, res, next) => {
    try {
      const [matchesRes, xpRes] = await Promise.all([
        pool.query(
          `SELECT m.id, m.match_type, m.status, m.room_code, m.started_at, m.ended_at,
                  COALESCE(mi.title, dc.title, 'Arena Operation') AS title,
                  mp.score, mp.xp_earned, mp.correct_count, mp.attempt_count,
                  mp.completion_time_ms, mp.is_winner
           FROM match_players mp
           JOIN matches m ON m.id = mp.match_id
           LEFT JOIN missions mi ON mi.id = m.mission_id
           LEFT JOIN daily_challenges dc ON dc.id = m.daily_challenge_id
           WHERE mp.user_id = $1
           ORDER BY mp.joined_at DESC
           LIMIT 50`,
          [req.user.id]
        ),
        pool.query(
          `SELECT id, match_id, source_type, amount, description, created_at
           FROM xp_transactions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 50`,
          [req.user.id]
        ),
      ]);

      return res.json({
        matches: matchesRes.rows,
        xpTransactions: xpRes.rows,
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/achievements', async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT a.*, pa.unlocked_at, (pa.user_id IS NOT NULL) AS unlocked
         FROM achievements a
         LEFT JOIN player_achievements pa ON pa.achievement_id = a.id AND pa.user_id = $1
         ORDER BY unlocked DESC, a.xp_bonus ASC`,
        [req.user.id]
      );
      return res.json({ achievements: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/report', validateBody(reportPlayerSchema), async (req, res, next) => {
    try {
      const { reportedUserId, matchId, reason, details } = req.validatedBody;
      if (reportedUserId === req.user.id) {
        return res.status(400).json({ error: 'You cannot report yourself' });
      }
      const targetCheck = await pool.query('SELECT id FROM users WHERE id = $1', [reportedUserId]);
      if (targetCheck.rowCount === 0) {
        return res.status(404).json({ error: 'Reported player not found' });
      }

      const reportRes = await pool.query(
        `INSERT INTO player_reports (reported_user_id, reporter_user_id, match_id, reason, details)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, status, created_at`,
        [reportedUserId, req.user.id, matchId ?? null, reason, details]
      );
      return res.status(201).json({ report: reportRes.rows[0] });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
