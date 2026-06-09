import { api } from '@/store/api';

const feedApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFeed: builder.query({
      query: ({ page = 1, skills = '' } = {}) =>
        `/profile/feed?page=${page}${skills ? `&skills=${encodeURIComponent(skills)}` : ''}`,
      providesTags: ['Feed'],
      // Merge subsequent pages into one cached list, keyed by the active
      // skills filter (changing the filter starts a fresh cached list;
      // paginating within the same filter accumulates into it).
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}-${queryArgs?.skills || ''}`,
      merge: (currentCache, newItems, { arg }) => {
        if (!arg || arg.page <= 1) return newItems;
        return { ...newItems, data: [...currentCache.data, ...newItems.data] };
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.page !== previousArg?.page || currentArg?.skills !== previousArg?.skills,
    }),
  }),
});

export const { useGetFeedQuery } = feedApi;
