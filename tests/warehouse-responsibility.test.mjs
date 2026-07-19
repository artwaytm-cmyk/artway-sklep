import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('frontend rozdziela kompletację, zakup i zadanie lokalizacji', () => {
  const inventory = read('assets/admin.js');
  const allegro = read('assets/admin.js');
  assert.match(inventory, /function klasyfikujPozycjeDoKompletacji/);
  assert.match(inventory, /decyzja:"kompletuj",gotowe:true,brakLokalizacji:/);
  assert.match(inventory, /gotowe:nierozpoznane===0&&bezStanu===0&&braki===0/);
  assert.doesNotMatch(inventory, /gotowe:[^\n;]*bezLokalizacji===0/);
  assert.match(allegro, /doWyjasnienia:analizy\.filter\(a=>a\.nierozpoznane>0\|\|a\.bezStanu>0\)/);
  assert.match(allegro, /Towar jest zarezerwowany\. Magazyn ustali lokalizację/);
  assert.match(allegro, /Stan pokrywa zamówienie — można kompletować/);
  assert.match(allegro, /const bezLok=magazynLokalizacjeZamowienIds\.size/);
  assert.doesNotMatch(allegro, /const bezLok=plan\.filter/);
});

test('magazyn ma osobną, zawężoną kolejkę lokalizacji aktywnych zamówień', () => {
  const inventory = read('assets/admin.js');
  const agent = read('assets/admin.js');
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
  const backend = read('netlify/functions/lib/store-app.mjs');
  assert.match(backend, /classifyWarehousePosition/);
  assert.match(backend, /summarizeWarehousePositions/);
  assert.match(backend, /warehouse_location/);
  assert.match(backend, /Towar pozostaje zarezerwowany i nie blokuje realizacji zamówienia/);
  assert.match(backend, /warehouseLocationTasks:/);
});
