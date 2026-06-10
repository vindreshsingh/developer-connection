import Subscription from '../models/subscription.js';

// Single source of truth for premium gating (Phase 6 RFC). Users without a
// Subscription document — i.e. everyone before they ever subscribe — are
// 'free'. A 'premium' plan only counts while status is 'active'; lapsed,
// past-due, or cancelled subscriptions fall back to 'free'.
export const getSubscriptionPlan = async (userId) => {
  const subscription = await Subscription.findOne({ userId });
  if (!subscription) return 'free';
  return subscription.plan === 'premium' && subscription.status === 'active' ? 'premium' : 'free';
};
