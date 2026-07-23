function array(value) { return Array.isArray(value) ? value : []; }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function text(value = '', limit = 220) { return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit); }
function normalized(value = '') {
  return text(value, 180).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function quantity(value) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0; }
function bump(record, key, amount = 1) { record[key] = Math.max(0, Number(record[key]) || 0) + amount; }

const CLOSED_OFFICIAL = new Set(['sent', 'picked up', 'cancelled', 'canceled', 'returned', 'shipped', 'delivered', 'completed', 'fulfilled']);
const INVENTORY_DEDUCTION_OFFICIAL = new Set(['sent', 'picked up', 'shipped', 'delivered', 'completed', 'fulfilled']);
const INVENTORY_DEDUCTION_LOCAL = new Set(['zrealizowane', 'wyslane', 'sent', 'completed']);
// „Spakowane” nadal rezerwuje towar: fizyczny stan jest zdejmowany dopiero po wysłaniu.
const CLOSED_LOCAL = new Set(['zrealizowane', 'zamkniete', 'wyslane', 'anulowane', 'sent', 'completed', 'cancelled']);

function officialStatus(order = {}) {
  const checkout = normalized(order.allegroStatus || order.status || order.checkoutForm?.status);
  const fulfillment = normalized(order.fulfillmentStatus || order.fulfilmentStatus || order.fulfillment?.status);
  if (checkout === 'cancelled' || checkout === 'canceled' || fulfillment === 'cancelled' || fulfillment === 'canceled') return 'cancelled';
  return fulfillment || checkout;
}

function active(order = {}) {
  if (order.deleted === true || order.cancelled === true || order.canceled === true) return false;
  if (order.agentHandled === true || order.localCompleted === true) return false;
  const official = officialStatus(order);
  if (CLOSED_OFFICIAL.has(official)) return false;
  return ![
    order.warehouseStage, order.agentStage, order.localStage, order.magazynStatus, order.localStatus,
  ].some((status) => CLOSED_LOCAL.has(normalized(status)));
}

function inventoryDeductionEligible(order = {}) {
  if (order.baselineArchivedAt || order.baselineArchived === true) return false;
  const official = officialStatus(order);
  if (['cancelled', 'canceled', 'returned'].includes(official)) return false;
  if (INVENTORY_DEDUCTION_OFFICIAL.has(official) || order.localCompleted === true) return true;
  return [order.warehouseStage, order.agentStage, order.localStage, order.magazynStatus, order.localStatus]
    .some((status) => INVENTORY_DEDUCTION_LOCAL.has(normalized(status)));
}

/** Oznacza tylko zaobserwowane przejście aktywne → wysłane; historia bez markera jest nietykalna. */
export function markAllegroInventoryTransition(next = {}, previous = {}, at = new Date()) {
  if (next.inventoryDeductionPending === true || next.inventoryMode === 'deducted_on_shipment') return next;
  if (next.baselineArchivedAt || !text(previous?.id || previous?.nr, 180)) return next;
  if (!inventoryDeductionEligible(previous) && inventoryDeductionEligible(next)) {
    const timestamp = at instanceof Date ? at.toISOString() : new Date(at).toISOString();
    return { ...next, inventoryDeductionPending: true, inventoryTransitionAt: timestamp };
  }
  return next;
}

export function markAllegroInventoryTransitions(nextOrders = [], previousOrders = [], { cutover = false, at = new Date() } = {}) {
  if (cutover) return array(nextOrders);
  const previous = previousOrders instanceof Map
    ? previousOrders
    : new Map(array(previousOrders).map((order) => [text(order?.id || order?.nr, 180), order]));
  return array(nextOrders).map((order) => markAllegroInventoryTransition(
    order,
    previous.get(text(order?.id || order?.nr, 180)) || {},
    at,
  ));
}

/** Rekord zamówień jest trwałym dowodem cutover, gdy osobny marker wymaga naprawy. */
export function resolveAllegroBaselineCutover(markerRecord = {}, ordersRecord = {}, at = new Date()) {
  const markerAt = text(markerRecord?.baseline_at, 80);
  const ordersAt = text(ordersRecord?.baseline_at, 80);
  const fallbackAt = at instanceof Date ? at.toISOString() : text(at, 80);
  return {
    baselineAt: markerAt || ordersAt || fallbackAt,
    baselineCreated: !markerAt && !ordersAt,
    baselineMarkerMissing: !markerAt,
  };
}

