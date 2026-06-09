import rateLimit from 'express-rate-limit';

const RATE_LIMIT_MESSAGE = { error: 'Too many requests. Please try again in 15 minutes.' };

// Factory so tests can build a limiter with a low threshold to assert 429 behavior
// without tripping the much higher production limit during a normal test run.
export const createAuthRateLimiter = (max, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });

export const authRateLimiter = createAuthRateLimiter(process.env.NODE_ENV === 'test' ? 1000 : 5);
