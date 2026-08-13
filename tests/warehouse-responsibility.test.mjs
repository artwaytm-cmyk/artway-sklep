import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('frontend rozdziela kompletację, zakup i zadanie lokalizacji', () => {
  const inventory = read('assets/admin-inventory.js');
  const allegro = read('assets/admin-commerce.js');
  const warehouse = read('assets/admin-warehouse.js');
  assert.match(inventory, /function klasyfikujPozycjeDoKompletacji/);
  assert.match(inventory, /decyzja:"kompletuj",gotowe:true,brakLokalizacji:/);
  assert.match(inventory, /gotowe:nierozpoznane===0&&bezStanu===0&&braki===0/);
  assert.doesNotMatch(inventory, /gotowe:[^\n;]*bezLokalizacji===0/);
  assert.match(allegro, /analiza\.braki>0\|\|analiza\.nierozpoznane>0\|\|analiza\.bezStanu>0\?"open":""/);
  assert.match(allegro, /Towar jest zarezerwowany\. Magazyn ustali lokalizację/);
  assert.match(allegro, /Stan pokrywa zamówienie — można kompletować/);
  assert.match(warehouse, /const bezLok=typeof magazynLokalizacjeZamowienIds!=="undefined"\?magazynLokalizacjeZamowienIds\.size:0/);
  assert.doesNotMatch(allegro, /const bezLok=plan\.filter/);
});

test('magazyn ma osobną, zawężoną kolejkę lokalizacji aktywnych zamówień', () => {
  const inventory = read('assets/admin-warehouse.js');
  const agent = read('assets/admin-agent.js');
  assert.match(inventory, /magazynLokalizacjeZamowienIds/);
  assert.match(inventory, /filtrMagazynu==="lokalizacje-zamowien"/);
  assert.match(inventory, /lokalizacje do ustalenia • nie blokują realizacji/);
  assert.match(agent, /id:"lokalizacje-kompletacja"/);
  assert.match(agent, /lokalizacja nigdy nie tworzy zakupu/);
  assert.match(agent, /Kartoteka zakupowa/);
  assert.match(agent, /kartoteka:"Uzupełnij dostawcę wyłącznie dla realnych braków/);
  assert.match(agent, /"lokalizacje-kompletacja":"Magazyn przypisuje miejsce/);
});

test('backend publikuje osobne zadanie magazynu bez blokowania realizacji', () => {
  const backend = read('src/backend/lib/store-app.mjs');
  const operationalCenter = read('src/backend/lib/domain/agent-operational-center.mjs');
  assert.match(backend, /classifyWarehousePosition/);
  assert.match(backend, /summarizeWarehousePositions/);
  assert.match(operationalCenter, /warehouse_location/);
  assert.match(operationalCenter, /Towar pozostaje zarezerwowany i nie blokuje realizacji zamówienia/);
  assert.match(operationalCenter, /warehouseLocationTasks:/);
});
