import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/frontend/11d-von-halsky-operations-workspace.js', import.meta.url), 'utf8');

function pickingRows() {
  const start = source.indexOf('function vonHalskyPozycjaZamowienia');
  const end = source.indexOf('function vonHalskyMiniEtapyHTML');
  assert.ok(start >= 0 && end > start);
  const products = [
    { id: '106', nazwa: 'Ale Pary', ean: '5906018023510', sku: '2351', _catalog: { inventory: {} } },
    { id: '1000462', nazwa: 'Puzzle dla Maluszków', gtin: '5906018005400', externalId: '0540', _catalog: { inventory: {} } },
  ];
  const context = {
    produktyDoAdministracji: () => products,
    magazynMetaProduktu: (id) => String(id) === '106' ? { lokalizacja: 'PAK-RA-P02' } : {},
    stanMagazynuId: (id) => String(id) === '106' ? 4 : null,
    sciezkaNazwLokalizacjiMagazynu: (code) => code === 'PAK-RA-P02' ? 'Pakownia → Regał A → Półka 2' : '',
  };
  const order = { orderLines: [
    { offer: { externalId: '2351', product: { ean: '5906018023510', sku: '2351', name: 'Ale Pary' } } },
    { offer: { externalId: '0540', product: { ean: '5906018005400', sku: '0540', name: 'Puzzle dla Maluszków' } } },
    { offer: { externalId: 'BRAK', product: { ean: '5900000000000', sku: 'BRAK', name: 'Nieznana gra' } } },
  ] };
  const sandbox = { ...context, order };
  vm.runInNewContext(`${source.slice(start, end)};this.result=vonHalskyRozpiskaZamowienia(this.order);`, sandbox);
  return sandbox.result;
}

test('rozpiska Von Halsky dopasowuje gry po EAN i pokazuje rzeczywistą półkę', () => {
  const rows = pickingRows();
  assert.equal(rows[0].product.id, '106');
  assert.equal(rows[0].location, 'PAK-RA-P02');
  assert.equal(rows[0].locationName, 'Pakownia → Regał A → Półka 2');
  assert.equal(rows[0].stock, 4);
  assert.equal(rows[0].state, 'ready');
});

test('brak półki i brak kartoteki pozostają jawnymi zadaniami kompletacji', () => {
  const rows = pickingRows();
  assert.equal(rows[1].product.id, '1000462');
  assert.equal(rows[1].state, 'missing-location');
  assert.equal(rows[2].product, null);
  assert.equal(rows[2].state, 'unmatched');
});

test('karta zamówienia pokazuje półkę i Plan wyłącznie informacyjnie', () => {
  assert.match(source, /Produkty, stan i położenie — tylko odczyt/);
  assert.doesNotMatch(source, /function vonHalskyPrzypiszPolkePozycji/);
  assert.doesNotMatch(source, /warehouse-product-location-assign/);
  assert.doesNotMatch(source, /vonHalskyWarehouseLocations/);
  assert.match(source, /zarządzanie wyłącznie w Magazynie/);
  assert.match(source, /Informacja z Planu zatowarowania/);
  assert.match(source, /informacyjnie w Planie/);
  assert.match(source, /gotowe do pobrania/);
});

test('szczegóły pobierają brakującą kartotekę z pełnego katalogu serwerowego', async () => {
  const start = source.indexOf('function vonHalskyPozycjaZamowienia');
  const end = source.indexOf('function vonHalskyMiniEtapyHTML');
  const calls = [];
  const order = { orderLines: [{ offer: { externalId: '2351', product: { ean: '5906018023510', sku: '2351', name: 'Ale Pary' } } }] };
  const sandbox = {
    order,
    produktyDoAdministracji: () => [],
    magazynMetaProduktu: () => ({}),
    stanMagazynuId: () => null,
    sciezkaNazwLokalizacjiMagazynu: () => '',
    zapamietajProduktyCentralne: () => {},
    chmura: async (action, options) => {
      calls.push({ action, options });
      return { items: [{ id: '106', nazwa: 'Ale Pary', ean: '5906018023510', sku: '2351', _catalog: { inventory: {} } }] };
    },
  };
  vm.runInNewContext(`${source.slice(start, end)};this.load=async()=>{await vonHalskyZaladujKartotekiZamowienia(this.order);return vonHalskyRozpiskaZamowienia(this.order);};`, sandbox);
  const rows = await sandbox.load();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'product-catalog-query');
  assert.equal(calls[0].options.params.q, '5906018023510');
  assert.equal(rows[0].product.id, '106');
  assert.equal(rows[0].state, 'missing-location');
});
