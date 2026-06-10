import request from 'supertest';
import crypto from 'crypto';
import app from '../app.js';
import User from '../models/user.js';
import Subscription from '../models/subscription.js';
import WebhookEvent from '../models/webhookEvent.js';
import { hashPassword } from '../utils/sanitization.js';

const createUser = async (overrides = {}) =>
  new User({
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    email: overrides.email,
    password: await hashPassword('password123'),
    isEmailVerified: true,
  }).save();

const sign = (body) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');

const subscriptionEventPayload = (event, { userId, subscriptionId, customerId, currentEnd }) =>
  JSON.stringify({
    entity: 'event',
    event,
    contains: ['subscription'],
    payload: {
      subscription: {
        entity: {
          id: subscriptionId,
          entity: 'subscription',
          status: event.split('.')[1],
          customer_id: customerId || null,
          current_end: currentEnd || null,
          notes: { userId: userId.toString() },
        },
      },
    },
    created_at: 1700000000,
  });

const postWebhook = (body, signature) =>
  request(app)
    .post('/billing/webhook')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', signature)
    .send(body);

describe('POST /billing/webhook', () => {
  it('rejects a request with an invalid signature', async () => {
    const body = subscriptionEventPayload('subscription.activated', {
      userId: '64b000000000000000000000',
      subscriptionId: 'sub_1',
    });

    const res = await postWebhook(body, 'not-the-real-signature');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid webhook signature/);
  });

  it('activates the subscription and sets it to premium', async () => {
    const user = await createUser({ email: 'webhook-activate@example.com' });
    await new Subscription({ userId: user._id, razorpaySubscriptionId: 'sub_1', plan: 'free', status: 'none' }).save();

    const body = subscriptionEventPayload('subscription.activated', {
      userId: user._id,
      subscriptionId: 'sub_1',
      customerId: 'cust_1',
      currentEnd: 1702592000,
    });

    const res = await postWebhook(body, sign(body));

    expect(res.status).toBe(200);

    const subscription = await Subscription.findOne({ userId: user._id });
    expect(subscription.plan).toBe('premium');
    expect(subscription.status).toBe('active');
    expect(subscription.razorpayCustomerId).toBe('cust_1');
    expect(subscription.currentPeriodEnd).toEqual(new Date(1702592000 * 1000));
  });

  it('reverts to free on subscription.cancelled', async () => {
    const user = await createUser({ email: 'webhook-cancel@example.com' });
    await new Subscription({
      userId: user._id,
      razorpaySubscriptionId: 'sub_2',
      plan: 'premium',
      status: 'active',
    }).save();

    const body = subscriptionEventPayload('subscription.cancelled', {
      userId: user._id,
      subscriptionId: 'sub_2',
    });

    const res = await postWebhook(body, sign(body));

    expect(res.status).toBe(200);

    const subscription = await Subscription.findOne({ userId: user._id });
    expect(subscription.plan).toBe('free');
    expect(subscription.status).toBe('cancelled');
  });

  it('is idempotent on retried deliveries of the same payload', async () => {
    const user = await createUser({ email: 'webhook-retry@example.com' });
    await new Subscription({ userId: user._id, razorpaySubscriptionId: 'sub_3', plan: 'free', status: 'none' }).save();

    const body = subscriptionEventPayload('subscription.activated', {
      userId: user._id,
      subscriptionId: 'sub_3',
      currentEnd: 1702592000,
    });
    const signature = sign(body);

    const first = await postWebhook(body, signature);
    const second = await postWebhook(body, signature);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(await WebhookEvent.countDocuments()).toBe(1);
  });
});
