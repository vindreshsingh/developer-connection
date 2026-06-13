/**
 * Tests for Phase 6 Task B3 — POST /ai/resume-feedback and
 * GET /ai/resume-feedback.
 *
 * `@anthropic-ai/sdk`, `pdf-parse`, and Cloudinary uploads are mocked at the
 * module level (no live API calls).
 */

import { jest } from '@jest/globals';

const textResponse = (text) => ({ content: [{ type: 'text', text }] });

const mockCreate = jest.fn();
const mockGetText = jest.fn();
const mockDestroy = jest.fn().mockResolvedValue();
const mockUploadRawBuffer = jest.fn().mockResolvedValue({ secure_url: 'https://cloudinary.test/resume.pdf' });

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

jest.unstable_mockModule('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

jest.unstable_mockModule('../utils/cloudinary.js', () => ({
  uploadImageBuffer: jest.fn(),
  uploadRawBuffer: mockUploadRawBuffer,
  default: {},
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { default: User } = await import('../models/user.js');
const { default: AIUsageLog } = await import('../models/aiUsageLog.js');
const { default: ResumeFeedback } = await import('../models/resumeFeedback.js');
const { hashPassword } = await import('../utils/sanitization.js');

const createUser = async (overrides = {}) => {
  const user = await new User({
    firstName: 'Test',
    email: `resume_${Date.now()}_${Math.random()}@test.com`,
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
  mockGetText.mockResolvedValue({ text: 'Jane Doe — Software Engineer with 5 years of React experience.' });
});

describe('POST /ai/resume-feedback', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post('/ai/resume-feedback')
      .attach('resume', Buffer.from('%PDF-1.4'), { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(401);
  });

  it('blocks non-premium users with PREMIUM_REQUIRED', async () => {
    const { cookie } = await createUser({ isPremium: false });

    const res = await request(app)
      .post('/ai/resume-feedback')
      .set('Cookie', cookie)
      .attach('resume', Buffer.from('%PDF-1.4'), { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PREMIUM_REQUIRED');
  });

  it('rejects non-PDF files', async () => {
    const { cookie } = await createUser();

    const res = await request(app)
      .post('/ai/resume-feedback')
      .set('Cookie', cookie)
      .attach('resume', Buffer.from('not a pdf'), { filename: 'resume.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });

  it('extracts text, uploads the PDF, and stores AI feedback', async () => {
    const { user, cookie } = await createUser();

    mockCreate.mockResolvedValue(
      textResponse(
        JSON.stringify({
          strengths: ['Strong React experience'],
          improvements: ['Quantify impact with metrics'],
          atsNotes: ['Add a skills section'],
        }),
      ),
    );

    const res = await request(app)
      .post('/ai/resume-feedback')
      .set('Cookie', cookie)
      .attach('resume', Buffer.from('%PDF-1.4'), { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.data.resumeUrl).toBe('https://cloudinary.test/resume.pdf');
    expect(res.body.data.feedback.strengths).toEqual(['Strong React experience']);
    expect(mockUploadRawBuffer).toHaveBeenCalledTimes(1);

    const stored = await ResumeFeedback.findOne({ userId: user._id });
    expect(stored.extractedText).toContain('Jane Doe');
    expect(await AIUsageLog.countDocuments({ userId: user._id, endpoint: 'resume-feedback' })).toBe(1);
  });

  it('returns 400 when the PDF has no extractable text', async () => {
    const { cookie } = await createUser();
    mockGetText.mockResolvedValue({ text: '   ' });

    const res = await request(app)
      .post('/ai/resume-feedback')
      .set('Cookie', cookie)
      .attach('resume', Buffer.from('%PDF-1.4'), { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(mockUploadRawBuffer).not.toHaveBeenCalled();
  });

  it('respects the daily AI rate limit', async () => {
    const { user, cookie } = await createUser();

    const limit = Number(process.env.AI_DAILY_LIMIT);
    await AIUsageLog.insertMany(
      Array.from({ length: limit }, () => ({ userId: user._id, endpoint: 'resume-feedback' })),
    );

    const res = await request(app)
      .post('/ai/resume-feedback')
      .set('Cookie', cookie)
      .attach('resume', Buffer.from('%PDF-1.4'), { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('AI_RATE_LIMIT_EXCEEDED');
  });
});

describe('GET /ai/resume-feedback', () => {
  it('returns paginated history for the logged-in user only', async () => {
    const { user, cookie } = await createUser();
    const { user: other } = await createUser();

    await ResumeFeedback.create({
      userId: user._id,
      resumeUrl: 'https://cloudinary.test/a.pdf',
      extractedText: 'a',
      feedback: { strengths: [], improvements: [], atsNotes: [] },
    });
    await ResumeFeedback.create({
      userId: other._id,
      resumeUrl: 'https://cloudinary.test/b.pdf',
      extractedText: 'b',
      feedback: { strengths: [], improvements: [], atsNotes: [] },
    });

    const res = await request(app).get('/ai/resume-feedback').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(user._id.toString());
    expect(res.body.data[0].extractedText).toBeUndefined();
  });
});
