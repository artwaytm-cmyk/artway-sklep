import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroCatalogParameterValue, allegroCatalogProductParameterAssessment, allegroCatalogProductParameterPayloads, allegroCatalogProductReference } from '../src/backend/lib/domain/allegro-catalog-parameters.mjs';

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

test('produkt katalogowy zachowuje wymagane parametry w productSet', () => {
  const parameters = [
    { id: '224017', values: ['5060'] },
    { id: '201325', values: ['400'] },
  ];
  assert.deepEqual(allegroCatalogProductReference({
    catalogProductId: 'catalog-tygrys',
    categoryId: '86352',
    gtin: '5906018050608',
    parameters,
  }), {
    id: 'catalog-tygrys',
    parameters,
  });
});

test('istniejący produkt katalogowy używa dokładnych wartości słownikowych Allegro', () => {
  const result = allegroCatalogProductParameterPayloads({
    parameters: [
      { id: '248811', name: 'Marka', valuesIds: ['248811_2027073'], valuesLabels: ['Alexader'] },
      { id: '224017', name: 'Kod producenta', values: ['7945'] },
      { id: 'spoza-kategorii', values: ['pomijane'] },
    ],
  }, [
    { id: '248811', name: 'Marka' },
    { id: '224017', name: 'Kod producenta' },
  ]);
  assert.deepEqual(result, [
    { id: '248811', valuesIds: ['248811_2027073'] },
    { id: '224017', values: ['7945'] },
  ]);
});

test('sprzeczna zależna wartość katalogowa nie trafia do szkicu oferty', () => {
  const assessment = allegroCatalogProductParameterAssessment({
    parameters: [
      { id: 'wydawca', valuesIds: ['wydawca_alexander'] },
      { id: 'seria', valuesIds: ['seria_inna'] },
    ],
  }, [
    { id: 'wydawca', dictionary: [{ id: 'wydawca_alexander', value: 'Alexander' }] },
    {
      id: 'seria',
      options: { dependsOnParameterId: 'wydawca' },
      dictionary: [{ id: 'seria_inna', value: 'inna', dependsOnValueIds: ['wydawca_inny'] }],
    },
  ]);
  assert.deepEqual(assessment, {
    parameters: [{ id: 'wydawca', valuesIds: ['wydawca_alexander'] }],
    incompatibleParameterIds: ['seria'],
  });
});

test('zgodna zależna wartość katalogowa pozostaje w szkicu oferty', () => {
  const result = allegroCatalogProductParameterPayloads({
    parameters: [
      { id: 'wydawca', valuesIds: ['wydawca_alexander'] },
      { id: 'seria', valuesIds: ['seria_alexander'] },
    ],
  }, [
    { id: 'wydawca', dictionary: [{ id: 'wydawca_alexander', value: 'Alexander' }] },
    {
      id: 'seria',
      options: { dependsOnParameterId: 'wydawca' },
      dictionary: [{ id: 'seria_alexander', value: 'Alexander', dependsOnValueIds: ['wydawca_alexander'] }],
    },
  ]);
  assert.deepEqual(result, [
    { id: 'wydawca', valuesIds: ['wydawca_alexander'] },
    { id: 'seria', valuesIds: ['seria_alexander'] },
  ]);
});

test('zależności są sprawdzane również dla wartości opisanej etykietą', () => {
  const result = allegroCatalogProductParameterPayloads({
    parameters: [
      { id: 'wydawca', values: ['Alexander'] },
      { id: 'seria', values: ['inna'] },
    ],
  }, [
    { id: 'wydawca', dictionary: [{ id: 'wydawca_alexander', value: 'Alexander' }] },
    {
      id: 'seria',
      options: { dependsOnParameterId: 'wydawca' },
      dictionary: [{ id: 'seria_inna', value: 'inna', dependsOnValueIds: ['wydawca_inny'] }],
    },
  ]);
  assert.deepEqual(result, [{ id: 'wydawca', values: ['Alexander'] }]);
});
