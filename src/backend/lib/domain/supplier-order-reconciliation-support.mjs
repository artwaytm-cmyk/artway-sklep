import crypto from 'node:crypto';
import { supplierProductIdentifier } from './supplier-order-email.mjs';

const DEFAULT_SUPPLIER = 'Bez przypisanego dostawcy';
const MAX_QUANTITY = 1_000_000;

const EDITABLE_DRAFT_STATUSES = new Set([
  '', 'szkic', 'do sprawdzenia', 'zaakceptowane', 'wyslane na telegram',
  'draft', 'review', 'approved', 'telegram preview',
]);
const COMMITTED_DRAFT_STATUSES = new Set([
  'wyslane do producenta', 'wyslane do dostawcy', 'czesciowo wyslane e-mailem',
  'czesciowo zrealizowane', 'wysylanie e mail', 'sent', 'partially sent', 'partially fulfilled',
]);
const CLOSED_ORDER_STATUSES = new Set([
  'anulowane', 'anulowany', 'cancelled', 'canceled', 'wyslane', 'nadane', 'sent', 'shipped',
  'dostarczone', 'delivered', 'zakonczone', 'completed', 'zrealizowane', 'fulfilled',
  'zwrot', 'returned', 'zwrot pieniedzy', 'refunded',
]);

function text(value = '', limit = 300) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
}

