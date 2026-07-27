import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDatabaseMaintenance } from '../src/backend/lib/database-maintenance.mjs';

test('retencja usuwa wyłącznie stare rekordy wskazane przez PostgreSQL i aktualizuje metadane', async () => {
  const queries = [];
  const client = {
    query: async (sql, params = []) => {
      const query = String(sql);
      queries.push({ sql: query, params });
      if (query.includes('to_regclass')) {
        return { rows: [{ tasks: true, batches: true, legacy_backups: true }], rowCount: 1 };
      }
      if (query.includes('DELETE FROM artway_products')) return { rows: [], rowCount: 2 };
      if (query.includes('DELETE FROM artway_product_mutations')) return { rows: [], rowCount: 7 };
      if (query.includes('DELETE FROM artway_allegro_preparation_tasks')) return { rows: [], rowCount: 3 };
      if (query.includes('DELETE FROM artway_allegro_preparation_batches')) return { rows: [], rowCount: 1 };
      if (query.includes('DELETE FROM artway_domain_legacy_backup')) return { rows: [], rowCount: 4 };
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
  const result = await executeDatabaseMaintenance({
    pool: { connect: async () => client },
    now: new Date('2026-07-26T08:00:00.000Z'),
  });
  assert.equal(result.ok, true);
  assert.equal(result.productTrashPurged, 2);
  assert.equal(result.productMutationsPruned, 7);
  assert.equal(result.preparationTasksPruned, 3);
  assert.equal(result.preparationBatchesPruned, 1);
  assert.equal(result.legacyBackupsPruned, 4);
  assert.ok(queries.some(({ sql }) => sql.includes("record_status='trash'")));
  assert.ok(queries.some(({ sql }) => sql.includes('artway_product_catalog_meta')));
  assert.equal(queries[0].sql, 'BEGIN');
  assert.equal(queries.at(-1).sql, 'COMMIT');
});
