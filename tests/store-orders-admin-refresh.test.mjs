import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('panel pobiera zamówienia gości z dedykowanej lekkiej kolejki', async () => {
  const [route, sync, router] = await Promise.all([
    readFile('netlify/functions/lib/store-data-route.mjs', 'utf8'),
    readFile('src/frontend/07b-shipping-integrations.js', 'utf8'),
    readFile('src/frontend/06-router-and-storefront.js', 'utf8'),
  ]);
  assert.match(route, /action === 'store-orders-admin'/);
  assert.match(route, /filtrujNieusunieteZamowienia\(ordersVersioned\.value\?\.items \|\| \[\], deletedOrders\)/);
  assert.doesNotMatch(route.slice(route.indexOf("action === 'store-orders-admin'"), route.indexOf('// ─── ZAPIS USTAWIEŃ')), /email|accountId|sessionOwns/);
  assert.match(sync, /chmura\("store-orders-admin"/);
  assert.match(sync, /setInterval\(\(\)=>\{if\(trasa\(\)==="\/admin\/zamowienia"/);
  assert.match(router, /odswiezZamowieniaAdminaPoWejsciu/);
});

test('automatyczna synchronizacja nie scala localStorage z serwerem', async () => {
  const [route, sync] = await Promise.all([
    readFile('netlify/functions/lib/store-data-route.mjs', 'utf8'),
    readFile('src/frontend/07b-shipping-integrations.js', 'utf8'),
  ]);
  const compatibility = route.slice(route.indexOf("action === 'store-sync'"), route.indexOf('// ─── ADMIN: zapis'));
  assert.match(compatibility, /server_authoritative: true/);
  assert.doesNotMatch(compatibility, /przychodzace|przychodzacy|body\.orders|body\.users/);
  const centralSync = sync.slice(sync.indexOf('async function synchronizujBazeCentralna'), sync.indexOf('async function odswiezZamowieniaAdminaPoWejsciu'));
  assert.match(centralSync, /chmuraWczytajStan/);
  assert.doesNotMatch(centralSync, /store-sync|body:\{orders/);
  const userMerge = sync.slice(sync.indexOf('function polaczUzytkownikowCentralnych'), sync.indexOf('let zamowieniaAdminOdswiezenie'));
  assert.doesNotMatch(userMerge, /pobierzUzytkownikow|wynik\.push/);
});
