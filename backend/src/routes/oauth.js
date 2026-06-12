/**
 * OAuth login routes — mounted at /auth in app.js.
 *
 * GET /auth/oauth/:provider          → redirect to provider's auth page
 * GET /auth/oauth/:provider/callback → provider redirects here after auth
 *
 * State / CSRF protection:
 *   • On initiate:  generate a random `state`, store it in an httpOnly cookie,
 *     and pass it to passport.authenticate so it is appended to the redirect URL.
 *   • On callback:  compare `req.query.state` against the cookie; reject on mismatch.
 *
 * Session: none — authentication state is carried in a JWT cookie (`token`).
 */

import { randomBytes } from 'node:crypto';
import express from 'express';
import passport from '../middlewares/passport.js';
import { OAUTH } from '../constants/apiEndpoints.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const SUPPORTED_PROVIDERS = new Set(['github', 'google', 'linkedin']);
const STATE_COOKIE         = 'oauth_state';
const STATE_TTL_MS         = 10 * 60 * 1000; // 10 minutes

// ── GET /auth/oauth/:provider ─────────────────────────────────────────────────
// Generates state, stores it in a cookie, then delegates to Passport which
// builds the provider auth URL (with state= appended) and issues the redirect.

router.get(OAUTH.INITIATE, (req, res, next) => {
  const { provider } = req.params;

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return res.status(400).json({ error: `Unsupported OAuth provider: ${provider}` });
  }

  const state = randomBytes(16).toString('hex');

  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    maxAge:   STATE_TTL_MS,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
  });

  // passport.authenticate on the initiate request builds the provider auth
  // URL and issues a 302. Passing `state` causes it to include &state=<value>
  // in that URL so the provider echoes it back on the callback.
  passport.authenticate(provider, { state, session: false })(req, res, next);
});

// ── GET /auth/oauth/:provider/callback ────────────────────────────────────────
// Provider redirects here. We:
//   1. Validate CSRF state
//   2. Let Passport exchange the code for an access token + fetch profile
//   3. The verify callback (in middlewares/passport.js) calls upsertOAuthUser
//   4. Set JWT cookie and redirect to frontend

router.get(OAUTH.CALLBACK, (req, res, next) => {
  const { provider } = req.params;

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return res.status(400).json({ error: `Unsupported OAuth provider: ${provider}` });
  }

  // ── CSRF state check ──────────────────────────────────────────────────────
  const cookieState = req.cookies[STATE_COOKIE];
  const queryState  = req.query.state;

  if (!cookieState || !queryState || cookieState !== queryState) {
    res.clearCookie(STATE_COOKIE);
    return res.status(400).json({ error: 'Invalid OAuth state. Possible CSRF attack.' });
  }

  res.clearCookie(STATE_COOKIE);

  // ── Passport code exchange + profile fetch ────────────────────────────────
  // Custom callback gives us full control over the response.
  passport.authenticate(provider, { session: false }, (err, user) => {
    if (err) {
      logger.error(`[OAuth] Error from ${provider}: ${err.message}`);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
      );
    }

    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=oauth_no_user`,
      );
    }

    const token = user.getJWT();
    res.cookie('token', token, {
      httpOnly: true,
      maxAge:   24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
    });

    // GitHub may return no email — ask the user to supply one before continuing
    if (user._needsEmail) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/complete-profile?needsEmail=true`,
      );
    }

    return res.redirect(`${process.env.FRONTEND_URL}/`);
  })(req, res, next);
});

export default router;
