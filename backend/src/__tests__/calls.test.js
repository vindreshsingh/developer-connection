/**
 * Tests for Phase 5 Task A1 — CallSession model + REST CRUD.
 *
 * Covers:
 *   POST   /calls            — initiate 1:1 and group calls
 *   GET    /calls            — call history
 *   GET    /calls/:id        — single call metadata
 *   POST   /calls/:id/accept
 *   POST   /calls/:id/decline
 *   POST   /calls/:id/end
 *   isParticipant helper
 */

import request    from 'supertest';
import app        from '../app.js';
import User       from '../models/user.js';
import Group      from '../models/group.js';
import CallSession from '../models/callSession.js';
import ConnectionRequest from '../models/connectionRequest.js';
import { hashPassword } from '../utils/sanitization.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const createUser = async (email = `u_${Date.now()}@test.com`) => {
  const user = await new User({
    firstName: 'Test', email,
    password: await hashPassword('pass1234'),
    isEmailVerified: true,
  }).save();
  return { user, cookie: `token=${user.getJWT()}` };
};

const connect = async (userA, userB) => {
  await ConnectionRequest.create({
    fromUserId: userA._id,
    toUserId:   userB._id,
    status:     'accepted',
  });
};

const createGroup = async (creatorId) =>
  Group.create({
    name:        `Group ${Date.now()}`,
    createdBy:   creatorId,
    members:     [{ userId: creatorId, role: 'admin', joinedAt: new Date() }],
    memberCount: 1,
  });

// ── isParticipant helper ──────────────────────────────────────────────────────

describe('CallSession.isParticipant', () => {
  it('returns true for the initiator', async () => {
    const { user } = await createUser('ip1@test.com');
    const { user: callee } = await createUser('ip2@test.com');
    const call = await CallSession.create({
      type: '1:1',
      initiatorId: user._id,
      participants: [
        { userId: user._id,   joinedAt: new Date() },
        { userId: callee._id, joinedAt: null },
      ],
    });
    expect(call.isParticipant(user._id)).toBe(true);
  });

  it('returns true for a participant (non-initiator)', async () => {
    const { user } = await createUser('ip3@test.com');
    const { user: callee } = await createUser('ip4@test.com');
    const call = await CallSession.create({
      type: '1:1',
      initiatorId: user._id,
      participants: [
        { userId: user._id,   joinedAt: new Date() },
        { userId: callee._id, joinedAt: null },
      ],
    });
    expect(call.isParticipant(callee._id)).toBe(true);
  });

  it('returns false for an unrelated user', async () => {
    const { user } = await createUser('ip5@test.com');
    const { user: callee } = await createUser('ip6@test.com');
    const { user: stranger } = await createUser('ip7@test.com');
    const call = await CallSession.create({
      type: '1:1',
      initiatorId: user._id,
      participants: [
        { userId: user._id,   joinedAt: new Date() },
        { userId: callee._id, joinedAt: null },
      ],
    });
    expect(call.isParticipant(stranger._id)).toBe(false);
  });
});

// ── POST /calls — initiate ────────────────────────────────────────────────────

describe('POST /calls (1:1)', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/calls').send({ type: '1:1', targetUserId: 'abc' });
    expect(res.status).toBe(401);
  });

  it('initiates a 1:1 call between accepted connections', async () => {
    const { user: caller, cookie } = await createUser('c1a@test.com');
    const { user: callee } = await createUser('c1b@test.com');
    await connect(caller, callee);

    const res = await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: '1:1', targetUserId: callee._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.callId).toBeTruthy();

    const saved = await CallSession.findById(res.body.callId);
    expect(saved.status).toBe('ringing');
    expect(saved.type).toBe('1:1');
    expect(saved.isParticipant(callee._id)).toBe(true);
  });

  it('returns 403 when calling a non-connection', async () => {
    const { cookie }       = await createUser('c2a@test.com');
    const { user: target } = await createUser('c2b@test.com');

    const res = await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: '1:1', targetUserId: target._id.toString() });

    expect(res.status).toBe(403);
  });

  it('returns 400 when calling yourself', async () => {
    const { user, cookie } = await createUser('c3@test.com');

    const res = await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: '1:1', targetUserId: user._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yourself/);
  });

  it('returns 400 for missing targetUserId', async () => {
    const { cookie } = await createUser('c4@test.com');
    const res = await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: '1:1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/targetUserId/);
  });

  it('returns 409 when a call is already in progress', async () => {
    const { user: caller, cookie } = await createUser('c5a@test.com');
    const { user: callee }         = await createUser('c5b@test.com');
    await connect(caller, callee);

    // First call
    await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: '1:1', targetUserId: callee._id.toString() });

    // Duplicate call
    const res = await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: '1:1', targetUserId: callee._id.toString() });

    expect(res.status).toBe(409);
  });

  it('returns 400 for an invalid type', async () => {
    const { cookie } = await createUser('c6@test.com');
    const res = await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: 'video' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/);
  });
});

