export function sanitizePuzzleForPlayer(puzzle) {
  const hints = Array.isArray(puzzle.hints) ? puzzle.hints : [];
  return {
    id: puzzle.id,
    missionId: puzzle.mission_id,
    title: puzzle.title,
    puzzleType: puzzle.puzzle_type,
    difficulty: puzzle.difficulty,
    prompt: puzzle.prompt,
    puzzlePayload: puzzle.puzzle_payload || {},
    imageUrl: puzzle.image_url || null,
    hintsCount: hints.length,
    timeLimitSeconds: puzzle.time_limit_seconds,
    xpReward: puzzle.xp_reward,
    coinsReward: puzzle.coins_reward ?? 15,
    stageOrder: puzzle.stage_order ?? 1,
  };
}

export function normalizeAnswer(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function computeLevelAndRank(totalXp) {
  const level = Math.max(1, Math.floor(totalXp / 250) + 1);
  let rankTitle = 'Curious Explorer';
  if (level >= 15) rankTitle = 'Grand Architect';
  else if (level >= 10) rankTitle = 'Mythic Pathfinder';
  else if (level >= 7) rankTitle = 'Master Sleuth';
  else if (level >= 5) rankTitle = 'Vault Breaker';
  else if (level >= 3) rankTitle = 'Riddle Weaver';
  else if (level >= 2) rankTitle = 'Clue Seeker';
  return { level, rankTitle };
}

export async function getSystemSetting(client, key, fallbackValue) {
  const res = await client.query('SELECT value FROM system_settings WHERE key = $1', [key]);
  if (res.rowCount === 0) return fallbackValue;
  return res.rows[0].value;
}

export async function evaluateAndUnlockAchievements(client, userId) {
  const profileRes = await client.query(
    `SELECT pp.total_xp, pp.games_played, pp.games_won,
            (SELECT COUNT(*)::int
             FROM matches m
             JOIN match_players mp ON mp.match_id = m.id
             WHERE mp.user_id = $1 AND m.match_type = 'daily' AND m.status = 'completed' AND mp.correct_count > 0) AS daily_solved
     FROM player_profiles pp
     WHERE pp.user_id = $1`,
    [userId]
  );
  if (profileRes.rowCount === 0) return [];
  const stats = profileRes.rows[0];

  const achievementsRes = await client.query(
    `SELECT a.*
     FROM achievements a
     WHERE NOT EXISTS (
       SELECT 1 FROM player_achievements pa
       WHERE pa.user_id = $1 AND pa.achievement_id = a.id
     )`,
    [userId]
  );

  const unlocked = [];
  for (const ach of achievementsRes.rows) {
    let metric = 0;
    if (ach.criteria_type === 'games_played') metric = stats.games_played;
    else if (ach.criteria_type === 'games_won') metric = stats.games_won;
    else if (ach.criteria_type === 'daily_solved') metric = stats.daily_solved;
    else if (ach.criteria_type === 'total_xp') metric = stats.total_xp;

    if (metric >= ach.criteria_threshold) {
      await client.query(
        `INSERT INTO player_achievements (user_id, achievement_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, ach.id]
      );
      if (ach.xp_bonus > 0) {
        const updatedProfile = await client.query(
          `UPDATE player_profiles
           SET total_xp = total_xp + $2, updated_at = NOW()
           WHERE user_id = $1
           RETURNING total_xp`,
          [userId, ach.xp_bonus]
        );
        const { level, rankTitle } = computeLevelAndRank(updatedProfile.rows[0].total_xp);
        await client.query(
          `UPDATE player_profiles SET level = $2, rank_title = $3 WHERE user_id = $1`,
          [userId, level, rankTitle]
        );
        await client.query(
          `INSERT INTO xp_transactions (user_id, source_type, amount, description)
           VALUES ($1, 'achievement_bonus', $2, $3)`,
          [userId, ach.xp_bonus, `Unlocked achievement: ${ach.title}`]
        );
      }
      unlocked.push({
        id: ach.id,
        code: ach.code,
        title: ach.title,
        description: ach.description,
        icon: ach.icon,
        xpBonus: ach.xp_bonus,
      });
    }
  }
  return unlocked;
}
