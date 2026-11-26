import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { loadEnv } from './config/env.js';
import { createPool, verifyDatabaseConnection } from './db/pool.js';
import { createApp } from './app.js';

const env = loadEnv();
const pool = createPool(env.DATABASE_URL, env.DATABASE_SSL);

let io;
const ioProxy = {
  to: (...args) => io?.to(...args),
  emit: (...args) => io?.emit(...args),
};

const { app, authMiddleware } = createApp({ pool, env, io: ioProxy });
const httpServer = http.createServer(app);

// Attach Socket.IO AFTER Express is passed to http.createServer(app) so
// Engine.IO wraps the request listener and handles /socket.io/* exclusively.
io = new SocketIOServer(httpServer, {
  cors: {
    origin(origin, callback) {
      if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Socket origin ${origin} rejected`));
    },
    credentials: true,
  },
});

// Authenticate Socket.IO connections against PostgreSQL
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || '';
    const user = await authMiddleware.verifyBearerToken(token);
    socket.data.user = user;
    next();
  } catch (err) {
    next(new Error(err.message));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;

  socket.on('match:join', async (matchId) => {
    if (!matchId) return;
    try {
      const check = await pool.query(
        'SELECT 1 FROM match_players WHERE match_id = $1 AND user_id = $2',
        [matchId, user.id]
      );
      if (check.rowCount > 0) {
        socket.join(`match:${matchId}`);
      }
    } catch (err) {
      console.error('[Socket match:join error]', err.message);
    }
  });

  socket.on('match:leave', (matchId) => {
    if (matchId) {
      socket.leave(`match:${matchId}`);
    }
  });
});

async function start() {
  try {
    const dbInfo = await verifyDatabaseConnection(pool);
    console.log(`Connected to PostgreSQL (${dbInfo.database_name})`);
  } catch (err) {
    console.error(`PostgreSQL connection validation failed: ${err.message}`);
    process.exit(1);
  }

  httpServer.listen(env.PORT, () => {
    console.log(`CodeHeist API + Socket.IO listening on port ${env.PORT}`);
    console.log(`Allowed origins: ${env.ALLOWED_ORIGINS.join(', ')}`);
  });
}

start();
