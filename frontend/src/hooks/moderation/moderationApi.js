import { api } from '@/store/api';

const moderationApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBlockedUsers: builder.query({
      query: () => '/request/blocked',
      providesTags: ['BlockedUsers'],
    }),
    blockUser: builder.mutation({
      query: (userId) => ({ url: `/request/block/${userId}`, method: 'POST' }),
      invalidatesTags: ['Feed', 'Requests', 'Connections', 'BlockedUsers'],
    }),
    unblockUser: builder.mutation({
      query: (userId) => ({ url: `/request/block/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['Feed', 'Requests', 'Connections', 'BlockedUsers'],
    }),
    reportUser: builder.mutation({
      query: ({ userId, reason }) => ({
        url: `/request/report/${userId}`,
        method: 'POST',
        body: { reason },
      }),
    }),
  }),
});

export const {
  useGetBlockedUsersQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
  useReportUserMutation,
} = moderationApi;
