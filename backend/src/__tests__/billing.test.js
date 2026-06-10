import request from 'supertest';
import nock from 'nock';
import app from '../app.js';
import User from '../models/user.js';
import Subscription from '../models/subscription.js';
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

afterEach(() => nock.cleanAll());

describe('GET /billing/status', () => {
  it('returns free/none for a user with no Subscription document', async () => {
    const { cookie } = await createUser({ email: 'free@example.com' });

    const res = await request(app).get('/billing/status').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      plan: 'free',
      status: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });

  it('returns the stored plan/status for a subscribed user', async () => {
    const { user, cookie } = await createUser({ email: 'premium@example.com' });
    await new Subscription({
      userId: user._id,
      plan: 'premium',
      status: 'active',
      razorpaySubscriptionId: 'sub_abc',
    }).save();

    const res = await request(app).get('/billing/status').set('Cookie', cookie);

    expect(res.body.data.plan).toBe('premium');
    expect(res.body.data.status).toBe('active');
  });
});

describe('POST /billing/checkout', () => {
  it('creates a Razorpay subscription and upserts a placeholder Subscription doc', async () => {
    const { user, cookie } = await createUser({ email: 'checkout@example.com' });

    nock('https://api.razorpay.com')
      .post('/v1/subscriptions')
      .reply(200, { id: 'sub_new123', status: 'created' });

    const res = await request(app).post('/billing/checkout').set('Cookie', cookie);

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ subscriptionId: 'sub_new123', keyId: process.env.RAZORPAY_KEY_ID });

    const subscription = await Subscription.findOne({ userId: user._id });
    expect(subscription.razorpaySubscriptionId).toBe('sub_new123');
    // Stays 'free' until the activation webhook confirms payment.
    expect(subscription.plan).toBe('free');
    expect(subscription.status).toBe('none');
  });
});

describe('POST /billing/cancel', () => {
  it('cancels the Razorpay subscription and marks cancelAtPeriodEnd', async () => {
    const { user, cookie } = await createUser({ email: 'cancel@example.com' });
    await new Subscription({
      userId: user._id,
      plan: 'premium',
      status: 'active',
      razorpaySubscriptionId: 'sub_cancel123',
    }).save();

    nock('https://api.razorpay.com')
      .post('/v1/subscriptions/sub_cancel123/cancel')
      .reply(200, { id: 'sub_cancel123', status: 'active' });

    const res = await request(app).post('/billing/cancel').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.cancelAtPeriodEnd).toBe(true);

    const subscription = await Subscription.findOne({ userId: user._id });
    expect(subscription.cancelAtPeriodEnd).toBe(true);
  });

  it('returns 404 when the user has no subscription', async () => {
    const { cookie } = await createUser({ email: 'nosub@example.com' });

    const res = await request(app).post('/billing/cancel').set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});
