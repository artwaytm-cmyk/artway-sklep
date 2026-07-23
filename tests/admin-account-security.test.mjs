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
    czytajWersjonowane: async (key, fallback) => ({ value: key === 'users' ? users : fallback, etag: '"test-version"' }),
    zapiszJesliWersja: async (key, value) => {
      if (key === 'users') {
        users.items = value.items;
        users.updated_at = value.updated_at;
      }
      return { modified: true, value };
    },
    zapisz: async (key, value) => {
      if (key === 'users') {
        users.items = value.items;
        users.updated_at = value.updated_at;
      }
      return true;
    },
    czyAdmin: () => true,
    primaryAdminEmail: () => 'admin@example.test',
    requestSession: () => ({ email: 'admin@example.test', role: 'admin', authVersion: 1 }),
    publicUser,
    hashPassword,
    verifyPassword,
    createAccountSession,
    accountSessionHeaders,
    clearAccountSessionHeaders: () => ({ 'set-cookie': 'artway_session=; Max-Age=0' }),
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

test('właściciel resetuje Authenticator innego administratora bez zmiany hasła i roli', async () => {
  const passwordHash = await hashPassword('haslo-tomasza');
  const users = { items: [
    { email: 'admin@example.test', rola: 'admin', authVersion: 1 },
    {
      email: 'tomasz@example.test', rola: 'admin', authVersion: 2, passwordHash,
      mfaSecretEncrypted: 'stary-sekret', mfaPendingSecretEncrypted: 'oczekujacy-sekret',
      mfaRecoveryCodeHashes: ['hash'], mfaEmailRecoveryCodeHash: 'email-hash',
    },
  ] };
  const route = createStoreDataRoute(routeDependencies(users));
  const result = await route(new Request('https://artwaytm.pl/api/store?action=account-mfa-reset', {
    method: 'POST', body: JSON.stringify({ email: 'tomasz@example.test' }),
  }), new URL('https://artwaytm.pl/api/store?action=account-mfa-reset'), 'account-mfa-reset');
  assert.equal(result.status, 200);
  assert.equal(result.body.enrollmentRequired, true);
  assert.equal(result.body.sessionInvalidated, true);
  assert.equal(result.headers['set-cookie'], undefined);
  assert.equal(users.items[1].rola, 'admin');
  assert.equal(users.items[1].passwordHash, passwordHash);
  assert.equal(users.items[1].authVersion, 3);
  assert.equal(users.items[1].mfaSecretEncrypted, undefined);
  assert.equal(users.items[1].mfaPendingSecretEncrypted, undefined);
  assert.equal(users.items[1].mfaRecoveryCodeHashes, undefined);
  assert.equal(result.body.user.mfaEnabled, false);
});

test('własny reset Authenticatora wymaga aktualnego hasła i czyści bieżącą sesję', async () => {
  const users = { items: [{
    email: 'admin@example.test', rola: 'admin', authVersion: 4,
    passwordHash: await hashPassword('poprawne-haslo'), mfaSecretEncrypted: 'stary-sekret',
  }] };
  const route = createStoreDataRoute(routeDependencies(users, {
    requestSession: () => ({ email: 'admin@example.test', role: 'admin', authVersion: 4 }),
  }));
  const wrong = await route(new Request('https://artwaytm.pl/api/store?action=account-mfa-reset', {
    method: 'POST', body: JSON.stringify({ email: 'admin@example.test', currentPassword: 'bledne-haslo' }),
  }), new URL('https://artwaytm.pl/api/store?action=account-mfa-reset'), 'account-mfa-reset');
  assert.equal(wrong.status, 401);
  assert.equal(users.items[0].mfaSecretEncrypted, 'stary-sekret');
  assert.equal(users.items[0].authVersion, 4);

  const correct = await route(new Request('https://artwaytm.pl/api/store?action=account-mfa-reset', {
    method: 'POST', body: JSON.stringify({ email: 'admin@example.test', currentPassword: 'poprawne-haslo' }),
  }), new URL('https://artwaytm.pl/api/store?action=account-mfa-reset'), 'account-mfa-reset');
  assert.equal(correct.status, 200);
  assert.match(correct.headers['set-cookie'], /Max-Age=0/);
  assert.equal(correct.body.selfReset, true);
  assert.equal(users.items[0].mfaSecretEncrypted, undefined);
  assert.equal(users.items[0].authVersion, 5);
});

