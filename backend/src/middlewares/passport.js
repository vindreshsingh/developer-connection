/**
 * Passport strategy configuration for three OAuth providers.
 *
 * Call `configurePassport()` once at app start (before any request is served).
 * All strategies use `session: false` — authentication state is carried in
 * the JWT cookie, not an Express session.
 *
 * ENV required:
 *   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *   LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
 *   OAUTH_CALLBACK_BASE_URL   e.g. http://localhost:3008
 */

import passport from 'passport';
import { Strategy as GitHubStrategy }   from 'passport-github2';
import { Strategy as GoogleStrategy }   from 'passport-google-oauth20';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import { upsertOAuthUser } from '../services/oauthService.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split a display name into { firstName, lastName }. */
function splitName(displayName = '') {
  const parts = displayName.trim().split(/\s+/);
  return {
    firstName: parts[0] || 'User',
    lastName:  parts.length > 1 ? parts.slice(1).join(' ') : undefined,
  };
}

function callbackBase() {
  return process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3008';
}

// ── GitHub ────────────────────────────────────────────────────────────────────

function makeGitHubStrategy() {
  return new GitHubStrategy(
    {
      clientID:     process.env.GITHUB_CLIENT_ID     || 'gh-test-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'gh-test-secret',
      callbackURL:  `${callbackBase()}/auth/oauth/github/callback`,
      // No 'user:email' scope: passport-github2 throws on empty emails arrays,
      // and GitHub returns email in the basic profile for public-email users.
      // Null email is handled by upsertOAuthUser → _needsEmail flow.
      scope:        [],
    },
    async (accessToken, _refreshToken, profile, done) => {
      try {
        // Without user:email scope, email comes from the public profile field only.
        // Users with a private GitHub email will get null here → _needsEmail flow.
        const primaryEmail =
          profile.emails?.[0]?.value ||   // set by profile.parse() from json.email
          profile._json?.email         ||
          null;

        const { firstName, lastName } = splitName(
          profile.displayName || profile.username || '',
        );

        const user = await upsertOAuthUser({
          provider:   'github',
          providerId: profile.id,
          email:      primaryEmail,
          firstName,
          lastName,
          photoUrl:   profile.photos?.[0]?.value || null,
          rawToken:   accessToken,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    },
  );
}

// ── Google ────────────────────────────────────────────────────────────────────

function makeGoogleStrategy() {
  return new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID     || 'google-test-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'google-test-secret',
      callbackURL:  `${callbackBase()}/auth/oauth/google/callback`,
    },
    async (accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || null;
        const { firstName, lastName } = splitName(profile.displayName);

        const user = await upsertOAuthUser({
          provider:   'google',
          providerId: profile.id,
          email,
          firstName,
          lastName,
          photoUrl:   profile.photos?.[0]?.value || null,
          rawToken:   accessToken,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    },
  );
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────

function makeLinkedInStrategy() {
  return new LinkedInStrategy(
    {
      clientID:     process.env.LINKEDIN_CLIENT_ID     || 'li-test-id',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || 'li-test-secret',
      callbackURL:  `${callbackBase()}/auth/oauth/linkedin/callback`,
      scope:        ['r_emailaddress', 'r_liteprofile'],
    },
    async (accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || null;
        const { firstName, lastName } = splitName(profile.displayName || '');

        const user = await upsertOAuthUser({
          provider:   'linkedin',
          providerId: profile.id,
          email,
          firstName,
          lastName,
          photoUrl:   profile.photos?.[0]?.value || null,
          rawToken:   accessToken,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    },
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Register all three strategies. Call once at app startup before
 * any request reaches the OAuth routes.
 */
export function configurePassport() {
  passport.use('github',   makeGitHubStrategy());
  passport.use('google',   makeGoogleStrategy());
  passport.use('linkedin', makeLinkedInStrategy());
  // No serializeUser / deserializeUser needed — we use stateless JWT cookies.
}

export default passport;
