import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { createPool, withTransaction } from '../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BCRYPT_ROUNDS = 12;

const passwordSchema = z
  .string()
  .min(10, 'Administrator password must be at least 10 characters long')
  .max(128, 'Administrator password must be at most 128 characters long');

function promptHidden(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(promptText, (answer) => {
        rl.close();
        resolve(answer);
      });
      return;
    }

    process.stdout.write(promptText);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (char) => {
      if (char === '\r' || char === '\n' || char === '\u0004') {
        stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (char === '\u0003') {
        stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        reject(new Error('Cancelled by user'));
      } else if (char === '\u007f' || char === '\b') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        value += char;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

export async function bootstrapInitialAdmin(pool, rawEmail, options = {}) {
  const email = z.string().email().parse(rawEmail).toLowerCase();
  const password = passwordSchema.parse(options.password);
  const username = options.username || 'root_admin';
  const displayName = options.displayName || 'Security Administrator';

  return withTransaction(pool, async (client) => {
    const existingAdmins = await client.query(`
      SELECT u.id, u.email
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = 'admin'
    `);

    if (existingAdmins.rowCount > 0) {
      const existingEmail = existingAdmins.rows[0].email;
      throw new Error(
        `One-time admin bootstrap blocked: an administrator account (${existingEmail}) already exists. To securely reset its password instead of creating duplicates, run: npm run bootstrap-admin -- --reset-password`
      );
    }

    const emailCheck = await client.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (emailCheck.rowCount > 0) {
      throw new Error(
        `Cannot bootstrap admin: a user with email ${email} already exists. Refusing to auto-promote existing accounts.`
      );
    }

    const adminRoleRes = await client.query("SELECT id FROM roles WHERE name = 'admin'");
    if (adminRoleRes.rowCount === 0) {
      throw new Error('Role "admin" missing. Run database migrations and seeds first.');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const userRes = await client.query(
      `INSERT INTO users (username, email, password_hash, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id, username, email, status, created_at`,
      [username, email, passwordHash]
    );
    const adminUser = userRes.rows[0];

    await client.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       VALUES ($1, $2, $1)`,
      [adminUser.id, adminRoleRes.rows[0].id]
    );

    await client.query(
      `INSERT INTO player_profiles (user_id, display_name, avatar_seed, rank_title)
       VALUES ($1, $2, 'sentinel-root', 'System Administrator')`,
      [adminUser.id, displayName]
    );

    await client.query(
      `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'ADMIN_BOOTSTRAPPED', 'user', $2, $3::jsonb)`,
      [adminUser.id, String(adminUser.id), JSON.stringify({ email: adminUser.email })]
    );

    return { admin: adminUser };
  });
}

export async function resetAdminPassword(pool, rawEmail, newPassword) {
  const email = z.string().email().parse(rawEmail).toLowerCase();
  const password = passwordSchema.parse(newPassword);

  return withTransaction(pool, async (client) => {
    const adminRes = await client.query(
      `SELECT u.id, u.email, u.username
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'admin' AND LOWER(u.email) = LOWER($1)`,
      [email]
    );

    if (adminRes.rowCount === 0) {
      throw new Error(`No existing administrator account found for ${email}.`);
    }

    const admin = adminRes.rows[0];
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await client.query(
      `UPDATE users
       SET password_hash = $2, token_version = token_version + 1, updated_at = NOW()
       WHERE id = $1`,
      [admin.id, passwordHash]
    );

    await client.query(
      `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
       VALUES ($1, 'ADMIN_PASSWORD_RESET', 'user', $2, $3::jsonb)`,
      [admin.id, String(admin.id), JSON.stringify({ email: admin.email })]
    );

    return { admin };
  });
}

async function runCli() {
  const databaseUrl = process.env.DATABASE_URL;
  const adminEmail = process.env.ADMIN_EMAIL;
  const isReset = process.argv.includes('--reset-password');

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is required in backend/.env');
    process.exit(1);
  }
  if (!adminEmail) {
    console.error('ERROR: ADMIN_EMAIL is required in backend/.env');
    process.exit(1);
  }

  const pool = createPool(databaseUrl, process.env.DATABASE_SSL === 'true');
  try {
    if (!isReset) {
      const existing = await pool.query(`
        SELECT u.id, u.email
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name = 'admin'
      `);
      if (existing.rowCount > 0) {
        console.error(
          `BOOTSTRAP BLOCKED: Administrator (${existing.rows[0].email}) already exists.`
        );
        console.error(
          'To reset the existing administrator password securely (revoking prior tokens), run:'
        );
        console.error('  npm run bootstrap-admin -- --reset-password');
        process.exitCode = 1;
        return;
      }
    }

    console.log(`Administrator Email: ${adminEmail}`);
    const password = await promptHidden('Enter new administrator password (min 10 chars): ');
    const confirm = await promptHidden('Confirm administrator password: ');

    if (password !== confirm) {
      console.error('ERROR: Passwords do not match.');
      process.exitCode = 1;
      return;
    }

    if (isReset) {
      const { admin } = await resetAdminPassword(pool, adminEmail, password);
      console.log('===============================================================');
      console.log('CodeHeist Administrator Password Reset Complete');
      console.log(`Admin ID : ${admin.id}`);
      console.log(`Email    : ${admin.email}`);
      console.log('Prior JWT sessions have been invalidated.');
      console.log('===============================================================');
    } else {
      const { admin } = await bootstrapInitialAdmin(pool, adminEmail, { password });
      console.log('===============================================================');
      console.log('CodeHeist Initial Administrator Provisioned');
      console.log(`Admin ID : ${admin.id}`);
      console.log(`Email    : ${admin.email}`);
      console.log(`Username : ${admin.username}`);
      console.log('Role     : admin (stored in PostgreSQL)');
      console.log('===============================================================');
    }
  } catch (err) {
    console.error(`BOOTSTRAP FAILED: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
