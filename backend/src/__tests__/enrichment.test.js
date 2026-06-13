/**
 * Tests for Phase 4 Task A3 — GitHub + LinkedIn profile enrichment.
 *
 * Structure:
 *   Part 1 — GitHubEnrichmentService unit tests (nock on api.github.com)
 *   Part 2 — LinkedInEnrichmentService unit tests (nock on api.linkedin.com)
 *   Part 3 — REST routes: /profile/linked-accounts, /profile/github/*, /profile/linkedin/*
 */

import request  from 'supertest';
import nock     from 'nock';
import app      from '../app.js';
import User     from '../models/user.js';
import { GitHubEnrichmentService }   from '../services/GitHubEnrichmentService.js';
import { LinkedInEnrichmentService } from '../services/LinkedInEnrichmentService.js';
import { encryptToken } from '../utils/encryption.js';
import { hashPassword } from '../utils/sanitization.js';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const GH_REPOS = [
  { name: 'awesome-repo', html_url: 'https://github.com/u/awesome-repo', stargazers_count: 100, language: 'TypeScript' },
  { name: 'another-repo', html_url: 'https://github.com/u/another-repo', stargazers_count: 50,  language: 'JavaScript' },
  { name: 'rust-proj',    html_url: 'https://github.com/u/rust-proj',    stargazers_count: 30,  language: 'Rust' },
];

const GH_PROFILE = {
  id: 999,
  login: 'testoctocat',
  name:  'Test Octocat',
  html_url:   'https://github.com/testoctocat',
  avatar_url: 'https://avatars.githubusercontent.com/u/999',
};

const GH_EVENTS = Array.from({ length: 42 }, (_, i) => ({ id: i, type: 'PushEvent' }));

const LI_PROFILE = {
  id:                  'li-abc123',
  localizedFirstName:  'Li',
  localizedLastName:   'User',
  headline:            { localized: { 'en_US': 'Senior Engineer at Acme' } },
  vanityName:          'liuser',
};

const LI_POSITIONS = {
  elements: [
    {
      title:       'Senior Engineer',
      companyName: 'Acme Corp',
      timePeriod:  { startDate: { year: 2022, month: 1 } },
      // no endDate → current position
    },
  ],
};

// ── Helper: create a user with a linked OAuth provider ───────────────────────

async function createLinkedUser({
  provider,
  email = `${provider}user@example.com`,
  withPassword = false,
  extraProviders = [],
} = {}) {
  const user = await new User({
    firstName:       'Enrichment',
    email,
    password:        withPassword ? await hashPassword('pass1234') : null,
    isEmailVerified: true,
    oauthProviders: [
      {
        provider,
        providerId:  `${provider}-uid-test`,
        accessToken: encryptToken('test-raw-access-token'),
        linkedAt:    new Date(),
      },
      ...extraProviders,
    ],
  }).save();

  return { user, cookie: `token=${user.getJWT()}` };
}

// ── Part 1: GitHubEnrichmentService ──────────────────────────────────────────

