import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 2,
        message: 'A conversation must have exactly 2 participants',
      },
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    // Per-conversation last-read timestamp per participant (Slack/Linear model —
    // NOT per-message). Keyed by stringified userId.
    lastReadBy: {
      type: Map,
      of: Date,
      default: {},
    },
  },
  { timestamps: true }
);

// Sorted-pair unique index prevents duplicate conversation docs between the same two users.
conversationSchema.index({ participants: 1 }, { unique: true });

conversationSchema.pre('validate', function () {
  if (Array.isArray(this.participants) && this.participants.length === 2) {
    // Keep participants in a stable, sorted order so the unique index catches
    // (A, B) and (B, A) as the same conversation.
    this.participants = [...this.participants].sort((a, b) => a.toString().localeCompare(b.toString()));
  }
});

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
