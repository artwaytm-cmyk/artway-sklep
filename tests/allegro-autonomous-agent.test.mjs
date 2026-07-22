import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeAutonomousAllegroWork } from '../netlify/functions/lib/domain/allegro-autonomous-agent.mjs';
import { createAllegroOfferWithdrawalRoute } from '../netlify/functions/lib/allegro-offer-withdrawal-route.mjs';

const product = { id: 'P-1', nazwa: 'ECO FUN - TRYLMA', ean: '5906018025309', externalId: '2530', allegroProductId: 'CAT-1', allegroOfferId: 'OFF-OLD' };
const offer = (id, extra = {}) => ({ id, name: 'ECO FUN - TRYLMA', ean: '5906018025309', externalId: '2530', productId: 'CAT-1', categoryId: '123', status: 'ACTIVE', stockSold: 0, mainImage: 'https://img.test/1.jpg', ...extra });

test('agent rozpoznaje jednoznaczny duplikat i pozostawia ofertę z najlepszą historią', () => {
  const analysis = analyzeAutonomousAllegroWork({
    offers: [offer('OFF-OLD', { stockSold: 20 }), offer('OFF-NEW', { stockSold: 1 })],
    mappings: { 'OFF-OLD': { offerId: 'OFF-OLD', productId: 'P-1', blocked: false } },
    products: new Map([['P-1', product]]),
  });
  assert.equal(analysis.duplicates.length, 1);
  assert.equal(analysis.duplicates[0].keepOfferId, 'OFF-OLD');
  assert.deepEqual(analysis.duplicates[0].withdrawOfferIds, ['OFF-NEW']);
  assert.equal(analysis.duplicates[0].confidence, 100);
});

test('realna sprzedaż ma pierwszeństwo przed technicznym, nowszym powiązaniem', () => {
  const analysis = analyzeAutonomousAllegroWork({
    offers: [offer('OFF-OLD'), offer('OFF-NEW')], mappings: { 'OFF-NEW': { offerId: 'OFF-NEW', productId: 'P-1' } },
    products: new Map([['P-1', { ...product, allegroOfferId: 'OFF-NEW' }]]), salesByOffer: { 'OFF-OLD': 1 },
  });
  assert.equal(analysis.duplicates[0].keepOfferId, 'OFF-OLD');
  assert.deepEqual(analysis.duplicates[0].withdrawOfferIds, ['OFF-NEW']);
});

test('sama identyczna nazwa nigdy nie uruchamia automatycznego zakończenia oferty', () => {
  const analysis = analyzeAutonomousAllegroWork({
    offers: [{ id: 'O-1', name: 'Ta sama gra', status: 'ACTIVE' }, { id: 'O-2', name: 'Ta sama gra', status: 'ACTIVE' }],
    products: new Map([['P-2', { id: 'P-2', nazwa: 'Ta sama gra' }]]),
  });
  assert.equal(analysis.duplicates.length, 0);
  assert.equal(analysis.stats.duplicateOffers, 0);
});

test('sprzeczni kandydaci o tym samym EAN trafiają do decyzji zamiast automatycznej zmiany', () => {
  const products = new Map([
    ['P-1', { id: 'P-1', nazwa: 'Gra A', ean: '5906018025309' }],
    ['P-2', { id: 'P-2', nazwa: 'Gra B', ean: '5906018025309' }],
  ]);
  const analysis = analyzeAutonomousAllegroWork({ offers: [offer('O-1', { name: 'Gra' })], products });
  assert.equal(analysis.duplicates.length, 0);
  assert.equal(analysis.review[0].code, 'ambiguous_product');
});

test('cykl autonomiczny mapuje pewne dane, ale zakończenie duplikatu oddaje do decyzji', async () => {
  const database = new Map([
    ['allegro_offer_settings', { autonomousAgent: true, autoMapping: true, autoResolveDuplicates: true, autoResolveDuplicateMinScore: 97 }],
    ['allegro_offers', { items: [offer('OFF-OLD', { stockSold: 20 }), offer('OFF-NEW', { stockSold: 0 })] }],
    ['allegro_mappings', { items: { 'OFF-OLD': { offerId: 'OFF-OLD', productId: 'P-1', blocked: false } } }],
    ['settings', { data: { artway_produkty_edytowane: { 'P-1': { allegroOfferId: 'OFF-OLD' } } }, rev: 2 }],
    ['allegro_duplicate_resolution_audit', { items: [] }],
  ]);
  const calls = [];
  const read = async (key, fallback) => structuredClone(database.get(key) || fallback);
  const route = createAllegroOfferWithdrawalRoute({
    autoMapOffers: async () => ({ autoMapped: 1, refreshed: 1, quarantined: 0, reassessed: 0 }),
    callAllegro: async (_req, path, options) => { calls.push({ path, options }); return { completedAt: new Date().toISOString(), taskCount: { success: 1, failed: 0, total: 1 } }; },
    createProductUpdater: () => ({ apply: () => {}, commit: () => false }),
    getMappings: (record) => ({ ...(record.items || {}) }), getOffers: (record) => [...(record.items || [])],
    getProducts: async () => new Map([['P-1', product]]), isAdmin: () => true, read,
    respond: (body, status = 200) => ({ body, status }), text: (value, limit = 1000) => String(value ?? '').slice(0, limit),
    write: async (key, value) => database.set(key, structuredClone(value)),
  });
  const response = await route({ req: { method: 'POST', json: async () => ({ source: 'test' }) }, url: new URL('https://artwaytm.pl/api/store'), action: 'allegro-autonomous-agent-cycle' });
  assert.equal(response.status, 200);
  assert.equal(response.body.state.duplicateOffersEnded, 0);
  assert.equal(response.body.state.destructiveActionsRequireApproval, true);
  assert.equal(calls.length, 0);
  assert.equal(database.get('allegro_offers').items.find((item) => item.id === 'OFF-NEW').status, 'ACTIVE');
  assert.equal(database.get('allegro_autonomous_agent_review').items[0].code, 'requires_approval');
  assert.equal(database.get('allegro_duplicate_resolution_audit').items.length, 0);
});

test('VPS uruchamia cykl w tle co 15 minut bez ujawniania tokenu', async () => {
  const [script, service, timer] = await Promise.all([
    readFile(new URL('../scripts/run-background-agent.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../ops/systemd/artway-agent-cycle.service', import.meta.url), 'utf8'),
    readFile(new URL('../ops/systemd/artway-agent-cycle.timer', import.meta.url), 'utf8'),
  ]);
  assert.match(script, /allegro-autonomous-agent-cycle/);
  assert.match(script, /allegro-sync-orders/);
  assert.match(script, /allegro-sync-communications/);
  assert.doesNotMatch(script, /console\.log\([^\n]*token/);
  assert.match(service, /User=artway/);
  assert.match(timer, /\*:00\/15:00/);
  assert.match(timer, /Persistent=true/);
});
