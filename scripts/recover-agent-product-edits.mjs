import { createStoreRepository, createRevisionSafeMutator } from '../src/backend/lib/core/store-repository.mjs';
import { postgresPoolFor } from '../src/backend/lib/core/postgres-store-repository.mjs';
import { createCatalogProductOperationWriter } from '../src/backend/lib/domain/catalog-product-operation-rebase.mjs';
import { createCatalogProductUpdater } from '../src/backend/lib/domain/catalog-product-updater.mjs';
import { mergeCatalogProducts } from '../src/backend/lib/domain/catalog-quality.mjs';
import {
  automaticEditorialAssessment,
  normalizeProductContentEditorialResult,
  productPatch,
} from '../src/backend/lib/domain/agent-specialists-support.mjs';
import { buildSharedProductDescriptionSections } from '../src/backend/lib/domain/product-content-layout.mjs';

const argument = (name, fallback = '') => {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};
const apply = process.argv.includes('--apply');
const since = argument('since', new Date(Date.now() - 6 * 60 * 60_000).toISOString());
const normalizeUrl = (value = '') => {
  try {
    const url = new URL(value);
    if (url.hostname.startsWith('www.')) url.hostname = url.hostname.slice(4);
    url.search = ''; url.hash = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch (error) { return ''; }
};

if (!process.env.DATABASE_URL) throw new Error('Brakuje DATABASE_URL.');
const pool = postgresPoolFor(process.env.DATABASE_URL);
const [{ rows: runRows }, { rows: productRows }] = await Promise.all([
  pool.query(`
    SELECT data
    FROM artway_agent_records
    WHERE domain = $1 AND collection = 'history'
      AND data->>'specialist' IN ('product_content', 'allegro_offer')
      AND (data->>'createdAt')::timestamptz >= $2::timestamptz
    ORDER BY (data->>'createdAt')::timestamptz DESC
  `, ['kv:agent_specialists_state', since]),
  pool.query('SELECT product_id, data FROM artway_products'),
]);

const productsByUrl = new Map(productRows.map((row) => [normalizeUrl(row.data?.sourceUrl || row.data?.producentUrl), row]));
const newest = new Map();
for (const row of runRows) {
  const run = row.data || {}, url = normalizeUrl(run.target?.sourceUrl);
  const key = `${url}|${run.specialist}`;
  if (url && !newest.has(key)) newest.set(key, run);
}

const operationsByProduct = new Map(), rejected = [];
for (const run of newest.values()) {
  const row = productsByUrl.get(normalizeUrl(run.target?.sourceUrl));
  if (!row) { rejected.push({ runId: run.id, reason: 'product_not_found' }); continue; }
  const normalized = run.specialist === 'product_content'
    ? { ...run, result: normalizeProductContentEditorialResult(run.result || {}) }
    : run;
  const assessment = automaticEditorialAssessment(normalized);
  if (!assessment.eligible) {
    rejected.push({ runId: run.id, productId: row.product_id, reason: assessment.reason });
    continue;
  }
  const patch = productPatch(normalized.result), current = operationsByProduct.get(String(row.product_id)) || {};
  Object.assign(current, patch);
  if (patch.allegroDescription) {
    current.allegroDescriptionSections = buildSharedProductDescriptionSections({
      ...row.data, ...current, opis: patch.allegroDescription,
    });
    current.allegroAgentPreparationSource = 'recovered-confirmed-agent-history';
    current.allegroAgentPreparedAt = String(run.createdAt || new Date().toISOString());
  }
  operationsByProduct.set(String(row.product_id), current);
}

const recoveryAt = new Date().toISOString(), operations = [...operationsByProduct.entries()].map(([id, fields]) => ({
  id,
  fields: {
    ...fields,
    lastAdminMutationId: `agent-history-recovery:${id}:${recoveryAt}`,
    lastAdminMutationAt: recoveryAt,
    lastAdminMutationBy: 'system-recovery',
    lastAdminMutationArea: 'agent-editorial-recovery',
    lastAdminMutationFields: Object.keys(fields),
  },
}));
const report = {
  mode: apply ? 'apply' : 'dry-run',
  since,
  runs: runRows.length,
  latestRuns: newest.size,
  productsReadyToRecover: operations.length,
  fieldsReadyToRecover: operations.reduce((sum, operation) => sum + Object.keys(operation.fields).length, 0),
  rejected: rejected.length,
};

if (apply && operations.length) {
  const repository = createStoreRepository({ name: 'artway-sklep', driver: 'postgres' });
  const importedProducts = productRows.map((row) => ({ ...row.data, id: String(row.product_id) }));
  const writer = createCatalogProductOperationWriter({
    mutateLatest: createRevisionSafeMutator(repository, 'settings', { maxAttempts: 10 }),
    loadProducts: async (data) => mergeCatalogProducts(data, importedProducts).map,
    createUpdater: createCatalogProductUpdater,
  });
  const saved = await writer(operations, recoveryAt);
  Object.assign(report, {
    modified: saved.modified === true,
    appliedOperations: saved.appliedOperations || 0,
    skippedProductIds: saved.skippedProductIds || [],
    revision: saved.value?.rev,
  });
  if ((saved.skippedProductIds || []).length || Number(saved.appliedOperations || 0) !== operations.length) {
    throw new Error(`Nie potwierdzono wszystkich produktów: ${JSON.stringify(report)}`);
  }
}

console.log(JSON.stringify(report, null, 2));
await pool.end();
