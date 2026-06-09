import http from 'http';
import { io as ioClient } from 'socket.io-client';
import app from '../app.js';
import { initSockets } from '../sockets/index.js';
import User from '../models/user.js';
import ConnectionRequest from '../models/connectionRequest.js';
import Conversation from '../models/conversation.js';
import Message from '../models/message.js';
import { hashPassword } from '../utils/sanitization.js';

const sortedPair = (a, b) => [a.toString(), b.toString()].sort((x, y) => x.localeCompare(y));

let httpServer;
let io;
let presenceService;
let port;

const createUser = async (overrides = {}) => {
  const user = await new User({
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    email: overrides.email,
    password: await hashPassword('password123'),
    isEmailVerified: true,
  }).save();
  return user;
};

const acceptConnection = async (userA, userB) => {
  await new ConnectionRequest({ fromUserId: userA._id, toUserId: userB._id, status: 'accepted' }).save();
};

const connectClient = (cookie) =>
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
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    client.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

beforeAll((done) => {
  httpServer = http.createServer(app);
  ({ io, presenceService } = initSockets(httpServer));
  httpServer.listen(0, () => {
    port = httpServer.address().port;
    done();
  });
});

afterAll(async () => {
  // io.close() disconnects every client AND closes the underlying HTTP
  // server in one step — calling httpServer.close() alone can hang waiting
  // on lingering websocket (engine.io) connections from earlier tests.
  await new Promise((resolve) => io.close(resolve));
});

describe('Socket.IO authentication', () => {
  it('rejects connections without a valid token cookie', async () => {
    await expect(connectClient(undefined)).rejects.toThrow();
  });

  it('rejects connections with a malformed token cookie', async () => {
    await expect(connectClient('token=not-a-real-jwt')).rejects.toThrow();
  });

  it('accepts connections with a valid token cookie', async () => {
    const user = await createUser({ email: 'sock-a@example.com' });
    const client = await connectClient(`token=${user.getJWT()}`);
    expect(client.connected).toBe(true);
    client.disconnect();
  });
});

describe('PresenceService', () => {
  it('marks a user online on connect and offline on disconnect, broadcasting only to accepted connections', async () => {
    const userA = await createUser({ email: 'pres-a@example.com' });
    const userB = await createUser({ email: 'pres-b@example.com' });
    const userC = await createUser({ email: 'pres-c@example.com' }); // not connected to A
    await acceptConnection(userA, userB);

    const clientB = await connectClient(`token=${userB.getJWT()}`);
    const clientC = await connectClient(`token=${userC.getJWT()}`);

    const presenceForB = waitForEvent(clientB, 'presence_update');

    const clientA = await connectClient(`token=${userA.getJWT()}`);

    const payload = await presenceForB;
    expect(payload).toMatchObject({ userId: userA._id.toString(), status: 'online' });
    expect(presenceService.isOnline(userA._id.toString())).toBe(true);

    const offlineForB = waitForEvent(clientB, 'presence_update');
    clientA.disconnect();
    const offlinePayload = await offlineForB;
    expect(offlinePayload).toMatchObject({ userId: userA._id.toString(), status: 'offline' });

    clientB.disconnect();
    clientC.disconnect();
  });
});

const ack = (client, event, payload) =>
  new Promise((resolve) => client.emit(event, payload, resolve));

