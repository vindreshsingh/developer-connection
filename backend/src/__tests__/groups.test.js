/**
 * Tests for Phase 4 Task B1 — Groups REST CRUD.
 *
 * Covers:
 *   - POST   /groups             (create)
 *   - GET    /groups             (list + tag filter)
 *   - GET    /groups/:groupId    (detail)
 *   - POST   /groups/:id/join
 *   - DELETE /groups/:id/leave
 *   - POST   /groups/:id/members/:userId  (admin invite)
 *   - DELETE /groups/:id/members/:userId  (admin remove)
 *   - PATCH  /groups/:id        (admin update)
 *   - DELETE /groups/:id        (admin soft-delete)
 *   - GET    /groups/:id/messages
 *   - canUserAccessGroup helper
 */

import request from 'supertest';
import app     from '../app.js';
import User    from '../models/user.js';
import Group   from '../models/group.js';
import GroupMessage from '../models/groupMessage.js';
import { canUserAccessGroup } from '../utils/groupAuthorization.js';
import { hashPassword } from '../utils/sanitization.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const createUser = async (email = `user_${Date.now()}@test.com`) => {
  const user = await new User({
    firstName: 'Test', email,
    password: await hashPassword('pass1234'),
    isEmailVerified: true,
  }).save();
  return { user, cookie: `token=${user.getJWT()}` };
};

const createGroup = async (creatorId, overrides = {}) =>
  Group.create({
    name:        overrides.name        ?? 'React Devs',
    description: overrides.description ?? 'A group for React developers',
    tags:        overrides.tags        ?? ['react', 'javascript'],
    createdBy:   creatorId,
    members:     [{ userId: creatorId, role: 'admin', joinedAt: new Date() }],
    memberCount: 1,
    ...overrides,
  });

// ── canUserAccessGroup ────────────────────────────────────────────────────────

describe('canUserAccessGroup', () => {
  it('returns allowed: true with role for a member', async () => {
    const { user } = await createUser('cg1@test.com');
    const group    = await createGroup(user._id);

    const result = await canUserAccessGroup(user._id, group._id);
    expect(result.allowed).toBe(true);
    expect(result.role).toBe('admin');
  });

  it('returns allowed: false for a non-member', async () => {
    const { user: admin }    = await createUser('cg2a@test.com');
    const { user: nonMember} = await createUser('cg2b@test.com');
    const group = await createGroup(admin._id);

    const result = await canUserAccessGroup(nonMember._id, group._id);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not a member/);
  });

  it('returns allowed: false for a deleted group', async () => {
    const { user } = await createUser('cg3@test.com');
    const group    = await createGroup(user._id);
    await Group.findByIdAndUpdate(group._id, { deletedAt: new Date() });

    const result = await canUserAccessGroup(user._id, group._id);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/deleted/);
  });
});

// ── POST /groups ──────────────────────────────────────────────────────────────

describe('POST /groups', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/groups').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('creates a group and sets creator as admin member', async () => {
    const { user, cookie } = await createUser('pg1@test.com');

    const res = await request(app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ name: 'React Devs', description: 'For React devs', tags: ['react'] });

    expect(res.status).toBe(201);
    expect(res.body.group.name).toBe('React Devs');
    expect(res.body.group.members).toHaveLength(1);
    expect(res.body.group.members[0].role).toBe('admin');
    expect(res.body.group.memberCount).toBe(1);
    expect(res.body.group.createdBy.toString()).toBe(user._id.toString());
  });

  it('returns 400 when name is missing', async () => {
    const { cookie } = await createUser('pg2@test.com');
    const res = await request(app).post('/groups').set('Cookie', cookie).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('normalises tags to lowercase', async () => {
    const { cookie } = await createUser('pg3@test.com');
    const res = await request(app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ name: 'TS Group', tags: ['TypeScript', 'REACT'] });

    expect(res.status).toBe(201);
    expect(res.body.group.tags).toEqual(expect.arrayContaining(['typescript', 'react']));
  });
});

