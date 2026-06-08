import express from 'express';
import request from 'supertest';
import { createAuthRateLimiter } from '../middlewares/rateLimiter.js';

const buildTestApp = (max) => {
  const app = express();
  app.post('/limited', createAuthRateLimiter(max), (req, res) => res.status(200).json({ ok: true }));
  return app;
};

describe('authRateLimiter', () => {
  it('allows requests under the threshold and returns 429 with a clear message once exceeded', async () => {
    const app = buildTestApp(2);

    const first = await request(app).post('/limited');
    const second = await request(app).post('/limited');
    const third = await request(app).post('/limited');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body.error).toMatch(/Too many requests/);
  });
});
