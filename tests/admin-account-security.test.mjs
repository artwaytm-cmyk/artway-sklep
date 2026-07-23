import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStoreDataRoute } from '../netlify/functions/lib/store-data-route.mjs';
import {
  accountSessionHeaders,
  createAccountSession,
  hashPassword,
  publicUser,
  requestSession,
  verifyPassword,
} from '../netlify/functions/lib/core/security.mjs';
import {
  createAdminMfaChallenge,
  createMfaEmailRecovery,
  verifyAdminMfaChallenge,
  verifyMfaEmailRecoveryChallenge,
  verifyMfaEmailRecoveryCode,
} from '../netlify/functions/lib/core/mfa.mjs';

process.env.ARTWAY_SESSION_SECRET = 'admin-security-test-session-secret';
process.env.ARTWAY_MFA_ENCRYPTION_SECRET = 'admin-security-test-mfa-secret';

const jsonResponse = (body, status = 200, headers = {}) => ({ body, status, headers });

function routeDependencies(users, overrides = {}) {
  return {
    odpowiedz: jsonResponse,
    tekst: (value, max = 200) => String(value ?? '').slice(0, max),
    ograniczRuch: () => null,
    czytaj: async (key, fallback) => key === 'users' ? users : fallback,
    zapisz: async (key, value) => {
      if (key === 'users') {
        users.items = value.items;
        users.updated_at = value.updated_at;
      }
      return true;
    },
    requestSession: () => ({ email: 'admin@example.test', role: 'admin' }),
    publicUser,
    hashPassword,
    verifyPassword,
    createAccountSession,
    accountSessionHeaders,
    createAdminMfaChallenge,
    createMfaEmailRecovery,
    verifyAdminMfaChallenge,
    verifyMfaEmailRecoveryChallenge,
    verifyMfaEmailRecoveryCode,
    recoveryCodeHash: () => '',
    verifyMfaCode: () => false,
    ...overrides,
  };
}

test('zmiana hasła administratora wymaga starego hasła i zapisuje nowe po stronie serwera', async () => {
  const users = { items: [{ email: 'admin@example.test', imie: 'Admin', rola: 'admin', passwordHash: await hashPassword('stare-haslo') }] };
  const route = createStoreDataRoute(routeDependencies(users));
  const result = await route(new Request('https://artwaytm.pl/api/store?action=account-password-change', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'stare-haslo', newPassword: 'nowe-bezpieczne-haslo' }),
  }), new URL('https://artwaytm.pl/api/store?action=account-password-change'), 'account-password-change');
  assert.equal(result.status, 200);
  assert.equal(result.body.changed, true);
  assert.equal(await verifyPassword('nowe-bezpieczne-haslo', users.items[0].passwordHash), true);
  assert.equal(await verifyPassword('stare-haslo', users.items[0].passwordHash), false);
});

test('kod odzyskania MFA trafia wyłącznie do wiadomości e-mail, a serwer zapisuje tylko skrót', async () => {
  const users = { items: [{ email: 'admin@example.test', imie: 'Admin', rola: 'admin', mfaSecretEncrypted: 'encrypted-secret' }] };
  let sent = null;
  const route = createStoreDataRoute(routeDependencies(users, {
    wyslijEmailSMTP: async (message) => { sent = message; return { message_id: 'test-message' }; },
  }));
  const passwordChallenge = createAdminMfaChallenge('admin@example.test', false);
  const requested = await route(new Request('https://artwaytm.pl/api/store?action=login-mfa-email-request', {
    method: 'POST',
    body: JSON.stringify({ challengeToken: passwordChallenge }),
  }), new URL('https://artwaytm.pl/api/store?action=login-mfa-email-request'), 'login-mfa-email-request');
  assert.equal(requested.status, 200);
  assert.equal(requested.body.sent, true);
  assert.equal(requested.body.code, undefined);
  assert.ok(sent?.text);
  const code = sent.text.match(/\b\d{6}\b/)?.[0];
  assert.ok(code);
  assert.notEqual(users.items[0].mfaEmailRecoveryCodeHash, code);

  const verified = await route(new Request('https://artwaytm.pl/api/store?action=login-mfa-email-verify', {
    method: 'POST',
    body: JSON.stringify({ recoveryChallengeToken: requested.body.recoveryChallengeToken, code }),
  }), new URL('https://artwaytm.pl/api/store?action=login-mfa-email-verify'), 'login-mfa-email-verify');
  assert.equal(verified.status, 200);
  assert.equal(verified.body.authenticated, true);
  assert.equal(users.items[0].mfaEmailRecoveryCodeHash, undefined);
  assert.equal(users.items[0].mfaEmailRecoveryNonce, undefined);
});

test('sesja administratora respektuje wybrany limit bezczynności', () => {
  const before = Date.now();
  const token = createAccountSession({ email: 'admin@example.test', rola: 'admin', adminIdleTimeoutMinutes: 15 });
  const session = requestSession(new Request('https://artwaytm.pl/api/store', { headers: { authorization: `Bearer ${token}` } }));
  assert.equal(session.role, 'admin');
  assert.ok(session.exp >= before + 14 * 60 * 1000);
  assert.ok(session.exp <= before + 16 * 60 * 1000);
});

test('rejestracja po stronie serwera odrzuca niepełny adres e-mail przed zapisem', async () => {
  const users = { items: [] };
  let writes = 0;
  const route = createStoreDataRoute(routeDependencies(users, {
    profilKlienta: () => ({ email: 'niepoprawny', imie: 'Test Konta' }),
    zapisz: async () => { writes += 1; return true; },
  }));
  const result = await route(new Request('https://artwaytm.pl/api/store?action=account-register', {
    method: 'POST',
    body: JSON.stringify({ user: { email: 'niepoprawny', imie: 'Test Konta' }, password: 'bezpieczne-haslo' }),
  }), new URL('https://artwaytm.pl/api/store?action=account-register'), 'account-register');
  assert.equal(result.status, 422);
  assert.equal(result.body.code, 'email');
  assert.equal(writes, 0);
});

test('interfejs nie generuje ani nie pobiera pliku z sekretami MFA', async () => {
  const [source, backend] = await Promise.all([
    readFile(new URL('../src/frontend/06c-storefront-account.js', import.meta.url), 'utf8'),
    readFile(new URL('../netlify/functions/lib/store-data-route.mjs', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(source, /artway-kody-awaryjne\.txt|pobierzKodyAwaryjneMfa|recoveryCodes/);
  assert.doesNotMatch(backend, /recoveryCodeHash\(supplied\)/);
  assert.match(source, /login-mfa-email-request/);
  assert.match(source, /login-mfa-email-verify/);
  assert.match(source, /minlength="8"/);
});
