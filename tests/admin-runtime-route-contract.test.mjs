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

test('trasy panelu ładują jawnie moduły wymagane przez swoje widoki', async () => {
  const router = await read('src/frontend/06-router-and-storefront.js');
  assert.match(router, /t==="\/admin"\|\|t\.startsWith\("\/admin\/pulpit"\)\)add\("shipping","commerce","communications","inventory","system"\)/);
  assert.match(router, /t\.startsWith\("\/admin\/agent-ai"\)\)add\("agent","warehouse","commerce","communications","inventory"\)/);
  assert.match(router, /t\.startsWith\("\/admin\/allegro"\)[^\n]+add\("agent","warehouse","commerce","communications","inventory"\)/);
  assert.match(router, /\["\/admin\/magazyn\/lokalizacje","\/admin\/magazyn\/etykiety-qr"\][^\n]+add\("warehouse"\)/);
  assert.match(router, /t==="\/diagnostyka"\|\|t==="\/admin\/system\/diagnostyka"\)add\("agent","warehouse","shipping","commerce","communications","inventory","catalog","personalization","system"\)/);
  assert.match(router, /t\.startsWith\("\/admin\/system"\)\)add\("system"\)/);
});

test('progresywne ładowanie kart należy do pakietu asortymentu', async () => {
  const [assortment, warehouse] = await Promise.all([
    read('src/frontend/12-warehouse-assortment-view.js'),
    read('src/frontend/12-warehouse-views.js'),
  ]);
  assert.match(assortment, /function asortymentPrzygotujKartyProgresywnie\(/);
  assert.doesNotMatch(warehouse, /function asortymentPrzygotujKartyProgresywnie\(/);
});
