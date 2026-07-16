import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportedProductCatalog } from '../netlify/functions/lib/domain/imported-product-catalog.mjs';
import { createProductLinkImportService } from '../netlify/functions/lib/domain/product-link-import.mjs';
import { createProductLinkImportPreparer } from '../netlify/functions/lib/domain/product-link-import-preparation.mjs';
import { createProductLinkImportBundle } from '../netlify/functions/lib/product-link-import-route.mjs';

function repository() {
  const values = new Map(), versions = new Map(), reads = new Map();
  return {
    async read(key, fallback) {
      reads.set(key, (reads.get(key) || 0) + 1);
      return values.has(key) ? structuredClone(values.get(key)) : structuredClone(fallback);
    },
    async readVersioned(key, fallback) {
      reads.set(key, (reads.get(key) || 0) + 1);
      return {
        value: values.has(key) ? structuredClone(values.get(key)) : structuredClone(fallback),
        etag: values.has(key) ? `v${versions.get(key)}` : '',
        exists: values.has(key),
      };
    },
    async writeIfVersion(key, next, expected) {
      const exists = values.has(key), version = versions.get(key) || 0;
      if (expected.exists === false && exists) return { modified: false };
      if (expected.exists !== false && (!exists || expected.etag !== `v${version}`)) return { modified: false };
      values.set(key, structuredClone(next));
      versions.set(key, version + 1);
      return { modified: true };
    },
    keys: () => [...values.keys()],
    resetReadCounts: () => reads.clear(),
    readCount: (prefix = '') => [...reads.entries()].filter(([key]) => key.startsWith(prefix)).reduce((sum, [, count]) => sum + count, 0),
    readKeys: (prefix = '') => [...reads.keys()].filter((key) => key.startsWith(prefix)),
  };
}

const url = (id) => `https://www.sklep.alexander.com.pl/product-pol-${id}-Produkt-${id}.html`;
const product = (id, patch = {}) => ({
  nazwa: `Produkt ${id}`,
  producent: 'Alexander',
  kodProducenta: `A-${id}`,
  ean: id === 1 ? '5906018003796' : '',
  sourceUrl: url(id),
  cena: 20 + id,
  ...patch,
});

function harness(prepareProduct, { uuids = ['job-1', 'lease-1', 'lease-2', 'lease-3', 'lease-4', 'lease-5'] } = {}) {
  const repo = repository();
  const catalog = createImportedProductCatalog({
    read: repo.read,
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
  });
  let uuidIndex = 0;
  const service = createProductLinkImportService({
    read: repo.read,
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    catalog,
    prepareProduct,
    now: () => new Date('2026-07-15T10:00:00.000Z'),
    randomUUID: () => uuids[uuidIndex++] || `uuid-${uuidIndex}`,
  });
  return { repo, catalog, service };
}

test('processNext zapisuje dokładnie jeden produkt od razu, zanim przejdzie do następnego linku', async () => {
  const prepared = [];
  const { catalog, service } = harness(async (sourceUrl) => {
    const id = Number(sourceUrl.match(/product-pol-(\d+)/)?.[1]);
    prepared.push(id);
    return { product: product(id) };
  });
  const created = await service.create({
    fileName: 'Alexander_produkty_linki.xlsx',
    createdBy: 'admin@example.test',
    rows: [{ rowNumber: 2, name: 'Pierwszy', url: url(1) }, { rowNumber: 3, name: 'Drugi', url: url(2) }, { rowNumber: 4, name: 'Trzeci', url: url(3) }],
  });
  assert.equal(created.summary.queued, 3);
  assert.equal((await catalog.list()).length, 0);

  const first = await service.processNext(created.job.id);
  assert.equal(Object.hasOwn(first, 'items'), false, 'processNext ma zwracać lekki delta-response bez pełnej listy pozycji');
  assert.equal(first.processedItem.status, 'added');
  assert.deepEqual(prepared, [1]);
  assert.equal((await catalog.list()).length, 1);
  assert.equal(first.summary.added, 1);
  assert.equal(first.summary.queued, 2);

  const second = await service.processNext(created.job.id);
  assert.equal(second.processedItem.status, 'added');
  assert.deepEqual(prepared, [1, 2]);
  assert.equal((await catalog.list()).length, 2);
  assert.equal(second.summary.queued, 1);

  const third = await service.processNext(created.job.id);
  assert.equal(Object.hasOwn(third, 'items'), false);
  assert.equal(third.processedItem.status, 'added');
  assert.equal(third.done, true);
  assert.equal(third.job.state, 'completed');
  const finalStatus = await service.status(created.job.id);
  assert.equal(finalStatus.items.length, 3, 'pełna lista pozostaje dostępna wyłącznie przez status()');
  assert.equal(finalStatus.summary.added, 3);
  assert.equal(finalStatus.job.state, 'completed');
  const stored = await catalog.list();
  assert.equal(stored.length, 3);
  assert.deepEqual(stored.map((entry) => entry.id), [1_000_000, 1_000_001, 1_000_002]);
  assert.ok(stored.every((entry) => entry.stock === 0 && entry.stan === 0));
  assert.ok(stored.every((entry) => entry.storageOrigin === 'product-link-file-import'));
  assert.ok(stored.every((entry) => entry.agentOnboardingStatus === 'needs_attention'));
});

test('jedna kolejka przyjmuje linki różnych producentów i zachowuje ich oddzielne źródła', async () => {
  const multigraUrl = 'https://multigra.com.pl/produkt/gra-rodzinna?utm_source=plik';
  const godanUrl = 'http://www.godanparty.pl/pl/p/Balony-zestaw/123?variant=gold';
  const { service } = harness(async () => ({ product: product(1) }));
  const created = await service.create({ rows: [
    { rowNumber: 2, name: 'Gra Multigra', url: multigraUrl },
    { rowNumber: 3, name: 'Balony GoDan', url: godanUrl },
  ] });

  assert.equal(created.summary.queued, 2);
  assert.deepEqual(created.items.map((item) => item.url), [
    'https://multigra.com.pl/produkt/gra-rodzinna',
    'https://www.godanparty.pl/pl/p/Balony-zestaw/123?variant=gold',
  ]);
});

test('serwer odrzuca lokalne i techniczne adresy zamiast pobierać je jako produkty', async () => {
  const { service } = harness(async () => ({ product: product(1) }));
  await assert.rejects(
    service.create({ rows: ['http://127.0.0.1/produkt/1'] }),
    (error) => error?.code === 'product_link_import_source_not_allowed',
  );
  await assert.rejects(
    service.create({ rows: ['https://magazyn.internal/produkt/1'] }),
    (error) => error?.code === 'product_link_import_source_not_allowed',
  );
});

test('przygotowanie produktu zachowuje rozpoznanego producenta i nie wpisuje Alexander jako wartości zastępczej', async () => {
  const prepare = createProductLinkImportPreparer({
    readSettings: async () => ({ data: {} }),
    catalog: { findDuplicate: async () => null, list: async () => [] },
    centralProducts: () => new Map(),
    inspect: async (sourceUrl) => ({
      canonicalUrl: sourceUrl,
      confidence: 92,
      product: { nazwa: 'Balony metaliczne', cena: 12.5, producent: 'GoDan', marka: 'GoDan', opis: 'Zestaw dekoracyjnych balonów.', sourceUrl },
    }),
    offerSettings: async () => ({ producers: ['Alexander', 'Multigra', 'GoDan'] }),
    recognizeProducer: (entry) => entry.producent || entry.marka || '',
    chooseCategory: () => ({ name: 'Balony i dekoracje' }),
    shortDescription: (value) => value,
    text: (value, max = 1000) => String(value ?? '').trim().slice(0, max),
    now: () => new Date('2026-07-16T12:00:00.000Z'),
  });
  const result = await prepare('https://www.godanparty.pl/pl/p/Balony-metaliczne/123');
  assert.equal(result.needsReview, undefined);
  assert.equal(result.product.producent, 'GoDan');
  assert.equal(result.product.marka, 'GoDan');
});

test('nierozpoznany producent trafia do kontroli zamiast otrzymać błędną markę Alexander', async () => {
  const prepare = createProductLinkImportPreparer({
    readSettings: async () => ({ data: {} }),
    catalog: { findDuplicate: async () => null, list: async () => [] },
    centralProducts: () => new Map(),
    inspect: async (sourceUrl) => ({ product: { nazwa: 'Nowy produkt', cena: 19, opis: 'Pełny opis produktu.', sourceUrl }, canonicalUrl: sourceUrl, confidence: 80 }),
    offerSettings: async () => ({}),
    recognizeProducer: () => '',
    chooseCategory: () => ({ name: 'Pozostałe' }),
    shortDescription: (value) => value,
    text: (value, max = 1000) => String(value ?? '').trim().slice(0, max),
  });
  const result = await prepare('https://producent-zabawek.pl/produkt/nowy-produkt');
  assert.equal(result.needsReview, true);
  assert.match(result.reviewReason, /producenta lub marki/i);
  assert.notEqual(result.product.producent, 'Alexander');
});

test('processNext nie odczytuje wszystkich shardów kolejki i zwraca tylko zmianę jednego wiersza', async () => {
  const { repo, service } = harness(async (sourceUrl) => ({ product: product(Number(sourceUrl.match(/product-pol-(\d+)/)?.[1])) }));
  const rows = Array.from({ length: 201 }, (_, index) => url(index + 1));
  const created = await service.create({ rows });
  repo.resetReadCounts();
  const result = await service.processNext(created.job.id);
  assert.equal(Object.hasOwn(result, 'items'), false);
  assert.equal(result.processedItem.status, 'added');
  assert.equal(result.summary.added, 1);
  assert.equal(result.summary.queued, 200);
  assert.equal(repo.readKeys('product-link-import:items:v1:').length, 1, 'przetworzenie pierwszego linku ma dotknąć tylko jego shardu kolejki');
  assert.equal(repo.readCount('product-link-import:items:v1:'), 2, 'ten sam shard jest czytany wyłącznie przy zajęciu i zakończeniu pozycji');
  for (let index = 1; index < 101; index += 1) await service.processNext(created.job.id);
  repo.resetReadCounts();
  const afterFirstShard = await service.processNext(created.job.id);
  assert.equal(afterFirstShard.processedItem.status, 'added');
  assert.equal(repo.readKeys('product-link-import:items:v1:').length, 1, 'kursor ma pozostać na aktywnym shardzie zamiast ponownie skanować wcześniejsze');
});

test('pewny duplikat jest pomijany, a podobna nazwa bez identycznego producenta nie blokuje importu', async () => {
  const { catalog, service } = harness(async (sourceUrl) => {
    const id = sourceUrl.includes('0002') ? 2 : 1;
    return { product: product(id, id === 2 ? { nazwa: 'Produkt 1 edycja', producent: 'Inny producent', sourceUrl } : { sourceUrl }) };
  });
  await catalog.add(product(99, { nazwa: 'Istniejący', sourceUrl: url(1) }), { sourceUrl: url(1), importItemKey: 'seed' });
  const created = await service.create({ rows: [url(1), url('0002')] });

  const duplicate = await service.processNext(created.job.id);
  assert.equal(duplicate.processedItem.status, 'skipped_existing');
  assert.equal(duplicate.processedItem.duplicateProductId, 1_000_000);
  const distinct = await service.processNext(created.job.id);
  assert.equal(distinct.processedItem.status, 'added');
  assert.equal((await catalog.list()).length, 2);
});

