/**
 * AES-256-GCM symmetric encryption utility.
 *
 * Used to store OAuth access tokens at rest in the database.
 * The key is NEVER returned to the client — it only lives server-side.
 *
 * ENV:
 *   ENCRYPTION_KEY — 64 hex chars (32 bytes) generated with:
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Storage format (JSON string):
 *   { iv: "<hex>", tag: "<hex>", ciphertext: "<hex>" }
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12; // 96-bit IV — recommended for GCM
const TAG_BYTES  = 16; // 128-bit auth tag (GCM default)

/**
 * Returns a 32-byte Buffer from the ENCRYPTION_KEY env var.
 * Called lazily so tests can set process.env.ENCRYPTION_KEY before import side-effects.
 */
function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string.
 *
 * @param {string} plaintext
 * @returns {{ iv: string, tag: string, ciphertext: string }}
 *   All fields are hex-encoded strings, safe to JSON.stringify and store in MongoDB.
 */
export function encrypt(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encrypt: plaintext must be a string');
  }

  const key = getKey();
  const iv  = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    iv:         iv.toString('hex'),
    tag:        tag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };
}

/**
 * Decrypt a payload produced by `encrypt`.
 *
 * @param {{ iv: string, tag: string, ciphertext: string }} payload
 * @returns {string} The original plaintext.
 * @throws If the auth tag is invalid (data tampered) or the key is wrong.
 */
export function decrypt({ iv, tag, ciphertext }) {
  if (iv == null || tag == null || ciphertext == null) {
    throw new TypeError('decrypt: payload must have iv, tag, and ciphertext');
  }

  const key      = getKey();
  const ivBuf    = Buffer.from(iv, 'hex');
  const tagBuf   = Buffer.from(tag, 'hex');
  const dataBuf  = Buffer.from(ciphertext, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(tagBuf);

  const decrypted = Buffer.concat([
    decipher.update(dataBuf),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Convenience: encrypt a plaintext and return the JSON string that gets
 * stored in `User.oauthProviders[].accessToken`.
 *
 * @param {string} plaintext
 * @returns {string}
 */
export function encryptToken(plaintext) {
  return JSON.stringify(encrypt(plaintext));
}

/**
 * Convenience: decrypt a JSON string stored in `User.oauthProviders[].accessToken`.
 *
 * @param {string} stored  JSON string: { iv, tag, ciphertext }
 * @returns {string}
 */
export function decryptToken(stored) {
  return decrypt(JSON.parse(stored));
}
