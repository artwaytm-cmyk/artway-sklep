import assert from 'node:assert/strict';
import test from 'node:test';
import {
  vonHalskyOrdersForInventoryDeduction,
  vonHalskyOrdersForSupplierDemand,
} from '../src/backend/lib/domain/von-halsky-supplier-demand.mjs';
import { createVonHalskyWarehouseCoordinator } from '../src/backend/lib/domain/von-halsky-warehouse-coordinator.mjs';

const products = [
  { id: '106', nazwa: 'Ale Pary', ean: '5906018023510', sku: '2351', producent: 'Alexander' },
  { id: '1000462', nazwa: 'Puzzle dla Maluszków', ean: '5906018005400', externalId: '0540', producent: 'Alexander' },
];

function order(overrides = {}) {
  return {
    id: 'C09Q3VF',
    status: 'ACCEPTED',
    orderLines: [
      { quantity: 2, offer: { externalId: '2351', product: { productId: '106', ean: '5906018023510', sku: '2351', name: 'Ale Pary' } } },
      { quantity: 1, offer: { externalId: '0540', product: { ean: '5906018005400', sku: '0540', name: 'Puzzle dla Maluszków' } } },
    ],
    ...overrides,
  };
}

test('aktywne Von Halsky zasila wspólny Plan centralnymi ID i nie dubluje ilości', () => {
  const result = vonHalskyOrdersForSupplierDemand([order()], products);
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].nr, 'Von Halsky C09Q3VF');
  assert.equal(result.orders[0].inventoryMode, 'reserved_until_shipment');
  assert.deepEqual(result.orders[0].pozycjeDane.map((line) => [line.id, line.ilosc]), [['106', 2], ['1000462', 1]]);
  assert.equal(result.diagnostics.matchedLines, 2);
  assert.equal(result.diagnostics.unmatchedLines, 0);
});

test('nadana przesyłka przechodzi do idempotentnego rozchodu, a znika z aktywnej rezerwacji', () => {
  const shipped = order({ _artwayShipment: { inpostId: 'SHIPX-1', trackingNumber: 'TRACK-1', status: 'confirmed' } });
  const demand = vonHalskyOrdersForSupplierDemand([shipped], products);
  const inventory = vonHalskyOrdersForInventoryDeduction([shipped], products);
  assert.deepEqual(demand.orders, []);
  assert.equal(inventory.orders.length, 1);
  assert.equal(inventory.orders[0].status, 'wysłane');
  assert.equal(inventory.orders[0].nr, 'Von Halsky C09Q3VF');
});

test('częściowo nierozpoznane zamówienie nie tworzy nieodwracalnego częściowego ruchu', () => {
  const shipped = order({
    _artwayShipment: { inpostId: 'SHIPX-1', trackingNumber: 'TRACK-1', status: 'confirmed' },
    orderLines: [...order().orderLines, { quantity: 1, offer: { externalId: 'BRAK', product: { ean: '5900000000000', sku: 'BRAK', name: 'Nieznany produkt' } } }],
  });
  const inventory = vonHalskyOrdersForInventoryDeduction([shipped], products);
  assert.deepEqual(inventory.orders, []);
  assert.equal(inventory.diagnostics.skippedPartialInventoryOrders, 1);
  assert.equal(inventory.diagnostics.unmatchedLines, 1);
});

test('zakończone zamówienie z potwierdzonym trackingiem nadal domyka rozchód', () => {
  const completed = order({ status: 'COMPLETED', delivery: { parcels: [{ trackingNumber: 'TRACK-1' }] } });
  const inventory = vonHalskyOrdersForInventoryDeduction([completed], products);
  assert.equal(inventory.orders.length, 1);
  assert.equal(inventory.orders[0].nr, 'Von Halsky C09Q3VF');
});

test('koordynator zwraca karcie zamówienia konkretny dokument producenta', async () => {
  let finalized = 0, reconciled = 0;
  const document = {
    id: 'SPD-1', numer: 'AZ/2026/08/0001', status: 'szkic', supplier: 'Alexander',
    pozycje: [{ produktId: '106', zamowienia: ['Von Halsky C09Q3VF'], orderAllocations: { 'Von Halsky C09Q3VF': 2 } }],
  };
  const coordinator = createVonHalskyWarehouseCoordinator({
    readSettings: async () => ({ data: { artway_produkty_dodane: products, artway_agent_ai_zlecenia: [document] } }),
    catalogProducts: (settings) => settings.artway_produkty_dodane,
    reconciliation: () => ({
      finalizeInventoryForOrder: async () => { finalized += 1; return { ok: true, changed: true }; },
      reconcileDraftsSafely: async () => { reconciled += 1; return { ok: true, changed: false }; },
    }),
  });
  const result = await coordinator.coordinate([order({ _artwayShipment: { inpostId: 'SHIPX-1', trackingNumber: 'TRACK-1', status: 'confirmed' } })]);
  assert.equal(finalized, 1);
  assert.equal(reconciled, 1);
  assert.deepEqual(result.supplierDocuments, [{
    id: 'SPD-1', number: 'AZ/2026/08/0001', status: 'szkic', supplier: 'Alexander',
    productIds: ['106'], orderReferences: ['Von Halsky C09Q3VF'],
  }]);
});

test('odczyt koordynatora dla karty zamówienia nie zdejmuje stanu i nie przelicza Planu', async () => {
  let finalized = 0, reconciled = 0;
  const coordinator = createVonHalskyWarehouseCoordinator({
    readSettings: async () => ({ data: { artway_agent_ai_zlecenia: [{
      id: 'SPD-READ', numer: 'AZ/READ', status: 'szkic', supplier: 'Alexander',
      pozycje: [{ produktId: '106', zamowienia: ['Von Halsky C09Q3VF'] }],
    }] } }),
    reconciliation: () => ({
      finalizeInventoryForOrder: async () => { finalized += 1; },
      reconcileDraftsSafely: async () => { reconciled += 1; },
    }),
  });
  const result = await coordinator.inspect([order()]);
  assert.equal(result.readOnly, true);
  assert.equal(result.plan.changed, false);
  assert.equal(result.supplierDocuments[0].number, 'AZ/READ');
  assert.equal(finalized, 0);
  assert.equal(reconciled, 0);
});
