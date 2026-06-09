/**
 * Tests for Phase 5 Task B1 — LiveKit token service + POST /calls/group-token.
 *
 * LiveKit's AccessToken.toJwt() is pure JWT (no network calls), so we exercise
 * the real SDK rather than mocking it — the returned value is a valid JWT
 * string signed with the test secret.
 *
 * Covers:
 *   LiveKitService.generateRoomToken  — token generation + env-var guard
 *   POST /calls/group-token           — happy path, auth, validation, status guard
 */

import request     from 'supertest';
import app         from '../app.js';
import User        from '../models/user.js';
import Group       from '../models/group.js';
import CallSession from '../models/callSession.js';
import { hashPassword } from '../utils/sanitization.js';
import { generateRoomToken } from '../services/LiveKitService.js';

// ── Env-var helpers ───────────────────────────────────────────────────────────

const TEST_KEY    = 'devtestkey';
const TEST_SECRET = 'devtestsecret00000000000000000000'; // 32+ chars

const setLiveKitEnv = () => {
  process.env.LIVEKIT_API_KEY    = TEST_KEY;
  process.env.LIVEKIT_API_SECRET = TEST_SECRET;
};
const clearLiveKitEnv = () => {
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;
};

// ── Test helpers ──────────────────────────────────────────────────────────────

const createUser = async (email = `u_${Date.now()}_${Math.random()}@test.com`) => {
  const user = await new User({
    firstName: 'Alice', lastName: 'Test', email,
    password: await hashPassword('pass1234'),
    isEmailVerified: true,
  }).save();
  return { user, cookie: `token=${user.getJWT()}` };
};

const createGroup = async (creatorId) =>
  Group.create({
    name:        `LK Group ${Date.now()}`,
    createdBy:   creatorId,
    members:     [{ userId: creatorId, role: 'admin', joinedAt: new Date() }],
    memberCount: 1,
  });

const createActiveGroupCall = async (initiatorId, groupId) =>
  CallSession.create({
    type:         'group',
    initiatorId,
    groupId,
    status:       'active',
    startedAt:    new Date(),
    participants: [{ userId: initiatorId, joinedAt: new Date() }],
  });

const isJwt = (str) => typeof str === 'string' && str.split('.').length === 3;

// ── LiveKitService unit tests ─────────────────────────────────────────────────

describe('LiveKitService.generateRoomToken', () => {
  beforeEach(setLiveKitEnv);
  afterEach(clearLiveKitEnv);

  it('returns a JWT string', async () => {
    const token = await generateRoomToken({ callId: 'abc123', userId: 'user456' });
    expect(isJwt(token)).toBe(true);
  });

  it('encodes the room name "call:<callId>" in the token payload', async () => {
    const token = await generateRoomToken({ callId: 'myroom', userId: 'u1' });
    // JWT payload is base64url-encoded second segment
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.video?.room).toBe('call:myroom');
  });

  it('encodes roomJoin + canPublish + canSubscribe grants', async () => {
    const token = await generateRoomToken({ callId: 'c1', userId: 'u1' });
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.video?.roomJoin).toBe(true);
    expect(payload.video?.canPublish).toBe(true);
    expect(payload.video?.canSubscribe).toBe(true);
  });

  it('sets identity to the provided userId', async () => {
    const token = await generateRoomToken({ callId: 'c2', userId: 'specificUser99' });
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.sub).toBe('specificUser99');
  });

  it('throws when LIVEKIT_API_KEY is missing', async () => {
    delete process.env.LIVEKIT_API_KEY;
    await expect(generateRoomToken({ callId: 'c3', userId: 'u3' }))
      .rejects.toThrow(/LIVEKIT_API_KEY/);
  });

  it('throws when LIVEKIT_API_SECRET is missing', async () => {
    delete process.env.LIVEKIT_API_SECRET;
    await expect(generateRoomToken({ callId: 'c4', userId: 'u4' }))
      .rejects.toThrow(/LIVEKIT_API_KEY/);
  });

  it('uses a TTL of 1 hour (exp − nbf = 3600 s)', async () => {
    const token   = await generateRoomToken({ callId: 'c5', userId: 'u5' });
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    // LiveKit uses nbf (not-before) rather than iat; exp − nbf should equal 3600 s
    expect(payload.exp).toBeDefined();
    expect(payload.nbf).toBeDefined();
    const ttl = payload.exp - payload.nbf;
    expect(ttl).toBeGreaterThanOrEqual(3595);
    expect(ttl).toBeLessThanOrEqual(3605);
  });
});

