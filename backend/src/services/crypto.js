'use strict';
// AES-256-GCM encrypt/decrypt for OAuth refresh tokens stored in SQLite.
// Layout: [12 bytes IV][16 bytes authTag][N bytes ciphertext] — encoded as base64.
// ENCRYPTION_KEY env var must be 64 hex characters (32 bytes).
// Verified: round-trip tested on Node v24.14.1.
const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);             // 96-bit IV (recommended for GCM)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();           // 128-bit (16 bytes) by default
  // Pack: [iv 12B][authTag 16B][ciphertext NB] → base64
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(base64data) {
  const buf = Buffer.from(base64data, 'base64');
  const iv      = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };
