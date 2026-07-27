import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  centralAllegroPreparationCurrent,
  centralAllegroPreparationFingerprint,
  centralCatalogApplyAuthority,
  centralCatalogBuildRecords,
  centralCatalogMissingFields,
  centralCatalogQueryOptions,
  createCentralProductCatalog,
} from '../src/backend/lib/domain/central-product-catalog.mjs';

test('przebudowa katalogu nie cofa pól zapisanych atomową mutacją serwera', () => {
  const staleBrowserSnapshot = {
    id: 17,
    nazwa: 'Stara nazwa z przeglądarki',
    cena: 20,
    allegroCategoryId: 'stara-kategoria',
    _catalog: { inventory: { stock: 2 } },
  };
  const currentServerRecord = {
    data: {
      id: 17,
      nazwa: 'Nazwa potwierdzona przez Agenta',
      cena: 24.9,
      allegroCategoryId: '257813',
      allegroAgentPreparationStatus: 'ready',
      _catalog: { inventory: { stock: 8 } },
    },
    fields: ['nazwa', 'cena', 'allegroCategoryId', 'allegroAgentPreparationStatus'],
  };
  const merged = centralCatalogApplyAuthority(staleBrowserSnapshot, currentServerRecord);
  assert.equal(merged.nazwa, 'Nazwa potwierdzona przez Agenta');
  assert.equal(merged.cena, 24.9);
  assert.equal(merged.allegroCategoryId, '257813');
  assert.equal(merged.allegroAgentPreparationStatus, 'ready');
  assert.equal(merged._catalog.inventory.stock, 2);
});

test('usunięcie pola pozostaje usunięte po przebudowie starszego snapshotu', () => {
  const merged = centralCatalogApplyAuthority(
    { id: 18, rabat: 15, nazwa: 'Produkt' },
    { data: { id: 18, nazwa: 'Produkt' }, fields: ['rabat'] },
  );
  assert.equal(Object.prototype.hasOwnProperty.call(merged, 'rabat'), false);
});

test('lekka kartoteka zachowuje serwerowe potwierdzenie przygotowania po odświeżeniu', () => {
  const prepared = {
    id: 17, nazwa: 'Gra', cena: 20, producent: 'Alexander', marka: 'Alexander',
    gtin: '5901234567890', ean: '5901234567890', kodProducenta: 'A-17',
    zdjecie: 'https://example.test/a.jpg', opisKrotki: 'Opis krótki',
    opis: 'Opis pełny', allegroDescription: 'Opis Allegro',
    allegroCategoryId: '123', allegroAgentPreparationStatus: 'ready',
    allegroAgentPreparationMissing: [], allegroAgentPreparationVersion: 4,
  };
  prepared.allegroAgentPreparationFingerprint = centralAllegroPreparationFingerprint(prepared);
  const [record] = centralCatalogBuildRecords({ artway_produkty_katalog: [prepared] });
  assert.equal(record.adminListData.allegroCategoryId, '123');
  assert.equal(record.adminListData.allegroAgentPreparationCurrent, true);
  assert.equal(record.adminListData._catalog.detailLevel, 'list');
  const reordered = { ...prepared, sourceEvidence: { z: 1, a: 2 } };
  const reorderedAgain = { ...prepared, sourceEvidence: { a: 2, z: 1 } };
  assert.equal(centralAllegroPreparationFingerprint(reordered), centralAllegroPreparationFingerprint(reorderedAgain));
  reordered.allegroAgentPreparationFingerprint = centralAllegroPreparationFingerprint(reordered);
  reordered.opis = 'Treść zmieniona po przygotowaniu';
  assert.equal(centralAllegroPreparationCurrent(reordered), false);
});

test('potwierdzony zapis v3 jest bezpiecznie widoczny do migracji na kanoniczny podpis v4', () => {
  const product = {
    allegroAgentPreparationStatus: 'ready',
    allegroAgentPreparationMissing: [],
    allegroAgentPreparationVersion: 3,
    allegroAgentPreparationFingerprint: 'allegro-preparation-v3-deadbeef',
    lastAdminMutationArea: 'allegro-preparation',
    lastAdminMutationId: 'allegro-preparation:17:run',
    lastAdminMutationFields: ['opis', 'allegroAgentPreparationFingerprint'],
  };
  assert.equal(centralAllegroPreparationCurrent(product), true);
  assert.equal(centralAllegroPreparationCurrent({ ...product, lastAdminMutationArea: 'manual-editor' }), false);
});

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

