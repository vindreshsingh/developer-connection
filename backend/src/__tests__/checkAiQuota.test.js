import express from 'express';
import request from 'supertest';
import User from '../models/user.js';
import Subscription from '../models/subscription.js';
import AiUsage from '../models/aiUsage.js';
import { hashPassword } from '../utils/sanitization.js';
import { createAiQuotaMiddleware } from '../middlewares/checkAiQuota.js';
import { AI_DAILY_LIMITS } from '../config/limits.js';

const createUser = async (overrides = {}) =>
  new User({
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    email: overrides.email,
    password: await hashPassword('password123'),
    isEmailVerified: true,
  }).save();

const buildTestApp = (feature, user) => {
  const app = express();
  app.use((req, res, next) => {
    req.user = user;
    next();
  });
  app.post('/limited', createAiQuotaMiddleware(feature), (req, res) => res.status(200).json({ ok: true }));
  return app;
};

const todayUTC = () => new Date().toISOString().slice(0, 10);

describe('checkAiQuota', () => {
  it('allows calls under the free daily limit and increments usage', async () => {
    const user = await createUser({ email: 'free-ai@example.com' });
    const app = buildTestApp('profile_feedback', user);

    const res = await request(app).post('/limited');

    expect(res.status).toBe(200);
    const usage = await AiUsage.findOne({ userId: user._id, feature: 'profile_feedback', date: todayUTC() });
    expect(usage.count).toBe(1);
  });

  it('returns 429 once the free daily limit is reached', async () => {
    const user = await createUser({ email: 'capped-ai@example.com' });
    const limit = AI_DAILY_LIMITS.free.profile_feedback;
    await new AiUsage({ userId: user._id, feature: 'profile_feedback', date: todayUTC(), count: limit }).save();

    const app = buildTestApp('profile_feedback', user);
    const res = await request(app).post('/limited');

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Daily AI usage limit reached/);
  });

  it('uses the higher premium limit for an active premium subscriber', async () => {
    const user = await createUser({ email: 'premium-ai@example.com' });
    const freeLimit = AI_DAILY_LIMITS.free.profile_feedback;
    await new Subscription({ userId: user._id, plan: 'premium', status: 'active' }).save();
    await new AiUsage({ userId: user._id, feature: 'profile_feedback', date: todayUTC(), count: freeLimit }).save();

    const app = buildTestApp('profile_feedback', user);
    const res = await request(app).post('/limited');

    expect(res.status).toBe(200);
  });
});
