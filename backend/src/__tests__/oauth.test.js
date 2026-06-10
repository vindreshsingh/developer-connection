/**
 * Tests for Phase 4 Track A — OAuth login.
 *
 * Structure:
 *   Part 1 — upsertOAuthUser unit tests (no HTTP mocking needed)
 *   Part 2 — Route: GET /auth/oauth/:provider  (initiate redirect)
 *   Part 3 — Route: GET /auth/oauth/:provider/callback  (CSRF + Passport flow)
 *             GitHub full flow mocked with nock
 */

import request from 'supertest';
import nock    from 'nock';
import app     from '../app.js';
import User    from '../models/user.js';
import { upsertOAuthUser }  from '../services/oauthService.js';
import { hashPassword }     from '../utils/sanitization.js';
import { decryptToken }     from '../utils/encryption.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal GitHub token-exchange + profile nock.
 *
 * We deliberately do NOT request the `user:email` scope (passport-github2
 * throws when /user/emails returns an empty array). Email comes from the
 * public profile field only; null email → _needsEmail flow.
 */
function mockGitHub({ profileId = '111', login = 'octocat', name = 'Octo Cat',
  email = 'octo@example.com', accessToken = 'gho_test_token' } = {}) {

  // 1. Code → token exchange
  nock('https://github.com')
    .post('/login/oauth/access_token')
    .reply(200, { access_token: accessToken, token_type: 'bearer', scope: '' });

  // 2. Profile fetch — email field is null for private-email users
  nock('https://api.github.com')
    .get('/user')
    .reply(200, {
      id:         profileId,
      login,
      name,
      email:      email || null,
      avatar_url: 'https://avatars.githubusercontent.com/u/111',
    });
}

/** Extract a specific cookie value from supertest response headers. */
function getCookie(res, name) {
  const cookies = res.headers['set-cookie'] || [];
  const found   = cookies.find((c) => c.startsWith(`${name}=`));
  return found ? found.split(';')[0].split('=').slice(1).join('=') : null;
}

// ── Part 1: upsertOAuthUser unit tests ───────────────────────────────────────

describe('oauthService.upsertOAuthUser', () => {
  const baseOpts = {
    provider:   'github',
    providerId: '42',
    email:      'dev@example.com',
    firstName:  'Dev',
    lastName:   'User',
    photoUrl:   null,
    rawToken:   'gho_plain_token',
  };

  it('creates a new user on first OAuth login', async () => {
    const user = await upsertOAuthUser(baseOpts);

    expect(user).toBeDefined();
    expect(user.firstName).toBe('Dev');
    expect(user.email).toBe('dev@example.com');
    expect(user.isEmailVerified).toBe(true);
    expect(user.oauthProviders).toHaveLength(1);
    expect(user.oauthProviders[0].provider).toBe('github');
    expect(user.oauthProviders[0].providerId).toBe('42');
    // Access token must be stored encrypted, not in plain text
    expect(user.oauthProviders[0].accessToken).not.toBe('gho_plain_token');
    expect(decryptToken(user.oauthProviders[0].accessToken)).toBe('gho_plain_token');
  });

  it('links provider to an existing email-matched account', async () => {
    // Pre-create an email/password user
    const existing = await new User({
      firstName: 'Alice',
      email:     'dev@example.com',
      password:  await hashPassword('securePass1'),
      isEmailVerified: true,
    }).save();

    const user = await upsertOAuthUser({ ...baseOpts, providerId: '99' });

    // Should return the same document (same _id)
    expect(user._id.toString()).toBe(existing._id.toString());
    // Provider should now be linked
    expect(user.oauthProviders.some((p) => p.provider === 'github' && p.providerId === '99')).toBe(true);
  });

  it('updates the encrypted token when the same providerId logs in again', async () => {
    await upsertOAuthUser({ ...baseOpts, rawToken: 'first_token' });
    const updated = await upsertOAuthUser({ ...baseOpts, rawToken: 'new_token' });

    const entry = updated.oauthProviders.find(
      (p) => p.provider === 'github' && p.providerId === '42',
    );
    expect(decryptToken(entry.accessToken)).toBe('new_token');
  });

  it('sets _needsEmail=true when no email is returned by the provider', async () => {
    const user = await upsertOAuthUser({ ...baseOpts, email: null });

    expect(user._needsEmail).toBe(true);
    expect(user.email).toBeNull();
    expect(user.isEmailVerified).toBe(false);
  });

  it('creates a new Google user', async () => {
    const user = await upsertOAuthUser({
      provider:   'google',
      providerId: 'google-uid-1',
      email:      'guser@gmail.com',
      firstName:  'Google',
      lastName:   'User',
      photoUrl:   'https://lh3.googleusercontent.com/photo',
      rawToken:   'ya29.google_token',
    });

    expect(user.oauthProviders[0].provider).toBe('google');
    expect(user.email).toBe('guser@gmail.com');
  });

  it('creates a new LinkedIn user', async () => {
    const user = await upsertOAuthUser({
      provider:   'linkedin',
      providerId: 'li-uid-1',
      email:      'liuser@linkedin.com',
      firstName:  'LinkedIn',
      lastName:   'User',
      photoUrl:   null,
      rawToken:   'AQX_li_token',
    });

    expect(user.oauthProviders[0].provider).toBe('linkedin');
    expect(user.email).toBe('liuser@linkedin.com');
  });

  it('does not create duplicate accounts when linking the same provider twice', async () => {
    await upsertOAuthUser(baseOpts);
    await upsertOAuthUser(baseOpts); // second call — should update, not create

    const count = await User.countDocuments({ email: 'dev@example.com' });
    expect(count).toBe(1);
  });
});

