import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyWarehousePosition,
  summarizeWarehousePositions,
  warehouseAnalysisNeedsInvestigation,
} from '../src/backend/lib/domain/order-warehouse-readiness.mjs';

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