// ── POST /calls/group-token integration tests ─────────────────────────────────

describe('POST /calls/group-token', () => {
  beforeEach(setLiveKitEnv);
  afterEach(clearLiveKitEnv);

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/calls/group-token')
      .send({ callId: '000000000000000000000001' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when callId is missing', async () => {
    const { cookie } = await createUser('gt-missing@test.com');
    const res = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/callId/i);
  });

  it('returns 400 when callId is not a valid ObjectId', async () => {
    const { cookie } = await createUser('gt-badid@test.com');
    const res = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({ callId: 'not-an-object-id' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when call does not exist', async () => {
    const { cookie } = await createUser('gt-404@test.com');
    const res = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({ callId: '000000000000000000000099' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when call is a 1:1 call', async () => {
    const { user, cookie } = await createUser('gt-1to1@test.com');
    const { user: callee }  = await createUser('gt-callee@test.com');

    const call = await CallSession.create({
      type:         '1:1',
      initiatorId:  user._id,
      participants: [
        { userId: user._id,   joinedAt: new Date() },
        { userId: callee._id, joinedAt: null },
      ],
      status: 'ringing',
    });

    const res = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({ callId: call._id.toString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/group call/i);
  });

  it('returns 403 when user is not a participant', async () => {
    const { user: admin }     = await createUser('gt-admin@test.com');
    const { cookie: outsider } = await createUser('gt-outsider@test.com');

    const group = await createGroup(admin._id);
    const call  = await createActiveGroupCall(admin._id, group._id);

    const res = await request(app)
      .post('/calls/group-token')
      .set('Cookie', outsider)
      .send({ callId: call._id.toString() });
    expect(res.status).toBe(403);
  });

  it('returns 400 when call is already ended', async () => {
    const { user, cookie } = await createUser('gt-ended@test.com');
    const group = await createGroup(user._id);
    const call  = await CallSession.create({
      type:         'group',
      initiatorId:  user._id,
      groupId:      group._id,
      status:       'ended',
      endedAt:      new Date(),
      participants: [{ userId: user._id, joinedAt: new Date() }],
    });

    const res = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({ callId: call._id.toString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ended/);
  });

  it('returns 200 with a JWT token and correct room name for an active group call', async () => {
    const { user, cookie } = await createUser('gt-ok@test.com');
    const group = await createGroup(user._id);
    const call  = await createActiveGroupCall(user._id, group._id);

    const res = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({ callId: call._id.toString() });

    expect(res.status).toBe(200);
    expect(isJwt(res.body.token)).toBe(true);
    expect(res.body.room).toBe(`call:${call._id}`);
  });

  it('returns 200 for a ringing group call', async () => {
    const { user, cookie } = await createUser('gt-ringing@test.com');
    const group = await createGroup(user._id);
    const call  = await CallSession.create({
      type:         'group',
      initiatorId:  user._id,
      groupId:      group._id,
      status:       'ringing',
      participants: [{ userId: user._id, joinedAt: new Date() }],
    });

    const res = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({ callId: call._id.toString() });

    expect(res.status).toBe(200);
    expect(isJwt(res.body.token)).toBe(true);
  });

  it('token payload encodes the correct room and userId identity', async () => {
    const { user, cookie } = await createUser('gt-payload@test.com');
    const group = await createGroup(user._id);
    const call  = await createActiveGroupCall(user._id, group._id);

    const res = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({ callId: call._id.toString() });

    expect(res.status).toBe(200);
    const payload = JSON.parse(
      Buffer.from(res.body.token.split('.')[1], 'base64url').toString(),
    );
    expect(payload.sub).toBe(user._id.toString());
    expect(payload.video?.room).toBe(`call:${call._id}`);
  });

  it('returns 503 when LiveKit env vars are not set', async () => {
    clearLiveKitEnv();
    const { user, cookie } = await createUser('gt-noenv@test.com');
    const group = await createGroup(user._id);
    const call  = await createActiveGroupCall(user._id, group._id);

    const res = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({ callId: call._id.toString() });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });
});
