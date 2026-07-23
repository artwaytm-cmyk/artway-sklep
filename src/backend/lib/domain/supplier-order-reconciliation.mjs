import { DEFAULT_SUPPLIER, MAX_QUANTITY, EDITABLE_DRAFT_STATUSES, COMMITTED_DRAFT_STATUSES, CLOSED_ORDER_STATUSES, text, normalized, quantity, firstValue, array, object, clone, productIdOf, orderIdOf, orderStatusOf, isActiveOrder, inventoryModeOf, orderItemsOf, catalogArray, productMap, stockOf, warehouseMeta, sourceUrls, productCode, productEan, productName, movementIndex, movementBefore, draftStatus, supplierDraftIsCommitted, supplierOfDraft, draftItems, draftItemQuantity, draftItemReceived, manualExtraOf, contentView, sameContent, clearApproval, draftKey, newDraftId, newDraftNumber, statusAfterChange, summarizeDraft, makeLine, resolveProductSupplier, supplierDraftIsEditable } from './supplier-order-reconciliation-support.mjs';

/**
 * Czysto przelicza bieżące szkice zakupowe. Funkcja nie zapisuje danych i nie
 * wykonuje żadnej wysyłki zewnętrznej.
 */
export function reconcileSupplierOrderDrafts(input = {}) {
  const settings = object(input.settings);
  const orders = array(input.orders);
  const products = productMap(input);
  const suppliedDrafts = array(firstValue(input.supplierDrafts, input.drafts)).map(clone);
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  if (Number.isNaN(now.getTime())) throw new TypeError('Nieprawidłowa data przeliczenia szkiców producentów.');
  const movements = movementIndex(input);
  const diagnostics = { skippedInactiveOrders: 0, skippedItemsWithoutProductId: 0, legacyWithoutMovement: [], duplicateEditableDrafts: [], duplicateDraftIds: [] };
  // Ten sam identyfikator dokumentu oznacza tę samą rewizję biznesową. Starsze
  // wersje systemu mogły przy równoległym uzgodnieniu zapisać kilka fizycznych
  // kopii tego samego ID. Nie wolno ich sumować ani prezentować jako osobnych
  // zamówień. Zachowujemy pierwszą aktywną kopię (lista jest najnowsza najpierw),
  // a jeżeli dokument został już wysłany/zamknięty — chronimy stan nieedytowalny.
  const uniqueDrafts = new Map(), originalDrafts = [];
  const protectedStatus = (draft = {}) => !supplierDraftIsEditable(draft) && !['zastapione', 'superseded'].includes(draftStatus(draft));
  for (const draft of suppliedDrafts) {
    const id = text(draft?.id, 160);
    if (!id) { originalDrafts.push(draft); continue; }
    if (!uniqueDrafts.has(id)) {
      uniqueDrafts.set(id, originalDrafts.length);
      originalDrafts.push(draft);
      continue;
    }
    const index = uniqueDrafts.get(id), kept = originalDrafts[index];
    if (protectedStatus(draft) && !protectedStatus(kept)) originalDrafts[index] = draft;
    diagnostics.duplicateDraftIds.push({ draftId: id, keptStatus: text(originalDrafts[index]?.status, 100), removedStatus: text((originalDrafts[index] === draft ? kept : draft)?.status, 100) });
  }
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
    changed: diagnostics.duplicateDraftIds.length + created.length + updated.length + superseded.length > 0,
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

export { resolveProductSupplier, supplierDraftIsEditable } from './supplier-order-reconciliation-support.mjs';
