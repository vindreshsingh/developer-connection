/**
 * ResumeFeedback — Phase 6 AI Developer Assistant.
 *
 * One document per `POST /ai/resume-feedback` submission. `extractedText`
 * is kept so feedback can be regenerated/audited without re-uploading the
 * PDF; `resumeUrl` points at the Cloudinary copy.
 */

import mongoose from 'mongoose';

const resumeFeedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resumeUrl: {
      type: String,
      required: true,
    },
    extractedText: {
      type: String,
      required: true,
    },
    feedback: {
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
      atsNotes: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

const ResumeFeedback = mongoose.model('ResumeFeedback', resumeFeedbackSchema);

export default ResumeFeedback;
