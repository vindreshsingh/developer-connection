/**
 * LinkedInEnrichmentService — fetches professional profile data for a linked user.
 *
 * LinkedIn scopes used: r_liteprofile + r_emailaddress + r_basicprofile (where available).
 * Only stores fields that are accessible with standard developer-app scopes.
 * Missing fields are stored as null — never throw for optional fields.
 *
 * @example
 *   const svc  = new LinkedInEnrichmentService(plainTextAccessToken);
 *   const data = await svc.sync();
 *   // { headline, company, jobTitle, profileUrl, syncedAt }
 */

import { apiGet } from '../utils/apiRequest.js';

const HOST    = 'api.linkedin.com';
const HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  'X-Restli-Protocol-Version': '2.0.0',
});

export class LinkedInEnrichmentService {
  /**
   * @param {string} accessToken  Plain-text (already decrypted) LinkedIn OAuth token.
   */
  constructor(accessToken) {
    this._token = accessToken;
  }

  /**
   * Fetch basic profile fields (name, headline, profileUrl).
   * Returns an object with nullable fields.
   */
  async fetchProfile() {
    const data = await apiGet(
      HOST,
      '/v2/me?projection=(id,localizedFirstName,localizedLastName,headline,profilePicture(displayImage~:playableStreams),vanityName)',
      HEADERS(this._token),
    );

    // Headline may not be present with all scopes
    const headline   = data.headline?.localized
      ? Object.values(data.headline.localized)[0] || null
      : (typeof data.headline === 'string' ? data.headline : null);

    const vanityName = data.vanityName || null;
    const profileUrl = vanityName
      ? `https://www.linkedin.com/in/${vanityName}`
      : null;

    return {
      headline:   headline   || null,
      profileUrl: profileUrl || null,
    };
  }

  /**
   * Fetch the user's current position (job title + company).
   * Uses the positions API — may be empty for users who haven't added work experience.
   */
  async fetchCurrentPosition() {
    try {
      const data = await apiGet(
        HOST,
        '/v2/positions?q=members&projection=(elements*(title,companyName,timePeriod(startDate,endDate)))',
        HEADERS(this._token),
      );

      const elements = data.elements || [];
      // Current position = first entry without an endDate
      const current = elements.find((e) => !e.timePeriod?.endDate);
      if (!current) return { jobTitle: null, company: null };

      return {
        jobTitle: current.title       || null,
        company:  current.companyName || null,
      };
    } catch {
      // Positions API may not be accessible depending on app OAuth scopes
      return { jobTitle: null, company: null };
    }
  }

  /**
   * Run a full enrichment sync.
   * Makes up to two API calls: profile + positions.
   *
   * @returns {Promise<{
   *   headline: string|null, company: string|null, jobTitle: string|null,
   *   profileUrl: string|null, syncedAt: Date
   * }>}
   */
  async sync() {
    const [profile, position] = await Promise.all([
      this.fetchProfile(),
      this.fetchCurrentPosition(),
    ]);

    return {
      headline:   profile.headline   || null,
      company:    position.company   || null,
      jobTitle:   position.jobTitle  || null,
      profileUrl: profile.profileUrl || null,
      syncedAt:   new Date(),
    };
  }
}
