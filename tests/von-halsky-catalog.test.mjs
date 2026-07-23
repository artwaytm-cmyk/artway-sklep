import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateVonHalskyOffers,
  normalizeVonHalskySettings,
  summarizeVonHalskyCatalog,
  vonHalskyEffectivePrice,
  vonHalskyOfferProjection,
  vonHalskyProductReadiness,
  vonHalskyPublicConfig,
} from '../netlify/functions/lib/domain/von-halsky-catalog.mjs';
import { createVonHalskyApiClient } from '../netlify/functions/lib/domain/von-halsky-api-client.mjs';
import { createVonHalskyRoute } from '../netlify/functions/lib/von-halsky-route.mjs';

test('Von Halsky uznaje produkt z EAN, opisem, zdjęciem i ceną za gotowy', () => {
  const result = vonHalskyProductReadiness({
    nazwa: 'Alexander Edukarty Poznajemy Emocje',
    opis: 'Rozbudowany opis produktu edukacyjnego przeznaczonego dla dzieci i rodziców. Zestaw pomaga rozwijać umiejętności poprzez wspólną, angażującą zabawę.',
    ean: '5906018000030',
    zdjecie: '/img/produkt.webp',
    cena: 39.9,
  });
  assert.equal(result.ready, true);
  assert.equal(result.identifiers.ean, '5906018000030');
  assert.deepEqual(result.issues, []);
});

test('Von Halsky dopuszcza kod producenta z marką, ale wykrywa braki treści', () => {
  const validIdentity = vonHalskyProductReadiness({
    nazwa: 'Gra edukacyjna dla dzieci',
    opis: 'Pełny opis produktu zawiera wszystkie najważniejsze cechy, przeznaczenie, zawartość zestawu i informacje potrzebne klientowi do świadomego wyboru produktu.',
    kodProducenta: '0031',
    marka: 'Alexander',
    zdjecie: '/img/produkt.webp',
    cena: 25,
  });
  assert.equal(validIdentity.ready, true);
  const invalid = vonHalskyProductReadiness({ nazwa: 'Gra', opis: 'https://sklep.pl', cena: 0 });
  assert.equal(invalid.ready, false);
  assert.ok(invalid.issues.some((issue) => issue.includes('7–150')));
  assert.ok(invalid.issues.some((issue) => issue.includes('linków')));
  assert.ok(invalid.issues.some((issue) => issue.includes('EAN')));
});

test('podsumowanie katalogu nie dubluje produktów', () => {
  const summary = summarizeVonHalskyCatalog([
    { nazwa: 'Produkt pierwszy', opis: 'a'.repeat(120), ean: '5906018000030', zdjecie: 'a.jpg', cena: 10 },
    { nazwa: 'Produkt drugi', opis: 'krótki', cena: 20 },
  ]);
  assert.deepEqual(summary, { total: 2, ready: 1, needsWork: 1, withEan: 1, averageScore: 63 });
});

test('ustawienia wymuszają wybraną bezpośrednią integrację API i ograniczają wartości', () => {
  const settings = normalizeVonHalskySettings({
    integrationMethod: 'integrator',
    integrator: 'apilo',
    channelAlias: 'v-h',
    minimumStock: -10,
    maximumStock: 999999,
    syncIntervalMinutes: 1,
    automaticPriceSync: false,
  });
  assert.equal(settings.integrationMethod, 'api');
  assert.equal(settings.integrator, '');
  assert.equal(settings.channelAlias, 'VH');
  assert.equal(settings.minimumStock, 0);
  assert.equal(settings.maximumStock, 99999);
  assert.equal(settings.syncIntervalMinutes, 15);
  assert.equal(settings.automaticPriceSync, false);
});

test('minimalny stan kanału nigdy nie przekracza ustawionego maksimum', () => {
  const settings = normalizeVonHalskySettings({ minimumStock: 50, maximumStock: 5 });
  assert.equal(settings.minimumStock, 5);
  assert.equal(settings.maximumStock, 5);
});

test('publiczny status nigdy nie ujawnia sekretu API', () => {
  const config = vonHalskyPublicConfig({
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.example.test',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'top-secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
    INPOST_VON_HALSKY_HEALTH_PATH: '/health',
    INPOST_VON_HALSKY_CATALOG_PATH: '/catalog',
    INPOST_VON_HALSKY_ORDERS_PATH: '/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '2026-07',
  });
  assert.equal(config.configured, true);
  assert.equal(JSON.stringify(config).includes('top-secret'), false);
});

test('projekcja kanału nie przenosi pól administracyjnych i ogranicza prezentowany stan', () => {
  const projection = vonHalskyOfferProjection({
    id: 'P-1',
    externalId: '0031',
    nazwa: 'Alexander Mistrz mnożenia',
    opis: 'Pełny opis produktu zawiera najważniejsze cechy, przeznaczenie, zawartość zestawu oraz informacje przydatne klientowi podczas wyboru gry edukacyjnej.',
    ean: '5906018000030',
    producent: 'Alexander',
    zdjecia: ['/one.webp', '/two.webp'],
    cena: 39.9,
    stan: 400,
    cenaZakupu: 12.5,
  }, { maximumStock: 25 });
  assert.equal(projection.stock, 25);
  assert.equal(projection.readiness.ready, true);
  assert.equal('cenaZakupu' in projection, false);
});

