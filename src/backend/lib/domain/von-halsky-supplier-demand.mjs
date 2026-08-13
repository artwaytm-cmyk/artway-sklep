import { canonicalGtin } from './product-identifiers.mjs';
import { vonHalskyOrderShippingStage } from './von-halsky-order-shipment.mjs';

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value = '', limit = 300) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
}

function key(value = '') {
  return text(value, 300).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function nameKey(value = '') {
  return text(value, 500).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function quantity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function productId(product = {}) {
  return text(product.id ?? product.productId ?? product.produktId, 160);
}

function productGtins(product = {}) {
  return [...new Set([
    product.gtin, product.ean, product.GTIN, product.EAN,
    ...array(product.gtins), ...array(product.canonicalGtins),
  ].map(canonicalGtin).filter(Boolean))];
}

function productCodes(product = {}) {
  return [...new Set([
    product.sku, product.externalId, product.external_id, product.kodProducenta,
    product.producerCode, product.manufacturerCode, product.mpn,
  ].map(key).filter(Boolean))];
}

function lineSource(line = {}) {
  const offer = object(line.offer);
  const product = object(offer.product || line.product);
  return {
    raw: line,
    productId: text(product.productId || product.id || line.productId || line.produktId, 160),
    gtin: canonicalGtin(product.ean || product.gtin || line.ean || line.gtin || ''),
    code: key(product.sku || offer.externalId || line.sku || line.externalId || line.manufacturerCode || ''),
    ean: text(product.ean || product.gtin || line.ean || line.gtin, 80),
    sku: text(product.sku || offer.externalId || line.sku || line.externalId, 160),
    name: text(product.name || line.name || line.nazwa || 'Produkt Von Halsky', 300),
    quantity: Math.max(1, quantity(line.quantity ?? line.ilosc ?? line.qty ?? 1)),
  };
}

function uniqueIndex(products = [], valuesOf = () => []) {
  const grouped = new Map();
  for (const product of products) {
    for (const value of valuesOf(product)) {
      if (!value) continue;
      if (!grouped.has(value)) grouped.set(value, []);
      grouped.get(value).push(product);
    }
  }
  return grouped;
}

function uniqueMatch(index, value) {
  const matches = value ? index.get(value) || [] : [];
  return matches.length === 1 ? { product: matches[0], ambiguous: false } : { product: null, ambiguous: matches.length > 1 };
}

function catalogMatcher(products = []) {
  const catalog = array(products).filter((product) => productId(product));
  const byId = uniqueIndex(catalog, (product) => [productId(product)]);
  const byGtin = uniqueIndex(catalog, productGtins);
  const byCode = uniqueIndex(catalog, productCodes);
  const byName = uniqueIndex(catalog, (product) => [nameKey(product.nazwa || product.name)].filter(Boolean));
  return (line = {}) => {
    const source = lineSource(line);
    for (const [kind, index, value] of [
      ['central-id', byId, source.productId],
      ['gtin', byGtin, source.gtin],
      ['sku', byCode, source.code],
      ['exact-name', byName, nameKey(source.name)],
    ]) {
      const match = uniqueMatch(index, value);
      if (match.product) return { ...source, product: match.product, match: kind, ambiguous: false };
      if (match.ambiguous) return { ...source, product: null, match: kind, ambiguous: true };
    }
    return { ...source, product: null, match: '', ambiguous: false };
  };
}

function projectedItems(order = {}, matcher) {
  const rows = array(order.orderLines || order.lineItems || order.items).map(matcher);
  const grouped = new Map();
  for (const row of rows.filter((entry) => entry.product)) {
    const id = productId(row.product);
    const current = grouped.get(id) || { id, ilosc: 0, product: row.product, source: row };
    current.ilosc += row.quantity;
    grouped.set(id, current);
  }
  return {
    rows,
    items: [...grouped.values()].map(({ id, ilosc, product, source }) => ({
      id,
      productId: id,
      produktId: id,
      ilosc,
      quantity: ilosc,
      nazwa: text(product.nazwa || product.name || source.name, 300),
      name: text(product.nazwa || product.name || source.name, 300),
      ean: text(product.ean || product.gtin || source.ean, 80),
      sku: text(product.sku || product.externalId || source.sku, 160),
      product,
    })),
  };
}

function diagnostics() {
  return { orders: 0, activeOrders: 0, inventoryOrders: 0, lines: 0, matchedLines: 0, unmatchedLines: 0, ambiguousLines: 0, skippedPartialInventoryOrders: 0 };
}

function bumpRows(target, rows = []) {
  target.lines += rows.length;
  target.matchedLines += rows.filter((row) => row.product).length;
  target.unmatchedLines += rows.filter((row) => !row.product && !row.ambiguous).length;
  target.ambiguousLines += rows.filter((row) => row.ambiguous).length;
}

/**
 * Przekłada zamówienia Von Halsky na wspólny kontrakt Planu producentów.
 * Nie zgaduje niejednoznacznych kartotek i nigdy nie tworzy duplikatu produktu.
 */
export function vonHalskyOrdersForSupplierDemand(orders = [], products = []) {
  const match = catalogMatcher(products);
  const output = [];
  const report = diagnostics();
  for (const order of array(orders)) {
    const id = text(order?.id || order?.orderId, 180);
    if (!id) continue;
    report.orders += 1;
    const stage = vonHalskyOrderShippingStage(order);
    if (!['decision', 'awaiting_shipment', 'unknown'].includes(stage.key)) continue;
    const projection = projectedItems(order, match);
    bumpRows(report, projection.rows);
    if (!projection.items.length) continue;
    report.activeOrders += 1;
    output.push({
      nr: `Von Halsky ${id}`,
      id: `von-halsky:${id}`,
      channel: 'von-halsky',
      externalOrderId: id,
      status: 'nowe',
      inventoryMode: 'reserved_until_shipment',
      pozycjeDane: projection.items,
    });
  }
  return { orders: output, diagnostics: report };
}

/**
 * Do rozchodu przekazujemy wyłącznie w pełni rozpoznane zamówienie. Częściowy
 * ruch utworzyłby marker idempotencji i uniemożliwił późniejsze bezpieczne
 * odjęcie brakującej pozycji po poprawieniu mapowania.
 */
export function vonHalskyOrdersForInventoryDeduction(orders = [], products = []) {
  const match = catalogMatcher(products);
  const output = [];
  const report = diagnostics();
  for (const order of array(orders)) {
    const id = text(order?.id || order?.orderId, 180);
    if (!id) continue;
    report.orders += 1;
    const stage = vonHalskyOrderShippingStage(order);
    const completedAfterShipment = text(order?.status, 80).toUpperCase() === 'COMPLETED'
      && Boolean(stage.trackingNumber || order?._artwayShipment?.inpostId || array(order?.delivery?.parcels).length);
    if (!['shipped', 'in_transit', 'delivered'].includes(stage.key) && !completedAfterShipment) continue;
    const projection = projectedItems(order, match);
    bumpRows(report, projection.rows);
    if (!projection.rows.length || projection.rows.some((row) => !row.product)) {
      report.skippedPartialInventoryOrders += 1;
      continue;
    }
    report.inventoryOrders += 1;
    output.push({
      nr: `Von Halsky ${id}`,
      id: `von-halsky:${id}`,
      channel: 'von-halsky',
      externalOrderId: id,
      status: 'wysłane',
      inventoryMode: 'reserved_until_shipment',
      pozycjeDane: projection.items,
    });
  }
  return { orders: output, diagnostics: report };
}
