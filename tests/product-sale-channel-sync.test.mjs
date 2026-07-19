import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProductSaleChannelLinks, createProductSaleChannelSynchronizer } from '../netlify/functions/lib/domain/product-sale-channel-links.mjs';

const linkedIds = (links, productId) => (links.get(String(productId)) || []).map((item) => item.offerId).sort();

function saleSyncHarness({ offerIds = ['o1'], failOfferId = '', audit = {} } = {}) {
  const live = new Map(offerIds.map((id) => [id, { id, name: 'Gra testowa', status: 'ACTIVE', publication: { status: 'ACTIVE' }, stock: { available: 5, unit: 'UNIT' } }]));
  const mappings = Object.fromEntries(offerIds.map((id) => [id, { offerId: id, productId: 'p1', operator: 'admin-force' }]));
  const calls = [], writes = new Map();
  const read = async (key, fallback) => ({
    allegro_mappings: { items: mappings }, allegro_offers: { items: [...live.values()] },
    allegro_availability_automation: { items: audit },
  }[key] || fallback);
  const write = async (key, value) => { writes.set(key, value); return value; };
  const callAllegro = async (_request, path, options = {}) => {
    const offerId = decodeURIComponent(path.split('/').at(-1));
    if ((options.method || 'GET') === 'GET') return live.get(offerId);
    calls.push({ offerId, options });
    if (offerId === failOfferId && options.bodyObj?.publication?.status === 'ENDED') throw Object.assign(new Error('odrzucono testowo'), { code: 'test_failure' });
    const current = live.get(offerId), status = options.bodyObj.publication.status;
    live.set(offerId, { ...current, status, publication: { ...current.publication, status }, stock: { ...current.stock, ...options.bodyObj.stock } });
    return { status: 200, location: '', data: {} };
  };
  const sync = createProductSaleChannelSynchronizer({
    read, write, callAllegro, waitForOperation: async () => ({ completed: true }),
    getProducts: () => new Map([['p1', { id: 'p1', nazwa: 'Gra testowa' }]]),
    getMappings: (raw) => raw.items || raw, getOffers: (raw) => raw.items || raw,
    getOfferSettings: async () => ({ defaultStock: 5 }), text: (value, max = 500) => String(value ?? '').slice(0, max).trim(),
  });
  return { sync, calls, live, writes };
}

test('sprzedaż wielokanałowa respektuje mapowanie administratora i zapisane ID oferty', () => {
  const links = buildProductSaleChannelLinks({
    products: [{ id: 'p1', nazwa: 'Produkt A' }, { id: 'p2', nazwa: 'Produkt B', allegroOfferId: 'o2' }],
    offers: [{ id: 'o1', name: 'Inna nazwa' }, { id: 'o2', name: 'Produkt B' }],
    mappings: { o1: { offerId: 'o1', productId: 'p1', operator: 'admin-force' } },
  });
  assert.deepEqual(linkedIds(links, 'p1'), ['o1']);
  assert.deepEqual(linkedIds(links, 'p2'), ['o2']);
});

test('mocny EAN łączy ofertę także przy zapisie z zerem wiodącym', () => {
  const links = buildProductSaleChannelLinks({
    products: [{ id: 'p1', nazwa: 'Gra edukacyjna', ean: '5901234123457' }],
    offers: [{ id: 'o1', name: 'Inny tytuł oferty', ean: '05901234123457' }],
  });
  assert.deepEqual(linkedIds(links, 'p1'), ['o1']);
  assert.match(links.get('p1')[0].source, /identyczny EAN\/GTIN/);
});