describe('GitHubEnrichmentService', () => {
  const TOKEN = 'gho_unit_test_token';

  afterEach(() => nock.cleanAll());

  it('fetchProfile() returns username, avatarUrl, profileUrl', async () => {
    nock('https://api.github.com').get('/user').reply(200, GH_PROFILE);

    const svc  = new GitHubEnrichmentService(TOKEN);
    const data = await svc.fetchProfile();

    expect(data.username).toBe('testoctocat');
    expect(data.avatarUrl).toBe(GH_PROFILE.avatar_url);
    expect(data.profileUrl).toBe(GH_PROFILE.html_url);
  });

  it('fetchTopRepos() returns up to 6 repos with name/url/stars/language', async () => {
    nock('https://api.github.com')
      .get('/user/repos?sort=stars&per_page=20&type=owner')
      .reply(200, GH_REPOS);

    const svc   = new GitHubEnrichmentService(TOKEN);
    const repos = await svc.fetchTopRepos();

    expect(repos).toHaveLength(3); // only 3 in fixture
    expect(repos[0]).toMatchObject({
      name: 'awesome-repo', stars: 100, language: 'TypeScript',
    });
    expect(repos[0].url).toMatch(/github\.com/);
  });

  it('fetchTopLanguages() aggregates languages by repo count, top 5', async () => {
    const manyRepos = [
      ...Array(4).fill({ name: 'ts', html_url: 'x', stargazers_count: 0, language: 'TypeScript' }),
      ...Array(2).fill({ name: 'js', html_url: 'x', stargazers_count: 0, language: 'JavaScript' }),
      { name: 'rs', html_url: 'x', stargazers_count: 0, language: 'Rust' },
    ];
    nock('https://api.github.com')
      .get('/user/repos?sort=stars&per_page=20&type=owner')
      .reply(200, manyRepos);

    const svc  = new GitHubEnrichmentService(TOKEN);
    const langs = await svc.fetchTopLanguages();

    expect(langs[0]).toBe('TypeScript'); // most repos
    expect(langs[1]).toBe('JavaScript');
    expect(langs).toContain('Rust');
  });

  it('fetchContributions() returns event count', async () => {
    nock('https://api.github.com')
      .get('/users/testoctocat/events/public?per_page=100')
      .reply(200, GH_EVENTS);

    const svc   = new GitHubEnrichmentService(TOKEN);
    const count = await svc.fetchContributions('testoctocat');

    expect(count).toBe(42);
  });

  it('fetchContributions() returns 0 when events API fails', async () => {
    nock('https://api.github.com')
      .get('/users/testoctocat/events/public?per_page=100')
      .reply(403, { message: 'Forbidden' });

    const svc   = new GitHubEnrichmentService(TOKEN);
    const count = await svc.fetchContributions('testoctocat');

    expect(count).toBe(0);
  });

  it('sync() returns combined profile + repos + languages + contributions', async () => {
    nock('https://api.github.com').get('/user').reply(200, GH_PROFILE);
    nock('https://api.github.com')
      .get('/user/repos?sort=stars&per_page=20&type=owner')
      .reply(200, GH_REPOS);
    nock('https://api.github.com')
      .get('/users/testoctocat/events/public?per_page=100')
      .reply(200, GH_EVENTS);

    const svc  = new GitHubEnrichmentService(TOKEN);
    const data = await svc.sync();

    expect(data.username).toBe('testoctocat');
    expect(data.topRepos).toHaveLength(3);
    expect(data.topLanguages).toEqual(
      expect.arrayContaining(['TypeScript', 'JavaScript', 'Rust']),
    );
    expect(data.contributionsLastYear).toBe(42);
    expect(data.syncedAt).toBeInstanceOf(Date);
  });

  it('sync() throws when GitHub profile fetch fails', async () => {
    nock('https://api.github.com').get('/user').reply(401, { message: 'Bad credentials' });

    const svc = new GitHubEnrichmentService(TOKEN);
    await expect(svc.sync()).rejects.toThrow(/401/);
  });
});

// ── Part 2: LinkedInEnrichmentService ────────────────────────────────────────

describe('LinkedInEnrichmentService', () => {
  const TOKEN = 'AQX_li_unit_token';

  afterEach(() => nock.cleanAll());

  it('fetchProfile() returns headline and profileUrl', async () => {
    nock('https://api.linkedin.com')
      .get(/\/v2\/me/)
      .reply(200, LI_PROFILE);

    const svc  = new LinkedInEnrichmentService(TOKEN);
    const data = await svc.fetchProfile();

    expect(data.headline).toBe('Senior Engineer at Acme');
    expect(data.profileUrl).toBe('https://www.linkedin.com/in/liuser');
  });

  it('fetchProfile() handles missing headline gracefully', async () => {
    nock('https://api.linkedin.com')
      .get(/\/v2\/me/)
      .reply(200, { id: 'x', localizedFirstName: 'A', localizedLastName: 'B' }); // no headline

    const svc  = new LinkedInEnrichmentService(TOKEN);
    const data = await svc.fetchProfile();

    expect(data.headline).toBeNull();
  });

  it('fetchCurrentPosition() returns current job title and company', async () => {
    nock('https://api.linkedin.com')
      .get(/\/v2\/positions/)
      .reply(200, LI_POSITIONS);

    const svc  = new LinkedInEnrichmentService(TOKEN);
    const data = await svc.fetchCurrentPosition();

    expect(data.jobTitle).toBe('Senior Engineer');
    expect(data.company).toBe('Acme Corp');
  });

  it('fetchCurrentPosition() returns nulls when positions are unavailable', async () => {
    nock('https://api.linkedin.com')
      .get(/\/v2\/positions/)
      .reply(403, { message: 'Forbidden' });

    const svc  = new LinkedInEnrichmentService(TOKEN);
    const data = await svc.fetchCurrentPosition();

    expect(data.jobTitle).toBeNull();
    expect(data.company).toBeNull();
  });

  it('sync() returns combined profile data', async () => {
    nock('https://api.linkedin.com').get(/\/v2\/me/).reply(200, LI_PROFILE);
    nock('https://api.linkedin.com').get(/\/v2\/positions/).reply(200, LI_POSITIONS);

    const svc  = new LinkedInEnrichmentService(TOKEN);
    const data = await svc.sync();

    expect(data.headline).toBe('Senior Engineer at Acme');
    expect(data.company).toBe('Acme Corp');
    expect(data.jobTitle).toBe('Senior Engineer');
    expect(data.profileUrl).toBe('https://www.linkedin.com/in/liuser');
    expect(data.syncedAt).toBeInstanceOf(Date);
  });
});

