import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type:     ObjectId,
      ref:      'User',
      required: true,
    },
    content: {
      type:      String,
      trim:      true,
      maxlength: 3000,
      default:   '',
    },
    codeSnippet: {
      code:     { type: String, default: null, maxlength: 10000 },
      language: { type: String, default: null, trim: true, maxlength: 32 },
    },
    images: {
      type:    [String],
      default: [],
    },
    tags: {
      type:    [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
      default: [],
    },
    likes: {
      type:    [{ type: ObjectId, ref: 'User' }],
      default: [],
    },
    // Denormalised counters — kept in sync on like/unlike and comment create/delete.
    likeCount: {
      type:    Number,
      default: 0,
      min:     0,
    },
    commentCount: {
      type:    Number,
      default: 0,
      min:     0,
    },
    deletedAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ deletedAt: 1, createdAt: -1 });
postSchema.index({ tags: 1 });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if userId has liked this post. */
postSchema.methods.isLikedBy = function (userId) {
  return this.likes.some((id) => id.equals(userId));
};

const Post = mongoose.model('Post', postSchema);

export default Post;
