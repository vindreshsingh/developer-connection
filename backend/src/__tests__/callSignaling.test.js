/**
 * Tests for Phase 5 Task A2 — Call signaling socket handlers.
 *
 * Covers:
 *   call_offer      — relay to callee only; non-participant dropped
 *   call_answer     — relay to caller only; non-participant dropped
 *   ice_candidate   — bidirectional relay; non-participant dropped
 *   call_ended      — relay to both participants; persists DB; idempotent
 *   call_rejected   — relay to caller; persists DB; no-op if not ringing
 *   stale events    — dropped silently after call is already terminated
 */

import http from 'http';
import { io as ioClient } from 'socket.io-client';
import app from '../app.js';
import { initSockets } from '../sockets/index.js';
import User from '../models/user.js';
import CallSession from '../models/callSession.js';
import ConnectionRequest from '../models/connectionRequest.js';
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

const connect = async (a, b) => {
  await ConnectionRequest.create({ fromUserId: a._id, toUserId: b._id, status: 'accepted' });
};

const createCall = async (caller, callee, overrides = {}) =>
  CallSession.create({
    type:        '1:1',
    initiatorId: caller._id,
    participants: [
      { userId: caller._id, joinedAt: new Date() },
      { userId: callee._id, joinedAt: null },
    ],
    status: 'ringing',
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

// ── call_offer ────────────────────────────────────────────────────────────────

describe('call_offer', () => {
  it('relays the SDP offer to the callee only', async () => {
    const caller = await createUser(`co1a-${Date.now()}@test.com`);
    const callee = await createUser(`co1b-${Date.now()}@test.com`);
    await connect(caller, callee);
    const call = await createCall(caller, callee);

    const callerClient = await connectSocket(`token=${caller.getJWT()}`);
    const calleeClient = await connectSocket(`token=${callee.getJWT()}`);

    const calleeReceives = waitForEvent(calleeClient, 'call_offer');

    let callerReceivedOffer = false;
    callerClient.once('call_offer', () => { callerReceivedOffer = true; });

    callerClient.emit('call_offer', { callId: call._id.toString(), sdp: 'v=0\r\n...' });

    const payload = await calleeReceives;
    expect(payload.callId).toBe(call._id.toString());
    expect(payload.callerId).toBe(caller._id.toString());
    expect(payload.sdp).toBe('v=0\r\n...');

    await new Promise((r) => setTimeout(r, 200));
    expect(callerReceivedOffer).toBe(false);

    callerClient.disconnect();
    calleeClient.disconnect();
  }, 15000);

  it('emits call_error for a non-participant', async () => {
    const caller    = await createUser(`co2a-${Date.now()}@test.com`);
    const callee    = await createUser(`co2b-${Date.now()}@test.com`);
    const intruder  = await createUser(`co2c-${Date.now()}@test.com`);
    const call = await createCall(caller, callee);

    const intruderClient = await connectSocket(`token=${intruder.getJWT()}`);

    const errorPromise = waitForEvent(intruderClient, 'call_error');
    intruderClient.emit('call_offer', { callId: call._id.toString(), sdp: 'fake' });
    const err = await errorPromise;
    expect(err.message).toMatch(/not a participant/);

    intruderClient.disconnect();
  }, 12000);

  it('drops the event silently for an already-ended call', async () => {
    const caller = await createUser(`co3a-${Date.now()}@test.com`);
    const callee = await createUser(`co3b-${Date.now()}@test.com`);
    const call = await createCall(caller, callee, { status: 'ended' });

    const callerClient = await connectSocket(`token=${caller.getJWT()}`);
    const calleeClient = await connectSocket(`token=${callee.getJWT()}`);

    let calleeGotOffer = false;
    calleeClient.once('call_offer', () => { calleeGotOffer = true; });

    callerClient.emit('call_offer', { callId: call._id.toString(), sdp: 'v=0' });

    await new Promise((r) => setTimeout(r, 300));
    expect(calleeGotOffer).toBe(false);

    callerClient.disconnect();
    calleeClient.disconnect();
  }, 12000);
});

// ── call_answer ───────────────────────────────────────────────────────────────

describe('call_answer', () => {
  it('relays SDP answer to the caller only', async () => {
    const caller = await createUser(`ca1a-${Date.now()}@test.com`);
    const callee = await createUser(`ca1b-${Date.now()}@test.com`);
    await connect(caller, callee);
    const call = await createCall(caller, callee, { status: 'active', startedAt: new Date() });

    const callerClient = await connectSocket(`token=${caller.getJWT()}`);
    const calleeClient = await connectSocket(`token=${callee.getJWT()}`);

    const callerReceives = waitForEvent(callerClient, 'call_answer');

    let calleeReceivedAnswer = false;
    calleeClient.once('call_answer', () => { calleeReceivedAnswer = true; });

    calleeClient.emit('call_answer', { callId: call._id.toString(), sdp: 'v=0\r\nanswer' });

    const payload = await callerReceives;
    expect(payload.callId).toBe(call._id.toString());
    expect(payload.calleeId).toBe(callee._id.toString());
    expect(payload.sdp).toBe('v=0\r\nanswer');

    await new Promise((r) => setTimeout(r, 200));
    expect(calleeReceivedAnswer).toBe(false);

    callerClient.disconnect();
    calleeClient.disconnect();
  }, 15000);

  it('emits call_error when SDP is missing', async () => {
    const caller = await createUser(`ca2a-${Date.now()}@test.com`);
    const callee = await createUser(`ca2b-${Date.now()}@test.com`);
    const call = await createCall(caller, callee);

    const calleeClient = await connectSocket(`token=${callee.getJWT()}`);

    const errorPromise = waitForEvent(calleeClient, 'call_error');
    calleeClient.emit('call_answer', { callId: call._id.toString() });
    const err = await errorPromise;
    expect(err.message).toMatch(/SDP/);

    calleeClient.disconnect();
  }, 12000);
});

// ── ice_candidate ─────────────────────────────────────────────────────────────

describe('ice_candidate', () => {
  it('relays candidates bidirectionally', async () => {
    const caller = await createUser(`ic1a-${Date.now()}@test.com`);
    const callee = await createUser(`ic1b-${Date.now()}@test.com`);
    await connect(caller, callee);
    const call = await createCall(caller, callee, { status: 'active', startedAt: new Date() });

    const callerClient = await connectSocket(`token=${caller.getJWT()}`);
    const calleeClient = await connectSocket(`token=${callee.getJWT()}`);

    const fakeCandidate = { candidate: 'candidate:123 udp 1234 1.2.3.4 56789 typ srflx' };

    // Caller → callee
    const calleeReceives = waitForEvent(calleeClient, 'ice_candidate');
    callerClient.emit('ice_candidate', { callId: call._id.toString(), candidate: fakeCandidate });
    const p1 = await calleeReceives;
    expect(p1.senderId).toBe(caller._id.toString());
    expect(p1.candidate).toEqual(fakeCandidate);

    // Callee → caller
    const callerReceives = waitForEvent(callerClient, 'ice_candidate');
    calleeClient.emit('ice_candidate', { callId: call._id.toString(), candidate: fakeCandidate });
    const p2 = await callerReceives;
    expect(p2.senderId).toBe(callee._id.toString());

    callerClient.disconnect();
    calleeClient.disconnect();
  }, 15000);

  it('accepts null candidate (end-of-candidates signal)', async () => {
    const caller = await createUser(`ic2a-${Date.now()}@test.com`);
    const callee = await createUser(`ic2b-${Date.now()}@test.com`);
    const call = await createCall(caller, callee, { status: 'active', startedAt: new Date() });

    const callerClient = await connectSocket(`token=${caller.getJWT()}`);
    const calleeClient = await connectSocket(`token=${callee.getJWT()}`);

    const calleeReceives = waitForEvent(calleeClient, 'ice_candidate');
    callerClient.emit('ice_candidate', { callId: call._id.toString(), candidate: null });
    const payload = await calleeReceives;
    expect(payload.candidate).toBeNull();

    callerClient.disconnect();
    calleeClient.disconnect();
  }, 12000);
});

// ── call_ended ────────────────────────────────────────────────────────────────

describe('call_ended', () => {
  it('notifies both participants and persists the ended status', async () => {
    const caller = await createUser(`ce1a-${Date.now()}@test.com`);
    const callee = await createUser(`ce1b-${Date.now()}@test.com`);
    await connect(caller, callee);
    const startedAt = new Date(Date.now() - 30000); // 30s ago
    const call = await createCall(caller, callee, { status: 'active', startedAt });

    const callerClient = await connectSocket(`token=${caller.getJWT()}`);
    const calleeClient = await connectSocket(`token=${callee.getJWT()}`);

    const callerReceives = waitForEvent(callerClient, 'call_ended');
    const calleeReceives = waitForEvent(calleeClient, 'call_ended');

    callerClient.emit('call_ended', { callId: call._id.toString() });

    const [p1, p2] = await Promise.all([callerReceives, calleeReceives]);
    expect(p1.callId).toBe(call._id.toString());
    expect(p1.endedBy).toBe(caller._id.toString());
    expect(p1.duration).toBeGreaterThanOrEqual(30);
    expect(p2).toMatchObject(p1);

    // Persisted
    const saved = await CallSession.findById(call._id);
    expect(saved.status).toBe('ended');
    expect(saved.duration).toBeGreaterThanOrEqual(30);

    callerClient.disconnect();
    calleeClient.disconnect();
  }, 15000);

  it('is idempotent — second call_ended on an already-ended call is silently dropped', async () => {
    const caller = await createUser(`ce2a-${Date.now()}@test.com`);
    const callee = await createUser(`ce2b-${Date.now()}@test.com`);
    const call = await createCall(caller, callee, { status: 'ended', endedAt: new Date() });

    const callerClient = await connectSocket(`token=${caller.getJWT()}`);

    let gotEnded = false;
    callerClient.once('call_ended', () => { gotEnded = true; });
    callerClient.emit('call_ended', { callId: call._id.toString() });

    await new Promise((r) => setTimeout(r, 300));
    expect(gotEnded).toBe(false);

    callerClient.disconnect();
  }, 12000);

  it('emits call_error for invalid callId', async () => {
    const user = await createUser(`ce3-${Date.now()}@test.com`);
    const client = await connectSocket(`token=${user.getJWT()}`);

    const errorPromise = waitForEvent(client, 'call_error');
    client.emit('call_ended', { callId: 'not-an-id' });
    const err = await errorPromise;
    expect(err.message).toMatch(/Invalid call ID/);

    client.disconnect();
  }, 12000);
});

// ── call_rejected ─────────────────────────────────────────────────────────────

describe('call_rejected', () => {
  it('notifies the caller and persists declined status', async () => {
    const caller = await createUser(`cr1a-${Date.now()}@test.com`);
    const callee = await createUser(`cr1b-${Date.now()}@test.com`);
    await connect(caller, callee);
    const call = await createCall(caller, callee);

    const callerClient = await connectSocket(`token=${caller.getJWT()}`);
    const calleeClient = await connectSocket(`token=${callee.getJWT()}`);

    const callerReceives = waitForEvent(callerClient, 'call_rejected');
    calleeClient.emit('call_rejected', { callId: call._id.toString() });

    const payload = await callerReceives;
    expect(payload.callId).toBe(call._id.toString());
    expect(payload.rejectedBy).toBe(callee._id.toString());

    const saved = await CallSession.findById(call._id);
    expect(saved.status).toBe('declined');
    expect(saved.endedAt).toBeTruthy();

    callerClient.disconnect();
    calleeClient.disconnect();
  }, 15000);

  it('is a no-op when call is already active (not ringing)', async () => {
    const caller = await createUser(`cr2a-${Date.now()}@test.com`);
    const callee = await createUser(`cr2b-${Date.now()}@test.com`);
    const call = await createCall(caller, callee, { status: 'active', startedAt: new Date() });

    const callerClient = await connectSocket(`token=${caller.getJWT()}`);
    const calleeClient = await connectSocket(`token=${callee.getJWT()}`);

    let callerGotRejected = false;
    callerClient.once('call_rejected', () => { callerGotRejected = true; });
    calleeClient.emit('call_rejected', { callId: call._id.toString() });

    await new Promise((r) => setTimeout(r, 300));
    expect(callerGotRejected).toBe(false);

    // Status unchanged
    const saved = await CallSession.findById(call._id);
    expect(saved.status).toBe('active');

    callerClient.disconnect();
    calleeClient.disconnect();
  }, 12000);

  it('does not notify the callee — only the caller receives call_rejected', async () => {
    const caller = await createUser(`cr3a-${Date.now()}@test.com`);
    const callee = await createUser(`cr3b-${Date.now()}@test.com`);
    const call = await createCall(caller, callee);

    const callerClient = await connectSocket(`token=${caller.getJWT()}`);
    const calleeClient = await connectSocket(`token=${callee.getJWT()}`);

    const callerReceives = waitForEvent(callerClient, 'call_rejected');

    let calleeGotRejected = false;
    calleeClient.once('call_rejected', () => { calleeGotRejected = true; });

    calleeClient.emit('call_rejected', { callId: call._id.toString() });

    await callerReceives; // caller receives it

    await new Promise((r) => setTimeout(r, 200));
    expect(calleeGotRejected).toBe(false); // callee does NOT see their own rejection

    callerClient.disconnect();
    calleeClient.disconnect();
  }, 15000);
});
