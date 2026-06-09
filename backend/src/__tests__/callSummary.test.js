/**
 * Tests for Phase 5 Task C2 — CallSummaryCard system messages.
 *
 * Covers:
 *   createCallSummaryMessage  — 1:1 and group variants, idempotency
 *   POST /calls/:callId/end   — summary created after call ends
 *   Model validation          — call_summary type accepted; body optional
 */

import request     from 'supertest';
import app         from '../app.js';
import User        from '../models/user.js';
import Group       from '../models/group.js';
import CallSession from '../models/callSession.js';
import Message     from '../models/message.js';
import GroupMessage from '../models/groupMessage.js';
import Conversation from '../models/conversation.js';
import ConnectionRequest from '../models/connectionRequest.js';
import { hashPassword } from '../utils/sanitization.js';
import { createCallSummaryMessage } from '../utils/callSummaryUtils.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

const createUser = async (email = `u_${Date.now()}_${Math.random()}@test.com`) => {
  const user = await new User({
    firstName: 'Test', lastName: 'User', email,
    password: await hashPassword('pass1234'),
    isEmailVerified: true,
  }).save();
  return { user, cookie: `token=${user.getJWT()}` };
};

const connect = async (a, b) => {
  await ConnectionRequest.create({ fromUserId: a._id, toUserId: b._id, status: 'accepted' });
};

const createGroup = async (creatorId) =>
  Group.create({
    name:        `SummaryGroup ${Date.now()}`,
    createdBy:   creatorId,
    members:     [{ userId: creatorId, role: 'admin', joinedAt: new Date() }],
    memberCount: 1,
  });

const createConversation = async (uid1, uid2) =>
  Conversation.create({ participants: [uid1, uid2] });

const create1on1Call = async (callerId, calleeId, overrides = {}) =>
  CallSession.create({
    type:         '1:1',
    initiatorId:  callerId,
    participants: [
      { userId: callerId, joinedAt: new Date() },
      { userId: calleeId, joinedAt: new Date() },
    ],
    status:    'ended',
    startedAt: new Date(Date.now() - 120000),
    endedAt:   new Date(),
    duration:  120,
    ...overrides,
  });

const createGroupCall = async (initiatorId, groupId, overrides = {}) =>
  CallSession.create({
    type:         'group',
    initiatorId,
    groupId,
    participants: [{ userId: initiatorId, joinedAt: new Date() }],
    status:    'ended',
    startedAt: new Date(Date.now() - 300000),
    endedAt:   new Date(),
    duration:  300,
    ...overrides,
  });

// ── Model: call_summary type validation ───────────────────────────────────────

describe('Message model — call_summary type', () => {
  it('accepts a call_summary message without a body', async () => {
    const { user } = await createUser('mv1@test.com');
    const conv = await createConversation(user._id, user._id); // self-conv for test

    const msg = await Message.create({
      conversationId: conv._id,
      senderId:       user._id,
      type:           'call_summary',
      callSummary: { callId: new (await import('mongoose')).default.Types.ObjectId(), duration: 60, status: 'ended', callType: '1:1' },
    });
    expect(msg.type).toBe('call_summary');
    expect(msg.body).toBeNull();
  });

  it('rejects an unknown type', async () => {
    const { user } = await createUser('mv2@test.com');
    const conv = await createConversation(user._id, user._id);
    await expect(
      Message.create({ conversationId: conv._id, senderId: user._id, type: 'video', body: 'x' }),
    ).rejects.toThrow();
  });
});

describe('GroupMessage model — call_summary type', () => {
  it('accepts a call_summary group message without a body', async () => {
    const { user } = await createUser('gv1@test.com');
    const group = await createGroup(user._id);

    const msg = await GroupMessage.create({
      groupId:  group._id,
      senderId: user._id,
      type:     'call_summary',
      callSummary: { callId: new (await import('mongoose')).default.Types.ObjectId(), duration: 300, status: 'ended', callType: 'group' },
    });
    expect(msg.type).toBe('call_summary');
  });
});

// ── createCallSummaryMessage — 1:1 ───────────────────────────────────────────

