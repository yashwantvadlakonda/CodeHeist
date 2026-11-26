import express from 'express';

export function createLeaderboardRouter(pool) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25));
      const period = req.query.period === 'weekly' ? 'weekly' : 'all';

      if (period === 'weekly') {
        const result = await pool.query(
          `SELECT u.id, u.username, pp.display_name, pp.avatar_seed,
                  pp.total_xp, pp.coins, pp.level, pp.rank_title,
                  pp.games_played, pp.games_won, pp.best_streak,
                  COALESCE(SUM(xt.amount) FILTER (WHERE xt.created_at >= NOW() - INTERVAL '7 days'), 0)::int AS weekly_xp
           FROM users u
           JOIN player_profiles pp ON pp.user_id = u.id
           JOIN user_roles ur ON ur.user_id = u.id
           JOIN roles r ON r.id = ur.role_id
           LEFT JOIN xp_transactions xt ON xt.user_id = u.id
           WHERE u.status = 'active' AND r.name = 'player'
           GROUP BY u.id, pp.user_id
           ORDER BY weekly_xp DESC, pp.total_xp DESC, u.created_at ASC
           LIMIT $1`,
          [limit]
        );
        return res.json({ period, leaderboard: result.rows });
      }

      const result = await pool.query(
        `SELECT u.id, u.username, pp.display_name, pp.avatar_seed,
                pp.total_xp, pp.coins, pp.level, pp.rank_title,
                pp.games_played, pp.games_won, pp.best_streak
         FROM users u
         JOIN player_profiles pp ON pp.user_id = u.id
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.status = 'active' AND r.name = 'player'
         ORDER BY pp.total_xp DESC, pp.games_won DESC, u.created_at ASC
         LIMIT $1`,
        [limit]
      );
      return res.json({ period, leaderboard: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
