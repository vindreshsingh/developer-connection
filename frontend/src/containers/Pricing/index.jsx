import { useGetPlansQuery, useGetSubscriptionQuery } from '@/hooks/billing/billingApi';
import { useRazorpayCheckout } from '@/hooks/billing/useRazorpayCheckout';
import PlanCard from '@/widgets/PlanCard/PlanCard';
import { parsePlans, parseCurrentPlanKey, parsePlansError } from './parser';
import './Pricing.scss';

export default function PricingContainer() {
  const { data: plansData, isFetching, error } = useGetPlansQuery();
  const { data: subscriptionData } = useGetSubscriptionQuery();
  const { subscribe, isLoading: subscribing, error: checkoutError } = useRazorpayCheckout();

  const plans = parsePlans(plansData);
  const currentPlanKey = parseCurrentPlanKey(subscriptionData);

  return (
    <div className="dc-pricing">
      <h1 className="dc-pricing-heading">Plans &amp; Pricing</h1>
      <p className="dc-pricing-subheading">
        Upgrade to Premium for unlimited swipes, advanced filters, bigger group calls, and the AI developer assistant.
      </p>

      {error && <p className="dc-pricing-error">{parsePlansError(error)}</p>}
      {checkoutError && <p className="dc-pricing-error">{checkoutError}</p>}

      {isFetching ? (
        <p className="dc-pricing-loading">Loading plans…</p>
      ) : (
        <div className="dc-pricing-grid">
          {plans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              isCurrent={plan.key === currentPlanKey}
              onSubscribe={subscribe}
              subscribing={subscribing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
