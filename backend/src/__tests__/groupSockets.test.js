/**
 * Tests for Phase 4 Task B2 — Group socket handlers.
 *
 * Mirrors the structure and helpers of chatSockets.test.js.
 *
 * Covers:
 *   join_group            — member joins; non-member gets group_error
 *   send_group_message    — persists message, fans out to room; non-member rejected;
 *                           empty body / invalid type rejected
 *   group_typing          — fans out to others only, not sender; non-member rejected
 *   leave_group           — socket leaves room; subsequent messages not received
 *   mid-session removal   — removed member is rejected on next event
 */

import http from 'http';
import { io as ioClient } from 'socket.io-client';
import app from '../app.js';
import { initSockets } from '../sockets/index.js';
import User from '../models/user.js';
import Group from '../models/group.js';
import GroupMessage from '../models/groupMessage.js';
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

const createGroup = async (creatorId, extraMembers = []) => {
  const members = [
    { userId: creatorId, role: 'admin', joinedAt: new Date() },
    ...extraMembers.map((id) => ({ userId: id, role: 'member', joinedAt: new Date() })),
  ];
  return Group.create({
    name: `Test Group ${Date.now()}`,
    description: '',
    tags: [],
    createdBy: creatorId,
    members,
    memberCount: members.length,
  });
};

const connectClient = (cookie) =>
  new Promise((resolve, reject) => {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      extraHeaders: cookie ? { Cookie: cookie } : {},
      forceNew: true,
    });
    client.on('connect',       () => resolve(client));
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

const ack = (client, event, payload) =>
  new Promise((resolve) => client.emit(event, payload, resolve));

// ── join_group ────────────────────────────────────────────────────────────────

describe('join_group', () => {
  it('member successfully joins the group room (ack ok: true)', async () => {
    const admin = await createUser(`jg-admin-${Date.now()}@test.com`);
    const group = await createGroup(admin._id);
    const client = await connectClient(`token=${admin.getJWT()}`);

    const result = await ack(client, 'join_group', { groupId: group._id.toString() });
    expect(result).toEqual({ ok: true });

    client.disconnect();
  });

  it('non-member receives group_error on join_group', async () => {
    const admin = await createUser(`jg-adm-${Date.now()}@test.com`);
    const nonMember = await createUser(`jg-nm-${Date.now()}@test.com`);
    const group = await createGroup(admin._id);

    const client = await connectClient(`token=${nonMember.getJWT()}`);

    const errorPromise = waitForEvent(client, 'group_error');
    client.emit('join_group', { groupId: group._id.toString() });
    const error = await errorPromise;

    expect(error.event).toBe('group_access');
    expect(error.message).toMatch(/not a member/);

    client.disconnect();
  }, 12000);

  it('emits group_error for an invalid groupId', async () => {
    const user = await createUser(`jg-bad-${Date.now()}@test.com`);
    const client = await connectClient(`token=${user.getJWT()}`);

    const errorPromise = waitForEvent(client, 'group_error');
    client.emit('join_group', { groupId: 'not-an-objectid' });
    const error = await errorPromise;

    expect(error.message).toMatch(/Invalid group id/);

    client.disconnect();
  }, 12000);
});

// ── send_group_message ────────────────────────────────────────────────────────

