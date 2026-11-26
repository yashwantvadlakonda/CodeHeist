import pg from 'pg';

const { Pool } = pg;

export function createPool(databaseUrl, useSsl = false) {
  return new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function verifyDatabaseConnection(pool) {
  const res = await pool.query('SELECT NOW() AS server_time, current_database() AS database_name');
  return res.rows[0];
}
