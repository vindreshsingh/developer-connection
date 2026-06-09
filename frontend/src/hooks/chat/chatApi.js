import { api } from '@/store/api';

const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getConversations: builder.query({
      query: () => '/chat/conversations',
      providesTags: ['Conversations'],
    }),
    getOrCreateConversation: builder.mutation({
      query: (userId) => ({ url: `/chat/conversations/${userId}`, method: 'POST' }),
      invalidatesTags: ['Conversations'],
    }),
    getMessageHistory: builder.query({
      query: ({ conversationId, page = 1 }) => `/chat/conversations/${conversationId}/messages?page=${page}`,
      providesTags: (result, error, { conversationId }) => [{ type: 'Messages', id: conversationId }],
      // Accumulate older pages into the cached list, oldest-first (mirrors feedApi's pagination merge)
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}-${queryArgs?.conversationId}`,
      merge: (currentCache, newItems, { arg }) => {
        if (!arg || arg.page <= 1) return newItems;
        return { ...newItems, data: [...newItems.data, ...currentCache.data] };
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
    }),
    markConversationRead: builder.mutation({
      query: (conversationId) => ({ url: `/chat/conversations/${conversationId}/read`, method: 'POST' }),
      invalidatesTags: ['Conversations'],
    }),
  }),
});

export const {
  useGetConversationsQuery,
  useGetOrCreateConversationMutation,
  useGetMessageHistoryQuery,
  useMarkConversationReadMutation,
} = chatApi;
