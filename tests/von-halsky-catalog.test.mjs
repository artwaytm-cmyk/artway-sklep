import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateVonHalskyOffers,
  normalizeVonHalskySettings,
  summarizeVonHalskyCatalog,
  vonHalskyEffectivePrice,
  vonHalskyOfferProjection,
  vonHalskyProductPresentation,
  vonHalskyProductReadiness,
  vonHalskyPublicConfig,
} from '../src/backend/lib/domain/von-halsky-catalog.mjs';
import { createVonHalskyApiClient } from '../src/backend/lib/domain/von-halsky-api-client.mjs';
import { createVonHalskyRoute } from '../src/backend/lib/von-halsky-route.mjs';
import { vonHalskyCheckEditorial, VON_HALSKY_CONTENT_POLICY } from '../src/backend/lib/domain/von-halsky-compliance.mjs';
import {
  matchVonHalskyAttributes,
  suggestVonHalskyCategory,
  vonHalskyAgentPreparationPatch,
} from '../src/backend/lib/domain/von-halsky-agent-preparation.mjs';

test('osobna bramka Von Halsky blokuje logistykę, linki i nieobsługiwany HTML', () => {
  const safe = vonHalskyCheckEditorial({
    nazwa: 'Rodzinna gra edukacyjna Alexander',
    opisKrotki: 'Gra wspiera spostrzegawczość i wspólną zabawę.',
    opis: '<h2>Rozgrywka</h2><p>Zestaw zawiera elementy potrzebne do rozegrania partii zgodnie z dołączoną instrukcją.</p>',
  });
  assert.equal(safe.ok, true);
  const blocked = vonHalskyCheckEditorial({
    nazwa: 'Gra',
    opis: '<table><tr><td>Wysyłka InPost. Więcej na https://sklep.example.pl</td></tr></table>',
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.policyId, VON_HALSKY_CONTENT_POLICY.id);
  assert.ok(blocked.violations.some((item) => item.id === 'delivery_data'));
  assert.ok(blocked.violations.some((item) => item.id === 'external_link'));
  assert.ok(blocked.violations.some((item) => item.id === 'unsupported_markup'));
  const contact = vonHalskyCheckEditorial({ vonHalskyTitle: 'Rodzinna gra edukacyjna', vonHalskyShortDescription: 'Gra rozwijająca spostrzegawczość.', vonHalskyDescription: '<p>Produkt zapewnia wspólną zabawę. Napisz do nas na e-mail, aby poznać więcej informacji o zakupie.</p>' });
  assert.ok(contact.violations.some((item) => item.id === 'contact_data'));
  assert.equal(VON_HALSKY_CONTENT_POLICY.contactPlacement, 'merchant_store_settings_only');
  assert.equal(VON_HALSKY_CONTENT_POLICY.productDescriptionLinksAllowed, false);
});

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
    catalogAutomationEnabled: true,
  });
  assert.equal(settings.integrationMethod, 'api');
  assert.equal(settings.integrator, '');
  assert.equal(settings.channelAlias, 'VH');
  assert.equal(settings.minimumStock, 0);
  assert.equal(settings.maximumStock, 99999);
  assert.equal(settings.syncIntervalMinutes, 15);
  assert.equal(settings.automaticPriceSync, false);
  assert.equal(settings.newOfferPublicationMode, 'manual_selection');
  assert.equal(settings.catalogAutomationEnabled, false);
  assert.equal(settings.agentPreparationEnabled, true);
  assert.equal(settings.agentMinimumConfidence, 0.82);
});

test('Agent Von Halsky automatycznie wybiera tylko jednoznaczną kategorię końcową', () => {
  const clear = suggestVonHalskyCategory(
    { nazwa: 'Balony foliowe serca czerwone', kategoria: 'Balony foliowe', podkategoria: 'Serca' },
    [
      { id: 'leaf-hearts', name: 'Balony foliowe serca', path: 'Impreza › Balony › Balony foliowe serca', leaf: true },
      { id: 'leaf-animals', name: 'Balony foliowe zwierzęta', path: 'Impreza › Balony › Balony foliowe zwierzęta', leaf: true },
      { id: 'parent', name: 'Balony', path: 'Impreza › Balony', leaf: false },
    ],
  );
  assert.equal(clear.selected.id, 'leaf-hearts');
  assert.equal(clear.autoApplicable, true);
  const ambiguous = suggestVonHalskyCategory(
    { nazwa: 'Zestaw kreatywny dla dzieci', kategoria: 'Zabawki' },
    [
      { id: 'one', name: 'Zestawy kreatywne', path: 'Zabawki › Zestawy kreatywne', leaf: true },
      { id: 'two', name: 'Zabawki kreatywne', path: 'Zabawki › Zabawki kreatywne', leaf: true },
    ],
  );
  assert.equal(ambiguous.autoApplicable, false);
});

