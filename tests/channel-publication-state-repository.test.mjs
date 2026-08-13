import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createChannelPublicationStateRepository } from '../src/backend/lib/domain/channel-publication-state-repository.mjs';

test('migracja tworzy osobny stan kanałów, potwierdzenia i cache schematów kategorii', async () => {
  const sql = await readFile(new URL('../db/migrations/0009_channel_publication_ledger.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS artway_channel_product_state/);
  assert.match(sql, /PRIMARY KEY\(namespace,product_id,channel\)/);
  assert.match(sql, /UNIQUE\(namespace,channel,idempotency_key\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS artway_channel_category_schemas/);
});

test('repozytorium nie udaje zapisu, gdy PostgreSQL nie jest skonfigurowany', async () => {
  const repository = createChannelPublicationStateRepository();
  assert.equal(repository.enabled, false);
  assert.equal(await repository.getCategorySchema('allegro', '123'), null);
  assert.equal(await repository.upsertState({
    productId: 'P-1',
    channel: 'allegro',
  }), null);
});

test('cache kategorii zwraca wyłącznie ważny schemat, a po awarii może udostępnić wersję ostatnią', async () => {
  const now = new Date('2026-07-30T10:00:00.000Z');
  const rows = new Map();
  const pool = {
    query: async (sql, params) => {
      if (/INSERT INTO artway_channel_category_schemas/.test(sql)) {
        rows.set(`${params[1]}:${params[2]}`, {
          schema_version: params[3],
          schema_hash: params[4],
          data: JSON.parse(params[5]),
          fetched_at: params[6],
          expires_at: params[7],
        });
        return { rowCount: 1, rows: [] };
      }
      if (/FROM artway_channel_category_schemas/.test(sql)) {
        const row = rows.get(`${params[1]}:${params[2]}`);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      throw new Error(`Nieobsłużone SQL: ${sql}`);
    },
  };
  const repository = createChannelPublicationStateRepository({ pool, now: () => now });
  const saved = await repository.putCategorySchema('allegro', '123', {
    parameters: [{ id: 'wiek', required: true }],
  }, { ttlMs: 60_000 });
  assert.match(saved.schemaVersion, /^2026-07-30T10:00:00/);
  const current = await repository.getCategorySchema('allegro', '123');
  assert.equal(current.data.parameters[0].id, 'wiek');
  rows.get('allegro:123').expires_at = new Date('2026-07-30T09:59:00.000Z');
  assert.equal(await repository.getCategorySchema('allegro', '123'), null);
  assert.equal((await repository.getCategorySchema('allegro', '123', { allowExpired: true })).expired, true);
});

test('repozytorium domyka wszystkie oczekujące potwierdzenia produktu po odczycie kanału', async () => {
  let executed = null;
  const pool = {
    query: async (sql, params) => {
      executed = { sql, params };
      return { rowCount: 3, rows: [] };
    },
  };
  const repository = createChannelPublicationStateRepository({
    pool,
    now: () => new Date('2026-08-01T11:30:00.000Z'),
  });
  const updated = await repository.reconcilePendingReceiptsForProduct({
    productId: 'P-1',
    channel: 'von_halsky',
    targetId: 'VH-1',
    status: 'readback_confirmed',
    responseSummary: { remoteStatus: 'PUBLISHED' },
  });
  assert.equal(updated, 3);
  assert.match(executed.sql, /status IN \('requested','queued','publishing','pending','processing'\)/);
  assert.match(executed.sql, /status='failed'[\s\S]*target_id=\$4[\s\S]*error_code='von_halsky_not_found'/);
  assert.deepEqual(executed.params.slice(0, 5), [
    'artway-sklep', 'von_halsky', 'P-1', 'VH-1', 'readback_confirmed',
  ]);
  assert.equal(executed.params[8].toISOString(), '2026-08-01T11:30:00.000Z');
});
