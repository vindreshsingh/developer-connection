import { api } from '@/store/api';

const notificationApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // GET /notifications?page=1
    getNotifications: builder.query({
      query: ({ page = 1 } = {}) => `/notifications?page=${page}`,
      providesTags: ['Notifications'],
    }),

    // GET /notifications/unread-count
    getUnreadNotificationCount: builder.query({
      query: () => '/notifications/unread-count',
      providesTags: ['Notifications'],
    }),

    // PATCH /notifications/:id/read
    markNotificationRead: builder.mutation({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),

    // PATCH /notifications/read-all
    markAllNotificationsRead: builder.mutation({
      query: () => ({ url: '/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationApi;
