import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const backend = await readFile(new URL('../netlify/functions/lib/store-app.mjs', import.meta.url), 'utf8');
const emailContent = await readFile(new URL('../netlify/functions/lib/domain/order-email-content.mjs', import.meta.url), 'utf8');
const cart = await readFile(new URL('../src/frontend/17-cart-and-checkout.js', import.meta.url), 'utf8');
const storefront = await readFile(new URL('../src/frontend/06-router-and-storefront.js', import.meta.url), 'utf8');

test('koszyk pyta tylko o ilość przekraczającą realny kontrolowany stan', () => {
  assert.match(cart, /function kontrolowanyStanDlaZakupu/);
  assert.match(cart, /function wymagaPotwierdzeniaIlosci/);
  assert.match(cart, /stan===null\|\|qty>stan/);
  assert.match(cart, /filter\(x=>wymagaPotwierdzeniaIlosci\(x\.id,x\.ilosc\)\)/);
});

test('potwierdzenie dostępności przez administratora wysyła klientowi osobny e-mail', () => {
  assert.match(`${backend}\n${emailContent}`, /dostepnosc_potwierdzona/);
  assert.match(backend, /stary\?\.wymagaPotwierdzeniaDostepnosci === true/);
  assert.match(backend, /decyzjaDostepnosciNowa === 'confirmed'/);
  assert.match(emailContent, /Potwierdziliśmy dostępność zamówienia/);
});

test('SMTP wymusza TLS i wyrównany envelope, a e-maile transakcyjne nie mieszają promocji', () => {
  assert.match(backend, /requireTLS: !c\.secure/);
  assert.match(backend, /minVersion: 'TLSv1\.2'/);
  assert.match(backend, /envelope: \{ from: c\.user, to \}/);
  assert.doesNotMatch(backend.slice(backend.indexOf('function wiadomoscKlientaZamowienie'), backend.indexOf('function wiadomoscAdminZamowienie')), /domówić|kolejne produkty|okazje/i);
});

test('na stronie głównej katalogi działów są wyświetlane pod listą produktów', () => {
  assert.match(storefront, /\["hero","banery","produkty","kategorie"/);
  assert.match(storefront, /kategorieIndex<produktyIndex/);
});