// ── GET /groups ───────────────────────────────────────────────────────────────

describe('GET /groups', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/groups');
    expect(res.status).toBe(401);
  });

  it('lists active groups sorted by memberCount desc', async () => {
    const { user, cookie } = await createUser('gl1@test.com');
    await createGroup(user._id, { name: 'Small', memberCount: 1 });
    await createGroup(user._id, { name: 'Big',   memberCount: 50 });

    const res = await request(app).get('/groups').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    // Big group should come first
    const names = res.body.data.map((g) => g.name);
    expect(names.indexOf('Big')).toBeLessThan(names.indexOf('Small'));
  });

  it('excludes soft-deleted groups', async () => {
    const { user, cookie } = await createUser('gl2@test.com');
    await createGroup(user._id, { name: 'Deleted Group', deletedAt: new Date() });
    await createGroup(user._id, { name: 'Active Group' });

    const res = await request(app).get('/groups').set('Cookie', cookie);

    const names = res.body.data.map((g) => g.name);
    expect(names).not.toContain('Deleted Group');
    expect(names).toContain('Active Group');
  });

  it('filters groups by tags', async () => {
    const { user, cookie } = await createUser('gl3@test.com');
    await createGroup(user._id, { name: 'React Group', tags: ['react'] });
    await createGroup(user._id, { name: 'Vue Group',   tags: ['vue'] });

    const res = await request(app).get('/groups?tags=react').set('Cookie', cookie);

    const names = res.body.data.map((g) => g.name);
    expect(names).toContain('React Group');
    expect(names).not.toContain('Vue Group');
  });

  it('paginates correctly', async () => {
    const { cookie } = await createUser('gl4@test.com');
    const res = await request(app).get('/groups?page=1').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20 });
  });
});

// ── GET /groups/:groupId ──────────────────────────────────────────────────────

