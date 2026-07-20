import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ADMIN_RUNTIME_BUNDLES } from '../scripts/build-assets.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('wspólny stan integracji jest dostępny przed załadowaniem dowolnej trasy panelu', async () => {
  const [runtime, shipping] = await Promise.all([
    read('src/frontend/02-runtime-state.js'),
    read('src/frontend/07a-shipping-workflow.js'),
  ]);
  assert.match(runtime, /let stanBramki=\{/);
  assert.doesNotMatch(shipping, /let stanBramki=\{/);
});

test('trasa asortymentu ładuje widok produktów z pakietu inventory', () => {
  const inventory = ADMIN_RUNTIME_BUNDLES.find((bundle) => bundle.output === 'assets/admin-inventory.js');
  const warehouse = ADMIN_RUNTIME_BUNDLES.find((bundle) => bundle.output === 'assets/admin-warehouse.js');
  for (const source of [
    'src/frontend/12-warehouse-assortment-card.js',
    'src/frontend/12-warehouse-assortment-view.js',
  ]) {
    assert.ok(inventory?.sources.includes(source), `${source} musi być w pakiecie trasy asortymentu`);
    assert.ok(!warehouse?.sources.includes(source), `${source} nie może dublować się w pakiecie magazynu`);
  }
});

test('każda widoczna podstrona Allegro ma jawny odbiornik routera', async () => {
  const router = await read('src/frontend/06-router-and-storefront.js');
  for (const section of ['zamowienia', 'oferty', 'wystawianie', 'rentownosc', 'wiadomosci', 'dyskusje', 'zgodnosc', 'ustawienia']) {
    assert.match(router, new RegExp(`t===["']\\/admin\\/allegro\\/${section}["']`), `brak trasy Allegro: ${section}`);
  }
});
