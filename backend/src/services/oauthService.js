/**
 * OAuth user upsert logic — shared across all three providers.
 *
 * Priority order when a callback arrives:
 *   1. Existing user with this exact (provider, providerId) → update token
 *   2. Existing user whose email matches the provider email → link provider
 *   3. No match → create brand-new user
 *
 * The access token is encrypted via AES-256-GCM before storage.
 * The plain token is NEVER written to the database.
 */

import User from '../models/user.js';
import { encryptToken } from '../utils/encryption.js';

/**
 * @param {object} opts
 * @param {'github'|'google'|'linkedin'} opts.provider
 * @param {string|number}                opts.providerId  — provider's user ID
 * @param {string|null}                  opts.email       — null when provider withholds email
 * @param {string}                       opts.firstName
 * @param {string|undefined}             opts.lastName
 * @param {string|null}                  opts.photoUrl
 * @param {string}                       opts.rawToken    — plain-text access token to encrypt
 *
 * @returns {Promise<import('mongoose').Document>}
 *   Mongoose User document. The non-persisted property `_needsEmail` is set to
 *   `true` on new accounts where the provider returned no email — the route handler
 *   should redirect the browser to `/complete-profile?needsEmail=true`.
 */
export async function upsertOAuthUser({ provider, providerId, email, firstName, lastName, photoUrl, rawToken }) {
  const encryptedToken = encryptToken(rawToken);
  const providerIdStr  = String(providerId);

  // ── 1. Already linked to this provider + providerId ───────────────────────
  let user = await User.findOne({
    'oauthProviders.provider':   provider,
    'oauthProviders.providerId': providerIdStr,
  });

  if (user) {
    const entry = user.oauthProviders.find(
      (p) => p.provider === provider && p.providerId === providerIdStr,
    );
    if (entry) entry.accessToken = encryptedToken;
    await user.save();
    return user;
  }

  // ── 2. Email match — link new provider to existing account ────────────────
  if (email) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.oauthProviders.push({
        provider,
        providerId: providerIdStr,
        accessToken: encryptedToken,
        linkedAt: new Date(),
      });
      // Provider has already verified this email address
      if (!user.isEmailVerified) user.isEmailVerified = true;
      await user.save();
      return user;
    }
  }

  // ── 3. Create new user ────────────────────────────────────────────────────
  const newUser = new User({
    firstName:       firstName || 'User',
    lastName:        lastName  || undefined,
    email:           email ? email.toLowerCase() : null,
    photoUrl:        photoUrl || null,
    isEmailVerified: Boolean(email),
    oauthProviders:  [{
      provider,
      providerId: providerIdStr,
      accessToken: encryptedToken,
      linkedAt:   new Date(),
    }],
  });

  await newUser.save();

  // Signal to the route handler that we need to collect an email
  if (!email) newUser._needsEmail = true;

  return newUser;
}
