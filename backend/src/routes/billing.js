/**
 * Billing REST API — mounted at /billing in app.js.
 *
 * Manages Plan catalog, Razorpay checkout/subscription lifecycle, and
 * payment history. The webhook route (Task A3) is the only authoritative
 * writer of Subscription.status / User.isPremium.
 *
 * Authorization matrix:
 *   GET    /plans         public
 *   POST   /checkout       logged in
 *   POST   /webhook         Razorpay signature (no user auth)
 *   GET    /subscription    logged in
 *   POST   /cancel          logged in
 *   GET    /history         logged in
 */

import express from 'express';
import userAuth from '../middlewares/auth.js';
import { BILLING } from '../constants/apiEndpoints.js';
import Plan from '../models/plan.js';
import Subscription from '../models/subscription.js';
import PaymentEvent from '../models/paymentEvent.js';
import { PaymentService } from '../services/PaymentService.js';
import { BillingEventHandler } from '../services/BillingEventHandler.js';

const router = express.Router();
const PAGE_SIZE = 20;

// ── GET /plans — public plan catalog ──────────────────────────────────────────

router.get(BILLING.PLANS, async (req, res) => {
  const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
  res.status(200).json({ data: plans });
});

// ── POST /checkout — create a Razorpay subscription order ─────────────────────

router.post(BILLING.CHECKOUT, userAuth, async (req, res) => {
  try {
    const { planKey } = req.body;

    const plan = await Plan.findOne({ key: planKey, isActive: true });
    if (!plan) {
      return res.status(400).json({ error: 'Unknown plan.' });
    }
    if (!plan.razorpayPlanId) {
      return res.status(400).json({ error: 'This plan is not purchasable.' });
    }

    const existing = await Subscription.findOne({
      userId: req.user._id,
      status: { $in: ['created', 'active', 'past_due'] },
    });
    if (existing) {
      return res.status(400).json({ error: 'You already have an active or pending subscription.' });
    }

    const { razorpaySubscriptionId, razorpayCustomerId } = await PaymentService.createSubscription({
      user: req.user,
      plan,
    });

    const subscription = await Subscription.create({
      userId: req.user._id,
      planId: plan._id,
      status: 'created',
      razorpaySubscriptionId,
      razorpayCustomerId,
    });

    res.status(201).json({
      data: {
        subscriptionId: subscription._id,
        razorpaySubscriptionId,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /webhook — Razorpay webhook receiver ──────────────────────────────────
//
// req.body here is a raw Buffer (see app.js — this path is excluded from
// express.json() so signature verification sees the exact bytes Razorpay
// signed).

router.post(BILLING.WEBHOOK, async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!PaymentService.verifyWebhookSignature(req.body, signature)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const eventId = req.headers['x-razorpay-event-id'] || payload.id || null;

  if (eventId) {
    const existing = await PaymentEvent.findOne({ razorpayEventId: eventId });
    if (existing) {
      return res.status(200).json({ ok: true });
    }
  }

  await BillingEventHandler.handle(payload, eventId);

  res.status(200).json({ ok: true });
});

// ── GET /subscription — current user's subscription ───────────────────────────

router.get(BILLING.SUBSCRIPTION, userAuth, async (req, res) => {
  const subscription = await Subscription.findOne({
    userId: req.user._id,
    status: { $in: ['created', 'active', 'past_due'] },
  })
    .sort({ createdAt: -1 })
    .populate('planId');

  if (!subscription) {
    const freePlan = await Plan.findOne({ key: 'free' });
    return res.status(200).json({ data: { plan: freePlan, subscription: null } });
  }

  res.status(200).json({ data: { plan: subscription.planId, subscription } });
});

// ── POST /cancel — cancel at period end ────────────────────────────────────────

router.post(BILLING.CANCEL, userAuth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      status: 'active',
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found.' });
    }

    await PaymentService.cancelSubscription(subscription.razorpaySubscriptionId);

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    res.status(200).json({ data: subscription });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /history — paginated PaymentEvent list ─────────────────────────────────

router.get(BILLING.HISTORY, userAuth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const [events, total] = await Promise.all([
    PaymentEvent.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
    PaymentEvent.countDocuments({ userId: req.user._id }),
  ]);

  res.status(200).json({ data: events, page, pageSize: PAGE_SIZE, total });
});

export default router;
