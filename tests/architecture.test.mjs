import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { ADMIN_RUNTIME_BUNDLES, ASSET_BUNDLES, buildAssets } from '../scripts/build-assets.mjs';

test('wygenerowane assets odpowiadają modułom źródłowym', async () => {
  await assert.doesNotReject(() => buildAssets({ check: true }));
});

test('moduły źródłowe mają kontrolowany rozmiar i jednoznaczną kolejność', async () => {
  const sources = ASSET_BUNDLES.flatMap((bundle) => bundle.sources);
  assert.equal(new Set(sources).size, sources.length);
  for (const source of sources) {
    const content = await readFile(source, 'utf8');
    assert.ok(content.trim().length > 0, `${source} nie może być pusty`);
    assert.ok(Buffer.byteLength(content) <= 210_000, `${source} przekroczył budżet 210 kB; podziel domenę`);
    const lines = content.split('\n').length;
    assert.ok(lines <= 1300, `${source} ma ${lines} linii; podziel domenę na mniejsze moduły`);
  }
});

test('główny backend pozostaje poniżej budżetu migracyjnego', async () => {
  const file = await stat('netlify/functions/lib/store-app.mjs');
  assert.ok(file.size < 400_000, `store-app.mjs urósł do ${file.size} B; wydziel kolejną domenę`);
  const storeLines = (await readFile('netlify/functions/lib/store-app.mjs', 'utf8')).split('\n').length;
  assert.ok(storeLines <= 5200, `store-app.mjs ma ${storeLines} linii; wydziel kolejną domenę`);
  const catalogQuality = await stat('netlify/functions/lib/domain/catalog-quality.mjs');
  assert.ok(catalogQuality.size < 80_000, `catalog-quality.mjs urósł do ${catalogQuality.size} B; rozdziel audyt od korekt`);
});

test('wydzielone domeny pozostają małe i są częścią właściwego pakietu', async () => {
  const frontendDomains = [
    'src/frontend/10-agent-ai.js',
    'src/frontend/10-agent-ai-supplier-planning.js',
    'src/frontend/10-agent-ai-command-center.js',
    'src/frontend/10-agent-ai-admin-workspace.js',
    'src/frontend/11-allegro-and-orders.js',
    'src/frontend/11-allegro-product-publication.js',
    'src/frontend/11-allegro-operations.js',
    'src/frontend/11-allegro-communications.js',
    'src/frontend/11-allegro-workspace.js',
    'src/frontend/11-store-orders.js',
    'src/frontend/12-customers-and-inventory.js',
    'src/frontend/12-infakt-admin.js',
    'src/frontend/12-warehouse-views.js',
    'src/frontend/12-product-editor.js',
  ];
  const adminBundle = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.js');
  for (const source of frontendDomains) {
    assert.ok(adminBundle.sources.includes(source), `${source} nie jest składany do panelu administratora`);
    const lines = (await readFile(source, 'utf8')).split('\n').length;
    assert.ok(lines <= 650, `${source} ma ${lines} linii; przekroczono budżet domeny 650 linii`);
  }
  for (const source of [
    'netlify/functions/lib/email-service.mjs',
    'netlify/functions/lib/inpost-service.mjs',
    'netlify/functions/lib/paynow-service.mjs',
    'netlify/functions/lib/infakt-service.mjs',
    'netlify/functions/lib/product-source-inspection-service.mjs',
  ]) {
    const lines = (await readFile(source, 'utf8')).split('\n').length;
    assert.ok(lines <= 800, `${source} ma ${lines} linii; przekroczono budżet usługi 800 linii`);
  }
});

test('pierwsze wejście klienta nie pobiera ciężkiego panelu administratora', async () => {
  const publicBundle = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/app.js');
  const adminBundle = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.js');
  const publicJs = await stat('assets/app.js');
  const publicCss = await stat('assets/styles.css');
  assert.ok(publicBundle && adminBundle, 'konfiguracja musi zawierać osobny pakiet sklepu i panelu');
  assert.ok(!publicBundle.sources.some((source) => adminBundle.sources.includes(source)), 'kod panelu nie może wejść do pakietu klienta');
  assert.ok(publicJs.size < 512_000, `początkowy JavaScript urósł do ${publicJs.size} B; moduły panelu muszą pozostać ładowane na żądanie`);
  assert.ok(publicCss.size < 70_000, `początkowy CSS urósł do ${publicCss.size} B; style panelu muszą pozostać ładowane na żądanie`);
});

