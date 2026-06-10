import { api } from '@/store/api';

const billingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBillingStatus: builder.query({
      query: () => '/billing/status',
      providesTags: ['Billing'],
    }),
    createCheckout: builder.mutation({
      query: () => ({ url: '/billing/checkout', method: 'POST' }),
    }),
    cancelSubscription: builder.mutation({
      query: () => ({ url: '/billing/cancel', method: 'POST' }),
      invalidatesTags: ['Billing'],
    }),
  }),
});

export const { useGetBillingStatusQuery, useCreateCheckoutMutation, useCancelSubscriptionMutation } = billingApi;
