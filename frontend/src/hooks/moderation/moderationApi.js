import { api } from '@/store/api';

const moderationApi = api.injectEndpoints({
  endpoints: (builder) => ({
    blockUser: builder.mutation({
      query: (userId) => ({ url: `/request/block/${userId}`, method: 'POST' }),
      invalidatesTags: ['Feed', 'Requests', 'Connections'],
    }),
    unblockUser: builder.mutation({
      query: (userId) => ({ url: `/request/block/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['Feed', 'Requests', 'Connections'],
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

export const { useBlockUserMutation, useUnblockUserMutation, useReportUserMutation } = moderationApi;
