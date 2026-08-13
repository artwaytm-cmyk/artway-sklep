import crypto from 'node:crypto';

const arrayConfig = (idFields = []) => ({ kind: 'array', idFields });
const objectConfig = () => ({ kind: 'object', idFields: [] });
const valueConfig = () => ({ kind: 'value', idFields: [] });
const containerConfig = (collections) => ({ kind: 'container', collections });

export const SETTINGS_DOMAIN_CONFIGS = Object.freeze({
  artway_ustawienia: valueConfig(),
  artway_stany: objectConfig(),
  artway_magazyn_niedobory_wydan: objectConfig(),
  artway_dostepnosc: objectConfig(),
  artway_ruchy_magazynowe: arrayConfig(['id', 'sourceRequestId']),
  artway_magazyn_produkty: objectConfig(),
  artway_magazyn_ustawienia: objectConfig(),
  artway_magazyn_lokalizacje: arrayConfig(['id', 'kod']),
  artway_magazyn_lokalizacje_usuniete: arrayConfig(['id', 'kod']),
  artway_dokumenty_magazynowe: arrayConfig(['id', 'numer']),
  artway_dokumenty_magazynowe_usuniete: arrayConfig(['id', 'numer']),
  artway_dokumenty_magazynowe_seq: valueConfig(),
  artway_faktury_szkice: arrayConfig(['id', 'nr', 'numer']),
  artway_producenci: arrayConfig(['id', 'name', 'nazwa']),
  artway_agent_ai_zlecenia: arrayConfig(['id', 'numer']),
  artway_agent_ai_plan_cykl: valueConfig(),
  artway_agent_ai_pamiec: arrayConfig(['id']),
  artway_agent_ai_historia: arrayConfig(['id']),
  artway_agent_ai_linki_producentow: arrayConfig(['id', 'url']),
  artway_seo_historia: arrayConfig(['id', 'at', 'data']),
  artway_seo_ustawienia: valueConfig(),
  artway_opinie: arrayConfig(['id']),
});

export const DIRECT_DOMAIN_CONFIGS = Object.freeze({
  orders: containerConfig({ items: arrayConfig(['nr']) }),
  deleted_orders: containerConfig({ items: arrayConfig(['nr']) }),
  users: containerConfig({ items: arrayConfig(['email']) }),
  allegro_offers: containerConfig({ items: arrayConfig(['id']) }),
  allegro_mappings: containerConfig({ items: objectConfig() }),
  allegro_orders: containerConfig({ items: arrayConfig(['id', 'checkoutFormId']) }),
  allegro_communications: containerConfig({
    threads: arrayConfig(['id', 'threadId']), issues: arrayConfig(['id', 'issueId']), errors: arrayConfig(['id', 'at']),
  }),
  agent_specialists_state: containerConfig({
    history: arrayConfig(['id', 'runId', 'at']), decisions: arrayConfig(['id', 'decisionId']), decisionReceipts: arrayConfig(['id', 'decisionId']),
  }),
  agent_action_runs: containerConfig({ items: arrayConfig(['id', 'runId']) }),
  agent_runtime: containerConfig({
    activity: arrayConfig(['id', 'runId', 'at']), history: arrayConfig(['id', 'runId', 'at']),
  }),
  system_diagnostics: containerConfig({ items: arrayConfig(['id', 'fingerprint']) }),
  openai_platform_state: containerConfig({ batches: arrayConfig(['id', 'day']) }),
  allegro_operation_receipts: containerConfig({ items: objectConfig() }),
  product_url_cache: containerConfig({ items: objectConfig() }),
  supplier_availability_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_compliance_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_communication_internal_history: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_communication_internal: containerConfig({ items: objectConfig() }),
  allegro_fee_preview_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_offer_defaults_audit: containerConfig({ items: objectConfig() }),
  codex_agent_jobs: containerConfig({ items: arrayConfig(['id', 'jobId']) }),
  allegro_duplicate_resolution_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_offer_withdrawal_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_availability_automation: containerConfig({ items: objectConfig() }),
  allegro_auto_replies: containerConfig({ items: objectConfig() }),
  inpost_webhooks: containerConfig({ items: arrayConfig(['id', 'at']) }),
  inpost_service_shipments: containerConfig({
    items: arrayConfig(['id', 'requestId']), contacts: arrayConfig(['id']), settings: valueConfig(),
  }),
  allegro_mapping_audit: containerConfig({ items: arrayConfig(['id', 'at']) }),
  allegro_catalog_maintenance: containerConfig({ errors: arrayConfig(['id', 'at']) }),
  allegro_autonomous_agent_state: containerConfig({ recentActions: arrayConfig(['id', 'at']) }),
  ai_banner_assets: containerConfig({ items: arrayConfig(['id']) }),
  allegro_autonomous_agent_review: containerConfig({ items: arrayConfig(['id', 'at']) }),
  supplier_order_email_audit: containerConfig({ items: objectConfig() }),
  inventory_stock_decisions: containerConfig({ items: arrayConfig(['id', 'decisionId']) }),
  infakt_supplier_access: containerConfig({ items: arrayConfig(['id', 'supplierId']) }),
  infakt_invoice_links: containerConfig({ items: objectConfig() }),
  infakt_purchase_price_sync: containerConfig({
    costDocuments: objectConfig(), documents: objectConfig(), lineMappings: objectConfig(),
    errors: arrayConfig(['id', 'at']), pendingItems: arrayConfig(['id', 'ean', 'sku']), recentMatches: arrayConfig(['id', 'ean', 'sku']),
  }),
  catalog_quality_audit: containerConfig({
    history: arrayConfig(['id', 'at']), orphanArchive: arrayConfig(['id', 'externalId', 'sku', 'ean']),
  }),
});

