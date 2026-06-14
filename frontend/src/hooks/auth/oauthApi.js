/**
 * RTK Query endpoints for Phase 4 OAuth / profile enrichment.
 *
 * Linked-accounts:
 *   useGetLinkedAccountsQuery()         — GET  /profile/linked-accounts
 *
 * GitHub enrichment:
 *   useSyncGithubMutation()             — POST /profile/github/sync
 *   useDisconnectGithubMutation()       — DELETE /profile/github/disconnect
 *
 * LinkedIn enrichment:
 *   useSyncLinkedinMutation()           — POST /profile/linkedin/sync
 *   useDisconnectLinkedinMutation()     — DELETE /profile/linkedin/disconnect
 *
 * OAuth login (server-side redirect — browser navigates, not fetch):
 *   oauthLoginUrl(provider)             — helper, not RTK Query
 */

import { api } from '@/store/api';

const oauthApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLinkedAccounts: builder.query({
      query: () => '/profile/linked-accounts',
      providesTags: ['LinkedAccounts'],
      transformResponse: (res) => res.linkedAccounts ?? [],
    }),

    syncGithub: builder.mutation({
      query: () => ({ url: '/profile/github/sync', method: 'POST' }),
      // Refresh both Profile (github sub-doc) and LinkedAccounts
      invalidatesTags: ['Profile', 'LinkedAccounts'],
    }),

    disconnectGithub: builder.mutation({
      query: () => ({ url: '/profile/github/disconnect', method: 'DELETE' }),
      invalidatesTags: ['Profile', 'LinkedAccounts'],
    }),

    syncLinkedin: builder.mutation({
      query: () => ({ url: '/profile/linkedin/sync', method: 'POST' }),
      invalidatesTags: ['Profile', 'LinkedAccounts'],
    }),

    disconnectLinkedin: builder.mutation({
      query: () => ({ url: '/profile/linkedin/disconnect', method: 'DELETE' }),
      invalidatesTags: ['Profile', 'LinkedAccounts'],
    }),
  }),
});

export const {
  useGetLinkedAccountsQuery,
  useSyncGithubMutation,
  useDisconnectGithubMutation,
  useSyncLinkedinMutation,
  useDisconnectLinkedinMutation,
} = oauthApi;

/**
 * Builds the server-side OAuth initiation URL for a given provider.
 * The browser navigates to this URL — not a fetch call.
 *
 * @param {'github'|'google'|'linkedin'} provider
 * @returns {string}
 */
export function oauthLoginUrl(provider) {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
  return `${base}/auth/oauth/${provider}`;
}
