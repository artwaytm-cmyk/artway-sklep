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

/**
 * Czysto przelicza bieżące szkice zakupowe. Funkcja nie zapisuje danych i nie
 * wykonuje żadnej wysyłki zewnętrznej.
 */
export function reconcileSupplierOrderDrafts(input = {}) {
  const settings = object(input.settings);
  const orders = array(input.orders);
  const products = productMap(input);
  const originalDrafts = array(firstValue(input.supplierDrafts, input.drafts)).map(clone);
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  if (Number.isNaN(now.getTime())) throw new TypeError('Nieprawidłowa data przeliczenia szkiców producentów.');
  const movements = movementIndex(input);
  const diagnostics = { skippedInactiveOrders: 0, skippedItemsWithoutProductId: 0, legacyWithoutMovement: [], duplicateEditableDrafts: [] };
  const demandByProduct = new Map();

  for (const order of orders) {
    if (!isActiveOrder(order)) {
      diagnostics.skippedInactiveOrders += 1;
      continue;
    }
    const orderId = orderIdOf(order) || `zamowienie-${orders.indexOf(order) + 1}`;
    const items = orderItemsOf(order);
    const rawItems = array(firstValue(order.pozycjeDane, order.items, order.lineItems, order.produkty, order.pozycje));
    diagnostics.skippedItemsWithoutProductId += rawItems.filter((item) => !productIdOf(item)).length;
    const mode = inventoryModeOf(order);
    for (const item of items) {
      const record = demandByProduct.get(item.productId) || {
        productId: item.productId,
        reservedQuantity: 0,
        legacyShortage: 0,
        orderRefs: new Set(),
        orderRequests: [],
        raw: item.raw,
      };
      record.orderRefs.add(orderId);
      const orderRequest = {
        orderId,
        quantity: item.quantity,
        mode,
        legacyShortage: 0,
      };
      if (mode === 'deducted_on_create') {
        const movement = movements.get(`${orderId}::${item.productId}`);
        const before = movementBefore(movement);
        if (before === null) {
          diagnostics.legacyWithoutMovement.push({ orderId, productId: item.productId, quantity: item.quantity });
        } else {
          orderRequest.legacyShortage = Math.max(0, item.quantity - before);
          record.legacyShortage += orderRequest.legacyShortage;
        }
      } else {
        record.reservedQuantity += item.quantity;
      }
      record.orderRequests.push(orderRequest);
      demandByProduct.set(item.productId, record);
    }
  }

  for (const demand of demandByProduct.values()) {
    const product = products.get(demand.productId) || object(demand.raw.product || demand.raw.produkt);
    demand.product = product;
    demand.stock = stockOf(settings, product, demand.productId);
    let available = demand.stock;
    const orderAllocations = {};
    for (const request of demand.orderRequests) {
      let missing;
      if (request.mode === 'deducted_on_create') missing = request.legacyShortage;
      else {
        const covered = Math.min(available, request.quantity);
        available -= covered;
        missing = request.quantity - covered;
      }
      if (missing > 0) orderAllocations[request.orderId] = (orderAllocations[request.orderId] || 0) + missing;
    }
    demand.orderAllocations = orderAllocations;
    demand.shortage = Object.values(orderAllocations).reduce((sum, value) => sum + quantity(value), 0);
  }

  // Wysłane, lecz jeszcze nieprzyjęte pozycje pokrywają brak. Nie wolno ich
  // zamawiać ponownie w nowym szkicu.
  const committedByProduct = new Map();
  for (const draft of originalDrafts.filter(supplierDraftIsCommitted)) {
    for (const item of draftItems(draft)) {
      const id = productIdOf(item);
      if (!id) continue;
      const outstanding = Math.max(0, draftItemQuantity(item) - draftItemReceived(item));
      committedByProduct.set(id, (committedByProduct.get(id) || 0) + outstanding);
    }
  }

  // Nadwyżka jest decyzją administratora, dlatego przechodzi między kolejnymi
  // przeliczeniami i nawet po zmianie dostawcy produktu.
  const manualExtraByProduct = new Map();
  const existingLineByProduct = new Map();
  for (const draft of originalDrafts.filter(supplierDraftIsEditable)) {
    for (const item of draftItems(draft)) {
      const id = productIdOf(item);
      if (!id) continue;
      manualExtraByProduct.set(id, Math.max(manualExtraByProduct.get(id) || 0, manualExtraOf(item)));
      if (!existingLineByProduct.has(id)) existingLineByProduct.set(id, item);
    }
  }

  const allProductIds = new Set([...demandByProduct.keys(), ...manualExtraByProduct.keys()]);
  const desiredBySupplier = new Map();
  const shortageRows = [];
  for (const productId of allProductIds) {
    const demand = demandByProduct.get(productId) || {
      productId, reservedQuantity: 0, legacyShortage: 0, orderRefs: new Set(), raw: {},
      orderRequests: [], orderAllocations: {}, product: products.get(productId) || {}, stock: stockOf(settings, products.get(productId) || {}, productId), shortage: 0,
    };
    const committedQuantity = committedByProduct.get(productId) || 0;
    const required = Math.max(0, demand.shortage - committedQuantity);
    const manualExtra = manualExtraByProduct.get(productId) || 0;
    if (required <= 0 && manualExtra <= 0) continue;
    const product = products.get(productId) || demand.product || {};
    const oldLine = existingLineByProduct.get(productId) || {};
    let supplier = resolveProductSupplier(
      Object.keys(product).length ? product : oldLine,
      settings,
      productId,
    );
    if (supplier === DEFAULT_SUPPLIER) supplier = text(firstValue(oldLine.dostawca, oldLine.supplier), 160) || supplier;
    const raw = Object.keys(object(demand.raw)).length ? demand.raw : oldLine;
    let committedRemaining = committedQuantity;
    const remainingOrderAllocations = {};
    for (const [reference, allocated] of Object.entries(object(demand.orderAllocations))) {
      const covered = Math.min(committedRemaining, quantity(allocated));
      committedRemaining -= covered;
      const remaining = quantity(allocated) - covered;
      if (remaining > 0) remainingOrderAllocations[reference] = remaining;
    }
    const line = makeLine({
      productId, product, raw, settings, supplier, required, manualExtra,
      demand: { ...demand, orderAllocations: remainingOrderAllocations },
    });
    const key = draftKey(supplier);
    if (!desiredBySupplier.has(key)) desiredBySupplier.set(key, { supplier, items: [] });
    desiredBySupplier.get(key).items.push(line);
    shortageRows.push({
      productId,
      supplier,
      stock: demand.stock,
      reservedQuantity: demand.reservedQuantity,
      legacyShortage: demand.legacyShortage,
      committedQuantity: committedByProduct.get(productId) || 0,
      requiredQuantity: required,
      manualExtra,
      quantity: required + manualExtra,
      orderRefs: [...demand.orderRefs],
    });
  }
  for (const group of desiredBySupplier.values()) {
    group.items.sort((left, right) => left.kod.localeCompare(right.kod, 'pl', { numeric: true }) || left.nazwa.localeCompare(right.nazwa, 'pl'));
  }

  const editableBySupplier = new Map();
  originalDrafts.forEach((draft, index) => {
    if (!supplierDraftIsEditable(draft)) return;
    const key = draftKey(supplierOfDraft(draft));
    if (!editableBySupplier.has(key)) editableBySupplier.set(key, []);
    editableBySupplier.get(key).push({ draft, index });
  });
  const output = originalDrafts.map(clone);
  const suppliersToProcess = new Set([...desiredBySupplier.keys(), ...editableBySupplier.keys()]);
  const created = [], updated = [], unchanged = [], superseded = [];

  for (const key of suppliersToProcess) {
    const desired = desiredBySupplier.get(key) || { supplier: supplierOfDraft(editableBySupplier.get(key)?.[0]?.draft || {}), items: [] };
    const candidates = editableBySupplier.get(key) || [];
    candidates.sort((left, right) => quantity(right.draft.revision) - quantity(left.draft.revision) || left.index - right.index);
    const primary = candidates[0];
    if (!primary) {
      if (!desired.items.length) continue;
      const id = newDraftId(desired.supplier, output, now);
      const base = {
        id,
        numer: newDraftNumber(now, output.length + 1),
        status: 'szkic',
        revision: 0,
        data: now.toISOString(),
        createdAt: now.toISOString(),
        historia: [],
      };
      const draft = summarizeDraft(base, desired.supplier, desired.items, now, true, 'Utworzono szkic z aktualnych braków magazynowych.');
      output.unshift(draft);
      created.push(draft.id);
      continue;
    }

    const contentChanged = !sameContent(draftItems(primary.draft), desired.items);
    const draftChanged = contentChanged || quantity(primary.draft.revision) < 1;
    const next = summarizeDraft(
      primary.draft,
      desired.supplier,
      desired.items,
      now,
      draftChanged,
      desired.items.length
        ? 'Przeliczono ilości z aktualnych aktywnych zamówień i stanu magazynowego.'
        : 'Usunięto nieaktualne braki po anulowaniu lub zmniejszeniu zamówień.',
    );
    output[primary.index] = next;
    (draftChanged ? updated : unchanged).push(next.id);

    for (const duplicate of candidates.slice(1)) {
      const replacement = { ...duplicate.draft };
      replacement.status = 'zastąpione';
      replacement.supersededBy = next.id;
      replacement.supersededAt = now.toISOString();
      replacement.revision = Math.max(1, quantity(replacement.revision) + 1);
      clearApproval(replacement);
      output[duplicate.index] = replacement;
      superseded.push(replacement.id);
      diagnostics.duplicateEditableDrafts.push({ supplier: desired.supplier, draftId: replacement.id, supersededBy: next.id });
    }
  }

  const activeDrafts = output.filter(supplierDraftIsEditable);
  return {
    drafts: output,
    activeDrafts,
    changed: created.length + updated.length + superseded.length > 0,
    created,
    updated,
    unchanged,
    superseded,
    shortages: shortageRows.sort((left, right) => left.supplier.localeCompare(right.supplier, 'pl') || left.productId.localeCompare(right.productId, 'pl', { numeric: true })),
    diagnostics,
  };
}

export const reconcileSupplierDrafts = reconcileSupplierOrderDrafts;
export { DEFAULT_SUPPLIER as SUPPLIER_WITHOUT_ASSIGNMENT };
