import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroCatalogParameterValue } from '../src/backend/lib/domain/allegro-catalog-parameters.mjs';

test('parametr Kod producenta nie jest błędnie odczytywany jako Producent', () => {
  const product = {
    parameters: [
      { id: '224017', name: 'Kod producenta', values: ['M3007'] },
      { id: '225693', name: 'EAN (GTIN)', values: ['5904492130076'] },
    ],
  };
  assert.equal(allegroCatalogParameterValue(product, ['producent', 'marka', 'brand']), '');
  assert.equal(allegroCatalogParameterValue(product, ['kod producenta', 'mpn']), 'M3007');
});

test('wartość marki z wartości słownikowej pozostaje odczytywana', () => {
  const product = {
    parameters: [{ id: '248811', name: 'Marka', valuesLabels: ['Multigra'] }],
  };
  assert.equal(allegroCatalogParameterValue(product, ['producent', 'marka', 'brand']), 'Multigra');
});

