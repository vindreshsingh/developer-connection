import Razorpay from 'razorpay';

let client;

const getClient = () => {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
};

// Creates a Razorpay subscription for the premium plan. It is not yet linked
// to a customer — Razorpay links it automatically once the user completes
// the authorization payment via Checkout.js. The userId is stamped into
// `notes` so the webhook handler (which fires before we have a
// razorpayCustomerId) can find the right Subscription document.
export const createPremiumSubscription = async (userId) =>
  getClient().subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID,
    customer_notify: 1,
    total_count: 12,
    notes: { userId: userId.toString() },
  });

// cancel_at_cycle_end = true: access continues until currentPeriodEnd.
export const cancelRazorpaySubscription = async (subscriptionId) =>
  getClient().subscriptions.cancel(subscriptionId, true);

export const verifyWebhookSignature = (rawBody, signature) =>
  Razorpay.validateWebhookSignature(rawBody.toString('utf8'), signature || '', process.env.RAZORPAY_WEBHOOK_SECRET);
