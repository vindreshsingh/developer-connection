import mongoose from 'mongoose';

// One document per (user, feature, UTC day) — incremented by checkAiQuota
// to enforce the per-plan daily caps in config/limits.js.
const aiUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    feature: {
      type: String,
      enum: ['profile_feedback', 'match_insight', 'interview_prep'],
      required: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD', UTC
      required: true,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

aiUsageSchema.index({ userId: 1, feature: 1, date: 1 }, { unique: true });

const AiUsage = mongoose.model('AiUsage', aiUsageSchema);

export default AiUsage;
