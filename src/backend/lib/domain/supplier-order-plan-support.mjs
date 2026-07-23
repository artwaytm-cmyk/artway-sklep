import crypto from 'node:crypto';

const MAX_QUANTITY = 1_000_000;
const EDITABLE_STATUSES = new Set([
  '', 'szkic', 'do sprawdzenia', 'zaakceptowane', 'wyslane na telegram',
  'draft', 'review', 'approved', 'telegram preview',
]);
const RECEIVABLE_STATUSES = new Set([
  'wyslane do producenta', 'wyslane do dostawcy', 'czesciowo wyslane e mailem',
  'czesciowo zrealizowane', 'sent', 'partially sent', 'partially fulfilled',
]);
const CORRECTABLE_STATUSES = new Set([
  'wyslane do producenta', 'wyslane do dostawcy', 'czesciowo wyslane e mailem',
  'sent', 'partially sent',
]);

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value = '', limit = 300) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
}

function normalized(value = '') {
  return text(value, 200).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function integer(value, { min = 0, max = MAX_QUANTITY, field = 'quantity' } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    const error = new TypeError(`Nieprawidłowa wartość pola ${field}.`);
    error.code = 'supplier_order_validation';
    error.status = 422;
    throw error;
  }
  return number;
}

function fail(message, code, status = 422, extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, extra);
  throw error;
}

function nowDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) throw new TypeError('Nieprawidłowa data operacji planu zatowarowania.');
  return date;
}

function statusKey(value = '') {
  return normalized(value);
}

function isEditable(draft = {}) {
  return EDITABLE_STATUSES.has(statusKey(draft.status));
}

function supplierOf(draft = {}) {
  return text(draft.supplier || draft.dostawca || draft.dostawcy?.[0] || draft.pozycje?.[0]?.dostawca, 160);
}

function draftItems(draft = {}) {
  return array(draft.pozycje || draft.items);
}

