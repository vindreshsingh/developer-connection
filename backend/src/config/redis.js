/**
 * Redis connection factory — Phase 10 (caching + event-driven architecture).
 *
 * Redis is OPTIONAL by design. When `REDIS_URL` is unset (local dev without
 * a Redis container, and the Jest suite) every consumer of this module falls
 * back to the prior single-instance, in-memory behavior:
 *   - cache.js          → no-op (always a miss, reads go to Mongo)
 *   - rateLimiter.js    → in-memory express-rate-limit store
 *   - sockets/index.js  → no Socket.IO adapter (single-instance fan-out)
 *   - presenceService   → in-memory Map registry
 *   - queues/*          → inline execution (no worker process)
 *
 * This keeps the app a runnable monolith with zero infra, while production
 * (REDIS_URL present, >1 ECS task) gets correct distributed behavior.
 *
 * BullMQ requires its own connections with `maxRetriesPerRequest: null`, so
 * it builds clients via `createRedisClient` rather than sharing the singleton.
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

export const REDIS_URL = process.env.REDIS_URL || '';

/** True when a Redis URL is configured. Consumers branch on this. */
export const isRedisEnabled = Boolean(REDIS_URL);

const baseOptions = {
  // Fail fast instead of buffering commands forever if Redis is unreachable;
  // callers (cache) treat errors as a miss rather than hanging the request.
  enableOfflineQueue: false,
  retryStrategy: (times) => Math.min(times * 200, 2000),
};

/**
 * Build a fresh ioredis client. `overrides` lets BullMQ pass
 * `maxRetriesPerRequest: null` (required by bullmq) without changing the
 * shared singleton's behavior.
 */
export const createRedisClient = (overrides = {}) => {
  if (!isRedisEnabled) return null;
  const client = new Redis(REDIS_URL, { ...baseOptions, ...overrides });
  client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  return client;
};

let singleton = null;

/** Lazily-created shared client for cache + general use (null if disabled). */
export const getRedis = () => {
  if (!isRedisEnabled) return null;
  if (!singleton) {
    singleton = createRedisClient();
    singleton.on('connect', () => logger.info('Redis connected'));
  }
  return singleton;
};

/** Close the shared client (used on graceful shutdown / between tests). */
export const closeRedis = async () => {
  if (singleton) {
    await singleton.quit().catch(() => {});
    singleton = null;
  }
};