test('główny administrator może nadać i odebrać rolę, a zmiana unieważnia stare sesje', async () => {
  const users = { items: [
    { email: 'admin@example.test', imie: 'Właściciel', rola: 'admin', authVersion: 1 },
    { email: 'pracownik@example.test', imie: 'Pracownik', rola: 'klient', authVersion: 2 },
  ] };
  const route = createStoreDataRoute(routeDependencies(users));
  const grant = await route(new Request('https://artwaytm.pl/api/store?action=store-user-role', {
    method: 'POST', body: JSON.stringify({ email: 'pracownik@example.test', role: 'admin' }),
  }), new URL('https://artwaytm.pl/api/store?action=store-user-role'), 'store-user-role');
  assert.equal(grant.status, 200);
  assert.equal(users.items[1].rola, 'admin');
  assert.equal(users.items[1].authVersion, 3);
  assert.equal(grant.body.sessionInvalidated, true);

  const revoke = await route(new Request('https://artwaytm.pl/api/store?action=store-user-role', {
    method: 'POST', body: JSON.stringify({ email: 'pracownik@example.test', role: 'klient' }),
  }), new URL('https://artwaytm.pl/api/store?action=store-user-role'), 'store-user-role');
  assert.equal(revoke.status, 200);
  assert.equal(users.items[1].rola, 'klient');
  assert.equal(users.items[1].authVersion, 4);
});

test('delegowany administrator i klient nie mogą zarządzać rolami ani usuwać kont', async () => {
  const users = { items: [
    { email: 'admin@example.test', rola: 'admin', authVersion: 1 },
    { email: 'delegowany@example.test', rola: 'admin', authVersion: 1 },
    { email: 'klient@example.test', rola: 'klient', authVersion: 1 },
  ] };
  const delegated = createStoreDataRoute(routeDependencies(users, {
    requestSession: () => ({ email: 'delegowany@example.test', role: 'admin', authVersion: 1 }),
  }));
  const roleResult = await delegated(new Request('https://artwaytm.pl/api/store?action=store-user-role', {
    method: 'POST', body: JSON.stringify({ email: 'klient@example.test', role: 'admin' }),
  }), new URL('https://artwaytm.pl/api/store?action=store-user-role'), 'store-user-role');
  assert.equal(roleResult.status, 403);
  assert.equal(roleResult.body.code, 'owner_required');

  const client = createStoreDataRoute(routeDependencies(users, {
    czyAdmin: () => false,
    requestSession: () => ({ email: 'klient@example.test', role: 'klient', authVersion: 1 }),
  }));
  const deleteResult = await client(new Request('https://artwaytm.pl/api/store?action=store-user-delete', {
    method: 'POST', body: JSON.stringify({ email: 'delegowany@example.test' }),
  }), new URL('https://artwaytm.pl/api/store?action=store-user-delete'), 'store-user-delete');
  assert.equal(deleteResult.status, 403);
  assert.equal(users.items.length, 3);
});

test('konto administratora trzeba najpierw zdegradować, a usunięcie klienta jest trwałe', async () => {
  const users = { items: [
    { email: 'admin@example.test', rola: 'admin', authVersion: 1 },
    { email: 'drugi-admin@example.test', rola: 'admin', authVersion: 1 },
    { email: 'klient@example.test', rola: 'klient', authVersion: 1 },
  ] };
  const route = createStoreDataRoute(routeDependencies(users));
  const protectedResult = await route(new Request('https://artwaytm.pl/api/store?action=store-user-delete', {
    method: 'POST', body: JSON.stringify({ email: 'drugi-admin@example.test' }),
  }), new URL('https://artwaytm.pl/api/store?action=store-user-delete'), 'store-user-delete');
  assert.equal(protectedResult.status, 409);
  assert.equal(protectedResult.body.code, 'admin_role_protected');

  const deleted = await route(new Request('https://artwaytm.pl/api/store?action=store-user-delete', {
    method: 'POST', body: JSON.stringify({ email: 'klient@example.test' }),
  }), new URL('https://artwaytm.pl/api/store?action=store-user-delete'), 'store-user-delete');
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.sessionInvalidated, true);
  assert.equal(users.items.some((user) => user.email === 'klient@example.test'), false);
});

test('utworzenie klienta z panelu nie przełącza sesji administratora i zawsze nadaje rolę klienta', async () => {
  const users = { items: [{ email: 'admin@example.test', rola: 'admin', authVersion: 1 }] };
  const route = createStoreDataRoute(routeDependencies(users, {
    profilKlienta: (user) => ({ ...user, email: String(user.email || '').toLowerCase() }),
  }));
  const created = await route(new Request('https://artwaytm.pl/api/store?action=store-user-create', {
    method: 'POST',
    body: JSON.stringify({ user: { email: 'Nowy@Example.test', imie: 'Nowy Klient', rola: 'admin' }, password: 'bezpieczne-haslo-123' }),
  }), new URL('https://artwaytm.pl/api/store?action=store-user-create'), 'store-user-create');
  assert.equal(created.status, 201);
  assert.equal(created.body.authenticated, false);
  assert.equal(created.headers['set-cookie'], undefined);
  assert.equal(users.items[1].rola, 'klient');
  assert.equal(users.items[1].authVersion, 1);
});

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
