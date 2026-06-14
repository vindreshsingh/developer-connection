import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedis, isRedisEnabled } from '../config/redis.js';

const RATE_LIMIT_MESSAGE = { error: 'Too many requests. Please try again in 15 minutes.' };

// When Redis is enabled, every limiter shares a Redis-backed store so counts
// are global across all ECS tasks behind the ALB — otherwise each task keeps
// its own in-memory tally and the effective limit multiplies by the task
// count (the limiter silently stops working as you scale out). With no
// REDIS_URL this returns undefined and express-rate-limit uses its default
// in-memory store (single-instance dev + the Jest suite).
const buildStore = (prefix) => {
  if (!isRedisEnabled) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args) => getRedis().call(...args),
  });
};

// Generic factory so tests can build a limiter with a low threshold to assert
// 429 behavior without tripping the much higher production limits during a
// normal test run.
export const createRateLimiter = (max, windowMs = 15 * 60 * 1000, prefix = 'rl:') =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
    store: buildStore(prefix),
  });

// Kept as an alias — existing call sites / tests refer to this name.
export const createAuthRateLimiter = createRateLimiter;

const isTest = process.env.NODE_ENV === 'test';

// Tight limiter for auth endpoints (signup/login/password reset).
export const authRateLimiter = createRateLimiter(isTest ? 1000 : 5000, undefined, 'rl:auth:');

// Generous global baseline applied to every request — catches broad
// scraping/abuse without affecting normal usage.
export const globalRateLimiter = createRateLimiter(isTest ? 10000 : 300, 5 * 60 * 1000, 'rl:global:');

// Moderate limiter for swipe actions (interested/ignored).
export const swipeRateLimiter = createRateLimiter(isTest ? 1000 : 60, 5 * 60 * 1000, 'rl:swipe:');

// Moderate limiter for payment-initiation endpoints.
export const checkoutRateLimiter = createRateLimiter(isTest ? 1000 : 10, 15 * 60 * 1000, 'rl:checkout:');
