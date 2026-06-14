import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import {
  useGetSubscriptionQuery,
  useCancelSubscriptionMutation,
  useGetBillingHistoryQuery,
} from '@/hooks/billing/billingApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';

const STATUS_LABELS = {
  created: 'Pending',
  active: 'Active',
  past_due: 'Payment failed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export default function BillingPanel() {
  const { data, isLoading } = useGetSubscriptionQuery();
  const { data: historyData } = useGetBillingHistoryQuery(1);
  const [cancelSubscription, { isLoading: cancelling, error }] = useCancelSubscriptionMutation();

  if (isLoading) return null;

  const plan = data?.data?.plan;
  const subscription = data?.data?.subscription;
  const history = historyData?.data || [];

  const handleCancel = () => {
    if (!window.confirm('Cancel your Premium subscription? You will keep access until the end of the current billing period.')) return;
    cancelSubscription();
  };

  return (
    <section className="mt-8 border-t border-gray-200 pt-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Billing</h2>

      {error && <p className="mb-3 text-[0.8125rem] text-red-500">{getApiErrorMessage(error, 'Could not cancel subscription')}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="mr-2.5 text-base font-bold text-gray-900">{plan?.name ?? 'Free'}</span>
          {subscription && (
            <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
              {STATUS_LABELS[subscription.status] ?? subscription.status}
            </span>
          )}
        </div>

        {plan?.key !== 'premium' ? (
          <Link to="/pricing">
            <Button>Upgrade to Premium</Button>
          </Link>
        ) : subscription?.status === 'active' && !subscription.cancelAtPeriodEnd ? (
          <Button variant="outline" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel subscription'}
          </Button>
        ) : null}
      </div>

      {subscription?.cancelAtPeriodEnd && subscription?.currentPeriodEnd && (
        <p className="mt-3 text-[0.8125rem] text-gray-500">
          Your subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Recent payments</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {history.map((event) => (
              <li key={event._id} className="flex justify-between rounded-md bg-[#fafafa] px-3 py-2 text-[0.8125rem] text-gray-500">
                <span>{event.type}</span>
                <span>{event.amount != null ? `₹${(event.amount / 100).toLocaleString('en-IN')}` : '—'}</span>
                <span>{new Date(event.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