describe('send_group_message', () => {
  it('persists message and broadcasts group_message_received to all room members', async () => {
    const admin  = await createUser(`sgm-adm-${Date.now()}@test.com`);
    const member = await createUser(`sgm-mem-${Date.now()}@test.com`);
    const group  = await createGroup(admin._id, [member._id]);

    const clientAdmin  = await connectClient(`token=${admin.getJWT()}`);
    const clientMember = await connectClient(`token=${member.getJWT()}`);

    await ack(clientAdmin,  'join_group', { groupId: group._id.toString() });
    await ack(clientMember, 'join_group', { groupId: group._id.toString() });

    // Member receives the message that admin sends
    const receivedByMember = waitForEvent(clientMember, 'group_message_received');
    const receivedByAdmin  = waitForEvent(clientAdmin,  'group_message_received');

    const sendResult = await ack(clientAdmin, 'send_group_message', {
      groupId: group._id.toString(),
      type: 'text',
      body: 'Hello group!',
    });
    expect(sendResult.ok).toBe(true);

    const [payloadMember, payloadAdmin] = await Promise.all([receivedByMember, receivedByAdmin]);

    expect(payloadMember).toMatchObject({
      groupId:  group._id.toString(),
      senderId: admin._id.toString(),
      type:     'text',
      body:     'Hello group!',
    });
    expect(payloadAdmin).toMatchObject(payloadMember);

    // Persisted in DB
    const dbMsg = await GroupMessage.findOne({ groupId: group._id });
    expect(dbMsg).not.toBeNull();
    expect(dbMsg.body).toBe('Hello group!');

    clientAdmin.disconnect();
    clientMember.disconnect();
  }, 15000);

  it('rejects send_group_message for a non-member', async () => {
    const admin     = await createUser(`sgm-adm2-${Date.now()}@test.com`);
    const nonMember = await createUser(`sgm-nm-${Date.now()}@test.com`);
    const group     = await createGroup(admin._id);

    const client = await connectClient(`token=${nonMember.getJWT()}`);

    const errorPromise = waitForEvent(client, 'group_error');
    client.emit('send_group_message', { groupId: group._id.toString(), body: 'sneak' });
    const error = await errorPromise;

    expect(error.message).toMatch(/not a member/);

    // Nothing persisted
    expect(await GroupMessage.countDocuments({ groupId: group._id })).toBe(0);

    client.disconnect();
  }, 12000);

  it('rejects empty body', async () => {
    const admin = await createUser(`sgm-eb-${Date.now()}@test.com`);
    const group = await createGroup(admin._id);
    const client = await connectClient(`token=${admin.getJWT()}`);

    await ack(client, 'join_group', { groupId: group._id.toString() });

    const errorPromise = waitForEvent(client, 'group_error');
    client.emit('send_group_message', { groupId: group._id.toString(), body: '   ' });
    const error = await errorPromise;

    expect(error.message).toMatch(/body is required/);

    client.disconnect();
  }, 12000);

  it('rejects invalid message type', async () => {
    const admin = await createUser(`sgm-it-${Date.now()}@test.com`);
    const group = await createGroup(admin._id);
    const client = await connectClient(`token=${admin.getJWT()}`);

    await ack(client, 'join_group', { groupId: group._id.toString() });

    const errorPromise = waitForEvent(client, 'group_error');
    client.emit('send_group_message', { groupId: group._id.toString(), type: 'image', body: 'hi' });
    const error = await errorPromise;

    expect(error.message).toMatch(/Invalid message type/);

    client.disconnect();
  }, 12000);

  it('supports snippet type with language field', async () => {
    const admin = await createUser(`sgm-sn-${Date.now()}@test.com`);
    const group = await createGroup(admin._id);
    const client = await connectClient(`token=${admin.getJWT()}`);

    await ack(client, 'join_group', { groupId: group._id.toString() });

    const received = waitForEvent(client, 'group_message_received');
    await ack(client, 'send_group_message', {
      groupId:  group._id.toString(),
      type:     'snippet',
      body:     'console.log("hi")',
      language: 'javascript',
    });

    const payload = await received;
    expect(payload.type).toBe('snippet');
    expect(payload.language).toBe('javascript');

    client.disconnect();
  }, 12000);
});

// ── group_typing ──────────────────────────────────────────────────────────────

