import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogProductUpdater } from '../src/backend/lib/domain/catalog-product-updater.mjs';
import { applyCatalogProductOperations } from '../src/backend/lib/domain/catalog-product-operation-rebase.mjs';

test('rebase aktualizacji Allegro zachowuje równoległą edycję tego samego produktu przez administratora', () => {
  const expectedProduct = { id: 31, nazwa: 'Gra', opis: 'stary opis' };
  const latestProduct = { ...expectedProduct, opis: 'ręczna korekta administratora' };
  const data = { artway_produkty_dodane: [latestProduct] };
  const result = applyCatalogProductOperations({
    data,
    products: new Map([['31', latestProduct]]),
    operations: [{ id: '31', fields: { opis: 'automatyczny opis Allegro' }, expectedProduct }],
    createUpdater: createCatalogProductUpdater,
  });

  assert.equal(result.changed, false);
  assert.deepEqual(result.skippedProductIds, ['31']);
  assert.equal(data.artway_produkty_dodane[0].opis, 'ręczna korekta administratora');
});

test('rebase zapisuje przygotowane operacje, gdy produkt nie zmienił się w czasie cyklu', () => {
  const product = { id: 31, nazwa: 'Gra', opis: 'stary opis' };
  const data = { artway_produkty_dodane: [{ ...product }] };
  const result = applyCatalogProductOperations({
    data,
    products: new Map([['31', { ...product }]]),
    operations: [
      { id: '31', fields: { opis: 'nowy opis' }, expectedProduct: product },
      { id: '31', fields: { allegroEditorialSyncState: 'synced' }, expectedProduct: product },
    ],
    createUpdater: createCatalogProductUpdater,
  });

  assert.equal(result.changed, true);
  assert.equal(result.appliedOperations, 2);
  assert.equal(data.artway_produkty_dodane[0].opis, 'nowy opis');
  assert.equal(data.artway_produkty_dodane[0].allegroEditorialSyncState, 'synced');
});
