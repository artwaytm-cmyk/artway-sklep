import assert from 'node:assert/strict';
import test from 'node:test';

import { createVonHalskyStateRepository } from '../src/backend/lib/domain/von-halsky-state-repository.mjs';

function repositoryFixture() {
  const queries = [];
  const pool = {
    connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release() {} }),
    async query(sql, values = []) {
      const source = String(sql), call = { source, values };
      queries.push(call);
      if (source.includes("to_regclass('public.artway_von_halsky_state')")) return { rows: [{ available: true }], rowCount: 1 };
      if (source.includes('SELECT record_id,data,status,updated_at')) return {
        rows: [{ record_id: 'ORDER-1', status: 'COMPLETED', updated_at: '2026-08-08T08:00:00.000Z', data: { id: 'ORDER-1', status: 'COMPLETED', delivery: { deliveryType: 'APM' } } }],
        rowCount: 1,
      };
      if (source.includes('COUNT(*) FILTER')) return { rows: [{ wszystkie: 12, nowe: 3, do_obslugi: 4, do_decyzji: 3, do_nadania: 1, nadane: 2, w_transporcie: 1, zrealizowane: 4, anulowane: 1 }], rowCount: 1 };
      if (source.includes('SELECT COUNT(*)::integer total')) return { rows: [{ total: 1 }], rowCount: 1 };
      throw new Error(`Nieobsługiwane zapytanie testowe: ${source}`);
    },
  };
  const legacy = { readVersioned: async () => ({}), writeIfVersion: async () => ({ modified: false }) };
  return { repository: createVonHalskyStateRepository({ pool, namespace: 'test', legacy }), queries };
}

test('zamówienia InPost+ mają serwerowe filtry etapu, okresu, dostawy i sortowania', async () => {
  const { repository, queries } = repositoryFixture();
  const page = await repository.readRecordPage('orders', {
    fulfillment: 'zrealizowane', period: '7', delivery: 'paczkomat', sort: 'wartosc_desc', limit: 25,
  });
  assert.equal(page.total, 1);
  assert.equal(page.items[0]._fulfillment.key, 'closed');
  assert.equal(page.facets.nowe, 3);
  assert.equal(page.facets.zrealizowane, 4);
  const rowQuery = queries.find((entry) => entry.source.includes('SELECT record_id,data,status,updated_at'));
  assert.match(rowQuery.source, /updated_at>=NOW\(\)-\(\$3::integer\*INTERVAL '1 day'\)/);
  assert.match(rowQuery.source, /deliveryType/);
  assert.match(rowQuery.source, /status='COMPLETED'/);
  assert.match(rowQuery.source, /ORDER BY CASE WHEN COALESCE/);
  assert.deepEqual(rowQuery.values.slice(0, 3), ['test', 'orders', 7]);
});

test('liczniki etapów są obliczane dla pełnego filtra bez zawężenia do bieżącej strony', async () => {
  const { repository, queries } = repositoryFixture();
  await repository.readRecordPage('orders', { fulfillment: 'anulowane', period: 'dzisiaj', limit: 10 });
  const facetQuery = queries.find((entry) => entry.source.includes('COUNT(*) FILTER'));
  assert.ok(facetQuery);
  assert.match(facetQuery.source, /COUNT\(\*\) FILTER\(WHERE status IN \('CREATED','NEW','PAID'\)\)::integer nowe/);
  assert.match(facetQuery.source, /::integer zrealizowane/);
  assert.match(facetQuery.source, /::integer anulowane/);
  const finalWhere = facetQuery.source.slice(facetQuery.source.lastIndexOf('\nWHERE '));
  assert.match(finalWhere, /updated_at>=date_trunc\('day',NOW\(\)\)/);
  assert.doesNotMatch(finalWhere, /REFUNDED/);
});
