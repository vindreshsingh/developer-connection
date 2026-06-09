import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import validator from 'validator';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      // Required for email/password accounts; optional for OAuth-only accounts
      // that didn't return an email (e.g. GitHub private-email users).
      // Application layer enforces email presence for email/password sign-up.
      type: String,
      required: false,
      default: null,
      unique: true,
      sparse: true, // allows multiple null values in the unique index
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => v === null || v === undefined || validator.isEmail(v),
        message: (props) => `${props.value} is not a valid email address`,
      },
    },
    password: {
      // Optional for OAuth-only accounts; required enforced at application layer
      // (at least one of password or oauthProviders must be present).
      type: String,
      required: false,
      minlength: 8,
      default: null,
    },
    photoUrl: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || validator.isURL(v),
        message: (props) => `${props.value} is not a valid URL`,
      },
    },
    bio: {
      type: String,
      maxlength: 500,
      default: '',
    },
    skills: {
      type: [String],
      default: [],
    },
    blockedUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    githubUrl: {
      type: String,
      default: null,
    },
    linkedinUrl: {
      type: String,
      default: null,
    },
    age: {
      type: Number,
      min: 18,
      max:75,
    },
    gender: {
      type: String,
      enum: {
        values: ['male', 'female', 'other'],
        message: '{VALUE} is not a valid gender',
      },
      validate: {
        validator: (v) => ['male', 'female', 'other'].includes(v),
        message: (props) => `${props.value} is not a valid gender`,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpiry: {
      type: Date,
      default: null,
    },
    coverImageUrl: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || validator.isURL(v),
        message: (props) => `${props.value} is not a valid URL`,
      },
    },
    techStack: {
      type: [String],
      default: [],
    },
    experience: {
      type: [
        {
          title: { type: String, required: true, trim: true },
          company: { type: String, required: true, trim: true },
          startDate: { type: Date, required: true },
          endDate: { type: Date, default: null },
          description: { type: String, default: '', maxlength: 1000 },
        },
      ],
      default: [],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifyToken: {
      type: String,
      default: null,
    },
    emailVerifyExpiry: {
      type: Date,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },

    // ── Phase 4: OAuth ────────────────────────────────────────────────────────
    oauthProviders: {
      type: [
        {
          provider:   { type: String, enum: ['github', 'google', 'linkedin'], required: true },
          providerId: { type: String, required: true },
          // AES-256-GCM encrypted JSON: { iv, tag, ciphertext }. Never returned to client.
          accessToken: { type: String, default: null },
          linkedAt:   { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // ── Phase 4: GitHub enrichment ────────────────────────────────────────────
    github: {
      username:    { type: String, default: null },
      avatarUrl:   { type: String, default: null },
      profileUrl:  { type: String, default: null },
      topRepos: {
        type: [
          {
            name:     { type: String, required: true },
            url:      { type: String, required: true },
            stars:    { type: Number, default: 0 },
            language: { type: String, default: null },
          },
        ],
        default: [],
      },
      topLanguages:          { type: [String], default: [] },
      contributionsLastYear: { type: Number, default: null },
      syncedAt:              { type: Date, default: null },
    },

    // ── Phase 4: LinkedIn enrichment ──────────────────────────────────────────
    linkedin: {
      headline:   { type: String, default: null },
      company:    { type: String, default: null },
      jobTitle:   { type: String, default: null },
      profileUrl: { type: String, default: null },
      syncedAt:   { type: Date, default: null },
    },
  },
  { timestamps: true }
);

userSchema.pre(/^find/, function () {
  this.where({ isActive: true });
});

userSchema.methods.validatePassword = async function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

userSchema.methods.getJWT = function () {
  return jwt.sign({ id: this._id, tokenVersion: this.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

const User = mongoose.model('User', userSchema);

export default User;
