import { vonHalskyOrdersForInventoryDeduction } from './von-halsky-supplier-demand.mjs';

const array = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const fallbackText = (value, max = 180) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);

export function createVonHalskyWarehouseCoordinator({
  readSettings,
  mergeSettings = async (settings) => settings,
  catalogProducts = () => [],
  reconciliation,
  text = fallbackText,
} = {}) {
  if (typeof readSettings !== 'function' || typeof reconciliation !== 'function') {
    throw new TypeError('Koordynacja Von Halsky wymaga ustawień i wspólnego przepływu magazynowego.');
  }

  const supplierDocumentsFor = (selectedOrders = [], settings = {}) => {
    const orderReferences = new Set(selectedOrders
      .map((order) => `Von Halsky ${text(order?.id || order?.orderId, 180)}`)
      .filter((value) => value !== 'Von Halsky '));
    const supplierDocuments = [];
    for (const document of array(settings?.artway_agent_ai_zlecenia)) {
      const productIds = [];
      const references = new Set();
      for (const line of array(document?.pozycje)) {
        const lineReferences = new Set([
          ...array(line?.zamowienia),
          ...Object.keys(object(line?.orderAllocations)),
        ].map((value) => String(value || '').trim()).filter(Boolean));
        if (![...lineReferences].some((reference) => orderReferences.has(reference))) continue;
        const id = text(line?.produktId || line?.productId || line?.id, 160);
        if (id) productIds.push(id);
        for (const reference of lineReferences) if (orderReferences.has(reference)) references.add(reference);
      }
      if (!productIds.length) continue;
      supplierDocuments.push({
        id: text(document.id, 180),
        number: text(document.numer || document.number || document.id, 180),
        status: text(document.status || 'szkic', 100),
        supplier: text(document.supplier || document.dostawca || 'Dostawca nieprzypisany', 160),
        productIds: [...new Set(productIds)],
        orderReferences: [...references],
      });
    }
    return supplierDocuments;
  };

  return Object.freeze({
    /** Czysty odczyt do karty zamówienia. Nie zdejmuje stanu i nie zmienia Planu. */
    async inspect(orders = []) {
      const selectedOrders = array(orders);
      const currentSettings = await readSettings();
      return {
        ok: true,
        readOnly: true,
        inventory: [],
        plan: { ok: true, changed: false, readOnly: true },
        supplierDocuments: supplierDocumentsFor(selectedOrders, currentSettings?.data),
        diagnostics: { inspectedOrders: selectedOrders.length },
      };
    },
    async coordinate(orders = []) {
      const selectedOrders = array(orders);
      const settingsRecord = await readSettings();
      const settings = object(settingsRecord?.data);
      const mergedSettings = await mergeSettings(settings);
      const products = array(catalogProducts(mergedSettings));
      const projection = vonHalskyOrdersForInventoryDeduction(selectedOrders, products);
      const workflow = reconciliation();
      const inventory = [];
      for (const order of projection.orders) {
        inventory.push({ number: order.nr, ...(await workflow.finalizeInventoryForOrder(order)) });
      }
      const plan = await workflow.reconcileDraftsSafely();
      const currentSettings = await readSettings();
      return {
        ok: inventory.every((entry) => entry.ok !== false) && plan.ok !== false,
        inventory,
        plan,
        supplierDocuments: supplierDocumentsFor(selectedOrders, currentSettings?.data),
        diagnostics: projection.diagnostics,
      };
    },
  });
}
