import { useGetPlansQuery, useGetSubscriptionQuery } from '@/hooks/billing/billingApi';
import { useRazorpayCheckout } from '@/hooks/billing/useRazorpayCheckout';
import PlanCard from '@/widgets/PlanCard/PlanCard';
import { parsePlans, parseCurrentPlanKey, parsePlansError } from './parser';

export default function PricingContainer() {
  const { data: plansData, isFetching, error } = useGetPlansQuery();
  const { data: subscriptionData } = useGetSubscriptionQuery();
  const { subscribe, isLoading: subscribing, error: checkoutError } = useRazorpayCheckout();

  const plans = parsePlans(plansData);
  const currentPlanKey = parseCurrentPlanKey(subscriptionData);

  return (
    <div className="mx-auto max-w-[48rem] px-3 py-5 text-center sm:px-4 sm:py-8">
      <h1 className="text-[1.75rem] font-extrabold text-gray-900 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards]">Plans &amp; Pricing</h1>
      <p className="mt-2 mb-8 text-[0.95rem] text-gray-500">
        Upgrade to Premium for unlimited swipes, advanced filters, bigger group calls, and the AI developer assistant.
      </p>

      {error && <p className="mb-4 text-sm text-red-500">{parsePlansError(error)}</p>}
      {checkoutError && <p className="mb-4 text-sm text-red-500">{checkoutError}</p>}

      {isFetching ? (
        <p className="text-sm text-gray-400">Loading plans…</p>
      ) : (
        <div className="grid gap-5 text-left [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
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
