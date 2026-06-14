/**
 * Event-driven job producers — Phase 10.
 *
 * `enqueue(queueName, data, opts)` is the only API routes use. Its behavior
 * depends on whether Redis is configured:
 *
 *   - Redis ON  → the job is added to a BullMQ queue and processed
 *                 asynchronously by the worker process (src/worker.js),
 *                 keeping the request path fast. Failures are retried with
 *                 backoff by BullMQ.
 *   - Redis OFF → the handler runs INLINE (awaited) in the current process,
 *                 reproducing the original synchronous behavior. This keeps
 *                 the app a zero-infra monolith for local dev and the Jest
 *                 suite (which asserts e.g. that a verification email was
 *                 "sent" during the signup request).
 *
 * Either way the work is defined once in src/jobs/handlers.js.
 */

import { Queue } from 'bullmq';
import { createRedisClient, isRedisEnabled } from '../config/redis.js';
import { handlers } from '../jobs/handlers.js';
import { logger } from '../utils/logger.js';

// Sensible retry defaults for transactional jobs (e.g. flaky SMTP).
const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

// One shared Redis connection for all producer queues (BullMQ requires
// maxRetriesPerRequest: null). Null when Redis is disabled.
let connection;
const getConnection = () => {
  if (!isRedisEnabled) return null;
  if (!connection) connection = createRedisClient({ maxRetriesPerRequest: null });
  return connection;
};

const queues = new Map();
const getQueue = (name) => {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, { connection: getConnection() }));
  }
  return queues.get(name);
};

/**
 * Enqueue a job (Redis on) or run its handler inline (Redis off).
 * `data` is the job payload; `opts` are BullMQ job options (ignored inline).
 */
export const enqueue = async (queueName, data, opts = {}) => {
  if (!isRedisEnabled) {
    const handler = handlers[queueName];
    if (!handler) throw new Error(`No inline handler for queue "${queueName}"`);
    return handler(data);
  }
  return getQueue(queueName).add(queueName, data, { ...DEFAULT_JOB_OPTS, ...opts });
};

/** Close producer queues + connection (graceful shutdown). */
export const closeQueues = async () => {
  await Promise.all([...queues.values()].map((q) => q.close().catch(() => {})));
  queues.clear();
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
};

export { getConnection };

if (isRedisEnabled) logger.info('BullMQ producers ready (Redis enabled)');