describe('createCallSummaryMessage — 1:1 call', () => {
  it('creates a Message record in the conversation', async () => {
    const { user: caller } = await createUser('cs1a@test.com');
    const { user: callee } = await createUser('cs1b@test.com');
    const conv = await createConversation(caller._id, callee._id);
    const call = await create1on1Call(caller._id, callee._id);

    await createCallSummaryMessage(null, call);

    const msg = await Message.findOne({ 'callSummary.callId': call._id });
    expect(msg).toBeTruthy();
    expect(msg.type).toBe('call_summary');
    expect(msg.conversationId.toString()).toBe(conv._id.toString());
    expect(msg.callSummary.duration).toBe(120);
    expect(msg.callSummary.callType).toBe('1:1');
  });

  it('is idempotent — calling twice creates only one message', async () => {
    const { user: caller } = await createUser('cs2a@test.com');
    const { user: callee } = await createUser('cs2b@test.com');
    await createConversation(caller._id, callee._id);
    const call = await create1on1Call(caller._id, callee._id);

    await createCallSummaryMessage(null, call);
    await createCallSummaryMessage(null, call);

    const count = await Message.countDocuments({ 'callSummary.callId': call._id });
    expect(count).toBe(1);
  });

  it('skips message creation if call status is not ended', async () => {
    const { user: caller } = await createUser('cs3a@test.com');
    const { user: callee } = await createUser('cs3b@test.com');
    await createConversation(caller._id, callee._id);
    const call = await create1on1Call(caller._id, callee._id, { status: 'declined', duration: 0 });

    await createCallSummaryMessage(null, call);

    const count = await Message.countDocuments({ 'callSummary.callId': call._id });
    expect(count).toBe(0);
  });

  it('skips gracefully when no conversation exists between participants', async () => {
    const { user: caller } = await createUser('cs4a@test.com');
    const { user: callee } = await createUser('cs4b@test.com');
    // No conversation created
    const call = await create1on1Call(caller._id, callee._id);

    await expect(createCallSummaryMessage(null, call)).resolves.toBeUndefined();
    const count = await Message.countDocuments({ 'callSummary.callId': call._id });
    expect(count).toBe(0);
  });
});

// ── createCallSummaryMessage — group call ─────────────────────────────────────

describe('createCallSummaryMessage — group call', () => {
  it('creates a GroupMessage record', async () => {
    const { user } = await createUser('gcsum1@test.com');
    const group = await createGroup(user._id);
    const call  = await createGroupCall(user._id, group._id);

    await createCallSummaryMessage(null, call);

    const msg = await GroupMessage.findOne({ 'callSummary.callId': call._id });
    expect(msg).toBeTruthy();
    expect(msg.type).toBe('call_summary');
    expect(msg.groupId.toString()).toBe(group._id.toString());
    expect(msg.callSummary.duration).toBe(300);
    expect(msg.callSummary.callType).toBe('group');
  });

  it('is idempotent for group calls', async () => {
    const { user } = await createUser('gcsum2@test.com');
    const group = await createGroup(user._id);
    const call  = await createGroupCall(user._id, group._id);

    await createCallSummaryMessage(null, call);
    await createCallSummaryMessage(null, call);

    const count = await GroupMessage.countDocuments({ 'callSummary.callId': call._id });
    expect(count).toBe(1);
  });
});

// ── REST POST /calls/:callId/end — summary integration ────────────────────────

describe('POST /calls/:callId/end — creates call summary', () => {
  it('creates a 1:1 call summary message after ending via REST', async () => {
    const { user: caller, cookie } = await createUser('rest1a@test.com');
    const { user: callee }         = await createUser('rest1b@test.com');
    await connect(caller, callee);
    const conv = await createConversation(caller._id, callee._id);

    const call = await CallSession.create({
      type:         '1:1',
      initiatorId:  caller._id,
      participants: [
        { userId: caller._id, joinedAt: new Date() },
        { userId: callee._id, joinedAt: new Date() },
      ],
      status:    'active',
      startedAt: new Date(Date.now() - 30000),
    });

    await request(app)
      .post(`/calls/${call._id}/end`)
      .set('Cookie', cookie)
      .expect(200);

    // Allow async createCallSummaryMessage to complete
    await new Promise((r) => setTimeout(r, 200));

    const msg = await Message.findOne({ 'callSummary.callId': call._id });
    expect(msg).toBeTruthy();
    expect(msg.conversationId.toString()).toBe(conv._id.toString());
    expect(msg.callSummary.duration).toBeGreaterThanOrEqual(30);
  });
});
