import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createPool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function runSeeds(pool, seedsDir) {
  const files = (await fs.readdir(seedsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(seedsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Seed ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }
  const pool = createPool(databaseUrl, process.env.DATABASE_SSL === 'true');
  const seedsDir = path.resolve(__dirname, '../../../postgresql/seeds');
  runSeeds(pool, seedsDir)
    .then((seeded) => {
      console.log(`Executed seeds: ${seeded.join(', ')}`);
      return pool.end();
    })
    .catch(async (err) => {
      console.error(err.message);
      await pool.end();
      process.exit(1);
    });
}
