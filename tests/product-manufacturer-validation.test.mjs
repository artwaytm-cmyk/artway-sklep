import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalManufacturerName,
  normalizeProductManufacturerFields,
  sanitizeManufacturerFieldsInSettings,
  validManufacturerName,
} from '../netlify/functions/lib/domain/product-field-validation.mjs';
import { centralCatalogMissingFields } from '../netlify/functions/lib/domain/central-product-catalog.mjs';
import { resolveAllegroCategoryParameter } from '../netlify/functions/lib/domain/allegro-category-parameter-resolver.mjs';

test('producent musi zawierać literę, ale może zawierać cyfry', () => {
  assert.equal(canonicalManufacturerName('0031'), '');
  assert.equal(canonicalManufacturerName('  --  '), '');
  assert.equal(canonicalManufacturerName('3D Factory'), '3D Factory');
  assert.equal(canonicalManufacturerName('4M'), '4M');
  assert.equal(validManufacturerName('Ładne Balony 24'), true);
});

test('kartoteka usuwa liczbowy producent i korzysta z prawidłowej marki', () => {
  assert.deepEqual(normalizeProductManufacturerFields({ id: 1, producent: '0031', marka: 'Alexander' }), {
    id: 1,
    producent: 'Alexander',
    marka: 'Alexander',
  });
  assert.deepEqual(normalizeProductManufacturerFields({ id: 2, producent: '12345', marka: '999' }), { id: 2 });
});

test('ogólny zapis ustawień chroni dodane i edytowane produkty', () => {
  const result = sanitizeManufacturerFieldsInSettings({
    artway_produkty_dodane: [{ id: 1, producent: '9988' }],
    artway_produkty_edytowane: { 2: { producent: 'GoDan' } },
    innyKlucz: { producent: '123' },
  });
  assert.deepEqual(result.artway_produkty_dodane, [{ id: 1 }]);
  assert.equal(result.artway_produkty_edytowane[2].producent, 'GoDan');
  assert.equal(result.innyKlucz.producent, '123');
});

test('liczba nie spełnia kompletności katalogu ani parametru producenta Allegro', () => {
  const product = { nazwa: 'Gra', cena: 20, producent: '0031', kategoria: 'Gry' };
  assert.ok(centralCatalogMissingFields(product).includes('producent'));
  assert.equal(resolveAllegroCategoryParameter({ ...product, parametryProducenta: { Producent: '0031' } }, { id: '127448', name: 'Producent', required: true }), null);
});
