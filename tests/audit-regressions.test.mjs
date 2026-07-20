import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('awaryjny products.json zachowuje cały aktualny katalog bez danych prywatnych', () => {
  const products = JSON.parse(read('products.json'));
  assert.ok(Array.isArray(products));
  assert.ok(products.length >= 76);
  assert.equal(new Set(products.map((product) => String(product.id))).size, products.length);
  for (const product of products) {
    assert.ok(product.id !== undefined && product.id !== null);
    assert.ok(String(product.nazwa || '').trim());
    assert.ok(String(product.kategoria || '').trim());
    assert.ok(Number(product.cena) > 0);
    assert.equal('cenaZakupu' in product, false);
    assert.equal('cenaZakupuHistoria' in product, false);
  }
  assert.equal(products.some((product) => product.nazwa === 'Słuchawki bezprzewodowe Pro ANC'), false);
});

test('koszyk usuwa nieaktualne produkty i nie odczytuje nazwy z pustego wyniku', () => {
  const checkout = read('src/frontend/17-cart-and-checkout.js');
  assert.match(checkout, /const brakujace=koszyk\.filter/);
  assert.match(checkout, /koszyk=koszyk\.filter\(x=>produkty\.some/);
  assert.match(checkout, /return p\?`<div><span>\$\{esc\(p\.nazwa\)\}/);
  assert.match(checkout, /\}\)\.filter\(Boolean\);/);
});

test('ciężkie rejestry Allegro pozostają na serwerze zamiast w localStorage', () => {
  const cloud = read('src/frontend/03-cloud-sync.js');
  const allegro = read('assets/admin.js');
  assert.match(cloud, /KLUCZE_PRZESTARZALYCH_CACHE/);
  assert.match(cloud, /zwolnijPamiecPodreczna/);
  assert.doesNotMatch(allegro, /zapiszLS\("artway_allegro_oferty_cache"/);
  assert.doesNotMatch(allegro, /zapiszLS\("artway_allegro_komunikacja_cache"/);
  assert.match(allegro, /ALLEGRO_TRWALY_CACHE_KEY="allegro-offers-and-mappings-v2"/);
  assert.match(allegro, /chmuraRuntimeCacheZapisz\(ALLEGRO_TRWALY_CACHE_KEY/);
});

test('promocja ma jedno źródło prawdy i sklep posiada manifest', () => {
  const config = read('src/frontend/01-config-and-catalog.js');
  const storefront = read('src/frontend/06-router-and-storefront.js');
  const html = read('index.html');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.match(config, /function glownaPromocja\(/);
  assert.match(storefront, /promo=glownaPromocja\(\)/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.equal(manifest.short_name, 'Artway-TM');
  assert.ok(fs.existsSync(new URL('../icons/artway-icon.svg', import.meta.url)));
});

test('katalog produktów używa wersjonowanej pamięci IndexedDB i odrzuca uszkodzony plik', () => {
  const catalog = read('src/frontend/05-catalog-inventory.js');
  assert.match(catalog, /products\.json\?v=/);
  assert.match(catalog, /PRODUKTY_BAZOWE_CACHE_KEY="base-products-v2"/);
  assert.match(catalog, /cache:"no-cache"/);
  assert.match(catalog, /chmuraRuntimeCacheOdczytaj\(PRODUKTY_BAZOWE_CACHE_KEY\)/);
  assert.match(catalog, /new Set\(poprawne\.map/);
  assert.match(catalog, /unikalne\.size!==poprawne\.length/);
});

test('szablon GoDan wyłącznie dopisuje katalogi i nie usuwa produktów', () => {
  const categories = read('src/frontend/14-categories-and-mapping.js');
  const start = categories.indexOf('function przygotujKatalogImprezowyGoDan()');
  const end = categories.indexOf('\nfunction usunKatalog(', start);
  const template = categories.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(template, /Balony foliowe/);
  assert.match(template, /Dekoracje imprezowe/);
  assert.match(template, /wlasneKategorie:wlasne/);
  assert.doesNotMatch(template, /produkty(?:Dodane|Ukryte|Definitywne|Edytowane)\s*=/);
});