describe('POST /calls (group)', () => {
  it('starts a group call for a group member', async () => {
    const { user, cookie } = await createUser('gc1@test.com');
    const group = await createGroup(user._id);

    const res = await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: 'group', groupId: group._id.toString() });

    expect(res.status).toBe(201);
    const saved = await CallSession.findById(res.body.callId);
    expect(saved.type).toBe('group');
    expect(saved.status).toBe('active');
    expect(saved.startedAt).toBeTruthy();
  });

  it('returns 403 for a non-member', async () => {
    const { user: admin } = await createUser('gc2a@test.com');
    const { cookie }      = await createUser('gc2b@test.com');
    const group = await createGroup(admin._id);

    const res = await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: 'group', groupId: group._id.toString() });

    expect(res.status).toBe(403);
  });

  it('returns 409 when a group call is already active', async () => {
    const { user, cookie } = await createUser('gc3@test.com');
    const group = await createGroup(user._id);

    await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: 'group', groupId: group._id.toString() });

    const res = await request(app)
      .post('/calls')
      .set('Cookie', cookie)
      .send({ type: 'group', groupId: group._id.toString() });

    expect(res.status).toBe(409);
  });
});

// ── GET /calls — history ──────────────────────────────────────────────────────

describe('GET /calls', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/calls');
    expect(res.status).toBe(401);
  });

  it('returns only calls the user participated in', async () => {
    const { user: a, cookie: ca } = await createUser('h1a@test.com');
    const { user: b }             = await createUser('h1b@test.com');
    const { user: c }             = await createUser('h1c@test.com');
    await connect(a, b);
    await connect(b, c);

    // Call between A and B
    await CallSession.create({
      type: '1:1', initiatorId: a._id,
      participants: [{ userId: a._id, joinedAt: new Date() }, { userId: b._id, joinedAt: null }],
    });
    // Call between B and C (A not involved)
    await CallSession.create({
      type: '1:1', initiatorId: b._id,
      participants: [{ userId: b._id, joinedAt: new Date() }, { userId: c._id, joinedAt: null }],
    });

    const res = await request(app).get('/calls').set('Cookie', ca);
    expect(res.status).toBe(200);

    const callParticipants = res.body.data.map((call) =>
      call.participants.map((p) => p.userId?._id ?? p.userId)
    );
    // Every returned call must include user A
    callParticipants.forEach((ids) => {
      expect(ids.some((id) => id.toString() === a._id.toString())).toBe(true);
    });
  });

  it('paginates results', async () => {
    const { cookie } = await createUser('h2@test.com');
    const res = await request(app).get('/calls?page=1').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20 });
  });
});

// ── GET /calls/:id ────────────────────────────────────────────────────────────