describe('Chat socket handlers', () => {
  it('lets accepted connections join a conversation and exchange messages in real time', async () => {
    const userA = await createUser({ email: 'chat-a@example.com' });
    const userB = await createUser({ email: 'chat-b@example.com' });
    await acceptConnection(userA, userB);

    const conversation = await Conversation.create({ participants: sortedPair(userA._id, userB._id) });

    const clientA = await connectClient(`token=${userA.getJWT()}`);
    const clientB = await connectClient(`token=${userB.getJWT()}`);

    const joinA = await ack(clientA, 'join_conversation', { conversationId: conversation._id.toString() });
    const joinB = await ack(clientB, 'join_conversation', { conversationId: conversation._id.toString() });
    expect(joinA).toEqual({ ok: true });
    expect(joinB).toEqual({ ok: true });

    const received = waitForEvent(clientB, 'message_received');
    const sendAck = await ack(clientA, 'send_message', {
      conversationId: conversation._id.toString(),
      type: 'text',
      body: 'hello there',
    });
    expect(sendAck.ok).toBe(true);

    const payload = await received;
    expect(payload).toMatchObject({ body: 'hello there', type: 'text', senderId: userA._id.toString() });

    const persisted = await Message.findOne({ conversationId: conversation._id });
    expect(persisted.body).toBe('hello there');

    const updatedConversation = await Conversation.findById(conversation._id);
    expect(updatedConversation.lastMessageAt).toBeInstanceOf(Date);

    clientA.disconnect();
    clientB.disconnect();
  });

  it('rejects join_conversation/send_message for users who are not accepted connections', async () => {
    const userA = await createUser({ email: 'noconn-a@example.com' });
    const userB = await createUser({ email: 'noconn-b@example.com' });

    // Conversation doc shouldn't normally exist without an accepted connection,
    // but exercise the socket-level re-check directly in case one is ever created.
    const conversation = await Conversation.create({ participants: sortedPair(userA._id, userB._id) });

    const clientA = await connectClient(`token=${userA.getJWT()}`);

    const errorEvent = waitForEvent(clientA, 'chat_error');
    clientA.emit('join_conversation', { conversationId: conversation._id.toString() });
    const error = await errorEvent;
    expect(error.message).toMatch(/accepted connections/);

    clientA.disconnect();
  }, 15000);

  it('marks a conversation as read and broadcasts conversation_read to the room', async () => {
    const userA = await createUser({ email: 'read-a@example.com' });
    const userB = await createUser({ email: 'read-b@example.com' });
    await acceptConnection(userA, userB);

    const conversation = await Conversation.create({ participants: sortedPair(userA._id, userB._id) });

    const clientA = await connectClient(`token=${userA.getJWT()}`);
    const clientB = await connectClient(`token=${userB.getJWT()}`);

    await ack(clientA, 'join_conversation', { conversationId: conversation._id.toString() });
    await ack(clientB, 'join_conversation', { conversationId: conversation._id.toString() });

    // B marks as read → A should receive conversation_read; B should NOT
    const aReceivesRead = waitForEvent(clientA, 'conversation_read');
    let bReceivedRead = false;
    clientB.once('conversation_read', () => { bReceivedRead = true; });

    clientB.emit('mark_read', { conversationId: conversation._id.toString() });

    const readPayload = await aReceivesRead;
    expect(readPayload).toMatchObject({
      conversationId: conversation._id.toString(),
      userId: userB._id.toString(),
    });
    expect(readPayload.readAt).toBeTruthy();

    await new Promise((r) => setTimeout(r, 200));
    expect(bReceivedRead).toBe(false);

    // DB should reflect the update
    const updated = await Conversation.findById(conversation._id);
    expect(updated.lastReadBy.get(userB._id.toString())).toBeInstanceOf(Date);

    clientA.disconnect();
    clientB.disconnect();
  }, 15000);

  it('adds, replaces, and toggles reactions, broadcasting reaction_update to the room', async () => {
    const userA = await createUser({ email: 'react-a@example.com' });
    const userB = await createUser({ email: 'react-b@example.com' });
    await acceptConnection(userA, userB);

    const conversation = await Conversation.create({ participants: sortedPair(userA._id, userB._id) });
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: userA._id,
      type: 'text',
      body: 'nice one',
    });

    const clientA = await connectClient(`token=${userA.getJWT()}`);
    const clientB = await connectClient(`token=${userB.getJWT()}`);

    await ack(clientA, 'join_conversation', { conversationId: conversation._id.toString() });
    await ack(clientB, 'join_conversation', { conversationId: conversation._id.toString() });

    // A reacts 👍 → both A and B should see reaction_update
    const aReceives1 = waitForEvent(clientA, 'reaction_update');
    const bReceives1 = waitForEvent(clientB, 'reaction_update');
    clientA.emit('react', { conversationId: conversation._id.toString(), messageId: message._id.toString(), emoji: '👍' });

    const [p1a, p1b] = await Promise.all([aReceives1, bReceives1]);
    expect(p1a).toMatchObject({ messageId: message._id.toString(), reactions: [{ userId: userA._id.toString(), emoji: '👍' }] });
    expect(p1b).toMatchObject(p1a);

    // A reacts same emoji 👍 again → toggle off (reactions should be empty)
    // Drain BOTH sides so no stale events are queued for subsequent assertions.
    const aReceives2 = waitForEvent(clientA, 'reaction_update');
    const bReceives2 = waitForEvent(clientB, 'reaction_update');
    clientA.emit('react', { conversationId: conversation._id.toString(), messageId: message._id.toString(), emoji: '👍' });
    const [p2a] = await Promise.all([aReceives2, bReceives2]);
    expect(p2a.reactions).toHaveLength(0);

    // A re-adds 👍, then B adds ❤️ → two reactions
    // Again drain both sides for A's re-add before B emits.
    const aReceives3 = waitForEvent(clientA, 'reaction_update');
    const bReceives3 = waitForEvent(clientB, 'reaction_update');
    clientA.emit('react', { conversationId: conversation._id.toString(), messageId: message._id.toString(), emoji: '👍' });
    await Promise.all([aReceives3, bReceives3]);

    const aReceives4 = waitForEvent(clientA, 'reaction_update');
    const bReceives4 = waitForEvent(clientB, 'reaction_update');
    clientB.emit('react', { conversationId: conversation._id.toString(), messageId: message._id.toString(), emoji: '❤️' });
    const [p4] = await Promise.all([aReceives4, bReceives4]);
    expect(p4.reactions).toHaveLength(2);

    clientA.disconnect();
    clientB.disconnect();
  }, 20000);

  it('broadcasts typing_update to the other participant only', async () => {
    const userA = await createUser({ email: 'typing-a@example.com' });
    const userB = await createUser({ email: 'typing-b@example.com' });
    await acceptConnection(userA, userB);

    const conversation = await Conversation.create({ participants: sortedPair(userA._id, userB._id) });

    const clientA = await connectClient(`token=${userA.getJWT()}`);
    const clientB = await connectClient(`token=${userB.getJWT()}`);

    await ack(clientA, 'join_conversation', { conversationId: conversation._id.toString() });
    await ack(clientB, 'join_conversation', { conversationId: conversation._id.toString() });

    // A starts typing → B should receive typing_update, A should NOT
    const bReceivesTyping = waitForEvent(clientB, 'typing_update');
    let aReceivedTyping = false;
    clientA.once('typing_update', () => { aReceivedTyping = true; });

    clientA.emit('typing', { conversationId: conversation._id.toString(), isTyping: true });

    const typingPayload = await bReceivesTyping;
    expect(typingPayload).toMatchObject({
      conversationId: conversation._id.toString(),
      userId: userA._id.toString(),
      isTyping: true,
    });

    // Give A's socket a tick to (incorrectly) receive the event — it shouldn't
    await new Promise((r) => setTimeout(r, 200));
    expect(aReceivedTyping).toBe(false);

    // A stops typing → B sees isTyping: false
    const bReceivesStop = waitForEvent(clientB, 'typing_update');
    clientA.emit('typing', { conversationId: conversation._id.toString(), isTyping: false });
    const stopPayload = await bReceivesStop;
    expect(stopPayload.isTyping).toBe(false);

    clientA.disconnect();
    clientB.disconnect();
  }, 15000);

  it('rejects send_message immediately after a block, even mid-session', async () => {
    const userA = await createUser({ email: 'block-a@example.com' });
    const userB = await createUser({ email: 'block-b@example.com' });
    await acceptConnection(userA, userB);

    const conversation = await Conversation.create({ participants: sortedPair(userA._id, userB._id) });

    const clientA = await connectClient(`token=${userA.getJWT()}`);
    const clientB = await connectClient(`token=${userB.getJWT()}`);

    await ack(clientA, 'join_conversation', { conversationId: conversation._id.toString() });
    await ack(clientB, 'join_conversation', { conversationId: conversation._id.toString() });

    // B blocks A mid-session (directly via the model — mirrors the REST block route's effect)
    const freshB = await User.findById(userB._id);
    freshB.blockedUsers.push(userA._id);
    await freshB.save();

    const errorEvent = waitForEvent(clientA, 'chat_error');
    clientA.emit('send_message', { conversationId: conversation._id.toString(), type: 'text', body: 'are you there?' });
    const error = await errorEvent;
    expect(error.message).toMatch(/cannot message/i);

    expect(await Message.countDocuments({ conversationId: conversation._id })).toBe(0);

    clientA.disconnect();
    clientB.disconnect();
  }, 15000);
});