test('aktywny produkt dostępny u dostawcy zachowuje minimalny stan kanału, a wstrzymany ma zero', () => {
  const settings = { minimumStock: 3, maximumStock: 25 };
  const product = {
    id: 'P-2',
    nazwa: 'Alexander Mistrz mnożenia',
    opis: 'Pełny opis produktu zawiera najważniejsze cechy, przeznaczenie, zawartość zestawu oraz informacje przydatne klientowi podczas wyboru gry edukacyjnej.',
    ean: '5906018000030',
    producent: 'Alexander',
    zdjecie: '/one.webp',
    cena: 39.9,
  };
  const active = vonHalskyOfferProjection({ ...product, stan: 0 }, settings);
  const hidden = vonHalskyOfferProjection({ ...product, stan: 12, sprzedazAktywna: false }, settings);
  assert.equal(active.available, true);
  assert.equal(active.stock, 3);
  assert.equal(hidden.available, false);
  assert.equal(hidden.stock, 0);
});

test('Von Halsky domyślnie dziedziczy cenę Allegro, ale respektuje własną cenę kanału', () => {
  assert.equal(vonHalskyEffectivePrice({ cena: 20, cenaAllegro: 24.9 }), 24.9);
  assert.equal(vonHalskyEffectivePrice({ cena: 20, cenaAllegro: 24.9, cenaVonHalsky: 27.5 }), 27.5);
  const projection = vonHalskyOfferProjection({
    id: 'VH-PRICE', nazwa: 'Produkt testowy Von Halsky', opis: 'Pełny opis produktu zawiera wszystkie wymagane informacje potrzebne klientowi do świadomego i bezpiecznego wyboru produktu.',
    ean: '5906018000030', zdjecie: '/one.webp', cena: 20, cenaAllegro: 24.9,
  });
  assert.equal(projection.price, 24.9);
});

test('ukryty produkt pozostaje zablokowany w projekcji kanału Von Halsky', () => {
  const base = { id: 'VH-HIDDEN', nazwa: 'Produkt ukryty w sprzedaży', opis: 'Pełny opis produktu zawiera wszystkie wymagane informacje potrzebne klientowi do świadomego i bezpiecznego wyboru produktu.', ean: '5906018000030', zdjecie: '/one.webp', cena: 20 };
  for (const blocked of [{ saleAvailable: false }, { ukryty: true }, { _catalog: { availability: { saleAvailable: false } } }]) {
    const projection = vonHalskyOfferProjection({ ...base, ...blocked, stan: 8 }, { minimumStock: 1, maximumStock: 25 });
    assert.equal(projection.available, false);
    assert.equal(projection.stock, 0);
  }
});

test('Von Halsky przy linku źródłowym używa tylko galerii potwierdzonej przez stronę produktu', () => {
  const base = {
    id: 'VH-SOURCE', nazwa: 'Produkt ze źródła producenta', opis: 'Pełny opis produktu zawiera wszystkie wymagane informacje potrzebne klientowi do świadomego i bezpiecznego wyboru produktu.',
    ean: '5906018000030', cena: 20, sourceUrl: 'https://producent.example.pl/produkt/1', zdjecie: 'https://wrong.example.pl/inny.jpg',
  };
  assert.equal(vonHalskyProductReadiness(base).hasImage, false);
  const verified = {
    ...base,
    sourceEvidence: {
      imagePolicyVersion: 2,
      imageSourceType: 'product_source_page',
      imageSourceUrl: base.sourceUrl,
      imageUrls: ['https://cdn.example.pl/produkt-1.jpg'],
    },
  };
  const projection = vonHalskyOfferProjection(verified);
  assert.deepEqual(projection.images, ['https://cdn.example.pl/produkt-1.jpg']);
});

test('kanał wysyła tylko jedną najlepszą kartotekę dla tego samego EAN', () => {
  const { items, conflicts } = deduplicateVonHalskyOffers([
    { externalId: 'A', gtin: '5906018000030', available: true, readiness: { score: 72 } },
    { externalId: 'B', gtin: '5906018000030', available: true, readiness: { score: 98 } },
    { externalId: 'C', gtin: '5906018000108', available: true, readiness: { score: 80 } },
  ]);
  assert.equal(items.length, 2);
  assert.equal(conflicts.length, 1);
  assert.equal(items.find((item) => item.gtin === '5906018000030').externalId, 'B');
});

