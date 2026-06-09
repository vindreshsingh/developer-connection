/**
 * Tests for Phase 5 Task B2 — Group call socket handlers.
 *
 * Covers:
 *   group_call_join  — adds participant, notifies existing members, confirms to joiner
 *   group_call_join  — idempotent (re-join doesn't duplicate participant)
 *   group_call_join  — non-member of group gets call_error
 *   group_call_join  — invalid / missing callId
 *   group_call_join  — already-ended call rejected
 *   group_call_leave — marks leftAt, notifies remaining participants
 *   group_call_leave — non-participant gets call_error
 *   group_call_leave — last participant leaving auto-ends session
 *   group_call_end   — any participant can end; broadcasts to group room
 *   group_call_end   — non-participant gets call_error
 *   group_call_end   — already-ended call rejected
 */

import http from 'http';
import { io as ioClient } from 'socket.io-client';
import app from '../app.js';
import { initSockets } from '../sockets/index.js';
import User from '../models/user.js';
import Group from '../models/group.js';
import CallSession from '../models/callSession.js';
import { hashPassword } from '../utils/sanitization.js';

// ── Server lifecycle ──────────────────────────────────────────────────────────

let httpServer;
let io;
let port;

beforeAll((done) => {
  httpServer = http.createServer(app);
  ({ io } = initSockets(httpServer));
  httpServer.listen(0, () => {
    port = httpServer.address().port;
    done();
  });
});

afterAll(async () => {
  await new Promise((resolve) => io.close(resolve));
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const createUser = async (email) => {
  const user = await new User({
    firstName: 'Test',
    email,
    password: await hashPassword('password123'),
    isEmailVerified: true,
  }).save();
  return user;
};

const createGroup = async (creatorId, extraMemberIds = []) =>
  Group.create({
    name:        `GC Group ${Date.now()}`,
    createdBy:   creatorId,
    members: [
      { userId: creatorId, role: 'admin', joinedAt: new Date() },
      ...extraMemberIds.map((uid) => ({ userId: uid, role: 'member', joinedAt: new Date() })),
    ],
    memberCount: 1 + extraMemberIds.length,
  });

const createGroupCall = async (initiatorId, groupId, overrides = {}) =>
  CallSession.create({
    type:         'group',
    initiatorId,
    groupId,
    status:       'active',
    startedAt:    new Date(),
    participants: [{ userId: initiatorId, joinedAt: new Date() }],
    ...overrides,
  });

const connectSocket = (cookie) =>
  new Promise((resolve, reject) => {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      extraHeaders: cookie ? { Cookie: cookie } : {},
      forceNew: true,
    });
    client.on('connect', () => resolve(client));
    client.on('connect_error', (err) => reject(err));
  });

const waitForEvent = (client, event, timeoutMs = 8000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs,
    );
    client.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const noEvent = (client, event, waitMs = 300) =>
  new Promise((resolve) => {
    let received = false;
    client.once(event, () => { received = true; });
    setTimeout(() => resolve(!received), waitMs);
  });

// ── group_call_join ───────────────────────────────────────────────────────────

