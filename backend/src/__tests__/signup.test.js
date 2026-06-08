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

describe('POST /auth/signup', () => {
  const signupData = {
    firstName: 'Jane',
    lastName: 'Dev',
    email: 'jane.signup@example.com',
    password: 'password123',
  };

  beforeEach(() => {
    sendMail.mockClear();
  });

  it('creates an unverified user and sends a verification email', async () => {
    const res = await request(app).post('/auth/signup').send(signupData);

    expect(res.status).toBe(201);

    const user = await User.findOne({ email: signupData.email });
    expect(user.isEmailVerified).toBe(false);
    expect(user.emailVerifyToken).toEqual(expect.any(String));
    expect(user.emailVerifyExpiry.getTime()).toBeGreaterThan(Date.now());

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].subject).toBe('Verify your email');
  });
});
