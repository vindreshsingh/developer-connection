import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true, trim: true, maxlength: 8 },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ['text', 'snippet', 'call_summary'],
        message: '{VALUE} is not a valid message type',
      },
      default: 'text',
    },
    body: {
      type: String,
      // Required for text/snippet; optional for call_summary (system-generated)
      required: function () { return this.type !== 'call_summary'; },
      trim: true,
      maxlength: 10000,
      default: null,
    },
    // Set only when type === 'snippet' (e.g. 'javascript', 'python')
    language: {
      type: String,
      default: null,
      trim: true,
      maxlength: 32,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    // Set only when type === 'call_summary' (Phase 5 C2)
    callSummary: {
      callId:   { type: mongoose.Schema.Types.ObjectId, ref: 'CallSession', default: null },
      duration: { type: Number, default: 0 },       // seconds
      status:   { type: String, default: 'ended' },  // 'ended' | 'missed' | 'declined'
      callType: { type: String, default: '1:1' },    // '1:1' | 'group'
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
// Sparse index so the upsert-based idempotency check is fast
messageSchema.index({ 'callSummary.callId': 1 }, { sparse: true });

messageSchema.pre('validate', function () {
  if (this.type !== 'snippet') this.language = null;
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
