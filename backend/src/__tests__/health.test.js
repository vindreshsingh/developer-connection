/**
 * Tests for Phase 7 Task B4 — GET /health.
 */

import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';

describe('GET /health', () => {
  it('returns 200 with mongo connected when the DB connection is up', async () => {
    expect(mongoose.connection.readyState).toBe(1);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', mongo: 'connected' });
  });

  it('returns 503 when the DB connection is down', async () => {
    // Shadow the prototype's readyState accessor with an own data property;
    // `delete` afterwards restores the original getter/setter so the shared
    // connection used by setup.js's afterAll teardown is unaffected.
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 0,
    });

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', mongo: 'disconnected' });

    delete mongoose.connection.readyState;
  });
});
