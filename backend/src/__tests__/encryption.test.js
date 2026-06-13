/**
 * Tests for backend/src/utils/encryption.js
 *
 * Strategy:
 * - Set a deterministic ENCRYPTION_KEY before any import so getKey() always works.
 * - Test encrypt/decrypt round-trip, encryptToken/decryptToken convenience wrappers,
 *   tampering detection (auth-tag failure), and missing-key error.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// ── Key fixtures ─────────────────────────────────────────────────────────────

// 64 hex chars = 32 bytes — valid AES-256 key
const VALID_KEY = 'a'.repeat(64);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Dynamically import the module so env is set beforehand. */
async function loadEncryption() {
  // Jest module cache may hold the old import; use a cache-busting param-free re-import
  // (Jest resets modules between files; within a file we rely on dynamic import).
  const mod = await import('../utils/encryption.js');
  return mod;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('encryption utility', () => {
  let savedKey;

  beforeAll(() => {
    savedKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  afterAll(() => {
    if (savedKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = savedKey;
    }
  });

  describe('encrypt / decrypt round-trip', () => {
    it('recovers the original plaintext', async () => {
      const { encrypt, decrypt } = await loadEncryption();
      const plaintext = 'gho_SomeGitHubAccessToken123';
      const payload = encrypt(plaintext);

      expect(payload).toHaveProperty('iv');
      expect(payload).toHaveProperty('tag');
      expect(payload).toHaveProperty('ciphertext');

      const recovered = decrypt(payload);
      expect(recovered).toBe(plaintext);
    });

    it('produces a different ciphertext each call (random IV)', async () => {
      const { encrypt } = await loadEncryption();
      const plaintext = 'same-plaintext';
      const p1 = encrypt(plaintext);
      const p2 = encrypt(plaintext);
      expect(p1.ciphertext).not.toBe(p2.ciphertext);
      expect(p1.iv).not.toBe(p2.iv);
    });

    it('handles empty string', async () => {
      const { encrypt, decrypt } = await loadEncryption();
      const payload = encrypt('');
      expect(decrypt(payload)).toBe('');
    });

    it('handles unicode / emoji strings', async () => {
      const { encrypt, decrypt } = await loadEncryption();
      const plaintext = '🔐 Ünïcödé tøkën 日本語';
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it('handles long tokens (512 chars)', async () => {
      const { encrypt, decrypt } = await loadEncryption();
      const long = 'x'.repeat(512);
      expect(decrypt(encrypt(long))).toBe(long);
    });
  });

  describe('encryptToken / decryptToken (JSON wrapper)', () => {
    it('stores a JSON string and recovers the original token', async () => {
      const { encryptToken, decryptToken } = await loadEncryption();
      const token = 'ya29.GoogleAccessToken';
      const stored = encryptToken(token);
      expect(typeof stored).toBe('string');
      // Must be valid JSON with the three expected fields
      const parsed = JSON.parse(stored);
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('tag');
      expect(parsed).toHaveProperty('ciphertext');

      expect(decryptToken(stored)).toBe(token);
    });

    it('round-trips a LinkedIn token correctly', async () => {
      const { encryptToken, decryptToken } = await loadEncryption();
      const token = 'AQXNnd_some_linkedin_token_value';
      expect(decryptToken(encryptToken(token))).toBe(token);
    });
  });

  describe('tamper detection (GCM auth tag)', () => {
    it('throws when the ciphertext is modified', async () => {
      const { encrypt, decrypt } = await loadEncryption();
      const payload = encrypt('sensitive');
      // Flip the first byte of ciphertext
      const tampered = {
        ...payload,
        ciphertext: 'ff' + payload.ciphertext.slice(2),
      };
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws when the auth tag is modified', async () => {
      const { encrypt, decrypt } = await loadEncryption();
      const payload = encrypt('sensitive');
      const tampered = {
        ...payload,
        tag: '00'.repeat(16), // 32 hex chars = 16 bytes
      };
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws when the IV is modified', async () => {
      const { encrypt, decrypt } = await loadEncryption();
      const payload = encrypt('sensitive');
      const tampered = {
        ...payload,
        iv: '00'.repeat(12), // 24 hex chars = 12 bytes
      };
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('input validation', () => {
    it('encrypt throws TypeError for non-string input', async () => {
      const { encrypt } = await loadEncryption();
      expect(() => encrypt(12345)).toThrow(TypeError);
      expect(() => encrypt(null)).toThrow(TypeError);
    });

    it('decrypt throws TypeError when payload fields are missing', async () => {
      const { decrypt } = await loadEncryption();
      expect(() => decrypt({ iv: 'abc', tag: 'def' })).toThrow(TypeError);
      expect(() => decrypt({ iv: 'abc', ciphertext: 'xyz' })).toThrow(TypeError);
      expect(() => decrypt({})).toThrow(TypeError);
    });
  });

  describe('missing / invalid ENCRYPTION_KEY', () => {
    it('throws when ENCRYPTION_KEY is not set', async () => {
      const origKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      const { encrypt } = await loadEncryption();
      expect(() => encrypt('anything')).toThrow(/ENCRYPTION_KEY/);

      process.env.ENCRYPTION_KEY = origKey;
    });

    it('throws when ENCRYPTION_KEY is too short', async () => {
      const origKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'tooshort';

      const { encrypt } = await loadEncryption();
      expect(() => encrypt('anything')).toThrow(/ENCRYPTION_KEY/);

      process.env.ENCRYPTION_KEY = origKey;
    });
  });
});