function mappingIndex(record = {}) {
  const source = record instanceof Map ? Object.fromEntries(record) : object(record.items || record);
  const map = new Map();
  for (const [offerId, raw] of Object.entries(source)) {
    const value = object(raw);
    const productId = text(value.productId ?? value.produktId ?? value.localProductId ?? value.id ?? raw, 160);
    const operator = normalized(value.operator);
    const legacyAdminVerified = /^(admin validated|admin force|admin safe batch|admin duplicate keep|auto order)/.test(operator);
    if (offerId) map.set(String(offerId), {
      productId,
      blocked: value.blocked === true || value.quarantined === true,
      verifiedForSupplier: value.verifiedForSupplier === true || value.supplierOrderEligible === true || legacyAdminVerified,
      confidence: Math.max(0, Math.min(100, Number(value.confidence) || 0)),
      productSnapshot: object(value.productSnapshot || value.product || value.produkt),
      productName: text(value.productName || value.offerName, 300),
      externalId: text(value.externalId || value.sku, 160),
      ean: text(value.ean || value.gtin || value.canonicalGtin, 80),
      producerCode: text(value.producerCode || value.manufacturerCode || value.kodProducenta, 160),
      supplier: text(value.supplier || value.dostawca || value.producent || value.manufacturer, 160),
    });
  }
  return map;
}

function catalogIdSet(products) {
  if (!Array.isArray(products)) return null;
  return new Set(products.map((product) => text(product?.id ?? product?.produktId ?? product?.productId, 160)).filter(Boolean));
}

function offerIndex(record = []) {
  const source = Array.isArray(record)
    ? record
    : Array.isArray(object(record).items)
      ? object(record).items
      : Object.values(object(record).items || object(record));
  return new Map(source.map((offer) => [text(offer?.id || offer?.offerId, 160), object(offer)]).filter(([id]) => id));
}

function supplierFromOffer(offer = {}, line = {}) {
  const haystack = normalized([
    offer.supplier, offer.dostawca, offer.producer, offer.producent, offer.manufacturer,
    offer.brand, offer.name, line.offerName, line.name, line.nazwa,
  ].filter(Boolean).join(' '));
  if (haystack.includes('alexander')) return 'Alexander';
  if (haystack.includes('multigra')) return 'Multigra';
  if (haystack.includes('godan') || haystack.includes('go dan')) return 'Godan';
  return '';
}

/**
 * Oferta Allegro jest samodzielnym źródłem zakupu, gdy kartoteka sklepu nie
 * istnieje. Nie tworzymy sztucznego mapowania do innego produktu: stabilnym ID
 * jest wtedy ID oferty, a producent i kody pochodzą wyłącznie z oferty.
 */
function virtualProductFromOffer(offer = {}, line = {}) {
  const offerId = text(line?.offerId ?? line?.offer?.id ?? offer?.id, 160);
  const supplier = supplierFromOffer(offer, line);
  const externalId = text(line?.externalId || offer?.externalId, 160);
  const ean = text(offer?.ean || offer?.gtin || line?.ean || line?.gtin, 80);
  const producerCode = text(offer?.manufacturerCode || offer?.producerCode || line?.manufacturerCode || line?.producerCode, 160);
  if (!offerId || !supplier || !(externalId || ean || producerCode)) return null;
  const productId = `allegro-offer:${offerId}`;
  const name = text(line?.offerName || line?.name || line?.nazwa || offer?.name || `Oferta Allegro ${offerId}`, 300);
  return {
    id: productId,
    productId,
    nazwa: name,
    name,
    externalId,
    sku: externalId,
    ean,
    gtin: ean,
    kodProducenta: producerCode,
    producent: supplier,
    marka: supplier,
    dostawca: supplier,
    zdjecie: text(offer?.mainImage || array(offer?.images)[0], 3000),
    allegroOfferId: offerId,
    allegroProductId: text(offer?.productId, 160),
    virtualFromAllegroOffer: true,
  };
}

function orderLines(order = {}) {
  const analyzed = array(order.agentAnalysis?.positions);
  const raw = array(order.lineItems || order.items || order.pozycjeDane || order.pozycje || order.products);
  if (!raw.length) return analyzed;
  if (!analyzed.length) return raw;
  const byOffer = new Map();
  for (const position of analyzed) {
    const offerId = text(position?.offerId ?? position?.offer?.id, 160);
    if (!byOffer.has(offerId)) byOffer.set(offerId, []);
    byOffer.get(offerId).push(position);
  }
  const merged = raw.map((line) => {
    const offerId = text(line?.offerId ?? line?.offer?.id, 160);
    const analyzedLine = byOffer.get(offerId)?.shift();
    if (!analyzedLine) return line;
    return {
      ...line,
      ...analyzedLine,
      offerId: analyzedLine.offerId || line.offerId,
      offerName: analyzedLine.offerName || analyzedLine.nazwa || line.offerName,
      quantity: analyzedLine.quantity ?? analyzedLine.ilosc ?? line.quantity ?? line.ilosc,
    };
  });
  for (const queue of byOffer.values()) merged.push(...queue);
  return merged;
}

