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
        values: ['text', 'snippet'],
        message: '{VALUE} is not a valid message type',
      },
      default: 'text',
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
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
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });

messageSchema.pre('validate', function () {
  if (this.type !== 'snippet') this.language = null;
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
