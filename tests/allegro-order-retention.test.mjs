import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroOrderNeedsLiveRefresh, allegroOrderNeedsStatusRefresh, createAllegroOrderArchive, partitionAllegroOrders, selectAllegroStatusRefreshCandidates } from '../src/backend/lib/domain/allegro-order-retention.mjs';

const now = new Date('2026-07-16T12:00:00.000Z');
const order = (id, createdAt, fulfillmentStatus = 'NEW', warehouseStage = 'kompletacja', extra = {}) => ({ id, createdAt, fulfillmentStatus, warehouseStage, ...extra });

test('rejestr operacyjny zachowuje 30 dni i każde nadal aktywne zamówienie', () => {
  const recentSent = order('recent-sent', '2026-07-01T10:00:00Z', 'SENT', 'zamkniete');
  const oldSent = order('old-sent', '2026-05-01T10:00:00Z', 'SENT', 'zamkniete');
  const oldActive = order('old-active', '2026-05-01T10:00:00Z', 'NEW', 'kompletacja');
  const oldLocalDone = order('old-done', '2026-05-01T10:00:00Z', 'NEW', 'zrealizowane');
  const result = partitionAllegroOrders([recentSent, oldSent, oldActive, oldLocalDone], { now });
  assert.deepEqual(result.live.map(x => x.id), ['recent-sent', 'old-active']);
  assert.deepEqual(result.archived.map(x => x.id), ['old-sent', 'old-done']);
  assert.equal(allegroOrderNeedsLiveRefresh(oldActive), true);
  assert.equal(allegroOrderNeedsLiveRefresh(oldLocalDone), false);
});

test('lokalnie zakończone świeże zlecenie nadal odświeża oficjalny status do czasu archiwizacji', () => {
  assert.equal(allegroOrderNeedsStatusRefresh({ id: 'recent', fulfillmentStatus: 'NEW', warehouseStage: 'zrealizowane' }), true);
  assert.equal(allegroOrderNeedsStatusRefresh({ id: 'baseline', fulfillmentStatus: 'NEW', baselineArchived: true }), true);
  assert.equal(allegroOrderNeedsStatusRefresh({ id: 'sent', fulfillmentStatus: 'SENT' }), false);
});

test('rotacyjna kontrola statusów wybiera najdawniej sprawdzane i pomija najnowsze okno', () => {
  const selected = selectAllegroStatusRefreshCandidates([
    { id: 'fresh-window', fulfillmentStatus: 'NEW', officialStatusCheckedAt: '2026-07-16T11:00:00Z' },
    { id: 'oldest', fulfillmentStatus: 'NEW', officialStatusCheckedAt: '2026-07-10T11:00:00Z', baselineArchived: true },
    { id: 'later', fulfillmentStatus: 'PROCESSING', officialStatusCheckedAt: '2026-07-12T11:00:00Z' },
    { id: 'sent', fulfillmentStatus: 'SENT', officialStatusCheckedAt: '2026-07-01T11:00:00Z' },
  ], { seenIds: new Set(['fresh-window']), limit: 1 });
  assert.deepEqual(selected.map(item => item.id), ['oldest']);
});

test('archiwum jest miesięczne, idempotentne i pobierane stronami', async () => {
  const records = new Map(), read = async (key, fallback) => structuredClone(records.get(key) ?? fallback), write = async (key, value) => { records.set(key, structuredClone(value)); };
  const archive = createAllegroOrderArchive({ read, write }), source = [
    order('may-1', '2026-05-01T10:00:00Z', 'SENT', 'zamkniete'),
    order('may-2', '2026-05-20T10:00:00Z', 'NEW', 'zrealizowane'),
    order('live', '2026-07-15T10:00:00Z', 'NEW', 'kompletacja'),
  ];
  const first = await archive.archive(source, { now });
  const second = await archive.archive(source, { now });
  assert.deepEqual(first.items.map(x => x.id), ['live']);
  assert.equal(first.summary.total, 2);
  assert.equal(second.summary.total, 2);
  assert.equal(records.get('allegro_orders_archive_2026-05').items.length, 2);
  const page = await archive.page({ limit: 1 });
  assert.equal(page.items.length, 1);
  assert.equal(page.hasMore, true);
});
