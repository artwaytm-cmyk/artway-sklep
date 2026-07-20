import crypto from 'node:crypto';
import { synchronizeProductIdentifierAliases } from './product-identifiers.mjs';

export const PRODUCT_LINK_IMPORT_INDEX_KEY = 'product-link-import:index:v1';
export const PRODUCT_LINK_IMPORT_JOB_PREFIX = 'product-link-import:job:v1:';
export const PRODUCT_LINK_IMPORT_ITEMS_PREFIX = 'product-link-import:items:v1:';

const MAX_ROWS = 1000;
const ITEMS_PER_SHARD = 100;
const CAS_ATTEMPTS = 12;
const LEASE_MS = 5 * 60 * 1000;
const ITEM_STATUSES = Object.freeze(['queued', 'processing', 'added', 'updated_existing', 'skipped_existing', 'needs_review', 'failed', 'cancelled']);
const TERMINAL = new Set(['added', 'updated_existing', 'skipped_existing', 'needs_review', 'failed', 'cancelled']);
const REVIEW_PATCH_FIELDS = new Set([
  'nazwa', 'cena', 'producent', 'marka', 'kategoria', 'opisKrotki', 'opis',
  'ikona', 'kolor', 'zdjecie', 'ean', 'gtin', 'externalId', 'sku', 'kodProducenta', 'mpn',
]);
const ALEXANDER_HOSTS = new Set([
  'sklep.alexander.com.pl',
  'www.sklep.alexander.com.pl',
]);
const BLOCKED_HOST_SUFFIXES = Object.freeze(['.local', '.internal', '.localhost', '.test', '.invalid', '.example']);