test('klient API wykonuje rzeczywisty OAuth i test endpointu bez ujawniania sekretu', async () => {
  const calls = [];
  const env = {
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.example.test',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'top-secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
    INPOST_VON_HALSKY_HEALTH_PATH: '/health',
    INPOST_VON_HALSKY_CATALOG_PATH: '/catalog',
    INPOST_VON_HALSKY_ORDERS_PATH: '/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '2026-07',
  };
  const client = createVonHalskyApiClient({
    env,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'bearer-value', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' } });
    },
    now: () => Date.parse('2026-07-23T10:00:00.000Z'),
  });
  const result = await client.checkConnection();
  assert.equal(result.connected, true);
  assert.equal(result.requestId, 'req-1');
  assert.equal(calls.length, 2);
  assert.equal(String(calls[1].options.headers.authorization).includes('bearer-value'), true);
  assert.equal(JSON.stringify(result).includes('top-secret'), false);
});

test('route zapisuje konfigurację i uczciwie zgłasza brak danych prywatnego API', async () => {
  let state;
  let revision = 0;
  const respond = (body, status = 200) => ({ body, status });
  const route = createVonHalskyRoute({
    respond,
    isAdmin: () => true,
    readVersioned: async (_key, fallback) => ({ value: state || fallback, revision }),
    writeIfVersion: async (_key, value) => { state = value; revision += 1; return { modified: true }; },
    env: () => ({}),
  });
  const settingsRequest = new Request('https://artwaytm.pl/api?action=von-halsky-settings', {
    method: 'POST',
    body: JSON.stringify({ integrationMethod: 'api', maximumStock: 30, onboarding: { merchantAccount: true } }),
  });
  const saved = await route(settingsRequest, new URL(settingsRequest.url), 'von-halsky-settings');
  assert.equal(saved.status, 200);
  assert.equal(saved.body.settings.maximumStock, 30);
  assert.equal(saved.body.settings.onboarding.merchantAccount, true);
  const checkRequest = new Request('https://artwaytm.pl/api?action=von-halsky-connection-check', { method: 'POST' });
  const checked = await route(checkRequest, new URL(checkRequest.url), 'von-halsky-connection-check');
  assert.equal(checked.status, 503);
  assert.equal(checked.body.connected, false);
  assert.equal(checked.body.code, 'von_halsky_not_configured');
  const scheduledRequest = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST',
    body: JSON.stringify({ publish: true, scheduled: true }),
  });
  const scheduled = await route(scheduledRequest, new URL(scheduledRequest.url), 'von-halsky-sync-catalog');
  assert.equal(scheduled.status, 200);
  assert.equal(scheduled.body.skipped, true);
  assert.equal(scheduled.body.reason, 'not-configured');
});

test('harmonogram respektuje wyłączoną automatyzację ceny i stanu oraz zapisuje request ID', async () => {
  let state;
  let revision = 0;
  let catalogPayload;
  const env = {
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.example.test',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
    INPOST_VON_HALSKY_HEALTH_PATH: '/health',
    INPOST_VON_HALSKY_CATALOG_PATH: '/catalog',
    INPOST_VON_HALSKY_ORDERS_PATH: '/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '2026-01',
  };
  const fetchImpl = async (url, options = {}) => {
    if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
    catalogPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ accepted: 1 }), { status: 202, headers: { 'content-type': 'application/json', 'x-request-id': 'catalog-req-7' } });
  };
  const respond = (body, status = 200) => ({ body, status });
  const route = createVonHalskyRoute({
    respond,
    isAdmin: () => true,
    readVersioned: async (_key, fallback) => ({ value: state || fallback, revision }),
    writeIfVersion: async (_key, value) => { state = value; revision += 1; return { modified: true }; },
    env: () => env,
    fetchImpl,
    loadCatalog: async () => [{
      id: 'P-7',
      nazwa: 'Alexander Mistrz mnożenia',
      opis: 'Pełny opis produktu zawiera najważniejsze cechy, przeznaczenie, zawartość zestawu oraz informacje przydatne klientowi podczas wyboru gry edukacyjnej.',
      ean: '5906018000030',
      producent: 'Alexander',
      zdjecie: '/one.webp',
      cena: 39.9,
      stan: 8,
    }],
  });
  const settingsRequest = new Request('https://artwaytm.pl/api?action=von-halsky-settings', {
    method: 'POST',
    body: JSON.stringify({ automaticPriceSync: false, automaticStockSync: false }),
  });
  await route(settingsRequest, new URL(settingsRequest.url), 'von-halsky-settings');
  const syncRequest = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST',
    body: JSON.stringify({ publish: true, scheduled: true }),
  });
  const result = await route(syncRequest, new URL(syncRequest.url), 'von-halsky-sync-catalog');
  assert.equal(result.status, 200);
  assert.equal(result.body.sent, 1);
  assert.equal('price' in catalogPayload.items[0], false);
  assert.equal('stock' in catalogPayload.items[0], false);
  assert.equal(result.body.sync.lastRequestId, 'catalog-req-7');
});
