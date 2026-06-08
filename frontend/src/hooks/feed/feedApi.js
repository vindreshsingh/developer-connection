import { api } from '@/store/api';

const feedApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFeed: builder.query({
      query: (page = 1) => `/profile/feed?page=${page}`,
      providesTags: ['Feed'],
      // Merge subsequent pages into one cached list, keyed by endpoint name
      // (ignoring the page arg) so the cache accumulates across pagination.
      serializeQueryArgs: ({ endpointName }) => endpointName,
      merge: (currentCache, newItems, { arg }) => {
        if (arg === 1) return newItems;
        return { ...newItems, data: [...currentCache.data, ...newItems.data] };
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg !== previousArg,
    }),
  }),
});

export const { useGetFeedQuery } = feedApi;
