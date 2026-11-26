import express from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { withTransaction } from '../../db/pool.js';
import { validateBody } from '../../middleware/validate.js';
import { recordAuditLog } from '../../services/auditService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

const puzzleTypes = [
  'logical_reasoning',
  'visual_pattern',
  'number_sequence',
  'riddle_word',
  'hidden_object',
  'picture_puzzle',
  'memory_challenge',
  'shape_rotation',
  'math_teaser',
  'observation',
  'matching',
  'sequence_arrangement',
  'spot_difference',
  'mystery_clue',
  'spatial_reasoning',
  'caesar_cipher',
  'number_pattern',
  'logic_gate',
  'binary_decoder',
  'memory_sequence',
  'pattern_recognition',
];

const difficulties = ['easy', 'medium', 'hard', 'expert'];
const gameModes = ['mystery_rooms', 'escape_challenge', 'brain_battle', 'treasure_hunt'];

const createPuzzleSchema = z.object({
  missionId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(3).max(150),
  puzzleType: z.enum(puzzleTypes),
  difficulty: z.enum(difficulties),
  prompt: z.string().trim().min(5).max(2000),
  puzzlePayload: z.record(z.any()).default({}),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  correctAnswer: z.string().trim().min(1).max(300),
  explanation: z.string().trim().max(1000).default(''),
  hints: z.array(z.string().trim().min(1).max(400)).max(5).default([]),
  timeLimitSeconds: z.number().int().min(15).max(3600).default(120),
  xpReward: z.number().int().min(10).max(5000).default(75),
  coinsReward: z.number().int().min(0).max(1000).default(20),
  stageOrder: z.number().int().min(1).max(50).default(1),
  isPublished: z.boolean().default(false),
});

const updatePuzzleSchema = createPuzzleSchema.partial();

const createMissionSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(1000),
  category: z.string().trim().min(2).max(60),
  gameMode: z.enum(gameModes).default('mystery_rooms'),
  theme: z.string().trim().min(2).max(40).default('manor'),
  difficulty: z.enum(difficulties),
  unlockLevel: z.number().int().min(1).max(100).default(1),
  orderIndex: z.number().int().min(0).default(0),
  timeLimitSeconds: z.number().int().min(30).max(3600).default(300),
  xpReward: z.number().int().min(10).max(5000).default(150),
  coinsReward: z.number().int().min(0).max(2000).default(60),
  storyIntro: z.string().trim().max(1000).default(''),
  storyOutro: z.string().trim().max(1000).default(''),
  isPublished: z.boolean().default(false),
});

const uploadImageSchema = z.object({
  filename: z.string().trim().min(1).max(120),
  dataUrl: z.string().min(20).max(3_500_000),
});

