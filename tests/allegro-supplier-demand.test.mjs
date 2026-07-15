import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroOrdersForInventoryDeduction, allegroOrdersForSupplierDemand, markAllegroInventoryTransition, markAllegroInventoryTransitions, resolveAllegroBaselineCutover } from '../netlify/functions/lib/domain/allegro-supplier-demand.mjs';
import { reconcileSupplierOrderDrafts } from '../netlify/functions/lib/domain/supplier-order-reconciliation.mjs';

const catalog = [{ id: 'P-1' }, { id: 'P-2' }];

test('zweryfikowana analiza zamówienia ma pierwszeństwo przed słabym mapowaniem i agreguje pozycje', () => {
  const result = allegroOrdersForSupplierDemand([{
    id: 'ALG-1', status: 'READY_FOR_PROCESSING',
    agentAnalysis: { positions: [
      { offerId: 'O-1', productId: 'P-1', ilosc: 2, nazwa: 'Gra', match: 'EAN/GTIN', confidence: 99, supplierMatchVerified: true },
      { offerId: 'O-1', productId: 'P-1', ilosc: 1, nazwa: 'Gra', match: 'EAN/GTIN', confidence: 99, supplierMatchVerified: true },
    ] },
  }], { items: { 'O-1': { productId: 'P-1' } } }, [], catalog);

  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].nr, 'Allegro ALG-1');
  assert.equal(result.orders[0].pozycjeDane.length, 1);
  assert.equal(result.orders[0].pozycjeDane[0].productId, 'P-1');
  assert.equal(result.orders[0].pozycjeDane[0].ilosc, 3);
});

test('słabe mapowanie nie tworzy zamówienia producenta, a jawnie zweryfikowane może być fallbackiem', () => {
  const weak = allegroOrdersForSupplierDemand([{
    id: 'ALG-WEAK', status: 'READY_FOR_PROCESSING', lineItems: [{ offerId: 'O-2', quantity: 2 }],
  }], { items: { 'O-2': { productId: 'P-2' } } }, [], catalog);
  assert.equal(weak.orders.length, 0);
  assert.equal(weak.diagnostics.skippedWeakMapping, 1);

  const mapped = allegroOrdersForSupplierDemand([{
    id: 'ALG-MAP', status: 'READY_FOR_PROCESSING', lineItems: [{ offerId: 'O-2', quantity: 2 }],
  }], { items: { 'O-2': { productId: 'P-2', verifiedForSupplier: true } } }, [], catalog);
  assert.equal(mapped.orders[0].pozycjeDane[0].productId, 'P-2');

  const blocked = allegroOrdersForSupplierDemand([{
    id: 'ALG-BLOCKED', status: 'READY_FOR_PROCESSING',
    agentAnalysis: { positions: [{ offerId: 'O-1', productId: 'P-1', ilosc: 1 }] },
  }], { items: { 'O-1': { productId: '', blocked: true } } }, [], catalog);
  assert.equal(blocked.orders.length, 0);
  assert.equal(blocked.diagnostics.skippedBlockedMapping, 1);
  assert.equal(blocked.diagnostics.skippedUnmapped, 1);
});

test('nieistniejący produkt z przestarzałego mapowania nie tworzy osieroconego popytu', () => {
  const result = allegroOrdersForSupplierDemand([{
    id: 'ALG-STALE', status: 'READY_FOR_PROCESSING', lineItems: [{ offerId: 'O-X', quantity: 1 }],
  }], { items: { 'O-X': { productId: 'USUNIETY' } } }, [], catalog);
  assert.deepEqual(result.orders, []);
  assert.equal(result.diagnostics.skippedWeakMapping, 1);
});

test('zatwierdzone mapowanie zachowuje popyt także po zniknięciu produktu z aktywnego katalogu', () => {
  const mapping = {
    productId: 'ARCH-2678',
    verifiedForSupplier: true,
    confidence: 100,
    productSnapshot: {
      id: 'ARCH-2678',
      nazwa: 'Puzzle magnetyczne Farma',
      externalId: '2678',
      ean: '5906018026788',
      kodProducenta: '2678',
      producent: 'Alexander',
      dostawca: 'Alexander',
    },
  };
  const result = allegroOrdersForSupplierDemand([{
    id: 'ALG-VIRTUAL', status: 'READY_FOR_PROCESSING',
    lineItems: [{ offerId: 'O-VIRTUAL', offerName: 'Puzzle magnetyczne Farma', quantity: 2 }],
  }], { items: { 'O-VIRTUAL': mapping } }, [], catalog);

  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].pozycjeDane[0].productId, 'ARCH-2678');
  assert.equal(result.orders[0].pozycjeDane[0].ilosc, 2);
  assert.equal(result.orders[0].pozycjeDane[0].virtualProduct, true);
  assert.equal(result.orders[0].pozycjeDane[0].product.dostawca, 'Alexander');
  assert.equal(result.orders[0].pozycjeDane[0].product.kodProducenta, '2678');
  assert.equal(result.diagnostics.virtualProductLines, 1);
});

