import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryStockRoute } from '../src/backend/lib/inventory-route.mjs';

test('bezpośredni endpoint zawsze wymaga trwałej decyzji, niezależnie od deklarowanego źródła', async () => {
  let reads = 0;
  const route = createInventoryStockRoute({
    isAdmin: () => true,
    rateLimit: () => null,
    readVersioned: async () => { reads += 1; return { value: { data: {}, rev: 0 } }; },
    respond: (payload, status = 200) => ({ payload, status }),
    settingsLimit: 4 * 1024 * 1024,
    text: (value, limit = 500) => String(value || '').slice(0, limit),
    writeIfVersion: async () => ({ modified: true }),
  });
  for (const source of ['', 'manual-admin', 'admin-agent-panel', 'codex-worker', 'dowolne-zrodlo']) {
    const request = new Request('https://artwaytm.pl/api/store?action=inventory-stock-set', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source }),
    });
    const result = await route(request, new URL(request.url), 'inventory-stock-set');
    assert.equal(result.status, 409);
    assert.equal(result.payload.code, 'inventory_decision_required');
  }
  assert.equal(reads, 0);
});

test('zatwierdzenie PZ/WZ automatycznie uzgadnia Plan zatowarowania dokładnie raz', async () => {
  let value = {
    data: {
      artway_produkty_dodane: [{ id: '1', nazwa: 'Gra testowa', externalId: 'T-1', ean: '5906018003796' }],
      artway_stany: { 1: 0 },
      artway_magazyn_produkty: { 1: { lokalizacja: 'R1-P1' } },
      artway_ruchy_magazynowe: [],
    },
    rev: 1,
    updated_at: null,
  };
  let etag = 1, reconciliations = 0, readinessRefreshes = 0;
  const route = createInventoryStockRoute({
    isAdmin: () => true,
    rateLimit: () => null,
    readVersioned: async () => ({ value: structuredClone(value), etag: String(etag), exists: true }),
    reconciliation: {
      reconcileDraftsSafely: async (options) => {
        reconciliations += 1;
        assert.deepEqual(options, { summary: true });
        return { ok: true, changed: true, updated: ['supplier-draft'] };
      },
    },
    refreshOrderReadiness: async ({ document }) => {
      readinessRefreshes += 1;
      assert.equal(document.number, 'PZ/2026/07/0001');
      return { orders: [{ id: 'allegro-order', warehouseStage: 'kompletacja' }] };
    },
    respond: (payload, status = 200) => ({ payload, status }),
    sessionOf: () => ({ email: 'admin@example.test' }),
    writeIfVersion: async (_key, next, version) => {
      if (String(version.etag) !== String(etag)) return { modified: false };
      value = structuredClone(next);
      etag += 1;
      return { modified: true, etag: String(etag) };
    },
    mergeSettings: async (data) => data,
    settingsLimit: 4 * 1024 * 1024,
  });
  const call = async (action, body) => {
    const request = new Request(`https://artwaytm.pl/api/store?action=${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return route(request, new URL(request.url), action);
  };
  const created = await call('warehouse-document-create', { type: 'PZ', reference: 'Test automatycznego planu' });
  const line = await call('warehouse-document-line-upsert', {
    documentId: created.payload.document.id, expectedRevision: 1, productId: '1', quantity: 2, mode: 'set', requestId: 'line-auto-plan',
  });
  const confirmed = await call('warehouse-document-confirm', {
    documentId: created.payload.document.id, expectedRevision: line.payload.document.revision, requestId: 'confirm-auto-plan',
  });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.payload.confirmed, true);
  assert.equal(reconciliations, 1);
  assert.equal(readinessRefreshes, 1);
  assert.deepEqual(confirmed.payload.supplierPlan, { ok: true, changed: true, updated: ['supplier-draft'] });
  assert.equal(confirmed.payload.orderReadiness.orders[0].warehouseStage, 'kompletacja');
});
