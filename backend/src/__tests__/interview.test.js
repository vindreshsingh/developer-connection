/**
 * Tests for Phase 6 Task B4 — interview prep routes:
 * POST /ai/interview/start, POST /ai/interview/:sessionId/respond,
 * POST /ai/interview/:sessionId/end, GET /ai/interview, GET /ai/interview/:sessionId.
 *
 * `@anthropic-ai/sdk` is mocked at the module level (no live API calls).
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
const { default: InterviewSession } = await import('../models/interviewSession.js');
const { hashPassword } = await import('../utils/sanitization.js');

const createUser = async (overrides = {}) => {
  const user = await new User({
    firstName: 'Test',
    email: `interview_${Date.now()}_${Math.random()}@test.com`,
    password: await hashPassword('pass1234'),
    isEmailVerified: true,
    isPremium: true,
    skills: ['React'],
    ...overrides,
  }).save();
  return { user, cookie: `token=${user.getJWT()}` };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /ai/interview/start', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/ai/interview/start').send({ focusArea: 'backend' });
    expect(res.status).toBe(401);
  });

  it('blocks non-premium users with PREMIUM_REQUIRED', async () => {
    const { cookie } = await createUser({ isPremium: false });

    const res = await request(app).post('/ai/interview/start').set('Cookie', cookie).send({ focusArea: 'backend' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PREMIUM_REQUIRED');
  });

  it('creates a session with the first question', async () => {
    const { user, cookie } = await createUser();
    mockCreate.mockResolvedValue(textResponse(JSON.stringify({ question: 'Tell me about yourself.' })));

    const res = await request(app).post('/ai/interview/start').set('Cookie', cookie).send({ focusArea: 'backend' });

    expect(res.status).toBe(201);
    expect(res.body.data.question).toBe('Tell me about yourself.');
    expect(res.body.data.sessionId).toBeTruthy();

    const session = await InterviewSession.findById(res.body.data.sessionId);
    expect(session.userId.toString()).toBe(user._id.toString());
    expect(session.focusArea).toBe('backend');
    expect(session.status).toBe('active');
    expect(session.transcript).toHaveLength(1);
    expect(await AIUsageLog.countDocuments({ userId: user._id, endpoint: 'interview' })).toBe(1);
  });

  it('respects the daily AI rate limit', async () => {
    const { user, cookie } = await createUser();

    const limit = Number(process.env.AI_DAILY_LIMIT);
    await AIUsageLog.insertMany(Array.from({ length: limit }, () => ({ userId: user._id, endpoint: 'interview' })));

    const res = await request(app).post('/ai/interview/start').set('Cookie', cookie).send({});

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('AI_RATE_LIMIT_EXCEEDED');
  });
});

describe('POST /ai/interview/:sessionId/respond', () => {
  const startSession = async (cookie) => {
    mockCreate.mockResolvedValue(textResponse(JSON.stringify({ question: 'Tell me about yourself.' })));
    const res = await request(app).post('/ai/interview/start').set('Cookie', cookie).send({ focusArea: 'backend' });
    return res.body.data.sessionId;
  };

  it('appends feedback and the next question to the transcript', async () => {
    const { cookie } = await createUser();
    const sessionId = await startSession(cookie);

    mockCreate.mockResolvedValue(
      textResponse(JSON.stringify({ feedback: 'Good answer', nextQuestion: 'What about scaling?' })),
    );

    const res = await request(app)
      .post(`/ai/interview/${sessionId}/respond`)
      .set('Cookie', cookie)
      .send({ answer: 'I am a backend developer.' });

    expect(res.status).toBe(200);
    expect(res.body.data.feedback).toBe('Good answer');
    expect(res.body.data.nextQuestion).toBe('What about scaling?');
    expect(res.body.data.status).toBe('active');

    const session = await InterviewSession.findById(sessionId);
    expect(session.transcript).toHaveLength(3);
    expect(session.transcript[1]).toMatchObject({ role: 'user', content: 'I am a backend developer.' });
  });

  it('completes the session when the AI returns a null nextQuestion', async () => {
    const { cookie } = await createUser();
    const sessionId = await startSession(cookie);

    mockCreate.mockResolvedValue(textResponse(JSON.stringify({ feedback: 'Great job', nextQuestion: null })));

    const res = await request(app)
      .post(`/ai/interview/${sessionId}/respond`)
      .set('Cookie', cookie)
      .send({ answer: 'Final answer.' });

    expect(res.status).toBe(200);
    expect(res.body.data.nextQuestion).toBeNull();
    expect(res.body.data.status).toBe('completed');

    const session = await InterviewSession.findById(sessionId);
    expect(session.status).toBe('completed');
    expect(session.completedAt).toBeTruthy();
  });

  it('forces completion at the 10-turn cap regardless of the AI response', async () => {
    const { cookie } = await createUser();
    const sessionId = await startSession(cookie);

    mockCreate.mockResolvedValue(
      textResponse(JSON.stringify({ feedback: 'Noted', nextQuestion: 'Another question?' })),
    );

    for (let i = 0; i < 9; i++) {
      const res = await request(app)
        .post(`/ai/interview/${sessionId}/respond`)
        .set('Cookie', cookie)
        .send({ answer: `Answer ${i}` });
      expect(res.status).toBe(200);
    }

    const finalRes = await request(app)
      .post(`/ai/interview/${sessionId}/respond`)
      .set('Cookie', cookie)
      .send({ answer: 'Answer 9' });

    expect(finalRes.status).toBe(200);
    expect(finalRes.body.data.nextQuestion).toBeNull();
    expect(finalRes.body.data.status).toBe('completed');
  });

  it('rejects responses to a completed session', async () => {
    const { cookie } = await createUser();
    const sessionId = await startSession(cookie);

    mockCreate.mockResolvedValue(textResponse(JSON.stringify({ feedback: 'Done', nextQuestion: null })));
    await request(app).post(`/ai/interview/${sessionId}/respond`).set('Cookie', cookie).send({ answer: 'Final.' });

    const res = await request(app)
      .post(`/ai/interview/${sessionId}/respond`)
      .set('Cookie', cookie)
      .send({ answer: 'One more?' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a session belonging to another user', async () => {
    const { cookie: cookieA } = await createUser();
    const { cookie: cookieB } = await createUser();
    const sessionId = await startSession(cookieA);

    const res = await request(app)
      .post(`/ai/interview/${sessionId}/respond`)
      .set('Cookie', cookieB)
      .send({ answer: 'Sneaky.' });

    expect(res.status).toBe(404);
  });
});

describe('POST /ai/interview/:sessionId/end', () => {
  it('marks an active session as completed', async () => {
    const { cookie } = await createUser();
    mockCreate.mockResolvedValue(textResponse(JSON.stringify({ question: 'Q1' })));
    const startRes = await request(app).post('/ai/interview/start').set('Cookie', cookie).send({});
    const sessionId = startRes.body.data.sessionId;

    const res = await request(app).post(`/ai/interview/${sessionId}/end`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });
});

describe('GET /ai/interview and GET /ai/interview/:sessionId', () => {
  it('lists sessions without transcripts and fetches a single session with its transcript', async () => {
    const { cookie } = await createUser();
    mockCreate.mockResolvedValue(textResponse(JSON.stringify({ question: 'Q1' })));
    const startRes = await request(app).post('/ai/interview/start').set('Cookie', cookie).send({});
    const sessionId = startRes.body.data.sessionId;

    const listRes = await request(app).get('/ai/interview').set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].transcript).toBeUndefined();

    const getRes = await request(app).get(`/ai/interview/${sessionId}`).set('Cookie', cookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.transcript).toHaveLength(1);
  });

  it('returns 404 when fetching a session belonging to another user', async () => {
    const { cookie: cookieA } = await createUser();
    const { cookie: cookieB } = await createUser();
    mockCreate.mockResolvedValue(textResponse(JSON.stringify({ question: 'Q1' })));
    const startRes = await request(app).post('/ai/interview/start').set('Cookie', cookieA).send({});
    const sessionId = startRes.body.data.sessionId;

    const res = await request(app).get(`/ai/interview/${sessionId}`).set('Cookie', cookieB);

    expect(res.status).toBe(404);
  });
});
