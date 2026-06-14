import 'dotenv/config';
import http from 'http';
import connectDB from './config/database.js';
import { initSentry } from './utils/sentry.js';
import app from './app.js';
import { logger } from './utils/logger.js';
import { closeRedis } from './config/redis.js';
import { closeQueues } from './queues/index.js';

initSentry();

const PORT = process.env.PORT || 3008;

// Microservices cutover: no Socket.IO on the monolith (see realtime-gateway).
const httpServer = http.createServer(app);

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    logger.info(`Monolith shell running on port ${PORT} (health only — routes migrated to microservices)`);
  });
});

const shutdown = async () => {
  logger.info('Shutting down — closing connections...');
  await Promise.allSettled([closeQueues(), closeRedis()]);
  httpServer.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