test('starsze ręczne mapowanie administratora jest migrowane bez ponownego klikania', () => {
  const result = allegroOrdersForSupplierDemand([{
    id: 'ALG-LEGACY-MANUAL', status: 'READY_FOR_PROCESSING',
    lineItems: [{ offerId: 'O-LEGACY', offerName: 'Starszy produkt', quantity: 1 }],
  }], { items: { 'O-LEGACY': {
    productId: 'ARCH-LEGACY', operator: 'admin-validated', productName: 'Starszy produkt', supplier: 'Multigra', externalId: 'M-10',
  } } }, [], catalog);

  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].pozycjeDane[0].productId, 'ARCH-LEGACY');
  assert.equal(result.orders[0].pozycjeDane[0].product.producent, 'Multigra');
  assert.equal(result.orders[0].pozycjeDane[0].product.externalId, 'M-10');
});

test('produkt wirtualny trafia do planu producenta, ale nie tworzy fikcyjnego ruchu magazynowego', () => {
  const mapping = { productId: 'ARCH-1', verifiedForSupplier: true, productSnapshot: { nazwa: 'Gra archiwalna', producent: 'Multigra' } };
  const sent = [{ id: 'ALG-SENT-VIRTUAL', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'SENT', lineItems: [{ offerId: 'O-VIRTUAL', quantity: 1 }] }];
  const result = allegroOrdersForInventoryDeduction(sent, { items: { 'O-VIRTUAL': mapping } }, catalog);
  assert.deepEqual(result.orders, []);
  assert.equal(result.diagnostics.skippedUnknownProduct, 1);
});

test('pełny przepływ tworzy szkic właściwego producenta z kodem biznesowym dla produktu spoza sklepu', () => {
  const projected = allegroOrdersForSupplierDemand([{
    id: 'ALG-END-TO-END', status: 'READY_FOR_PROCESSING',
    lineItems: [{ offerId: 'O-END-TO-END', offerName: 'Produkt spoza aktywnego katalogu', quantity: 3 }],
  }], { items: { 'O-END-TO-END': {
    productId: 'ARCH-ALEX-2678', verifiedForSupplier: true,
    productSnapshot: { nazwa: 'Produkt spoza aktywnego katalogu', externalId: '2678', ean: '5906018026788', producent: 'Alexander' },
  } } }, [], catalog);
  const plan = reconcileSupplierOrderDrafts({
    orders: projected.orders,
    products: catalog,
    settings: { artway_stany: {}, artway_magazyn_produkty: {} },
    supplierDrafts: [],
    now: new Date('2026-07-15T22:00:00.000Z'),
  });

  assert.equal(plan.activeDrafts.length, 1);
  assert.equal(plan.activeDrafts[0].supplier, 'Alexander');
  assert.deepEqual(plan.activeDrafts[0].pozycje.map((line) => ({ kod: line.kod, nazwa: line.nazwa, ilosc: line.ilosc })), [
    { kod: '2678', nazwa: 'Produkt spoza aktywnego katalogu', ilosc: 3 },
  ]);
});

test('statusy końcowe i stare flagi obsłużenia nie wracają do popytu', () => {
  const orders = [
    { id: 'SENT', status: 'SENT' },
    { id: 'CANCELLED', status: 'CANCELLED' },
    { id: 'LOCAL', status: 'READY_FOR_PROCESSING', warehouseStage: 'zrealizowane' },
    { id: 'HANDLED', status: 'READY_FOR_PROCESSING', agentHandled: true },
    { id: 'COMPLETED', status: 'READY_FOR_PROCESSING', localCompleted: true },
  ].map((order) => ({ ...order, agentAnalysis: { positions: [{ productId: 'P-1', ilosc: 1 }] } }));
  const result = allegroOrdersForSupplierDemand(orders, {}, [], catalog);
  assert.deepEqual(result.orders, []);
  assert.equal(result.diagnostics.skippedFinal, 5);
});

test('zamówienie już obecne w zbiorze sklepu nie jest liczone drugi raz', () => {
  const result = allegroOrdersForSupplierDemand([{
    id: 'ALG-DUP', status: 'READY_FOR_PROCESSING',
    agentAnalysis: { positions: [{ productId: 'P-1', ilosc: 1 }] },
  }], {}, [{ nr: 'Allegro ALG-DUP' }], catalog);
  assert.deepEqual(result.orders, []);
  assert.equal(result.diagnostics.skippedDuplicate, 1);
});

