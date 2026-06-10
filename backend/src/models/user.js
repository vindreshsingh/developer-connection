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
  },
  { timestamps: true }
);

userSchema.pre(/^find/, function (next) {
  this.where({ isActive: true });
  next();
});

userSchema.methods.validatePassword = async function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

userSchema.methods.getJWT = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

const User = mongoose.model('User', userSchema);

export default User;
