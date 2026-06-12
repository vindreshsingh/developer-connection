/**
 * Tests for Phase 6 Task A4 — entitlement gating.
 *
 * Covers:
 *   - requirePremium middleware (403 PREMIUM_REQUIRED, pass-through, grace period)
 *   - GET /profile/feed?experienceLevel= (Premium-only advanced filter)
 *   - POST /request/send/interested/:toUserId daily swipe limit (free users)
 *   - POST /calls (group) isPriority + POST /calls/group-token maxParticipants
 */

import express from 'express';
import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import Plan from '../models/plan.js';
import Subscription from '../models/subscription.js';
import Group from '../models/group.js';
import { hashPassword } from '../utils/sanitization.js';
import { requirePremium } from '../middlewares/premium.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const createUser = async (overrides = {}) => {
  const user = await new User({
    firstName: 'Test',
    lastName: 'User',
    email: `${Math.random().toString(36).slice(2)}@example.com`,
    password: await hashPassword('pass1234'),
    isEmailVerified: true,
    ...overrides,
  }).save();
  return { user, cookie: `token=${user.getJWT()}` };
};

const seedPlans = async () => {
  await Plan.create({
    key: 'free',
    name: 'Free',
    price: 0,
    razorpayPlanId: null,
    features: {
      dailySwipeLimit: 2,
      advancedFilters: false,
      priorityGroupCalls: false,
      aiAssistant: false,
      groupCallParticipantCap: 8,
    },
  });
  await Plan.create({
    key: 'premium',
    name: 'Premium',
    price: 10000,
    razorpayPlanId: 'plan_premium_test',
    features: {
      dailySwipeLimit: null,
      advancedFilters: true,
      priorityGroupCalls: true,
      aiAssistant: true,
      groupCallParticipantCap: 25,
    },
  });
};

const createGroup = async (creatorId) =>
  Group.create({
    name: `Group ${Date.now()}`,
    createdBy: creatorId,
    members: [{ userId: creatorId, role: 'admin', joinedAt: new Date() }],
    memberCount: 1,
  });

const TEST_KEY = 'devtestkey';
const TEST_SECRET = 'devtestsecret00000000000000000000'; // 32+ chars

// ── requirePremium middleware (unit, via a small test app) ────────────────────

describe('requirePremium middleware', () => {
  const buildTestApp = () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(async (req, res, next) => {
      req.user = await User.findById(req.headers['x-user-id']);
      next();
    });
    testApp.get('/protected', requirePremium('ai-assistant'), (req, res) => res.status(200).json({ ok: true }));
    return testApp;
  };

  it('returns 403 PREMIUM_REQUIRED for a non-premium user', async () => {
    const { user } = await createUser({ isPremium: false });
    const testApp = buildTestApp();

    const res = await request(testApp).get('/protected').set('x-user-id', user._id.toString());
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'PREMIUM_REQUIRED', feature: 'ai-assistant' });
  });

  it('passes through for a premium user with no past_due subscription', async () => {
    const { user } = await createUser({ isPremium: true });
    const testApp = buildTestApp();

    const res = await request(testApp).get('/protected').set('x-user-id', user._id.toString());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('passes through for a past_due subscription still within the grace period', async () => {
    const { user } = await createUser({ isPremium: true });
    const plan = await Plan.create({
      key: 'premium',
      name: 'Premium',
      price: 10000,
      features: { groupCallParticipantCap: 25 },
    });
    await Subscription.create({
      userId: user._id,
      planId: plan._id,
      status: 'past_due',
      currentPeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    });

    const testApp = buildTestApp();
    const res = await request(testApp).get('/protected').set('x-user-id', user._id.toString());
    expect(res.status).toBe(200);
  });

  it('flips isPremium to false and returns 403 once the grace period has elapsed', async () => {
    const { user } = await createUser({ isPremium: true });
    const plan = await Plan.create({
      key: 'premium',
      name: 'Premium',
      price: 10000,
      features: { groupCallParticipantCap: 25 },
    });
    const subscription = await Subscription.create({
      userId: user._id,
      planId: plan._id,
      status: 'past_due',
      currentPeriodEnd: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago (> 3-day grace)
    });

    const testApp = buildTestApp();
    const res = await request(testApp).get('/protected').set('x-user-id', user._id.toString());
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'PREMIUM_REQUIRED', feature: 'ai-assistant' });

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isPremium).toBe(false);

    const updatedSub = await Subscription.findById(subscription._id);
    expect(updatedSub.status).toBe('expired');
  });
});

// ── GET /profile/feed?experienceLevel= ─────────────────────────────────────────

