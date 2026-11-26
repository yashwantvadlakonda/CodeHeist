import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool, verifyDatabaseConnection } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not configured in backend/.env');
  process.exit(1);
}

const pool = createPool(databaseUrl, process.env.DATABASE_SSL === 'true');
verifyDatabaseConnection(pool)
  .then((info) => {
    console.log(`PostgreSQL connected: database="${info.database_name}" time="${info.server_time}"`);
    return pool.end();
  })
  .catch(async (err) => {
    console.error(`PostgreSQL connection failed: ${err.message}`);
    await pool.end();
    process.exit(1);
  });
