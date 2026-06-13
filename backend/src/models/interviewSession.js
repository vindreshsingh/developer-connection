/**
 * InterviewSession — Phase 6 AI Developer Assistant.
 *
 * Tracks a single mock-interview chat. `transcript` alternates
 * `assistant`/`user` turns; the session auto-completes once it reaches the
 * 10-turn cap (enforced in the route handler, not the schema).
 */

import mongoose from 'mongoose';

const interviewSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    focusArea: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
    },
    transcript: {
      type: [
        {
          role: { type: String, enum: ['user', 'assistant'], required: true },
          content: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);

export default InterviewSession;
