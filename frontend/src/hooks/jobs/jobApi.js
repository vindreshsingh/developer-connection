import { api } from '@/store/api';

const jobApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // GET /jobs?type=&skills=&page=1
    getJobs: builder.query({
      query: ({ type, skills, page = 1 } = {}) => {
        const params = new URLSearchParams({ page });
        if (type) params.set('type', type);
        if (skills) params.set('skills', skills);
        return `/jobs?${params.toString()}`;
      },
      providesTags: (result) => [
        ...(result?.data ?? []).map((job) => ({ type: 'Jobs', id: job._id })),
        { type: 'Jobs', id: 'LIST' },
      ],
    }),

    // GET /jobs/:jobId
    getJob: builder.query({
      query: (jobId) => `/jobs/${jobId}`,
      providesTags: (result, error, jobId) => [{ type: 'Jobs', id: jobId }],
    }),

    // POST /jobs
    createJob: builder.mutation({
      query: (body) => ({ url: '/jobs', method: 'POST', body }),
      invalidatesTags: [{ type: 'Jobs', id: 'LIST' }],
    }),

    // PATCH /jobs/:jobId
    updateJob: builder.mutation({
      query: ({ jobId, ...body }) => ({ url: `/jobs/${jobId}`, method: 'PATCH', body }),
      invalidatesTags: (result, error, { jobId }) => [
        { type: 'Jobs', id: jobId }, { type: 'Jobs', id: 'LIST' },
      ],
    }),

    // DELETE /jobs/:jobId
    deleteJob: builder.mutation({
      query: (jobId) => ({ url: `/jobs/${jobId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Jobs', id: 'LIST' }],
    }),

    // POST /jobs/:jobId/apply
    applyToJob: builder.mutation({
      query: ({ jobId, coverNote }) => ({ url: `/jobs/${jobId}/apply`, method: 'POST', body: { coverNote } }),
      invalidatesTags: (result, error, { jobId }) => [
        { type: 'Jobs', id: jobId }, { type: 'JobApplications', id: 'MINE' },
      ],
    }),

    // GET /jobs/applications/mine?page=1
    getMyApplications: builder.query({
      query: ({ page = 1 } = {}) => `/jobs/applications/mine?page=${page}`,
      providesTags: [{ type: 'JobApplications', id: 'MINE' }],
    }),

    // GET /jobs/:jobId/applications?page=1
    getJobApplications: builder.query({
      query: ({ jobId, page = 1 }) => `/jobs/${jobId}/applications?page=${page}`,
      providesTags: (result, error, { jobId }) => [{ type: 'JobApplications', id: jobId }],
    }),

    // PATCH /jobs/:jobId/applications/:applicationId
    updateApplicationStatus: builder.mutation({
      query: ({ jobId, applicationId, status }) => ({
        url: `/jobs/${jobId}/applications/${applicationId}`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: (result, error, { jobId }) => [
        { type: 'JobApplications', id: jobId }, { type: 'Jobs', id: jobId },
      ],
    }),
  }),
});

export const {
  useGetJobsQuery,
  useGetJobQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useDeleteJobMutation,
  useApplyToJobMutation,
  useGetMyApplicationsQuery,
  useGetJobApplicationsQuery,
  useUpdateApplicationStatusMutation,
} = jobApi;
