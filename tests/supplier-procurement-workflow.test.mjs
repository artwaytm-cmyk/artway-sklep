import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applySupplierProcurementToOrder,
  applySupplierProcurementWorkflow,
} from '../netlify/functions/lib/domain/supplier-procurement-workflow.mjs';

const order = (overrides = {}) => ({
  id: 'ALG-1', status: 'READY_FOR_PROCESSING', fulfillmentStatus: 'PROCESSING', warehouseStage: 'braki',
  agentAnalysis: {
    positions: [{ productId: 'P-1', shortage: 2, decision: 'zamow_u_producenta' }],
    nierozpoznane: 0, bezStanu: 0, bezLokalizacji: 0, braki: 2,
  },
  ...overrides,
});

const draft = (overrides = {}) => ({
  id: 'D-1', numer: 'AZ/2026/07/0001', status: 'wysłane do producenta', emailSentAt: '2026-07-15T10:00:00.000Z',
  pozycje: [{ produktId: 'P-1', ilosc: 2, przyjeto: 0, zamowienia: ['Allegro ALG-1'] }],
  ...overrides,
});

test('wysłany e-mail kończy zadanie zakupowe i przenosi zlecenie do oczekiwania na dostawę', () => {
  const result = applySupplierProcurementToOrder(order(), [draft()], { at: new Date('2026-07-15T10:05:00.000Z') });
  assert.equal(result.supplierProcurement.taskStatus, 'zrealizowane');
  assert.equal(result.supplierProcurement.status, 'oczekuje_na_dostawe');
  assert.equal(result.supplierProcurement.completedAt, '2026-07-15T10:00:00.000Z');
  assert.equal(result.warehouseStage, 'oczekuje_na_dostawe');
});

test('częściowe i pełne przyjęcie automatycznie przesuwają dalsze etapy', () => {
  const partial = applySupplierProcurementToOrder(order(), [draft({
    pozycje: [{ produktId: 'P-1', ilosc: 2, przyjeto: 1, zamowienia: ['Allegro ALG-1'] }],
  })]);
  assert.equal(partial.supplierProcurement.status, 'czesciowo_przyjete');
  assert.equal(partial.warehouseStage, 'oczekuje_na_dostawe');

  const complete = applySupplierProcurementToOrder(order(), [draft({
    pozycje: [{ produktId: 'P-1', ilosc: 2, przyjeto: 2, zamowienia: ['Allegro ALG-1'] }],
  })]);
  assert.equal(complete.supplierProcurement.status, 'dostawa_przyjeta');
  assert.equal(complete.warehouseStage, 'kompletacja');
});

test('powiązanie produktu bez dokładnej referencji zamówienia nie zmienia etapu', () => {
  const other = draft({ pozycje: [{ produktId: 'P-1', ilosc: 2, przyjeto: 2, zamowienia: ['Allegro ALG-2'] }] });
  const original = order();
  assert.equal(applySupplierProcurementToOrder(original, [other]), original);
});

test('nierozpoznana pozycja i ręcznie zamknięty etap nie są automatycznie nadpisywane', () => {
  const unresolved = applySupplierProcurementToOrder(order({ agentAnalysis: { positions: [], nierozpoznane: 1, bezStanu: 0, bezLokalizacji: 0, braki: 1 } }), [draft()]);
  assert.equal(unresolved.warehouseStage, 'do_sprawdzenia');
  const packed = applySupplierProcurementToOrder(order({ warehouseStage: 'spakowane' }), [draft()]);
  assert.equal(packed.warehouseStage, 'spakowane');
  const terminal = applySupplierProcurementToOrder(order({ fulfillmentStatus: 'SENT', warehouseStage: 'zamkniete' }), [draft()]);
  assert.equal(terminal.warehouseStage, 'zamkniete');
});

test('zbiorcza synchronizacja raportuje tylko realnie zmienione zlecenia', () => {
  const result = applySupplierProcurementWorkflow([order(), { id: 'ALG-2', warehouseStage: 'do_sprawdzenia' }], [draft()]);
  assert.equal(result.changed, 1);
  assert.equal(result.items[1].supplierProcurement, undefined);
});