test('panel administratora ładuje mały rdzeń i domeny dopiero dla bieżącej trasy', async () => {
  const aggregate = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.js');
  const runtimeSources = ADMIN_RUNTIME_BUNDLES.flatMap((bundle) => bundle.sources);
  const core = ADMIN_RUNTIME_BUNDLES.find((bundle) => bundle.output === 'assets/admin-core.js');
  const router = await readFile('src/frontend/06-router-and-storefront.js', 'utf8');
  assert.ok(aggregate && core, 'panel wymaga artefaktu kontrolnego i małego rdzenia runtime');
  assert.equal(new Set(runtimeSources).size, runtimeSources.length, 'źródło panelu nie może wejść do dwóch paczek runtime');
  assert.deepEqual(new Set(runtimeSources), new Set(aggregate.sources), 'paczki runtime muszą obejmować cały panel bez braków');
  assert.ok((await stat(core.output)).size < 15_000, 'rdzeń panelu powinien pozostać poniżej 15 kB');
  for (const bundle of ADMIN_RUNTIME_BUNDLES) assert.ok((await stat(bundle.output)).size < 400_000, `${bundle.output} wymaga dalszego podziału`);
  assert.match(router, /function adminModulyDlaTrasy\(/);
  assert.match(router, /ui:"admin-ui"/);
  assert.match(router, /moduly=\["core","ui"\]/);
  assert.match(router, /adminModulyTrasyGotowe\(t\)/);
  assert.ok(!router.includes('script.src=`/assets/admin.js'), 'przeglądarka nie może pobierać pełnego artefaktu kontrolnego admin.js');
});

test('bezpośrednie wejście gościa na trasę panelu może wyświetlić bezpieczny brak dostępu', async () => {
  const router = await readFile('src/frontend/06-router-and-storefront.js', 'utf8');
  assert.match(router, /const wymagaPanelu=t\.startsWith\("\/admin"\)\|\|t==="\/diagnostyka"/);
  assert.match(router, /document\.body\.classList\.toggle\("admin-mode",wymagaPanelu\)/);
  assert.ok(!router.includes('const wymagaPanelu=(t.startsWith("/admin")||t==="/diagnostyka")&&jestAdmin()'));
});

test('HTML startowy ma komplet podstaw technicznego SEO', async () => {
  const html = await readFile('index.html', 'utf8');
  for (const marker of ['name="description"', 'name="robots"', 'property="og:site_name"', 'name="twitter:card"', 'type="application/ld+json"', '<script defer src="/assets/app.js']) {
    assert.ok(html.includes(marker), `index.html nie zawiera: ${marker}`);
  }
  assert.ok(!html.includes('sklep wielobranżowy'), 'opis startowy nie może reklamować nieaktualnego asortymentu');
});

test('domena marketingowa przekierowuje stale na kanoniczny adres sklepu', async () => {
  const config = await readFile('netlify.toml', 'utf8');
  const apexRedirect = config.indexOf('from = "https://allsklep.pl/*"');
  const wwwRedirect = config.indexOf('from = "https://www.allsklep.pl/*"');
  const appRewrite = config.indexOf('from = "/api/store"');
  assert.ok(apexRedirect >= 0 && wwwRedirect >= 0, 'brakuje przekierowania obu wariantów allsklep.pl');
  assert.ok(apexRedirect < appRewrite && wwwRedirect < appRewrite, 'przekierowania domen muszą poprzedzać wewnętrzne rewrite aplikacji');
  const canonicalRedirects = config.match(/to = "https:\/\/artwaytm\.pl\/:splat"[\s\S]*?status = 301[\s\S]*?force = true/g) || [];
  assert.equal(canonicalRedirects.length, 2, 'każdy wariant domeny wymaga osobnej reguły 301');
});

test('podstawowy interfejs ma obsługę klawiatury i czytników ekranu', async () => {
  const html = await readFile('index.html', 'utf8');
  for (const marker of ['class="skip-link"', '<main id="widok" tabindex="-1"', 'role="dialog"', 'aria-modal="true"', 'aria-live="polite"']) {
    assert.ok(html.includes(marker), `index.html nie zawiera zabezpieczenia dostępności: ${marker}`);
  }
  const frontendSources = ASSET_BUNDLES.flatMap((bundle) => bundle.sources.filter((source) => source.startsWith('src/frontend/')));
  for (const source of frontendSources) {
    const content = await readFile(source, 'utf8');
    for (const match of content.matchAll(/<img\b[^>]*>/g)) assert.match(match[0], /\balt\s*=/, `${source} zawiera obraz bez tekstu alternatywnego`);
  }
});