// ── Part 3: REST routes ───────────────────────────────────────────────────────

describe('GET /profile/linked-accounts', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/profile/linked-accounts');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no providers are linked', async () => {
    const user = await new User({
      firstName: 'No', email: 'nolinks@example.com',
      password: await hashPassword('pass1234'), isEmailVerified: true,
    }).save();
    const cookie = `token=${user.getJWT()}`;

    const res = await request(app).get('/profile/linked-accounts').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.linkedAccounts).toEqual([]);
  });

  it('returns connected providers without access tokens', async () => {
    const { cookie } = await createLinkedUser({ provider: 'github' });

    const res = await request(app).get('/profile/linked-accounts').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.linkedAccounts).toHaveLength(1);
    expect(res.body.linkedAccounts[0].provider).toBe('github');
    expect(res.body.linkedAccounts[0].accessToken).toBeUndefined(); // never exposed
    expect(res.body.linkedAccounts[0].linkedAt).toBeTruthy();
  });
});

// ── GitHub sync ───────────────────────────────────────────────────────────────

describe('POST /profile/github/sync', () => {
  afterEach(() => nock.cleanAll());

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/profile/github/sync');
    expect(res.status).toBe(401);
  });

  it('returns 400 when GitHub is not linked', async () => {
    const user = await new User({
      firstName: 'NoGH', email: 'nogh@example.com',
      password: await hashPassword('pass1234'), isEmailVerified: true,
    }).save();

    const res = await request(app)
      .post('/profile/github/sync')
      .set('Cookie', `token=${user.getJWT()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not linked/);
  });

  it('syncs and persists GitHub enrichment data', async () => {
    const { cookie } = await createLinkedUser({ provider: 'github' });

    nock('https://api.github.com').get('/user').reply(200, GH_PROFILE);
    nock('https://api.github.com')
      .get('/user/repos?sort=stars&per_page=20&type=owner')
      .reply(200, GH_REPOS);
    nock('https://api.github.com')
      .get(`/users/${GH_PROFILE.login}/events/public?per_page=100`)
      .reply(200, GH_EVENTS);

    const res = await request(app).post('/profile/github/sync').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.github.username).toBe('testoctocat');
    expect(res.body.github.topRepos).toHaveLength(3);
    expect(res.body.github.contributionsLastYear).toBe(42);

    // Verify it's actually persisted to the DB
    const saved = await User.findOne({ email: 'githubuser@example.com' });
    expect(saved.github.username).toBe('testoctocat');
  });

  it('returns 500 when GitHub API returns an error', async () => {
    const { cookie } = await createLinkedUser({
      provider: 'github', email: 'ghfail@example.com',
    });

    nock('https://api.github.com').get('/user').reply(401, { message: 'Bad credentials' });

    const res = await request(app).post('/profile/github/sync').set('Cookie', cookie);

    expect(res.status).toBe(500);
  });
});

// ── GitHub disconnect ─────────────────────────────────────────────────────────

describe('DELETE /profile/github/disconnect', () => {
  it('returns 400 when GitHub is not linked', async () => {
    const user = await new User({
      firstName: 'NoGH', email: 'noghdc@example.com',
      password: await hashPassword('pass1234'), isEmailVerified: true,
    }).save();

    const res = await request(app)
      .delete('/profile/github/disconnect')
      .set('Cookie', `token=${user.getJWT()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not linked/);
  });

  it('disconnects GitHub and clears enrichment data', async () => {
    // User has GitHub linked AND a password — safe to disconnect
    const { user, cookie } = await createLinkedUser({
      provider: 'github', email: 'ghdc@example.com', withPassword: true,
    });
    // Seed some github enrichment data
    await User.findByIdAndUpdate(user._id, {
      github: { username: 'testoctocat', syncedAt: new Date() },
    });

    const res = await request(app)
      .delete('/profile/github/disconnect')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const saved = await User.findById(user._id);
    expect(saved.oauthProviders.some((p) => p.provider === 'github')).toBe(false);
    expect(saved.github?.username).toBeFalsy();
  });

  it('returns 400 when GitHub is the only login method', async () => {
    // No password, only GitHub provider
    const { cookie } = await createLinkedUser({
      provider: 'github', email: 'ghonly@example.com', withPassword: false,
    });

    const res = await request(app)
      .delete('/profile/github/disconnect')
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only login method/);
  });

  it('allows disconnect when a second OAuth provider is also linked', async () => {
    const { cookie } = await createLinkedUser({
      provider: 'github',
      email:    'ghmulti@example.com',
      withPassword: false,
      extraProviders: [{
        provider:    'google',
        providerId:  'google-uid-extra',
        accessToken: encryptToken('google-token'),
        linkedAt:    new Date(),
      }],
    });

    const res = await request(app)
      .delete('/profile/github/disconnect')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const saved = await User.findOne({ email: 'ghmulti@example.com' });
    expect(saved.oauthProviders.some((p) => p.provider === 'google')).toBe(true);
    expect(saved.oauthProviders.some((p) => p.provider === 'github')).toBe(false);
  });
});

