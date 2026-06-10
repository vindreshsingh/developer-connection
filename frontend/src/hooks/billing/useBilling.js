import { useGetBillingStatusQuery, useCreateCheckoutMutation, useCancelSubscriptionMutation } from './billingApi';

export const useBilling = () => {
  const { data: status, isLoading, refetch } = useGetBillingStatusQuery();
  const [createCheckout, { isLoading: startingCheckout }] = useCreateCheckoutMutation();
  const [cancelSubscription, { isLoading: cancelling }] = useCancelSubscriptionMutation();

  return { status, isLoading, refetch, createCheckout, startingCheckout, cancelSubscription, cancelling };
};
