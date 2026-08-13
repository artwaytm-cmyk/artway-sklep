import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyWarehousePosition,
  resolveWarehouseInventory,
  summarizeWarehousePositions,
  warehouseAnalysisNeedsInvestigation,
} from '../src/backend/lib/domain/order-warehouse-readiness.mjs';
import { supplierOrderHasActiveContent } from '../src/backend/lib/domain/agent-operational-center.mjs';

test('analiza zamówień rozpoznaje wyłącznie aktywne pozycje szkicu producenta', () => {
  assert.equal(supplierOrderHasActiveContent({ status: 'szkic', pozycje: [{ ilosc: 1 }] }), true);
  assert.equal(supplierOrderHasActiveContent({ status: 'zrealizowane', pozycje: [{ ilosc: 1 }] }), false);
  assert.equal(supplierOrderHasActiveContent({ status: 'szkic', pozycje: [{ ilosc: 0 }] }), false);
});

test('zamówienie korzysta z aktualnego stanu i lokalizacji kanonicznej kartoteki', () => {
  const inventory = resolveWarehouseInventory({
    id: '1000366',
    stan: 2,
    _catalog: { inventory: { stock: 2, lokalizacja: 'PAK-RA-P02' } },
  }, {
    legacyStockKnown: true,
    legacyStock: 0,
    legacyMeta: { lokalizacja: '' },
  });
  assert.deepEqual(inventory, {
    stockKnown: true,
    stock: 2,
    location: 'PAK-RA-P02',
    supplier: '',
    source: 'central_product_catalog',
  });
});

test('towar pokryty stanem jest gotowy do kompletacji także bez lokalizacji', () => {
  const position = classifyWarehousePosition({ matched: true, stockKnown: true, shortage: 0, location: '' });
  assert.deepEqual(position, { decision: 'kompletuj', fulfillmentReady: true, locationMissing: true });
  const analysis = summarizeWarehousePositions([{ ...position, shortage: 0, location: '' }]);
  assert.equal(analysis.gotowe, true);
  assert.equal(analysis.fulfillmentReady, true);
  assert.equal(analysis.bezLokalizacji, 1);
  assert.equal(warehouseAnalysisNeedsInvestigation(analysis), false);
});

test('lokalizacja nie miesza się z realnym brakiem ani zamówieniem producenta', () => {
  const shortage = classifyWarehousePosition({ matched: true, stockKnown: true, shortage: 2, location: '' });
  assert.equal(shortage.decision, 'zamow_u_producenta');
  assert.equal(shortage.locationMissing, false);
  const analysis = summarizeWarehousePositions([{ ...shortage, shortage: 2, location: '' }]);
  assert.equal(analysis.braki, 2);
  assert.equal(analysis.bezLokalizacji, 0);
  assert.equal(analysis.gotowe, false);
});

test('nierozpoznany produkt i nieznany stan pozostają jedynymi tematami do wyjaśnienia', () => {
  const unknownProduct = classifyWarehousePosition({ matched: false });
  const unknownStock = classifyWarehousePosition({ matched: true, stockKnown: false });
  const analysis = summarizeWarehousePositions([unknownProduct, unknownStock]);
  assert.equal(analysis.nierozpoznane, 1);
  assert.equal(analysis.bezStanu, 1);
  assert.equal(warehouseAnalysisNeedsInvestigation(analysis), true);
});

test('stara decyzja tylko o lokalizacji nie blokuje gotowości po migracji', () => {
  const analysis = summarizeWarehousePositions([{ decision: 'uzupelnij_lokalizacje', shortage: 0, location: '' }]);
  assert.equal(analysis.bezLokalizacji, 1);
  assert.equal(analysis.gotowe, true);
  assert.equal(warehouseAnalysisNeedsInvestigation(analysis), false);
});