test('Agent Von Halsky mapuje parametry wyłącznie po dokładnej nazwie i wartości słownika', () => {
  const result = matchVonHalskyAttributes({
    parametry: { Kolor: 'Czerwony', Materiał: 'Folia', Motyw: 'Serce' },
  }, {
    attributes: [
      { id: 'color', name: 'Kolor', required: true, values: [{ id: 'red', name: 'Czerwony' }, { id: 'blue', name: 'Niebieski' }] },
      { id: 'material', name: 'Materiał', required: true, values: [{ id: 'paper', name: 'Papier' }] },
      { id: 'theme', name: 'Motyw', required: false },
    ],
  });
  assert.deepEqual(result.mapped, { color: 'red', theme: 'Serce' });
  assert.deepEqual(result.missingRequired, ['Materiał']);
  assert.equal(result.coverage, 0.5);
  assert.equal(result.exactOnly, true);
});

test('wynik Agenta Von Halsky zapisuje dowody, braki i wersję reguł', () => {
  const patch = vonHalskyAgentPreparationPatch({
    product: { ean: '5906018000030' },
    readiness: { publishable: false, score: 76, issues: ['Brak kategorii'], publicationIssues: [], warnings: ['Jedno zdjęcie'], identifiers: { ean: '5906018000030' } },
    categoryMatch: { selected: { id: 'games', name: 'Gry', path: 'Zabawki › Gry', evidence: ['zgodność 100%'] }, confidence: 0.91, autoApplicable: true },
    attributeMatch: { coverage: 0.5, missingRequired: ['Wiek'], evidence: [{ attributeId: 'players' }] },
    timestamp: '2026-07-29T10:00:00.000Z',
  });
  assert.equal(patch.vonHalskyAgentStatus, 'requires_data');
  assert.equal(patch.vonHalskyAgentEvidence.identity, 'gtin');
  assert.equal(patch.vonHalskyAgentEvidence.attributesMapped, 1);
  assert.deepEqual(patch.vonHalskyAgentMissingAttributes, ['Wiek']);
  assert.match(patch.vonHalskyAgentRulesVersion, /^2026-07-29/);
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

test('Von Halsky dziedziczy treść sklepu i nigdy nie pobiera starszego opisu Allegro', () => {
  const product = {
    nazwa: 'Nazwa produktu w sklepie',
    opisKrotki: 'Krótkie wprowadzenie zapisane w sklepie.',
    opis: 'Aktualny długi opis sklepu z najważniejszymi cechami produktu i kompletną informacją dla klienta.',
    opisAllegro: 'STARY OPIS ALLEGRO',
    allegroDescription: 'INNA TREŚĆ ALLEGRO',
  };
  const presentation = vonHalskyProductPresentation(product);
  assert.equal(presentation.mode, 'store');
  assert.equal(presentation.name, 'Nazwa produktu w sklepie');
  assert.match(presentation.description, /Krótkie wprowadzenie/);
  assert.match(presentation.description, /Aktualny długi opis sklepu/);
  assert.doesNotMatch(presentation.description, /ALLEGRO/);
});

test('Von Halsky pozwala na świadome dopasowanie kanałowe z bezpiecznym fallbackiem do sklepu', () => {
  const product = {
    nazwa: 'Nazwa sklepu',
    opisKrotki: 'Krótki opis sklepu.',
    opis: 'Długi opis sklepu pozostaje źródłem, gdy własne pole kanału jest puste.',
    vonHalskyContentMode: 'custom',
    vonHalskyTitle: 'Tytuł dopasowany do Von Halsky',
    vonHalskyShortDescription: 'Kanałowe wprowadzenie.',
  };
  const presentation = vonHalskyProductPresentation(product);
  assert.equal(presentation.mode, 'custom');
  assert.equal(presentation.name, 'Tytuł dopasowany do Von Halsky');
  assert.match(presentation.description, /Kanałowe wprowadzenie/);
  assert.match(presentation.description, /Długi opis sklepu/);
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

test('klient API zachowuje prefiks ścieżki produkcyjnego adresu bazowego', async () => {
  const calls = [];
  const env = {
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.inpost-group.com/inpsa/',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
    INPOST_VON_HALSKY_HEALTH_PATH: '/v1/offers',
    INPOST_VON_HALSKY_CATALOG_PATH: '/v1/offers/batch',
    INPOST_VON_HALSKY_ORDERS_PATH: '/v1/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '1.5.8',
  };
  const client = createVonHalskyApiClient({
    env,
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ data: [], page: { limit: 30, offset: 0, total: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.listOffers();
  assert.equal(new URL(calls[1]).pathname, '/inpsa/v1/offers');
});

test('klient API obsługuje statusy poleceń, zwroty, reklamacje i refundacje kontraktu 1.5.8', async () => {
  const calls = [];
  const env = {
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.inpost-group.com/inpsa/',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'org-123',
    INPOST_VON_HALSKY_HEALTH_PATH: '/v1/organizations/org-123/offers',
    INPOST_VON_HALSKY_CATALOG_PATH: '/v1/organizations/org-123/offers/batch',
    INPOST_VON_HALSKY_ORDERS_PATH: '/v1/organizations/org-123/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '1.5.8',
  };
  const client = createVonHalskyApiClient({
    env,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ status: 'SUCCESS', data: [], items: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.getOfferCommand('command-1');
  await client.fetchReturns({ limit: 12 });
  await client.fetchClaims({ state: ['RESOLUTION_IN_PROGRESS'] });
  await client.refundOrder('order-1', 19.99);
  await client.resolveClaim('order-1', 'claim-1', 'partial-refund', 'Uznana część roszczenia');
  const requests = calls.slice(1);
  assert.equal(new URL(requests[0].url).pathname, '/inpsa/v1/organizations/org-123/offers/commands/command-1');
  assert.equal(new URL(requests[1].url).pathname, '/inpsa/v1/organizations/org-123/returns');
  assert.equal(new URL(requests[1].url).searchParams.get('limit'), '12');
  assert.equal(new URL(requests[2].url).searchParams.get('state'), 'RESOLUTION_IN_PROGRESS');
  assert.equal(new URL(requests[3].url).pathname, '/inpsa/v1/organizations/org-123/orders/order-1/refund');
  assert.deepEqual(JSON.parse(requests[3].options.body), { amount: { amount: 19.99, currency: 'PLN' } });
  assert.equal(new URL(requests[4].url).pathname, '/inpsa/v1/organizations/org-123/orders/order-1/claims/claim-1/partial-refund');
  assert.deepEqual(JSON.parse(requests[4].options.body), { description: 'Uznana część roszczenia' });
  assert.ok(requests.slice(3).every((request) => request.options.headers['idempotency-key']));
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

test('korekta dopasowania zapisuje aliasy identyfikatorów i blokuje duplikat EAN', async () => {
  const products = [
    { id: 'P-1', nazwa: 'Gra pierwsza', ean: '', producent: '' },
    { id: 'P-2', nazwa: 'Gra druga', ean: '', producent: '' },
  ];
  const saves = [];
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async (_key, fallback) => ({ value: fallback, revision: 0 }),
    writeIfVersion: async () => ({ modified: true }),
    loadCatalog: async () => products,
    saveProductFields: async (input) => {
      saves.push(structuredClone(input));
      Object.assign(products.find((product) => product.id === input.productId), input.fields);
      return { confirmed: true };
    },
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-product-matching', {
    method: 'POST',
    body: JSON.stringify({ productId: 'P-1', ean: '5906018000030', producerCode: '0030', producer: 'Alexander', brand: 'MilliWOOD' }),
  });
  const saved = await route(request, new URL(request.url), 'von-halsky-product-matching');
  assert.equal(saved.status, 200);
  assert.equal(saved.body.matching.method, 'manual_gtin');
  assert.equal(saves[0].fields.ean, '5906018000030');
  assert.equal(saves[0].fields.gtin, '5906018000030');
  assert.equal(saves[0].fields.kodProducenta, '0030');
  assert.equal(saves[0].fields.mpn, '0030');
  const duplicateRequest = new Request('https://artwaytm.pl/api?action=von-halsky-product-matching', {
    method: 'POST',
    body: JSON.stringify({ productId: 'P-2', ean: '5906018000030', producerCode: 'X-2', producer: 'Alexander', brand: 'Alexander' }),
  });
  const duplicate = await route(duplicateRequest, new URL(duplicateRequest.url), 'von-halsky-product-matching');
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'von_halsky_gtin_conflict');
  assert.equal(saves.length, 1);
});

test('route Agenta Von Halsky zapisuje wynik w centralnej kartotece bez publikacji', async () => {
  const product = {
    id: 'VH-AGENT-1',
    nazwa: 'Gra edukacyjna Alexander',
    opis: 'Krótki opis wymagający bezpiecznego uzupełnienia przez wyspecjalizowanego Agenta.',
    ean: '5906018000030',
    producent: 'Alexander',
    zdjecie: '/produkt.webp',
    cena: 39.9,
    vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
  };
  const savedAreas = [], progress = [];
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    sessionOf: () => ({ email: 'admin@example.test' }),
    readVersioned: async (_key, fallback) => ({ value: fallback, revision: 0 }),
    writeIfVersion: async () => ({ modified: true }),
    loadCatalog: async () => [product],
    saveProductFields: async ({ fields, area }) => {
      Object.assign(product, structuredClone(fields));
      savedAreas.push(area);
      return { confirmed: true, product: structuredClone(product) };
    },
    prepareProductWithAgent: async () => ({
      run: { id: 'run-vh-agent-1' },
      applied: {
        applied: true,
        patch: {
          vonHalskyContentMode: 'custom',
          vonHalskyTitle: 'Gra edukacyjna Alexander dla dzieci',
          vonHalskyShortDescription: 'Angażująca gra edukacyjna wspierająca naukę przez wspólną zabawę.',
          vonHalskyDescription: 'Angażująca gra edukacyjna wspierająca naukę przez wspólną zabawę. Zestaw zawiera elementy potrzebne do rozegrania partii i rozwijania spostrzegawczości oraz logicznego myślenia.',
        },
      },
      retryScheduled: false,
    }),
    reportProgress: async (entry) => progress.push(entry),
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-agent-prepare', {
    method: 'POST',
    body: JSON.stringify({ productIds: ['VH-AGENT-1'] }),
  });
  const response = await route(request, new URL(request.url), 'von-halsky-agent-prepare');
  assert.equal(response.status, 200);
  assert.equal(response.body.published, false);
  assert.equal(response.body.ready, 1);
  assert.equal(product.vonHalskyAgentStatus, 'ready');
  assert.equal(product.vonHalskyAgentError, '');
  assert.ok(savedAreas.includes('von-halsky-agent-preparation'));
  assert.deepEqual(progress.map((entry) => entry.phase), ['matching', 'editorial', 'ready']);
});

test('ręczna publikacja tworzy wyłącznie zaznaczoną ofertę i zapisuje request ID', async () => {
  let state;
  let revision = 0;
  let catalogPayload;
  let mutationRequests = 0;
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
    if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify({ data: [], page: { limit: 30, offset: 0, total: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    mutationRequests += 1;
    catalogPayload = JSON.parse(options.body);
    return new Response(JSON.stringify([{ commandId: '11111111-1111-4111-8111-111111111111', offerId: '22222222-2222-4222-8222-222222222222', externalId: 'P-7' }]), { status: 201, headers: { 'content-type': 'application/json', 'x-request-id': 'catalog-req-7' } });
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
      vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
    }],
    saveProductFields: async () => ({ confirmed: true }),
  });
  const settingsRequest = new Request('https://artwaytm.pl/api?action=von-halsky-settings', {
    method: 'POST',
    body: JSON.stringify({ automaticPriceSync: false, automaticStockSync: false, catalogAutomationEnabled: true }),
  });
  await route(settingsRequest, new URL(settingsRequest.url), 'von-halsky-settings');
  const unselectedRequest = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST',
    body: JSON.stringify({ publish: true, scheduled: false }),
  });
  const unselected = await route(unselectedRequest, new URL(unselectedRequest.url), 'von-halsky-sync-catalog');
  assert.equal(unselected.status, 200);
  assert.equal(unselected.body.created, 0);
  assert.equal(unselected.body.skippedNew, 1);
  assert.equal(unselected.body.publicationMode, 'manual_selection');
  assert.equal(mutationRequests, 0);
  const syncRequest = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST',
    body: JSON.stringify({ publish: true, scheduled: false, productIds: ['P-7'] }),
  });
  const result = await route(syncRequest, new URL(syncRequest.url), 'von-halsky-sync-catalog');
  assert.equal(result.status, 200);
  assert.equal(result.body.sent, 1);
  assert.equal(Array.isArray(catalogPayload), true);
  assert.equal(catalogPayload[0].product.categoryId, '33333333-3333-4333-8333-333333333333');
  assert.deepEqual(catalogPayload[0].stock, { quantity: 8, unit: 'UNIT' });
  assert.equal(catalogPayload[0].price.grossPrice.amount, 39.9);
  assert.equal(catalogPayload[0].price.taxRateInfo, '23%');
  assert.equal(result.body.sync.lastRequestId, 'catalog-req-7');
  assert.equal(result.body.publicationMode, 'manual_selection');
  assert.equal(state.settings.catalogAutomationEnabled, false);
  const repeatedRequest = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST',
    body: JSON.stringify({ publish: true, scheduled: false, productIds: ['P-7'] }),
  });
  const repeated = await route(repeatedRequest, new URL(repeatedRequest.url), 'von-halsky-sync-catalog');
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.created, 0);
  assert.equal(mutationRequests, 2);
});

