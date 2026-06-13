/**
 * RecommendationCache — Phase 6 AI Developer Assistant.
 *
 * One document per user. `GET /ai/recommendations` reads this cache first;
 * a miss (no document or `expiresAt` in the past) triggers a fresh
 * `AIService.generateRecommendationReasons` call and an upsert with a new
 * 24h `expiresAt`. `dismissed` entries are excluded from the shortlist for
 * 14 days (checked at shortlist-build time, not enforced by schema/TTL).
 */

import mongoose from 'mongoose';

const recommendationCacheSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    recommendations: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          reason: { type: String, required: true },
        },
      ],
      default: [],
    },
    dismissed: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          dismissedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

const RecommendationCache = mongoose.model('RecommendationCache', recommendationCacheSchema);

export default RecommendationCache;