test('pauza, wznowienie i anulowanie sterują kolejką bez cofania już zapisanych produktów', async () => {
  const { catalog, service } = harness(async (sourceUrl) => ({ product: product(Number(sourceUrl.match(/product-pol-(\d+)/)?.[1])) }));
  const created = await service.create({ rows: [url(1), url(2), url(3)] });
  const paused = await service.pause(created.job.id);
  assert.equal(paused.job.state, 'paused');
  const whilePaused = await service.processNext(created.job.id);
  assert.equal(whilePaused.processedItem, null);
  assert.equal((await catalog.list()).length, 0);

  await service.resume(created.job.id);
  const first = await service.processNext(created.job.id);
  assert.equal(first.processedItem.status, 'added');
  const cancelled = await service.cancel(created.job.id);
  assert.equal(cancelled.job.state, 'cancelled');
  assert.equal(cancelled.summary.added, 1);
  assert.equal(cancelled.summary.cancelled, 2);
  assert.equal((await catalog.list()).length, 1);
  const afterCancel = await service.processNext(created.job.id);
  assert.equal(afterCancel.processedItem, null);
  assert.equal((await catalog.list()).length, 1);
});

test('błąd jednego linku nie zatrzymuje następnego, a retryFailures ponawia wyłącznie błędy', async () => {
  let firstAttempts = 0;
  const { catalog, service } = harness(async (sourceUrl) => {
    if (sourceUrl === url(1) && firstAttempts++ === 0) throw Object.assign(new Error('Producent chwilowo nie odpowiada.'), { code: 'source_timeout' });
    const id = Number(sourceUrl.match(/product-pol-(\d+)/)?.[1]);
    return { product: product(id) };
  });
  const created = await service.create({ rows: [url(1), url(2)] });
  const failed = await service.processNext(created.job.id);
  assert.equal(failed.processedItem.status, 'failed');
  assert.equal(failed.summary.queued, 1);
  const continued = await service.processNext(created.job.id);
  assert.equal(continued.processedItem.status, 'added');
  assert.equal((await catalog.list()).length, 1);

  const retried = await service.retryFailures(created.job.id);
  assert.equal(retried.retried, 1);
  assert.equal(retried.summary.queued, 1);
  const recovered = await service.processNext(created.job.id);
  assert.equal(recovered.processedItem.status, 'added');
  assert.equal(recovered.job.state, 'completed');
  assert.equal((await catalog.list()).length, 2);
});

test('create jest idempotentne dla tego samego zestawu linków i nie tworzy drugich shardów', async () => {
  const { repo, service } = harness(async () => ({ product: product(1) }));
  const request = { fileName: 'pierwsza-nazwa.xlsx', rows: [{ rowNumber: 2, url: url(1) }, { rowNumber: 3, url: url(2) }] };
  const first = await service.create(request);
  const second = await service.create({ ...request, fileName: 'ponowiona-nazwa.xlsx' });
  assert.equal(second.job.id, first.job.id);
  assert.equal(second.duplicate, true);
  assert.equal(second.items.length, 2);
  assert.equal(repo.keys().filter((key) => key.includes('product-link-import:items')).length, 1);
});

test('needsReview zapisuje bezpieczny szkic do decyzji, ale nigdy danych pomocniczych extraProducts', async () => {
  const { catalog, service } = harness(async () => ({
    needsReview: true,
    reviewReason: 'Znaleziono dwa warianty produktu.',
    product: product(1),
    extraProducts: [{ secret: 'nie zapisuj' }],
  }));
  const created = await service.create({ rows: [url(1)] });
  const result = await service.processNext(created.job.id);
  assert.equal(result.processedItem.status, 'needs_review');
  assert.match(result.processedItem.reason, /dwa warianty/i);
  assert.equal(JSON.stringify(result).includes('nie zapisuj'), false);
  assert.equal(result.processedItem.reviewDraft.nazwa, 'Produkt 1');
  assert.equal(result.processedItem.reviewDraft.cena, 21);
  assert.ok(Array.isArray(result.processedItem.missingFields));
  assert.equal((await catalog.list()).length, 0);
});

