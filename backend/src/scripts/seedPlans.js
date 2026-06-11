/**
 * Seeds (or updates) the 'free' and 'premium' Plan documents.
 *
 * Idempotent — safe to re-run on every deploy. Run with:
 *   node src/scripts/seedPlans.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';
import Plan from '../models/plan.js';

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    currency: 'INR',
    interval: 'month',
    razorpayPlanId: null,
    features: {
      dailySwipeLimit: 20,
      advancedFilters: false,
      priorityGroupCalls: false,
      aiAssistant: false,
      groupCallParticipantCap: 8,
    },
    isActive: true,
  },
  {
    key: 'premium',
    name: 'Premium',
    price: 10000, // ₹100.00
    currency: 'INR',
    interval: 'month',
    razorpayPlanId: process.env.RAZORPAY_PREMIUM_PLAN_ID || null,
    features: {
      dailySwipeLimit: null,
      advancedFilters: true,
      priorityGroupCalls: true,
      aiAssistant: true,
      groupCallParticipantCap: 25,
    },
    isActive: true,
  },
];

export const seedPlans = async () => {
  for (const plan of PLANS) {
    await Plan.findOneAndUpdate({ key: plan.key }, plan, {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    });
  }
};

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  connectDB()
    .then(seedPlans)
    .then(() => {
      console.log('Plans seeded successfully');
      return mongoose.connection.close();
    })
    .catch((err) => {
      console.error('Failed to seed plans:', err);
      process.exit(1);
    });
}
