import test from 'node:test';
import assert from 'node:assert/strict';
import { agentProductReportOptions, createAgentProductReport } from '../src/backend/lib/domain/agent-product-report.mjs';

test('raport Agenta normalizuje filtry i ogranicza wielkość strony', () => {
  assert.deepEqual(agentProductReportOptions({
    channel: 'ALLEGRO', status: 'READY', listing: 'READY_TO_LIST',
    query: '  EAN 590 ', page: -4, limit: 900,
  }), {
    channel: 'allegro',
    status: 'ready',
    listing: 'ready_to_list',
    query: 'EAN 590',
    page: 1,
    limit: 250,
  });
});

test('raport Agenta zwraca potwierdzone kanały i stan wystawienia z centralnej kartoteki', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('MAX(GREATEST')) {
        return { rows: [{
          total: '1114', working: '1', ready: '50', decision: '3', needs_data: '800', not_started: '260',
          store_prepared: '473', store_ready: '470', allegro_prepared: '416', allegro_ready: '310',
          von_prepared: '195', von_ready: '65', ready_to_list: '136', needs_update: '12',
          revision: '2026-07-29T20:00:00.000Z',
        }] };
      }
      return { rows: [{
        product_id: '1000904', name: 'Na Grzyby', producer: 'MultiGra', ean: '5906395300904',
        external_id: '1000904', sale_available: true, has_allegro: false, allegro_status: '',
        updated_at: '2026-07-29T20:00:00.000Z', work_status: 'ready', task_status: 'completed',
        task_operation: 'product-full-review', task_result: {}, store_prepared: true, store_ready: true,
        allegro_prepared: true, allegro_ready: true, von_prepared: true, von_ready: true,
        ready_to_list: true, needs_update: false, filtered_total: '1',
        data: {
          zdjecie: 'https://example.test/game.jpg',
          contentEditorialPreparedAt: '2026-07-29T19:50:00.000Z',
          allegroAgentPreparedAt: '2026-07-29T19:55:00.000Z',
          allegroAgentPreparationStatus: 'ready',
          allegroAgentSavedFields: ['allegroTitle', 'allegroDescription'],
          vonHalskyAgentPreparedAt: '2026-07-29T19:58:00.000Z',
          vonHalskyAgentStatus: 'ready',
        },
      }] };
    },
  };
  const result = await createAgentProductReport({ pool }).query({ channel: 'all', status: 'ready' });
  assert.equal(result.available, true);
  assert.equal(result.summary.store_prepared, 473);
  assert.equal(result.summary.ready_to_list, 136);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].allegro.readyToList, true);
  assert.equal(result.items[0].allegro.ready, true);
  assert.equal(result.items[0].vonHalsky.ready, true);
  assert.deepEqual(result.items[0].allegro.savedFields, ['allegroTitle', 'allegroDescription']);
});
