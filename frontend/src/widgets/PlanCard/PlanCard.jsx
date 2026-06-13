import Button from '@/components/Button/Button';
import { classNames } from '@/commonUtils/classNames';

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
    <div
      className={classNames(
        'relative flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[transform,box-shadow] duration-200 ease hover:-translate-y-[3px] hover:shadow-[0_12px_24px_-12px_rgba(147,51,234,0.35)]',
        plan.key === 'premium' && 'border-purple-600 bg-gradient-to-b from-purple-600/5 to-white',
      )}
    >
      {plan.key === 'premium' && (
        <span className="absolute -top-[0.65rem] right-4 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.05em] text-white">
          Premium
        </span>
      )}

      <h2 className="text-[1.1rem] font-bold text-gray-900">{plan.name}</h2>
      <p className="text-2xl font-extrabold text-gray-900">{formatPrice(plan.price, plan.currency)}</p>

      <ul className="m-0 flex flex-1 flex-col gap-[0.4rem] p-0 list-none">
        {Object.entries(FEATURE_LABELS).map(([key, label]) => {
          const value = features[key];
          if (value === false) return null;
          return (
            <li key={key} className="relative pl-5 text-sm text-gray-600 before:absolute before:left-0 before:font-bold before:text-purple-600 before:content-['✓']">
              {typeof label === 'function' ? label(value) : label}
            </li>
          );
        })}
      </ul>

      {isCurrent ? (
        <span className="rounded-lg border border-dashed border-gray-300 p-2 text-center text-sm font-semibold text-gray-500">Current plan</span>
      ) : plan.key === 'premium' ? (
        <Button onClick={() => onSubscribe(plan.key)} disabled={subscribing}>
          {subscribing ? 'Redirecting…' : 'Upgrade to Premium'}
        </Button>
      ) : null}
    </div>
  );
}
