/**
 * GitHubEnrichmentService — fetches public GitHub data for a linked user.
 *
 * Rate limits: GitHub allows 5 000 req/hr for authenticated tokens.
 * sync() makes three API calls (profile + repos + events).
 * Triggered on-demand only (never on every login).
 *
 * @example
 *   const svc  = new GitHubEnrichmentService(plainTextAccessToken);
 *   const data = await svc.sync();
 *   // { username, avatarUrl, profileUrl, topRepos, topLanguages, contributionsLastYear, syncedAt }
 */

import { apiGet } from '../utils/apiRequest.js';

const HOST    = 'api.github.com';
const HEADERS = (token) => ({
  Authorization:        `Bearer ${token}`,
  'User-Agent':         'developer-connection',
  Accept:               'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

export class GitHubEnrichmentService {
  /**
   * @param {string} accessToken  Plain-text (already decrypted) GitHub OAuth token.
   */
  constructor(accessToken) {
    this._token = accessToken;
  }

  /** Fetch the authenticated user's basic profile. */
  async fetchProfile() {
    const data = await apiGet(HOST, '/user', HEADERS(this._token));
    return {
      username:   data.login,
      avatarUrl:  data.avatar_url  || null,
      profileUrl: data.html_url    || null,
    };
  }

  /**
   * Fetch up to 20 public repos sorted by stars; return the top 6.
   * Language is extracted from each repo (may be null for empty/binary repos).
   */
  async fetchTopRepos() {
    const repos = await apiGet(
      HOST,
      '/user/repos?sort=stars&per_page=20&type=owner',
      HEADERS(this._token),
    );

    return repos.slice(0, 6).map((r) => ({
      name:     r.name,
      url:      r.html_url,
      stars:    r.stargazers_count ?? 0,
      language: r.language || null,
    }));
  }

  /**
   * Aggregate top languages across the user's repos.
   * Returns up to 5 languages sorted by repo-count descending.
   */
  async fetchTopLanguages() {
    const repos = await apiGet(
      HOST,
      '/user/repos?sort=stars&per_page=20&type=owner',
      HEADERS(this._token),
    );

    const counts = {};
    for (const r of repos) {
      if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;
    }

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lang]) => lang);
  }

  /**
   * Approximate contribution count via the public events API.
   * Returns the number of events in the most recent page (up to 100).
   * Falls back to 0 on API error (e.g. private-account events not accessible).
   *
   * @param {string} username  GitHub login.
   */
  async fetchContributions(username) {
    try {
      const events = await apiGet(
        HOST,
        `/users/${username}/events/public?per_page=100`,
        HEADERS(this._token),
      );
      return Array.isArray(events) ? events.length : 0;
    } catch {
      return 0; // events may be unavailable for private accounts
    }
  }

  /**
   * Run a full enrichment sync.
   * Makes three API calls: profile, repos, events.
   *
   * @returns {Promise<{
   *   username: string, avatarUrl: string|null, profileUrl: string|null,
   *   topRepos: Array, topLanguages: string[], contributionsLastYear: number,
   *   syncedAt: Date
   * }>}
   */
  async sync() {
    const profile  = await this.fetchProfile();
    const allRepos = await apiGet(
      HOST,
      '/user/repos?sort=stars&per_page=20&type=owner',
      HEADERS(this._token),
    );

    // Top 6 repos by stars
    const topRepos = allRepos.slice(0, 6).map((r) => ({
      name:     r.name,
      url:      r.html_url,
      stars:    r.stargazers_count ?? 0,
      language: r.language || null,
    }));

    // Top 5 languages by repo-count
    const langCounts = {};
    for (const r of allRepos) {
      if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    }
    const topLanguages = Object.entries(langCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lang]) => lang);

    const contributionsLastYear = await this.fetchContributions(profile.username);

    return {
      ...profile,
      topRepos,
      topLanguages,
      contributionsLastYear,
      syncedAt: new Date(),
    };
  }
}
