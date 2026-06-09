import crypto from 'crypto';
import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import { hashPassword } from '../utils/sanitization.js';

const credentials = { email: 'verify.dev@example.com', password: 'password123' };

const createUser = async ({ verified = false, expired = false } = {}) => {
  const plainToken = 'a'.repeat(64);
  const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

  const user = new User({
    firstName: 'Verify',
    lastName: 'Dev',
    email: credentials.email,
    password: await hashPassword(credentials.password),
    isEmailVerified: verified,
    emailVerifyToken: verified ? null : hashedToken,
    emailVerifyExpiry: verified ? null : Date.now() + (expired ? -1000 : 60 * 60 * 1000),
  });
  await user.save();

  return { user, plainToken };
};

describe('GET /auth/verify-email/:token', () => {
  it('verifies the account with a valid token', async () => {
    const { plainToken } = await createUser();

    const res = await request(app).get(`/auth/verify-email/${plainToken}`);

    expect(res.status).toBe(200);

    const user = await User.findOne({ email: credentials.email });
    expect(user.isEmailVerified).toBe(true);
    expect(user.emailVerifyToken).toBeNull();
    expect(user.emailVerifyExpiry).toBeNull();
  });

  it('rejects an invalid token', async () => {
    await createUser();

    const res = await request(app).get(`/auth/verify-email/${'b'.repeat(64)}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid or expired verification link');
  });

  it('rejects an expired token', async () => {
    const { plainToken } = await createUser({ expired: true });

    const res = await request(app).get(`/auth/verify-email/${plainToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid or expired verification link');
  });
});

describe('POST /auth/login — email verification gate', () => {
  it('blocks login for an unverified account', async () => {
    await createUser({ verified: false });

    const res = await request(app).post('/auth/login').send(credentials);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Please verify your email before logging in');
  });

  it('allows login for a verified account', async () => {
    await createUser({ verified: true });

    const res = await request(app).post('/auth/login').send(credentials);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful');
  });
});
