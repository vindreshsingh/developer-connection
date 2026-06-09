/**
 * GroupMessage — mirrors the Message schema, scoped to a Group instead of a Conversation.
 * Reactions, type (text/snippet), and language work identically to Phase 3 messages.
 */
import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const reactionSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    emoji:  { type: String, required: true, trim: true, maxlength: 8 },
  },
  { _id: false },
);

const groupMessageSchema = new mongoose.Schema(
  {
    groupId: {
      type:     ObjectId,
      ref:      'Group',
      required: true,
    },
    senderId: {
      type:     ObjectId,
      ref:      'User',
      required: true,
    },
    type: {
      type:     String,
      required: true,
      enum:     { values: ['text', 'snippet'], message: '{VALUE} is not a valid message type' },
      default:  'text',
    },
    body: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 10000,
    },
    language: {
      type:      String,
      default:   null,
      trim:      true,
      maxlength: 32,
    },
    reactions: {
      type:    [reactionSchema],
      default: [],
    },
  },
  { timestamps: true },
);

groupMessageSchema.index({ groupId: 1, createdAt: -1, _id: -1 });

groupMessageSchema.pre('validate', function () {
  if (this.type !== 'snippet') this.language = null;
});

const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

export default GroupMessage;