test('publikacja wskazanego produktu zapisuje trwałe potwierdzenie i dokładny postęp pracy', async () => {
  const records = new Map(), revisions = new Map(), progress = [], products = new Map();
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
  const product = {
    id: 'P-17', externalId: 'EXT-17', nazwa: 'Alexander Gra edukacyjna',
    opis: 'Pełny i prawdziwy opis produktu zawierający cechy, przeznaczenie oraz zawartość potrzebną klientowi do świadomego wyboru produktu.',
    ean: '5906018000030', producent: 'Alexander', zdjecie: '/one.webp', cena: 39.9, stan: 8,
    vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
    vonHalskyEditorialSyncPending: true, vonHalskyEditorialSyncRunId: 'run-17',
    contentEditorial: { channelStates: { vonHalsky: { status: 'ready', publicationStatus: 'queued' } } },
  };
  products.set(product.id, structuredClone(product));
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }), isAdmin: () => true,
    readVersioned: async (key, fallback) => ({ value: structuredClone(records.get(key) ?? fallback), revision: revisions.get(key) || 0 }),
    writeIfVersion: async (key, value) => { records.set(key, structuredClone(value)); revisions.set(key, (revisions.get(key) || 0) + 1); return { modified: true }; },
    env: () => env,
    fetchImpl: async (url, options = {}) => String(url).includes('/token')
      ? new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } })
      : (options.method || 'GET') === 'GET'
        ? new Response(JSON.stringify({ data: [], page: { limit: 30, offset: 0, total: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } })
        : new Response(JSON.stringify([{ commandId: '11111111-1111-4111-8111-111111111111', offerId: '22222222-2222-4222-8222-222222222222', externalId: 'EXT-17' }]), { status: 201, headers: { 'content-type': 'application/json', 'x-request-id': 'vh-receipt-17' } }),
    loadCatalog: async () => [product],
    saveProductFields: async ({ productId, fields = {}, remove = [] }) => {
      const next = { ...(products.get(String(productId)) || { id: productId }), ...structuredClone(fields) };
      for (const field of remove) delete next[field];
      products.set(String(productId), next);
      return { confirmed: true, product: structuredClone(next) };
    },
    reportProgress: async (work) => progress.push(structuredClone(work)),
  });
  const settingsRequest = new Request('https://artwaytm.pl/api?action=von-halsky-settings', {
    method: 'POST', body: JSON.stringify({ automaticPriceSync: true }),
  });
  await route(settingsRequest, new URL(settingsRequest.url), 'von-halsky-settings');
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST', body: JSON.stringify({ publish: true, productIds: ['P-17'] }),
  });
  const result = await route(request, new URL(request.url), 'von-halsky-sync-catalog');
  assert.equal(result.status, 200);
  assert.equal(result.body.sent, 1);
  const saved = products.get('P-17');
  assert.equal(saved.vonHalskyEditorialSyncState, 'synced');
  assert.equal(saved.contentEditorial.channelStates.vonHalsky.publicationStatus, 'confirmed');
  assert.equal(saved.contentEditorial.channelStates.vonHalsky.publicationReceipt, 'vh-receipt-17');
  assert.deepEqual(progress.map((item) => item.phase), ['sending_to_von_halsky', 'confirmed_by_von_halsky']);
});