describe('GET /groups/:groupId', () => {
  it('returns group detail with member list', async () => {
    const { user, cookie } = await createUser('gg1@test.com');
    const group = await createGroup(user._id);

    const res = await request(app)
      .get(`/groups/${group._id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.group.name).toBe('React Devs');
    expect(typeof res.body.recentMessageCount).toBe('number');
  });

  it('returns 404 for unknown group', async () => {
    const { cookie } = await createUser('gg2@test.com');
    const fakeId = '64f1a2b3c4d5e6f7a8b9c0d1';
    const res = await request(app).get(`/groups/${fakeId}`).set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 404 for soft-deleted group', async () => {
    const { user, cookie } = await createUser('gg3@test.com');
    const group = await createGroup(user._id, { deletedAt: new Date() });

    const res = await request(app)
      .get(`/groups/${group._id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});

// ── POST /groups/:id/join ─────────────────────────────────────────────────────

describe('POST /groups/:id/join', () => {
  it('lets a non-member join a public group', async () => {
    const { user: admin }  = await createUser('jn1a@test.com');
    const { user: joiner, cookie } = await createUser('jn1b@test.com');
    const group = await createGroup(admin._id);

    const res = await request(app)
      .post(`/groups/${group._id}/join`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.group.memberCount).toBe(2);

    const saved = await Group.findById(group._id);
    expect(saved.getMember(joiner._id)).toBeTruthy();
  });

  it('returns 400 when already a member', async () => {
    const { user, cookie } = await createUser('jn2@test.com');
    const group = await createGroup(user._id); // user is already member

    const res = await request(app)
      .post(`/groups/${group._id}/join`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already a member/);
  });

  it('returns 400 when group is full', async () => {
    const { user: admin }         = await createUser('jn3a@test.com');
    const { cookie } = await createUser('jn3b@test.com');
    const group = await createGroup(admin._id, { memberCount: 500, maxMembers: 500 });

    const res = await request(app)
      .post(`/groups/${group._id}/join`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/full/);
  });
});

// ── DELETE /groups/:id/leave ──────────────────────────────────────────────────

describe('DELETE /groups/:id/leave', () => {
  it('removes a regular member from the group', async () => {
    const { user: admin }  = await createUser('lv1a@test.com');
    const { user: member, cookie } = await createUser('lv1b@test.com');
    const group = await createGroup(admin._id);

    // Add member first
    group.members.push({ userId: member._id, role: 'member', joinedAt: new Date() });
    group.memberCount = 2;
    await group.save();

    const res = await request(app)
      .delete(`/groups/${group._id}/leave`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const saved = await Group.findById(group._id);
    expect(saved.getMember(member._id)).toBeUndefined();
    expect(saved.memberCount).toBe(1);
  });

  it('returns 403 when not a member', async () => {
    const { user: admin }       = await createUser('lv2a@test.com');
    const { user: _nm, cookie } = await createUser('lv2b@test.com');
    const group = await createGroup(admin._id);

    const res = await request(app)
      .delete(`/groups/${group._id}/leave`)
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
  });

  it('returns 400 when sole admin tries to leave', async () => {
    const { user, cookie } = await createUser('lv3@test.com');
    const group = await createGroup(user._id); // only admin

    const res = await request(app)
      .delete(`/groups/${group._id}/leave`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sole admin/);
  });

  it('allows admin to leave when another admin exists', async () => {
    const { user: admin1, cookie: c1 } = await createUser('lv4a@test.com');
    const { user: admin2 }             = await createUser('lv4b@test.com');
    const group = await createGroup(admin1._id);

    group.members.push({ userId: admin2._id, role: 'admin', joinedAt: new Date() });
    group.memberCount = 2;
    await group.save();

    const res = await request(app)
      .delete(`/groups/${group._id}/leave`)
      .set('Cookie', c1);

    expect(res.status).toBe(200);
  });
});

// ── POST /groups/:id/members/:userId (admin invite) ───────────────────────────

describe('POST /groups/:id/members/:userId', () => {
  it('admin can add a user as a member', async () => {
    const { user: admin, cookie: adminCookie } = await createUser('am1a@test.com');
    const { user: target }                     = await createUser('am1b@test.com');
    const group = await createGroup(admin._id);

    const res = await request(app)
      .post(`/groups/${group._id}/members/${target._id}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.group.memberCount).toBe(2);
  });

  it('non-admin cannot add members', async () => {
    const { user: admin }               = await createUser('am2a@test.com');
    const { user: member, cookie: mc }  = await createUser('am2b@test.com');
    const { user: target }              = await createUser('am2c@test.com');
    const group = await createGroup(admin._id);

    group.members.push({ userId: member._id, role: 'member', joinedAt: new Date() });
    group.memberCount = 2;
    await group.save();

    const res = await request(app)
      .post(`/groups/${group._id}/members/${target._id}`)
      .set('Cookie', mc);

    expect(res.status).toBe(403);
  });

  it('returns 400 if user is already a member', async () => {
    const { user: admin, cookie: ac } = await createUser('am3a@test.com');
    const { user: existing }          = await createUser('am3b@test.com');
    const group = await createGroup(admin._id);

    group.members.push({ userId: existing._id, role: 'member', joinedAt: new Date() });
    group.memberCount = 2;
    await group.save();

    const res = await request(app)
      .post(`/groups/${group._id}/members/${existing._id}`)
      .set('Cookie', ac);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already a member/);
  });
});

// ── DELETE /groups/:id/members/:userId (admin remove) ────────────────────────

describe('DELETE /groups/:id/members/:userId', () => {
  it('admin can remove a member', async () => {
    const { user: admin, cookie: ac } = await createUser('rm1a@test.com');
    const { user: member }            = await createUser('rm1b@test.com');
    const group = await createGroup(admin._id);

    group.members.push({ userId: member._id, role: 'member', joinedAt: new Date() });
    group.memberCount = 2;
    await group.save();

    const res = await request(app)
      .delete(`/groups/${group._id}/members/${member._id}`)
      .set('Cookie', ac);

    expect(res.status).toBe(200);
    const saved = await Group.findById(group._id);
    expect(saved.getMember(member._id)).toBeUndefined();
  });

  it('admin cannot remove themselves via this endpoint', async () => {
    const { user: admin, cookie: ac } = await createUser('rm2@test.com');
    const group = await createGroup(admin._id);

    const res = await request(app)
      .delete(`/groups/${group._id}/members/${admin._id}`)
      .set('Cookie', ac);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/leave endpoint/);
  });
});

// ── PATCH /groups/:id ─────────────────────────────────────────────────────────

describe('PATCH /groups/:id', () => {
  it('admin can update name, description, and tags', async () => {
    const { user, cookie } = await createUser('up1@test.com');
    const group = await createGroup(user._id);

    const res = await request(app)
      .patch(`/groups/${group._id}`)
      .set('Cookie', cookie)
      .send({ name: 'Updated Name', tags: ['vue', 'nodejs'] });

    expect(res.status).toBe(200);
    expect(res.body.group.name).toBe('Updated Name');
    expect(res.body.group.tags).toEqual(expect.arrayContaining(['vue', 'nodejs']));
  });

  it('returns 400 for invalid fields', async () => {
    const { user, cookie } = await createUser('up2@test.com');
    const group = await createGroup(user._id);

    const res = await request(app)
      .patch(`/groups/${group._id}`)
      .set('Cookie', cookie)
      .send({ maxMembers: 1000 }); // not an allowed update field

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid fields/);
  });

  it('non-admin cannot update a group', async () => {
    const { user: admin }               = await createUser('up3a@test.com');
    const { user: member, cookie: mc }  = await createUser('up3b@test.com');
    const group = await createGroup(admin._id);

    group.members.push({ userId: member._id, role: 'member', joinedAt: new Date() });
    group.memberCount = 2;
    await group.save();

    const res = await request(app)
      .patch(`/groups/${group._id}`)
      .set('Cookie', mc)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

// ── DELETE /groups/:id (soft-delete) ─────────────────────────────────────────

describe('DELETE /groups/:id', () => {
  it('admin can soft-delete a group', async () => {
    const { user, cookie } = await createUser('del1@test.com');
    const group = await createGroup(user._id);

    const res = await request(app)
      .delete(`/groups/${group._id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const saved = await Group.findById(group._id);
    expect(saved.deletedAt).not.toBeNull();
  });

  it('group disappears from GET /groups after deletion', async () => {
    const { user, cookie } = await createUser('del2@test.com');
    const group = await createGroup(user._id, { name: 'To Be Deleted' });

    await request(app).delete(`/groups/${group._id}`).set('Cookie', cookie);

    const listRes = await request(app).get('/groups').set('Cookie', cookie);
    const names   = listRes.body.data.map((g) => g.name);
    expect(names).not.toContain('To Be Deleted');
  });
});

// ── GET /groups/:id/messages ──────────────────────────────────────────────────

describe('GET /groups/:id/messages', () => {
  it('returns paginated messages for members', async () => {
    const { user, cookie } = await createUser('msg1@test.com');
    const group = await createGroup(user._id);

    await GroupMessage.create([
      { groupId: group._id, senderId: user._id, type: 'text', body: 'Hello' },
      { groupId: group._id, senderId: user._id, type: 'text', body: 'World' },
    ]);

    const res = await request(app)
      .get(`/groups/${group._id}/messages`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    // messages returned in chronological order (oldest first)
    expect(res.body.messages[0].body).toBe('Hello');
    expect(res.body.messages[1].body).toBe('World');
  });

  it('returns 403 for non-members', async () => {
    const { user: admin }       = await createUser('msg2a@test.com');
    const { user: _nm, cookie } = await createUser('msg2b@test.com');
    const group = await createGroup(admin._id);

    const res = await request(app)
      .get(`/groups/${group._id}/messages`)
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
  });
});
