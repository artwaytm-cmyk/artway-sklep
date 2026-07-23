import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVonHalskySettings,
  summarizeVonHalskyCatalog,
  vonHalskyProductReadiness,
  vonHalskyPublicConfig,
} from '../netlify/functions/lib/domain/von-halsky-catalog.mjs';
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
  assert.deepEqual(summary, { total: 2, ready: 1, needsWork: 1, withEan: 1, averageScore: 73 });
});

test('ustawienia ograniczają interwał, alias i stany kanału', () => {
  const settings = normalizeVonHalskySettings({
    integrationMethod: 'integrator',
    integrator: 'apilo',
    channelAlias: 'v-h',
    minimumStock: -10,
    maximumStock: 999999,
    syncIntervalMinutes: 1,
    automaticPriceSync: false,
  });
  assert.equal(settings.integrationMethod, 'integrator');
  assert.equal(settings.integrator, 'apilo');
  assert.equal(settings.channelAlias, 'VH');
  assert.equal(settings.minimumStock, 0);
  assert.equal(settings.maximumStock, 99999);
  assert.equal(settings.syncIntervalMinutes, 15);
  assert.equal(settings.automaticPriceSync, false);
});

test('publiczny status nigdy nie ujawnia sekretu API', () => {
  const config = vonHalskyPublicConfig({
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.example.test',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'top-secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
  });
  assert.equal(config.configured, true);
  assert.equal(JSON.stringify(config).includes('top-secret'), false);
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
});