// ── Part 2: GET /auth/oauth/:provider ─────────────────────────────────────────

describe('GET /auth/oauth/:provider — initiate', () => {
  it('returns 302, sets oauth_state cookie, redirects to GitHub', async () => {
    const res = await request(app).get('/auth/oauth/github');

    expect(res.status).toBe(302);
    const location = res.headers.location || '';
    expect(location).toMatch(/github\.com\/login\/oauth\/authorize/);
    expect(location).toMatch(/state=/);

    const stateCookie = getCookie(res, 'oauth_state');
    expect(stateCookie).toBeTruthy();
    expect(stateCookie).toHaveLength(32); // 16 random bytes → 32 hex chars
  });

  it('returns 302 and redirects to Google', async () => {
    const res = await request(app).get('/auth/oauth/google');

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/accounts\.google\.com/);
  });

  it('returns 302 and redirects to LinkedIn', async () => {
    const res = await request(app).get('/auth/oauth/linkedin');

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/linkedin\.com\/oauth/);
  });

  it('returns 400 for an unsupported provider', async () => {
    const res = await request(app).get('/auth/oauth/twitter');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported/);
  });
});

// ── Part 3: GET /auth/oauth/:provider/callback ────────────────────────────────

describe('GET /auth/oauth/:provider/callback — CSRF validation', () => {
  it('returns 400 when oauth_state cookie is missing', async () => {
    const res = await request(app).get('/auth/oauth/github/callback?code=abc&state=somestate');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid OAuth state/);
  });

  it('returns 400 when state in query does not match cookie', async () => {
    const res = await request(app)
      .get('/auth/oauth/github/callback?code=abc&state=bad_state')
      .set('Cookie', 'oauth_state=correct_state');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid OAuth state/);
  });

  it('returns 400 when state query param is missing', async () => {
    const res = await request(app)
      .get('/auth/oauth/github/callback?code=abc')
      .set('Cookie', 'oauth_state=some_state');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid OAuth state/);
  });
});

describe('GET /auth/oauth/github/callback — full GitHub flow', () => {
  const STATE = 'aabbccdd11223344aabbccdd11223344';

  afterEach(() => nock.cleanAll());

  it('creates a new user, sets JWT cookie, redirects to FRONTEND_URL', async () => {
    mockGitHub({ profileId: '500', email: 'newbie@example.com', name: 'New Bie' });

    const res = await request(app)
      .get(`/auth/oauth/github/callback?code=test_code&state=${STATE}`)
      .set('Cookie', `oauth_state=${STATE}`);

    // Should redirect to frontend root
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/');

    // JWT cookie must be set
    const tokenCookie = getCookie(res, 'token');
    expect(tokenCookie).toBeTruthy();

    // User should exist in DB
    const user = await User.findOne({ email: 'newbie@example.com' });
    expect(user).toBeTruthy();
    expect(user.oauthProviders[0].provider).toBe('github');
  });

  it('links GitHub to an existing email/password account and redirects', async () => {
    await new User({
      firstName: 'Existing',
      email:     'existing@example.com',
      password:  await hashPassword('pass1234'),
      isEmailVerified: true,
    }).save();

    mockGitHub({ profileId: '501', email: 'existing@example.com', name: 'Existing User' });

    const res = await request(app)
      .get(`/auth/oauth/github/callback?code=test_code&state=${STATE}`)
      .set('Cookie', `oauth_state=${STATE}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/');

    const user = await User.findOne({ email: 'existing@example.com' });
    expect(user.oauthProviders.some((p) => p.provider === 'github')).toBe(true);
  });

  it('redirects to /complete-profile when GitHub returns no email', async () => {
    mockGitHub({ profileId: '502', email: null, name: 'No Email User' });

    const res = await request(app)
      .get(`/auth/oauth/github/callback?code=test_code&state=${STATE}`)
      .set('Cookie', `oauth_state=${STATE}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/complete-profile\?needsEmail=true/);

    // JWT cookie still set so the user can complete their profile while logged in
    expect(getCookie(res, 'token')).toBeTruthy();
  });
});