test('administrator uzupełnia brakującą cenę i dodaje produkt bez ponownego importu pliku', async () => {
  const { catalog, service } = harness(async (sourceUrl) => ({
    needsReview: true,
    reviewReason: 'Nie udało się pewnie ustalić: ceny sprzedaży.',
    product: product(1, { cena: 0, kategoria: 'Gry edukacyjne', sourceUrl }),
    extraProducts: [],
  }));
  const created = await service.create({ rows: [url(1)] });
  const reviewed = await service.processNext(created.job.id);
  assert.equal(reviewed.processedItem.status, 'needs_review');
  assert.equal(reviewed.processedItem.reviewDraft.cena, 0);
  assert.deepEqual(reviewed.processedItem.missingFields, ['cena sprzedaży']);

  const resolved = await service.resolveReviews({
    jobId: created.job.id,
    items: [{ itemId: reviewed.processedItem.id, patch: { cena: '29,90' } }],
    actor: 'admin@example.test',
  });
  assert.equal(resolved.resolved, 1);
  assert.equal(resolved.stillNeedsReview, 0);
  assert.equal(resolved.items[0].status, 'added');
  const [saved] = await catalog.list();
  assert.equal(saved.cena, 29.9);
  assert.equal(saved.nazwa, 'Produkt 1');
  assert.equal(Object.hasOwn(saved, 'reviewResolvedBy'), false, 'dane administratora nie trafiają do kartoteki produktu');
});

test('operacja masowa uzupełnia wspólne braki, zachowując indywidualne nazwy i kody', async () => {
  const { catalog, service } = harness(async (sourceUrl) => {
    const id = Number(sourceUrl.match(/product-pol-(\d+)/)?.[1]);
    return { needsReview: true, reviewReason: 'Brak ceny.', product: product(id, { cena: 0, kategoria: '', sourceUrl }) };
  });
  const created = await service.create({ rows: [url(1), url(2)] });
  const first = await service.processNext(created.job.id), second = await service.processNext(created.job.id);
  const resolved = await service.resolveReviews({
    jobId: created.job.id,
    items: [{ itemId: first.processedItem.id }, { itemId: second.processedItem.id }],
    commonPatch: { cena: 34.5, kategoria: 'Gry rodzinne', ikona: '🎲' },
    actor: 'admin@example.test',
  });
  assert.equal(resolved.resolved, 2);
  assert.equal(resolved.summary.needs_review, 0);
  const products = await catalog.list();
  assert.deepEqual(products.map((entry) => entry.nazwa), ['Produkt 1', 'Produkt 2']);
  assert.ok(products.every((entry) => entry.cena === 34.5 && entry.kategoria === 'Gry rodzinne'));
});

test('niepełna decyzja pozostaje w kolejce i zachowuje już wpisaną wartość', async () => {
  const { catalog, service } = harness(async (sourceUrl) => ({
    needsReview: true,
    product: product(1, { cena: 0, producent: '', marka: '', kategoria: 'Gry', sourceUrl }),
  }));
  const created = await service.create({ rows: [url(1)] }), reviewed = await service.processNext(created.job.id);
  const unresolved = await service.resolveReviews({
    jobId: created.job.id,
    items: [{ itemId: reviewed.processedItem.id, patch: { cena: 25 } }],
  });
  assert.equal(unresolved.resolved, 0);
  assert.equal(unresolved.stillNeedsReview, 1);
  assert.equal(unresolved.items[0].status, 'needs_review');
  assert.equal(unresolved.items[0].reviewDraft.cena, 25);
  assert.match(unresolved.items[0].reason, /producent/i);
  assert.equal((await catalog.list()).length, 0);
});