export function cloneNormalizedValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function normalizedContentHash(value) {
  return crypto.createHash('sha256').update(stable(value)).digest('hex');
}

function fallbackRecordId(value, ordinal) {
  const fingerprint = crypto.createHash('sha1').update(stable(value)).digest('hex').slice(0, 20);
  return `auto-${fingerprint}-${ordinal}`;
}

function arrayRecordId(value, config, ordinal, used) {
  let base = '';
  if (value && typeof value === 'object') {
    for (const field of config.idFields || []) {
      if (value[field] !== undefined && value[field] !== null && String(value[field]).trim()) { base = String(value[field]).trim(); break; }
    }
  } else if (value !== undefined && value !== null && String(value).trim()) base = `value-${String(value).trim()}`;
  if (!base) base = fallbackRecordId(value, ordinal);
  let id = base, suffix = 1;
  while (used.has(id)) id = `${base}#${++suffix}`;
  used.add(id); return id;
}

export function splitNormalizedValue(value, config) {
  if (config.kind === 'value') return { metadata: {}, records: [{ collection: 'value', recordId: 'singleton', ordinal: 0, data: cloneNormalizedValue(value) }] };
  if (config.kind === 'array') {
    const used = new Set();
    return { metadata: {}, records: (Array.isArray(value) ? value : []).map((data, ordinal) => ({ collection: 'value', recordId: arrayRecordId(data, config, ordinal, used), ordinal, data: cloneNormalizedValue(data) })) };
  }
  if (config.kind === 'object') {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return { metadata: {}, records: Object.entries(source).map(([recordId, data], ordinal) => ({ collection: 'value', recordId, ordinal, data: cloneNormalizedValue(data) })) };
  }
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const metadata = cloneNormalizedValue(source);
  const records = [];
  for (const [field, childConfig] of Object.entries(config.collections || {})) {
    delete metadata[field];
    const split = splitNormalizedValue(source[field], childConfig);
    for (const row of split.records) records.push({ ...row, collection: field });
  }
  return { metadata, records };
}

export function hydrateNormalizedValue(metadata, records, config) {
  const byCollection = new Map();
  for (const row of records || []) {
    const list = byCollection.get(row.collection) || [];
    list.push(row); byCollection.set(row.collection, list);
  }
  const hydrateCollection = (childConfig, collection) => {
    const rows = (byCollection.get(collection) || []).slice().sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
    if (childConfig.kind === 'value') return rows[0]?.data;
    if (childConfig.kind === 'array') return rows.map((row) => cloneNormalizedValue(row.data));
    if (childConfig.kind === 'object') return Object.fromEntries(rows.map((row) => [row.recordId, cloneNormalizedValue(row.data)]));
    return {};
  };
  if (config.kind !== 'container') return hydrateCollection(config, 'value');
  const result = cloneNormalizedValue(metadata) || {};
  for (const [field, childConfig] of Object.entries(config.collections || {})) result[field] = hydrateCollection(childConfig, field);
  return result;
}
