import express from 'express';
import crypto from 'crypto';
import { BILLING_WEBHOOK } from '../constants/apiEndpoints.js';
import Subscription from '../models/subscription.js';
import WebhookEvent from '../models/webhookEvent.js';
import { verifyWebhookSignature } from '../services/razorpayService.js';

const router = express.Router();

// Razorpay subscription status -> our plan/status. 'past_due' already
// excludes a user from premium gating (see subscriptionService), so a
// failed/pending charge degrades gracefully without a separate grace-period
// timer (Phase 6 RFC Open Question #3).
const STATUS_MAP = {
  'subscription.activated': 'active',
  'subscription.charged': 'active',
  'subscription.pending': 'past_due',
  'subscription.halted': 'cancelled',
  'subscription.cancelled': 'cancelled',
  'subscription.completed': 'cancelled',
};

// Mounted with express.raw({ type: 'application/json' }) — req.body is a
// Buffer here, required for HMAC signature verification.
router.post(BILLING_WEBHOOK, async (req, res) => {
  try {
    const rawBody = req.body;
    const signature = req.headers['x-razorpay-signature'];

    if (!verifyWebhookSignature(rawBody, signature))
      return res.status(400).json({ error: 'Invalid webhook signature' });

    // Razorpay retries deliveries with an identical payload; dedupe on the
    // raw body so retries are no-ops.
    const hash = crypto.createHash('sha256').update(rawBody).digest('hex');
    try {
      await new WebhookEvent({ source: 'razorpay', hash }).save();
    } catch (err) {
      if (err.code === 11000) return res.status(200).json({ received: true, duplicate: true });
      throw err;
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const newStatus = STATUS_MAP[payload.event];
    const subscriptionEntity = payload.payload?.subscription?.entity;

    if (newStatus && subscriptionEntity) {
      const filter = subscriptionEntity.notes?.userId
        ? { userId: subscriptionEntity.notes.userId }
        : { razorpaySubscriptionId: subscriptionEntity.id };

      await Subscription.findOneAndUpdate(filter, {
        razorpaySubscriptionId: subscriptionEntity.id,
        razorpayCustomerId: subscriptionEntity.customer_id || null,
        plan: newStatus === 'active' ? 'premium' : 'free',
        status: newStatus,
        currentPeriodEnd: subscriptionEntity.current_end
          ? new Date(subscriptionEntity.current_end * 1000)
          : null,
      });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
