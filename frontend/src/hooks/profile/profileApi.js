import { api } from '@/store/api';

const profileApi = api.injectEndpoints({
  endpoints: (builder) => ({
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
  }),
});

export const {
  useGetMyProfileQuery,
  useUpdateProfileMutation,
  useUploadProfilePhotoMutation,
  useUploadCoverImageMutation,
  useGetUserProfileQuery,
} = profileApi;
