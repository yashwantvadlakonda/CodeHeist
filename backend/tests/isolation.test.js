import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizePuzzleForPlayer, normalizeAnswer, computeLevelAndRank } from '../src/services/gameEngine.js';
import { loadEnv } from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readAllFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const contents = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      contents.push(...(await readAllFiles(full)));
    } else if (/\.(js|jsx|html|json)$/.test(entry.name)) {
      contents.push({ path: full, text: await fs.readFile(full, 'utf8') });
    }
  }
  return contents;
}

test('Game frontend contains zero admin routes, endpoints, or UI references', async () => {
  const gameDir = path.resolve(__dirname, '../../game/frontend/src');
  const files = await readAllFiles(gameDir);
  for (const file of files) {
    assert.equal(
      file.text.includes('/api/admin'),
      false,
      `Found /api/admin reference in public game file: ${file.path}`
    );
    assert.equal(
      file.text.includes('/api/auth/admin'),
      false,
      `Found /api/auth/admin reference in public game file: ${file.path}`
    );
  }
});

test('Admin frontend has noindex protection and no public registration route', async () => {
  const adminHtml = await fs.readFile(
    path.resolve(__dirname, '../../admin/frontend/index.html'),
    'utf8'
  );
  assert.match(adminHtml, /noindex,\s*nofollow/i);

  const adminSrc = await readAllFiles(path.resolve(__dirname, '../../admin/frontend/src'));
  for (const file of adminSrc) {
    assert.equal(
      file.text.includes('/api/auth/register'),
      false,
      `Found public registration in admin frontend: ${file.path}`
    );
  }
});

test('sanitizePuzzleForPlayer strips official correct_answer', () => {
  const sanitized = sanitizePuzzleForPlayer({
    id: 'p1',
    mission_id: 'm1',
    title: 'Test Cipher',
    puzzle_type: 'caesar_cipher',
    difficulty: 'easy',
    prompt: 'Decode',
    puzzle_payload: { ciphertext: 'ABC' },
    correct_answer: 'SECRET_ANSWER',
    hints: ['hint 1'],
    time_limit_seconds: 90,
    xp_reward: 50,
  });

  assert.equal(sanitized.correct_answer, undefined);
  assert.equal(sanitized.correctAnswer, undefined);
  assert.equal(sanitized.hintsCount, 1);
  assert.equal(normalizeAnswer('  code  heist '), 'CODE HEIST');
  assert.equal(computeLevelAndRank(500).level, 3);
});

test('loadEnv enforces strong JWT_SECRET and explicit CORS allowlist', () => {
  assert.throws(
    () =>
      loadEnv({
        DATABASE_URL: 'postgresql://localhost/test',
        JWT_SECRET: 'short',
      }),
    /at least 32 characters/i
  );

  const cfg = loadEnv({
    DATABASE_URL: 'postgresql://localhost/test',
    JWT_SECRET: 'a-very-secure-secret-with-more-than-32-chars',
    GAME_ORIGIN: 'https://game.example.com',
    ADMIN_ORIGIN: 'https://admin.example.com',
  });
  assert.deepEqual(cfg.ALLOWED_ORIGINS, ['https://game.example.com', 'https://admin.example.com']);
});
