import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import ConnectionRequest from '../models/connectionRequest.js';
import Conversation from '../models/conversation.js';
import Message from '../models/message.js';
import { hashPassword } from '../utils/sanitization.js';

const createUser = async (overrides = {}) => {
  const user = await new User({
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    email: overrides.email,
    password: await hashPassword('password123'),
    isEmailVerified: true,
  }).save();

  return { user, cookie: `token=${user.getJWT()}` };
};

const acceptConnection = async (userA, userB) => {
  await new ConnectionRequest({
    fromUserId: userA._id,
    toUserId: userB._id,
    status: 'accepted',
  }).save();
};

describe('Chat REST routes', () => {
  describe('POST /chat/conversations/:userId', () => {
    it('creates a conversation between accepted connections', async () => {
      const { user: userA, cookie: cookieA } = await createUser({ email: 'a@example.com' });
      const { user: userB } = await createUser({ email: 'b@example.com' });
      await acceptConnection(userA, userB);

      const res = await request(app)
        .post(`/chat/conversations/${userB._id}`)
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.data.participants.map((p) => p._id)).toEqual(
        expect.arrayContaining([userA._id.toString(), userB._id.toString()])
      );
    });

    it('returns the same conversation on a second call (get-or-create)', async () => {
      const { user: userA, cookie: cookieA } = await createUser({ email: 'a@example.com' });
      const { user: userB } = await createUser({ email: 'b@example.com' });
      await acceptConnection(userA, userB);

      const first = await request(app).post(`/chat/conversations/${userB._id}`).set('Cookie', cookieA);
      const second = await request(app).post(`/chat/conversations/${userB._id}`).set('Cookie', cookieA);

      expect(first.body.data._id).toBe(second.body.data._id);
      expect(await Conversation.countDocuments()).toBe(1);
    });

    it('rejects users who are not accepted connections', async () => {
      const { user: userA, cookie: cookieA } = await createUser({ email: 'a@example.com' });
      const { user: userB } = await createUser({ email: 'b@example.com' });

      const res = await request(app)
        .post(`/chat/conversations/${userB._id}`)
        .set('Cookie', cookieA);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/accepted connections/);
    });

    it('rejects a blocked pairing even if a prior accepted connection existed', async () => {
      const { user: userA, cookie: cookieA } = await createUser({ email: 'a@example.com' });
      const { user: userB } = await createUser({ email: 'b@example.com' });
      await acceptConnection(userA, userB);

      userB.blockedUsers.push(userA._id);
      await userB.save();

      const res = await request(app)
        .post(`/chat/conversations/${userB._id}`)
        .set('Cookie', cookieA);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/cannot message/i);
    });

    it('requires authentication', async () => {
      const { user: userB } = await createUser({ email: 'b@example.com' });
      const res = await request(app).post(`/chat/conversations/${userB._id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /chat/conversations', () => {
    it('lists the logged-in user’s conversations with the other participant', async () => {
      const { user: userA, cookie: cookieA } = await createUser({ email: 'a@example.com' });
      const { user: userB } = await createUser({ email: 'b@example.com', firstName: 'Bob' });
      await acceptConnection(userA, userB);

      await request(app).post(`/chat/conversations/${userB._id}`).set('Cookie', cookieA);

      const res = await request(app).get('/chat/conversations').set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].otherUser.firstName).toBe('Bob');
    });
  });

  describe('GET /chat/conversations/:conversationId/messages', () => {
    it('returns paginated message history oldest-first', async () => {
      const { user: userA, cookie: cookieA } = await createUser({ email: 'a@example.com' });
      const { user: userB } = await createUser({ email: 'b@example.com' });
      await acceptConnection(userA, userB);

      const createRes = await request(app)
        .post(`/chat/conversations/${userB._id}`)
        .set('Cookie', cookieA);
      const conversationId = createRes.body.data._id;

      await Message.create([
        { conversationId, senderId: userA._id, type: 'text', body: 'first' },
        { conversationId, senderId: userB._id, type: 'text', body: 'second' },
      ]);

      const res = await request(app)
        .get(`/chat/conversations/${conversationId}/messages`)
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.data.map((m) => m.body)).toEqual(['first', 'second']);
    });

    it('rejects access to a conversation the user is not part of', async () => {
      const { user: userA, cookie: cookieA } = await createUser({ email: 'a@example.com' });
      const { user: userB } = await createUser({ email: 'b@example.com' });
      const { user: userC, cookie: cookieC } = await createUser({ email: 'c@example.com' });
      await acceptConnection(userA, userB);

      const createRes = await request(app)
        .post(`/chat/conversations/${userB._id}`)
        .set('Cookie', cookieA);
      const conversationId = createRes.body.data._id;

      const res = await request(app)
        .get(`/chat/conversations/${conversationId}/messages`)
        .set('Cookie', cookieC);

      expect(res.status).toBe(404);
      void userC;
    });
  });

  describe('GET /chat/conversations — block filtering', () => {
    it('hides the conversation from the blocker\'s list after blocking', async () => {
      const { user: userA, cookie: cookieA } = await createUser({ email: 'a@example.com' });
      const { user: userB } = await createUser({ email: 'b@example.com' });
      await acceptConnection(userA, userB);

      // Create a conversation with a message so it shows up
      const createRes = await request(app)
        .post(`/chat/conversations/${userB._id}`)
        .set('Cookie', cookieA);
      const conversationId = createRes.body.data._id;
      await Message.create({ conversationId, senderId: userA._id, type: 'text', body: 'hello' });

      // Verify conversation is visible before block
      const beforeRes = await request(app).get('/chat/conversations').set('Cookie', cookieA);
      expect(beforeRes.body.count).toBe(1);

      // A blocks B
      userA.blockedUsers.push(userB._id);
      await userA.save();

      const afterRes = await request(app).get('/chat/conversations').set('Cookie', cookieA);
      expect(afterRes.body.count).toBe(0);

      // Message documents must still be in the database (hide-but-retain policy)
      const messageCount = await Message.countDocuments({ conversationId });
      expect(messageCount).toBe(1);
    });

    it('hides the conversation from the blockee\'s list too', async () => {
      const { user: userA } = await createUser({ email: 'a@example.com' });
      const { user: userB, cookie: cookieB } = await createUser({ email: 'b@example.com' });
      await acceptConnection(userA, userB);

      const createRes = await request(app)
        .post(`/chat/conversations/${userA._id}`)
        .set('Cookie', cookieB);
      const conversationId = createRes.body.data._id;
      await Message.create({ conversationId, senderId: userB._id, type: 'text', body: 'hi' });

      // Visible to B before block
      const beforeRes = await request(app).get('/chat/conversations').set('Cookie', cookieB);
      expect(beforeRes.body.count).toBe(1);

      // A blocks B
      userA.blockedUsers.push(userB._id);
      await userA.save();

      // B (the blockee) should also no longer see the conversation
      const afterRes = await request(app).get('/chat/conversations').set('Cookie', cookieB);
      expect(afterRes.body.count).toBe(0);

      // Message documents retained
      const messageCount = await Message.countDocuments({ conversationId });
      expect(messageCount).toBe(1);
    });

    it('restores the conversation in both lists after unblocking (when connection still valid)', async () => {
      const { user: userA, cookie: cookieA } = await createUser({ email: 'a@example.com' });
      const { user: userB, cookie: cookieB } = await createUser({ email: 'b@example.com' });
      await acceptConnection(userA, userB);

      const createRes = await request(app)
        .post(`/chat/conversations/${userB._id}`)
        .set('Cookie', cookieA);
      const conversationId = createRes.body.data._id;
      void conversationId;

      // A blocks B → both lists empty
      userA.blockedUsers.push(userB._id);
      await userA.save();

      expect((await request(app).get('/chat/conversations').set('Cookie', cookieA)).body.count).toBe(0);
      expect((await request(app).get('/chat/conversations').set('Cookie', cookieB)).body.count).toBe(0);

      // A unblocks B. Because this test bypasses the block REST route and writes
      // `blockedUsers` directly, the ConnectionRequest was NOT deleted, so the
      // conversation becomes visible again as soon as the block entry is removed.
      userA.blockedUsers = userA.blockedUsers.filter((id) => !id.equals(userB._id));
      await userA.save();

      const afterUnblockA = await request(app).get('/chat/conversations').set('Cookie', cookieA);
      const afterUnblockB = await request(app).get('/chat/conversations').set('Cookie', cookieB);
      expect(afterUnblockA.body.count).toBe(1);
      expect(afterUnblockB.body.count).toBe(1);
    });
  });

  describe('POST /chat/conversations/:conversationId/read', () => {
    it('records a per-conversation last-read timestamp for the logged-in user', async () => {
      const { user: userA, cookie: cookieA } = await createUser({ email: 'a@example.com' });
      const { user: userB } = await createUser({ email: 'b@example.com' });
      await acceptConnection(userA, userB);

      const createRes = await request(app)
        .post(`/chat/conversations/${userB._id}`)
        .set('Cookie', cookieA);
      const conversationId = createRes.body.data._id;

      const res = await request(app)
        .post(`/chat/conversations/${conversationId}/read`)
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);

      const conversation = await Conversation.findById(conversationId);
      expect(conversation.lastReadBy.get(userA._id.toString())).toBeInstanceOf(Date);
    });
  });
});