function quantityOf(line = {}) {
  const value = Number(line.ilosc ?? line.quantity ?? line.qty ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function requiredOf(line = {}) {
  const value = Number(line.iloscPotrzebna ?? line.requiredQuantity ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function receivedOf(line = {}) {
  const value = Number(line.przyjeto ?? line.received ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function orderAllocationsOf(line = {}) {
  const saved = object(line.orderAllocations);
  const entries = Object.entries(saved)
    .map(([reference, value]) => [text(reference, 180), Math.max(0, Math.floor(Number(value) || 0))])
    .filter(([reference, value]) => reference && value > 0);
  if (entries.length) return entries;
  const references = [...new Set(array(line.zamowienia || line.orderRefs).map((value) => text(value, 180)).filter(Boolean))];
  if (!references.length) return [];
  const total = quantityOf(line);
  const base = Math.floor(total / references.length);
  let remainder = total - (base * references.length);
  return references.map((reference) => [reference, base + (remainder-- > 0 ? 1 : 0)]).filter(([, value]) => value > 0);
}

function updateReceiptAllocations(line = {}) {
  let remaining = receivedOf(line);
  const allocations = {};
  for (const [reference, ordered] of orderAllocationsOf(line)) {
    const received = Math.min(ordered, remaining);
    allocations[reference] = received;
    remaining -= received;
  }
  line.receiptAllocations = allocations;
  return line;
}

function identifierValue(value = '') {
  return text(value, 180).toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Stabilne identyfikatory pozycji. Kolejność jest celowa: EXTERNAL_ID, SKU,
 * kod producenta, jawny kod katalogowy, EAN, a dopiero na końcu wewnętrzne ID
 * kartoteki używane wyłącznie do wewnętrznego powiązania (nigdy do eksportu).
 */
export function supplierLineIdentifiers(value = {}) {
  const source = object(value);
  const externalId = identifierValue(source.externalId ?? source.external_id ?? source.EXTERNAL_ID);
  const sku = identifierValue(source.sku ?? source.SKU);
  const manufacturerCode = identifierValue(
    source.kodProducenta ?? source.manufacturerCode ?? source.mpn ?? source.MPN,
  );
  const ean = identifierValue(source.ean ?? source.EAN ?? source.gtin ?? source.GTIN).replace(/\D/g, '');
  const productId = text(source.produktId ?? source.productId ?? source.id, 160);
  const catalogCodeCandidate = identifierValue(source.kod ?? source.code);
  const catalogCode = catalogCodeCandidate && catalogCodeCandidate !== identifierValue(productId)
    ? catalogCodeCandidate
    : '';
  return [
    externalId && `external:${externalId}`,
    sku && `sku:${sku}`,
    manufacturerCode && manufacturerCode !== '—' && `manufacturer:${manufacturerCode}`,
    catalogCode && catalogCode !== '—' && `catalog:${catalogCode}`,
    ean && `ean:${ean}`,
    productId && `product:${productId}`,
  ].filter(Boolean);
}

export function supplierLineStableKey(value = {}) {
  return supplierLineIdentifiers(value)[0] || '';
}

function sameLine(left = {}, right = {}) {
  const leftIds = new Set(supplierLineIdentifiers(left));
  return supplierLineIdentifiers(right).some((identifier) => leftIds.has(identifier));
}

function productLine(product = {}, input = {}, supplier = '') {
  // `product` jest kanoniczną kartoteką serwerową. Dane z żądania służą
  // wyłącznie do jej wskazania i nie mogą nadpisywać kodów ani nazwy.
  const source = object(product);
  const externalId = text(source.externalId ?? source.external_id ?? source.EXTERNAL_ID, 160);
  const sku = text(source.sku ?? source.SKU, 160);
  const kodProducenta = text(source.kodProducenta ?? source.manufacturerCode ?? source.mpn ?? source.MPN, 160);
  const optimaCode = text(source.optimaCode ?? source.supplierOptimaCode ?? source.kodOptima ?? source.comarchCode, 160);
  const kodDostawcy = text(source.kodDostawcy ?? source.supplierCode ?? source.vendorCode ?? source.towarCode, 160);
  const ean = text(source.ean ?? source.EAN ?? source.gtin ?? source.GTIN, 40).replace(/\D/g, '');
  const produktId = text(source.produktId ?? source.productId ?? source.id, 160);
  const rawCatalogCode = text(source.kod ?? source.code, 160);
  const catalogCode = rawCatalogCode && identifierValue(rawCatalogCode) !== identifierValue(produktId)
    ? rawCatalogCode
    : '';
  const kod = externalId || sku || kodProducenta || catalogCode || ean || '—';
  return {
    produktId,
    externalId,
    sku,
    kodProducenta,
    mpn: kodProducenta,
    optimaCode,
    kodDostawcy,
    ean,
    kod,
    nazwa: text(source.nazwa ?? source.name ?? `Produkt ${produktId || kod}`, 300),
    dostawca: supplier,
  };
}

function clearApproval(draft) {
  for (const key of ['approval', 'approvedAt', 'approvedBy', 'approvalRevision', 'approvalStatus']) delete draft[key];
}

function appendHistory(draft, at, type, message, actor) {
  draft.historia = [...array(draft.historia), {
    at,
    type,
    text: text(message, 600),
    operator: text(actor, 200) || 'administrator',
  }].slice(-150);
}

function summarize(draft) {
  const items = draftItems(draft);
  draft.pozycje = items;
  delete draft.items;
  draft.sztuk = items.reduce((sum, line) => sum + quantityOf(line), 0);
  draft.dostawcy = [supplierOf(draft)].filter(Boolean);
  return draft;
}

function nextDraft(supplier, drafts, now) {
  const seed = `${supplier}|${now.toISOString()}|${drafts.length}`;
  return {
    id: `SPD-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 14)}`,
    numer: `AZ/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(drafts.length + 1).padStart(4, '0')}`,
    typ: 'zlecenie-producent',
    tryb: 'braki',
    status: 'szkic',
    revision: 0,
    receiptRevision: 0,
    data: now.toISOString(),
    createdAt: now.toISOString(),
    supplier,
    dostawca: supplier,
    dostawcy: [supplier],
    pozycje: [],
    historia: [],
  };
}

function expectedRevision(input, draft) {
  const expected = integer(input.expectedRevision, { field: 'expectedRevision' });
  const current = Math.max(1, Number(draft.revision) || 1);
  if (expected !== current) fail(
    'Plan zatowarowania zmienił się na innym urządzeniu. Pobierz aktualną wersję.',
    'supplier_order_revision_conflict',
    409,
    { currentRevision: current },
  );
  return current;
}


export { RECEIVABLE_STATUSES, CORRECTABLE_STATUSES, object, array, text, normalized, integer, fail, nowDate, statusKey, isEditable, supplierOf, draftItems, quantityOf, requiredOf, receivedOf, orderAllocationsOf, updateReceiptAllocations, identifierValue, sameLine, productLine, clearApproval, appendHistory, summarize, nextDraft, expectedRevision };
