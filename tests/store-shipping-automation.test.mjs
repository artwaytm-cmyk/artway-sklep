import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStoreRepository } from '../src/backend/lib/core/store-repository.mjs';
import { bezpieczneZamowienieKlienta } from '../src/backend/lib/domain/checkout.mjs';
import { renderStorefrontSeoPage, seoRouteMatches } from '../src/backend/lib/domain/storefront-seo-renderer.mjs';
import { storeShippingConfig } from '../src/backend/lib/domain/store-shipping-config.mjs';

const settingsData = {
  artway_ustawienia: {
    darmowaDostawaOd: '175',
    czasWysylki: '3 dni robocze',
    oplataPaczkaWeekend: '6,50',
    dostawy: [
      { id: 'paczkomat', nazwa: 'Paczkomat InPost 24/7', koszt: '17,50' },
      { id: 'kurier_inpost', nazwa: 'Kurier InPost', koszt: 23.5 },
    ],
    platnosci: [{ id: 'pobranie', nazwa: 'Za pobraniem', oplata: 9 }],
  },
};

test('jedno źródło normalizuje ceny, próg, czas i opłaty dostawy', () => {
  const shipping = storeShippingConfig(settingsData, { updatedAt: '2026-08-09T01:00:00.000Z' });
  assert.equal(shipping.locker.price, 17.5);
  assert.equal(shipping.courier.price, 23.5);
  assert.equal(shipping.freeFrom, 175);
  assert.equal(shipping.weekendPrice, 6.5);
  assert.equal(shipping.cashOnDeliveryPrice, 9);
  assert.equal(shipping.dispatchTime, '3 dni robocze');
  assert.equal(shipping.methods.length, 2);
});

test('backend koszyka liczy zamówienie z tego samego aktualnego cennika', () => {
  const data = {
    ...settingsData,
    artway_produkty_dodane: [{ id: 'p-1', nazwa: 'Produkt testowy', cena: 100, sku: 'P1' }],
  };
  const raw = {
    nr: 'ATM-SHIPPING-AUTO', email: 'klient@example.com',
    pozycjeDane: [{ id: 'p-1', ilosc: 1 }],
    dostawaId: 'paczkomat', paczkomat: 'BOJ01N', paczkaWeekend: true,
    platnoscId: 'pobranie',
    klient: { imie: 'Jan', nazwisko: 'Kowalski', telefon: '500600700' },
    adresDostawy: { ulica: 'Testowa', nrDomu: '1', kod: '80-001', miasto: 'Gdańsk' },
  };
  const order = bezpieczneZamowienieKlienta(raw, data);
  assert.equal(order.koszty.dostawa, 17.5);
  assert.equal(order.koszty.paczkaWeekend, 6.5);
  assert.equal(order.koszty.platnosc, 9);
  assert.equal(order.koszty.razem, 133);
  const free = bezpieczneZamowienieKlienta({ ...raw, pozycjeDane: [{ id: 'p-1', ilosc: 2 }] }, data);
  assert.equal(free.koszty.dostawa, 0);
});

test('publiczna podstrona dostawy pobiera ustawienia na żywo bez przebudowy pliku', async () => {
  const repository = createStoreRepository({ name: 'artway-sklep', driver: 'memory' });
  await repository.write('settings', { data: settingsData, rev: 1, updated_at: '2026-08-09T01:00:00.000Z' });
  const shippingConfig = storeShippingConfig((await repository.read('settings')).data);
  const response = await renderStorefrontSeoPage(new Request('https://artwaytm.pl/dostawa/'), { shippingConfig });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-artway-live-settings'), 'shipping');
  assert.match(response.headers.get('cache-control') || '', /no-cache/);
  for (const value of ['17,50 zł', '23,50 zł', '175,00 zł', '+6,50 zł', '9,00 zł', '3 dni robocze']) assert.ok(html.includes(value), value);
});

test('wszystkie publiczne strony informacyjne są kierowane przez dynamiczne ustawienia', async () => {
  for (const route of ['/kontakt/', '/regulamin/', '/prywatnosc/', '/dostawa/', '/zwroty/']) assert.equal(seoRouteMatches(route), true, route);
  const [feed, renderer, nginx] = await Promise.all([
    readFile(new URL('../src/backend/google-products.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/backend/lib/domain/storefront-seo-renderer.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../ops/nginx/artway-seo-pages.conf', import.meta.url), 'utf8'),
  ]);
  assert.match(feed, /storeShippingConfig/);
  assert.match(feed, /no-cache, max-age=0, must-revalidate/);
  assert.match(renderer, /loadStoreShippingConfig/);
  assert.match(nginx, /kontakt\|regulamin\|prywatnosc\|dostawa\|zwroty/);
});
