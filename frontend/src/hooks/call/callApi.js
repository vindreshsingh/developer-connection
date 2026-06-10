import { api } from '@/store/api';

const callApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // POST /calls — initiate a 1:1 or group call
    initiateCall: builder.mutation({
      query: (body) => ({ url: '/calls', method: 'POST', body }),
      invalidatesTags: ['Calls'],
    }),

    // POST /calls/:callId/accept
    acceptCall: builder.mutation({
      query: (callId) => ({ url: `/calls/${callId}/accept`, method: 'POST' }),
      invalidatesTags: ['Calls'],
    }),

    // POST /calls/:callId/decline
    declineCall: builder.mutation({
      query: (callId) => ({ url: `/calls/${callId}/decline`, method: 'POST' }),
      invalidatesTags: ['Calls'],
    }),

    // POST /calls/:callId/end
    endCall: builder.mutation({
      query: (callId) => ({ url: `/calls/${callId}/end`, method: 'POST' }),
      invalidatesTags: ['Calls'],
    }),

    // GET /calls — paginated call history
    getCallHistory: builder.query({
      query: (page = 1) => `/calls?page=${page}`,
      providesTags: ['Calls'],
    }),

    // GET /calls/:callId
    getCall: builder.query({
      query: (callId) => `/calls/${callId}`,
      providesTags: (result, error, callId) => [{ type: 'Calls', id: callId }],
    }),

    // POST /calls/group-token — get a LiveKit JWT for a group call room
    getGroupToken: builder.mutation({
      query: (callId) => ({ url: '/calls/group-token', method: 'POST', body: { callId } }),
    }),
  }),
});

export const {
  useInitiateCallMutation,
  useAcceptCallMutation,
  useDeclineCallMutation,
  useEndCallMutation,
  useGetCallHistoryQuery,
  useGetCallQuery,
  useGetGroupTokenMutation,
} = callApi;