describe('GET /profile/feed?experienceLevel= (Premium advanced filter)', () => {
  const yearsAgo = (years) => new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000);

  const seedCandidates = async () => {
    await createUser({ firstName: 'Junior', experience: [{ title: 'Dev', company: 'A', startDate: yearsAgo(1) }] });
    await createUser({ firstName: 'Senior', experience: [{ title: 'Dev', company: 'B', startDate: yearsAgo(7) }] });
  };

  it('ignores experienceLevel for a free user', async () => {
    const { cookie } = await createUser({ isPremium: false });
    await seedCandidates();

    const res = await request(app).get('/profile/feed?experienceLevel=senior').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.map((u) => u.firstName).sort()).toEqual(['Junior', 'Senior']);
  });

  it('applies experienceLevel for a premium user', async () => {
    const { cookie } = await createUser({ isPremium: true });
    await seedCandidates();

    const res = await request(app).get('/profile/feed?experienceLevel=senior').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.map((u) => u.firstName)).toEqual(['Senior']);

    const juniorRes = await request(app).get('/profile/feed?experienceLevel=junior').set('Cookie', cookie);
    expect(juniorRes.status).toBe(200);
    expect(juniorRes.body.data.map((u) => u.firstName)).toEqual(['Junior']);
  });
});

// ── POST /request/send/interested/:toUserId daily swipe limit ─────────────────

describe('POST /request/send/interested/:toUserId — daily swipe limit', () => {
  it('returns SWIPE_LIMIT_REACHED once a free user hits the daily cap', async () => {
    await seedPlans(); // free plan dailySwipeLimit = 2
    const { cookie } = await createUser({ isPremium: false });
    const targets = await Promise.all([createUser(), createUser(), createUser()]);

    const first = await request(app).post(`/request/send/interested/${targets[0].user._id}`).set('Cookie', cookie);
    expect(first.status).toBe(201);

    const second = await request(app).post(`/request/send/interested/${targets[1].user._id}`).set('Cookie', cookie);
    expect(second.status).toBe(201);

    const third = await request(app).post(`/request/send/interested/${targets[2].user._id}`).set('Cookie', cookie);
    expect(third.status).toBe(403);
    expect(third.body).toEqual({ error: 'SWIPE_LIMIT_REACHED' });
  });

  it('does not limit a premium user beyond the free daily cap', async () => {
    await seedPlans(); // free plan dailySwipeLimit = 2
    const { cookie } = await createUser({ isPremium: true });
    const targets = await Promise.all([createUser(), createUser(), createUser()]);

    for (const { user: target } of targets) {
      const res = await request(app).post(`/request/send/interested/${target._id}`).set('Cookie', cookie);
      expect(res.status).toBe(201);
    }
  });

  it('does not count "ignored" requests against the swipe limit', async () => {
    await seedPlans(); // free plan dailySwipeLimit = 2
    const { cookie } = await createUser({ isPremium: false });
    const targets = await Promise.all([createUser(), createUser(), createUser()]);

    for (const { user: target } of targets) {
      const res = await request(app).post(`/request/send/ignored/${target._id}`).set('Cookie', cookie);
      expect(res.status).toBe(201);
    }
  });
});

// ── Group call isPriority + maxParticipants ────────────────────────────────────

describe('Group call participant cap (isPriority / maxParticipants)', () => {
  beforeAll(() => {
    process.env.LIVEKIT_API_KEY = TEST_KEY;
    process.env.LIVEKIT_API_SECRET = TEST_SECRET;
  });
  afterAll(() => {
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
  });

  it('caps a free user\'s group call at the free plan limit (8)', async () => {
    await seedPlans();
    const { user, cookie } = await createUser({ isPremium: false });
    const group = await createGroup(user._id);

    const initiate = await request(app).post('/calls').set('Cookie', cookie).send({ type: 'group', groupId: group._id.toString() });
    expect(initiate.status).toBe(201);

    const tokenRes = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({ callId: initiate.body.callId });

    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body.maxParticipants).toBe(8);
  });

  it('raises a premium user\'s group call cap to 25', async () => {
    await seedPlans();
    const { user, cookie } = await createUser({ isPremium: true });
    const group = await createGroup(user._id);

    const initiate = await request(app).post('/calls').set('Cookie', cookie).send({ type: 'group', groupId: group._id.toString() });
    expect(initiate.status).toBe(201);

    const tokenRes = await request(app)
      .post('/calls/group-token')
      .set('Cookie', cookie)
      .send({ callId: initiate.body.callId });

    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body.maxParticipants).toBe(25);
  });
});
