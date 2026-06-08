import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import { hashPassword } from '../utils/sanitization.js';

describe('POST /auth/login', () => {
  const credentials = { email: 'jane.dev@example.com', password: 'password123' };

  beforeEach(async () => {
    await new User({
      firstName: 'Jane',
      lastName: 'Dev',
      email: credentials.email,
      password: await hashPassword(credentials.password),
    }).save();
  });

  it('logs in with valid credentials and sets a JWT cookie', async () => {
    const res = await request(app).post('/auth/login').send(credentials);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.user.password).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/^token=/);
  });

  it('rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });
});
