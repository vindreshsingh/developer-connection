/**
 * Tests for Phase 6 Tasks A2 + A3 — PaymentService, checkout/cancel/history
 * routes, and the Razorpay webhook handler (BillingEventHandler).
 *
 * The `razorpay` SDK is mocked at the module level (no live API calls);
 * webhook signature verification uses the real HMAC implementation against
 * RAZORPAY_WEBHOOK_SECRET (set in setup.js).
 */

import { jest } from '@jest/globals';
import crypto from 'crypto';

const mockCustomersCreate = jest.fn().mockResolvedValue({ id: 'cust_test123' });
const mockSubscriptionsCreate = jest.fn().mockResolvedValue({ id: 'sub_test123' });
const mockSubscriptionsCancel = jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'cancelled' });

jest.unstable_mockModule('razorpay', () => ({
  default: jest.fn().mockImplementation(() => ({
    customers: { create: mockCustomersCreate },
    subscriptions: { create: mockSubscriptionsCreate, cancel: mockSubscriptionsCancel },
  })),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { default: User } = await import('../models/user.js');
const { default: Plan } = await import('../models/plan.js');
const { default: Subscription } = await import('../models/subscription.js');
const { default: PaymentEvent } = await import('../models/paymentEvent.js');
const { hashPassword } = await import('../utils/sanitization.js');

const sign = (rawBody) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

const createUser = async (email = `bill_${Date.now()}_${Math.random()}@test.com`) => {
  const user = await new User({
    firstName: 'Test',
    email,
    password: await hashPassword('pass1234'),
    isEmailVerified: true,
  }).save();
  return { user, cookie: `token=${user.getJWT()}` };
};

const createPremiumPlan = async () =>
  Plan.create({
    key: 'premium',
    name: 'Premium',
    price: 10000,
    currency: 'INR',
    interval: 'month',
    razorpayPlanId: 'plan_premium_test',
    features: {
      dailySwipeLimit: null,
      advancedFilters: true,
      priorityGroupCalls: true,
      aiAssistant: true,
      groupCallParticipantCap: 25,
    },
    isActive: true,
  });

const createFreePlan = async () =>
  Plan.create({
    key: 'free',
    name: 'Free',
    price: 0,
    currency: 'INR',
    interval: 'month',
    razorpayPlanId: null,
    features: { dailySwipeLimit: 20, groupCallParticipantCap: 8 },
    isActive: true,
  });

beforeEach(() => {
  jest.clearAllMocks();
});

// ── GET /billing/plans ──────────────────────────────────────────────────────────

describe('GET /billing/plans', () => {
  it('returns active plans without auth', async () => {
    await createFreePlan();
    await createPremiumPlan();

    const res = await request(app).get('/billing/plans');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((p) => p.key).sort()).toEqual(['free', 'premium']);
  });
});

// ── POST /billing/checkout ──────────────────────────────────────────────────────

describe('POST /billing/checkout', () => {
  it('creates a subscription via Razorpay and persists it as created', async () => {
    const { cookie } = await createUser();
    await createPremiumPlan();

    const res = await request(app)
      .post('/billing/checkout')
      .set('Cookie', cookie)
      .send({ planKey: 'premium' });

    expect(res.status).toBe(201);
    expect(res.body.data.razorpaySubscriptionId).toBe('sub_test123');
    expect(res.body.data.razorpayKeyId).toBe(process.env.RAZORPAY_KEY_ID);
    expect(mockSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: 'plan_premium_test' }),
    );

    const sub = await Subscription.findById(res.body.data.subscriptionId);
    expect(sub.status).toBe('created');
    expect(sub.razorpaySubscriptionId).toBe('sub_test123');
  });

  it('rejects checkout for an unknown plan', async () => {
    const { cookie } = await createUser();

    const res = await request(app)
      .post('/billing/checkout')
      .set('Cookie', cookie)
      .send({ planKey: 'enterprise' });

    expect(res.status).toBe(400);
  });

  it('rejects checkout if the user already has a pending/active subscription', async () => {
    const { user, cookie } = await createUser();
    const plan = await createPremiumPlan();

    await Subscription.create({ userId: user._id, planId: plan._id, status: 'active' });

    const res = await request(app)
      .post('/billing/checkout')
      .set('Cookie', cookie)
      .send({ planKey: 'premium' });

    expect(res.status).toBe(400);
    expect(mockSubscriptionsCreate).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    await createPremiumPlan();
    const res = await request(app).post('/billing/checkout').send({ planKey: 'premium' });
    expect(res.status).toBe(401);
  });
});

