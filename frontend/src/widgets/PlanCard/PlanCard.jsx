import Button from '@/components/Button/Button';
import './PlanCard.scss';

const FEATURE_LABELS = {
  dailySwipeLimit: (value) => (value == null ? 'Unlimited swipes' : `${value} swipes / day`),
  advancedFilters: 'Advanced search filters',
  priorityGroupCalls: 'Priority group calls',
  aiAssistant: 'AI developer assistant',
  groupCallParticipantCap: (value) => `Group calls up to ${value} people`,
};

const formatPrice = (price, currency) => {
  if (!price) return 'Free';
  const amount = (price / 100).toLocaleString('en-IN');
  return `₹${amount} / ${currency === 'INR' ? 'mo' : currency}`;
};

export default function PlanCard({ plan, isCurrent, onSubscribe, subscribing }) {
  const features = plan.features || {};

  return (
    <div className={`dc-plan-card ${plan.key === 'premium' ? 'dc-plan-card--premium' : ''}`}>
      {plan.key === 'premium' && <span className="dc-plan-card-badge">Premium</span>}

      <h2 className="dc-plan-card-name">{plan.name}</h2>
      <p className="dc-plan-card-price">{formatPrice(plan.price, plan.currency)}</p>

      <ul className="dc-plan-card-features">
        {Object.entries(FEATURE_LABELS).map(([key, label]) => {
          const value = features[key];
          if (value === false) return null;
          return (
            <li key={key} className="dc-plan-card-feature">
              {typeof label === 'function' ? label(value) : label}
            </li>
          );
        })}
      </ul>

      {isCurrent ? (
        <span className="dc-plan-card-current">Current plan</span>
      ) : plan.key === 'premium' ? (
        <Button onClick={() => onSubscribe(plan.key)} disabled={subscribing}>
          {subscribing ? 'Redirecting…' : 'Upgrade to Premium'}
        </Button>
      ) : null}
    </div>
  );
}
