import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createAgentEventSystem } from '../src/backend/lib/domain/agent-event-system.mjs';
import { createProductEventCodexCoordinator } from '../src/backend/lib/domain/product-event-codex-coordinator.mjs';

function repository() {
  let value = null;
  let revision = 0;
  return {
    readVersioned: async (_key, fallback) => ({
      value: value === null ? structuredClone(fallback) : structuredClone(value),
      etag: value === null ? '' : `"${revision}"`,
      exists: value !== null,
    }),
    writeIfVersion: async (_key, next, current) => {
      const expected = current.exists === false ? 0 : Number(String(current.etag).replace(/\D/g, ''));
      if (expected !== revision) return { modified: false };
      value = structuredClone(next);
      revision += 1;
      return { modified: true };
    },
  };
}

test('Codex koordynuje zdarzenie produktu, a agent pomocniczy trafia do trwałej kolejki', async () => {
  const store = repository(), reports = [], preparations = [], coordinates = [];
  const system = createAgentEventSystem({
    ...store,
    runtime: { report: async (event) => { reports.push(event); } },
    coordinate: async (input) => {
      coordinates.push(input);
      return {
        ok: true,
        plan: {
          assignments: [{
            scenarioId: 'catalog-editorial',
            scenarioVersion: '2026-07-28.1',
            specialist: 'product_content',
          }],
        },
      };
    },
  });
  system.connect({
    preparationRoute: {
      prepareProducts: async (ids, options) => {
        preparations.push({ ids, options });
        return { batchId: 'batch-codex-1' };
      },
      startBacklog: async () => ({ skipped: true, reason: 'catalog_ready' }),
    },
    storeOrderReconciliation: { reconcileDraftsSafely: async () => ({}) },
    readAllegroOrders: async () => ({ items: [] }),
    reconcileAllegroPlan: async () => ({}),
  });

  await system.signalProduct('P-100', { productName: 'Gra testowa', source: 'test' });
  await system.queue.kick();

  assert.equal(coordinates.length, 1);
  assert.equal(coordinates[0].kind, 'product.review');
  assert.deepEqual(preparations, [{
    ids: ['P-100'],
    options: { operation: 'product-full-review', requestedBy: 'codex-koordinator' },
  }]);
  assert.ok(reports.some((entry) => entry.work?.phase === 'planning' && entry.work?.status === 'running'));
  assert.ok(reports.some((entry) => entry.work?.phase === 'delegated' && entry.work?.status === 'confirmed'));
});

test('ręczne przygotowanie partii ma jeden plan Codex i bezpieczny fallback kolejki', async () => {
  let snapshot = null;
  const coordinate = createProductEventCodexCoordinator({
    plan: async (input) => {
      snapshot = input;
      return {
        ok: true,
        plan: {
          assignments: [{
            scenarioId: 'catalog-editorial',
            scenarioVersion: '2026-07-28.1',
            specialist: 'product_content',
          }],
        },
      };
    },
  });
  const result = await coordinate({
    kind: 'product.review',
    productIds: ['P-1', 'P-2', 'P-3'],
  });
  assert.equal(snapshot.specialists.lastCycle.editorialProgress.total, 3);
  assert.equal(snapshot.specialists.lastCycle.editorialProgress.pending, 3);
  assert.equal(result.plan.assignments[0].scenarioId, 'catalog-editorial');

  const routeSource = await readFile(new URL('../src/backend/lib/allegro-preparation-route.mjs', import.meta.url), 'utf8');
  assert.match(routeSource, /coordinate\(\{ kind: 'product\.review', productIds \}\)/);
  assert.match(routeSource, /requestedBy: assignment \? 'codex-koordinator'/);
  assert.match(routeSource, /safe_fallback/);
});

test('wewnętrzny zapis kanału i zmiana operacyjna nie uruchamiają ponownie pełnego przeglądu produktu', async () => {
  const store = repository();
  let coordinates = 0;
  const system = createAgentEventSystem({
    ...store,
    coordinate: async () => { coordinates += 1; return { ok: true }; },
    getProduct: async () => ({ id: 'P-LOOP', nazwa: 'Gra', opis: 'Opis' }),
  });
  const internalSave = system.wrapProductSaver(async () => ({
    modified: true,
    changedFields: ['vonHalskyRemoteStatus'],
    product: { id: 'P-LOOP', nazwa: 'Gra', opis: 'Opis', vonHalskyRemoteStatus: 'PUBLISHED' },
  }));
  const stockSave = system.wrapProductSaver(async () => ({
    modified: true,
    changedFields: ['stan'],
    product: { id: 'P-LOOP', nazwa: 'Gra', opis: 'Opis', stan: 4 },
  }));

  assert.equal((await internalSave({ productId: 'P-LOOP', area: 'von-halsky-reconciliation' })).agentEvent, null);
  assert.equal((await stockSave({ productId: 'P-LOOP', area: 'inventory' })).agentEvent, null);
  await system.queue.kick();
  assert.equal(coordinates, 0);
  assert.equal((await system.queue.status()).active, 0);
});
