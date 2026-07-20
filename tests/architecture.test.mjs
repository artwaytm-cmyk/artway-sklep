import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { ARCHITECTURE_BUDGETS as B, physicalLineCount } from '../config/architecture-budgets.mjs';
import { ADMIN_RUNTIME_BUNDLES, ASSET_BUNDLES, buildAssets } from '../scripts/build-assets.mjs';

async function assetMetrics(path) {
  const content = await readFile(path);
  return { raw: content.length, gzip: gzipSync(content).length };
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(path) : (/\.(?:js|mjs|css)$/.test(entry.name) ? [path] : []);
  }));
  return nested.flat();
}

test('wygenerowane assets odpowiadają modułom źródłowym', async () => {
  await assert.doesNotReject(() => buildAssets({ check: true }));
});

test('moduły źródłowe mają kontrolowany rozmiar i jednoznaczną kolejność', async () => {
  const bundledSources = ASSET_BUNDLES.flatMap((bundle) => bundle.sources);
  assert.equal(new Set(bundledSources).size, bundledSources.length);
  const applicationSources = (await Promise.all([
    sourceFiles('src/frontend'), sourceFiles('src/styles'), sourceFiles('src/backend'),
    sourceFiles('netlify/functions/lib/core'), sourceFiles('netlify/functions/lib/domain'),
    sourceFiles('netlify/functions/lib'),
  ])).flat().filter((source) => source !== 'netlify/functions/lib/store-app.mjs');
  const sources = [...new Set([...bundledSources, ...applicationSources])];
  for (const source of sources) {
    const content = await readFile(source, 'utf8');
    const budget = source.endsWith('.css') ? B.source.stylesheet : B.source.javascript;
    assert.ok(content.trim().length > 0, `${source} nie może być pusty`);
    assert.ok(Buffer.byteLength(content) <= budget.maxBytes, `${source} przekroczył twardy budżet źródła; podziel domenę`);
    const lines = physicalLineCount(content);
    assert.ok(lines <= budget.maxLines, `${source} ma ${lines} fizycznych linii; podziel domenę na mniejsze moduły`);
  }
});

test('główny backend pozostaje koordynatorem z kontrolowanym budżetem migracyjnym', async () => {
  const file = await stat('netlify/functions/lib/store-app.mjs');
  assert.ok(file.size <= B.backendCoordinator.maxBytes, `store-app.mjs urósł do ${file.size} B; wydziel kolejną domenę`);
  const storeLines = physicalLineCount(await readFile('netlify/functions/lib/store-app.mjs', 'utf8'));
  assert.ok(storeLines <= B.backendCoordinator.maxLines, `store-app.mjs ma ${storeLines} fizycznych linii; wydziel kolejną domenę`);
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
    const lines = physicalLineCount(await readFile(source, 'utf8'));
    assert.ok(lines <= B.source.focusedFrontend.maxLines, `${source} ma ${lines} linii; przekroczono twardy budżet domeny panelu`);
  }
  for (const source of [
    'netlify/functions/lib/email-service.mjs',
    'netlify/functions/lib/inpost-service.mjs',
    'netlify/functions/lib/paynow-service.mjs',
    'netlify/functions/lib/infakt-service.mjs',
    'netlify/functions/lib/product-source-inspection-service.mjs',
  ]) {
    const lines = physicalLineCount(await readFile(source, 'utf8'));
    assert.ok(lines <= B.source.integrationService.maxLines, `${source} ma ${lines} linii; przekroczono twardy budżet usługi integracyjnej`);
  }
});

test('pierwsze wejście klienta nie pobiera ciężkiego panelu administratora', async () => {
  const publicBundle = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/app.js');
  const adminBundle = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.js');
  const publicJs = await assetMetrics('assets/app.js');
  const publicCss = await assetMetrics('assets/styles.css');
  assert.ok(publicBundle && adminBundle, 'konfiguracja musi zawierać osobny pakiet sklepu i panelu');
  assert.ok(!publicBundle.sources.some((source) => adminBundle.sources.includes(source)), 'kod panelu nie może wejść do pakietu klienta');
  assert.ok(publicJs.raw <= B.browser.storefrontScript.maxRawBytes && publicJs.gzip <= B.browser.storefrontScript.maxGzipBytes, 'początkowy JavaScript przekroczył budżet transmisji; podziel kod trasy sklepu');
  assert.ok(publicCss.raw <= B.browser.storefrontStyles.maxRawBytes && publicCss.gzip <= B.browser.storefrontStyles.maxGzipBytes, 'początkowy CSS przekroczył budżet transmisji');
});

test('panel administratora ładuje mały rdzeń i domeny dopiero dla bieżącej trasy', async () => {
  const aggregate = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.js');
  const runtimeSources = ADMIN_RUNTIME_BUNDLES.flatMap((bundle) => bundle.sources);
  const core = ADMIN_RUNTIME_BUNDLES.find((bundle) => bundle.output === 'assets/admin-core.js');
  const router = await readFile('src/frontend/06-router-and-storefront.js', 'utf8');
  assert.ok(aggregate && core, 'panel wymaga artefaktu kontrolnego i małego rdzenia runtime');
  assert.equal(new Set(runtimeSources).size, runtimeSources.length, 'źródło panelu nie może wejść do dwóch paczek runtime');
  assert.deepEqual(new Set(runtimeSources), new Set(aggregate.sources), 'paczki runtime muszą obejmować cały panel bez braków');
  const coreMetrics = await assetMetrics(core.output), uiMetrics = await assetMetrics('assets/admin-ui.js');
  assert.ok(coreMetrics.raw <= B.browser.adminCore.maxRawBytes && coreMetrics.gzip <= B.browser.adminCore.maxGzipBytes, 'rdzeń panelu przekroczył budżet transmisji');
  assert.ok(uiMetrics.raw <= B.browser.adminSharedUi.maxRawBytes && uiMetrics.gzip <= B.browser.adminSharedUi.maxGzipBytes, 'wspólne UI panelu przekroczyło budżet transmisji');
  for (const bundle of ADMIN_RUNTIME_BUNDLES.filter((entry) => ![core.output, 'assets/admin-ui.js'].includes(entry.output))) {
    const metrics = await assetMetrics(bundle.output);
    assert.ok(metrics.raw <= B.browser.adminRoute.maxRawBytes && metrics.gzip <= B.browser.adminRoute.maxGzipBytes, `${bundle.output} przekroczył budżet trasy i wymaga dalszego podziału`);
  }
  const adminStyles = await assetMetrics('assets/admin.css');
  assert.ok(adminStyles.raw <= B.browser.adminStyles.maxRawBytes && adminStyles.gzip <= B.browser.adminStyles.maxGzipBytes, 'style panelu przekroczyły budżet transmisji');
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
