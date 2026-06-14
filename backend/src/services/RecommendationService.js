/**
 * RecommendationService — Phase 6 logic, extracted in Phase 10 so the
 * expensive AI generation can run in two places from one definition:
 *   - inline in GET /ai/recommendations  (Redis disabled), and
 *   - in the worker process via the `ai-recommendations` queue (Redis enabled).
 *
 * `generateAndCacheRecommendations` is the unit of work a queue job executes:
 * build the shortlist, ask the LLM for reasons, persist to the durable Mongo
 * cache, and warm the Redis tier. It consumes the daily AI budget
 * (AIUsageLog) only when it actually calls the model.
 */

import User from '../models/user.js';
import ConnectionRequest from '../models/connectionRequest.js';
import RecommendationCache from '../models/recommendationCache.js';
import AIUsageLog from '../models/aiUsageLog.js';
import { AIService } from './AIService.js';
import * as cache from '../utils/cache.js';

export const RECOMMENDATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const DISMISS_EXCLUSION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const MAX_CANDIDATES = 15;

export const RECOMMENDATION_FIELDS =
  'firstName lastName photoUrl bio skills techStack githubUrl linkedinUrl';

/** Per-user Redis key for the populated recommendations response. */
export const recsCacheKey = (userId) => `ai:recs:${userId}`;

export const buildRecommendationsResponse = (cacheDoc) =>
  (cacheDoc?.recommendations || [])
    .filter((r) => r.userId)
    .map((r) => ({ user: r.userId, reason: r.reason }));

// Excludes self, accepted/pending connection-request partners (either
// direction), blocked users (either direction), and anyone dismissed within
// the last 14 days — same shape as the profile feed exclusion set.
export const buildShortlist = async (me) => {
  const loggedInUserId = me._id;

  const interactions = await ConnectionRequest.find({
    $or: [{ fromUserId: loggedInUserId }, { toUserId: loggedInUserId }],
  }).select('fromUserId toUserId');

  const excludedIds = new Set([loggedInUserId.toString()]);
  for (const r of interactions) {
    excludedIds.add(r.fromUserId.toString());
    excludedIds.add(r.toUserId.toString());
  }

  for (const id of me.blockedUsers) excludedIds.add(id.toString());
  const blockedByOthers = await User.find({ blockedUsers: loggedInUserId }).select('_id');
  for (const u of blockedByOthers) excludedIds.add(u._id.toString());

  const cacheDoc = await RecommendationCache.findOne({ userId: loggedInUserId });
  const dismissCutoff = Date.now() - DISMISS_EXCLUSION_MS;
  for (const d of cacheDoc?.dismissed || []) {
    if (d.dismissedAt.getTime() > dismissCutoff) excludedIds.add(d.userId.toString());
  }

  const candidates = await User.find({ _id: { $nin: [...excludedIds] } }).select(
    `${RECOMMENDATION_FIELDS} experience`,
  );

  const mySkills = new Set((me.skills || []).map((s) => s.toLowerCase()));
  const myTech = new Set((me.techStack || []).map((s) => s.toLowerCase()));

  return candidates
    .map((c) => {
      const score =
        (c.skills || []).filter((s) => mySkills.has(s.toLowerCase())).length +
        (c.techStack || []).filter((s) => myTech.has(s.toLowerCase())).length;
      return { user: c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map((s) => s.user);
};

/**
 * Build a fresh recommendations set for `user`, persist it to the Mongo cache
 * (24h), warm the Redis tier, and return the populated response data. Throws
 * AIServiceError if the LLM call fails. Caller is responsible for the daily
 * rate-limit gate (this always consumes budget when candidates exist).
 */
export const generateAndCacheRecommendations = async (user) => {
  const userId = user._id;
  const candidates = await buildShortlist(user);
  let recommendations = [];

  if (candidates.length > 0) {
    const aiResult = await AIService.generateRecommendationReasons(user, candidates);
    recommendations = aiResult
      .filter((r) => candidates[r.index])
      .map((r) => ({ userId: candidates[r.index]._id, reason: r.reason }));

    await AIUsageLog.create({ userId, endpoint: 'recommendations' });
  }

  const cacheDoc = await RecommendationCache.findOneAndUpdate(
    { userId },
    { recommendations, expiresAt: new Date(Date.now() + RECOMMENDATION_CACHE_TTL_MS) },
    { upsert: true, new: true },
  ).populate({ path: 'recommendations.userId', select: RECOMMENDATION_FIELDS });

  const data = buildRecommendationsResponse(cacheDoc);
  await cache.set(recsCacheKey(userId), data, Math.floor(RECOMMENDATION_CACHE_TTL_MS / 1000));
  return data;
};
