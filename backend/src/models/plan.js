/**
 * Plan — billing plan catalog (Phase 6).
 *
 * Seeded via `src/scripts/seedPlans.js`. Gating logic (requirePremium, feed
 * swipe limits, group call caps) reads `features` off the user's active
 * Plan rather than hardcoding limits in route handlers.
 */

import mongoose from 'mongoose';

const featuresSchema = new mongoose.Schema(
  {
    dailySwipeLimit: { type: Number, default: null }, // null = unlimited
    advancedFilters: { type: Boolean, default: false },
    priorityGroupCalls: { type: Boolean, default: false },
    aiAssistant: { type: Boolean, default: false },
    groupCallParticipantCap: { type: Number, default: 8 },
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ['free', 'premium'],
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number, // smallest currency unit (paise)
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    interval: {
      type: String,
      enum: ['month'],
      default: 'month',
    },
    razorpayPlanId: {
      type: String,
      default: null, // null for the 'free' plan
    },
    features: {
      type: featuresSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Plan = mongoose.model('Plan', planSchema);

export default Plan;
