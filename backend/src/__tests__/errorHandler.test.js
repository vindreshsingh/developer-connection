/**
 * Tests for Phase 7 Task B2 — centralized Express error handler.
 */

import request from 'supertest';
import app from '../app.js';

describe('errorHandler', () => {
  it('returns a JSON 400 (not an HTML stack trace) for malformed JSON bodies', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ not valid json');

    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).not.toMatch(/<html/i);
  });
});
