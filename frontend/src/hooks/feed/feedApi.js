import { api } from '@/store/api';

const feedApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFeed: builder.query({
      query: ({ page = 1, skills = '', experienceLevel = '' } = {}) =>
        `/profile/feed?page=${page}` +
        (skills ? `&skills=${encodeURIComponent(skills)}` : '') +
        (experienceLevel ? `&experienceLevel=${encodeURIComponent(experienceLevel)}` : ''),
      providesTags: ['Feed'],
      // Merge subsequent pages into one cached list, keyed by the active
      // filters (changing a filter starts a fresh cached list; paginating
      // within the same filters accumulates into it).
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}-${queryArgs?.skills || ''}-${queryArgs?.experienceLevel || ''}`,
      merge: (currentCache, newItems, { arg }) => {
        if (!arg || arg.page <= 1) return newItems;
        return { ...newItems, data: [...currentCache.data, ...newItems.data] };
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.page !== previousArg?.page ||
        currentArg?.skills !== previousArg?.skills ||
        currentArg?.experienceLevel !== previousArg?.experienceLevel,
    }),
  }),
});

export const { useGetFeedQuery } = feedApi;
