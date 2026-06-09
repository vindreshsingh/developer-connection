import { jest } from '@jest/globals';

const sendMail = jest.fn().mockResolvedValue(true);

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: jest.fn(() => ({ sendMail })),
  },
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { default: User } = await import('../models/user.js');
const { hashPassword } = await import('../utils/sanitization.js');

describe('POST /auth/resend-verification', () => {
  const email = 'resend.dev@example.com';

  beforeEach(() => {
    sendMail.mockClear();
  });

  it('resends a verification email for an unverified account', async () => {
    await new User({
      firstName: 'Resend',
      lastName: 'Dev',
      email,
      password: await hashPassword('password123'),
      isEmailVerified: false,
    }).save();

    const res = await request(app).post('/auth/resend-verification').send({ email });

    expect(res.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('rejects an already-verified account', async () => {
    await new User({
      firstName: 'Resend',
      lastName: 'Dev',
      email,
      password: await hashPassword('password123'),
      isEmailVerified: true,
    }).save();

    const res = await request(app).post('/auth/resend-verification').send({ email });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This account is already verified');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown email', async () => {
    const res = await request(app).post('/auth/resend-verification').send({ email: 'nobody@example.com' });

    expect(res.status).toBe(404);
  });
});
