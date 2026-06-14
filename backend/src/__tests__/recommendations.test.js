/**
 * Tests for Phase 6 Task B2 — GET /ai/recommendations and
 * POST /ai/recommendations/:userId/dismiss.
 *
 * The `@anthropic-ai/sdk` is mocked at the module level (no live API calls).
 */

import { jest } from '@jest/globals';

const textResponse = (text) => ({ content: [{ type: 'text', text }] });

const mockCreate = jest.fn();

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { default: User } = await import('../models/user.js');
const { default: AIUsageLog } = await import('../models/aiUsageLog.js');
const { default: RecommendationCache } = await import('../models/recommendationCache.js');
const { hashPassword } = await import('../utils/sanitization.js');

const createUser = async (overrides = {}) => {
  const user = await new User({
    firstName: 'Test',
    email: `ai_${Date.now()}_${Math.random()}@test.com`,
    password: await hashPassword('pass1234'),
    isEmailVerified: true,
    isPremium: true,
    skills: ['React', 'Node'],
    techStack: ['MongoDB'],
    ...overrides,
  }).save();
  return { user, cookie: `token=${user.getJWT()}` };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /ai/recommendations', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/ai/recommendations');
    expect(res.status).toBe(401);
  });

  it('blocks non-premium users with PREMIUM_REQUIRED', async () => {
    const { cookie } = await createUser({ isPremium: false });

    const res = await request(app).get('/ai/recommendations').set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PREMIUM_REQUIRED');
  });

  it('builds a shortlist, calls the AI, and caches the result', async () => {
    const { cookie } = await createUser();
    const { user: candidate } = await createUser({ skills: ['React'], techStack: [] });

    mockCreate.mockResolvedValue(
      textResponse(JSON.stringify([{ index: 0, reason: 'Shares React skills with you' }])),
    );

    const res = await request(app).get('/ai/recommendations').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].user._id).toBe(candidate._id.toString());
    expect(res.body.data[0].reason).toBe('Shares React skills with you');
    expect(mockCreate).toHaveBeenCalledTimes(1);

    expect(await AIUsageLog.countDocuments({ endpoint: 'recommendations' })).toBe(1);
  });

  it('returns the cached result on a second call without calling the AI again', async () => {
    const { cookie } = await createUser();
    await createUser({ skills: ['React'], techStack: [] });

    mockCreate.mockResolvedValue(textResponse(JSON.stringify([{ index: 0, reason: 'Good match' }])));

    await request(app).get('/ai/recommendations').set('Cookie', cookie);
    const res = await request(app).get('/ai/recommendations').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('returns 429 when the daily AI limit is exhausted on a cache miss', async () => {
    const { user, cookie } = await createUser();
    await createUser({ skills: ['React'], techStack: [] });

    const limit = Number(process.env.AI_DAILY_LIMIT);
    await AIUsageLog.insertMany(
      Array.from({ length: limit }, () => ({ userId: user._id, endpoint: 'recommendations' })),
    );

    const res = await request(app).get('/ai/recommendations').set('Cookie', cookie);

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('AI_RATE_LIMIT_EXCEEDED');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('ai-recommendations queue handler (worker path)', () => {
  it('generates and caches recommendations for the given userId', async () => {
    const { handlers } = await import('../jobs/handlers.js');
    const { QUEUE } = await import('../queues/names.js');

    const { user } = await createUser();
    const { user: candidate } = await createUser({ skills: ['React'], techStack: [] });

    mockCreate.mockResolvedValue(
      textResponse(JSON.stringify([{ index: 0, reason: 'Strong React overlap' }])),
    );

    await handlers[QUEUE.AI_RECOMMENDATIONS]({ userId: user._id.toString() });

    const cache = await RecommendationCache.findOne({ userId: user._id });
    expect(cache.recommendations).toHaveLength(1);
    expect(cache.recommendations[0].userId.toString()).toBe(candidate._id.toString());
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(await AIUsageLog.countDocuments({ endpoint: 'recommendations' })).toBe(1);
  });

  it('no-ops when the user no longer exists', async () => {
    const { handlers } = await import('../jobs/handlers.js');
    const { QUEUE } = await import('../queues/names.js');
    const { default: mongoose } = await import('mongoose');

    await handlers[QUEUE.AI_RECOMMENDATIONS]({ userId: new mongoose.Types.ObjectId().toString() });

    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('POST /ai/recommendations/:userId/dismiss', () => {
  it('removes the user from cached recommendations and records the dismissal', async () => {
    const { user, cookie } = await createUser();
    const { user: candidate } = await createUser({ skills: ['React'], techStack: [] });

    mockCreate.mockResolvedValue(textResponse(JSON.stringify([{ index: 0, reason: 'Good match' }])));
    await request(app).get('/ai/recommendations').set('Cookie', cookie);

    const res = await request(app)
      .post(`/ai/recommendations/${candidate._id}/dismiss`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const cache = await RecommendationCache.findOne({ userId: user._id });
    expect(cache.recommendations).toHaveLength(0);
    expect(cache.dismissed.map((d) => d.userId.toString())).toContain(candidate._id.toString());
  });

  it('returns 404 when no recommendation cache exists', async () => {
    const { cookie } = await createUser();
    const { user: candidate } = await createUser();

    const res = await request(app)
      .post(`/ai/recommendations/${candidate._id}/dismiss`)
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});