describe('group_call_join', () => {
  it('adds the joiner to participants and notifies existing members', async () => {
    const initiator = await createUser(`gcj1a-${Date.now()}@test.com`);
    const joiner    = await createUser(`gcj1b-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id, [joiner._id]);
    const call  = await createGroupCall(initiator._id, group._id);

    const initiatorClient = await connectSocket(`token=${initiator.getJWT()}`);
    const joinerClient    = await connectSocket(`token=${joiner.getJWT()}`);

    const initiatorNotified = waitForEvent(initiatorClient, 'group_participant_joined');
    const joinerConfirmed   = waitForEvent(joinerClient, 'group_call_joined');

    joinerClient.emit('group_call_join', { callId: call._id.toString() });

    const [notification, confirmation] = await Promise.all([
      initiatorNotified,
      joinerConfirmed,
    ]);

    // Initiator is notified of the new participant
    expect(notification.callId).toBe(call._id.toString());
    expect(notification.userId).toBe(joiner._id.toString());

    // Joiner receives confirmation with participant list
    expect(confirmation.callId).toBe(call._id.toString());
    expect(Array.isArray(confirmation.participants)).toBe(true);
    expect(confirmation.participants.length).toBe(2);
    const userIds = confirmation.participants.map((p) => p.userId);
    expect(userIds).toContain(joiner._id.toString());
    expect(userIds).toContain(initiator._id.toString());

    // Persisted in DB
    const saved = await CallSession.findById(call._id);
    const savedIds = saved.participants.map((p) => p.userId.toString());
    expect(savedIds).toContain(joiner._id.toString());

    initiatorClient.disconnect();
    joinerClient.disconnect();
  }, 15000);

  it('is idempotent — a second group_call_join does not duplicate the participant', async () => {
    const initiator = await createUser(`gcj2a-${Date.now()}@test.com`);
    const joiner    = await createUser(`gcj2b-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id, [joiner._id]);
    const call  = await createGroupCall(initiator._id, group._id);

    const joinerClient = await connectSocket(`token=${joiner.getJWT()}`);

    // First join
    joinerClient.emit('group_call_join', { callId: call._id.toString() });
    await waitForEvent(joinerClient, 'group_call_joined');

    // Second join — should still confirm but not add duplicate
    joinerClient.emit('group_call_join', { callId: call._id.toString() });
    await waitForEvent(joinerClient, 'group_call_joined');

    const saved = await CallSession.findById(call._id);
    const joinerParticipants = saved.participants.filter((p) =>
      p.userId.equals(joiner._id),
    );
    expect(joinerParticipants.length).toBe(1);

    joinerClient.disconnect();
  }, 15000);

  it('emits call_error for a non-member of the group', async () => {
    const initiator = await createUser(`gcj3a-${Date.now()}@test.com`);
    const outsider  = await createUser(`gcj3b-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id); // outsider NOT in group
    const call  = await createGroupCall(initiator._id, group._id);

    const outsiderClient = await connectSocket(`token=${outsider.getJWT()}`);

    const errorReceived = waitForEvent(outsiderClient, 'call_error');
    outsiderClient.emit('group_call_join', { callId: call._id.toString() });
    const err = await errorReceived;
    expect(err.event).toBe('group_call_join');

    outsiderClient.disconnect();
  }, 12000);

  it('emits call_error for an invalid callId', async () => {
    const user   = await createUser(`gcj4-${Date.now()}@test.com`);
    const client = await connectSocket(`token=${user.getJWT()}`);

    const errorReceived = waitForEvent(client, 'call_error');
    client.emit('group_call_join', { callId: 'not-valid' });
    const err = await errorReceived;
    expect(err.message).toMatch(/Invalid call ID/);

    client.disconnect();
  }, 12000);

  it('emits call_error when the call is already ended', async () => {
    const initiator = await createUser(`gcj5a-${Date.now()}@test.com`);
    const joiner    = await createUser(`gcj5b-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id, [joiner._id]);
    const call  = await createGroupCall(initiator._id, group._id, {
      status:  'ended',
      endedAt: new Date(),
    });

    const joinerClient = await connectSocket(`token=${joiner.getJWT()}`);

    const errorReceived = waitForEvent(joinerClient, 'call_error');
    joinerClient.emit('group_call_join', { callId: call._id.toString() });
    const err = await errorReceived;
    expect(err.message).toMatch(/ended/);

    joinerClient.disconnect();
  }, 12000);
});

// ── group_call_leave ──────────────────────────────────────────────────────────

