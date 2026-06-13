import { api } from '@/store/api';

const aiApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // GET /ai/recommendations — cached AI match suggestions (24h TTL server-side)
    getRecommendations: builder.query({
      query: () => '/ai/recommendations',
      providesTags: ['Recommendations'],
    }),

    // POST /ai/recommendations/:userId/dismiss — hide a suggestion for 14 days
    dismissRecommendation: builder.mutation({
      query: (userId) => ({ url: `/ai/recommendations/${userId}/dismiss`, method: 'POST' }),
      invalidatesTags: ['Recommendations'],
    }),

    // POST /ai/resume-feedback — multipart PDF upload
    submitResume: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('resume', file);
        return { url: '/ai/resume-feedback', method: 'POST', body: formData };
      },
      invalidatesTags: ['ResumeFeedback'],
    }),

    // GET /ai/resume-feedback — paginated history
    getResumeFeedbackHistory: builder.query({
      query: (page = 1) => `/ai/resume-feedback?page=${page}`,
      providesTags: ['ResumeFeedback'],
    }),

    // POST /ai/interview/start — { focusArea? } -> { sessionId, question }
    startInterview: builder.mutation({
      query: (body) => ({ url: '/ai/interview/start', method: 'POST', body }),
      invalidatesTags: ['InterviewSessions'],
    }),

    // POST /ai/interview/:sessionId/respond — { answer } -> { feedback, nextQuestion, status }
    respondToInterview: builder.mutation({
      query: ({ sessionId, answer }) => ({
        url: `/ai/interview/${sessionId}/respond`,
        method: 'POST',
        body: { answer },
      }),
    }),

    // POST /ai/interview/:sessionId/end
    endInterview: builder.mutation({
      query: (sessionId) => ({ url: `/ai/interview/${sessionId}/end`, method: 'POST' }),
      invalidatesTags: ['InterviewSessions'],
    }),

    // GET /ai/interview — paginated session summaries
    getInterviewSessions: builder.query({
      query: (page = 1) => `/ai/interview?page=${page}`,
      providesTags: ['InterviewSessions'],
    }),

    // GET /ai/interview/:sessionId — full transcript
    getInterviewSession: builder.query({
      query: (sessionId) => `/ai/interview/${sessionId}`,
    }),
  }),
});

export const {
  useGetRecommendationsQuery,
  useDismissRecommendationMutation,
  useSubmitResumeMutation,
  useGetResumeFeedbackHistoryQuery,
  useStartInterviewMutation,
  useRespondToInterviewMutation,
  useEndInterviewMutation,
  useGetInterviewSessionsQuery,
  useGetInterviewSessionQuery,
} = aiApi;
