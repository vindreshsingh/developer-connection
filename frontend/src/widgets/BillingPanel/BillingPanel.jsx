import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import {
  useGetSubscriptionQuery,
  useCancelSubscriptionMutation,
  useGetBillingHistoryQuery,
} from '@/hooks/billing/billingApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import './BillingPanel.scss';

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
    <section className="dc-billing-panel">
      <h2 className="dc-billing-panel-heading">Billing</h2>

      {error && <p className="dc-billing-panel-error">{getApiErrorMessage(error, 'Could not cancel subscription')}</p>}

      <div className="dc-billing-panel-plan">
        <div>
          <span className="dc-billing-panel-plan-name">{plan?.name ?? 'Free'}</span>
          {subscription && (
            <span className="dc-billing-panel-status">
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
        <p className="dc-billing-panel-note">
          Your subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
        </p>
      )}

      {history.length > 0 && (
        <div className="dc-billing-panel-history">
          <h3 className="dc-billing-panel-history-heading">Recent payments</h3>
          <ul className="dc-billing-panel-history-list">
            {history.map((event) => (
              <li key={event._id} className="dc-billing-panel-history-item">
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
