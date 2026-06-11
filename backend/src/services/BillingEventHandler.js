/**
 * BillingEventHandler — applies Razorpay webhook events to Subscription /
 * User.isPremium (Phase 6 Task A3).
 *
 * This is the only code path allowed to write Subscription.status and
 * User.isPremium. Idempotency against webhook redelivery is handled by the
 * route (PaymentEvent.razorpayEventId dedupe before calling `handle`); state
 * updates here are themselves idempotent (re-applying the same event is
 * harmless), so a retry after a partial failure is safe.
 */

import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import PaymentEvent from '../models/paymentEvent.js';

const toDate = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000) : null);

export const BillingEventHandler = {
  async handle(payload, eventId) {
    const eventType = payload.event;
    const data = payload.payload || {};
    const subEntity = data.subscription?.entity;
    const paymentEntity = data.payment?.entity;

    const razorpaySubscriptionId = subEntity?.id || paymentEntity?.subscription_id || null;

    const subscription = razorpaySubscriptionId
      ? await Subscription.findOne({ razorpaySubscriptionId })
      : null;

    if (subscription) {
      switch (eventType) {
        case 'subscription.activated':
          subscription.status = 'active';
          subscription.currentPeriodStart = toDate(subEntity.current_start);
          subscription.currentPeriodEnd = toDate(subEntity.current_end);
          await subscription.save();
          await User.findByIdAndUpdate(subscription.userId, { isPremium: true });
          break;

        case 'subscription.charged':
          subscription.status = 'active';
          if (subEntity?.current_start) subscription.currentPeriodStart = toDate(subEntity.current_start);
          if (subEntity?.current_end) subscription.currentPeriodEnd = toDate(subEntity.current_end);
          await subscription.save();
          await User.findByIdAndUpdate(subscription.userId, { isPremium: true });
          break;

        case 'payment.failed':
          subscription.status = 'past_due';
          await subscription.save();
          // isPremium unchanged — grace period handled by requirePremium
          break;

        case 'subscription.cancelled':
          subscription.status = 'cancelled';
          await subscription.save();
          await User.findByIdAndUpdate(subscription.userId, { isPremium: false });
          break;

        case 'subscription.completed':
        case 'subscription.expired':
          subscription.status = 'expired';
          await subscription.save();
          await User.findByIdAndUpdate(subscription.userId, { isPremium: false });
          break;

        default:
          break; // unhandled event types are recorded but cause no state change
      }
    }

    const userId = subscription?.userId || subEntity?.notes?.userId || paymentEntity?.notes?.userId || null;

    // Without a resolvable userId we can't satisfy PaymentEvent's schema —
    // drop unrecognized events rather than fail the webhook (Razorpay treats
    // a non-2xx response as a delivery failure and retries indefinitely).
    if (!userId) return;

    await PaymentEvent.create({
      userId,
      subscriptionId: subscription?._id ?? null,
      razorpayEventId: eventId || undefined,
      type: eventType,
      amount: paymentEntity?.amount ?? null,
      currency: paymentEntity?.currency ?? 'INR',
      rawPayload: payload,
    });
  },
};
