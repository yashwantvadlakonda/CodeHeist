import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { withTransaction } from '../db/pool.js';
import { validateBody } from '../middleware/validate.js';
import {
  sanitizePuzzleForPlayer,
  normalizeAnswer,
  computeLevelAndRank,
  getSystemSetting,
  evaluateAndUnlockAchievements,
} from '../services/gameEngine.js';

const submitAnswerSchema = z.object({
  puzzleId: z.string().uuid(),
  answer: z.string().min(1).max(300),
  hintsUsed: z.number().int().min(0).max(10).default(0),
});

const hintRequestSchema = z.object({
  puzzleId: z.string().uuid(),
  hintIndex: z.number().int().min(0).max(10),
});

const createRoomSchema = z.object({
  missionId: z.string().uuid(),
  maxPlayers: z.number().int().min(2).max(4).default(4),
});

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

export function createMissionRouter(pool, authMiddleware, io) {
  const router = express.Router();

  // List published adventure rooms/chapters (never includes puzzle correct_answer)
  router.get('/', async (req, res, next) => {
    try {
      const mode = req.query.mode ? String(req.query.mode) : null;
      const params = [];
      let modeClause = '';
      if (mode && ['mystery_rooms', 'escape_challenge', 'brain_battle', 'treasure_hunt'].includes(mode)) {
        params.push(mode);
        modeClause = `AND m.game_mode = $1`;
      }

      const result = await pool.query(
        `SELECT m.id, m.slug, m.title, m.description, m.category, m.difficulty,
                m.game_mode, m.theme, m.unlock_level, m.coins_reward, m.story_intro, m.story_outro,
                m.order_index, m.time_limit_seconds, m.xp_reward,
                COUNT(pq.id) FILTER (WHERE pq.is_published = TRUE AND pq.is_archived = FALSE)::int AS puzzle_count
         FROM missions m
         LEFT JOIN puzzle_questions pq ON pq.mission_id = m.id
         WHERE m.is_published = TRUE AND m.is_archived = FALSE ${modeClause}
         GROUP BY m.id
         ORDER BY m.order_index ASC, m.created_at ASC`,
        params
      );
      return res.json({ missions: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  // Today's published daily mystery
  router.get('/daily/today', authMiddleware.optionalAuth, async (req, res, next) => {
    try {
      const dailyRes = await pool.query(
        `SELECT dc.id, dc.challenge_date, dc.title, dc.bonus_xp, dc.status, dc.published_at,
                pq.id AS pq_id, pq.mission_id, pq.title AS pq_title, pq.puzzle_type,
                pq.difficulty, pq.prompt, pq.puzzle_payload, pq.image_url, pq.hints,
                pq.time_limit_seconds, pq.xp_reward, pq.coins_reward, pq.stage_order
         FROM daily_challenges dc
         JOIN puzzle_questions pq ON pq.id = dc.puzzle_id
         WHERE dc.status = 'published'
           AND dc.challenge_date <= CURRENT_DATE
           AND pq.is_archived = FALSE
         ORDER BY dc.challenge_date DESC
         LIMIT 1`
      );

      if (dailyRes.rowCount === 0) {
        return res.json({ dailyChallenge: null });
      }

      const row = dailyRes.rows[0];
      const completionStatsRes = await pool.query(
        `SELECT COUNT(*)::int AS completions
         FROM matches m
         JOIN match_players mp ON mp.match_id = m.id
         WHERE m.daily_challenge_id = $1 AND m.status = 'completed' AND mp.correct_count > 0`,
        [row.id]
      );

      let completedByUser = false;
      let dailyStreak = 0;
      if (req.user) {
        const [userDoneRes, profileRes] = await Promise.all([
          pool.query(
            `SELECT 1
             FROM matches m
             JOIN match_players mp ON mp.match_id = m.id
             WHERE m.daily_challenge_id = $1
               AND mp.user_id = $2
               AND m.status = 'completed'
               AND mp.correct_count > 0
             LIMIT 1`,
            [row.id, req.user.id]
          ),
          pool.query('SELECT daily_streak FROM player_profiles WHERE user_id = $1', [req.user.id]),
        ]);
        completedByUser = userDoneRes.rowCount > 0;
        dailyStreak = profileRes.rows[0]?.daily_streak ?? 0;
      }

      return res.json({
        dailyChallenge: {
          id: row.id,
          challengeDate: row.challenge_date,
          title: row.title,
          bonusXp: row.bonus_xp,
          publishedAt: row.published_at,
          completions: completionStatsRes.rows[0].completions,
          completedByUser,
          dailyStreak,
          puzzle: sanitizePuzzleForPlayer({
            id: row.pq_id,
            mission_id: row.mission_id,
            title: row.pq_title,
            puzzle_type: row.puzzle_type,
            difficulty: row.difficulty,
            prompt: row.prompt,
            puzzle_payload: row.puzzle_payload,
            image_url: row.image_url,
            hints: row.hints,
            time_limit_seconds: row.time_limit_seconds,
            xp_reward: row.xp_reward,
            coins_reward: row.coins_reward,
            stage_order: row.stage_order,
          }),
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  // Start daily mystery match
  router.post('/daily/start', authMiddleware.requireAuth, async (req, res, next) => {
    try {
      const matchData = await withTransaction(pool, async (client) => {
        const maintenance = await getSystemSetting(client, 'maintenance_mode', false);
        if (maintenance === true) {
          const err = new Error('The game is currently undergoing maintenance');
          err.statusCode = 503;
          throw err;
        }

        const dailyRes = await client.query(
          `SELECT dc.*, pq.id AS pq_id, pq.mission_id, pq.title AS pq_title, pq.puzzle_type,
                  pq.difficulty, pq.prompt, pq.puzzle_payload, pq.image_url, pq.hints,
                  pq.time_limit_seconds, pq.xp_reward, pq.coins_reward, pq.stage_order
           FROM daily_challenges dc
           JOIN puzzle_questions pq ON pq.id = dc.puzzle_id
           WHERE dc.status = 'published'
             AND dc.challenge_date <= CURRENT_DATE
             AND pq.is_archived = FALSE
           ORDER BY dc.challenge_date DESC
           LIMIT 1`
        );
        if (dailyRes.rowCount === 0) {
          const err = new Error('No published daily mystery is currently available');
          err.statusCode = 404;
          throw err;
        }
        const daily = dailyRes.rows[0];

        const alreadySolved = await client.query(
          `SELECT m.id
           FROM matches m
           JOIN match_players mp ON mp.match_id = m.id
           WHERE m.daily_challenge_id = $1 AND mp.user_id = $2
             AND m.status = 'completed' AND mp.correct_count > 0`,
          [daily.id, req.user.id]
        );
        if (alreadySolved.rowCount > 0) {
          const err = new Error('You have already completed today\'s Daily Mystery');
          err.statusCode = 409;
          throw err;
        }

        const puzzleIds = [daily.pq_id];
        const matchRes = await client.query(
          `INSERT INTO matches (match_type, daily_challenge_id, status, max_players, puzzle_ids, started_at, created_by)
           VALUES ('daily', $1, 'active', 1, $2::jsonb, NOW(), $3)
           RETURNING *`,
          [daily.id, JSON.stringify(puzzleIds), req.user.id]
        );
        const match = matchRes.rows[0];

        await client.query(
          `INSERT INTO match_players (match_id, user_id, is_ready, status)
           VALUES ($1, $2, TRUE, 'playing')`,
          [match.id, req.user.id]
        );

        return {
          match,
          dailyChallenge: {
            id: daily.id,
            title: daily.title,
            bonusXp: daily.bonus_xp,
            challengeDate: daily.challenge_date,
          },
          puzzles: [
            sanitizePuzzleForPlayer({
              id: daily.pq_id,
              mission_id: daily.mission_id,
              title: daily.pq_title,
              puzzle_type: daily.puzzle_type,
              difficulty: daily.difficulty,
              prompt: daily.prompt,
              puzzle_payload: daily.puzzle_payload,
              image_url: daily.image_url,
              hints: daily.hints,
              time_limit_seconds: daily.time_limit_seconds,
              xp_reward: daily.xp_reward,
              coins_reward: daily.coins_reward,
              stage_order: daily.stage_order,
            }),
          ],
        };
      });

      return res.status(201).json(matchData);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  // List open/active Brain Battle / multiplayer rooms
  router.get('/multiplayer/rooms', authMiddleware.requireAuth, async (_req, res, next) => {
    try {
      const roomsRes = await pool.query(
        `SELECT m.id, m.room_code, m.status, m.max_players, m.created_at, m.started_at,
                mi.id AS mission_id, mi.title AS mission_title, mi.difficulty, mi.game_mode, mi.theme,
                u.username AS host_username,
                COUNT(mp.id)::int AS player_count
         FROM matches m
         JOIN missions mi ON mi.id = m.mission_id
         LEFT JOIN users u ON u.id = m.created_by
         LEFT JOIN match_players mp ON mp.match_id = m.id
         WHERE m.match_type IN ('multiplayer', 'brain_battle') AND m.status IN ('waiting', 'active')
         GROUP BY m.id, mi.id, u.username
         ORDER BY m.created_at DESC
         LIMIT 30`
      );
      return res.json({ rooms: roomsRes.rows });
    } catch (err) {
      return next(err);
    }
  });

  // Create a multiplayer Brain Battle room (2-4 players)
  router.post(
    '/multiplayer/rooms',
    authMiddleware.requireAuth,
    validateBody(createRoomSchema),
    async (req, res, next) => {
      try {
        const { missionId, maxPlayers } = req.validatedBody;
        const created = await withTransaction(pool, async (client) => {
          const mpEnabled = await getSystemSetting(client, 'multiplayer_enabled', true);
          if (mpEnabled === false) {
            const err = new Error('Brain Battle multiplayer is currently paused by an administrator');
            err.statusCode = 403;
            throw err;
          }

          const missionRes = await client.query(
            'SELECT * FROM missions WHERE id = $1 AND is_published = TRUE AND is_archived = FALSE',
            [missionId]
          );
          if (missionRes.rowCount === 0) {
            const err = new Error('Adventure room not found or unpublished');
            err.statusCode = 404;
            throw err;
          }

          const puzzlesRes = await client.query(
            `SELECT id FROM puzzle_questions
             WHERE mission_id = $1 AND is_published = TRUE AND is_archived = FALSE
             ORDER BY stage_order ASC, created_at ASC`,
            [missionId]
          );
          if (puzzlesRes.rowCount === 0) {
            const err = new Error('Selected adventure has no published puzzles');
            err.statusCode = 400;
            throw err;
          }

          const roomCode = generateRoomCode();
          const puzzleIds = puzzlesRes.rows.map((r) => r.id);
          const matchRes = await client.query(
            `INSERT INTO matches (match_type, mission_id, room_code, status, max_players, puzzle_ids, created_by)
             VALUES ('multiplayer', $1, $2, 'waiting', $3, $4::jsonb, $5)
             RETURNING *`,
            [missionId, roomCode, maxPlayers, JSON.stringify(puzzleIds), req.user.id]
          );
          const match = matchRes.rows[0];

          await client.query(
            `INSERT INTO match_players (match_id, user_id, is_ready, status)
             VALUES ($1, $2, TRUE, 'joined')`,
            [match.id, req.user.id]
          );

          return { match, mission: missionRes.rows[0] };
        });

        io?.emit('lobby:updated');
        return res.status(201).json(created);
      } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        return next(err);
      }
    }
  );

  // Join a multiplayer room by roomCode
  router.post('/multiplayer/rooms/:roomCode/join', authMiddleware.requireAuth, async (req, res, next) => {
    try {
      const roomCode = req.params.roomCode.trim().toUpperCase();
      const joined = await withTransaction(pool, async (client) => {
        const matchRes = await client.query(
          "SELECT * FROM matches WHERE room_code = $1 AND match_type IN ('multiplayer', 'brain_battle') FOR UPDATE",
          [roomCode]
        );
        if (matchRes.rowCount === 0) {
          const err = new Error('Game room not found');
          err.statusCode = 404;
          throw err;
        }
        const match = matchRes.rows[0];
        if (match.status !== 'waiting') {
          const err = new Error(`Room is already ${match.status}`);
          err.statusCode = 409;
          throw err;
        }

        const existingRes = await client.query(
          'SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2',
          [match.id, req.user.id]
        );
        if (existingRes.rowCount === 0) {
          const countRes = await client.query(
            'SELECT COUNT(*)::int AS cnt FROM match_players WHERE match_id = $1',
            [match.id]
          );
          if (countRes.rows[0].cnt >= match.max_players) {
            const err = new Error('Room is full');
            err.statusCode = 409;
            throw err;
          }
          await client.query(
            `INSERT INTO match_players (match_id, user_id, is_ready, status)
             VALUES ($1, $2, TRUE, 'joined')`,
            [match.id, req.user.id]
          );
        }

        const playersRes = await client.query(
          `SELECT mp.*, u.username, pp.display_name, pp.level
           FROM match_players mp
           JOIN users u ON u.id = mp.user_id
           LEFT JOIN player_profiles pp ON pp.user_id = u.id
           WHERE mp.match_id = $1
           ORDER BY mp.joined_at ASC`,
          [match.id]
        );

        return { match, players: playersRes.rows };
      });

      io?.to(`match:${joined.match.id}`).emit('match:players', joined.players);
      io?.emit('lobby:updated');
      return res.json(joined);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  // Start a multiplayer room (host only)
  router.post('/multiplayer/rooms/:roomCode/start', authMiddleware.requireAuth, async (req, res, next) => {
    try {
      const roomCode = req.params.roomCode.trim().toUpperCase();
      const started = await withTransaction(pool, async (client) => {
        const matchRes = await client.query(
          "SELECT * FROM matches WHERE room_code = $1 AND match_type IN ('multiplayer', 'brain_battle') FOR UPDATE",
          [roomCode]
        );
        if (matchRes.rowCount === 0) {
          const err = new Error('Room not found');
          err.statusCode = 404;
          throw err;
        }
        const match = matchRes.rows[0];
        if (match.created_by !== req.user.id) {
          const err = new Error('Only the room host can start the battle');
          err.statusCode = 403;
          throw err;
        }
        if (match.status !== 'waiting') {
          const err = new Error(`Match cannot be started from state ${match.status}`);
          err.statusCode = 409;
          throw err;
        }

        const updatedRes = await client.query(
          `UPDATE matches SET status = 'active', started_at = NOW(), updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [match.id]
        );
        await client.query(
          `UPDATE match_players SET status = 'playing' WHERE match_id = $1`,
          [match.id]
        );

        return updatedRes.rows[0];
      });

      io?.to(`match:${started.id}`).emit('match:started', { matchId: started.id, startedAt: started.started_at });
      io?.emit('lobby:updated');
      return res.json({ match: started });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  // Adventure detail with sanitized puzzles (NO correct_answer)
  router.get('/:id', async (req, res, next) => {
    try {
      const missionRes = await pool.query(
        `SELECT id, slug, title, description, category, difficulty, game_mode, theme,
                unlock_level, coins_reward, story_intro, story_outro, order_index,
                time_limit_seconds, xp_reward
         FROM missions
         WHERE id = $1 AND is_published = TRUE AND is_archived = FALSE`,
        [req.params.id]
      );
      if (missionRes.rowCount === 0) {
        return res.status(404).json({ error: 'Adventure room not found' });
      }
      const puzzlesRes = await pool.query(
        `SELECT id, mission_id, title, puzzle_type, difficulty, prompt, puzzle_payload, image_url,
                hints, time_limit_seconds, xp_reward, coins_reward, stage_order
         FROM puzzle_questions
         WHERE mission_id = $1 AND is_published = TRUE AND is_archived = FALSE
         ORDER BY stage_order ASC, created_at ASC`,
        [req.params.id]
      );

      return res.json({
        mission: missionRes.rows[0],
        puzzles: puzzlesRes.rows.map(sanitizePuzzleForPlayer),
      });
    } catch (err) {
      return next(err);
    }
  });

  // Start solo adventure (Mystery Rooms, Escape Challenge, Treasure Hunt, or Solo Brain Battle practice)
  router.post('/:id/start', authMiddleware.requireAuth, async (req, res, next) => {
    try {
      const started = await withTransaction(pool, async (client) => {
        const maintenance = await getSystemSetting(client, 'maintenance_mode', false);
        if (maintenance === true) {
          const err = new Error('The game is currently undergoing maintenance');
          err.statusCode = 503;
          throw err;
        }

        const missionRes = await client.query(
          'SELECT * FROM missions WHERE id = $1 AND is_published = TRUE AND is_archived = FALSE',
          [req.params.id]
        );
        if (missionRes.rowCount === 0) {
          const err = new Error('Adventure room not found or unavailable');
          err.statusCode = 404;
          throw err;
        }
        const mission = missionRes.rows[0];

        const profileRes = await client.query('SELECT level FROM player_profiles WHERE user_id = $1', [
          req.user.id,
        ]);
        const playerLevel = profileRes.rows[0]?.level ?? 1;
        if (playerLevel < (mission.unlock_level || 1)) {
          const err = new Error(`Requires Explorer Level ${mission.unlock_level} to unlock this room`);
          err.statusCode = 403;
          throw err;
        }

        const puzzlesRes = await client.query(
          `SELECT * FROM puzzle_questions
           WHERE mission_id = $1 AND is_published = TRUE AND is_archived = FALSE
           ORDER BY stage_order ASC, created_at ASC`,
          [mission.id]
        );
        if (puzzlesRes.rowCount === 0) {
          const err = new Error('This adventure room currently has no published puzzles');
          err.statusCode = 400;
          throw err;
        }

        const puzzleIds = puzzlesRes.rows.map((p) => p.id);
        const matchType = mission.game_mode || 'solo';
        const matchRes = await client.query(
          `INSERT INTO matches (match_type, mission_id, status, max_players, puzzle_ids, started_at, created_by)
           VALUES ($1, $2, 'active', 1, $3::jsonb, NOW(), $4)
           RETURNING *`,
          [matchType, mission.id, JSON.stringify(puzzleIds), req.user.id]
        );
        const match = matchRes.rows[0];

        await client.query(
          `INSERT INTO match_players (match_id, user_id, is_ready, status)
           VALUES ($1, $2, TRUE, 'playing')`,
          [match.id, req.user.id]
        );

        return {
          match,
          mission: {
            id: mission.id,
            title: mission.title,
            difficulty: mission.difficulty,
            gameMode: mission.game_mode,
            theme: mission.theme,
            storyIntro: mission.story_intro,
            storyOutro: mission.story_outro,
            timeLimitSeconds: mission.time_limit_seconds,
            xpReward: mission.xp_reward,
            coinsReward: mission.coins_reward,
          },
          puzzles: puzzlesRes.rows.map(sanitizePuzzleForPlayer),
        };
      });

      return res.status(201).json(started);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  // Get match state (for Adventure Arena)
  router.get('/matches/:matchId', authMiddleware.requireAuth, async (req, res, next) => {
    try {
      const matchRes = await pool.query(
        `SELECT m.*, mi.title AS mission_title, mi.time_limit_seconds AS mission_time_limit,
                mi.xp_reward AS mission_xp_reward, mi.coins_reward AS mission_coins_reward,
                mi.game_mode, mi.theme, mi.story_intro, mi.story_outro,
                dc.title AS daily_title, dc.bonus_xp AS daily_bonus_xp
         FROM matches m
         LEFT JOIN missions mi ON mi.id = m.mission_id
         LEFT JOIN daily_challenges dc ON dc.id = m.daily_challenge_id
         WHERE m.id = $1`,
        [req.params.matchId]
      );
      if (matchRes.rowCount === 0) {
        return res.status(404).json({ error: 'Match not found' });
      }
      const match = matchRes.rows[0];

      const participantsRes = await pool.query(
        `SELECT mp.*, u.username, pp.display_name, pp.level, pp.rank_title
         FROM match_players mp
         JOIN users u ON u.id = mp.user_id
         LEFT JOIN player_profiles pp ON pp.user_id = u.id
         WHERE mp.match_id = $1
         ORDER BY mp.score DESC, mp.joined_at ASC`,
        [match.id]
      );

      const isParticipant = participantsRes.rows.some((p) => p.user_id === req.user.id);
      if (!isParticipant) {
        return res.status(403).json({ error: 'You are not a participant in this match' });
      }

      const solvedRes = await pool.query(
        `SELECT DISTINCT puzzle_id
         FROM answer_submissions
         WHERE match_id = $1 AND user_id = $2 AND is_correct = TRUE`,
        [match.id, req.user.id]
      );
      const solvedSet = new Set(solvedRes.rows.map((r) => r.puzzle_id));

      const puzzleIds = Array.isArray(match.puzzle_ids) ? match.puzzle_ids : [];
      let puzzles = [];
      if (puzzleIds.length > 0) {
        const pRes = await pool.query(
          `SELECT id, mission_id, title, puzzle_type, difficulty, prompt, puzzle_payload, image_url,
                  explanation, hints, time_limit_seconds, xp_reward, coins_reward, stage_order
           FROM puzzle_questions
           WHERE id = ANY($1::uuid[])`,
          [puzzleIds]
        );
        const byId = new Map(
          pRes.rows.map((p) => {
            const safe = sanitizePuzzleForPlayer(p);
            if (solvedSet.has(p.id) && p.explanation) {
              safe.explanation = p.explanation;
            }
            return [p.id, safe];
          })
        );
        puzzles = puzzleIds.map((id) => byId.get(id)).filter(Boolean);
      }

      return res.json({
        match,
        participants: participantsRes.rows,
        puzzles,
        solvedPuzzleIds: Array.from(solvedSet),
      });
    } catch (err) {
      return next(err);
    }
  });

  // Request a hint for a puzzle during an active match
  router.post(
    '/matches/:matchId/hint',
    authMiddleware.requireAuth,
    validateBody(hintRequestSchema),
    async (req, res, next) => {
      try {
        const { puzzleId, hintIndex } = req.validatedBody;
        const matchRes = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.matchId]);
        if (matchRes.rowCount === 0) return res.status(404).json({ error: 'Match not found' });
        const match = matchRes.rows[0];
        if (match.status !== 'active') {
          return res.status(409).json({ error: `Match is ${match.status}` });
        }

        const participantRes = await pool.query(
          'SELECT id FROM match_players WHERE match_id = $1 AND user_id = $2',
          [match.id, req.user.id]
        );
        if (participantRes.rowCount === 0) {
          return res.status(403).json({ error: 'You are not in this match' });
        }

        const puzzleRes = await pool.query('SELECT hints FROM puzzle_questions WHERE id = $1', [puzzleId]);
        if (puzzleRes.rowCount === 0) return res.status(404).json({ error: 'Puzzle not found' });
        const hints = Array.isArray(puzzleRes.rows[0].hints) ? puzzleRes.rows[0].hints : [];
        if (hintIndex >= hints.length) {
          return res.status(404).json({ error: 'No more hints available for this puzzle' });
        }

        return res.json({ hintIndex, hint: hints[hintIndex], totalHints: hints.length });
      } catch (err) {
        return next(err);
      }
    }
  );

  // Submit answer for server-side verification, scoring, coins, streak & level-up
  router.post(
    '/matches/:matchId/submit',
    authMiddleware.requireAuth,
    validateBody(submitAnswerSchema),
    async (req, res, next) => {
      try {
        const { puzzleId, answer, hintsUsed } = req.validatedBody;
        const outcome = await withTransaction(pool, async (client) => {
          const matchRes = await client.query('SELECT * FROM matches WHERE id = $1 FOR UPDATE', [
            req.params.matchId,
          ]);
          if (matchRes.rowCount === 0) {
            const err = new Error('Match not found');
            err.statusCode = 404;
            throw err;
          }
          const match = matchRes.rows[0];
          if (match.status !== 'active') {
            const err = new Error(`Match is ${match.status} and cannot accept submissions`);
            err.statusCode = 409;
            throw err;
          }

          const playerRes = await client.query(
            'SELECT * FROM match_players WHERE match_id = $1 AND user_id = $2 FOR UPDATE',
            [match.id, req.user.id]
          );
          if (playerRes.rowCount === 0) {
            const err = new Error('You are not a participant in this match');
            err.statusCode = 403;
            throw err;
          }

          const puzzleIds = Array.isArray(match.puzzle_ids) ? match.puzzle_ids : [];
          if (!puzzleIds.includes(puzzleId)) {
            const err = new Error('Puzzle does not belong to this match');
            err.statusCode = 400;
            throw err;
          }

          const alreadyCorrect = await client.query(
            `SELECT 1 FROM answer_submissions
             WHERE match_id = $1 AND user_id = $2 AND puzzle_id = $3 AND is_correct = TRUE`,
            [match.id, req.user.id, puzzleId]
          );
          if (alreadyCorrect.rowCount > 0) {
            const err = new Error('You have already solved this puzzle in this match');
            err.statusCode = 409;
            throw err;
          }

          const puzzleRes = await client.query('SELECT * FROM puzzle_questions WHERE id = $1', [puzzleId]);
          if (puzzleRes.rowCount === 0) {
            const err = new Error('Puzzle not found');
            err.statusCode = 404;
            throw err;
          }
          const puzzle = puzzleRes.rows[0];

          const lastSubmissionRes = await client.query(
            `SELECT created_at FROM answer_submissions
             WHERE match_id = $1 AND user_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [match.id, req.user.id]
          );
          const referenceTime =
            lastSubmissionRes.rowCount > 0
              ? new Date(lastSubmissionRes.rows[0].created_at).getTime()
              : new Date(match.started_at || match.created_at).getTime();
          const responseTimeMs = Math.max(0, Date.now() - referenceTime);

          const speedThreshold = Number(
            await getSystemSetting(client, 'suspicious_speed_threshold_ms', 1500)
          );
          const hintPenaltyPercent = Number(
            await getSystemSetting(client, 'hint_xp_penalty_percent', 20)
          );

          const isCorrect = normalizeAnswer(answer) === normalizeAnswer(puzzle.correct_answer);
          const isSuspicious = isCorrect && responseTimeMs < speedThreshold;
          const suspiciousReason = isSuspicious
            ? `Solved in ${responseTimeMs}ms (below threshold ${speedThreshold}ms)`
            : null;

          let scoreAwarded = 0;
          let puzzleCoins = 0;
          if (isCorrect) {
            const penaltyFactor = Math.max(0.2, 1 - hintsUsed * (hintPenaltyPercent / 100));
            const speedBonus = responseTimeMs < 30000 ? 25 : responseTimeMs < 60000 ? 10 : 0;
            scoreAwarded = Math.round(puzzle.xp_reward * penaltyFactor) + speedBonus;
            puzzleCoins = puzzle.coins_reward ?? 15;
          }

          await client.query(
            `INSERT INTO answer_submissions
               (match_id, user_id, puzzle_id, submitted_answer, is_correct, hints_used,
                response_time_ms, score_awarded, is_flagged_suspicious, suspicious_reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              match.id,
              req.user.id,
              puzzle.id,
              answer,
              isCorrect,
              hintsUsed,
              responseTimeMs,
              scoreAwarded,
              isSuspicious,
              suspiciousReason,
            ]
          );

          const updatedPlayerRes = await client.query(
            `UPDATE match_players
             SET score = score + $3,
                 coins_earned = coins_earned + $4,
                 correct_count = correct_count + $5,
                 attempt_count = attempt_count + 1
             WHERE match_id = $1 AND user_id = $2
             RETURNING *`,
            [match.id, req.user.id, scoreAwarded, puzzleCoins, isCorrect ? 1 : 0]
          );
          const updatedPlayer = updatedPlayerRes.rows[0];

          let matchCompleted = false;
          let unlockedAchievements = [];
          let totalXpAwarded = 0;
          let coinsAwarded = puzzleCoins;
          let leveledUp = false;
          let newLevel = null;
          let newRankTitle = null;

          if (updatedPlayer.correct_count >= puzzleIds.length) {
            const completionTimeMs = Math.max(
              0,
              Date.now() - new Date(match.started_at || match.created_at).getTime()
            );

            let bonusXp = 0;
            let bonusCoins = 0;
            if (match.mission_id && match.match_type !== 'multiplayer' && match.match_type !== 'brain_battle') {
              const mRes = await client.query('SELECT xp_reward, coins_reward FROM missions WHERE id = $1', [
                match.mission_id,
              ]);
              bonusXp = mRes.rows[0]?.xp_reward || 0;
              bonusCoins = mRes.rows[0]?.coins_reward || 40;
            } else if (match.match_type === 'daily' && match.daily_challenge_id) {
              const dRes = await client.query('SELECT bonus_xp FROM daily_challenges WHERE id = $1', [
                match.daily_challenge_id,
              ]);
              bonusXp = dRes.rows[0]?.bonus_xp || 0;
              bonusCoins = 50;
            } else {
              bonusXp = 80;
              bonusCoins = 60;
            }

            totalXpAwarded = updatedPlayer.score + bonusXp;
            coinsAwarded = updatedPlayer.coins_earned + bonusCoins;

            const isMultiplayer = match.match_type === 'multiplayer' || match.match_type === 'brain_battle';

            await client.query(
              `UPDATE match_players
               SET status = 'finished',
                   finished_at = NOW(),
                   completion_time_ms = $3,
                   xp_earned = $4,
                   coins_earned = $5,
                   is_winner = CASE WHEN $6 = FALSE THEN TRUE ELSE is_winner END
               WHERE match_id = $1 AND user_id = $2`,
              [match.id, req.user.id, completionTimeMs, totalXpAwarded, coinsAwarded, isMultiplayer]
            );

            if (isMultiplayer) {
              const existingWinnerRes = await client.query(
                'SELECT 1 FROM match_players WHERE match_id = $1 AND is_winner = TRUE',
                [match.id]
              );
              if (existingWinnerRes.rowCount === 0) {
                await client.query(
                  'UPDATE match_players SET is_winner = TRUE WHERE match_id = $1 AND user_id = $2',
                  [match.id, req.user.id]
                );
              }
            }

            const prevProfileRes = await client.query(
              'SELECT level, daily_streak, last_daily_date FROM player_profiles WHERE user_id = $1',
              [req.user.id]
            );
            const prevLevel = prevProfileRes.rows[0]?.level ?? 1;
            let nextDailyStreak = prevProfileRes.rows[0]?.daily_streak ?? 0;
            let nextLastDaily = prevProfileRes.rows[0]?.last_daily_date ?? null;

            if (match.match_type === 'daily') {
              const todayStr = new Date().toISOString().slice(0, 10);
              const lastStr = nextLastDaily ? new Date(nextLastDaily).toISOString().slice(0, 10) : null;
              if (lastStr !== todayStr) {
                const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                nextDailyStreak = lastStr === yesterdayStr ? nextDailyStreak + 1 : 1;
                nextLastDaily = todayStr;
              }
            }

            const profileRes = await client.query(
              `UPDATE player_profiles
               SET total_xp = total_xp + $2,
                   coins = coins + $3,
                   games_played = games_played + 1,
                   games_won = games_won + 1,
                   current_streak = current_streak + 1,
                   best_streak = GREATEST(best_streak, current_streak + 1),
                   daily_streak = $4,
                   last_daily_date = $5,
                   updated_at = NOW()
               WHERE user_id = $1
               RETURNING total_xp`,
              [req.user.id, totalXpAwarded, coinsAwarded, nextDailyStreak, nextLastDaily]
            );
            const rankCalc = computeLevelAndRank(profileRes.rows[0].total_xp);
            newLevel = rankCalc.level;
            newRankTitle = rankCalc.rankTitle;
            leveledUp = newLevel > prevLevel;

            await client.query(
              'UPDATE player_profiles SET level = $2, rank_title = $3 WHERE user_id = $1',
              [req.user.id, newLevel, newRankTitle]
            );

            const validSources = [
              'mystery_rooms',
              'escape_challenge',
              'brain_battle',
              'treasure_hunt',
            ];
            const sourceType =
              match.match_type === 'daily'
                ? 'daily_mystery'
                : isMultiplayer
                ? 'multiplayer_match'
                : validSources.includes(match.match_type)
                ? match.match_type
                : 'solo_mission';

            await client.query(
              `INSERT INTO xp_transactions (user_id, match_id, source_type, amount, description)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                req.user.id,
                match.id,
                sourceType,
                totalXpAwarded,
                `Completed ${match.match_type.replace('_', ' ')} adventure`,
              ]
            );

            await client.query(
              `UPDATE matches SET status = 'completed', ended_at = NOW(), updated_at = NOW()
               WHERE id = $1`,
              [match.id]
            );
            matchCompleted = true;

            unlockedAchievements = await evaluateAndUnlockAchievements(client, req.user.id);
          } else if (puzzleCoins > 0) {
            await client.query(
              'UPDATE player_profiles SET coins = coins + $2, updated_at = NOW() WHERE user_id = $1',
              [req.user.id, puzzleCoins]
            );
          }

          return {
            matchId: match.id,
            puzzleId: puzzle.id,
            isCorrect,
            explanation: isCorrect ? puzzle.explanation || '' : undefined,
            scoreAwarded,
            coinsAwarded,
            totalMatchScore: updatedPlayer.score,
            correctCount: updatedPlayer.correct_count,
            totalPuzzles: puzzleIds.length,
            matchCompleted,
            totalXpAwarded,
            leveledUp,
            newLevel,
            newRankTitle,
            unlockedAchievements,
          };
        });

        io?.to(`match:${req.params.matchId}`).emit('match:progress', {
          userId: req.user.id,
          username: req.user.username,
          correctCount: outcome.correctCount,
          totalPuzzles: outcome.totalPuzzles,
          score: outcome.totalMatchScore,
          matchCompleted: outcome.matchCompleted,
        });

        return res.json(outcome);
      } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        return next(err);
      }
    }
  );

  return router;
}
