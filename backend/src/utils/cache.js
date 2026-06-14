/**
 * Redis read-through cache helper — Phase 10.
 *
 * All functions degrade safely: with Redis disabled (no REDIS_URL) `get`
 * always returns null (a miss) and `set`/`del` are no-ops, so callers fall
 * back to their underlying datastore exactly as before. A Redis error is
 * also treated as a miss rather than propagating — caching must never be the
 * reason a request fails.
 *
 * Values are JSON-serialized. Use `remember` for the common read-through
 * pattern (return cached, else compute + cache).
 */

import { getRedis } from '../config/redis.js';
import { logger } from './logger.js';

/** Fetch and JSON-parse a cached value, or null on miss/error. */
export const get = async (key) => {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn(`cache get failed for ${key}: ${err.message}`);
    return null;
  }
};

/** JSON-serialize and store a value with a TTL (seconds). No-op if disabled. */
export const set = async (key, value, ttlSeconds) => {
  const redis = getRedis();
  if (!redis) return;
  try {
    const raw = JSON.stringify(value);
    if (ttlSeconds) await redis.set(key, raw, 'EX', ttlSeconds);
    else await redis.set(key, raw);
  } catch (err) {
    logger.warn(`cache set failed for ${key}: ${err.message}`);
  }
};

/** Delete one or more keys. No-op if disabled. */
export const del = async (...keys) => {
  const redis = getRedis();
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    logger.warn(`cache del failed: ${err.message}`);
  }
};

/**
 * Read-through helper: return the cached value for `key`, otherwise run
 * `compute()`, cache its result for `ttlSeconds`, and return it. With Redis
 * disabled this is just `compute()` with no caching.
 */
export const remember = async (key, ttlSeconds, compute) => {
  const cached = await get(key);
  if (cached !== null) return cached;
  const fresh = await compute();
  if (fresh !== null && fresh !== undefined) await set(key, fresh, ttlSeconds);
  return fresh;
};
