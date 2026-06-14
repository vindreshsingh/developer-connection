/**
 * Worker process — Phase 10 event-driven architecture.
 *
 * A SEPARATE deployable service from the API (same image, different command:
 * `node src/worker.js`). It runs BullMQ workers that drain the queues defined
 * in src/queues/names.js, executing the shared handlers in src/jobs/handlers.js
 * off the request path. Scale it independently of the API.
 *
 * It connects to MongoDB too, because handlers may read/write data (e.g. a
 * future AI-recommendation regeneration job). It does NOT serve HTTP.
 *
 * Requires REDIS_URL — without Redis there is no queue to drain (the API runs
 * handlers inline instead), so the worker exits with a clear message.
 */

import 'dotenv/config';
import { Worker } from 'bullmq';
import connectDB from './config/database.js';
import { isRedisEnabled, createRedisClient } from './config/redis.js';
import { QUEUE_NAMES } from './queues/names.js';
import { handlers } from './jobs/handlers.js';
import { initSentry } from './utils/sentry.js';
import { logger } from './utils/logger.js';

initSentry();

if (!isRedisEnabled) {
  logger.error('Worker requires REDIS_URL — nothing to do without a queue. Exiting.');
  process.exit(1);
}

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 5;

const workers = [];

const start = async () => {
  await connectDB();

  for (const name of QUEUE_NAMES) {
    const handler = handlers[name];
    if (!handler) {
      logger.warn(`No handler registered for queue "${name}" — skipping.`);
      continue;
    }

    const worker = new Worker(name, async (job) => handler(job.data), {
      connection: createRedisClient({ maxRetriesPerRequest: null }),
      concurrency: WORKER_CONCURRENCY,
    });

    worker.on('completed', (job) => logger.info(`[${name}] job ${job.id} completed`));
    worker.on('failed', (job, err) =>
      logger.error(`[${name}] job ${job?.id} failed: ${err.message}`),
    );

    workers.push(worker);
    logger.info(`Worker listening on queue "${name}" (concurrency ${WORKER_CONCURRENCY})`);
  }
};

// Drain in-flight jobs before exiting so a deploy/scale-in doesn't drop work.
const shutdown = async () => {
  logger.info('Worker shutting down — closing queues...');
  await Promise.all(workers.map((w) => w.close().catch(() => {})));
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
  logger.error(`Worker failed to start: ${err.message}`);
  process.exit(1);
});