test('fulfillment SENT i PICKED_UP tworzy projekcję ruchu, CANCELLED nie zdejmuje stanu', () => {
  const line = { offerId: 'O-1', productId: 'P-1', ilosc: 1, nazwa: 'Gra', match: 'EAN/GTIN', confidence: 99, supplierMatchVerified: true };
  const result = allegroOrdersForInventoryDeduction([
    { id: 'ALG-SENT', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'SENT', agentAnalysis: { positions: [line] } },
    { id: 'ALG-PICKED', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'PICKED_UP', agentAnalysis: { positions: [line] } },
    { id: 'ALG-LOCAL', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'PROCESSING', warehouseStage: 'zrealizowane', agentAnalysis: { positions: [line] } },
    { id: 'ALG-CANCEL', status: 'CANCELLED', fulfillmentStatus: 'CANCELLED', agentAnalysis: { positions: [line] } },
  ], { items: { 'O-1': { productId: 'STALE' } } }, catalog);
  assert.deepEqual(result.orders.map((order) => order.nr), ['Allegro ALG-SENT', 'Allegro ALG-PICKED', 'Allegro ALG-LOCAL']);
  assert.ok(result.orders.every((order) => order.status === 'wysłane' && order.pozycjeDane[0].productId === 'P-1'));
  assert.equal(result.diagnostics.eligible, 3);
});

test('częściowo zmapowana wysyłka nie zdejmuje fragmentu stanu ani nie udaje sukcesu', () => {
  const result = allegroOrdersForInventoryDeduction([{
    id: 'ALG-PARTIAL', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'SENT',
    lineItems: [{ offerId: 'O-1', quantity: 1 }, { offerId: 'O-UNKNOWN', quantity: 2 }],
  }], { items: { 'O-1': { productId: 'P-1', verifiedForSupplier: true } } }, catalog);
  assert.deepEqual(result.orders, []);
  assert.equal(result.diagnostics.eligible, 1);
  assert.equal(result.diagnostics.requiredLines, 2);
  assert.equal(result.diagnostics.mappedLines, 1);
  assert.equal(result.diagnostics.skippedUnmapped, 1);
});

test('marker cutover powstaje tylko na kontrolowanym przejściu, nie na historycznym SENT', () => {
  const active = { id: 'ALG-T', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'PROCESSING' };
  const sent = { ...active, fulfillmentStatus: 'SENT' };
  const transitioned = markAllegroInventoryTransition(sent, active, new Date('2026-07-15T20:00:00.000Z'));
  assert.equal(transitioned.inventoryDeductionPending, true);
  assert.equal(transitioned.inventoryTransitionAt, '2026-07-15T20:00:00.000Z');
  assert.equal(markAllegroInventoryTransition(sent, {}).inventoryDeductionPending, undefined);
  assert.equal(markAllegroInventoryTransition({ ...sent, baselineArchivedAt: '2026-07-01T00:00:00.000Z' }, active).inventoryDeductionPending, undefined);
  const firstV2Sync = markAllegroInventoryTransitions([sent], [active], { cutover: true, at: new Date('2026-07-15T20:00:00.000Z') });
  assert.equal(firstV2Sync[0].inventoryDeductionPending, undefined, 'pierwszy baseline v2 nigdy nie oznacza historycznego przejścia do dedukcji');
});

test('awaria zapisu markera odzyskuje cutover z allegro_orders bez archiwizowania nowych zamówień', () => {
  const first = resolveAllegroBaselineCutover({}, {}, '2026-07-15T20:00:00.000Z');
  assert.deepEqual(first, {
    baselineAt: '2026-07-15T20:00:00.000Z', baselineCreated: true, baselineMarkerMissing: true,
  });

  // allegro_orders zapisano, ale osobny marker nie powstał.
  const retry = resolveAllegroBaselineCutover({}, { baseline_at: first.baselineAt }, '2026-07-15T20:15:00.000Z');
  assert.deepEqual(retry, {
    baselineAt: first.baselineAt, baselineCreated: false, baselineMarkerMissing: true,
  });
  assert.equal(retry.baselineCreated, false, 'nowe zamówienia między próbami nie mogą wejść do ponownego cutover');

  const repaired = resolveAllegroBaselineCutover({ baseline_at: retry.baselineAt }, { baseline_at: retry.baselineAt }, '2026-07-15T20:30:00.000Z');
  assert.deepEqual(repaired, {
    baselineAt: first.baselineAt, baselineCreated: false, baselineMarkerMissing: false,
  });
});
