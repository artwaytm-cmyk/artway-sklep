import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createPaynowService,
  podpisPaynowV3,
  porownajPodpisPaynow,
} from '../netlify/functions/lib/paynow-service.mjs';

const request = () => new Request('https://artwaytm.pl/api/store', {
  headers: { host: 'artwaytm.pl', 'x-forwarded-proto': 'https' },
});

test('podpis Paynow V3 jest zgodny z oficjalnym wektorem dokumentacji', () => {
  const signature = podpisPaynowV3({
    apiKey: '97a55694-5478-43b5-b406-fb49ebfdd2b5',
    signatureKey: 'b305b996-bca5-4404-a0b7-2ccea3d2b64b',
    idempotencyKey: 'd243fdb3-c287-484a-bb9c-58536f2794c1',
    body: '',
    parameters: {},
  });
  assert.equal(signature, 'fXwLZRwo0WiGll90PPl5oULX9VKA0gpFA/3+E+NRp5E=');
  assert.equal(porownajPodpisPaynow(signature, signature), true);
  assert.equal(porownajPodpisPaynow(signature, `${signature}x`), false);
});

test('payload płatności zawiera PLN, powrót do zamówienia i pełny adres kupującego', () => {
  const service = createPaynowService({ read: async () => ({ items: [] }), write: async () => {} });
  const payload = service.payloadPlatnosciPaynow({
    nr: 'ATM-TEST-1',
    razem: 119,
    email: 'klient@example.com',
    klient: { imie: 'Jan', nazwisko: 'Kowalski', telefon: '530038914' },
    adresDostawy: { ulica: 'Gryfa Pomorskiego', nrDomu: '1', nrLokalu: 'A', kod: '84-207', miasto: 'Bojano' },
  }, request());
  assert.equal(payload.amount, 11900);
  assert.equal(payload.currency, 'PLN');
  assert.equal(payload.externalId, 'ATM-TEST-1');
  assert.equal(payload.continueUrl, 'https://artwaytm.pl/#/dziekujemy/ATM-TEST-1');
  assert.deepEqual(payload.buyer.address.billing, {
    street: 'Gryfa Pomorskiego', houseNumber: '1', apartmentNumber: 'A', zipcode: '84-207', city: 'Bojano', country: 'PL',
  });
  assert.deepEqual(payload.buyer.address.shipping, payload.buyer.address.billing);
});

test('diagnostyka API sprawdza podpisem prawdziwy endpoint metod bez ujawniania kluczy', async () => {
  const previous = {
    key: process.env.PAYNOW_API_KEY,
    signature: process.env.PAYNOW_SIGNATURE_KEY,
    env: process.env.PAYNOW_ENV,
    fetch: globalThis.fetch,
  };
  process.env.PAYNOW_API_KEY = 'test-api-key';
  process.env.PAYNOW_SIGNATURE_KEY = 'test-signature-key';
  process.env.PAYNOW_ENV = 'sandbox';
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/api\.sandbox\.paynow\.pl\/v3\/payments\/paymentmethods\?/);
    assert.ok(options.headers.Signature);
    assert.ok(options.headers['Idempotency-Key']);
    assert.equal(options.headers['Api-Key'], 'test-api-key');
    return new Response(JSON.stringify([{ type: 'PBL', paymentMethods: [{ id: 1000, status: 'ENABLED' }] }]), { status: 200 });
  };
  try {
    const service = createPaynowService({ read: async () => ({ items: [] }), write: async () => {} });
    const result = await service.paynowDiagnostyka(request());
    assert.deepEqual({ ok: result.ok, connected: result.connected, env: result.env, groups: result.methodGroups, enabled: result.enabledMethods }, {
      ok: true, connected: true, env: 'sandbox', groups: 1, enabled: 1,
    });
    assert.equal('apiKey' in result, false);
    assert.equal('signatureKey' in result, false);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of [['PAYNOW_API_KEY', previous.key], ['PAYNOW_SIGNATURE_KEY', previous.signature], ['PAYNOW_ENV', previous.env]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('diagnostyka Paynow jest dostępna tylko administratorowi i ma osobny przycisk w panelu', async () => {
  const [coordinator, route, admin] = await Promise.all([
    readFile(new URL('../netlify/functions/lib/store-app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../netlify/functions/lib/paynow-route.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/15-personalization-and-publishing.js', import.meta.url), 'utf8'),
  ]);
  const backend = `${coordinator}\n${route}`;
  assert.match(coordinator, /createPaynowRoute/);
  assert.match(coordinator, /await paynowRoute\(req, url, action\)/);
  assert.match(backend, /action === 'paynow-diagnose'/);
  assert.match(route, /paynow-diagnose'[\s\S]*?isAdmin\(req, url\)/);
  assert.match(route, /call\(req, '\/v3\/configuration\/shop\/urls', \{\s*method: 'POST'/);
  assert.doesNotMatch(backend, /\/v3\/configuration\/shop\/urls'[\s\S]{0,120}method: 'PATCH'/);
  assert.match(admin, /Testuj podpis i API/);
  assert.match(admin, /testujPaynowAPI\(\)/);
});
