/**
 * Tests for Phase 8 Task B1 — Notifications REST API.
 *
 * Covers:
 *   - GET   /notifications              (pagination, newest-first, actorId populated)
 *   - GET   /notifications/unread-count
 *   - PATCH /notifications/:id/read     (scoping — cross-user returns 404)
 *   - PATCH /notifications/read-all
 */

import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import Notification from '../models/notification.js';
import { hashPassword } from '../utils/sanitization.js';

const createUser = async (email = `user_${Date.now()}_${Math.random()}@test.com`) => {
  const user = await new User({
    firstName: 'Test', email,
    password: await hashPassword('pass1234'),
    isEmailVerified: true,
  }).save();
  return { user, cookie: `token=${user.getJWT()}` };
};

const createNotification = async (recipientId, actorId, overrides = {}) =>
  Notification.create({
    recipientId,
    actorId,
    type: overrides.type ?? 'post_like',
    postId: overrides.postId ?? null,
    read: overrides.read ?? false,
  });

// ── GET /notifications ──────────────────────────────────────────────────────

describe('GET /notifications', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/notifications');
    expect(res.status).toBe(401);
  });

  it('returns the user\'s notifications newest-first with actorId populated', async () => {
    const { user, cookie } = await createUser();
    const { user: actor } = await createUser();

    await createNotification(user._id, actor._id, { type: 'post_like' });
    await createNotification(user._id, actor._id, { type: 'post_comment' });

    const res = await request(app).get('/notifications').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].type).toBe('post_comment');
    expect(res.body.data[1].type).toBe('post_like');
    expect(res.body.data[0].actorId.firstName).toBe('Test');
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
    });
  });

  it('does not return another user\'s notifications', async () => {
    const { cookie } = await createUser();
    const { user: other } = await createUser();
    const { user: actor } = await createUser();

    await createNotification(other._id, actor._id);

    const res = await request(app).get('/notifications').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ── GET /notifications/unread-count ───────────────────────────────────────────

describe('GET /notifications/unread-count', () => {
  it('returns the count of unread notifications for the logged-in user', async () => {
    const { user, cookie } = await createUser();
    const { user: actor } = await createUser();

    await createNotification(user._id, actor._id, { read: false });
    await createNotification(user._id, actor._id, { read: false });
    await createNotification(user._id, actor._id, { read: true });

    const res = await request(app).get('/notifications/unread-count').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});

// ── PATCH /notifications/:notificationId/read ─────────────────────────────────

describe('PATCH /notifications/:notificationId/read', () => {
  it('marks a notification as read', async () => {
    const { user, cookie } = await createUser();
    const { user: actor } = await createUser();

    const notification = await createNotification(user._id, actor._id, { read: false });

    const res = await request(app)
      .patch(`/notifications/${notification._id}/read`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.notification.read).toBe(true);
  });

  it('returns 404 when marking another user\'s notification as read', async () => {
    const { cookie } = await createUser();
    const { user: other } = await createUser();
    const { user: actor } = await createUser();

    const notification = await createNotification(other._id, actor._id, { read: false });

    const res = await request(app)
      .patch(`/notifications/${notification._id}/read`)
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('returns 404 for an invalid notification ID', async () => {
    const { cookie } = await createUser();

    const res = await request(app)
      .patch('/notifications/not-a-valid-id/read')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});

// ── PATCH /notifications/read-all ─────────────────────────────────────────────

describe('PATCH /notifications/read-all', () => {
  it('marks all of the user\'s unread notifications as read', async () => {
    const { user, cookie } = await createUser();
    const { user: actor } = await createUser();
    const { user: other } = await createUser();

    await createNotification(user._id, actor._id, { read: false });
    await createNotification(user._id, actor._id, { read: false });
    const otherNotification = await createNotification(other._id, actor._id, { read: false });

    const res = await request(app).patch('/notifications/read-all').set('Cookie', cookie);
    expect(res.status).toBe(200);

    const unreadCount = await Notification.countDocuments({ recipientId: user._id, read: false });
    expect(unreadCount).toBe(0);

    const otherStillUnread = await Notification.findById(otherNotification._id);
    expect(otherStillUnread.read).toBe(false);
  });
});
