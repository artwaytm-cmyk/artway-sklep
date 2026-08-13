import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await Promise.all([
  '../src/frontend/12-customers-and-inventory.js',
  '../src/frontend/12d-inventory-operations.js',
].map((path) => readFile(new URL(path, import.meta.url), 'utf8')))).join('\n');

function frontendInventory() {
  const context = {
    console,
    Date,
    Number,
    String,
    Math,
    Object,
    Array,
    Map,
    Set,
    JSON,
    URL,
    Intl,
    setTimeout,
    clearTimeout,
    kwotaNum: (value) => Number(value) || 0,
    wczytajLS: (_key, fallback) => fallback,
    pobierzZamowienia: () => [],
    ruchyMagazynowe: [],
    allegroZamowienia: [],
    allegroZamowienieAktywneLokalnie: () => true,
    allegroDanePozycjiZamowienia: (item) => ({ kod: item.sku || '', ean: '', nazwa: item.name || 'Produkt Allegro' }),
    allegroDopasowaniePozycjiDoProduktu: (item) => ({ produkt: { id: item.productId }, match: 'test', confidence: 1, candidates: [] }),
    stanMagazynuId: () => null,
    magazynMetaProduktu: () => ({}),
    agentAIZlecenia: [],
    agentAIPlanDokumentAktywny: () => false,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function order(number, productId, quantity, extra = {}) {
  return {
    nr: number,
    status: 'nowe',
    pozycjeDane: [{ id: productId, nazwa: `Produkt ${productId}`, ilosc: quantity, cena: 10 }],
    ...extra,
  };
}

function movement(number, productId, before) {
  return {
    sourceRequestId: `order-stock:${number}`,
    produktId: productId,
    stanPrzed: before,
  };
}

function reservations(context, orders, movements = [], allegro = []) {
  context.pobierzZamowienia = () => orders;
  context.ruchyMagazynowe = movements;
  context.allegroZamowienia = allegro;
  context.rezerwacjeMagazynowe._cache = null;
  context.przydzialyMagazynoweAktywnychZamowien._cache = null;
  return JSON.parse(JSON.stringify(context.rezerwacjeMagazynowe()));
}

function shortage(stock, reserved) {
  return Math.max(0, Number(reserved || 0) - stock);
}

test('legacy: stan przed sprzedażą 8 i zamówienie 5 nie tworzą podwójnego braku', () => {
  const context = frontendInventory();
  const result = reservations(context, [order('ATM-1', 31, 5)], [movement('ATM-1', 31, 8)]);

  assert.equal(result['31'], 0);
  assert.equal(shortage(3, result['31']), 0);
});

test('legacy: brak stanu przed zamówieniem 2 szt. daje rzeczywisty brak 2 szt.', () => {
  const context = frontendInventory();
  const result = reservations(context, [order('ATM-2', 31, 2)], [movement('ATM-2', 31, 0)]);

  assert.equal(result['31'], 2);
  assert.equal(shortage(0, result['31']), 2);
});

test('dwa legacy zamówienia sumują wyłącznie niedobory obliczone ze stanów przed sprzedażą', () => {
  const context = frontendInventory();
  const result = reservations(context, [
    order('ATM-3', 31, 4),
    order('ATM-4', 31, 3),
  ], [
    movement('ATM-3', 31, 5),
    movement('ATM-4', 31, 1),
  ]);

  assert.equal(result['31'], 2);
  assert.equal(shortage(0, result['31']), 2);
});

test('nowe zamówienie reserved_until_shipment rezerwuje pełną ilość nawet przy starym ruchu', () => {
  const context = frontendInventory();
  const result = reservations(context, [
    order('ATM-5', 31, 5, { inventoryMode: 'reserved_until_shipment' }),
  ], [movement('ATM-5', 31, 8)]);

  assert.equal(result['31'], 5);
  assert.equal(shortage(3, result['31']), 2);
});

test('zamówienia anulowane, wysłane i zrealizowane nie rezerwują magazynu', () => {
  const context = frontendInventory();
  const result = reservations(context, [
    order('ATM-6', 31, 2, { status: 'anulowane', inventoryMode: 'reserved_until_shipment' }),
    order('ATM-7', 31, 3, { status: 'wysłane', inventoryMode: 'reserved_until_shipment' }),
    order('ATM-8', 31, 4, { status: 'zrealizowane', inventoryMode: 'reserved_until_shipment' }),
  ]);

  assert.deepEqual(result, {});
});

test('rezerwacje aktywnych zamówień Allegro pozostają doliczane bez regresji', () => {
  const context = frontendInventory();
  const result = reservations(context, [], [], [{
    id: 'ALG-1',
    lineItems: [{ id: 'LINE-1', offerId: 'OFFER-1', productId: 31, quantity: 3, price: { amount: 10 } }],
  }]);

  assert.equal(result['31'], 3);
});

test('dwa zlecenia Allegro przy stanie zero dostają po jednym realnym braku bez fałszywej półki', () => {
  const context = frontendInventory();
  context.stanMagazynuId = () => 0;
  context.magazynMetaProduktu = () => ({ lokalizacja: 'PAK-RA-P02' });
  context.allegroZamowienia = [
    { id: 'ALG-1', createdAt: '2026-07-31T11:00:00Z', lineItems: [{ offerId: 'OFFER-1', productId: 31, quantity: 1 }] },
    { id: 'ALG-2', createdAt: '2026-07-31T12:00:00Z', lineItems: [{ offerId: 'OFFER-2', productId: 31, quantity: 1 }] },
  ];
  context.rezerwacjeMagazynowe._cache = null;
  context.przydzialyMagazynoweAktywnychZamowien._cache = null;

  for (const order of context.allegroZamowienia) {
    const line = context.allegroAnalizaMagazynowaZamowienia(order).pozycje[0];
    assert.equal(line.brak, 1);
    assert.equal(line.lokalizacja, '');
    assert.equal(line.lokalizacjaKartoteki, 'PAK-RA-P02');
    assert.equal(line.decyzja, 'zamow_u_producenta');
  }
});

test('jedyna dostępna sztuka trafia do najstarszego zlecenia, a nowsze czeka na dostawę', () => {
  const context = frontendInventory();
  context.stanMagazynuId = () => 1;
  context.magazynMetaProduktu = () => ({ lokalizacja: 'PAK-RA-P02' });
  const older={ id: 'ALG-OLD', createdAt: '2026-07-31T11:00:00Z', lineItems: [{ offerId: 'OFFER-1', productId: 31, quantity: 1 }] };
  const newer={ id: 'ALG-NEW', createdAt: '2026-07-31T12:00:00Z', lineItems: [{ offerId: 'OFFER-2', productId: 31, quantity: 1 }] };
  context.allegroZamowienia = [newer, older];
  context.rezerwacjeMagazynowe._cache = null;
  context.przydzialyMagazynoweAktywnychZamowien._cache = null;

  const first=context.allegroAnalizaMagazynowaZamowienia(older).pozycje[0];
  const second=context.allegroAnalizaMagazynowaZamowienia(newer).pozycje[0];
  assert.equal(first.przydzielone, 1);
  assert.equal(first.brak, 0);
  assert.equal(first.lokalizacja, 'PAK-RA-P02');
  assert.equal(second.przydzielone, 0);
  assert.equal(second.brak, 1);
  assert.equal(second.lokalizacja, '');
});
