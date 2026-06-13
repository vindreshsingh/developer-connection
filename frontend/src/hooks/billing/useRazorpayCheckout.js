import { useState } from 'react';
import { useCreateCheckoutMutation, useLazyGetSubscriptionQuery } from './billingApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';

// Loads the Razorpay Checkout script lazily (it's not bundled — see
// index.html for the deferred <script> tag) and opens the subscription
// checkout modal. The webhook is the source of truth for activation, so the
// `handler` callback just refetches our cached subscription state.
const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout.'));
    document.body.appendChild(script);
  });

export const useRazorpayCheckout = () => {
  const [createCheckout, { isLoading }] = useCreateCheckoutMutation();
  const [refetchSubscription] = useLazyGetSubscriptionQuery();
  const [error, setError] = useState(null);

  const subscribe = async (planKey) => {
    setError(null);
    try {
      await loadRazorpayScript();
      const { razorpayKeyId, razorpaySubscriptionId } = await createCheckout({ planKey }).unwrap();

      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        subscription_id: razorpaySubscriptionId,
        name: 'Developer Connection — Premium',
        description: 'Premium subscription',
        handler: () => refetchSubscription(),
        theme: { color: '#9333ea' },
      });
      rzp.open();
    } catch (err) {
      setError(err?.message || getApiErrorMessage(err, 'Could not start checkout'));
    }
  };

  return { subscribe, isLoading, error };
};
