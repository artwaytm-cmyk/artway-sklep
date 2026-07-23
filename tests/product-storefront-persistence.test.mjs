import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('aktualizacja lub brak u producenta nie usuwa karty produktu ze sklepu', async () => {
  const [catalog, view, seoRenderer] = await Promise.all([
    readFile('src/frontend/05-catalog-inventory.js', 'utf8'),
    readFile('src/frontend/06b-storefront-catalog.js', 'utf8'),
    readFile('src/backend/lib/domain/storefront-seo-renderer.mjs', 'utf8'),
  ]);
  const builder = catalog.slice(catalog.indexOf('function zbudujProdukty()'), catalog.indexOf('function podpisPublikacjiProduktu'));
  assert.doesNotMatch(builder, /filter\s*\(\s*p\s*=>\s*!produktOznaczonyNiedostepny/);
  assert.match(builder, /Brak u producenta wstrzymuje zakup, ale nie usuwa karty/);
  assert.match(view, /const p = produktSklepuPoId\(id\)/);
  assert.match(seoRenderer, /__saleUnavailable: seoProductUnavailable/);
  assert.match(seoRenderer, /OutOfStock/);
  assert.match(seoRenderer, /karta i adres pozostają aktywne/);
});

test('niedostępny produkt zachowuje adres, ale nie trafia na publiczne listy sprzedażowe', async () => {
  const [inventory, home, listing] = await Promise.all([
    readFile('src/frontend/05a-inventory-core.js', 'utf8'),
    readFile('src/frontend/06a-storefront-home.js', 'utf8'),
    readFile('src/frontend/06b-storefront-catalog.js', 'utf8'),
  ]);
  assert.match(inventory, /function produktWidocznyWPublicznymKatalogu/);
  assert.match(inventory, /produktDostepnyWSprzedazy\(p\)/);
  assert.match(home, /publiczneProdukty=produkty\.filter\(produktWidocznyWPublicznymKatalogu\)/);
  assert.match(listing, /if\(!produktWidocznyWPublicznymKatalogu\(p\)\)return false/);
  assert.match(listing, /produktWidocznyWPublicznymKatalogu\(p\)&&galaz\.has/);
});

test('stary adres po połączeniu duplikatów prowadzi do zachowanej kartoteki', async () => {
  const catalog = await readFile('src/frontend/05-catalog-inventory.js', 'utf8');
  const lookup = catalog.slice(catalog.indexOf('function produktSklepuPoId'), catalog.indexOf('function zbudujProdukty'));
  assert.match(lookup, /audytDuplikatowSklepu\(\)\.grupy/);
  assert.match(lookup, /grupa\.canonical\.id/);
});

test('mapa strony zachowuje adres, a feed oznacza brak zamiast usuwać produkt', async () => {
  const [sitemap, feed] = await Promise.all([
    readFile('src/backend/sitemap.mjs', 'utf8'),
    readFile('src/backend/google-products.mjs', 'utf8'),
  ]);
  assert.doesNotMatch(sitemap, /!seoProductUnavailable/);
  assert.match(feed, /productIsUnavailable\(product, availability\) \? 'out_of_stock' : 'in_stock'/);
  const eligibility = feed.slice(feed.indexOf('if (hidden.has'), feed.indexOf('const brand'));
  assert.doesNotMatch(eligibility, /productIsUnavailable/);
});
