/**
 * Subscription — a user's billing relationship with a Plan (Phase 6).
 *
 * Created (status: 'created') when checkout starts; transitions to 'active'
 * once Razorpay confirms the first payment via webhook. `User.isPremium` is
 * the denormalized read path other routes use — this collection is the
 * source of truth, written only by BillingEventHandler / requirePremium's
 * lazy grace-period check.
 */

import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: ObjectId,
      ref: 'Plan',
      required: true,
    },
    status: {
      type: String,
      enum: ['created', 'active', 'past_due', 'cancelled', 'expired'],
      default: 'created',
    },
    razorpaySubscriptionId: {
      type: String,
      default: null,
      index: true,
    },
    razorpayCustomerId: {
      type: String,
      default: null,
    },
    currentPeriodStart: {
      type: Date,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// One active/created subscription per user at a time
subscriptionSchema.index({ userId: 1, status: 1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
