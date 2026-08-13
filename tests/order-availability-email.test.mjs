import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const backend = await readFile(new URL('../src/backend/lib/store-app.mjs', import.meta.url), 'utf8');
const emailService = await readFile(new URL('../src/backend/lib/email-service.mjs', import.meta.url), 'utf8');
const emailTransport = await readFile(new URL('../src/backend/lib/email-transport-service.mjs', import.meta.url), 'utf8');
const emailBackend = `${backend}\n${emailService}\n${emailTransport}`;
const emailContent = await readFile(new URL('../src/backend/lib/domain/order-email-content.mjs', import.meta.url), 'utf8');
const cart = await readFile(new URL('../src/frontend/17-cart-and-checkout.js', import.meta.url), 'utf8');
const storefront = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');

test('koszyk pyta tylko o ilość przekraczającą realny kontrolowany stan', () => {
  assert.match(cart, /function kontrolowanyStanDlaZakupu/);
  assert.match(cart, /function wymagaPotwierdzeniaIlosci/);
  assert.match(cart, /stan===null\|\|qty>stan/);
  assert.match(cart, /filter\(x=>wymagaPotwierdzeniaIlosci\(x\.id,x\.ilosc\)\)/);
});

test('potwierdzenie dostępności przez administratora wysyła klientowi osobny e-mail', () => {
  assert.match(`${emailBackend}\n${emailContent}`, /dostepnosc_potwierdzona/);
  assert.match(emailBackend, /stary\?\.wymagaPotwierdzeniaDostepnosci === true/);
  assert.match(emailBackend, /decyzjaDostepnosciNowa === 'confirmed'/);
  assert.match(emailContent, /Potwierdziliśmy dostępność zamówienia/);
});

test('SMTP wymusza TLS i wyrównany envelope, a e-maile transakcyjne nie mieszają promocji', () => {
  assert.match(emailBackend, /requireTLS: !c\.secure/);
  assert.match(emailBackend, /minVersion: 'TLSv1\.2'/);
  assert.match(emailBackend, /envelope: \{ from: c\.user, to \}/);
  assert.doesNotMatch(emailService.slice(emailService.indexOf('function wiadomoscKlientaZamowienie'), emailService.indexOf('function wiadomoscAdminZamowienie')), /domówić|kolejne produkty|okazje/i);
});

test('na stronie głównej katalogi działów są wyświetlane pod listą produktów', () => {
  assert.match(storefront, /\["hero","banery","produkty","kategorie"/);
  assert.match(storefront, /kategorieIndex<produktyIndex/);
});
