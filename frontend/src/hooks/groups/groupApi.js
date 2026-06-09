import { api } from '@/store/api';

const groupApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // GET /groups?tags=react,typescript&page=1
    listGroups: builder.query({
      query: ({ tags = '', page = 1 } = {}) => {
        const params = new URLSearchParams({ page });
        if (tags) params.set('tags', tags);
        return `/groups?${params}`;
      },
      providesTags: ['Groups'],
    }),

    // GET /groups/:id
    getGroup: builder.query({
      query: (groupId) => `/groups/${groupId}`,
      providesTags: (result, error, groupId) => [{ type: 'Groups', id: groupId }],
    }),

    // POST /groups
    createGroup: builder.mutation({
      query: (body) => ({ url: '/groups', method: 'POST', body }),
      invalidatesTags: ['Groups'],
    }),

    // POST /groups/:id/join
    joinGroup: builder.mutation({
      query: (groupId) => ({ url: `/groups/${groupId}/join`, method: 'POST' }),
      invalidatesTags: (result, error, groupId) => ['Groups', { type: 'Groups', id: groupId }],
    }),

    // DELETE /groups/:id/leave
    leaveGroup: builder.mutation({
      query: (groupId) => ({ url: `/groups/${groupId}/leave`, method: 'DELETE' }),
      invalidatesTags: (result, error, groupId) => ['Groups', { type: 'Groups', id: groupId }],
    }),

    // GET /groups/:id/messages?before=<ISO>
    getGroupMessages: builder.query({
      query: ({ groupId, before }) => {
        const params = before ? `?before=${encodeURIComponent(before)}` : '';
        return `/groups/${groupId}/messages${params}`;
      },
      providesTags: (result, error, { groupId }) => [{ type: 'GroupMessages', id: groupId }],
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}-${queryArgs?.groupId}`,
      merge: (currentCache, newItems, { arg }) => {
        // Older page prepended to the front (before-cursor pagination)
        if (!arg?.before) return newItems;
        return { ...newItems, messages: [...newItems.messages, ...currentCache.messages] };
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.before !== previousArg?.before,
    }),
  }),
});

export const {
  useListGroupsQuery,
  useGetGroupQuery,
  useCreateGroupMutation,
  useJoinGroupMutation,
  useLeaveGroupMutation,
  useGetGroupMessagesQuery,
} = groupApi;
