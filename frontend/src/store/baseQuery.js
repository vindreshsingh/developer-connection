import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3008';

// CSRF (double-submit cookie): the gateway sets an httpOnly secret cookie and
// returns a matching token from GET /csrf-token. Every mutating request must
// echo that token in the x-csrf-token header. We cache it in memory and lazily
// (re)fetch it.
let csrfToken = null;

async function fetchCsrfToken() {
  try {
    const res = await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' });
    if (!res.ok) return null;
    csrfToken = (await res.json()).csrfToken;
  } catch {
    csrfToken = null;
  }
  return csrfToken;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  credentials: 'include',
  prepareHeaders: async (headers, { type }) => {
    // RTK Query mutations are the state-changing calls — attach the token.
    if (type === 'mutation') {
      if (!csrfToken) await fetchCsrfToken();
      if (csrfToken) headers.set('x-csrf-token', csrfToken);
    }
    return headers;
  },
});

const isCsrfError = (result) =>
  result.error?.status === 403 && result.error?.data?.error?.code === 'EBADCSRFTOKEN';

// Wrap the base query so a stale/rotated token (e.g. after login changes the
// session) auto-heals: refetch the token once and retry the request.
export const baseQuery = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  if (isCsrfError(result)) {
    await fetchCsrfToken();
    result = await rawBaseQuery(args, api, extraOptions);
  }
  return result;
};
