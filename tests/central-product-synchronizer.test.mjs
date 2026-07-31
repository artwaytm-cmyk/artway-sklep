import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCentralProductSynchronizer } from '../src/backend/lib/domain/central-product-synchronizer.mjs';

function record(id = '1') {
  return {
    id,
    data: { id, nazwa: 'Gra' },
    publicData: { id, nazwa: 'Gra' },
    adminListData: { id, nazwa: 'Gra' },
    publicListData: { id, nazwa: 'Gra' },
    name: 'Gra',
    searchText: 'gra',
    category: 'Gry',
    producer: 'Alexander',
    externalId: id,
    sku: id,
    ean: '5900000000000',
    source: 'bazowy',
    recordStatus: 'active',
    stock: 1,
    saleAvailable: true,
    hasSource: true,
    hasAllegro: false,
    allegroStatus: '',
    missingFields: [],
    missingCount: 0,
    price: 20,
    allegroPrice: 20,
    promotion: false,
    newProduct: false,
    rating: null,
    ratingCount: 0,
    duplicateStore: false,
    duplicateAllegro: false,
    fingerprint: `fingerprint-${id}`,
  };
}

function harness({ applied = 1, lock = true } = {}) {
  const calls = [];
  let inTransaction = false;
  let releasedWith = null;
  const client = {
    on() {},
    removeListener() {},
    release(error) { releasedWith = error || null; },
    async query(sql) {
      const query = String(sql).replace(/\s+/g, ' ').trim();
      calls.push(query);
      if (query.startsWith('SELECT pg_try_advisory_lock')) return { rows: [{ locked: lock }] };
      if (query.startsWith('SELECT p.product_id')) return { rows: [{
        product_id: '1',
        data: { id: '1', nazwa: 'Gra', _catalog: { source: 'bazowy', recordStatus: 'active' } },
        authoritative_fields: [],
        fingerprint: 'old-fingerprint',
        record_status: 'active',
        sync_started_at: new Date('2026-07-31T12:00:00Z'),
      }] };
      if (query === 'BEGIN') { inTransaction = true; return { rowCount: 0, rows: [] }; }
      if (query === 'COMMIT' || query === 'ROLLBACK') { inTransaction = false; return { rowCount: 0, rows: [] }; }
      if (query.includes('INSERT INTO artway_products(')) return { rowCount: applied, rows: applied ? [{ product_id: '1' }] : [] };
      if (query.startsWith('UPDATE artway_products p')) return { rowCount: 0, rows: [] };
      return { rowCount: 0, rows: [{ pg_advisory_unlock: true }] };
    },
  };
  const buildStates = [];
  const synchronize = createCentralProductSynchronizer({
    available: true,
    ensureSchema: async () => {},
    text: (value) => String(value ?? '').trim(),
    pool: { connect: async () => client },
    ns: 'artway-sklep',
    asObject: (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {},
    asArray: (value) => Array.isArray(value) ? value : [],
    centralCatalogBuildRecords() {
      buildStates.push(inTransaction);
      return [record('1')];
    },
    aggregateCache: new Map([['old', true]]),
    CENTRAL_PRODUCT_SCHEMA_VERSION: 7,
    logger: { error() {} },
  });
  return { synchronize, calls, buildStates, releasedWith: () => releasedWith };
}

test('pełna kartoteka jest składana przed rozpoczęciem krótkiej transakcji', async () => {
  const runtime = harness();
  const result = await runtime.synchronize({}, {
    preferCanonicalCatalog: true,
    sourceRevision: 'revision-1',
  });
  assert.deepEqual(runtime.buildStates, [false]);
  assert.equal(result.synchronized, true);
  assert.equal(result.appliedCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.equal(runtime.releasedWith(), null);
  assert.ok(runtime.calls.indexOf('BEGIN') > runtime.calls.findIndex((query) => query.startsWith('SELECT p.product_id')));
  assert.ok(runtime.calls.some((query) => query.includes('expected_fingerprint')));
  assert.ok(runtime.calls.some((query) => query.includes("p.record_status<>'removed'")));
});

test('nowsza mutacja produktu jest zachowana bez ponownego zapętlania pełnej synchronizacji', async () => {
  const runtime = harness({ applied: 0 });
  const result = await runtime.synchronize({}, {
    preferCanonicalCatalog: true,
    sourceRevision: 'revision-2',
  });
  assert.equal(result.synchronized, true);
  assert.equal(result.retryRequired, false);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.concurrentMutationCount, 1);
});

test('drugi proces nie uruchamia równoległej pełnej synchronizacji', async () => {
  const runtime = harness({ lock: false });
  const result = await runtime.synchronize({}, { sourceRevision: 'revision-3' });
  assert.equal(result.inProgress, true);
  assert.deepEqual(runtime.buildStates, []);
});

test('pula PostgreSQL ma odbiorniki błędów dla połączeń bezczynnych i wypożyczonych', async () => {
  const source = await readFile(new URL('../src/backend/lib/core/postgres-store-repository.mjs', import.meta.url), 'utf8');
  assert.match(source, /pool\.on\('error'/);
  assert.match(source, /pool\.on\('connect'/);
  assert.match(source, /client\.on\('error'/);
});
