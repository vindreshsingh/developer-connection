import { jest } from '@jest/globals';

const getProfileFeedback = jest.fn();
const getMatchInsight = jest.fn();

jest.unstable_mockModule('../services/aiService.js', () => ({
  getProfileFeedback,
  getMatchInsight,
  PROFILE_FEEDBACK_MODEL: 'claude-sonnet-4-6',
  MATCH_INSIGHT_MODEL: 'claude-haiku-4-5',
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { default: User } = await import('../models/user.js');
const { default: AiUsage } = await import('../models/aiUsage.js');
const { hashPassword } = await import('../utils/sanitization.js');
const { AI_DAILY_LIMITS } = await import('../config/limits.js');

const createUser = async (overrides = {}) => {
  const user = await new User({
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    email: overrides.email,
    password: await hashPassword('password123'),
    isEmailVerified: true,
    bio: overrides.bio || 'I build things.',
    skills: overrides.skills || ['javascript', 'react'],
  }).save();

  return { user, cookie: `token=${user.getJWT()}` };
};

const todayUTC = () => new Date().toISOString().slice(0, 10);

describe('POST /ai/profile-feedback', () => {
  beforeEach(() => {
    getProfileFeedback.mockReset();
  });

  it('returns AI feedback for the caller\'s own profile', async () => {
    getProfileFeedback.mockResolvedValue('Add more detail to your bio.');
    const { cookie } = await createUser({ email: 'feedback@example.com' });

    const res = await request(app).post('/ai/profile-feedback').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.feedback).toBe('Add more detail to your bio.');
    expect(getProfileFeedback).toHaveBeenCalledTimes(1);
  });

  it('returns 429 once the daily quota is exhausted', async () => {
    getProfileFeedback.mockResolvedValue('feedback');
    const { user, cookie } = await createUser({ email: 'quota@example.com' });
    const limit = AI_DAILY_LIMITS.free.profile_feedback;
    await new AiUsage({ userId: user._id, feature: 'profile_feedback', date: todayUTC(), count: limit }).save();

    const res = await request(app).post('/ai/profile-feedback').set('Cookie', cookie);

    expect(res.status).toBe(429);
    expect(getProfileFeedback).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/ai/profile-feedback');
    expect(res.status).toBe(401);
  });
});

describe('POST /ai/match-insight/:userId', () => {
  beforeEach(() => {
    getMatchInsight.mockReset();
  });

  it("returns an AI insight for another user's profile", async () => {
    getMatchInsight.mockResolvedValue('You both love React and open source!');
    const { cookie } = await createUser({ email: 'viewer@example.com' });
    const { user: target } = await createUser({ email: 'target@example.com', skills: ['react', 'node'] });

    const res = await request(app).post(`/ai/match-insight/${target._id}`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.insight).toBe('You both love React and open source!');
    expect(getMatchInsight).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when targeting your own profile', async () => {
    const { user, cookie } = await createUser({ email: 'self@example.com' });

    const res = await request(app).post(`/ai/match-insight/${user._id}`).set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(getMatchInsight).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-existent user', async () => {
    const { cookie } = await createUser({ email: 'viewer2@example.com' });

    const res = await request(app).post('/ai/match-insight/64b1f0c2e1b1c2a3d4e5f6a7').set('Cookie', cookie);

    expect(res.status).toBe(404);
    expect(getMatchInsight).not.toHaveBeenCalled();
  });

  it('returns 429 once the daily quota is exhausted', async () => {
    getMatchInsight.mockResolvedValue('insight');
    const { user, cookie } = await createUser({ email: 'quota2@example.com' });
    const { user: target } = await createUser({ email: 'target2@example.com' });
    const limit = AI_DAILY_LIMITS.free.match_insight;
    await new AiUsage({ userId: user._id, feature: 'match_insight', date: todayUTC(), count: limit }).save();

    const res = await request(app).post(`/ai/match-insight/${target._id}`).set('Cookie', cookie);

    expect(res.status).toBe(429);
    expect(getMatchInsight).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const { user: target } = await createUser({ email: 'target3@example.com' });
    const res = await request(app).post(`/ai/match-insight/${target._id}`);
    expect(res.status).toBe(401);
  });
});