const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const clean = (value, max = 1000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const clone = (value) => structuredClone(value);

function serviceError(message, code = 'product_link_import_error', status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function dateFrom(now) {
  const result = now();
  const value = result instanceof Date ? result : new Date(result);
  return Number.isFinite(value.getTime()) ? value : new Date();
}

function isPublicProductHost(value) {
  const host = clean(value, 300).toLowerCase().replace(/\.$/, '');
  if (!host || !host.includes('.') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host)) return false;
  if (host === 'localhost' || host === 'localhost.localdomain' || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  if (host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return false;
  const labels = host.split('.');
  if (labels.some((label) => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) return false;
  const tld = labels.at(-1) || '';
  return /^[a-z]{2,63}$/i.test(tld) || /^xn--[a-z0-9-]{2,59}$/i.test(tld);
}

function safeUrl(value) {
  try {
    const url = new URL(clean(value, 3000));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!isPublicProductHost(host)) return null;
    if (url.username || url.password || (url.port && !['80', '443'].includes(url.port))) return null;
    const queryLooksLikeProduct = [...url.searchParams.keys()].some((key) => /^(?:p|id|sku|product|produkt|item|offer)(?:[_-]?id)?$/i.test(key));
    if ((!url.pathname || url.pathname === '/') && !queryLooksLikeProduct) return null;
    url.protocol = 'https:';
    url.hostname = ALEXANDER_HOSTS.has(host) ? 'www.sklep.alexander.com.pl' : host;
    url.port = '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|query_id|fbclid|gclid|ref|source)$/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    url.searchParams.sort();
    return url.toString().replace(/\?$/, '');
  } catch {
    return null;
  }
}

function rowUrl(row) {
  if (typeof row === 'string') return row;
  return row?.url || row?.link || row?.href || row?.sourceUrl || row?.['Link do produktu'] || row?.['link do produktu'] || '';
}

function normalizeRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw serviceError('Plik nie zawiera linków do produktów.', 'product_link_import_empty', 422);
  if (rows.length > MAX_ROWS) throw serviceError(`Jeden import może zawierać maksymalnie ${MAX_ROWS} linków.`, 'product_link_import_too_large', 422);
  return rows.map((row, index) => {
    const url = safeUrl(rowUrl(row));
    if (!url) throw serviceError(`Wiersz ${index + 1} zawiera nieprawidłowy link. Wymagana jest publiczna strona konkretnego produktu producenta lub dostawcy.`, 'product_link_import_source_not_allowed', 422);
    return {
      rowNumber: Math.max(1, Number(row?.rowNumber ?? row?.lp ?? row?.Lp) || index + 1),
      name: clean(row?.name || row?.nazwa || row?.['Nazwa produktu'], 500),
      url,
    };
  });
}

function importFingerprint(rows, updateExisting = false) {
  return crypto.createHash('sha256').update(`${updateExisting ? 'refresh' : 'add-only'}\n${rows.map((row) => `${row.rowNumber}\t${row.url}`).join('\n')}`).digest('hex');
}

function normalizeJob(value = {}) {
  const source = asObject(value);
  const total = Math.max(0, Number(source.total) || 0);
  return {
    schemaVersion: 1,
    id: clean(source.id, 160),
    fingerprint: clean(source.fingerprint, 100),
    fileName: clean(source.fileName, 300),
    createdBy: clean(source.createdBy, 300),
    updateExisting: source.updateExisting === true,
    state: ['running', 'paused', 'cancelled', 'completed'].includes(source.state) ? source.state : 'running',
    total,
    itemShards: asArray(source.itemShards).map((entry, index) => ({
      index: Math.max(0, Number(entry?.index) || index),
      key: clean(entry?.key, 400),
      count: Math.max(0, Number(entry?.count) || 0),
    })).filter((entry) => entry.key),
    cursorShard: Math.max(0, Number(source.cursorShard) || 0),
    lease: asObject(source.lease),
    summary: normalizeStoredSummary(source.summary, total),
    completedItems: asObject(source.completedItems),
    createdAt: clean(source.createdAt, 50) || null,
    updatedAt: clean(source.updatedAt, 50) || null,
  };
}

function reviewDraft(value = {}, sourceUrl = '') {
  const source = asObject(value);
  const draft = {
    nazwa: clean(source.nazwa || source.name, 500),
    cena: Number(source.cena || source.price) > 0 ? Math.round(Number(source.cena || source.price) * 100) / 100 : 0,
    producent: clean(source.producent || source.manufacturer || source.marka || source.brand, 160),
    marka: clean(source.marka || source.brand || source.producent || source.manufacturer, 160),
    kategoria: clean(source.kategoria || source.category, 180),
    opisKrotki: clean(source.opisKrotki || source.shortDescription, 500),
    opis: clean(source.opis || source.description, 6000),
    ikona: clean(source.ikona || '🎲', 20),
    kolor: clean(source.kolor || '#dbeafe', 30),
    zdjecie: clean(source.zdjecie || source.image || source.imageUrl, 3000),
    ean: clean(source.ean || source.gtin || source.EAN || source.GTIN, 40).replace(/\D/g, ''),
    gtin: clean(source.gtin || source.ean || source.GTIN || source.EAN, 40).replace(/\D/g, ''),
    externalId: clean(source.externalId || source.external_id || source.sku, 160),
    sku: clean(source.sku || source.externalId || source.external_id, 160),
    kodProducenta: clean(source.kodProducenta || source.mpn || source.manufacturerCode, 160),
    mpn: clean(source.mpn || source.kodProducenta || source.manufacturerCode, 160),
    sourceUrl: clean(source.sourceUrl || source.producentUrl || sourceUrl, 3000),
    producentUrl: clean(source.producentUrl || source.sourceUrl || sourceUrl, 3000),
  };
  const images = asArray(source.zdjecia || source.images).map((entry) => clean(entry, 3000)).filter(Boolean).slice(0, 8);
  if (images.length) draft.zdjecia = images;
  return synchronizeProductIdentifierAliases(draft);
}

function reviewPatch(value = {}) {
  const source = asObject(value), patch = {};
  for (const field of REVIEW_PATCH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    if (field === 'cena') {
      const number = Number(String(source[field] ?? '').replace(',', '.'));
      if (!Number.isFinite(number) || number < 0 || number > 1_000_000) throw serviceError('Cena musi być liczbą od 0 do 1 000 000 zł.', 'product_link_import_review_price_invalid', 422);
      patch.cena = Math.round(number * 100) / 100;
    } else {
      const limits = { opis: 6000, opisKrotki: 500, zdjecie: 3000, nazwa: 500 };
      patch[field] = clean(source[field], limits[field] || 180);
    }
  }
  return patch;
}

function reviewMissing(product = {}) {
  const missing = [];
  if (!clean(product.nazwa, 300)) missing.push('nazwa');
  if (!(Number(product.cena) > 0)) missing.push('cena sprzedaży');
  if (!clean(product.producent || product.marka, 160)) missing.push('producent lub marka');
  if (!clean(product.kategoria, 180)) missing.push('kategoria sklepu');
  if (!safeUrl(product.sourceUrl || product.producentUrl)) missing.push('link źródłowy');
  return missing;
}

function publicItem(item = {}) {
  const result = {
    id: clean(item.id, 220),
    rowNumber: Math.max(1, Number(item.rowNumber) || 1),
    name: clean(item.name, 500),
    url: clean(item.url, 3000),
    status: ITEM_STATUSES.includes(item.status) ? item.status : 'queued',
    attempts: Math.max(0, Number(item.attempts) || 0),
    updatedAt: clean(item.updatedAt, 50) || null,
  };
  if (item.productId !== undefined && item.productId !== null && item.productId !== '') result.productId = item.productId;
  if (item.duplicateProductId !== undefined && item.duplicateProductId !== null && item.duplicateProductId !== '') result.duplicateProductId = item.duplicateProductId;
  if (clean(item.reason, 1000)) result.reason = clean(item.reason, 1000);
  if (clean(item.error, 1000)) result.error = clean(item.error, 1000);
  if (item.status === 'needs_review') {
    result.reviewDraft = reviewDraft(item.reviewDraft, item.url);
    result.missingFields = asArray(item.missingFields).map((entry) => clean(entry, 100)).filter(Boolean).slice(0, 20);
  }
  return result;
}

function summary(items) {
  const counts = Object.fromEntries(ITEM_STATUSES.map((status) => [status, 0]));
  for (const item of items) counts[ITEM_STATUSES.includes(item.status) ? item.status : 'queued'] += 1;
  const processed = [...TERMINAL].reduce((sum, status) => sum + counts[status], 0);
  return { total: items.length, ...counts, processed, percent: items.length ? Math.round(processed * 1000 / items.length) / 10 : 100 };
}

function normalizeStoredSummary(value, total = 0) {
  const source = asObject(value), result = { total: Math.max(0, Number(total) || Number(source.total) || 0) };
  for (const status of ITEM_STATUSES) result[status] = Math.max(0, Number(source[status]) || 0);
  if (!Object.keys(source).length && result.total) result.queued = result.total;
  result.processing = 0;
  result.processed = [...TERMINAL].reduce((sum, status) => sum + result[status], 0);
  result.percent = result.total ? Math.round(result.processed * 1000 / result.total) / 10 : 100;
  return result;
}

export { MAX_ROWS, ITEMS_PER_SHARD, CAS_ATTEMPTS, LEASE_MS, ITEM_STATUSES, TERMINAL, REVIEW_PATCH_FIELDS, ALEXANDER_HOSTS, BLOCKED_HOST_SUFFIXES, asArray, asObject, clean, clone, serviceError, dateFrom, isPublicProductHost, safeUrl, rowUrl, normalizeRows, importFingerprint, normalizeJob, reviewDraft, reviewPatch, reviewMissing, publicItem, summary, normalizeStoredSummary };
