import crypto from 'crypto';
import express from 'express';
import nodemailer from 'nodemailer';
import validator from 'validator';
import User from '../models/user.js';
import { validateSignupData, sanitizeSignupData, hashPassword } from '../utils/sanitization.js';
import { AUTH } from '../constants/apiEndpoints.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Generates a fresh hashed verification token for the user, saves it, and emails the link.
// Shared by signup (new account) and resend-verification (existing unverified account).
const sendVerificationEmail = async (user) => {
  const plainToken = crypto.randomBytes(32).toString('hex');
  user.emailVerifyToken = crypto.createHash('sha256').update(plainToken).digest('hex');
  user.emailVerifyExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  await user.save();

  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${plainToken}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // use Gmail App Password, not your actual password
    },
  });

  await transporter.sendMail({
    from: `"Developer Connection" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Verify your email',
    html: `
      <p>Welcome to Developer Connection!</p>
      <p>Please verify your email address by clicking the link below (valid for 24 hours):</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>If you did not create this account, ignore this email.</p>
    `,
  });
};

router.post(AUTH.SIGNUP, authRateLimiter, async (req, res) => {
  try {
    validateSignupData(req.body);

    const data = sanitizeSignupData(req.body);
    data.email = data.email.toLowerCase();
    data.password = await hashPassword(data.password);

    const user = new User(data);
    await user.save();
    await sendVerificationEmail(user);

    res.status(201).json({ message: 'User created successfully. Please check your email to verify your account.', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post(AUTH.RESEND_VERIFICATION, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(email))
      return res.status(400).json({ error: 'Valid email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account found with this email' });

    if (user.isEmailVerified)
      return res.status(400).json({ error: 'This account is already verified' });

    await sendVerificationEmail(user);

    res.status(200).json({ message: 'Verification email resent. Please check your inbox.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(AUTH.LOGIN, authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    if (!validator.isEmail(email))
      return res.status(400).json({ error: 'Invalid email format' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await user.validatePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.isEmailVerified)
      return res.status(403).json({ error: 'Please verify your email before logging in' });

    const token = user.getJWT();
    res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.status(200).json({ message: 'Login successful', user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get(AUTH.VERIFY_EMAIL, async (req, res) => {
  try {
    const { token } = req.params;

    // Hash the incoming plain token to compare against the stored hashed token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token that hasn't expired yet
    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpiry: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });

    user.isEmailVerified = true;
    user.emailVerifyToken = null;
    user.emailVerifyExpiry = null;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(AUTH.LOGOUT, (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

router.post(AUTH.FORGOT_PASSWORD, authRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Validate email format
    if (!email || !validator.isEmail(email))
      return res.status(400).json({ error: 'Valid email is required' });

    // 2. Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account found with this email' });

    // 3. Generate a random reset token (plain) and hash it before saving to DB
    //    Plain token goes in the email link, hashed token stays in DB (security best practice)
    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

    // 4. Save hashed token and expiry (15 minutes) to DB
    user.passwordResetToken = hashedToken;
    user.passwordResetExpiry = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    // 5. Build reset URL with plain token (frontend will call reset-password with this)
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${plainToken}`;

    // 6. Send email with reset link using nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // use Gmail App Password, not your actual password
      },
    });

    await transporter.sendMail({
      from: `"Developer Connection" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password (valid for 15 minutes):</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>If you did not request this, ignore this email.</p>
      `,
    });

    res.status(200).json({ message: 'Password reset link sent to your email' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(AUTH.RESET_PASSWORD, authRateLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // 1. Hash the incoming plain token to compare against the stored hashed token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // 2. Find user with matching token that hasn't expired yet
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiry: { $gt: Date.now() }, // token must still be valid
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

    // 3. Hash new password and save, then clear the reset token fields
    user.password = await hashPassword(newPassword);
    user.passwordResetToken = null;
    user.passwordResetExpiry = null;
    await user.save();

    res.status(200).json({ message: 'Password reset successful. Please login.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
