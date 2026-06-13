/**
 * checkAIRateLimit — Phase 6 AI Developer Assistant.
 *
 * Caps each user to `AI_DAILY_LIMIT` LLM-backed `/ai/*` calls per calendar
 * day (server local time). Mounted after `requirePremium('aiAssistant')` on
 * routes that always invoke `AIService` (resume feedback, interview
 * start/respond). `GET /ai/recommendations` only invokes the LLM on a cache
 * miss, so it calls `isAIRateLimited` directly instead of using this as
 * Express middleware.
 */

import AIUsageLog from '../models/aiUsageLog.js';

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 20);

export const isAIRateLimited = async (userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const count = await AIUsageLog.countDocuments({
    userId,
    createdAt: { $gte: startOfDay },
  });

  return count >= DAILY_LIMIT;
};

export const checkAIRateLimit = async (req, res, next) => {
  if (await isAIRateLimited(req.user._id)) {
    return res.status(429).json({ error: 'AI_RATE_LIMIT_EXCEEDED' });
  }
  next();
};
