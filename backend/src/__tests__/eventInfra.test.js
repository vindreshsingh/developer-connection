/**
 * Phase 10 — verifies the graceful-degradation contract when REDIS_URL is
 * unset (the default in CI/local): the cache is a transparent no-op and
 * enqueue() runs the handler inline.
 */

import { jest } from '@jest/globals';

describe('Phase 10 infra fallbacks (no Redis)', () => {
  beforeAll(() => {
    delete process.env.REDIS_URL; // ensure disabled regardless of env
  });

  describe('cache util', () => {
    it('get returns null and set/del are no-ops without Redis', async () => {
      const cache = await import('../utils/cache.js');

      await expect(cache.get('any:key')).resolves.toBeNull();
      await expect(cache.set('any:key', { a: 1 }, 60)).resolves.toBeUndefined();
      await expect(cache.del('any:key')).resolves.toBeUndefined();
    });

    it('remember computes and returns the value (no caching layer)', async () => {
      const cache = await import('../utils/cache.js');
      const compute = jest.fn().mockResolvedValue({ ok: true });

      const first = await cache.remember('k', 60, compute);
      const second = await cache.remember('k', 60, compute);

      expect(first).toEqual({ ok: true });
      expect(second).toEqual({ ok: true });
      // No Redis → every call recomputes (always a miss).
      expect(compute).toHaveBeenCalledTimes(2);
    });
  });

  describe('enqueue inline fallback', () => {
    it('runs the handler synchronously when Redis is disabled', async () => {
      // Mock the email transport so the inline email handler doesn't hit SMTP.
      const sendMail = jest.fn().mockResolvedValue(true);
      jest.unstable_mockModule('nodemailer', () => ({
        default: { createTransport: jest.fn(() => ({ sendMail })) },
      }));

      const { enqueue } = await import('../queues/index.js');
      const { QUEUE } = await import('../queues/names.js');

      await enqueue(QUEUE.EMAIL, { to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>' });

      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0][0].to).toBe('a@b.com');
    });

    it('throws for an unknown queue with no inline handler', async () => {
      const { enqueue } = await import('../queues/index.js');
      await expect(enqueue('does-not-exist', {})).rejects.toThrow(/No inline handler/);
    });
  });
});
