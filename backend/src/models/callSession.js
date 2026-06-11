/**
 * CallSession — persists the lifecycle of every 1:1 and group video call.
 *
 * A session is created when a call is initiated (status: ringing) and updated
 * as participants accept, decline, or leave. Duration is computed server-side
 * on end so the client never sends it.
 *
 * status state machine:
 *   ringing → active   (callee accepts)
 *   ringing → declined (callee declines)
 *   ringing → missed   (no answer after timeout — set by server cleanup job, Phase 6)
 *   active  → ended    (any participant ends the call)
 */

import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// ── Participant sub-document ──────────────────────────────────────────────────

const participantSchema = new mongoose.Schema(
  {
    userId:   { type: ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: null },
    leftAt:   { type: Date, default: null },
  },
  { _id: false },
);

// ── CallSession schema ────────────────────────────────────────────────────────

const callSessionSchema = new mongoose.Schema(
  {
    type: {
      type:     String,
      enum:     ['1:1', 'group'],
      required: true,
    },
    initiatorId: {
      type:     ObjectId,
      ref:      'User',
      required: true,
    },
    participants: {
      type:    [participantSchema],
      default: [],
    },
    // Only set for group calls
    groupId: {
      type:    ObjectId,
      ref:     'Group',
      default: null,
    },
    status: {
      type:    String,
      enum:    ['ringing', 'active', 'ended', 'missed', 'declined'],
      default: 'ringing',
    },
    startedAt: {
      type:    Date,
      default: null, // set when first callee accepts
    },
    endedAt: {
      type:    Date,
      default: null,
    },
    // Computed on end: Math.round((endedAt - startedAt) / 1000)
    duration: {
      type:    Number, // seconds
      default: null,
    },
    // Phase 6: set from initiator's isPremium at initiate time for group
    // calls. Raises the LiveKit room's participant cap (see Plan.features.
    // groupCallParticipantCap, applied in /calls/group-token).
    isPriority: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Fast lookup of all calls a user participated in (history endpoint)
callSessionSchema.index({ 'participants.userId': 1, createdAt: -1 });
// Active call lookup by group
callSessionSchema.index({ groupId: 1, status: 1 });
// Initiator history
callSessionSchema.index({ initiatorId: 1, createdAt: -1 });

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if userId is either the initiator or a listed participant.
 */
callSessionSchema.methods.isParticipant = function (userId) {
  if (this.initiatorId.equals(userId)) return true;
  return this.participants.some((p) => p.userId.equals(userId));
};

const CallSession = mongoose.model('CallSession', callSessionSchema);

export default CallSession;