describe('group_typing', () => {
  it('fans group_typing_update out to others but NOT to the sender', async () => {
    const admin  = await createUser(`gt-adm-${Date.now()}@test.com`);
    const member = await createUser(`gt-mem-${Date.now()}@test.com`);
    const group  = await createGroup(admin._id, [member._id]);

    const clientAdmin  = await connectClient(`token=${admin.getJWT()}`);
    const clientMember = await connectClient(`token=${member.getJWT()}`);

    await ack(clientAdmin,  'join_group', { groupId: group._id.toString() });
    await ack(clientMember, 'join_group', { groupId: group._id.toString() });

    // Admin types → member should see it; admin should NOT
    const memberReceives = waitForEvent(clientMember, 'group_typing_update');
    let adminReceivedTyping = false;
    clientAdmin.once('group_typing_update', () => { adminReceivedTyping = true; });

    clientAdmin.emit('group_typing', { groupId: group._id.toString(), isTyping: true });

    const payload = await memberReceives;
    expect(payload).toMatchObject({
      groupId:  group._id.toString(),
      userId:   admin._id.toString(),
      isTyping: true,
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(adminReceivedTyping).toBe(false);

    // Admin stops typing → member sees isTyping: false
    const memberReceivesStop = waitForEvent(clientMember, 'group_typing_update');
    clientAdmin.emit('group_typing', { groupId: group._id.toString(), isTyping: false });
    const stop = await memberReceivesStop;
    expect(stop.isTyping).toBe(false);

    clientAdmin.disconnect();
    clientMember.disconnect();
  }, 15000);

  it('non-member receives group_error on group_typing', async () => {
    const admin     = await createUser(`gt-nm-adm-${Date.now()}@test.com`);
    const nonMember = await createUser(`gt-nm-${Date.now()}@test.com`);
    const group     = await createGroup(admin._id);

    const client = await connectClient(`token=${nonMember.getJWT()}`);

    const errorPromise = waitForEvent(client, 'group_error');
    client.emit('group_typing', { groupId: group._id.toString(), isTyping: true });
    const error = await errorPromise;

    expect(error.message).toMatch(/not a member/);

    client.disconnect();
  }, 12000);
});

// ── leave_group ───────────────────────────────────────────────────────────────

describe('leave_group', () => {
  it('after leave_group the socket no longer receives group messages', async () => {
    const admin  = await createUser(`lg-adm-${Date.now()}@test.com`);
    const member = await createUser(`lg-mem-${Date.now()}@test.com`);
    const group  = await createGroup(admin._id, [member._id]);

    const clientAdmin  = await connectClient(`token=${admin.getJWT()}`);
    const clientMember = await connectClient(`token=${member.getJWT()}`);

    await ack(clientAdmin,  'join_group', { groupId: group._id.toString() });
    await ack(clientMember, 'join_group', { groupId: group._id.toString() });

    // Member leaves the socket room
    const leaveResult = await ack(clientMember, 'leave_group', { groupId: group._id.toString() });
    expect(leaveResult).toEqual({ ok: true });

    // Admin sends a message — member's socket should NOT receive it
    let memberGotMessage = false;
    clientMember.once('group_message_received', () => { memberGotMessage = true; });

    // Admin still receives (still in room)
    const adminReceives = waitForEvent(clientAdmin, 'group_message_received');
    clientAdmin.emit('send_group_message', { groupId: group._id.toString(), body: 'are you there?' });
    await adminReceives;

    await new Promise((r) => setTimeout(r, 300));
    expect(memberGotMessage).toBe(false);

    clientAdmin.disconnect();
    clientMember.disconnect();
  }, 15000);

  it('leave_group emits group_error for invalid groupId', async () => {
    const user = await createUser(`lg-bad-${Date.now()}@test.com`);
    const client = await connectClient(`token=${user.getJWT()}`);

    const errorPromise = waitForEvent(client, 'group_error');
    client.emit('leave_group', { groupId: 'bad-id' });
    const error = await errorPromise;

    expect(error.message).toMatch(/Invalid group id/);

    client.disconnect();
  }, 12000);
});

// ── mid-session membership removal ───────────────────────────────────────────

describe('mid-session membership removal', () => {
  it('removed member is rejected on the next send_group_message, even mid-session', async () => {
    const admin  = await createUser(`msr-adm-${Date.now()}@test.com`);
    const member = await createUser(`msr-mem-${Date.now()}@test.com`);
    const group  = await createGroup(admin._id, [member._id]);

    const clientMember = await connectClient(`token=${member.getJWT()}`);
    await ack(clientMember, 'join_group', { groupId: group._id.toString() });

    // Remove member via DB (mirrors REST DELETE /groups/:id/members/:userId)
    const freshGroup = await Group.findById(group._id);
    freshGroup.members = freshGroup.members.filter((m) => !m.userId.equals(member._id));
    freshGroup.memberCount = Math.max(1, freshGroup.memberCount - 1);
    await freshGroup.save();

    // Removed member tries to send a message
    const errorPromise = waitForEvent(clientMember, 'group_error');
    clientMember.emit('send_group_message', { groupId: group._id.toString(), body: 'still here?' });
    const error = await errorPromise;

    expect(error.message).toMatch(/not a member/);

    // Nothing persisted
    expect(await GroupMessage.countDocuments({ groupId: group._id })).toBe(0);

    clientMember.disconnect();
  }, 15000);
});
