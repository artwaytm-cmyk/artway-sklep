import { reconcileSupplierOrderDrafts } from './domain/supplier-order-reconciliation.mjs';

const DEFAULT_ORDER_LIMIT = 20_000;
const DEFAULT_SETTINGS_LIMIT = 4 * 1024 * 1024;
const DEFAULT_ATTEMPTS = 4;
const SHIPPED_STATUSES = new Set([
  'wyslane', 'wysłane', 'nadane', 'dostarczone', 'zakonczone', 'zakończone', 'zrealizowane',
  'sent', 'shipped', 'delivered', 'completed', 'fulfilled',
]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value = '', limit = 180) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
}

function orderNumber(order = {}) {
  return text(order.nr || order.number || order.orderNumber || order.orderId || order.id);
}

function normalized(value = '') {
  return text(value, 160).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shipmentFinal(order = {}) {
  return SHIPPED_STATUSES.has(normalized(order.status || order.fulfillmentStatus || order.orderStatus));
}

function quantity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function orderItems(order = {}) {
  const grouped = new Map();
  const items = order.pozycjeDane || order.items || order.lineItems || order.produkty || [];
  for (const item of array(items)) {
    const id = text(item?.id ?? item?.productId ?? item?.produktId ?? item?.product?.id, 160);
    const amount = quantity(item?.ilosc ?? item?.quantity ?? item?.qty ?? 1);
    if (!id || amount <= 0) continue;
    const current = grouped.get(id) || { id, amount: 0, item };
    current.amount += amount;
    grouped.set(id, current);
  }
  return [...grouped.values()];
}

function movementOrderNumber(movement = {}) {
  const requestId = text(movement.sourceRequestId, 260);
  if (requestId.startsWith('order-stock:')) return text(requestId.slice('order-stock:'.length));
  return text(movement.orderId || movement.orderNumber || movement.nrZamowienia || movement.dokument);
}

/**
 * Stare zamówienia zdejmowały stan już podczas checkoutu. Rozpoznajemy je
 * wyłącznie po zapisanym ruchu order-stock:<nr>, bez zgadywania po dacie.
 */
export function normalizeOrderInventoryModes(orders = [], settings = {}) {
  const legacyNumbers = new Set(
    array(object(settings).artway_ruchy_magazynowe)
      .map(movementOrderNumber)
      .filter(Boolean),
  );
  return array(orders).map((order) => {
    if (!order || typeof order !== 'object') return order;
    const explicit = text(order.inventoryMode || order.inventory_mode || order.stockMode, 80);
    if (explicit) return order;
    return {
      ...order,
      inventoryMode: legacyNumbers.has(orderNumber(order))
        ? 'deducted_on_create'
        : 'reserved_until_shipment',
    };
  });
}

function conflictError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.status = 409;
  return error;
}

/**
 * Łączy atomowy zapis zamówienia z bezpiecznym, idempotentnym przeliczeniem
 * szkiców producentów. Moduł nie wysyła e-maili ani wiadomości zewnętrznych.
 */
