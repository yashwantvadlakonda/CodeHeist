import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createPool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function runMigrations(pool, migrationsDir) {
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedRes = await pool.query('SELECT version FROM schema_migrations');
  const appliedVersions = new Set(appliedRes.rows.map((r) => r.version));

  const newlyApplied = [];
  for (const file of files) {
    const version = file.split('_')[0];
    if (appliedVersions.has(version)) {
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [version, file]
      );
      await client.query('COMMIT');
      newlyApplied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
  return newlyApplied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }
  const pool = createPool(databaseUrl, process.env.DATABASE_SSL === 'true');
  const migrationsDir = path.resolve(__dirname, '../../../postgresql/migrations');
  runMigrations(pool, migrationsDir)
    .then((applied) => {
      console.log(
        applied.length > 0
          ? `Applied migrations: ${applied.join(', ')}`
          : 'All migrations already applied.'
      );
      return pool.end();
    })
    .catch(async (err) => {
      console.error(err.message);
      await pool.end();
      process.exit(1);
    });
}
