import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Exported for the rare cases that need a raw fetch instead of RTK Query —
// e.g. SSE streaming responses (see hooks/ai/useInterviewPrepChat.js).
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3008';

export const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',
});