function virtualProductSnapshot(mapping = {}, line = {}, productId = '') {
  const snapshot = { ...object(line.product || line.produkt), ...object(mapping.productSnapshot) };
  const ean = text(snapshot.ean || snapshot.gtin || mapping.ean || line.ean || line.gtin, 80);
  const name = text(snapshot.nazwa || snapshot.name || mapping.productName || line.nazwa || line.offerName || line.name || `Produkt ${productId}`, 300);
  return {
    ...snapshot,
    id: productId,
    productId,
    nazwa: name,
    name,
    externalId: text(snapshot.externalId || snapshot.sku || mapping.externalId || line.externalId || line.sku, 160),
    ean,
    gtin: ean,
    kodProducenta: text(snapshot.kodProducenta || snapshot.mpn || mapping.producerCode || line.manufacturerCode || line.producerCode, 160),
    producent: text(snapshot.producent || snapshot.manufacturer || snapshot.marka || snapshot.brand || mapping.supplier || line.supplier || line.producent, 160),
    dostawca: text(snapshot.dostawca || snapshot.supplier || mapping.supplier || line.supplier || line.dostawca, 160),
    sourceUrl: text(snapshot.sourceUrl || snapshot.producentUrl || line.sourceUrl, 3000),
    mappingSnapshot: true,
  };
}

function demandItems(order = {}, mappings = new Map(), knownProductIds = null, diagnostics = {}, { allowVirtualProducts = false, offers = new Map() } = {}) {
  const analyzed = array(order.agentAnalysis?.positions);
  const source = orderLines(order);
  const grouped = new Map();
  for (const line of source) {
    const amount = quantity(line?.ilosc ?? line?.quantity ?? line?.qty);
    if (amount <= 0) { bump(diagnostics, 'skippedInvalidQuantity'); continue; }
    bump(diagnostics, 'requiredLines');
    const offerId = text(line?.offerId ?? line?.offer?.id, 160);
    const mapping = offerId ? mappings.get(offerId) : null;
    const offerProduct = allowVirtualProducts ? virtualProductFromOffer(offers.get(offerId) || {}, line) : null;
    // Jawne odpięcie/kwarantanna ma pierwszeństwo przed starym wynikiem analizy.
    if (mapping && (mapping.blocked || !mapping.productId) && !offerProduct) { bump(diagnostics, 'skippedBlockedMapping'); bump(diagnostics, 'skippedUnresolvedLine'); continue; }
    if (normalized(line?.decision) === 'nierozpoznany' && !offerProduct) { bump(diagnostics, 'skippedUnresolvedLine'); continue; }
    const analyzedProductId = text(
      line?.localProductId || line?.mappedProductId || line?.storeProductId || line?.produktId
      || (analyzed.length ? line?.productId : ''),
      160,
    );
    const matchLabel = normalized(line?.match || line?.matchType || line?.matchReason);
    const confidence = Math.max(0, Math.min(100, Number(line?.confidence) || 0));
    const analysisVerified = line?.supplierMatchVerified === true
      || (analyzed.length && confidence >= 88 && !matchLabel.includes('mapowanie'));
    const mappingVerified = !!mapping?.verifiedForSupplier && !!mapping?.productId
      && (!analyzedProductId || mapping.productId === analyzedProductId);
    // Sam fakt zapisania mapowania oferty nie jest dowodem wystarczającym do
    // złożenia zamówienia u producenta. Plan zakupowy przyjmuje wyłącznie
    // wynik zweryfikowany EAN/SKU/kodem producenta lub jednoznaczną analizą.
    const productId = analysisVerified
      ? analyzedProductId
      : mappingVerified
        ? mapping.productId
        : offerProduct?.productId || '';
    if (!productId && (analyzedProductId || mapping?.productId)) {
      bump(diagnostics, 'skippedWeakMapping');
      bump(diagnostics, 'skippedUnresolvedLine');
      continue;
    }
    if (!productId) { bump(diagnostics, 'skippedUnresolvedLine'); continue; }
    const missingFromCatalog = !!knownProductIds && !knownProductIds.has(productId);
    if (missingFromCatalog && !allowVirtualProducts) { bump(diagnostics, 'skippedUnknownProduct'); bump(diagnostics, 'skippedUnresolvedLine'); continue; }
    if (missingFromCatalog && allowVirtualProducts && !(analysisVerified || mappingVerified || offerProduct)) { bump(diagnostics, 'skippedUnknownProduct'); bump(diagnostics, 'skippedUnresolvedLine'); continue; }
    bump(diagnostics, 'mappedLines');
    if (missingFromCatalog) bump(diagnostics, 'virtualProductLines');
    const virtualProduct = missingFromCatalog
      ? (offerProduct || virtualProductSnapshot(mapping || {}, line, productId))
      : null;
    const current = grouped.get(productId) || {
      id: productId,
      productId,
      produktId: productId,
      ilosc: 0,
      quantity: 0,
      nazwa: text(virtualProduct?.nazwa || line?.nazwa || line?.offerName || line?.name || `Produkt ${productId}`, 300),
      ...(virtualProduct ? { product: virtualProduct, virtualProduct: true } : {}),
    };
    current.ilosc += amount;
    current.quantity += amount;
    grouped.set(productId, current);
  }
  return [...grouped.values()];
}

