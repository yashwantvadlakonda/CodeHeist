import express from 'express';
import { z } from 'zod';
import { withTransaction } from '../../db/pool.js';
import { validateBody } from '../../middleware/validate.js';
import { recordAuditLog } from '../../services/auditService.js';

const updateSettingsSchema = z.object({
  registration_enabled: z.boolean().optional(),
  multiplayer_enabled: z.boolean().optional(),
  maintenance_mode: z.boolean().optional(),
  suspicious_speed_threshold_ms: z.number().int().min(100).max(60000).optional(),
  hint_xp_penalty_percent: z.number().int().min(0).max(90).optional(),
});

export function createAdminOverviewRouter(pool) {
  const router = express.Router();

  router.get('/overview', async (_req, res, next) => {
    try {
      const [
        playersStatsRes,
        missionsStatsRes,
        challengesStatsRes,
        matchesStatsRes,
        reportsStatsRes,
        suspiciousRes,
        recentActivityRes,
      ] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)::int AS total_players,
            COUNT(*) FILTER (WHERE u.status = 'active')::int AS active_players,
            COUNT(*) FILTER (WHERE u.status = 'suspended')::int AS suspended_players
          FROM users u
          JOIN user_roles ur ON ur.user_id = u.id
          JOIN roles r ON r.id = ur.role_id
          WHERE r.name = 'player'
        `),
        pool.query(`
          SELECT
            COUNT(*)::int AS total_missions,
            COUNT(*) FILTER (WHERE is_published = TRUE AND is_archived = FALSE)::int AS published_missions
          FROM missions
        `),
        pool.query(`
          SELECT
            COUNT(*)::int AS total_daily_challenges,
            COUNT(*) FILTER (WHERE status = 'published')::int AS published_challenges
          FROM daily_challenges
        `),
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_matches,
            COUNT(*) FILTER (WHERE status IN ('waiting', 'active'))::int AS active_matches,
            COUNT(*) FILTER (WHERE match_type = 'multiplayer')::int AS multiplayer_matches
          FROM matches
        `),
        pool.query(`
          SELECT COUNT(*)::int AS open_reports
          FROM player_reports
          WHERE status = 'open'
        `),
        pool.query(`
          SELECT COUNT(*)::int AS suspicious_submissions
          FROM answer_submissions
          WHERE is_flagged_suspicious = TRUE
        `),
        pool.query(`
          SELECT m.id, m.match_type, m.status, m.room_code, m.created_at, m.ended_at,
                 COALESCE(mi.title, dc.title, 'Daily / Custom Match') AS title,
                 COUNT(mp.id)::int AS player_count
          FROM matches m
          LEFT JOIN missions mi ON mi.id = m.mission_id
          LEFT JOIN daily_challenges dc ON dc.id = m.daily_challenge_id
          LEFT JOIN match_players mp ON mp.match_id = m.id
          GROUP BY m.id, mi.title, dc.title
          ORDER BY m.created_at DESC
          LIMIT 10
        `),
      ]);

      return res.json({
        stats: {
          totalPlayers: playersStatsRes.rows[0].total_players,
          activePlayers: playersStatsRes.rows[0].active_players,
          suspendedPlayers: playersStatsRes.rows[0].suspended_players,
          totalMissions: missionsStatsRes.rows[0].total_missions,
          publishedMissions: missionsStatsRes.rows[0].published_missions,
          totalDailyChallenges: challengesStatsRes.rows[0].total_daily_challenges,
          publishedChallenges: challengesStatsRes.rows[0].published_challenges,
          completedMatches: matchesStatsRes.rows[0].completed_matches,
          activeMatches: matchesStatsRes.rows[0].active_matches,
          multiplayerMatches: matchesStatsRes.rows[0].multiplayer_matches,
          openReports: reportsStatsRes.rows[0].open_reports,
          suspiciousSubmissions: suspiciousRes.rows[0].suspicious_submissions,
        },
        recentActivity: recentActivityRes.rows,
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/settings', async (_req, res, next) => {
    try {
      const result = await pool.query('SELECT key, value, description, updated_at FROM system_settings ORDER BY key');
      return res.json({ settings: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  router.patch('/settings', validateBody(updateSettingsSchema), async (req, res, next) => {
    try {
      const entries = Object.entries(req.validatedBody);
      if (entries.length === 0) {
        return res.status(400).json({ error: 'No settings supplied' });
      }

      const updated = await withTransaction(pool, async (client) => {
        for (const [key, val] of entries) {
          await client.query(
            `UPDATE system_settings
             SET value = $2::jsonb, updated_by = $3, updated_at = NOW()
             WHERE key = $1`,
            [key, JSON.stringify(val), req.user.id]
          );
        }

        await recordAuditLog(client, {
          adminId: req.user.id,
          action: 'SETTINGS_UPDATED',
          entityType: 'system_settings',
          entityId: entries.map(([k]) => k).join(','),
          details: req.validatedBody,
          req,
        });

        const allRes = await client.query('SELECT key, value, description, updated_at FROM system_settings ORDER BY key');
        return allRes.rows;
      });

      return res.json({ settings: updated });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
