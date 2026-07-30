import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SETTINGS_DOMAIN_CONFIGS } from '../src/backend/lib/core/normalized-domain-repository.mjs';
import { createStoreDataRoute } from '../src/backend/lib/store-data-route.mjs';

const LEGACY_PRODUCT_KEYS = [
  'artway_produkty_dodane',
  'artway_produkty_edytowane',
  'artway_produkty_katalog',
  'artway_produkty_ukryte',
  'artway_produkty_definitywne',
  'artway_kosz_dodane',
  'artway_kosz_meta',
];

test('żadna dawna kopia produktów nie jest aktywną domeną ustawień', () => {
  for (const key of LEGACY_PRODUCT_KEYS) {
    assert.equal(SETTINGS_DOMAIN_CONFIGS[key], undefined, `${key} nie może być źródłem produktów`);
  }
});

test('przeglądarka usuwa wszystkie pełne kopie produktów i blokuje ich ponowny zapis', async () => {
  const [storage, runtime, cloud] = await Promise.all([
    readFile('src/frontend/01b-storage-foundation.js', 'utf8'),
    readFile('src/frontend/02-runtime-state.js', 'utf8'),
    readFile('src/frontend/03-cloud-sync.js', 'utf8'),
  ]);
  for (const key of [...LEGACY_PRODUCT_KEYS, 'artway_ostatnia_kopia_importu']) {
    assert.match(storage, new RegExp(`["']${key}["']`), `brak blokady ${key}`);
  }
  assert.match(cloud, /for\(const key of CENTRAL_PRODUCT_LS_KEYS\)/);
  const productGuard = cloud.indexOf('CENTRAL_PRODUCT_LS_KEYS.has(klucz)');
  const serialization = cloud.indexOf('const serial=JSON.stringify(dane)');
  assert.ok(productGuard >= 0 && productGuard < serialization, 'blokada pełnej kopii musi działać przed serializacją');
  assert.doesNotMatch(runtime, /wczytajLS\(["']artway_produkty_(?:dodane|edytowane|ukryte|definitywne)/);
});

test('import oraz prosta korekta Agenta używają wyłącznie centralnego API', async () => {
  const [productImport, agent] = await Promise.all([
    readFile('src/frontend/13a-product-import-export.js', 'utf8'),
    readFile('src/frontend/10-agent-ai.js', 'utf8'),
  ]);
  const importStart = productImport.indexOf('async function wykonajImportProduktow');
  const importEnd = productImport.indexOf('function cofnijOstatniImportProduktow', importStart);
  const importBody = productImport.slice(importStart, importEnd);
  assert.match(importBody, /catalog-products-import/);
  assert.doesNotMatch(importBody, /artway_ostatnia_kopia_importu|zapiszStanProduktowPoOperacji/);
  const agentStart = agent.indexOf('async function agentAIPoprawOpisyProduktow');
  const agentEnd = agent.indexOf('function agentAIRozpoznajPolecenie', agentStart);
  const agentBody = agent.slice(agentStart, agentEnd);
  assert.match(agentBody, /chmuraZapiszProduktyCentralnie/);
  assert.doesNotMatch(agentBody, /produktyDodane\[|produktyEdytowane\[|zapiszStanProduktowPoOperacji/);
});

test('interfejs nie ma już aktywnej funkcji pozornego lokalnego zapisu produktu', async () => {
  const files = [
    'src/frontend/03-cloud-sync.js',
    'src/frontend/05-catalog-inventory.js',
    'src/frontend/09-seo.js',
    'src/frontend/10-agent-ai-command-center.js',
    'src/frontend/11-allegro-product-publication.js',
    'src/frontend/11-allegro-operations.js',
    'src/frontend/12-product-editor.js',
    'src/frontend/12a-product-actions.js',
    'src/frontend/13-product-admin.js',
  ];
  const sources = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  const joined = sources.join('\n');
  assert.doesNotMatch(joined, /zapiszPolaProduktuLokalnie/);
  assert.doesNotMatch(joined, /zapiszLS\(["']artway_(?:produkty_(?:dodane|edytowane|katalog|ukryte|definitywne)|kosz_(?:dodane|meta))/);
  assert.match(joined, /async function zapiszPolaProduktuTrwale/);
  assert.match(joined, /await chmuraZapiszProduktyCentralnie/);
});

test('produkcyjny Agent i integracje dostają wyłącznie zapis centralny z publikacją i odczytem', async () => {
  const app = await readFile('src/backend/lib/store-app.mjs', 'utf8');
  for (const marker of [
    'saveProductFields: zapiszIOpublikujPolaProduktuCentralnie',
    'saveProduct: zapiszIOpublikujPolaProduktuCentralnie',
    'saveProductFields: (input) => zapiszIOpublikujPolaProduktuCentralnie(input)',
  ]) assert.match(app, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(app, /readPublishedProduct:\s*\(productId\)\s*=>\s*centralProductCatalog\.get/);
  assert.doesNotMatch(app, /zapiszOperacjeProduktowLegacy|createCatalogProductOperationWriter/);
});

test('trasy integracji nie odtwarzają dawnej mapy edycji produktów w settings', async () => {
  const files = [
    'src/backend/lib/von-halsky-route.mjs',
    'src/backend/lib/allegro-mapping-route.mjs',
    'src/backend/lib/allegro-offer-withdrawal-route.mjs',
    'src/backend/lib/infakt-service.mjs',
    'src/backend/lib/domain/agent-specialists.mjs',
  ];
  const joined = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(joined, /artway_produkty_edytowane\s*=/);
  assert.doesNotMatch(joined, /write\(['"]settings['"][\s\S]{0,300}artway_produkty_/);
  assert.match(joined, /central_product_catalog_unavailable/);
});

test('products.json jest tylko generowaną projekcją PostgreSQL przed wydaniem', async () => {
  const [deploy, snapshot] = await Promise.all([
    readFile('scripts/deploy-atomic-release.mjs', 'utf8'),
    readFile('scripts/generate-canonical-products-snapshot.mjs', 'utf8'),
  ]);
  assert.match(deploy, /generate-canonical-products-snapshot\.mjs/);
  assert.match(snapshot, /FROM artway_storefront_products/);
  assert.match(snapshot, /SELECT list_data/);
  assert.doesNotMatch(snapshot, /SELECT public_data/);
  assert.match(snapshot, /record_status='active'/);
  assert.doesNotMatch(snapshot, /artway_produkty_dodane|localStorage/);
});

test('lekka projekcja startowa pobiera pełną kartę produktu dopiero po jej otwarciu', async () => {
  const storefront = await readFile('src/frontend/06b-storefront-catalog.js', 'utf8');
  assert.match(storefront, /detailLevel==="list"/);
  assert.match(storefront, /product-catalog-item/);
  assert.match(storefront, /detailLevel:"full"/);
});

test('wsadowy import aktualizuje rekord bez kasowania jego pozostałych pól i potwierdza odczyt', async () => {
  const products = new Map([
    ['17', { id: '17', nazwa: 'Stara nazwa', cena: 20, opis: 'Opis pozostaje' }],
  ]);
  const productSignals = [];
  const route = createStoreDataRoute({
    odpowiedz: (body, status = 200) => ({ body, status }),
    czyAdmin: () => true,
    tekst: (value, max = 1000) => String(value ?? '').slice(0, max),
    requestSession: () => ({ email: 'admin@example.test' }),
    readCatalogProduct: async (id) => products.get(String(id)) || null,
    zapiszOperacjeProduktow: async (operations) => {
      for (const operation of operations) {
        const current = products.get(String(operation.id));
        products.set(String(operation.id), { ...current, ...operation.fields });
      }
      return { modified: true, appliedOperations: operations.length, skippedProductIds: [] };
    },
    createCatalogProduct: async (product) => {
      products.set(String(product.id), { ...product });
      return { updated: true, product };
    },
    signalProductMutation: async (productId, details) => {
      productSignals.push({ productId: String(productId), details });
      return { event: { id: `event-${productId}` } };
    },
  });
  const response = await route(
    {
      method: 'POST',
      json: async () => ({
        importId: 'import-test',
        products: [
          { id: '17', nazwa: 'Nowa nazwa', cena: 25 },
          { id: '18', nazwa: 'Nowy produkt', cena: 30 },
        ],
      }),
    },
    new URL('https://artwaytm.pl/api/store?action=catalog-products-import'),
    'catalog-products-import',
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.confirmed, true);
  assert.equal(response.body.created, 1);
  assert.equal(response.body.updated, 1);
  assert.equal(products.get('17').opis, 'Opis pozostaje');
  assert.equal(products.get('17').nazwa, 'Nowa nazwa');
  assert.equal(products.get('18').nazwa, 'Nowy produkt');
  assert.deepEqual(productSignals.map((item) => item.productId).sort(), ['17', '18']);
  assert.ok(productSignals.every((item) => item.details.source.startsWith('catalog-import')));
});