function normalized(value = '') {
  return text(value, 160).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function quantity(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(MAX_QUANTITY, Math.max(0, Math.floor(number)));
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function productIdOf(value = {}) {
  const source = object(value);
  return text(firstValue(
    source.productId, source.produktId, source.product_id,
    source.product?.id, source.produkt?.id, source.id,
  ), 160);
}

function orderIdOf(order = {}) {
  return text(firstValue(
    order.nr, order.number, order.orderNumber, order.orderId, order.id,
    order.checkoutForm?.id, order.checkoutFormId,
  ), 180);
}

function orderStatusOf(order = {}) {
  return normalized(firstValue(
    order.status, order.fulfillmentStatus, order.fulfilmentStatus,
    order.checkoutForm?.status, order.orderStatus,
  ));
}

function isActiveOrder(order = {}) {
  if (!order || typeof order !== 'object') return false;
  if (order.deleted === true || order.usuniete === true || order.cancelled === true || order.canceled === true) return false;
  if (order.active === false || order.shipped === true || order.fulfilled === true) return false;
  return !CLOSED_ORDER_STATUSES.has(orderStatusOf(order));
}

function inventoryModeOf(order = {}) {
  const mode = normalized(firstValue(order.inventoryMode, order.inventory_mode, order.stockMode));
  return mode === 'deducted on create' || mode === 'deducted on shipment'
    ? 'deducted_on_create'
    : 'reserved_until_shipment';
}

function orderItemsOf(order = {}) {
  const source = firstValue(order.pozycjeDane, order.items, order.lineItems, order.produkty, order.pozycje);
  const grouped = new Map();
  for (const raw of array(source)) {
    const id = productIdOf(raw);
    const qty = quantity(firstValue(raw.ilosc, raw.ile, raw.quantity, raw.qty, raw.quantityOrdered), 1);
    if (!id || qty <= 0) continue;
    const old = grouped.get(id);
    if (old) old.quantity += qty;
    else grouped.set(id, { productId: id, quantity: qty, raw: object(raw) });
  }
  return [...grouped.values()];
}

function catalogArray(input = {}) {
  const explicit = firstValue(input.products, input.catalogProducts, input.catalog);
  if (Array.isArray(explicit)) return explicit;
  const settings = object(input.settings);
  return firstValue(
    settings.artway_produkty_katalog,
    settings.products,
    settings.produkty,
  ) || [];
}

function productMap(input = {}) {
  const map = new Map();
  for (const product of array(catalogArray(input))) {
    const id = productIdOf(product);
    if (id) map.set(id, object(product));
  }
  return map;
}

function stockOf(settings = {}, product = {}, productId = '') {
  const stocks = object(settings.artway_stany);
  if (Object.prototype.hasOwnProperty.call(stocks, productId)) {
    return quantity(stocks[productId]);
  }
  for (const key of ['stan', 'stock', 'quantity', 'stockQuantity']) {
    if (Object.prototype.hasOwnProperty.call(product, key) && product[key] !== '' && product[key] != null) {
      return quantity(product[key]);
    }
  }
  // Produkty importowane zaczynają od zera. Brak kartoteki stanu nie może
  // udawać nieskończonej dostępności podczas przygotowywania zakupu.
  return 0;
}

function warehouseMeta(settings = {}, productId = '') {
  const cards = object(settings.artway_magazyn_produkty);
  return object(cards[productId]);
}

function sourceUrls(product = {}) {
  return [
    product.sourceUrl, product.producentUrl, product.agentImportUrl, product.url,
    product.sourceEvidence?.url,
  ].map((value) => text(value, 3000).toLowerCase()).filter(Boolean);
}

/** Ustala dostawcę w kolejności: kartoteka magazynowa, producent/marka, URL. */
export function resolveProductSupplier(product = {}, settings = {}, productId = productIdOf(product)) {
  const metaSupplier = text(firstValue(
    warehouseMeta(settings, String(productId)).dostawca,
    warehouseMeta(settings, String(productId)).supplier,
  ), 160);
  if (metaSupplier) return metaSupplier;
  const catalogSupplier = text(firstValue(product.producent, product.manufacturer, product.marka, product.brand), 160);
  const catalogSupplierKey = normalized(catalogSupplier);
  if (catalogSupplierKey.includes('alexander')) return 'Alexander';
  if (catalogSupplierKey.includes('multigra')) return 'Multigra';
  if (catalogSupplier) return catalogSupplier;
  const urls = sourceUrls(product).join(' ');
  if (/alexander(?:\.com)?\.pl|sklep\.alexander|\balexander\b/.test(urls)) return 'Alexander';
  if (/multigra(?:\.com)?\.pl|\bmultigra\b/.test(urls)) return 'Multigra';
  return DEFAULT_SUPPLIER;
}

function productCode(product = {}, meta = {}) {
  const merged = {
    ...meta,
    ...product,
    productId: productIdOf(product),
    kod: firstValue(product.kod, meta.kod, meta.code),
    supplierCode: firstValue(product.supplierCode, product.kodDostawcy, meta.supplierCode, meta.kodDostawcy),
    catalogCode: firstValue(product.catalogCode, product.kodKatalogowy, meta.catalogCode, meta.kodKatalogowy),
  };
  return text(supplierProductIdentifier(merged).value || '—', 160);
}

function productEan(product = {}, meta = {}) {
  return text(firstValue(meta.ean, meta.ean13, product.ean, product.gtin, product.EAN, product.GTIN), 40);
}

function productName(product = {}, raw = {}, productId = '') {
  return text(firstValue(product.nazwa, product.name, raw.nazwa, raw.name, raw.produkt, `Produkt ${productId}`), 300);
}

function movementIndex(input = {}) {
  const index = new Map();
  const add = (orderId, productId, movement) => {
    const orderKey = text(orderId, 180);
    const productKey = text(productId, 160);
    if (!orderKey || !productKey || !movement || typeof movement !== 'object') return;
    index.set(`${orderKey}::${productKey}`, movement);
  };
  const direct = firstValue(
    input.stockMovementByOrderProduct,
    input.stockMovementsByOrderProduct,
    input.orderStockMovements,
  );
  if (direct instanceof Map) {
    for (const [key, value] of direct.entries()) {
      if (value instanceof Map) {
        for (const [productId, movement] of value.entries()) add(key, productId, movement);
      } else if (value && typeof value === 'object' && !Array.isArray(value)
        && !Object.prototype.hasOwnProperty.call(value, 'stanPrzed')
        && !Object.prototype.hasOwnProperty.call(value, 'before')) {
        for (const [productId, movement] of Object.entries(value)) add(key, productId, movement);
      } else {
        const [orderId, productId] = String(key).split(/::|\|/);
        add(orderId, productId, value);
      }
    }
  } else if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    for (const [key, value] of Object.entries(direct)) {
      if (value && typeof value === 'object' && !Array.isArray(value)
        && !Object.prototype.hasOwnProperty.call(value, 'stanPrzed')
        && !Object.prototype.hasOwnProperty.call(value, 'before')) {
        for (const [productId, movement] of Object.entries(value)) add(key, productId, movement);
      } else {
        const [orderId, productId] = key.split(/::|\|/);
        add(orderId, productId, value);
      }
    }
  }
  const movements = Array.isArray(direct)
    ? direct
    : array(object(input.settings).artway_ruchy_magazynowe);
  for (const movement of movements) {
    add(
      firstValue(movement.orderId, movement.orderNumber, movement.nrZamowienia, movement.dokument),
      firstValue(movement.productId, movement.produktId),
      movement,
    );
  }
  return index;
}

function movementBefore(movement) {
  if (!movement || typeof movement !== 'object') return null;
  const raw = firstValue(movement.stanPrzed, movement.before, movement.stockBefore);
  if (raw === undefined || raw === null || raw === '') return null;
  return quantity(raw);
}

function draftStatus(draft = {}) {
  return normalized(draft.status || 'szkic');
}

/** Czy dokument można bezpiecznie przeliczać przed wysłaniem do producenta. */
export function supplierDraftIsEditable(draft = {}) {
  return EDITABLE_DRAFT_STATUSES.has(draftStatus(draft));
}

function supplierDraftIsCommitted(draft = {}) {
  return COMMITTED_DRAFT_STATUSES.has(draftStatus(draft));
}

function supplierOfDraft(draft = {}) {
  return text(firstValue(
    draft.supplier, draft.dostawca, draft.dostawcy?.[0],
    draft.pozycje?.[0]?.dostawca, draft.items?.[0]?.supplier,
  ), 160) || DEFAULT_SUPPLIER;
}

function draftItems(draft = {}) {
  return array(firstValue(draft.pozycje, draft.items));
}

function draftItemQuantity(item = {}) {
  return quantity(firstValue(item.ilosc, item.quantity, item.qty));
}

function draftItemReceived(item = {}) {
  return quantity(firstValue(item.przyjeto, item.received, item.fulfilledQuantity));
}

function manualExtraOf(item = {}) {
  if (Object.prototype.hasOwnProperty.call(item, 'manualExtra')) return quantity(item.manualExtra);
  if (Object.prototype.hasOwnProperty.call(item, 'nadwyzka')) return quantity(item.nadwyzka);
  const ordered = draftItemQuantity(item);
  const required = quantity(firstValue(item.iloscPotrzebna, item.requiredQuantity, ordered));
  return Math.max(0, ordered - required);
}

function contentView(items = []) {
  return array(items).map((item) => ({
    productId: text(firstValue(item.produktId, item.productId), 160),
    supplier: text(firstValue(item.dostawca, item.supplier), 160),
    code: text(firstValue(item.kod, item.code), 160),
    ean: text(item.ean, 40),
    name: text(firstValue(item.nazwa, item.name), 300),
    required: quantity(firstValue(item.iloscPotrzebna, item.requiredQuantity)),
    manualExtra: manualExtraOf(item),
    quantity: draftItemQuantity(item),
    orders: [...new Set(array(firstValue(item.zamowienia, item.orderRefs)).map((value) => text(value, 180)).filter(Boolean))].sort(),
    orderAllocations: Object.entries(object(item.orderAllocations)).sort(([left], [right]) => left.localeCompare(right, 'pl', { numeric: true })),
  })).sort((left, right) => left.productId.localeCompare(right.productId, 'pl', { numeric: true }));
}

function sameContent(left, right) {
  return JSON.stringify(contentView(left)) === JSON.stringify(contentView(right));
}

function clearApproval(draft) {
  for (const key of ['approval', 'approvedAt', 'approvedBy', 'approvalRevision', 'approvalStatus']) delete draft[key];
  if (draft.telegramSentAt) {
    draft.telegramLastSentAt = draft.telegramSentAt;
    delete draft.telegramSentAt;
  }
}

function draftKey(supplier = '') {
  return normalized(supplier) || normalized(DEFAULT_SUPPLIER);
}

function newDraftId(supplier, drafts, now) {
  const seed = `${supplier}|${now.toISOString()}|${drafts.length}`;
  return `SPD-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 14)}`;
}

function newDraftNumber(now, sequence) {
  return `AZ/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(sequence).padStart(4, '0')}`;
}

function statusAfterChange(previousStatus, empty) {
  if (empty) return 'wyczyszczone';
  const status = normalized(previousStatus);
  if (['zaakceptowane', 'approved', 'wyslane na telegram', 'telegram preview'].includes(status)) return 'do sprawdzenia';
  return EDITABLE_DRAFT_STATUSES.has(status) ? (text(previousStatus, 80) || 'szkic') : 'szkic';
}

function summarizeDraft(base, supplier, items, now, changed, historyText) {
  const storedRevision = quantity(base.revision);
  const next = {
    ...base,
    supplier,
    dostawca: supplier,
    dostawcy: [supplier],
    pozycje: items,
    sztuk: items.reduce((sum, item) => sum + draftItemQuantity(item), 0),
    tryb: base.tryb || 'braki',
    typ: base.typ || 'zlecenie-producent',
    revision: Math.max(1, storedRevision || 1),
  };
  delete next.items;
  if (changed) {
    const timestamp = now.toISOString();
    next.revision = storedRevision > 0 ? storedRevision + 1 : 1;
    next.status = statusAfterChange(base.status, items.length === 0);
    next.aktualizacja = timestamp;
    next.updatedAt = timestamp;
    next.historia = [...array(base.historia), { at: timestamp, type: 'server-reconcile', text: historyText }].slice(-100);
    clearApproval(next);
  }
  return next;
}

function makeLine({ productId, product, raw, settings, supplier, required, manualExtra, demand }) {
  const meta = warehouseMeta(settings, productId);
  const ordered = required + manualExtra;
  return {
    produktId: productId,
    externalId: text(firstValue(product.externalId, product.external_id, product.EXTERNAL_ID), 160),
    sku: text(firstValue(product.sku, product.SKU), 160),
    kodProducenta: text(firstValue(product.kodProducenta, product.mpn, product.manufacturerCode, meta.kodProducenta), 160),
    mpn: text(firstValue(product.mpn, product.kodProducenta, product.manufacturerCode, meta.kodProducenta), 160),
    optimaCode: text(firstValue(product.optimaCode, product.supplierOptimaCode, product.kodOptima, meta.optimaCode, meta.supplierOptimaCode, meta.kodOptima), 160),
    kodDostawcy: text(firstValue(product.kodDostawcy, product.supplierCode, product.vendorCode, meta.kodDostawcy, meta.supplierCode, meta.vendorCode), 160),
    kod: productCode(product, meta),
    ean: productEan(product, meta),
    nazwa: productName(product, raw, productId),
    dostawca: supplier,
    ilosc: ordered,
    iloscPotrzebna: required,
    manualExtra,
    nadwyzka: manualExtra,
    przyjeto: 0,
    stan: demand.stock,
    rezerwacje: demand.reservedQuantity,
    legacyShortage: demand.legacyShortage,
    dostepne: demand.stock - demand.reservedQuantity,
    zamowienia: Object.keys(object(demand.orderAllocations)).length
      ? Object.keys(demand.orderAllocations).sort((left, right) => left.localeCompare(right, 'pl', { numeric: true }))
      : [...demand.orderRefs].sort((left, right) => left.localeCompare(right, 'pl', { numeric: true })),
    orderAllocations: { ...object(demand.orderAllocations) },
    powod: required > 0
      ? `Brak do aktywnych zamówień: ${required} szt.${manualExtra ? ` • ręczna nadwyżka: ${manualExtra} szt.` : ''}`
      : `Ręczna nadwyżka: ${manualExtra} szt.`,
  };
}


export { DEFAULT_SUPPLIER, MAX_QUANTITY, EDITABLE_DRAFT_STATUSES, COMMITTED_DRAFT_STATUSES, CLOSED_ORDER_STATUSES, text, normalized, quantity, firstValue, array, object, clone, productIdOf, orderIdOf, orderStatusOf, isActiveOrder, inventoryModeOf, orderItemsOf, catalogArray, productMap, stockOf, warehouseMeta, sourceUrls, productCode, productEan, productName, movementIndex, movementBefore, draftStatus, supplierDraftIsCommitted, supplierOfDraft, draftItems, draftItemQuantity, draftItemReceived, manualExtraOf, contentView, sameContent, clearApproval, draftKey, newDraftId, newDraftNumber, statusAfterChange, summarizeDraft, makeLine };