describe('group_call_leave', () => {
  it('marks leftAt and notifies remaining participants', async () => {
    const initiator = await createUser(`gcl1a-${Date.now()}@test.com`);
    const member    = await createUser(`gcl1b-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id, [member._id]);
    const call  = await createGroupCall(initiator._id, group._id);

    // Pre-add member to call
    call.participants.push({ userId: member._id, joinedAt: new Date() });
    await call.save();

    const initiatorClient = await connectSocket(`token=${initiator.getJWT()}`);
    const memberClient    = await connectSocket(`token=${member.getJWT()}`);

    const initiatorNotified = waitForEvent(initiatorClient, 'group_participant_left');

    memberClient.emit('group_call_leave', { callId: call._id.toString() });

    const payload = await initiatorNotified;
    expect(payload.callId).toBe(call._id.toString());
    expect(payload.userId).toBe(member._id.toString());

    // leftAt persisted
    const saved = await CallSession.findById(call._id);
    const memberPart = saved.participants.find((p) => p.userId.equals(member._id));
    expect(memberPart.leftAt).toBeTruthy();

    // Call is still active (initiator is still in)
    expect(saved.status).toBe('active');

    initiatorClient.disconnect();
    memberClient.disconnect();
  }, 15000);

  it('auto-ends the session when the last participant leaves', async () => {
    const initiator = await createUser(`gcl2-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id);
    const call  = await createGroupCall(initiator._id, group._id);

    const initiatorClient = await connectSocket(`token=${initiator.getJWT()}`);

    // initiator is the only participant; leaving should auto-end
    const endedEvent = waitForEvent(initiatorClient, 'group_call_ended');

    initiatorClient.emit('group_call_leave', { callId: call._id.toString() });

    const payload = await endedEvent;
    expect(payload.callId).toBe(call._id.toString());

    const saved = await CallSession.findById(call._id);
    expect(saved.status).toBe('ended');
    expect(saved.endedAt).toBeTruthy();

    initiatorClient.disconnect();
  }, 12000);

  it('emits call_error when the user is not a participant', async () => {
    const initiator = await createUser(`gcl3a-${Date.now()}@test.com`);
    const outsider  = await createUser(`gcl3b-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id, [outsider._id]);
    const call  = await createGroupCall(initiator._id, group._id);

    const outsiderClient = await connectSocket(`token=${outsider.getJWT()}`);

    const errorReceived = waitForEvent(outsiderClient, 'call_error');
    outsiderClient.emit('group_call_leave', { callId: call._id.toString() });
    const err = await errorReceived;
    expect(err.message).toMatch(/not a participant/);

    outsiderClient.disconnect();
  }, 12000);
});

// ── group_call_end ────────────────────────────────────────────────────────────

describe('group_call_end', () => {
  it('ends the session and broadcasts group_call_ended to all group members', async () => {
    const initiator = await createUser(`gce1a-${Date.now()}@test.com`);
    const member    = await createUser(`gce1b-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id, [member._id]);
    const call  = await createGroupCall(initiator._id, group._id, {
      startedAt: new Date(Date.now() - 60000), // started 60s ago
    });

    const initiatorClient = await connectSocket(`token=${initiator.getJWT()}`);
    const memberClient    = await connectSocket(`token=${member.getJWT()}`);

    // Both clients need to join the group:<groupId> socket room to receive the broadcast.
    // In production, groupChatHandlers does this on `join_group`; simulate here directly.
    initiatorClient.emit('join_group', { groupId: group._id.toString() });
    memberClient.emit('join_group',    { groupId: group._id.toString() });
    await new Promise((r) => setTimeout(r, 100)); // let join propagate

    const initiatorGetsEnded = waitForEvent(initiatorClient, 'group_call_ended');
    const memberGetsEnded    = waitForEvent(memberClient, 'group_call_ended');

    initiatorClient.emit('group_call_end', { callId: call._id.toString() });

    const [p1, p2] = await Promise.all([initiatorGetsEnded, memberGetsEnded]);
    expect(p1.callId).toBe(call._id.toString());
    expect(p1.endedBy).toBe(initiator._id.toString());
    expect(p1.duration).toBeGreaterThanOrEqual(60);
    expect(p2).toMatchObject(p1);

    // Persisted
    const saved = await CallSession.findById(call._id);
    expect(saved.status).toBe('ended');
    expect(saved.duration).toBeGreaterThanOrEqual(60);

    initiatorClient.disconnect();
    memberClient.disconnect();
  }, 15000);

  it('emits call_error when the user is not a participant', async () => {
    const initiator = await createUser(`gce2a-${Date.now()}@test.com`);
    const outsider  = await createUser(`gce2b-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id, [outsider._id]);
    const call  = await createGroupCall(initiator._id, group._id);

    const outsiderClient = await connectSocket(`token=${outsider.getJWT()}`);

    const errorReceived = waitForEvent(outsiderClient, 'call_error');
    outsiderClient.emit('group_call_end', { callId: call._id.toString() });
    const err = await errorReceived;
    expect(err.message).toMatch(/not a participant/);

    outsiderClient.disconnect();
  }, 12000);

  it('emits call_error when the call is already ended (not double-ending)', async () => {
    const initiator = await createUser(`gce3-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id);
    const call  = await createGroupCall(initiator._id, group._id, {
      status:  'ended',
      endedAt: new Date(),
    });

    const initiatorClient = await connectSocket(`token=${initiator.getJWT()}`);

    const errorReceived = waitForEvent(initiatorClient, 'call_error');
    initiatorClient.emit('group_call_end', { callId: call._id.toString() });
    const err = await errorReceived;
    expect(err.message).toMatch(/ended/);

    initiatorClient.disconnect();
  }, 12000);

  it('non-initiator member can also end the call', async () => {
    const initiator = await createUser(`gce4a-${Date.now()}@test.com`);
    const member    = await createUser(`gce4b-${Date.now()}@test.com`);
    const group = await createGroup(initiator._id, [member._id]);
    const call  = await createGroupCall(initiator._id, group._id);

    // Add member to participants
    call.participants.push({ userId: member._id, joinedAt: new Date() });
    await call.save();

    const memberClient = await connectSocket(`token=${member.getJWT()}`);
    memberClient.emit('join_group', { groupId: group._id.toString() });
    await new Promise((r) => setTimeout(r, 100));

    const endedEvent = waitForEvent(memberClient, 'group_call_ended');
    memberClient.emit('group_call_end', { callId: call._id.toString() });

    const payload = await endedEvent;
    expect(payload.endedBy).toBe(member._id.toString());

    const saved = await CallSession.findById(call._id);
    expect(saved.status).toBe('ended');

    memberClient.disconnect();
  }, 12000);
});