describe('GET /calls/:callId', () => {
  it('returns call metadata for a participant', async () => {
    const { user, cookie } = await createUser('gm1@test.com');
    const { user: callee } = await createUser('gm2@test.com');

    const call = await CallSession.create({
      type: '1:1', initiatorId: user._id,
      participants: [
        { userId: user._id,   joinedAt: new Date() },
        { userId: callee._id, joinedAt: null },
      ],
    });

    const res = await request(app)
      .get(`/calls/${call._id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.call.type).toBe('1:1');
  });

  it('returns 403 for a non-participant', async () => {
    const { user: a } = await createUser('gm3a@test.com');
    const { user: b } = await createUser('gm3b@test.com');
    const { cookie }  = await createUser('gm3c@test.com');

    const call = await CallSession.create({
      type: '1:1', initiatorId: a._id,
      participants: [
        { userId: a._id, joinedAt: new Date() },
        { userId: b._id, joinedAt: null },
      ],
    });

    const res = await request(app).get(`/calls/${call._id}`).set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown call', async () => {
    const { cookie } = await createUser('gm4@test.com');
    const res = await request(app)
      .get('/calls/64f1a2b3c4d5e6f7a8b9c0d1')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

// ── POST /calls/:id/accept ────────────────────────────────────────────────────

describe('POST /calls/:callId/accept', () => {
  it('transitions status to active and sets startedAt', async () => {
    const { user: caller } = await createUser('acc1a@test.com');
    const { user: callee, cookie } = await createUser('acc1b@test.com');

    const call = await CallSession.create({
      type: '1:1', initiatorId: caller._id,
      participants: [
        { userId: caller._id, joinedAt: new Date() },
        { userId: callee._id, joinedAt: null },
      ],
    });

    const res = await request(app)
      .post(`/calls/${call._id}/accept`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const saved = await CallSession.findById(call._id);
    expect(saved.status).toBe('active');
    expect(saved.startedAt).toBeTruthy();

    const participant = saved.participants.find((p) => p.userId.equals(callee._id));
    expect(participant.joinedAt).toBeTruthy();
  });

  it('returns 400 when call is not in ringing status', async () => {
    const { user: caller }         = await createUser('acc2a@test.com');
    const { user: callee, cookie } = await createUser('acc2b@test.com');

    const call = await CallSession.create({
      type: '1:1', initiatorId: caller._id, status: 'ended',
      participants: [
        { userId: caller._id, joinedAt: new Date() },
        { userId: callee._id, joinedAt: null },
      ],
    });

    const res = await request(app)
      .post(`/calls/${call._id}/accept`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ended/);
  });

  it('returns 403 for a non-participant', async () => {
    const { user: a } = await createUser('acc3a@test.com');
    const { user: b } = await createUser('acc3b@test.com');
    const { cookie }  = await createUser('acc3c@test.com');

    const call = await CallSession.create({
      type: '1:1', initiatorId: a._id,
      participants: [
        { userId: a._id, joinedAt: new Date() },
        { userId: b._id, joinedAt: null },
      ],
    });

    const res = await request(app)
      .post(`/calls/${call._id}/accept`)
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
  });
});

// ── POST /calls/:id/decline ───────────────────────────────────────────────────

describe('POST /calls/:callId/decline', () => {
  it('transitions status to declined', async () => {
    const { user: caller }         = await createUser('dec1a@test.com');
    const { user: callee, cookie } = await createUser('dec1b@test.com');

    const call = await CallSession.create({
      type: '1:1', initiatorId: caller._id,
      participants: [
        { userId: caller._id, joinedAt: new Date() },
        { userId: callee._id, joinedAt: null },
      ],
    });

    const res = await request(app)
      .post(`/calls/${call._id}/decline`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const saved = await CallSession.findById(call._id);
    expect(saved.status).toBe('declined');
    expect(saved.endedAt).toBeTruthy();
  });

  it('returns 400 when call is not ringing', async () => {
    const { user: a }              = await createUser('dec2a@test.com');
    const { user: b, cookie }      = await createUser('dec2b@test.com');

    const call = await CallSession.create({
      type: '1:1', initiatorId: a._id, status: 'active',
      participants: [
        { userId: a._id, joinedAt: new Date() },
        { userId: b._id, joinedAt: new Date() },
      ],
    });

    const res = await request(app)
      .post(`/calls/${call._id}/decline`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
  });
});

// ── POST /calls/:id/end ───────────────────────────────────────────────────────

describe('POST /calls/:callId/end', () => {
  it('transitions to ended and computes duration', async () => {
    const { user: a, cookie } = await createUser('end1a@test.com');
    const { user: b }         = await createUser('end1b@test.com');

    const startedAt = new Date(Date.now() - 65000); // 65 seconds ago
    const call = await CallSession.create({
      type: '1:1', initiatorId: a._id, status: 'active',
      startedAt,
      participants: [
        { userId: a._id, joinedAt: startedAt },
        { userId: b._id, joinedAt: startedAt },
      ],
    });

    const res = await request(app)
      .post(`/calls/${call._id}/end`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.duration).toBeGreaterThanOrEqual(65);

    const saved = await CallSession.findById(call._id);
    expect(saved.status).toBe('ended');
    expect(saved.endedAt).toBeTruthy();
    expect(saved.duration).toBeGreaterThanOrEqual(65);
  });

  it('sets duration to 0 when call was never accepted (ringing → ended)', async () => {
    const { user: a, cookie } = await createUser('end2a@test.com');
    const { user: b }         = await createUser('end2b@test.com');

    const call = await CallSession.create({
      type: '1:1', initiatorId: a._id, status: 'ringing',
      participants: [
        { userId: a._id, joinedAt: new Date() },
        { userId: b._id, joinedAt: null },
      ],
    });

    const res = await request(app)
      .post(`/calls/${call._id}/end`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.duration).toBe(0);
  });

  it('returns 400 when call is already ended', async () => {
    const { user: a, cookie } = await createUser('end3a@test.com');
    const { user: b }         = await createUser('end3b@test.com');

    const call = await CallSession.create({
      type: '1:1', initiatorId: a._id, status: 'ended',
      participants: [
        { userId: a._id, joinedAt: new Date() },
        { userId: b._id, joinedAt: new Date() },
      ],
    });

    const res = await request(app)
      .post(`/calls/${call._id}/end`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ended/);
  });

  it('returns 403 for a non-participant', async () => {
    const { user: a } = await createUser('end4a@test.com');
    const { user: b } = await createUser('end4b@test.com');
    const { cookie }  = await createUser('end4c@test.com');

    const call = await CallSession.create({
      type: '1:1', initiatorId: a._id, status: 'active',
      startedAt: new Date(),
      participants: [
        { userId: a._id, joinedAt: new Date() },
        { userId: b._id, joinedAt: new Date() },
      ],
    });

    const res = await request(app)
      .post(`/calls/${call._id}/end`)
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
  });
});
