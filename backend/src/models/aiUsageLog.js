/**
 * AIUsageLog — Phase 6 AI Developer Assistant.
 *
 * One document per LLM call. `checkAIRateLimit` counts today's documents
 * for `req.user._id` against `AI_DAILY_LIMIT`. Cache hits (recommendations)
 * do not create a log entry.
 */

import mongoose from 'mongoose';

const aiUsageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  endpoint: {
    type: String,
    enum: ['recommendations', 'resume-feedback', 'interview'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

const AIUsageLog = mongoose.model('AIUsageLog', aiUsageLogSchema);

export default AIUsageLog;
