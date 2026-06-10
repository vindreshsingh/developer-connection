import { jest } from '@jest/globals';

const getProfileFeedback = jest.fn();

jest.unstable_mockModule('../services/aiService.js', () => ({
  getProfileFeedback,
  PROFILE_FEEDBACK_MODEL: 'claude-sonnet-4-6',
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
