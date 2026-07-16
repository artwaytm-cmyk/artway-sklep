import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createAllegroDataReader } from '../netlify/functions/lib/domain/allegro-data-reader.mjs';

function readerHarness() {
  const records = new Map([
    ['allegro_orders', { items: [{ id: 'new', fulfillmentStatus: 'NEW' }, { id: 'sent', fulfillmentStatus: 'SENT' }], updated_at: 'orders-at' }],
    ['allegro_offers', { items: [{ id: 'offer-1' }], updated_at: 'offers-at' }],
    ['allegro_mappings', { items: { 'offer-1': { productId: 'product-1' } } }],
  ]);
  return createAllegroDataReader({
    read: async (key, fallback) => structuredClone(records.get(key) ?? fallback),
    archive: { summary: async () => ({ total: 40, months: [{ month: '2026-05', count: 40 }], retentionDays: 30 }) },
    getOfferSettings: async () => ({ lightSyncMinutes: 15, fullSyncHours: 6 }),
    getStatus: async () => ({ connected: true }),
    mappingItems: (record) => record.items || {},
    orderStatus: (order) => order.fulfillmentStatus,
    orderNeedsRefresh: (order) => order.fulfillmentStatus === 'NEW',
    nextScheduledSyncAt: () => null,
    compliancePolicy: {},
  });
}

test('podsumowanie Allegro nie przesyła ciężkich rejestrów', async () => {
  const payload = await readerHarness()('summary');
  assert.equal(payload.summary.orders.live, 2);
  assert.equal(payload.summary.orders.active, 1);
  assert.equal(payload.summary.orders.archived, 40);
  assert.equal(payload.summary.offers.mapped, 1);
  assert.equal('orders' in payload, false);
  assert.equal('offers' in payload, false);
  assert.equal('mappings' in payload, false);
});
test('zakres zamówień przesyła tylko dane potrzebne tej podstronie', async () => {
  const payload = await readerHarness()('orders');
  assert.equal(payload.orders.length, 2);
  assert.equal('offers' in payload, false);
  assert.equal(Object.keys(payload.mappings).length, 1);
});

test('indeks mapowania zawęża katalog 20 000 produktów bez utraty dokładnego EAN', async () => {
  const source = await readFile(new URL('../src/frontend/11-allegro-mapping-index.js', import.meta.url), 'utf8');
  const context = { allegroMapowania: {} }; vm.createContext(context); vm.runInContext(source, context);
  const products = Array.from({ length: 20_000 }, (_, index) => ({ id: index + 1, nazwa: `Gra edukacyjna pozycja ${index + 1}`, ean: String(5900000000000 + index) }));
  const target = products[18_765], pool = context.allegroPulaProduktowMapowania({ id: 'offer', name: target.nazwa, ean: target.ean }, products);
  assert.equal(pool[0].id, target.id);
  assert.ok(pool.length <= 800);
});
