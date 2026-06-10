import { api } from '@/store/api';

const aiApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProfileFeedback: builder.mutation({
      query: () => ({ url: '/ai/profile-feedback', method: 'POST' }),
    }),
    getMatchInsight: builder.mutation({
      query: (userId) => ({ url: `/ai/match-insight/${userId}`, method: 'POST' }),
    }),
    // POST /ai/interview-prep itself streams via SSE and is sent with a raw
    // fetch (see hooks/ai/useInterviewPrepChat.js) — only history is an RTK
    // Query endpoint.
    getInterviewPrepHistory: builder.query({
      query: (page = 1) => `/ai/interview-prep/history?page=${page}`,
      providesTags: ['InterviewPrep'],
    }),
  }),
});

export const { useGetProfileFeedbackMutation, useGetMatchInsightMutation, useGetInterviewPrepHistoryQuery } = aiApi;
