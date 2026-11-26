import express from 'express';

export function createAdminReportRouter(pool) {
  const router = express.Router();

  router.get('/reports', async (_req, res, next) => {
    try {
      const [
        regTrendsRes,
        missionRatesRes,
        multiplayerSplitRes,
        puzzleTypesRes,
        completionStatsRes,
      ] = await Promise.all([
        pool.query(`
          SELECT TO_CHAR(DATE_TRUNC('day', u.created_at), 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS registrations
          FROM users u
          JOIN user_roles ur ON ur.user_id = u.id
          JOIN roles r ON r.id = ur.role_id
          WHERE r.name = 'player' AND u.created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE_TRUNC('day', u.created_at)
          ORDER BY day ASC
        `),
        pool.query(`
          SELECT mi.id, mi.title, mi.difficulty,
                 COUNT(m.id)::int AS total_started,
                 COUNT(m.id) FILTER (WHERE m.status = 'completed')::int AS total_completed,
                 CASE WHEN COUNT(m.id) = 0 THEN 0
                      ELSE ROUND((COUNT(m.id) FILTER (WHERE m.status = 'completed')::numeric / COUNT(m.id)) * 100, 1)
                 END AS completion_rate_pct
          FROM missions mi
          LEFT JOIN matches m ON m.mission_id = mi.id
          WHERE mi.is_archived = FALSE
          GROUP BY mi.id
          ORDER BY total_started DESC, mi.order_index ASC
        `),
        pool.query(`
          SELECT match_type,
                 COUNT(*)::int AS total_matches,
                 COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_matches
          FROM matches
          GROUP BY match_type
          ORDER BY total_matches DESC
        `),
        pool.query(`
          SELECT pq.puzzle_type,
                 COUNT(asub.id)::int AS submission_count,
                 COUNT(asub.id) FILTER (WHERE asub.is_correct = TRUE)::int AS correct_count,
                 ROUND(AVG(asub.response_time_ms))::int AS avg_response_ms
          FROM puzzle_questions pq
          LEFT JOIN answer_submissions asub ON asub.puzzle_id = pq.id
          GROUP BY pq.puzzle_type
          ORDER BY submission_count DESC
        `),
        pool.query(`
          SELECT
            COUNT(DISTINCT m.id)::int AS total_matches,
            COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed')::int AS completed_matches,
            ROUND(AVG(mp.completion_time_ms) FILTER (WHERE mp.completion_time_ms IS NOT NULL))::int AS avg_completion_ms
          FROM matches m
          LEFT JOIN match_players mp ON mp.match_id = m.id
        `),
      ]);

      const compRow = completionStatsRes.rows[0] || {
        total_matches: 0,
        completed_matches: 0,
        avg_completion_ms: null,
      };
      const overallCompletionRatePct =
        compRow.total_matches > 0
          ? Number(((compRow.completed_matches / compRow.total_matches) * 100).toFixed(1))
          : 0;

      return res.json({
        registrationTrends: regTrendsRes.rows,
        missionCompletionRates: missionRatesRes.rows,
        multiplayerParticipation: multiplayerSplitRes.rows,
        popularPuzzleTypes: puzzleTypesRes.rows,
        summary: {
          totalMatches: compRow.total_matches,
          completedMatches: compRow.completed_matches,
          overallCompletionRatePct,
          avgCompletionMs: compRow.avg_completion_ms || 0,
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/audit-logs', async (req, res, next) => {
    try {
      const action = String(req.query.action || '').trim();
      const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 100));
      const params = [];
      let whereClause = '';

      if (action) {
        params.push(action);
        whereClause = `WHERE a.action = $${params.length}`;
      }
      params.push(limit);

      const result = await pool.query(
        `SELECT a.*, u.username AS admin_username, u.email AS admin_email
         FROM admin_audit_logs a
         JOIN users u ON u.id = a.admin_id
         ${whereClause}
         ORDER BY a.created_at DESC
         LIMIT $${params.length}`,
        params
      );

      return res.json({ auditLogs: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
