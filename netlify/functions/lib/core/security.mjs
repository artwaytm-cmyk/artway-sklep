import crypto from 'node:crypto';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ORDER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const rateBuckets = new Map();

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sessionSecret() {
  return String(process.env.ARTWAY_SESSION_SECRET || process.env.ARTWAY_ADMIN_TOKEN || '').trim();
}

function sign(encoded) {
  const secret = sessionSecret();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
}

export function createSignedToken(payload, ttlMs = SESSION_TTL_MS) {
  if (!sessionSecret()) return '';
  const now = Date.now();
  const encoded = base64url(JSON.stringify({ v: 1, iat: now, exp: now + ttlMs, jti: crypto.randomUUID(), ...payload }));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySignedToken(token, expectedScope = '') {
  const raw = String(token || '').trim();
  const [encoded, signature, extra] = raw.split('.');
  if (!encoded || !signature || extra || !sessionSecret()) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || payload.v !== 1 || !Number(payload.exp) || Date.now() >= Number(payload.exp)) return null;
    if (expectedScope && payload.scope !== expectedScope) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requestToken(request) {
  const auth = String(request?.headers?.get?.('authorization') || '').trim();
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return String(request?.headers?.get?.('x-session-token') || '').trim();
}

export function requestSession(request) {
  const payload = verifySignedToken(requestToken(request), 'account');
  if (!payload?.sub) return null;
  return { email: String(payload.sub).trim().toLowerCase(), role: payload.role === 'admin' ? 'admin' : 'klient', exp: payload.exp };
}

export function createAccountSession(user = {}) {
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return '';
  return createSignedToken({ scope: 'account', sub: email, role: user.rola === 'admin' ? 'admin' : 'klient' });
}

export function createOrderAccess(order = {}) {
  const email = String(order.email || '').trim().toLowerCase();
  const orderNumber = String(order.nr || '').trim();
  if (!email || !orderNumber) return '';
  return createSignedToken({ scope: 'order', sub: email, orderNumber }, ORDER_TTL_MS);
}

export function verifyOrderAccess(token, order = {}) {
  const payload = verifySignedToken(token, 'order');
  return !!payload
    && String(payload.sub || '').toLowerCase() === String(order.email || '').toLowerCase()
    && String(payload.orderNumber || '') === String(order.nr || '');
}

export async function hashPassword(password) {
  const value = String(password || '');
  const salt = crypto.randomBytes(16);
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(value, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => (error ? reject(error) : resolve(key)));
  });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const expected = Buffer.from(hashRaw, 'base64url');
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password || ''), Buffer.from(saltRaw, 'base64url'), expected.length, {
      N: Number(nRaw), r: Number(rRaw), p: Number(pRaw),
    }, (error, key) => (error ? reject(error) : resolve(key)));
  });
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

export function legacyPasswordHash(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

export function publicUser(user = {}) {
  return {
    imie: String(user.imie || user.email || '').slice(0, 160),
    email: String(user.email || '').trim().toLowerCase().slice(0, 200),
    rola: user.rola === 'admin' ? 'admin' : 'klient',
  };
}

export function clientIp(request) {
  return String(request?.headers?.get?.('x-nf-client-connection-ip')
    || request?.headers?.get?.('x-forwarded-for')
    || 'unknown').split(',')[0].trim().slice(0, 80);
}

export function rateLimit(request, name, limit, windowMs) {
  const now = Date.now();
  const key = `${name}:${clientIp(request)}`;
  const current = rateBuckets.get(key);
  if (!current || now >= current.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  current.count += 1;
  if (rateBuckets.size > 5000) {
    for (const [bucketKey, bucket] of rateBuckets) if (now >= bucket.resetAt) rateBuckets.delete(bucketKey);
  }
  return { ok: current.count <= limit, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}
