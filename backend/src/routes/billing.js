import express from 'express';
import userAuth from '../middlewares/auth.js';
import { BILLING } from '../constants/apiEndpoints.js';
import Subscription from '../models/subscription.js';
import { createPremiumSubscription, cancelRazorpaySubscription } from '../services/razorpayService.js';

const router = express.Router();

router.get(BILLING.STATUS, userAuth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    res.status(200).json({
      data: {
        plan: subscription?.plan || 'free',
        status: subscription?.status || 'none',
        currentPeriodEnd: subscription?.currentPeriodEnd || null,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Creates a Razorpay subscription and upserts a placeholder Subscription doc
// (plan stays 'free' until the activation webhook confirms payment).
router.post(BILLING.CHECKOUT, userAuth, async (req, res) => {
  try {
    const razorpaySubscription = await createPremiumSubscription(req.user._id);

    await Subscription.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        razorpaySubscriptionId: razorpaySubscription.id,
        plan: 'free',
        status: 'none',
        cancelAtPeriodEnd: false,
      },
      { upsert: true }
    );

    res.status(201).json({
      data: {
        subscriptionId: razorpaySubscription.id,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancels at the end of the current billing cycle — access continues until
// currentPeriodEnd, the webhook's `subscription.cancelled` event then flips
// status to 'cancelled' once the period actually ends.
router.post(BILLING.CANCEL, userAuth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });
    if (!subscription?.razorpaySubscriptionId)
      return res.status(404).json({ error: 'No subscription found' });

    await cancelRazorpaySubscription(subscription.razorpaySubscriptionId);
    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    res.status(200).json({ data: { cancelAtPeriodEnd: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
