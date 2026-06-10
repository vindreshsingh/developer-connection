import express from 'express';
import request from 'supertest';
import User from '../models/user.js';
import ConnectionRequest from '../models/connectionRequest.js';
import Subscription from '../models/subscription.js';
import { hashPassword } from '../utils/sanitization.js';
import { createConnectionRequestLimiter } from '../middlewares/planLimits.js';
import { getSubscriptionPlan } from '../services/subscriptionService.js';

const createUser = async (overrides = {}) =>
  new User({
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    email: overrides.email,
    password: await hashPassword('password123'),
    isEmailVerified: true,
  }).save();

const buildTestApp = (limit, user) => {
  const app = express();
  app.use((req, res, next) => {
    req.user = user;
    next();
  });
  app.post('/limited', createConnectionRequestLimiter(limit), (req, res) => res.status(200).json({ ok: true }));
  return app;
};

const sendRequestRecord = async (fromUser, toUser, status = 'interested') =>
  new ConnectionRequest({ fromUserId: fromUser._id, toUserId: toUser._id, status }).save();

describe('getSubscriptionPlan', () => {
  it('returns "free" when the user has no Subscription document', async () => {
    const user = await createUser({ email: 'no-sub@example.com' });
    expect(await getSubscriptionPlan(user._id)).toBe('free');
  });

  it('returns "premium" only when plan is premium AND status is active', async () => {
    const user = await createUser({ email: 'premium@example.com' });
    await new Subscription({ userId: user._id, plan: 'premium', status: 'active' }).save();
    expect(await getSubscriptionPlan(user._id)).toBe('premium');
  });

  it('returns "free" for a premium plan that has lapsed (e.g. past_due)', async () => {
    const user = await createUser({ email: 'lapsed@example.com' });
    await new Subscription({ userId: user._id, plan: 'premium', status: 'past_due' }).save();
    expect(await getSubscriptionPlan(user._id)).toBe('free');
  });
});

describe('connectionRequestLimiter', () => {
  it('allows requests under the daily limit and 429s once it is reached', async () => {
    const fromUser = await createUser({ email: 'free-user@example.com' });
    const otherUsers = await Promise.all([
      createUser({ email: 'target1@example.com' }),
      createUser({ email: 'target2@example.com' }),
      createUser({ email: 'target3@example.com' }),
    ]);

    // Two requests already sent today; limit is 2.
    await sendRequestRecord(fromUser, otherUsers[0]);
    await sendRequestRecord(fromUser, otherUsers[1]);

    const app = buildTestApp(2, fromUser);
    const res = await request(app).post('/limited');

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Daily connection request limit reached/);
    expect(res.body.error).toMatch(/Upgrade to Premium/);
  });

  it('allows the request when under the limit', async () => {
    const fromUser = await createUser({ email: 'free-user2@example.com' });
    const otherUser = await createUser({ email: 'target4@example.com' });

    await sendRequestRecord(fromUser, otherUser);

    const app = buildTestApp(2, fromUser);
    const res = await request(app).post('/limited');

    expect(res.status).toBe(200);
  });

  it('bypasses the limit entirely for an active premium subscriber', async () => {
    const fromUser = await createUser({ email: 'premium-user@example.com' });
    const otherUsers = await Promise.all([
      createUser({ email: 'target5@example.com' }),
      createUser({ email: 'target6@example.com' }),
    ]);
    await sendRequestRecord(fromUser, otherUsers[0]);
    await sendRequestRecord(fromUser, otherUsers[1]);
    await new Subscription({ userId: fromUser._id, plan: 'premium', status: 'active' }).save();

    const app = buildTestApp(2, fromUser);
    const res = await request(app).post('/limited');

    expect(res.status).toBe(200);
  });
});
