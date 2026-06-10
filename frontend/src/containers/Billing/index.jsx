import { useState } from 'react';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useBilling } from '@/hooks/billing/useBilling';
import { loadRazorpayScript } from '@/commonUtils/loadRazorpayScript';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import { formatMonthYear } from '@/commonUtils/formatDate';
import Button from '@/components/Button/Button';
import Tag from '@/components/Tag/Tag';
import Spinner from '@/components/Spinner/Spinner';
import StatusMessage from '@/components/StatusMessage/StatusMessage';
import './Billing.scss';

export default function BillingContainer() {
  const { user } = useCurrentUser();
  const { status, isLoading, refetch, createCheckout, startingCheckout, cancelSubscription, cancelling } =
    useBilling();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleUpgrade = async () => {
    setError('');
    setMessage('');

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError('Could not load the payment provider. Please try again.');
      return;
    }

    const result = await createCheckout();
    if (result.error) {
      setError(getApiErrorMessage(result.error, 'Could not start checkout.'));
      return;
    }

    const { subscriptionId, keyId } = result.data.data;

    const checkout = new window.Razorpay({
      key: keyId,
      subscription_id: subscriptionId,
      name: 'DevConnect Premium',
      description: 'Monthly premium subscription',
      prefill: {
        email: user?.email,
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
      },
      theme: { color: '#9333ea' },
      handler: () => {
        setMessage('Payment received! Your premium plan will activate shortly.');
        refetch();
      },
    });

    checkout.open();
  };

  const handleCancel = async () => {
    setError('');
    setMessage('');

    const result = await cancelSubscription();
    if (result.error) {
      setError(getApiErrorMessage(result.error, 'Could not cancel your subscription.'));
      return;
    }

    setMessage('Your subscription will end at the close of the current billing period.');
  };

  if (isLoading) return <Spinner />;

  const isPremium = status?.plan === 'premium' && status?.status === 'active';

  return (
    <div className="dc-billing">
      <h1 className="dc-billing-heading">Billing</h1>

      <div className="dc-billing-card">
        <div className="dc-billing-plan">
          <span>Current plan</span>
          <Tag className={isPremium ? 'dc-tag--premium' : ''}>{isPremium ? 'Premium' : 'Free'}</Tag>
        </div>

        {isPremium && status?.currentPeriodEnd && (
          <p className="dc-billing-detail">
            {status.cancelAtPeriodEnd
              ? `Your subscription will end on ${formatMonthYear(status.currentPeriodEnd)}.`
              : `Renews on ${formatMonthYear(status.currentPeriodEnd)}.`}
          </p>
        )}

        <StatusMessage variant="success">{message}</StatusMessage>
        <StatusMessage variant="error">{error}</StatusMessage>

        {isPremium ? (
          !status.cancelAtPeriodEnd && (
            <Button variant="outline" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Cancel subscription'}
            </Button>
          )
        ) : (
          <Button onClick={handleUpgrade} disabled={startingCheckout}>
            {startingCheckout ? 'Starting checkout...' : 'Upgrade to Premium — ₹100/month'}
          </Button>
        )}
      </div>

      <div className="dc-billing-perks">
        <h2 className="dc-billing-perks-heading">Premium perks</h2>
        <ul className="dc-billing-perks-list">
          <li>Unlimited daily connection requests</li>
          <li>25 AI assistant calls/day per feature (vs. 3/day on the free plan)</li>
        </ul>
      </div>
    </div>
  );
}
