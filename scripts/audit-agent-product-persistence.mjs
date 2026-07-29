import pg from 'pg';
import { createCentralProductCatalog, centralAllegroPreparationFingerprint } from '../src/backend/lib/domain/central-product-catalog.mjs';
import { editorialProductContentReport } from '../src/backend/lib/domain/product-editorial-safety.mjs';

const apply = process.argv.includes('--apply');
const namespace = process.env.ARTWAY_NAMESPACE || 'artway-sklep';
const pool = new pg.Pool(process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      database: process.env.PGDATABASE || 'artway',
      user: process.env.PGUSER || 'artway',
      host: process.env.PGHOST || '/var/run/postgresql',
    });
const catalog = createCentralProductCatalog({ pool, namespace });
const { rows } = await pool.query(`
  SELECT product_id,data
  FROM artway_products
  WHERE namespace=$1 AND record_status<>'removed'
  ORDER BY product_id
`, [namespace]);

const timestamp = new Date().toISOString();
const report = {
  mode: apply ? 'apply' : 'dry-run',
  products: rows.length,
  prepared: 0,
  valid: 0,
  invalidReady: 0,
  migratedFingerprints: 0,
  closedRepairSignals: 0,
  queuedForRepair: 0,
  examples: [],
};

for (const row of rows) {
  const product = row.data && typeof row.data === 'object' ? row.data : {};
  const status = String(product.allegroAgentPreparationStatus || '').trim().toLowerCase();
  if (!['ready', 'published'].includes(status)) continue;
  report.prepared += 1;
  const store = editorialProductContentReport(product, 'store');
  const allegro = editorialProductContentReport(product, 'allegro');
  if (store.ready && allegro.ready) {
    report.valid += 1;
    const fingerprint = centralAllegroPreparationFingerprint(product);
    const migrateFingerprint = product.allegroAgentPreparationFingerprint !== fingerprint;
    const closeRepairSignal = product.forceEditorialRefresh === true
      || product.allegroComplianceError === 'editorial_quality_gate_failed';
    if (!migrateFingerprint && !closeRepairSignal) continue;
    if (migrateFingerprint) report.migratedFingerprints += 1;
    if (closeRepairSignal) report.closedRepairSignals += 1;
    if (apply) {
      const mutationId = `agent-quality-ready-cleanup-v1:${row.product_id}`;
      const fields = {
        ...(migrateFingerprint ? { allegroAgentPreparationFingerprint: fingerprint } : {}),
        ...(closeRepairSignal ? {
          forceEditorialRefresh: false,
          allegroComplianceError: '',
        } : {}),
        lastAdminMutationId: mutationId,
        lastAdminMutationAt: timestamp,
        lastAdminMutationBy: 'system-audit',
        lastAdminMutationArea: 'agent-editorial-quality-migration',
        lastAdminMutationFields: [
          ...(migrateFingerprint ? ['allegroAgentPreparationFingerprint'] : []),
          ...(closeRepairSignal ? ['forceEditorialRefresh', 'allegroComplianceError'] : []),
        ],
      };
      await catalog.patchProductFields(row.product_id, fields, [], {
        mutationId,
        actor: 'system-audit',
        area: 'agent-editorial-quality-migration',
      });
    }
    continue;
  }

  report.invalidReady += 1;
  report.queuedForRepair += 1;
  if (report.examples.length < 20) {
    report.examples.push({
      productId: String(row.product_id),
      name: String(product.nazwa || product.name || ''),
      store: store.issues.slice(0, 4),
      allegro: allegro.issues.slice(0, 4),
    });
  }
  if (!apply) continue;

  const editorial = product.contentEditorial && typeof product.contentEditorial === 'object'
    ? product.contentEditorial
    : {};
  const channelStates = editorial.channelStates && typeof editorial.channelStates === 'object'
    ? editorial.channelStates
    : {};
  const missing = [
    ...(store.ready ? [] : ['redakcja opisu sklepu przez Agenta']),
    ...(allegro.ready ? [] : ['redakcja opisu Allegro przez Agenta']),
  ];
  const mutationId = `agent-quality-repair-v1:${row.product_id}`;
  await catalog.patchProductFields(row.product_id, {
    contentEditorial: {
      ...editorial,
      status: 'queued',
      queuedReason: 'quality_gate_failed',
      qualityAuditAt: timestamp,
      channelStates: {
        ...channelStates,
        ...(!store.ready ? {
          store: {
            ...(channelStates.store || {}),
            status: 'needs_review',
            reason: 'quality_gate_failed',
            qualityIssues: store.issues.slice(0, 20),
          },
        } : {}),
        ...(!allegro.ready ? {
          allegro: {
            ...(channelStates.allegro || {}),
            status: 'needs_review',
            reason: 'quality_gate_failed',
            qualityIssues: allegro.issues.slice(0, 20),
          },
        } : {}),
      },
    },
    allegroAgentPreparationStatus: 'retrying',
    allegroAgentPreparationMissing: missing,
    allegroAgentPreparationNextRetryAt: timestamp,
    allegroAgentPreparationConfirmedAt: '',
    allegroAgentPreparationError: 'Poprzedni status ready cofnięto: treść nie przeszła aktualnej bramki jakości.',
    allegroComplianceError: !allegro.ready ? 'editorial_quality_gate_failed' : product.allegroComplianceError || '',
    forceEditorialRefresh: true,
    lastAdminMutationId: mutationId,
    lastAdminMutationAt: timestamp,
    lastAdminMutationBy: 'system-audit',
    lastAdminMutationArea: 'agent-editorial-quality-repair',
    lastAdminMutationFields: [
      'contentEditorial', 'allegroAgentPreparationStatus', 'allegroAgentPreparationMissing',
      'allegroAgentPreparationNextRetryAt', 'allegroAgentPreparationConfirmedAt',
      'allegroAgentPreparationError', 'allegroComplianceError', 'forceEditorialRefresh',
    ],
  }, [], {
    mutationId,
    actor: 'system-audit',
    area: 'agent-editorial-quality-repair',
  });
}

console.log(JSON.stringify(report, null, 2));
await pool.end();