test('katalog jest idempotentny po kluczu pozycji i dzieli pełne dane na shardy po 50 produktów', async () => {
  const repo = repository();
  const catalog = createImportedProductCatalog({ read: repo.read, readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion });
  const first = await catalog.add(product(1), { sourceUrl: url(1), importItemKey: 'job:1' });
  const repeated = await catalog.add(product(1), { sourceUrl: url(1), importItemKey: 'job:1' });
  assert.equal(first.added, true);
  assert.equal(repeated.idempotent, true);
  assert.equal(repeated.product.id, first.product.id);
  for (let id = 2; id <= 51; id += 1) await catalog.add(product(id), { sourceUrl: url(id), importItemKey: `job:${id}` });
  assert.equal((await catalog.list()).length, 51);
  assert.equal(repo.keys().filter((key) => key.includes('imported-product-catalog:shard')).length, 2);
  const firstPage = await catalog.page({ offset: 0, limit: 50 });
  const secondPage = await catalog.page({ offset: 50, limit: 50 });
  assert.equal(firstPage.products.length, 50);
  assert.equal(firstPage.nextOffset, 50);
  assert.equal(secondPage.products.length, 1);
  assert.equal(secondPage.nextOffset, null);
  assert.equal(firstPage.revision, secondPage.revision);
});

test('identyczna nazwa i producent nie blokują dwóch różnych produktów bez wspólnych kodów', async () => {
  const repo = repository();
  const catalog = createImportedProductCatalog({ read: repo.read, readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion });
  const first = await catalog.add(product(38, { nazwa: 'Bierki', kodProducenta: '038', ean: '' }), { sourceUrl: url(38), importItemKey: 'bierki:38' });
  const second = await catalog.add(product(1759, { nazwa: 'Bierki', kodProducenta: '1759', ean: '' }), { sourceUrl: url(1759), importItemKey: 'bierki:1759' });
  assert.equal(first.added, true);
  assert.equal(second.added, true);
  assert.equal((await catalog.list()).length, 2);
});

test('katalog importowany jest dołączany do checkoutu, a publiczny odczyt usuwa dane administracyjne', async () => {
  const repo = repository();
  const bundle = createProductLinkImportBundle({
    read: repo.read,
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    sanitize: (entry) => {
      const safe = { ...entry };
      delete safe.cenaZakupu;
      return safe;
    },
    preparation: {
      readSettings: async () => ({ data: {} }),
      centralProducts: () => new Map(),
      inspect: async () => ({ product: {} }),
      offerSettings: async () => ({}),
      recognizeProducer: () => 'Alexander',
      chooseCategory: () => ({ name: 'Gry' }),
      shortDescription: () => '',
      text: (value, max = 1000) => String(value ?? '').slice(0, max),
    },
    route: {
      isAdmin: () => false,
      respond: (body) => body,
      sessionOf: () => null,
      text: (value, max = 1000) => String(value ?? '').slice(0, max),
    },
  });
  const saved = await bundle.catalog.add(product(77, { cenaZakupu: 9.5, createdBy: 'admin@example.test' }), {
    sourceUrl: url(77),
    importItemKey: 'job:77',
  });
  const settings = await bundle.mergeSettings({ artway_produkty_dodane: [{ id: 42, nazwa: 'Produkt ręczny' }] });
  assert.deepEqual(settings.artway_produkty_dodane.map((entry) => entry.id), [42, saved.product.id]);

  const payload = await bundle.payload({ requestedRev: '', admin: false });
  assert.equal(payload.imported_catalog_count, 1);
  assert.equal('imported_products' in payload, false, 'pull zwraca tylko lekki manifest, nie cały katalog');
  const page = await bundle.route(
    { method: 'GET' },
    new URL('https://example.test/.netlify/functions/store?action=product-link-import-catalog&offset=0&limit=50'),
    'product-link-import-catalog',
  );
  assert.equal(page.products.length, 1);
  assert.equal(page.products[0].id, saved.product.id);
  assert.equal('cenaZakupu' in page.products[0], false);
  assert.equal('createdBy' in page.products[0], false);
  assert.equal('importItemKey' in page.products[0], false);
});
