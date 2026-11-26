import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createPool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { runSeeds } from '../src/db/seed.js';
import { bootstrapInitialAdmin } from '../src/scripts/bootstrapAdmin.js';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  test('PostgreSQL integration & security suite skipped (no DATABASE_URL configured)', { skip: 'Set DATABASE_URL or TEST_DATABASE_URL to run live PostgreSQL tests' }, () => {});
} else {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL,
    JWT_SECRET: 'test-only-super-secret-key-at-least-32-characters-long',
    GAME_ORIGIN: 'http://localhost:5173',
    ADMIN_ORIGIN: 'http://localhost:5174',
  });

  const pool = createPool(DATABASE_URL, false);
  const { app } = createApp({ pool, env });

  let adminEmail = 'secadmin@codeheist.test';
  let adminPassword = 'TestOnly_Admin_Password_2026!';
  let adminToken = '';
  let adminId = '';
  let playerToken = '';
  let playerId = '';
  let player2Token = '';
  let createdPuzzleId = '';

  test.before(async () => {
    const migrationsDir = path.resolve(__dirname, '../../postgresql/migrations');
    const seedsDir = path.resolve(__dirname, '../../postgresql/seeds');

    // Reset schema cleanly in test database
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations(pool, migrationsDir);
    await runSeeds(pool, seedsDir);

    const bootstrapped = await bootstrapInitialAdmin(pool, adminEmail, {
      password: adminPassword,
    });
    adminId = bootstrapped.admin.id;
  });

  test.after(async () => {
    await pool.end();
  });

  test('1. One-time admin bootstrap rejects creating a second admin', async () => {
    await assert.rejects(
      () =>
        bootstrapInitialAdmin(pool, 'rogue@codeheist.test', {
          password: 'RogueAdmin_Password_2026!',
        }),
      /administrator account .* already exists/i
    );
  });

  test('2. Player registration rejects forged role field & registers normal player', async () => {
    const forged = await request(app).post('/api/auth/register').send({
      username: 'forged_user',
      email: 'forged@codeheist.test',
      password: 'Password123!',
      role: 'admin',
    });
    assert.equal(forged.status, 400);

    const reg = await request(app).post('/api/auth/register').send({
      username: 'operative_one',
      email: 'player1@codeheist.test',
      password: 'Password123!',
    });
    assert.equal(reg.status, 201);
    assert.ok(reg.body.token);
    assert.deepEqual(reg.body.user.roles, ['player']);
    playerToken = reg.body.token;
    playerId = reg.body.user.id;

    const reg2 = await request(app).post('/api/auth/register').send({
      username: 'operative_two',
      email: 'player2@codeheist.test',
      password: 'Password123!',
    });
    assert.equal(reg2.status, 201);
    player2Token = reg2.body.token;
  });

  test('3. Player cannot log into Admin Portal (HTTP 403)', async () => {
    const res = await request(app).post('/api/auth/admin/login').send({
      email: 'player1@codeheist.test',
      password: 'Password123!',
    });
    assert.equal(res.status, 403);
  });

  test('4. Critical Security: Normal player & forged JWT role claims cannot access /api/admin/*', async () => {
    // Unauthenticated -> 401
    const unauth = await request(app).get('/api/admin/overview');
    assert.equal(unauth.status, 401);

    // Normal player -> 403
    const playerRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${playerToken}`);
    assert.equal(playerRes.status, 403);

    // Forged JWT containing role: "admin" claim for normal player -> 403 (DB checked!)
    const forgedJwt = jwt.sign(
      { sub: playerId, tokenVersion: 1, role: 'admin', roles: ['admin'] },
      env.JWT_SECRET,
      { expiresIn: '1h', issuer: 'codeheist-api', audience: 'codeheist-clients' }
    );
    const forgedRes = await request(app)
      .get('/api/admin/puzzles')
      .set('Authorization', `Bearer ${forgedJwt}`);
    assert.equal(forgedRes.status, 403);

    // Expired token -> 401
    const expiredJwt = jwt.sign(
      { sub: adminId, tokenVersion: 1 },
      env.JWT_SECRET,
      { expiresIn: -10, issuer: 'codeheist-api', audience: 'codeheist-clients' }
    );
    const expiredRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${expiredJwt}`);
    assert.equal(expiredRes.status, 401);
  });

  test('5. Admin login succeeds & password hashes are never exposed', async () => {
    const res = await request(app).post('/api/auth/admin/login').send({
      email: adminEmail,
      password: adminPassword,
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.ok(res.body.user.roles.includes('admin'));
    assert.equal(res.body.user.password_hash, undefined);
    adminToken = res.body.token;

    const playersRes = await request(app)
      .get('/api/admin/players')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(playersRes.status, 200);
    for (const p of playersRes.body.players) {
      assert.equal(p.password_hash, undefined);
      assert.equal(p.passwordHash, undefined);
    }
  });

  test('6. Public mission APIs never leak correct_answer & solo gameplay persists XP', async () => {
    const listRes = await request(app).get('/api/missions');
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.missions.length >= 3);

    const firstMission = listRes.body.missions[0];
    const startRes = await request(app)
      .post(`/api/missions/${firstMission.id}/start`)
      .set('Authorization', `Bearer ${playerToken}`);
    assert.equal(startRes.status, 201);
    const { match, puzzles } = startRes.body;
    assert.ok(puzzles.length >= 2);
    for (const p of puzzles) {
      assert.equal(p.correct_answer, undefined);
      assert.equal(p.correctAnswer, undefined);
    }

    // Solve The Clockmaker's Manor 4 stages (HEAT, POCKET WATCH, MAP, CLARA)
    const answers = ['HEAT', 'POCKET WATCH', 'MAP', 'CLARA'];
    assert.equal(puzzles.length, answers.length);
    for (let i = 0; i < puzzles.length; i += 1) {
      const sub = await request(app)
        .post(`/api/missions/matches/${match.id}/submit`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ puzzleId: puzzles[i].id, answer: answers[i], hintsUsed: 0 });
      assert.equal(sub.status, 200);
      assert.equal(sub.body.isCorrect, true);
      assert.ok(sub.body.explanation);
      if (i === puzzles.length - 1) {
        assert.equal(sub.body.matchCompleted, true);
        assert.ok(sub.body.totalXpAwarded > 0);
        assert.ok(sub.body.coinsAwarded > 0);
      }
    }

    const lbRes = await request(app).get('/api/leaderboard?period=weekly');
    assert.equal(lbRes.status, 200);
    assert.ok(lbRes.body.leaderboard.some((r) => r.id === playerId && r.weekly_xp > 0));
  });

  test('7. Multiplayer room creation, join, start, and Daily Challenge work end-to-end', async () => {
    const missionsRes = await request(app).get('/api/missions');
    const missionId = missionsRes.body.missions[0].id;

    const roomRes = await request(app)
      .post('/api/missions/multiplayer/rooms')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ missionId, maxPlayers: 3 });
    assert.equal(roomRes.status, 201);
    const roomCode = roomRes.body.match.room_code;

    const joinRes = await request(app)
      .post(`/api/missions/multiplayer/rooms/${roomCode}/join`)
      .set('Authorization', `Bearer ${player2Token}`);
    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.body.players.length, 2);

    const startRes = await request(app)
      .post(`/api/missions/multiplayer/rooms/${roomCode}/start`)
      .set('Authorization', `Bearer ${playerToken}`);
    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.match.status, 'active');

    // Admin terminates this active multiplayer match with reason
    const termRes = await request(app)
      .post(`/api/admin/matches/${startRes.body.match.id}/terminate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Automated security verification termination' });
    assert.equal(termRes.status, 200);
    assert.equal(termRes.body.match.status, 'terminated');

    // Daily mystery start + solve (answer: MAP)
    const dailyStart = await request(app)
      .post('/api/missions/daily/start')
      .set('Authorization', `Bearer ${playerToken}`);
    assert.equal(dailyStart.status, 201);
    const dailySub = await request(app)
      .post(`/api/missions/matches/${dailyStart.body.match.id}/submit`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ puzzleId: dailyStart.body.puzzles[0].id, answer: 'MAP', hintsUsed: 0 });
    assert.equal(dailySub.status, 200);
    assert.equal(dailySub.body.matchCompleted, true);
  });

  test('8. Admin puzzle CRUD, duplicate daily date protection, reports & audit logs', async () => {
    const createPuz = await request(app)
      .post('/api/admin/puzzles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin Test Riddle',
        puzzleType: 'riddle_word',
        difficulty: 'easy',
        prompt: 'What has keys that open no locks?',
        puzzlePayload: { letterCount: 5 },
        correctAnswer: 'PIANO',
        explanation: 'A piano has musical keys!',
        hints: ['It makes music'],
        timeLimitSeconds: 90,
        xpReward: 50,
        coinsReward: 25,
        isPublished: false,
      });
    assert.equal(createPuz.status, 201);
    createdPuzzleId = createPuz.body.puzzle.id;

    // Upload puzzle image via Admin API
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const uploadRes = await request(app)
      .post('/api/admin/puzzles/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ filename: 'clue.png', dataUrl: tinyPng });
    assert.equal(uploadRes.status, 201);
    assert.match(uploadRes.body.imageUrl, /^\/uploads\/.*\.png$/);

    // Schedule daily challenge for future date & verify duplicate date returns 409
    const dc1 = await request(app)
      .post('/api/admin/daily-challenges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        puzzleId: createdPuzzleId,
        challengeDate: '2027-01-15',
        title: 'Future Challenge',
        bonusXp: 100,
      });
    assert.equal(dc1.status, 201);

    const dcDup = await request(app)
      .post('/api/admin/daily-challenges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        puzzleId: createdPuzzleId,
        challengeDate: '2027-01-15',
        title: 'Duplicate Challenge',
        bonusXp: 100,
      });
    assert.equal(dcDup.status, 409);

    const reportsRes = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(reportsRes.status, 200);
    assert.ok(reportsRes.body.summary.totalMatches >= 2);

    const auditRes = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(auditRes.status, 200);
    const actions = auditRes.body.auditLogs.map((l) => l.action);
    assert.ok(actions.includes('PUZZLE_CREATED'));
    assert.ok(actions.includes('MATCH_TERMINATED'));
  });

  test('9. Suspending or demoting an administrator immediately revokes access', async () => {
    await pool.query("UPDATE users SET status = 'suspended', token_version = token_version + 1 WHERE id = $1", [adminId]);
    const suspendedRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.ok([401, 403].includes(suspendedRes.status));

    // Reactivate & verify demotion (removing admin role) returns 403
    await pool.query("UPDATE users SET status = 'active' WHERE id = $1", [adminId]);
    const freshLogin = await request(app).post('/api/auth/admin/login').send({
      email: adminEmail,
      password: adminPassword,
    });
    assert.equal(freshLogin.status, 200);
    const freshToken = freshLogin.body.token;

    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [adminId]);
    const demotedRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${freshToken}`);
    assert.equal(demotedRes.status, 403);
  });
}
