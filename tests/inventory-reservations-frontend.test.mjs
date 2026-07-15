import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/frontend/12-customers-and-inventory.js', import.meta.url), 'utf8');

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
