import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import ConnectionRequest from '../models/connectionRequest.js';
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

describe('GET /profile/feed', () => {
  it('paginates with the correct page size and metadata', async () => {
    const { cookie } = await createUser();

    // 25 other users -> page 1 has 20, page 2 has 5
    for (let i = 0; i < 25; i++) {
      await createUser({ firstName: `Other${i}` });
    }

    const page1 = await request(app).get('/profile/feed').set('Cookie', cookie);
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 25,
      totalPages: 2,
      hasNextPage: true,
    });

    const page2 = await request(app).get('/profile/feed?page=2').set('Cookie', cookie);
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(5);
    expect(page2.body.pagination).toMatchObject({
      page: 2,
      total: 25,
      totalPages: 2,
      hasNextPage: false,
    });

    // No overlap between pages
    const page1Ids = page1.body.data.map((u) => u._id);
    const page2Ids = page2.body.data.map((u) => u._id);
    expect(page1Ids.filter((id) => page2Ids.includes(id))).toHaveLength(0);
  });

  it('treats invalid/missing page values as page 1', async () => {
    const { cookie } = await createUser();
    await createUser({ firstName: 'Other' });

    for (const page of [undefined, '0', '-1', 'abc']) {
      const url = page === undefined ? '/profile/feed' : `/profile/feed?page=${page}`;
      const res = await request(app).get(url).set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
    }
  });

  it('excludes the logged-in user from their own feed', async () => {
    const { user, cookie } = await createUser();

    const res = await request(app).get('/profile/feed').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.map((u) => u._id)).not.toContain(user._id.toString());
  });

  it('excludes users with any connection-request history (both directions, all statuses)', async () => {
    const { user, cookie } = await createUser();
    const { user: interested } = await createUser({ firstName: 'Interested' });
    const { user: accepted } = await createUser({ firstName: 'Accepted' });
    const { user: rejected } = await createUser({ firstName: 'Rejected' });
    const { user: stranger } = await createUser({ firstName: 'Stranger' });

    await ConnectionRequest.create({ fromUserId: user._id, toUserId: interested._id, status: 'interested' });
    await ConnectionRequest.create({ fromUserId: accepted._id, toUserId: user._id, status: 'accepted' });
    await ConnectionRequest.create({ fromUserId: user._id, toUserId: rejected._id, status: 'rejected' });

    const res = await request(app).get('/profile/feed').set('Cookie', cookie);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((u) => u._id);
    expect(ids).not.toContain(interested._id.toString());
    expect(ids).not.toContain(accepted._id.toString());
    expect(ids).not.toContain(rejected._id.toString());
    expect(ids).toContain(stranger._id.toString());
    expect(res.body.pagination.total).toBe(1);
  });

  it('excludes blocked users in both directions', async () => {
    const { user, cookie } = await createUser();
    const { user: iBlocked } = await createUser({ firstName: 'IBlocked' });
    const { user: blockedMe } = await createUser({ firstName: 'BlockedMe' });
    const { user: stranger } = await createUser({ firstName: 'Stranger' });

    user.blockedUsers.push(iBlocked._id);
    await user.save();

    blockedMe.blockedUsers.push(user._id);
    await blockedMe.save();

    const res = await request(app).get('/profile/feed').set('Cookie', cookie);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((u) => u._id);
    expect(ids).not.toContain(iBlocked._id.toString());
    expect(ids).not.toContain(blockedMe._id.toString());
    expect(ids).toContain(stranger._id.toString());
    expect(res.body.pagination.total).toBe(1);
  });

  it('filters by skills (case-insensitive) and reflects the filtered total in pagination', async () => {
    const { cookie } = await createUser();
    await createUser({ firstName: 'ReactDev', skills: ['React', 'Node.js'] });
    await createUser({ firstName: 'PythonDev', skills: ['Python'] });
    await createUser({ firstName: 'ReactDev2', skills: ['react', 'CSS'] });

    const res = await request(app).get('/profile/feed?skills=react').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.data.every((u) => u.skills.some((s) => s.toLowerCase() === 'react'))).toBe(true);
  });

  it('returns an empty page beyond the last page', async () => {
    const { cookie } = await createUser();
    await createUser({ firstName: 'Other' });

    const res = await request(app).get('/profile/feed?page=5').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.hasNextPage).toBe(false);
  });

  it('only returns public profile fields, never sensitive ones', async () => {
    const { cookie } = await createUser();
    await createUser({ firstName: 'Other' });

    const res = await request(app).get('/profile/feed').set('Cookie', cookie);

    expect(res.status).toBe(200);
    for (const u of res.body.data) {
      expect(u.password).toBeUndefined();
      expect(u.email).toBeUndefined();
      expect(u.tokenVersion).toBeUndefined();
      expect(u.oauthProviders).toBeUndefined();
    }
  });
});
