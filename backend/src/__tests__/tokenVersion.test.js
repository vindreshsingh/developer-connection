import crypto from 'crypto';
import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import { hashPassword } from '../utils/sanitization.js';

describe('Session invalidation via tokenVersion', () => {
  const credentials = { email: 'reset.session@example.com', password: 'password123' };

  const createVerifiedUser = async () => {
    const plainResetToken = crypto.randomBytes(32).toString('hex');
    const user = await new User({
      firstName: 'Reset',
      lastName: 'Tester',
      email: credentials.email,
      password: await hashPassword(credentials.password),
      isEmailVerified: true,
      passwordResetToken: crypto.createHash('sha256').update(plainResetToken).digest('hex'),
      passwordResetExpiry: Date.now() + 15 * 60 * 1000,
    }).save();

    return { user, plainResetToken };
  };

  it('invalidates previously issued tokens after a password reset, and leaves new sessions working', async () => {
    const { plainResetToken } = await createVerifiedUser();

    const loginRes = await request(app).post('/auth/login').send(credentials);
    expect(loginRes.status).toBe(200);
    const oldCookie = loginRes.headers['set-cookie'][0];

    const beforeReset = await request(app).get('/profile').set('Cookie', oldCookie);
    expect(beforeReset.status).toBe(200);

    const resetRes = await request(app)
      .post(`/auth/reset-password/${plainResetToken}`)
      .send({ newPassword: 'newPassword456' });
    expect(resetRes.status).toBe(200);

    const afterReset = await request(app).get('/profile').set('Cookie', oldCookie);
    expect(afterReset.status).toBe(401);

    const newLoginRes = await request(app)
      .post('/auth/login')
      .send({ email: credentials.email, password: 'newPassword456' });
    expect(newLoginRes.status).toBe(200);
    const newCookie = newLoginRes.headers['set-cookie'][0];

    const withNewCookie = await request(app).get('/profile').set('Cookie', newCookie);
    expect(withNewCookie.status).toBe(200);
  });
});