// ── GET /billing/subscription ───────────────────────────────────────────────────

describe('GET /billing/subscription', () => {
  it('returns the free plan with no subscription when none exists', async () => {
    const { cookie } = await createUser();
    await createFreePlan();

    const res = await request(app).get('/billing/subscription').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.subscription).toBeNull();
    expect(res.body.data.plan.key).toBe('free');
  });

  it('returns the active subscription and its plan', async () => {
    const { user, cookie } = await createUser();
    const plan = await createPremiumPlan();
    await Subscription.create({ userId: user._id, planId: plan._id, status: 'active' });

    const res = await request(app).get('/billing/subscription').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.subscription.status).toBe('active');
    expect(res.body.data.plan.key).toBe('premium');
  });
});

// ── POST /billing/cancel ─────────────────────────────────────────────────────────

describe('POST /billing/cancel', () => {
  it('returns 404 when there is no active subscription', async () => {
    const { cookie } = await createUser();

    const res = await request(app).post('/billing/cancel').set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('cancels the active subscription at period end', async () => {
    const { user, cookie } = await createUser();
    const plan = await createPremiumPlan();
    const sub = await Subscription.create({ userId: user._id, planId: plan._id, status: 'active' });

    const res = await request(app).post('/billing/cancel').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith(
      sub.razorpaySubscriptionId,
      expect.objectContaining({ cancel_at_cycle_end: 1 }),
    );

    const updated = await Subscription.findById(sub._id);
    expect(updated.cancelAtPeriodEnd).toBe(true);
    expect(updated.status).toBe('active'); // status flips to 'cancelled' only via webhook at period end
  });
});

// ── POST /billing/webhook ─────────────────────────────────────────────────────────

describe('POST /billing/webhook', () => {
  const buildPayload = (event, overrides = {}) => ({
    entity: 'event',
    event,
    payload: {
      subscription: {
        entity: {
          id: 'sub_webhook_test',
          plan_id: 'plan_premium_test',
          status: event.split('.')[1],
          current_start: 1700000000,
          current_end: 1702592000,
          notes: { userId: overrides.userId },
        },
      },
      ...(overrides.payment
        ? { payment: { entity: { id: 'pay_test', amount: 10000, currency: 'INR', subscription_id: 'sub_webhook_test', notes: { userId: overrides.userId } } } }
        : {}),
    },
    created_at: 1700000000,
  });

  it('rejects requests with an invalid signature', async () => {
    const { user } = await createUser();
    const payload = buildPayload('subscription.activated', { userId: user._id.toString() });
    const raw = JSON.stringify(payload);

    const res = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'not-a-valid-signature')
      .send(raw);

    expect(res.status).toBe(400);
    expect(await PaymentEvent.countDocuments({})).toBe(0);
  });

  it('activates a subscription and sets User.isPremium on subscription.activated', async () => {
    const { user, cookie } = await createUser();
    const plan = await createPremiumPlan();
    const sub = await Subscription.create({
      userId: user._id,
      planId: plan._id,
      status: 'created',
      razorpaySubscriptionId: 'sub_webhook_test',
    });

    const payload = buildPayload('subscription.activated', { userId: user._id.toString() });
    const raw = JSON.stringify(payload);

    const res = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-event-id', 'evt_activate_1')
      .set('x-razorpay-signature', sign(raw))
      .send(raw);

    expect(res.status).toBe(200);

    const updatedSub = await Subscription.findById(sub._id);
    expect(updatedSub.status).toBe('active');
    expect(updatedSub.currentPeriodEnd).toEqual(new Date(1702592000 * 1000));

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isPremium).toBe(true);

    // Subscription is now active — GET /billing/subscription reflects it
    const subRes = await request(app).get('/billing/subscription').set('Cookie', cookie);
    expect(subRes.body.data.subscription.status).toBe('active');
  });

  it('is idempotent for duplicate event ids', async () => {
    const { user } = await createUser();
    const plan = await createPremiumPlan();
    await Subscription.create({
      userId: user._id,
      planId: plan._id,
      status: 'created',
      razorpaySubscriptionId: 'sub_webhook_test',
    });

    const payload = buildPayload('subscription.activated', { userId: user._id.toString() });
    const raw = JSON.stringify(payload);
    const headers = {
      'x-razorpay-event-id': 'evt_dup_1',
      'x-razorpay-signature': sign(raw),
    };

    await request(app).post('/billing/webhook').set('Content-Type', 'application/json').set(headers).send(raw);
    const res2 = await request(app).post('/billing/webhook').set('Content-Type', 'application/json').set(headers).send(raw);

    expect(res2.status).toBe(200);
    expect(await PaymentEvent.countDocuments({ razorpayEventId: 'evt_dup_1' })).toBe(1);
  });

  it('marks a subscription past_due on payment.failed without revoking isPremium', async () => {
    const { user } = await createUser();
    const plan = await createPremiumPlan();
    await Subscription.create({
      userId: user._id,
      planId: plan._id,
      status: 'active',
      razorpaySubscriptionId: 'sub_webhook_test',
    });
    await User.findByIdAndUpdate(user._id, { isPremium: true });

    const payload = buildPayload('payment.failed', { userId: user._id.toString(), payment: true });
    const raw = JSON.stringify(payload);

    const res = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-event-id', 'evt_failed_1')
      .set('x-razorpay-signature', sign(raw))
      .send(raw);

    expect(res.status).toBe(200);

    const updatedSub = await Subscription.findOne({ razorpaySubscriptionId: 'sub_webhook_test' });
    expect(updatedSub.status).toBe('past_due');

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isPremium).toBe(true);
  });

  it('revokes isPremium on subscription.cancelled', async () => {
    const { user } = await createUser();
    const plan = await createPremiumPlan();
    await Subscription.create({
      userId: user._id,
      planId: plan._id,
      status: 'active',
      razorpaySubscriptionId: 'sub_webhook_test',
    });
    await User.findByIdAndUpdate(user._id, { isPremium: true });

    const payload = buildPayload('subscription.cancelled', { userId: user._id.toString() });
    const raw = JSON.stringify(payload);

    const res = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-event-id', 'evt_cancel_1')
      .set('x-razorpay-signature', sign(raw))
      .send(raw);

    expect(res.status).toBe(200);

    const updatedSub = await Subscription.findOne({ razorpaySubscriptionId: 'sub_webhook_test' });
    expect(updatedSub.status).toBe('cancelled');

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isPremium).toBe(false);
  });
});

// ── GET /billing/history ─────────────────────────────────────────────────────────

describe('GET /billing/history', () => {
  it('returns paginated payment events for the logged-in user only', async () => {
    const { user, cookie } = await createUser();
    const { user: other } = await createUser();

    await PaymentEvent.create({ userId: user._id, type: 'subscription.activated', razorpayEventId: 'a1' });
    await PaymentEvent.create({ userId: other._id, type: 'subscription.activated', razorpayEventId: 'a2' });

    const res = await request(app).get('/billing/history').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(user._id.toString());
  });
});
