import { api } from '@/store/api';

// Requests and Connections share this module because both deal with the
// connection-request lifecycle and invalidate the same cache tags.
const requestsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    sendRequest: builder.mutation({
      query: ({ status, toUserId }) => ({
        url: `/request/send/${status}/${toUserId}`,
        method: 'POST',
      }),
      invalidatesTags: ['Requests'],
    }),
    reviewRequest: builder.mutation({
      query: ({ status, requestId }) => ({
        url: `/request/review/${status}/${requestId}`,
        method: 'POST',
      }),
      invalidatesTags: ['Requests', 'Connections'],
    }),
    getPendingRequests: builder.query({
      query: () => '/request/pending',
      providesTags: ['Requests'],
    }),
    getSentRequests: builder.query({
      query: () => '/request/sent',
      providesTags: ['Requests'],
    }),
    getConnections: builder.query({
      query: () => '/request/connections',
      providesTags: ['Connections'],
    }),
  }),
});

export const {
  useSendRequestMutation,
  useReviewRequestMutation,
  useGetPendingRequestsQuery,
  useGetSentRequestsQuery,
  useGetConnectionsQuery,
} = requestsApi;
