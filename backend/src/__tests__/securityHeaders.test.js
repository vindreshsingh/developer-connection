/**
 * Tests for Phase 7 Task A1 — helmet security headers + report-only CSP.
 */

import request from 'supertest';
import app from '../app.js';

describe('security headers', () => {
  it('sets helmet security headers and a report-only CSP with the expected allowlist', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();

    const csp = res.headers['content-security-policy-report-only'];
    expect(csp).toBeDefined();
    expect(csp).toContain('res.cloudinary.com');
    expect(csp).toContain('checkout.razorpay.com');
  });
});
