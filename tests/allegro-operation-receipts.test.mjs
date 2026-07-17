import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllegroConnectionStatus, createAllegroOperationReceipts, createAllegroTokenAccess, createAllegroTokenRequester, persistAllegroRefreshFailure } from '../netlify/functions/lib/domain/allegro-operation-receipts.mjs';

function fixture() {
  const db = new Map();
  let clock = new Date('2026-07-18T10:00:00.000Z');
  const service = createAllegroOperationReceipts({
    read: async (key, fallback) => structuredClone(db.has(key) ? db.get(key) : fallback),
    write: async (key, value) => db.set(key, structuredClone(value)),
    now: () => new Date(clock),
  });
  return { db, service, advance: (ms) => { clock = new Date(clock.getTime() + ms); } };
}

test('zatwierdzenie Allegro jest związane z konkretnym produktem', () => {
  const { service } = fixture();
  assert.throws(() => service.validate({ approval: { approved: true, operationId: 'op-1', productId: 'P-2' }, productId: 'P-1' }), (error) => error.code === 'allegro_approval_binding_invalid');
});

test('powtórzenie zakończonego zatwierdzenia nie tworzy drugiej oferty', async () => {
  const { service } = fixture();
  const handle = service.validate({ approval: { approved: true, operationId: 'op-1', productId: 'P-1' }, productId: 'P-1' });
  assert.equal((await service.begin(handle)).kind, 'started');
  await service.complete(handle, { offerId: 'OFF-1', httpStatus: 201, response: { ok: true, offer: { id: 'OFF-1' } } });
  const duplicate = await service.begin(handle);
  assert.equal(duplicate.kind, 'duplicate');
  assert.equal(duplicate.httpStatus, 201);
  assert.equal(duplicate.response.duplicateApproval, true);
});

test('błąd zachowuje audyt i pozwala bezpiecznie ponowić operację', async () => {
  const { db, service } = fixture();
  const handle = service.validate({ approval: { approved: true, operationId: 'op-2', productId: 'P-2' }, productId: 'P-2' });
  await service.begin(handle, { approvedBy: 'admin@example.test' });
  await service.fail(handle, Object.assign(new Error('Odrzucone dane aplikacji'), { code: 'invalid_client' }));
  const retry = await service.begin(handle);
  assert.equal(retry.kind, 'started');
  const receipt = db.get('allegro_operation_receipts').items['op-2'];
  assert.equal(receipt.attempts, 2);
  assert.equal(receipt.status, 'running');
  assert.equal(receipt.approvedBy, 'administrator');
});

test('równoległe uruchomienie tego samego zatwierdzenia jest blokowane', async () => {
  const { service } = fixture();
  const handle = service.validate({ approval: { approved: true, operationId: 'op-3', productId: 'P-3' }, productId: 'P-3' });
  await service.begin(handle);
  await assert.rejects(() => service.begin(handle), (error) => error.code === 'allegro_approval_in_progress');
});

test('błąd invalid_client nie jest prezentowany jako aktywne połączenie', () => {
  const status = buildAllegroConnectionStatus({
    configuration: { configured: true, env: 'production', redirectUri: 'https://example.test/callback', missingEnv: [] },
    auth: { refresh_token: 'secret', last_error: { code: 'invalid_client', message: 'odrzucone' } },
    requiredScope: 'scope:a scope:b',
    recommendedScope: 'scope:a scope:b',
  });
  assert.equal(status.connected, false);
  assert.equal(status.credentialsInvalid, true);
  assert.equal(status.requiresReauth, true);
});

test('odrzucone dane aplikacji są zapisane bez tokenów w komunikacie i zwracają czytelny błąd', async () => {
  let saved = null;
  const error = await persistAllegroRefreshFailure({
    auth: { refresh_token: 'sekret' },
    error: Object.assign(new Error('Client authentication failed'), { code: 'invalid_client' }),
    write: async (_key, value) => { saved = value; },
    now: () => new Date('2026-07-18T12:00:00.000Z'),
  });
  assert.equal(error.code, 'invalid_client');
  assert.equal(error.status, 401);
  assert.equal(saved.connection_status, 'reauth_required');
  assert.equal(saved.last_error.code, 'invalid_client');
});

test('dostęp Allegro odświeża token i usuwa poprzedni błąd połączenia', async () => {
  let saved = null;
  const access = createAllegroTokenAccess({
    configure: () => ({ configured: true, missingEnv: [] }),
    read: async () => ({ refresh_token: 'refresh', last_error: { code: 'invalid_grant' } }),
    write: async (_key, value) => { saved = value; },
    requestToken: async () => ({ access_token: 'access', refresh_token: 'refresh-2', expires_at: Date.now() + 3600_000 }),
  });
  assert.equal(await access({}), 'access');
  assert.equal(saved.connection_status, 'active');
  assert.equal(saved.last_error, undefined);
});

test('żądanie tokenu zachowuje kod błędu OAuth do diagnostyki', async () => {
  const request = createAllegroTokenRequester({
    configure: () => ({ configured: true, authBaseUrl: 'https://allegro.test', clientId: 'id', clientSecret: 'secret', env: 'production' }),
    errorText: (data) => data.error_description,
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'invalid_client', error_description: 'Client authentication failed' }) }),
  });
  await assert.rejects(() => request({}, { grant_type: 'refresh_token' }), (error) => error.code === 'invalid_client' && error.status === 401);
});
