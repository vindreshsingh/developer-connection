/**
 * PaymentService — thin wrapper around the Razorpay SDK (Phase 6).
 *
 * Every route that needs to talk to Razorpay goes through this module so
 * the SDK client and webhook signature verification live in one place.
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayClient = null;

// Lazily constructed so tests can run without RAZORPAY_* env vars set, and
// so a missing key surfaces as a clear error only when checkout is actually
// attempted (not at module-load time).
const getClient = () => {
  if (!razorpayClient) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)');
    }
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
};

export const PaymentService = {
  /**
   * Creates a Razorpay customer (reusing one for the same email if it
   * already exists) and a recurring subscription against the given plan.
   */
  async createSubscription({ user, plan }) {
    const client = getClient();

    const customer = await client.customers.create({
      name: `${user.firstName} ${user.lastName ?? ''}`.trim(),
      email: user.email ?? undefined,
      fail_existing: 0,
    });

    const rzpSubscription = await client.subscriptions.create({
      plan_id: plan.razorpayPlanId,
      customer_notify: 1,
      total_count: 120, // ~10 years of monthly cycles; effectively "until cancelled"
      notes: { userId: user._id.toString() },
    });

    return {
      razorpaySubscriptionId: rzpSubscription.id,
      razorpayCustomerId: customer.id,
    };
  },

  async cancelSubscription(razorpaySubscriptionId) {
    const client = getClient();
    return client.subscriptions.cancel(razorpaySubscriptionId, { cancel_at_cycle_end: 1 });
  },

  /**
   * Verifies the `X-Razorpay-Signature` header against the raw request body
   * using HMAC-SHA256 with RAZORPAY_WEBHOOK_SECRET, per Razorpay's webhook
   * docs. `rawBody` must be the exact bytes Razorpay signed (a Buffer or
   * string), not a re-serialized JSON object.
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) return false;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    return expected === signature;
  },
};