// ── LinkedIn sync ─────────────────────────────────────────────────────────────

describe('POST /profile/linkedin/sync', () => {
  afterEach(() => nock.cleanAll());

  it('returns 400 when LinkedIn is not linked', async () => {
    const user = await new User({
      firstName: 'NoLI', email: 'noli@example.com',
      password: await hashPassword('pass1234'), isEmailVerified: true,
    }).save();

    const res = await request(app)
      .post('/profile/linkedin/sync')
      .set('Cookie', `token=${user.getJWT()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not linked/);
  });

  it('syncs and persists LinkedIn enrichment data', async () => {
    const { cookie } = await createLinkedUser({ provider: 'linkedin' });

    nock('https://api.linkedin.com').get(/\/v2\/me/).reply(200, LI_PROFILE);
    nock('https://api.linkedin.com').get(/\/v2\/positions/).reply(200, LI_POSITIONS);

    const res = await request(app).post('/profile/linkedin/sync').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.linkedin.headline).toBe('Senior Engineer at Acme');
    expect(res.body.linkedin.company).toBe('Acme Corp');

    const saved = await User.findOne({ email: 'linkedinuser@example.com' });
    expect(saved.linkedin.headline).toBe('Senior Engineer at Acme');
  });
});

// ── LinkedIn disconnect ───────────────────────────────────────────────────────

describe('DELETE /profile/linkedin/disconnect', () => {
  it('disconnects LinkedIn and clears enrichment data', async () => {
    const { user, cookie } = await createLinkedUser({
      provider: 'linkedin', email: 'lidc@example.com', withPassword: true,
    });
    await User.findByIdAndUpdate(user._id, {
      linkedin: { headline: 'Senior Engineer', syncedAt: new Date() },
    });

    const res = await request(app)
      .delete('/profile/linkedin/disconnect')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const saved = await User.findById(user._id);
    expect(saved.oauthProviders.some((p) => p.provider === 'linkedin')).toBe(false);
    expect(saved.linkedin?.headline).toBeFalsy();
  });

  it('returns 400 when LinkedIn is the only login method', async () => {
    const { cookie } = await createLinkedUser({
      provider: 'linkedin', email: 'lionly@example.com', withPassword: false,
    });

    const res = await request(app)
      .delete('/profile/linkedin/disconnect')
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only login method/);
  });
});
