import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// ── Member sub-document ───────────────────────────────────────────────────────

const memberSchema = new mongoose.Schema(
  {
    userId:   { type: ObjectId, ref: 'User', required: true },
    role:     { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// ── Group schema ──────────────────────────────────────────────────────────────

const groupSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 80,
    },
    description: {
      type:      String,
      trim:      true,
      maxlength: 500,
      default:   '',
    },
    tags: {
      type:    [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
      default: [],
    },
    createdBy: {
      type:     ObjectId,
      ref:      'User',
      required: true,
    },
    members: {
      type:    [memberSchema],
      default: [],
    },
    // Denormalised counter — kept in sync on join/leave/remove for fast list queries.
    memberCount: {
      type:    Number,
      default: 1,
      min:     1,
    },
    maxMembers: {
      type:    Number,
      default: 500, // Phase 4 cap (locked decision in RFC)
    },
    visibility: {
      type:    String,
      enum:    ['public'],
      default: 'public',
    },
    deletedAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────

groupSchema.index({ tags: 1 });
groupSchema.index({ memberCount: -1 });
groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ deletedAt: 1 }); // fast filter for active groups

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the member entry for userId, or undefined. */
groupSchema.methods.getMember = function (userId) {
  return this.members.find((m) => m.userId.equals(userId));
};

/** Returns true if userId is an admin of this group. */
groupSchema.methods.isAdmin = function (userId) {
  const m = this.getMember(userId);
  return m?.role === 'admin';
};

const Group = mongoose.model('Group', groupSchema);

export default Group;
