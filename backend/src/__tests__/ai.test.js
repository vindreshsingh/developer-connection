import { jest } from '@jest/globals';

const getProfileFeedback = jest.fn();
const getMatchInsight = jest.fn();
const streamInterviewPrepReply = jest.fn();

jest.unstable_mockModule('../services/aiService.js', () => ({
  getProfileFeedback,
  getMatchInsight,
  streamInterviewPrepReply,
  PROFILE_FEEDBACK_MODEL: 'claude-sonnet-4-6',
  MATCH_INSIGHT_MODEL: 'claude-haiku-4-5',
  INTERVIEW_PREP_MODEL: 'claude-sonnet-4-6',
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { default: User } = await import('../models/user.js');
const { default: AiUsage } = await import('../models/aiUsage.js');
const { default: AiConversation } = await import('../models/aiConversation.js');
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

describe('POST /ai/interview-prep', () => {
  beforeEach(() => {
    streamInterviewPrepReply.mockReset();
  });

  it('streams the assistant reply via SSE and persists the conversation', async () => {
    streamInterviewPrepReply.mockImplementation(async (history, onToken) => {
      onToken('Sure, ');
      onToken('let\'s practice.');
      return 'Sure, let\'s practice.';
    });
    const { user, cookie } = await createUser({ email: 'interview@example.com' });

    const res = await request(app)
      .post('/ai/interview-prep')
      .set('Cookie', cookie)
      .send({ message: 'Help me prepare for a system design interview.' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.text).toContain('Sure, ');
    expect(res.text).toContain("let's practice.");
    expect(res.text).toContain('[DONE]');

    const conversation = await AiConversation.findOne({ userId: user._id });
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0]).toMatchObject({
      role: 'user',
      content: 'Help me prepare for a system design interview.',
    });
    expect(conversation.messages[1]).toMatchObject({ role: 'assistant', content: "Sure, let's practice." });
  });

  it('returns 400 when message is missing', async () => {
    const { cookie } = await createUser({ email: 'interview2@example.com' });

    const res = await request(app).post('/ai/interview-prep').set('Cookie', cookie).send({});

    expect(res.status).toBe(400);
    expect(streamInterviewPrepReply).not.toHaveBeenCalled();
  });

  it('returns 429 once the daily quota is exhausted', async () => {
    const { user, cookie } = await createUser({ email: 'interview3@example.com' });
    const limit = AI_DAILY_LIMITS.free.interview_prep;
    await new AiUsage({ userId: user._id, feature: 'interview_prep', date: todayUTC(), count: limit }).save();

    const res = await request(app).post('/ai/interview-prep').set('Cookie', cookie).send({ message: 'Hi' });

    expect(res.status).toBe(429);
    expect(streamInterviewPrepReply).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/ai/interview-prep').send({ message: 'Hi' });
    expect(res.status).toBe(401);
  });
});

describe('GET /ai/interview-prep/history', () => {
  it('returns an empty history for a new user', async () => {
    const { cookie } = await createUser({ email: 'history@example.com' });

    const res = await request(app).get('/ai/interview-prep/history').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('returns the most recent page of messages, oldest-first', async () => {
    const { user, cookie } = await createUser({ email: 'history2@example.com' });
    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
      createdAt: new Date(),
    }));
    await new AiConversation({ userId: user._id, messages }).save();

    const res = await request(app).get('/ai/interview-prep/history').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.data[0].content).toBe('message 5');
    expect(res.body.data[19].content).toBe('message 24');
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 25, totalPages: 2 });
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/ai/interview-prep/history');
    expect(res.status).toBe(401);
  });
});
