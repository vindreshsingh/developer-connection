import { api } from '@/store/api';

const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({ url: '/auth/login', method: 'POST', body: credentials }),
      invalidatesTags: ['Profile'],
    }),
    signup: builder.mutation({
      query: (data) => ({ url: '/auth/signup', method: 'POST', body: data }),
    }),
    verifyEmail: builder.mutation({
      query: (token) => ({ url: `/auth/verify-email/${token}`, method: 'GET' }),
    }),
    resendVerification: builder.mutation({
      query: (email) => ({ url: '/auth/resend-verification', method: 'POST', body: { email } }),
    }),
    logout: builder.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Profile', 'Feed', 'Requests', 'Connections'],
    }),
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useLogoutMutation,
} = authApi;
