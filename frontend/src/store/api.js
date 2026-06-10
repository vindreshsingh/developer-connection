import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

// Base API — defines the single RTK Query instance, shared baseQuery, and all
// cache tag types. Actual endpoints live next to their hook modules and are
// registered via api.injectEndpoints(). This keeps store/ small regardless of
// how many feature modules Phase 2+ adds.
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Profile', 'Feed', 'Requests', 'Connections', 'Conversations', 'Messages', 'Billing', 'InterviewPrep'],
  endpoints: () => ({}),
});