/** Przekształca Allegro do tego samego kanonicznego wejścia popytu co sklep. */
export function allegroOrdersForSupplierDemand(allegroOrders = [], mappingsRecord = {}, shopOrders = [], catalogProducts, allegroOffers = []) {
  const mappings = mappingIndex(mappingsRecord);
  const offers = offerIndex(allegroOffers);
  const knownProductIds = catalogIdSet(catalogProducts);
  const shopIds = new Set(array(shopOrders).flatMap((order) => [order?.nr, order?.number, order?.id, order?.sourceOrderId]).map((value) => text(value, 180)).filter(Boolean));
  const orders = [], seen = new Set();
  const diagnostics = { scanned: 0, active: 0, converted: 0, skippedFinal: 0, skippedDuplicate: 0, skippedUnmapped: 0, skippedBlockedMapping: 0, skippedWeakMapping: 0, skippedUnknownProduct: 0, skippedUnresolvedLine: 0, skippedInvalidQuantity: 0, requiredLines: 0, mappedLines: 0, virtualProductLines: 0 };
  for (const order of array(allegroOrders)) {
    diagnostics.scanned += 1;
    const sourceId = text(order?.id || order?.nr || order?.orderId || order?.checkoutForm?.id, 180);
    if (!sourceId || seen.has(sourceId) || shopIds.has(sourceId) || shopIds.has(`Allegro ${sourceId}`)) { diagnostics.skippedDuplicate += 1; continue; }
    seen.add(sourceId);
    if (!active(order)) { diagnostics.skippedFinal += 1; continue; }
    diagnostics.active += 1;
    const items = demandItems(order, mappings, knownProductIds, diagnostics, { allowVirtualProducts: true, offers });
    if (!items.length) { diagnostics.skippedUnmapped += 1; continue; }
    orders.push({
      nr: `Allegro ${sourceId}`,
      source: 'allegro',
      sourceOrderId: sourceId,
      status: 'nowe',
      inventoryMode: 'reserved_until_shipment',
      pozycjeDane: items,
    });
    diagnostics.converted += 1;
  }
  return { orders, diagnostics };
}

/** Projekcja wysłanych zleceń do idempotentnego ruchu magazynowego. */
export function allegroOrdersForInventoryDeduction(allegroOrders = [], mappingsRecord = {}, catalogProducts) {
  const mappings = mappingIndex(mappingsRecord);
  const knownProductIds = catalogIdSet(catalogProducts);
  const diagnostics = { scanned: 0, eligible: 0, projected: 0, skippedNonShipment: 0, skippedUnmapped: 0, skippedBlockedMapping: 0, skippedWeakMapping: 0, skippedUnknownProduct: 0, skippedUnresolvedLine: 0, skippedInvalidQuantity: 0, requiredLines: 0, mappedLines: 0 };
  const orders = [];
  for (const order of array(allegroOrders)) {
    diagnostics.scanned += 1;
    if (!inventoryDeductionEligible(order)) { diagnostics.skippedNonShipment += 1; continue; }
    diagnostics.eligible += 1;
    const sourceId = text(order?.id || order?.nr || order?.orderId || order?.checkoutForm?.id, 180);
    const perOrder = { skippedBlockedMapping: 0, skippedWeakMapping: 0, skippedUnknownProduct: 0, skippedUnresolvedLine: 0, skippedInvalidQuantity: 0, requiredLines: 0, mappedLines: 0 };
    const items = demandItems(order, mappings, knownProductIds, perOrder);
    for (const [key, value] of Object.entries(perOrder)) bump(diagnostics, key, value);
    if (!sourceId || perOrder.requiredLines !== perOrder.mappedLines) { diagnostics.skippedUnmapped += 1; continue; }
    orders.push({
      nr: `Allegro ${sourceId}`,
      source: 'allegro',
      sourceOrderId: sourceId,
      status: 'wysłane',
      inventoryMode: 'reserved_until_shipment',
      pozycjeDane: items,
    });
    diagnostics.projected += 1;
  }
  return { orders, diagnostics };
}
