const DAY_MS = 24 * 60 * 60 * 1000;

function retentionDays(value, fallback, minimum = 1, maximum = 3650) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}

export async function executeDatabaseMaintenance({
  pool,
  namespace = 'artway-sklep',
  productTrashDays = 30,
  productMutationDays = 365,
  preparationResultDays = 90,
  preparationBatchDays = 180,
  legacyBackupDays = 370,
  now = new Date(),
} = {}) {
  if (!pool || typeof pool.connect !== 'function') {
    throw new Error('Czyszczenie danych wymaga połączenia PostgreSQL.');
  }
  const policy = {
    productTrashDays: retentionDays(productTrashDays, 30),
    productMutationDays: retentionDays(productMutationDays, 365, 30),
    preparationResultDays: retentionDays(preparationResultDays, 90, 30),
    preparationBatchDays: retentionDays(preparationBatchDays, 180, 30),
    legacyBackupDays: retentionDays(legacyBackupDays, 370, 90),
  };
  const client = await pool.connect();
  const result = {
    ok: false,
    namespace,
    startedAt: now.toISOString(),
    policy,
    productTrashPurged: 0,
    productMutationsPruned: 0,
    preparationTasksPruned: 0,
    preparationBatchesPruned: 0,
    legacyBackupsPruned: 0,
  };
  try {
    await client.query('BEGIN');
    // Pełny obraz usuwanego po 30 dniach rekordu zostaje w dzienniku audytu.
    // Dzięki temu kosz nie rośnie bez końca, ale każda automatyczna operacja
    // pozostaje rozliczalna do czasu objęcia jej zwykłą retencją mutacji.
    await client.query(`
      INSERT INTO artway_product_mutations(
        namespace,mutation_id,product_id,area,actor,fields,remove_fields,
        before_fingerprint,after_fingerprint,status,created_at
      )
      SELECT namespace,
        'retention-purge:' || product_id || ':' || to_char($2::timestamptz,'YYYYMMDD'),
        product_id,'product-retention','server-maintenance',
        jsonb_build_object('recordStatus','purged','snapshot',data),
        '[]'::jsonb,fingerprint,'','applied',$2::timestamptz
      FROM artway_product_records
      WHERE namespace=$1 AND record_status='trash'
        AND updated_at < $2::timestamptz - ($3::text || ' days')::interval
      ON CONFLICT(namespace,mutation_id) DO NOTHING
    `, [namespace, now.toISOString(), policy.productTrashDays]);
    const purged = await client.query(`
      DELETE FROM artway_products
      WHERE namespace=$1 AND record_status='trash'
        AND updated_at < $2::timestamptz - ($3::text || ' days')::interval
      RETURNING product_id
    `, [namespace, now.toISOString(), policy.productTrashDays]);
    result.productTrashPurged = purged.rowCount;

    const mutations = await client.query(`
      DELETE FROM artway_product_mutations
      WHERE namespace=$1
        AND created_at < $2::timestamptz - ($3::text || ' days')::interval
      RETURNING mutation_id
    `, [namespace, now.toISOString(), policy.productMutationDays]);
    result.productMutationsPruned = mutations.rowCount;

    const relations = await client.query(`
      SELECT
        to_regclass('public.artway_allegro_preparation_tasks') IS NOT NULL AS tasks,
        to_regclass('public.artway_allegro_preparation_batches') IS NOT NULL AS batches,
        to_regclass('public.artway_domain_legacy_backup') IS NOT NULL AS legacy_backups
    `);
    if (relations.rows[0]?.tasks) {
      const tasks = await client.query(`
        DELETE FROM artway_allegro_preparation_tasks
        WHERE namespace=$1 AND status IN ('completed','attention','failed')
          AND COALESCE(completed_at,updated_at) < $2::timestamptz - ($3::text || ' days')::interval
        RETURNING task_id
      `, [namespace, now.toISOString(), policy.preparationResultDays]);
      result.preparationTasksPruned = tasks.rowCount;
    }
    if (relations.rows[0]?.batches) {
      const batches = await client.query(`
        DELETE FROM artway_allegro_preparation_batches b
        WHERE b.namespace=$1
          AND b.requested_at < $2::timestamptz - ($3::text || ' days')::interval
          AND NOT EXISTS(
            SELECT 1 FROM artway_allegro_preparation_tasks t
            WHERE t.namespace=b.namespace AND t.batch_id=b.batch_id
              AND t.status IN ('pending','running')
          )
        RETURNING batch_id
      `, [namespace, now.toISOString(), policy.preparationBatchDays]);
      result.preparationBatchesPruned = batches.rowCount;
    }
    if (relations.rows[0]?.legacy_backups) {
      const backups = await client.query(`
        DELETE FROM artway_domain_legacy_backup
        WHERE namespace=$1
          AND backed_up_at < $2::timestamptz - ($3::text || ' days')::interval
        RETURNING key
      `, [namespace, now.toISOString(), policy.legacyBackupDays]);
      result.legacyBackupsPruned = backups.rowCount;
    }
    await client.query(`
      UPDATE artway_product_catalog_meta
      SET product_count=(
        SELECT COUNT(*) FROM artway_products
        WHERE namespace=$1 AND record_status<>'removed'
      ),synced_at=NOW()
      WHERE namespace=$1
    `, [namespace]);
    await client.query('COMMIT');
    result.ok = true;
    result.finishedAt = new Date().toISOString();
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export { DAY_MS };
