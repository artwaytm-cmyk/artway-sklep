import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  centralCatalogBuildRecords,
  centralCatalogMissingFields,
  centralCatalogQueryOptions,
} from '../src/backend/lib/domain/central-product-catalog.mjs';

test('centralna kartoteka scala produkt, magazyn, dostępność i Allegro pod jednym ID', () => {
  const data = {
    artway_produkty_katalog: [{ id: 17, nazwa: 'Balon serce', cena: 12.5, cenaZakupu: 5, kategoria: 'Balony serca', producent: 'GoDan', ean: '5901234567890', zdjecie: 'https://example.test/a.jpg', opisKrotki: 'Krótki opis produktu.', opis: '<p>Pełny opis produktu.</p>', sourceUrl: 'https://example.test/product' }],
    artway_produkty_edytowane: { 17: { cena: 13.5, externalId: 'GOD-17' } },
    artway_stany: { 17: 8 },
    artway_dostepnosc: { 17: { status: 'dostepny', source: 'manual' } },
    artway_magazyn_produkty: { 17: { lokalizacja: 'Pakownia / Regał A / Półka 3' } },
  };
  const records = centralCatalogBuildRecords(data, {
    sourceRevision: 'rev-4',
    offers: [{ id: '18766199964', status: 'ACTIVE' }],
    mappings: { 18766199964: { productId: '17' } },
  });
  assert.equal(records.length, 1);
  const record = records[0];
  assert.equal(record.id, '17');
  assert.equal(record.data.cena, 13.5);
  assert.equal(record.data.cenaZakupu, 5);
  assert.equal(record.data._catalog.inventory.stock, 8);
  assert.equal(record.data._catalog.inventory.lokalizacja, 'Pakownia / Regał A / Półka 3');
  assert.equal(record.data._catalog.channels.allegro.offerId, '18766199964');
  assert.equal(record.publicData.cenaZakupu, undefined);
  assert.equal(record.adminListData.cenaZakupu, 5);
  assert.equal(record.adminListData.opis, undefined);
  assert.equal(record.publicListData.cenaZakupu, undefined);
  assert.equal(record.publicListData.opis, undefined);
  assert.equal(record.publicData._catalog.inventory, undefined);
  assert.equal(record.hasAllegro, true);
});

test('kartoteka przechowuje kompletność, źródło i stan sprzedaży bez ujawniania prywatnych danych', () => {
  const [record] = centralCatalogBuildRecords({
    artway_produkty_dodane: [{ id: 5, nazwa: 'Produkt', cena: 10, cenaZakupu: 3 }],
    artway_dostepnosc: { 5: { status: 'niedostepny', powod: 'brak u producenta' } },
  });
  assert.equal(record.source, 'dodany');
  assert.equal(record.saleAvailable, false);
  assert.ok(record.missingFields.includes('ean'));
  assert.ok(record.missingFields.includes('koszt') === false);
  assert.equal(record.publicData.cenaZakupu, undefined);
  assert.deepEqual(centralCatalogMissingFields({ nazwa: 'X', cena: 2 }).sort(), ['ean', 'kategoria', 'koszt', 'opis', 'producent', 'zdjecie', 'zrodlo'].sort());
});

test('zapytanie centralnego katalogu ogranicza stronę i dopuszcza tylko bezpieczne sortowania', () => {
  const query = centralCatalogQueryOptions({ q: '  ŁĄKA  ', page: -8, limit: 50000, sort: 'DROP TABLE', priceMin: '12,50' });
  assert.equal(query.query, 'laka');
  assert.equal(query.page, 1);
  assert.equal(query.limit, 1000);
  assert.equal(query.sort, 'external');
  assert.equal(query.priceMin, 12.5);
  const empty = centralCatalogQueryOptions({ priceMin: null, priceMax: '', allegroPriceMin: undefined });
  assert.equal(empty.priceMin, null);
  assert.equal(empty.priceMax, null);
  assert.equal(empty.allegroPriceMin, null);
});

test('publiczny katalog obsługuje gałęzie, wybrane produkty, nowości i oceny bez pobierania całej listy', () => {
  const query = centralCatalogQueryOptions({ categories: 'Gry,Gry edukacyjne', ids: '10,11', special: 'nowosci', minRating: '4,5', sort: 'ocena' });
  assert.deepEqual(query.categories, ['Gry', 'Gry edukacyjne']);
  assert.deepEqual(query.ids, ['10', '11']);
  assert.equal(query.special, 'nowosci');
  assert.equal(query.minRating, 4.5);
  assert.equal(query.sort, 'ocena');
  const [record] = centralCatalogBuildRecords({
    artway_produkty_katalog: [{ id: 10, nazwa: 'Gra', cena: 20, badge: 'Nowość' }],
    artway_opinie: [{ produktId: 10, status: 'zatwierdzona', ocena: 5 }, { produktId: 10, status: 'oczekuje', ocena: 1 }],
  });
  assert.equal(record.newProduct, true);
  assert.equal(record.rating, 5);
  assert.equal(record.ratingCount, 1);
});

test('backend udostępnia stronicowaną kartotekę, pojedynczy produkt, synchronizację i status', async () => {
  const source = await readFile('src/backend/lib/store-app.mjs', 'utf8');
  const route = await readFile('src/backend/lib/central-product-catalog-route.mjs', 'utf8');
  for (const action of ['product-catalog-query', 'product-catalog-item', 'product-catalog-sync', 'product-catalog-status']) assert.match(route, new RegExp(action));
  assert.match(source, /createCentralProductCatalog/);
  assert.match(source, /createCentralProductCatalogRoute/);
  assert.match(source, /synchronizeCentralProductCatalog/);
  assert.match(source, /centralProductCatalogRevisionState/);
  assert.match(source, /repository\.revisionToken/);
  assert.match(route, /Promise\.all\(\[catalog\.metadata\(\), revisionState\(\)\]\)/);
});

test('Asortyment korzysta z paginacji serwerowej i zachowuje tryb awaryjny', async () => {
  const index = await readFile('src/frontend/12-assortment-index.js', 'utf8');
  const view = await readFile('assets/admin.js', 'utf8');
  assert.match(index, /chmura\("product-catalog-query"/);
  assert.match(index, /asortymentCentralnyCache/);
  assert.match(index, /asortymentCentralnyWylaczonyDo/);
  assert.match(view, /Centralna kartoteka PostgreSQL/);
  assert.match(view, /centralData\?wszystkie:wszystkie\.slice/);
});

test('sklep publiczny używa tej samej centralnej paginacji i pobiera szczegół dopiero po wejściu', async () => {
  const [cloud, storefront, route] = await Promise.all([
    readFile('src/frontend/03-cloud-sync.js', 'utf8'),
    readFile('src/frontend/06b-storefront-catalog.js', 'utf8'),
    readFile('src/backend/lib/store-data-route.mjs', 'utf8'),
  ]);
  assert.match(cloud, /catalogMode:trybAdmina\?"legacy":"central"/);
  assert.match(cloud, /chmuraKatalogCentralnyPubliczny/);
  assert.match(storefront, /sklepKatalogCentralnyPobierz/);
  assert.match(storefront, /product-catalog-item/);
  assert.match(route, /PUBLIC_CENTRAL_CATALOG_KEYS/);
  assert.match(route, /catalog_central: centralCatalogMode/);
});
