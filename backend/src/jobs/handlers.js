/**
 * Job handlers — Phase 10 event-driven architecture.
 *
 * Each handler is a plain async function `(data) => {}` keyed by queue name.
 * They are the single source of truth for what a job DOES, shared by two
 * execution paths:
 *   - the worker process (src/worker.js) when Redis is enabled, and
 *   - inline execution (src/queues/index.js) when Redis is disabled.
 *
 * Handlers must be idempotent-friendly and self-contained (no req/res) so a
 * job can be retried safely by BullMQ.
 */

import { sendEmail } from '../utils/email.js';
import { QUEUE } from '../queues/names.js';
import User from '../models/user.js';
import { generateAndCacheRecommendations } from '../services/RecommendationService.js';

export const handlers = {
  // payload: { to, subject, html }
  [QUEUE.EMAIL]: async (data) => {
    await sendEmail(data);
  },

  // payload: { userId } — regenerate a user's AI match recommendations and
  // warm both the Mongo + Redis caches, off the request path. The next
  // GET /ai/recommendations returns the freshly cached result.
  [QUEUE.AI_RECOMMENDATIONS]: async ({ userId }) => {
    const user = await User.findById(userId);
    if (!user) return; // user deleted between enqueue and processing — no-op
    await generateAndCacheRecommendations(user);
  },
};

export default handlers;
