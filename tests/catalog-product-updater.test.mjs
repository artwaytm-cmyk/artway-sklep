import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogProductUpdater } from '../netlify/functions/lib/domain/catalog-product-updater.mjs';

test('aktualizator zapisuje metadane mapowania jako edycję importowanego produktu', () => {
  const data = { artway_produkty_edytowane: {} };
  const updater = createCatalogProductUpdater(data, ['1000287']);
  assert.equal(updater.apply('1000287', { allegroOfferId: 'OF-1', allegroMappingStatus: 'zweryfikowane' }), true);
  assert.equal(updater.commit(), true);
  assert.equal(data.artway_produkty_edytowane['1000287'].allegroOfferId, 'OF-1');
  assert.equal(data.artway_produkty_edytowane['1000287'].id, 1000287);
});

test('aktualizator nie tworzy osieroconej edycji dla nieznanego produktu', () => {
  const data = { artway_produkty_edytowane: {} };
  const updater = createCatalogProductUpdater(data, ['1000287']);
  assert.equal(updater.apply('9999999', { allegroOfferId: 'OF-X' }), false);
  assert.equal(updater.commit(), false);
  assert.deepEqual(data.artway_produkty_edytowane, {});
});
