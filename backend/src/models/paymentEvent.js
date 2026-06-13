/**
 * PaymentEvent — append-only log of Razorpay webhook events (Phase 6).
 *
 * `razorpayEventId` has a unique sparse index so webhook redelivery is a
 * no-op (BillingEventHandler checks for an existing event before applying
 * any Subscription/User state change).
 */

import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const paymentEventSchema = new mongoose.Schema(
  {
    userId: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: ObjectId,
      ref: 'Subscription',
      default: null,
    },
    razorpayEventId: {
      type: String,
      unique: true,
      sparse: true,
    },
    type: {
      type: String,
      required: true, // raw Razorpay event name, e.g. 'subscription.charged'
    },
    amount: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

const PaymentEvent = mongoose.model('PaymentEvent', paymentEventSchema);

export default PaymentEvent;