export function createStoreOrderSupplierReconciliation({
  readVersioned,
  writeIfVersion,
  mergeImportedSettings = async (data) => data,
  catalogProducts = () => [],
  reconcile = reconcileSupplierOrderDrafts,
  now = () => new Date(),
  maxAttempts = DEFAULT_ATTEMPTS,
  orderLimit = DEFAULT_ORDER_LIMIT,
  settingsLimit = DEFAULT_SETTINGS_LIMIT,
} = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') {
    throw new TypeError('Przepływ zamówienia wymaga wersjonowanego repozytorium.');
  }

  async function saveOrder({ order, deletedOrderNumbers = [] } = {}) {
    const nr = orderNumber(order);
    if (!nr) throw new TypeError('Zamówienie nie ma numeru.');
    const deleted = deletedOrderNumbers instanceof Set
      ? deletedOrderNumbers
      : new Set(array(deletedOrderNumbers).map((value) => text(value)).filter(Boolean));
    if (deleted.has(nr)) return { stored: false, deleted: true, duplicate: false, number: nr };

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const version = await readVersioned('orders', { items: [], updated_at: null });
      const current = object(version.value);
      const items = array(current.items).filter((item) => !deleted.has(orderNumber(item)));
      if (items.some((item) => orderNumber(item) === nr)) {
        return { stored: false, deleted: false, duplicate: true, number: nr, attempts: attempt };
      }
      items.unshift(order);
      if (items.length > orderLimit) items.length = orderLimit;
      const updatedAt = now().toISOString();
      const write = await writeIfVersion('orders', { ...current, items, updated_at: updatedAt }, version);
      if (write?.modified) {
        return { stored: true, deleted: false, duplicate: false, number: nr, attempts: attempt, updatedAt };
      }
    }
    throw conflictError('Zamówienia zmieniły się podczas zapisu. Spróbuj ponownie.', 'orders_write_conflict');
  }

  async function reconcileDrafts() {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const [ordersVersion, settingsVersion] = await Promise.all([
        readVersioned('orders', { items: [], updated_at: null }),
        readVersioned('settings', { data: {}, rev: 0, updated_at: null }),
      ]);
      const settingsRecord = object(settingsVersion.value);
      const settings = object(settingsRecord.data);
      const mergedSettings = object(await mergeImportedSettings(settings));
      const orders = normalizeOrderInventoryModes(array(object(ordersVersion.value).items), settings);
      const result = reconcile({
        orders,
        settings,
        products: array(catalogProducts(mergedSettings)),
        supplierDrafts: array(settings.artway_agent_ai_zlecenia),
        now: now(),
      });
      if (!result.changed) {
        return {
          ok: true,
          changed: false,
          attempts: attempt,
          created: result.created,
          updated: result.updated,
          shortages: result.shortages,
          diagnostics: result.diagnostics,
        };
      }
      const data = { ...settings, artway_agent_ai_zlecenia: result.drafts };
      if (JSON.stringify(data).length > settingsLimit) {
        const error = new Error('Szkice producentów przekraczają limit ustawień sklepu.');
        error.code = 'settings_too_large';
        error.status = 413;
        throw error;
      }
      const updatedAt = now().toISOString();
      const next = {
        ...settingsRecord,
        data,
        rev: Math.max(0, Number(settingsRecord.rev) || 0) + 1,
        updated_at: updatedAt,
      };
      const write = await writeIfVersion('settings', next, settingsVersion);
      if (write?.modified) {
        return {
          ok: true,
          changed: true,
          attempts: attempt,
          rev: next.rev,
          updatedAt,
          created: result.created,
          updated: result.updated,
          shortages: result.shortages,
          diagnostics: result.diagnostics,
        };
      }
    }
    throw conflictError('Ustawienia zmieniły się podczas przeliczania szkiców producentów.', 'supplier_drafts_write_conflict');
  }

  async function reconcileDraftsSafely({ summary = false } = {}) {
    try {
      const result = await reconcileDrafts();
      if (!summary) return result;
      return {
        ok: true,
        changed: result.changed,
        created: array(result.created).length,
        updated: array(result.updated).length,
        shortages: array(result.shortages).length,
      };
    } catch (error) {
      return {
        ok: false,
        changed: false,
        pendingRetry: true,
        code: text(error?.code || 'supplier_drafts_pending', 80),
        error: text(error?.message || 'Nie udało się przeliczyć szkiców producentów.', 300),
      };
    }
  }

  /** Odejmuje fizyczny stan dopiero po wysłaniu; ruch zapewnia idempotencję. */
  async function deductInventoryOnShipment(order = {}) {
    const nr = orderNumber(order);
    if (!nr || !shipmentFinal(order)) return { ok: true, eligible: false, changed: false };
    const explicitMode = text(order.inventoryMode || order.inventory_mode || order.stockMode, 80);
    if (explicitMode === 'deducted_on_shipment' || explicitMode === 'deducted_on_create') {
      return { ok: true, eligible: true, changed: false, inventoryMode: explicitMode };
    }
    const items = orderItems(order);
    if (!items.length) return { ok: true, eligible: true, changed: false, inventoryMode: 'deducted_on_shipment' };
    const requestId = `order-stock:${nr}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
      const record = object(version.value);
      const data = object(record.data);
      const oldMovements = array(data.artway_ruchy_magazynowe);
      if (oldMovements.some((movement) => text(movement?.sourceRequestId, 260) === requestId)) {
        return {
          ok: true,
          eligible: true,
          changed: false,
          alreadyDeducted: true,
          inventoryMode: explicitMode === 'reserved_until_shipment' ? 'deducted_on_shipment' : 'deducted_on_create',
        };
      }
      const stock = { ...object(data.artway_stany) };
      const timestamp = now();
      const iso = timestamp.toISOString();
      const movements = [];
      for (const [movementIndex, entry] of items.entries()) {
        const before = quantity(stock[entry.id]);
        const after = Math.max(0, before - entry.amount);
        stock[entry.id] = after;
        movements.push({
          id: `MAG-${timestamp.getTime().toString(36)}-${movementIndex}-${entry.id.slice(-10)}`,
          data: iso,
          dataTxt: timestamp.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }),
          produktId: entry.id,
          produktNazwa: text(entry.item?.nazwa || entry.item?.name || entry.item?.produkt || entry.id, 200),
          sku: text(entry.item?.sku || '', 80),
          typ: 'sprzedaż',
          ilosc: -entry.amount,
          stanPrzed: before,
          stanPo: after,
          dokument: nr,
          powod: 'Wysłanie zamówienia klienta',
          operator: 'system',
          sourceRequestId: requestId,
        });
      }
      const nextData = {
        ...data,
        artway_stany: stock,
        artway_ruchy_magazynowe: [...movements, ...oldMovements].slice(0, 3000),
      };
      if (JSON.stringify(nextData).length > settingsLimit) {
        const error = new Error('Ruch magazynowy przekracza limit ustawień sklepu.');
        error.code = 'settings_too_large';
        error.status = 413;
        throw error;
      }
      const next = {
        ...record,
        data: nextData,
        rev: Math.max(0, Number(record.rev) || 0) + 1,
        updated_at: iso,
      };
      const write = await writeIfVersion('settings', next, version);
      if (write?.modified) {
        return { ok: true, eligible: true, changed: true, inventoryMode: 'deducted_on_shipment', attempts: attempt, movements };
      }
    }
    throw conflictError('Ustawienia zmieniły się podczas zdejmowania stanu magazynowego.', 'inventory_deduction_conflict');
  }

  async function markOrderInventoryMode({ number, inventoryMode, deductedAt } = {}) {
    const nr = text(number);
    if (!nr || !inventoryMode) return { modified: false };
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const version = await readVersioned('orders', { items: [], updated_at: null });
      const record = object(version.value);
      const items = array(record.items);
      const index = items.findIndex((item) => orderNumber(item) === nr);
      if (index < 0) return { modified: false, missing: true };
      if (items[index]?.inventoryMode === inventoryMode) return { modified: false, unchanged: true };
      const nextItems = items.slice();
      nextItems[index] = {
        ...items[index],
        inventoryMode,
        ...(inventoryMode === 'deducted_on_shipment' ? { inventoryDeductedAt: deductedAt || now().toISOString() } : {}),
      };
      const updatedAt = now().toISOString();
      const write = await writeIfVersion('orders', { ...record, items: nextItems, updated_at: updatedAt }, version);
      if (write?.modified) return { modified: true, attempts: attempt, updatedAt };
    }
    throw conflictError('Zamówienie zmieniło się podczas zapisu trybu magazynowego.', 'orders_write_conflict');
  }

  async function finalizeInventoryForOrder(order = {}) {
    try {
      const result = await deductInventoryOnShipment(order);
      if (result.inventoryMode && order.inventoryMode !== result.inventoryMode) {
        await markOrderInventoryMode({ number: orderNumber(order), inventoryMode: result.inventoryMode });
      }
      return result;
    } catch (error) {
      return {
        ok: false,
        changed: false,
        pendingRetry: true,
        code: text(error?.code || 'inventory_deduction_pending', 80),
        error: text(error?.message || 'Nie udało się zapisać ruchu magazynowego.', 300),
      };
    }
  }

  return Object.freeze({
    saveOrder,
    reconcileDrafts,
    reconcileDraftsSafely,
    deductInventoryOnShipment,
    markOrderInventoryMode,
    finalizeInventoryForOrder,
  });
}