test('pojedyncza cena aktualizuje centralną kartotekę bez pełnej synchronizacji produktów', async () => {
  const calls = [], current = {
    data: { id: '17', nazwa: 'Gra', cena: 20, cenaZakupu: 8, opisKrotki: 'Opis krótki', opis: 'Opis pełny', ean: '5901234567890', zdjecie: 'https://example.test/a.jpg', producent: 'Alexander', kategoria: 'Gry', sourceUrl: 'https://example.test/p', _catalog: { availability: { saleAvailable: true } } },
    public_data: { id: '17', nazwa: 'Gra', cena: 20, dostepny: true, _catalog: { availability: { saleAvailable: true } } },
  };
  const client = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT data')) return { rowCount: 1, rows: [current] };
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  const pool = { query: async () => ({ rowCount: 0, rows: [] }), connect: async () => client };
  const catalog = createCentralProductCatalog({ pool, namespace: 'test' });
  const result = await catalog.patchProductFields('17', { cena: 24.9, cenaZakupu: 9.5 }, [], { sourceRevision: 'rev-price-2' });
  assert.equal(result.updated, true);
  const update = calls.find((entry) => entry.sql.startsWith('UPDATE artway_products SET'));
  const adminData = JSON.parse(update.params[2]), publicData = JSON.parse(update.params[3]);
  assert.equal(adminData.cena, 24.9);
  assert.equal(adminData.cenaZakupu, 9.5);
  assert.equal(publicData.cena, 24.9);
  assert.equal(publicData.cenaZakupu, undefined);
  assert.equal(update.params[16], 24.9);
  assert.ok(calls.some((entry) => entry.sql.startsWith('UPDATE artway_product_catalog_meta')));
});

test('wynik publikacji Allegro aktualizuje dane i indeks kanału w centralnej kartotece', async () => {
  const calls = [], current = {
    data: {
      id: '1000390', nazwa: 'Pamięć Farma - Multigra', cena: 22, producent: 'Multigra',
      kategoria: 'Gry', opisKrotki: 'Gra pamięciowa.', opis: 'Pełny opis.', ean: '5904492130113',
      zdjecie: 'https://example.test/a.jpg', sourceUrl: 'https://example.test/p',
      _catalog: { channels: { store: { active: true }, allegro: { offerId: '', status: '' } } },
    },
    public_data: { id: '1000390', nazwa: 'Pamięć Farma - Multigra', cena: 22, dostepny: true, _catalog: { channels: { store: { active: true } } } },
  };
  const client = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT data')) return { rowCount: 1, rows: [current] };
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  const pool = { query: async () => ({ rowCount: 0, rows: [] }), connect: async () => client };
  const catalog = createCentralProductCatalog({ pool, namespace: 'test' });
  const result = await catalog.patchProductFields('1000390', {
    allegroOfferId: '18793056852',
    allegroStatus: 'ACTIVE',
    allegroAgentPreparationStatus: 'published',
    allegroAgentPreparationMissing: [],
  }, [], { sourceRevision: 'rev-offer-1' });
  assert.equal(result.updated, true);
  const update = calls.find((entry) => entry.sql.startsWith('UPDATE artway_products SET'));
  const adminData = JSON.parse(update.params[2]), publicData = JSON.parse(update.params[3]);
  assert.equal(adminData.allegroOfferId, '18793056852');
  assert.equal(adminData._catalog.channels.allegro.offerId, '18793056852');
  assert.equal(adminData._catalog.channels.allegro.status, 'ACTIVE');
  assert.equal(publicData._catalog.channels.allegro.offerId, '18793056852');
  assert.equal(update.params[14], true);
  assert.equal(update.params[15], 'ACTIVE');
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
  assert.match(index, /ASORTYMENT_CACHE_MAX_MS=60\*60\*1000/);
  assert.match(index, /ASORTYMENT_CACHE_MAX_PRODUKTOW=6000/);
  assert.match(index, /asortymentCentralnyPobierz\(true,\{render:false\}\)/);
  const fetchBlock = index.slice(index.indexOf('async function asortymentCentralnyPobierz'), index.indexOf('function asortymentCentralnyWidok'));
  assert.doesNotMatch(fetchBlock, /zbudujProdukty\(\)|data\.stale.*renderuj/);
  assert.match(view, /Centralna kartoteka PostgreSQL/);
  assert.match(view, /centralData\?wszystkie:wszystkie\.slice/);
});

test('sklep publiczny używa tej samej centralnej paginacji i pobiera szczegół dopiero po wejściu', async () => {
  const [cloud, storefront, pull] = await Promise.all([
    readFile('src/frontend/03-cloud-sync.js', 'utf8'),
    readFile('src/frontend/06b-storefront-catalog.js', 'utf8'),
    readFile('src/backend/lib/domain/store-data-pull.mjs', 'utf8'),
  ]);
  assert.match(cloud, /catalogMode:trybAdmina\?"legacy":"central"/);
  assert.match(cloud, /chmuraKatalogCentralnyPubliczny/);
  assert.match(storefront, /sklepKatalogCentralnyPobierz/);
  assert.match(storefront, /product-catalog-item/);
  assert.match(pull, /PUBLIC_CENTRAL_CATALOG_KEYS/);
  assert.match(pull, /catalog_central: centralCatalogMode/);
});
