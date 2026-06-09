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
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => validator.isEmail(v),
        message: (props) => `${props.value} is not a valid email address`,
      },
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
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