export function createAdminPuzzleRouter(pool) {
  const router = express.Router();

  // Upload puzzle image (validates PNG/JPEG/WEBP/SVG base64 and stores on disk)
  router.post('/upload-image', validateBody(uploadImageSchema), async (req, res, next) => {
    try {
      const { filename, dataUrl } = req.validatedBody;
      const match = /^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
      if (!match) {
        return res.status(400).json({ error: 'Only PNG, JPEG, WEBP, or SVG base64 images are allowed' });
      }
      const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image must be 2 MB or smaller' });
      }

      const extMap = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
      };
      const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extMap[mimeType]}`;
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      await fs.writeFile(path.join(UPLOADS_DIR, safeName), buffer);

      await withTransaction(pool, async (client) => {
        await client.query(
          `INSERT INTO uploaded_assets (filename, mime_type, size_bytes, uploaded_by)
           VALUES ($1, $2, $3, $4)`,
          [safeName, mimeType, buffer.length, req.user.id]
        );
        await recordAuditLog(client, {
          adminId: req.user.id,
          action: 'PUZZLE_IMAGE_UPLOADED',
          entityType: 'uploaded_asset',
          entityId: safeName,
          details: { originalFilename: filename, mimeType, sizeBytes: buffer.length },
          req,
        });
      });

      return res.status(201).json({
        imageUrl: `/uploads/${safeName}`,
        filename: safeName,
        mimeType,
        sizeBytes: buffer.length,
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/missions', async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT m.*, COUNT(pq.id)::int AS puzzle_count
         FROM missions m
         LEFT JOIN puzzle_questions pq ON pq.mission_id = m.id AND pq.is_archived = FALSE
         GROUP BY m.id
         ORDER BY m.order_index ASC, m.created_at DESC`
      );
      return res.json({ missions: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/missions', validateBody(createMissionSchema), async (req, res, next) => {
    try {
      const d = req.validatedBody;
      const mission = await withTransaction(pool, async (client) => {
        const resInsert = await client.query(
          `INSERT INTO missions (
             slug, title, description, category, game_mode, theme, difficulty, unlock_level,
             order_index, time_limit_seconds, xp_reward, coins_reward, story_intro, story_outro,
             is_published, created_by
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           RETURNING *`,
          [
            d.slug,
            d.title,
            d.description,
            d.category,
            d.gameMode,
            d.theme,
            d.difficulty,
            d.unlockLevel,
            d.orderIndex,
            d.timeLimitSeconds,
            d.xpReward,
            d.coinsReward,
            d.storyIntro,
            d.storyOutro,
            d.isPublished,
            req.user.id,
          ]
        );
        const created = resInsert.rows[0];
        await recordAuditLog(client, {
          adminId: req.user.id,
          action: 'MISSION_CREATED',
          entityType: 'mission',
          entityId: created.id,
          details: { title: created.title, slug: created.slug, gameMode: created.game_mode },
          req,
        });
        return created;
      });
      return res.status(201).json({ mission });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'An adventure room with that slug already exists' });
      }
      return next(err);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const { type, difficulty, archived, search } = req.query;
      const conditions = [];
      const params = [];

      if (type && puzzleTypes.includes(String(type))) {
        params.push(type);
        conditions.push(`pq.puzzle_type = $${params.length}`);
      }
      if (difficulty && difficulties.includes(String(difficulty))) {
        params.push(difficulty);
        conditions.push(`pq.difficulty = $${params.length}`);
      }
      if (archived === 'true') {
        conditions.push('pq.is_archived = TRUE');
      } else if (archived !== 'all') {
        conditions.push('pq.is_archived = FALSE');
      }
      if (search && String(search).trim()) {
        params.push(`%${String(search).trim()}%`);
        conditions.push(`(pq.title ILIKE $${params.length} OR pq.prompt ILIKE $${params.length})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT pq.*, m.title AS mission_title
         FROM puzzle_questions pq
         LEFT JOIN missions m ON m.id = pq.mission_id
         ${whereClause}
         ORDER BY pq.stage_order ASC, pq.created_at DESC`,
        params
      );
      return res.json({ puzzles: result.rows });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/', validateBody(createPuzzleSchema), async (req, res, next) => {
    try {
      const d = req.validatedBody;
      const puzzle = await withTransaction(pool, async (client) => {
        if (d.missionId) {
          const mRes = await client.query('SELECT id FROM missions WHERE id = $1', [d.missionId]);
          if (mRes.rowCount === 0) {
            const err = new Error('Referenced adventure room not found');
            err.statusCode = 404;
            throw err;
          }
        }

        const insertRes = await client.query(
          `INSERT INTO puzzle_questions
             (mission_id, title, puzzle_type, difficulty, prompt, puzzle_payload, image_url,
              correct_answer, explanation, hints, time_limit_seconds, xp_reward, coins_reward,
              stage_order, is_published, created_by)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16)
           RETURNING *`,
          [
            d.missionId ?? null,
            d.title,
            d.puzzleType,
            d.difficulty,
            d.prompt,
            JSON.stringify(d.puzzlePayload),
            d.imageUrl ?? null,
            d.correctAnswer,
            d.explanation,
            JSON.stringify(d.hints),
            d.timeLimitSeconds,
            d.xpReward,
            d.coinsReward,
            d.stageOrder,
            d.isPublished,
            req.user.id,
          ]
        );
        const created = insertRes.rows[0];

        await recordAuditLog(client, {
          adminId: req.user.id,
          action: 'PUZZLE_CREATED',
          entityType: 'puzzle_question',
          entityId: created.id,
          details: { title: created.title, puzzleType: created.puzzle_type, difficulty: created.difficulty },
          req,
        });

        return created;
      });

      return res.status(201).json({ puzzle });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  router.patch('/:id', validateBody(updatePuzzleSchema), async (req, res, next) => {
    try {
      const d = req.validatedBody;
      const updated = await withTransaction(pool, async (client) => {
        const existingRes = await client.query('SELECT * FROM puzzle_questions WHERE id = $1', [
          req.params.id,
        ]);
        if (existingRes.rowCount === 0) {
          const err = new Error('Puzzle not found');
          err.statusCode = 404;
          throw err;
        }
        const cur = existingRes.rows[0];

        const resUpdate = await client.query(
          `UPDATE puzzle_questions
           SET mission_id = $2,
               title = $3,
               puzzle_type = $4,
               difficulty = $5,
               prompt = $6,
               puzzle_payload = $7::jsonb,
               image_url = $8,
               correct_answer = $9,
               explanation = $10,
               hints = $11::jsonb,
               time_limit_seconds = $12,
               xp_reward = $13,
               coins_reward = $14,
               stage_order = $15,
               is_published = $16,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            req.params.id,
            d.missionId !== undefined ? d.missionId : cur.mission_id,
            d.title ?? cur.title,
            d.puzzleType ?? cur.puzzle_type,
            d.difficulty ?? cur.difficulty,
            d.prompt ?? cur.prompt,
            JSON.stringify(d.puzzlePayload ?? cur.puzzle_payload),
            d.imageUrl !== undefined ? d.imageUrl : cur.image_url,
            d.correctAnswer ?? cur.correct_answer,
            d.explanation ?? cur.explanation,
            JSON.stringify(d.hints ?? cur.hints),
            d.timeLimitSeconds ?? cur.time_limit_seconds,
            d.xpReward ?? cur.xp_reward,
            d.coinsReward ?? cur.coins_reward,
            d.stageOrder ?? cur.stage_order,
            d.isPublished ?? cur.is_published,
          ]
        );

        await recordAuditLog(client, {
          adminId: req.user.id,
          action: 'PUZZLE_UPDATED',
          entityType: 'puzzle_question',
          entityId: req.params.id,
          details: { changedFields: Object.keys(d) },
          req,
        });

        return resUpdate.rows[0];
      });

      return res.json({ puzzle: updated });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  router.patch('/:id/publish', async (req, res, next) => {
    try {
      const { isPublished } = z.object({ isPublished: z.boolean() }).parse(req.body);
      const updated = await withTransaction(pool, async (client) => {
        const resUpdate = await client.query(
          `UPDATE puzzle_questions
           SET is_published = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [req.params.id, isPublished]
        );
        if (resUpdate.rowCount === 0) {
          const err = new Error('Puzzle not found');
          err.statusCode = 404;
          throw err;
        }
        await recordAuditLog(client, {
          adminId: req.user.id,
          action: isPublished ? 'PUZZLE_PUBLISHED' : 'PUZZLE_UNPUBLISHED',
          entityType: 'puzzle_question',
          entityId: req.params.id,
          details: { title: resUpdate.rows[0].title },
          req,
        });
        return resUpdate.rows[0];
      });
      return res.json({ puzzle: updated });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      if (err.name === 'ZodError') return res.status(400).json({ error: 'isPublished boolean required' });
      return next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const outcome = await withTransaction(pool, async (client) => {
        const check = await client.query('SELECT id, title FROM puzzle_questions WHERE id = $1', [
          req.params.id,
        ]);
        if (check.rowCount === 0) {
          const err = new Error('Puzzle not found');
          err.statusCode = 404;
          throw err;
        }

        const refsRes = await client.query(
          `SELECT (
             (SELECT COUNT(*) FROM answer_submissions WHERE puzzle_id = $1) +
             (SELECT COUNT(*) FROM daily_challenges WHERE puzzle_id = $1)
           )::int AS ref_count`,
          [req.params.id]
        );

        if (refsRes.rows[0].ref_count > 0) {
          const archivedRes = await client.query(
            `UPDATE puzzle_questions
             SET is_archived = TRUE, is_published = FALSE, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [req.params.id]
          );
          await recordAuditLog(client, {
            adminId: req.user.id,
            action: 'PUZZLE_ARCHIVED',
            entityType: 'puzzle_question',
            entityId: req.params.id,
            details: { title: check.rows[0].title, reason: 'Referenced by match/challenge history' },
            req,
          });
          return { mode: 'archived', puzzle: archivedRes.rows[0] };
        }

        await client.query('DELETE FROM puzzle_questions WHERE id = $1', [req.params.id]);
        await recordAuditLog(client, {
          adminId: req.user.id,
          action: 'PUZZLE_DELETED',
          entityType: 'puzzle_question',
          entityId: req.params.id,
          details: { title: check.rows[0].title },
          req,
        });
        return { mode: 'deleted', id: req.params.id };
      });

      return res.json(outcome);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return next(err);
    }
  });

  return router;
}
