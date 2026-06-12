/**
 * Tests for Phase 6 Task A1 — Plan/Subscription/PaymentEvent models +
 * User.isPremium + seedPlans script.
 */

import Plan from '../models/plan.js';
import Subscription from '../models/subscription.js';
import PaymentEvent from '../models/paymentEvent.js';
import User from '../models/user.js';
import { seedPlans } from '../scripts/seedPlans.js';
import { hashPassword } from '../utils/sanitization.js';

describe('seedPlans', () => {
  it('creates the free and premium plans', async () => {
    await seedPlans();

    const free = await Plan.findOne({ key: 'free' });
    const premium = await Plan.findOne({ key: 'premium' });

    expect(free).toBeTruthy();
    expect(free.features.dailySwipeLimit).toBe(20);
    expect(free.features.aiAssistant).toBe(false);

    expect(premium).toBeTruthy();
    expect(premium.price).toBe(10000);
    expect(premium.features.dailySwipeLimit).toBeNull();
    expect(premium.features.advancedFilters).toBe(true);
    expect(premium.features.aiAssistant).toBe(true);
    expect(premium.features.groupCallParticipantCap).toBe(25);
  });

  it('is idempotent — re-running does not create duplicates', async () => {
    await seedPlans();
    await seedPlans();

    const plans = await Plan.find({});
    expect(plans).toHaveLength(2);
  });
});

describe('Subscription model', () => {
  it('defaults status to created and cancelAtPeriodEnd to false', async () => {
    const user = await new User({
      firstName: 'Test',
      email: `sub_${Date.now()}@test.com`,
      password: await hashPassword('pass1234'),
      isEmailVerified: true,
    }).save();

    await seedPlans();
    const premium = await Plan.findOne({ key: 'premium' });

    const sub = await Subscription.create({ userId: user._id, planId: premium._id });

    expect(sub.status).toBe('created');
    expect(sub.cancelAtPeriodEnd).toBe(false);
    expect(sub.currentPeriodStart).toBeNull();
  });
});

describe('PaymentEvent model', () => {
  it('enforces a unique sparse index on razorpayEventId', async () => {
    const user = await new User({
      firstName: 'Test',
      email: `pe_${Date.now()}@test.com`,
      password: await hashPassword('pass1234'),
      isEmailVerified: true,
    }).save();

    // Ensure indexes are built before relying on the unique constraint
    await PaymentEvent.syncIndexes();

    await PaymentEvent.create({
      userId: user._id,
      razorpayEventId: 'evt_dup_1',
      type: 'subscription.activated',
    });

    await expect(
      PaymentEvent.create({
        userId: user._id,
        razorpayEventId: 'evt_dup_1',
        type: 'subscription.activated',
      }),
    ).rejects.toThrow();

    // Multiple documents without an event id (sparse) are allowed
    await PaymentEvent.create({ userId: user._id, type: 'payment.failed' });
    await PaymentEvent.create({ userId: user._id, type: 'payment.failed' });
  });
});

describe('User.isPremium', () => {
  it('defaults to false', async () => {
    const user = await new User({
      firstName: 'Test',
      email: `prem_${Date.now()}@test.com`,
      password: await hashPassword('pass1234'),
      isEmailVerified: true,
    }).save();

    expect(user.isPremium).toBe(false);
  });
});
