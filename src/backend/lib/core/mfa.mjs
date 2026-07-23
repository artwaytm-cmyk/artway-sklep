import crypto from 'node:crypto';
import { createSignedToken, verifySignedToken } from './security.mjs';

const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MFA_EMAIL_RECOVERY_TTL_MS = 10 * 60 * 1000;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function mfaKey() {
  const source = String(process.env.ARTWAY_MFA_ENCRYPTION_SECRET || process.env.ARTWAY_SESSION_SECRET || '').trim();
  return source ? crypto.createHash('sha256').update(`artway-mfa:${source}`).digest() : null;
}

function base32Encode(input) {
  let bits = '', output = '';
  for (const byte of input) bits += byte.toString(2).padStart(8, '0');
  for (let index = 0; index < bits.length; index += 5) output += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  return output;
}

function base32Decode(value) {
  const clean = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) return Buffer.alloc(0);
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function encryptMfaSecret(secret) {
  const key = mfaKey();
  if (!key) throw new Error('Brak osobnego sekretu sesji dla MFA.');
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptMfaSecret(stored) {
  const key = mfaKey(), [version, ivRaw, tagRaw, encryptedRaw, extra] = String(stored || '').split('.');
  if (!key || version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw || extra) return '';
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
  } catch { return ''; }
}

export function createMfaEnrollment(email) {
  const secret = base32Encode(crypto.randomBytes(20));
  const account = String(email || '').trim().toLowerCase();
  const issuer = 'Artway-TM';
  const uri = `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  return { secret, encryptedSecret: encryptMfaSecret(secret), uri };
}

export function mfaProvisioningUri(email, secret) {
  const account = String(email || '').trim().toLowerCase(), issuer = 'Artway-TM';
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${encodeURIComponent(String(secret || ''))}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function totpAt(secret, counter) {
  const key = base32Decode(secret), buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(buffer).digest(), offset = digest[digest.length - 1] & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

export function verifyMfaCode(secret, code, now = Date.now()) {
  const supplied = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(supplied) || !secret) return false;
  const counter = Math.floor(now / 30_000);
  return [-1, 0, 1].some((offset) => {
    const expected = totpAt(secret, counter + offset);
    return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  });
}

export function createAdminMfaChallenge(email, setup = false) {
  return createSignedToken({ scope: 'admin-mfa', sub: String(email || '').trim().toLowerCase(), setup: setup === true }, MFA_CHALLENGE_TTL_MS);
}

export function verifyAdminMfaChallenge(token) {
  const payload = verifySignedToken(token, 'admin-mfa');
  return payload?.sub ? { email: String(payload.sub).trim().toLowerCase(), setup: payload.setup === true } : null;
}

export function createMfaEmailRecovery(email) {
  const account = String(email || '').trim().toLowerCase();
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const nonce = crypto.randomBytes(18).toString('base64url');
  return {
    code,
    nonce,
    codeHash: mfaEmailRecoveryCodeHash(account, code),
    challengeToken: createSignedToken({ scope: 'admin-mfa-email', sub: account, nonce }, MFA_EMAIL_RECOVERY_TTL_MS),
    expiresAt: new Date(Date.now() + MFA_EMAIL_RECOVERY_TTL_MS).toISOString(),
  };
}

export function verifyMfaEmailRecoveryChallenge(token) {
  const payload = verifySignedToken(token, 'admin-mfa-email');
  return payload?.sub && payload?.nonce
    ? { email: String(payload.sub).trim().toLowerCase(), nonce: String(payload.nonce) }
    : null;
}

export function mfaEmailRecoveryCodeHash(email, code) {
  const key = mfaKey();
  if (!key) return '';
  return crypto.createHmac('sha256', key)
    .update(`email-recovery:${String(email || '').trim().toLowerCase()}:${String(code || '').replace(/\D/g, '')}`)
    .digest('base64url');
}

export function verifyMfaEmailRecoveryCode(email, code, expectedHash) {
  const actual = mfaEmailRecoveryCodeHash(email, code);
  const expected = String(expectedHash || '');
  if (!actual || !expected) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
