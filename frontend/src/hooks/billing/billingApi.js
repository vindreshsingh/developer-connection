import { api } from '@/store/api';

const billingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // GET /billing/plans — public plan catalog
    getPlans: builder.query({
      query: () => '/billing/plans',
    }),

    // GET /billing/subscription — current user's plan + subscription
    getSubscription: builder.query({
      query: () => '/billing/subscription',
      providesTags: ['Subscriptions'],
    }),

    // POST /billing/checkout — create a Razorpay subscription
    createCheckout: builder.mutation({
      query: (body) => ({ url: '/billing/checkout', method: 'POST', body }),
    }),

    // POST /billing/cancel — cancel at period end
    cancelSubscription: builder.mutation({
      query: () => ({ url: '/billing/cancel', method: 'POST' }),
      invalidatesTags: ['Subscriptions'],
    }),

    // GET /billing/history — paginated payment events
    getBillingHistory: builder.query({
      query: (page = 1) => `/billing/history?page=${page}`,
    }),
  }),
});

export const {
  useGetPlansQuery,
  useGetSubscriptionQuery,
  useCreateCheckoutMutation,
  useCancelSubscriptionMutation,
  useLazyGetSubscriptionQuery,
  useGetBillingHistoryQuery,
} = billingApi;
