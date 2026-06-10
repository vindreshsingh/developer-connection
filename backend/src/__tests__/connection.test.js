import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import { hashPassword } from '../utils/sanitization.js';

const createUser = async (overrides = {}) => {
  const user = await new User({
    firstName: 'Test',
    lastName: 'User',
    email: `${Math.random().toString(36).slice(2)}@example.com`,
    password: await hashPassword('password123'),
    isEmailVerified: true,
    ...overrides,
  }).save();

  return { user, cookie: `token=${user.getJWT()}` };
};

describe('GET /request/blocked', () => {
  it('returns an empty list when no users are blocked', async () => {
    const { cookie } = await createUser();

    const res = await request(app).get('/request/blocked').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0, data: [] });
  });

  it('lists blocked users with public fields', async () => {
    const { cookie } = await createUser();
    const { user: target } = await createUser({ firstName: 'Blocked', lastName: 'Person' });

    await request(app).post(`/request/block/${target._id}`).set('Cookie', cookie);

    const res = await request(app).get('/request/blocked').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      _id: target._id.toString(),
      firstName: 'Blocked',
      lastName: 'Person',
    });
    expect(res.body.data[0].password).toBeUndefined();
  });
});

describe('DELETE /request/block/:userId', () => {
  it('removes a user from the blocked list', async () => {
    const { cookie } = await createUser();
    const { user: target } = await createUser({ firstName: 'Blocked' });

    await request(app).post(`/request/block/${target._id}`).set('Cookie', cookie);
    const unblockRes = await request(app).delete(`/request/block/${target._id}`).set('Cookie', cookie);
    expect(unblockRes.status).toBe(200);

    const res = await request(app).get('/request/blocked').set('Cookie', cookie);
    expect(res.body).toEqual({ count: 0, data: [] });
  });
});
