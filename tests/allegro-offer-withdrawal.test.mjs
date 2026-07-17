import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAllegroOfferWithdrawalRoute } from '../netlify/functions/lib/allegro-offer-withdrawal-route.mjs';

const storePath = new URL('../netlify/functions/lib/store-app.mjs', import.meta.url);
const routePath = new URL('../netlify/functions/lib/allegro-offer-withdrawal-route.mjs', import.meta.url);
const frontendPath = new URL('../src/frontend/11-allegro-offer-management.js', import.meta.url);

test('backend kończy oferty przez API i zachowuje produkty oraz historię zamówień', async () => {
  const [source, store] = await Promise.all([readFile(routePath, 'utf8'), readFile(storePath, 'utf8')]);
  const start = source.indexOf('function allegroOfferWithdrawalRoute');
  const end = source.length;
  const route = source.slice(start, end);

  assert.ok(start > 0 && end > start, 'brakuje dedykowanego endpointu zakończenia ofert');
  assert.match(store, /createAllegroOfferWithdrawalRoute/);
  assert.match(store, /allegroOfferWithdrawalRoute\(\{ req, url, action \}\)/);
  assert.match(route, /isAdmin\(req, url\)/);
  assert.match(route, /offerIds\.length/);
  assert.match(source, /offer-publication-commands/);
  assert.match(source, /publication: \{ action: 'END' \}/);
  assert.match(route, /allegro_offer_withdrawal_audit/);
  assert.match(route, /previousProductId/);
  assert.match(route, /allegroOfferId'\]/);
  assert.ok(!route.includes("zapisz('products'"), 'zakończenie oferty nie może usuwać katalogu sklepu');
  assert.ok(!route.includes("zapisz('orders'"), 'zakończenie oferty nie może usuwać zamówień');
});

test('panel ma pojedyncze i grupowe zakończenie z kontrolowanym potwierdzeniem', async () => {
  const source = `${await readFile(frontendPath, 'utf8')}\n${await readFile(new URL('../src/frontend/11-allegro-and-orders.js', import.meta.url), 'utf8')}`;
  for (const marker of ['allegroPrzygotujWycofanieOfert', 'allegroPotwierdzWycofanieOfert', 'allegroWycofaniePanelHTML', 'Zakończ zaznaczone', 'Zakończ ofertę']) assert.ok(source.includes(marker), `brak: ${marker}`);
  assert.match(source, /chmura\("allegro-withdraw-offers"/);
  assert.match(source, /filtrStatusuAllegroOfert/);
  assert.match(source, /Nie usuwamy produktów sklepu, istniejących zamówień ani historii sprzedaży Allegro/);
  const handlerStart = source.indexOf('function allegroPrzygotujWycofanieOfert');
  const handlerEnd = source.indexOf('function allegroOfertaMapowanieCardHTML', handlerStart);
  assert.ok(!source.slice(handlerStart, handlerEnd).includes('confirm('), 'potwierdzenie ma być częścią panelu, a nie oknem przeglądarki');
});

test('zakończenie oferty jest audytowane i nie usuwa kartoteki produktu', async () => {
  const database = new Map([
    ['allegro_offers', { items: [{ id: 'OFF-1', name: 'Gra testowa', status: 'ACTIVE' }] }],
    ['allegro_mappings', { items: { 'OFF-1': { offerId: 'OFF-1', productId: 'P-1', confidence: 100 } } }],
    ['settings', { data: { artway_produkty_edytowane: { 'P-1': { allegroOfferId: 'OFF-1', nazwa: 'Gra testowa' } } }, rev: 4 }],
    ['allegro_offer_withdrawal_audit', { items: [] }],
  ]);
  const apiCalls = [], writes = [];
  const route = createAllegroOfferWithdrawalRoute({
    callAllegro: async (_req, path, options) => { apiCalls.push({ path, options }); return { completedAt: new Date().toISOString(), taskCount: { success: 1, failed: 0, total: 1 } }; },
    createProductUpdater: (data) => ({ apply: (id, patch, removed = []) => { const current = { ...(data.artway_produkty_edytowane?.[id] || {}) }; for (const key of removed) delete current[key]; data.artway_produkty_edytowane[id] = { ...current, ...patch }; }, commit: () => true }),
    getMappings: (record) => ({ ...(record.items || {}) }),
    getOffers: (record) => [...(record.items || [])],
    getProducts: async () => new Map([['P-1', { id: 'P-1', nazwa: 'Gra testowa' }]]),
    isAdmin: () => true,
    read: async (key, fallback) => structuredClone(database.get(key) || fallback),
    respond: (body, status = 200) => ({ body, status }),
    text: (value, limit = 1000) => String(value ?? '').slice(0, limit),
    write: async (key, value) => { writes.push(key); database.set(key, structuredClone(value)); },
  });
  const response = await route({ req: { method: 'POST', json: async () => ({ offerIds: ['OFF-1'], reason: 'admin_decision' }) }, url: new URL('https://artwaytm.pl/api/store'), action: 'allegro-withdraw-offers' });

  assert.equal(response.status, 200);
  assert.equal(response.body.ended, 1);
  assert.match(apiCalls[0].path, /^\/sale\/offer-publication-commands\/[0-9a-f-]+$/);
  assert.deepEqual(apiCalls[0].options, { method: 'PUT', bodyObj: { offerCriteria: [{ type: 'CONTAINS_OFFERS', offers: [{ id: 'OFF-1' }] }], publication: { action: 'END' } } });
  assert.equal(database.get('allegro_offers').items[0].status, 'ENDED');
  assert.equal(database.get('allegro_mappings').items['OFF-1'].previousProductId, 'P-1');
  assert.equal(database.get('settings').data.artway_produkty_edytowane['P-1'].nazwa, 'Gra testowa');
  assert.equal(database.get('settings').data.artway_produkty_edytowane['P-1'].allegroOfferId, undefined);
  assert.ok(writes.includes('allegro_offer_withdrawal_audit'));
});
