import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Profile', 'Feed', 'Requests', 'Connections'],
  endpoints: (builder) => ({
    // --- Auth ---
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

    // --- Profile ---
    getMyProfile: builder.query({
      query: () => '/profile',
      providesTags: ['Profile'],
    }),
    updateProfile: builder.mutation({
      query: (body) => ({ url: '/profile', method: 'PATCH', body }),
      invalidatesTags: ['Profile'],
    }),
    uploadProfilePhoto: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return { url: '/profile/photo', method: 'POST', body: formData };
      },
      invalidatesTags: ['Profile'],
    }),
    uploadCoverImage: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return { url: '/profile/cover', method: 'POST', body: formData };
      },
      invalidatesTags: ['Profile'],
    }),
    getUserProfile: builder.query({
      query: (userId) => `/profile/${userId}`,
    }),
    getFeed: builder.query({
      query: (page = 1) => `/profile/feed?page=${page}`,
      providesTags: ['Feed'],
      // merge subsequent pages into one cached list, keyed by the base arg (ignore page)
      serializeQueryArgs: ({ endpointName }) => endpointName,
      merge: (currentCache, newItems, { arg }) => {
        if (arg === 1) return newItems;
        return { ...newItems, data: [...currentCache.data, ...newItems.data] };
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg !== previousArg,
    }),

    // --- Connection requests ---
    sendRequest: builder.mutation({
      query: ({ status, toUserId }) => ({ url: `/request/send/${status}/${toUserId}`, method: 'POST' }),
      invalidatesTags: ['Requests'],
    }),
    reviewRequest: builder.mutation({
      query: ({ status, requestId }) => ({ url: `/request/review/${status}/${requestId}`, method: 'POST' }),
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
  useLoginMutation,
  useSignupMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useLogoutMutation,
  useGetMyProfileQuery,
  useUpdateProfileMutation,
  useUploadProfilePhotoMutation,
  useUploadCoverImageMutation,
  useGetUserProfileQuery,
  useGetFeedQuery,
  useSendRequestMutation,
  useReviewRequestMutation,
  useGetPendingRequestsQuery,
  useGetSentRequestsQuery,
  useGetConnectionsQuery,
} = api;