test('sama podobna nazwa, niejednoznaczny kod i zablokowane mapowanie nie sterują sprzedażą', () => {
  const links = buildProductSaleChannelLinks({
    products: [
      { id: 'p1', nazwa: 'Eco Fun Trylma', kodProducenta: 'ABC' },
      { id: 'p2', nazwa: 'Eco Fun Trylma druga', kodProducenta: 'ABC' },
      { id: 'p3', nazwa: 'Pszczoła origami', ean: '5901234123457', allegroOfferId: 'blocked' },
    ],
    offers: [
      { id: 'same-code', name: 'Dowolna oferta', manufacturerCode: 'ABC' },
      { id: 'name-only', name: 'Eco Fun Trylma' },
      { id: 'blocked', name: 'Pszczoła origami', ean: '5901234123457' },
    ],
    mappings: { blocked: { offerId: 'blocked', productId: 'p3', blocked: true } },
  });
  assert.deepEqual(linkedIds(links, 'p1'), []);
  assert.deepEqual(linkedIds(links, 'p2'), []);
  assert.deepEqual(linkedIds(links, 'p3'), []);
});

test('brak u producenta kończy ofertę i dopiero potem ukrywa sklep', async () => {
  const harness = saleSyncHarness(), data = {};
  const report = await harness.sync({}, [{ ok: true, productId: 'p1', status: 'brak', available: false, checkedAt: '2026-07-19T12:00:00.000Z' }], data);
  assert.equal(report.complete, true);
  assert.equal(report.allegroHidden, 1);
  assert.equal(report.siteHidden, 1);
  assert.equal(data.artway_dostepnosc.p1.status, 'niedostepny');
  assert.equal(harness.calls[0].options.bodyObj.publication.status, 'ENDED');
  assert.equal(harness.live.get('o1').publication.status, 'ENDED');
});

test('błąd jednej oferty wycofuje wcześniejsze części i nie ukrywa samego sklepu', async () => {
  const harness = saleSyncHarness({ offerIds: ['o1', 'o2'], failOfferId: 'o2' }), data = {};
  const report = await harness.sync({}, [{ ok: true, productId: 'p1', status: 'brak', available: false }], data);
  assert.equal(report.complete, false);
  assert.equal(report.failedProducts, 1);
  assert.equal(data.artway_dostepnosc.p1, undefined);
  assert.equal(harness.live.get('o1').publication.status, 'ACTIVE');
  assert.deepEqual(harness.calls.map((call) => `${call.offerId}:${call.options.bodyObj.publication.status}`), ['o1:ENDED', 'o2:ENDED', 'o1:ACTIVE']);
});

test('backend kończy i wznawia ofertę dopiero po potwierdzeniu operacji Allegro', async () => {
  const [store, channelSync] = await Promise.all([
    readFile(new URL('../netlify/functions/lib/store-app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../netlify/functions/lib/domain/product-sale-channel-links.mjs', import.meta.url), 'utf8'),
  ]);
  const source = `${store}\n${channelSync}`;
  assert.match(source, /publication: \{ status, republish: true \}/);
  assert.match(source, /status: 'ENDED'/);
  assert.match(source, /status: 'ACTIVE'/);
  assert.match(source, /allegroCzekajNaOperacjeOferty/);
  assert.match(source, /previousAvailability/);
  assert.match(source, /if \(!saleAutomation\.complete\) return odpowiedz/);
  assert.match(source, /pendingAction: unavailable \? 'END' : 'ACTIVATE'/);
});

test('katalog korzysta z pełnego standardu filtrów centrum wystawiania', async () => {
  const [catalog, styles] = await Promise.all([
    readFile(new URL('../assets/admin.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/29-commerce-catalog-actions.css', import.meta.url), 'utf8'),
  ]);
  assert.match(catalog, /assortment-advanced-grid allegro-listing-advanced-grid/);
  assert.match(catalog, /Produkt lub identyfikator/);
  assert.match(catalog, /Cena Allegro od/);
  assert.match(catalog, /Link producenta/);
  assert.match(catalog, /Wstrzymaj sklep \+ Allegro/);
  assert.match(styles, /catalog-allegro-offer-link\.blocked/);
});
