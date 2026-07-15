import test from 'node:test';
import assert from 'node:assert/strict';
import { applyInventoryStockSet } from '../netlify/functions/lib/domain/inventory.mjs';

const NOW = new Date('2026-07-15T10:15:30.000Z');

function record(stock = 1, rev = 2782) {
  return {
    rev,
    updated_at: '2026-07-15T10:00:00.000Z',
    data: {
      artway_stany: { 31: stock, 99: 4 },
      artway_ruchy_magazynowe: [],
      artway_magazyn_produkty: { 31: { lokalizacja: 'A-R01-P01', dostawca: 'Alexander' } },
      artway_ustawienia: { nazwa: 'Artway-TM' },
    },
  };
}

const product = {
  name: 'Gorący Ziemniak Familijny',
  sku: '1410',
  externalId: '1410',
  ean: '5906018014105',
};

test('ustawia dokładny stan, zachowuje pozostałe dane i zapisuje inwentaryzację', () => {
  const result = applyInventoryStockSet(record(), {
    productId: '31', mode: 'set', quantity: 8, expectedStock: 1, expectedRev: 2782,
    confirmed: true, confirmInventory: true, product, source: 'codex-agent', reason: 'Sprawdzono i zatwierdzono 8 szt.',
    requestId: 'telegram-update-123',
  }, NOW);

  assert.equal(result.record.rev, 2783);
  assert.equal(result.record.data.artway_stany['31'], 8);
  assert.equal(result.record.data.artway_stany['99'], 4);
  assert.deepEqual(result.record.data.artway_ustawienia, { nazwa: 'Artway-TM' });
  assert.equal(result.record.data.artway_magazyn_produkty['31'].lokalizacja, 'A-R01-P01');
  assert.equal(result.record.data.artway_magazyn_produkty['31'].ostatniaInwentaryzacja, '2026-07-15');
  assert.equal(result.result.before, 1);
  assert.equal(result.result.after, 8);
  assert.equal(result.result.delta, 7);
  assert.equal(result.record.data.artway_ruchy_magazynowe[0].typ, 'inwentaryzacja');
  assert.equal(result.record.data.artway_ruchy_magazynowe[0].produktNazwa, product.name);
  assert.equal(result.record.data.artway_ruchy_magazynowe[0].sourceRequestId, 'telegram-update-123');
});

test('przyrost jest odróżniony od ustawienia wartości bezwzględnej', () => {
  const result = applyInventoryStockSet(record(8, 10), {
    productId: '31', mode: 'increment', quantity: 3, expectedStock: 8, expectedRev: 10,
    confirmed: true, product,
  }, NOW);
  assert.equal(result.result.after, 11);
  assert.equal(result.result.delta, 3);
  assert.equal(result.record.data.artway_ruchy_magazynowe[0].typ, 'przyjęcie');
});

test('odrzuca zmianę bez potwierdzenia', () => {
  assert.throws(() => applyInventoryStockSet(record(), {
    productId: '31', mode: 'set', quantity: 8, expectedStock: 1, expectedRev: 2782,
  }, NOW), (error) => error.code === 'inventory_confirmation_required' && error.status === 409);
});

test('odrzuca zapis na nieaktualnej rewizji lub stanie', () => {
  assert.throws(() => applyInventoryStockSet(record(), {
    productId: '31', mode: 'set', quantity: 8, expectedStock: 1, expectedRev: 2781, confirmed: true,
  }, NOW), (error) => error.code === 'inventory_revision_conflict');
  assert.throws(() => applyInventoryStockSet(record(), {
    productId: '31', mode: 'set', quantity: 8, expectedStock: 2, expectedRev: 2782, confirmed: true,
  }, NOW), (error) => error.code === 'inventory_stock_conflict');
});

test('odrzuca brak oczekiwanej rewizji, stanu lub ilości', () => {
  assert.throws(() => applyInventoryStockSet(record(), {
    productId: '31', mode: 'set', quantity: 8, expectedStock: 1, confirmed: true,
  }, NOW), (error) => error.code === 'inventory_expected_revision_required');
  assert.throws(() => applyInventoryStockSet(record(), {
    productId: '31', mode: 'set', quantity: 8, expectedRev: 2782, confirmed: true,
  }, NOW), (error) => error.code === 'inventory_expected_stock_required');
  assert.throws(() => applyInventoryStockSet(record(), {
    productId: '31', mode: 'set', expectedStock: 1, expectedRev: 2782, confirmed: true,
  }, NOW), (error) => error.code === 'inventory_quantity_required');
});

test('zmiana Agenta wymaga lokalizacji i zapisuje ją atomowo w ruchu oraz kartotece', () => {
  assert.throws(() => applyInventoryStockSet(record(), {
    productId: '31', mode: 'set', quantity: 8, expectedStock: 1, expectedRev: 2782,
    confirmed: true, requireLocation: true, expectedLocation: 'A-R01-P01', location: '', product,
  }, NOW), (error) => error.code === 'inventory_location_required');

  assert.throws(() => applyInventoryStockSet(record(), {
    productId: '31', mode: 'set', quantity: 8, expectedStock: 1, expectedRev: 2782,
    confirmed: true, requireLocation: true, expectedLocation: 'A-R09-P09', location: 'A-R01-P02', product,
  }, NOW), (error) => error.code === 'inventory_location_conflict');

  const result = applyInventoryStockSet(record(), {
    productId: '31', mode: 'set', quantity: 8, expectedStock: 1, expectedRev: 2782,
    confirmed: true, confirmInventory: true, requireLocation: true,
    expectedLocation: 'A-R01-P01', location: 'A-R01-P02', product,
  }, NOW);
  assert.equal(result.record.data.artway_magazyn_produkty['31'].lokalizacja, 'A-R01-P02');
  assert.equal(result.record.data.artway_ruchy_magazynowe[0].lokalizacjaPrzed, 'A-R01-P01');
  assert.equal(result.record.data.artway_ruchy_magazynowe[0].lokalizacjaPo, 'A-R01-P02');
  assert.equal(result.result.locationBefore, 'A-R01-P01');
  assert.equal(result.result.locationAfter, 'A-R01-P02');
});
