import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroOrdersForInventoryDeduction, allegroOrdersForSupplierDemand, markAllegroInventoryTransition, markAllegroInventoryTransitions, resolveAllegroBaselineCutover } from '../netlify/functions/lib/domain/allegro-supplier-demand.mjs';

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
