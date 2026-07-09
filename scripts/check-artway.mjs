import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = [
  'index.html',
  'assets/styles.css',
  'assets/app.js',
  'products.json',
  'netlify/functions/store.mjs',
  'netlify/functions/lib/store-app.mjs',
  'netlify/functions/cron-inpost-sync.mjs',
];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function read(file) {
  if (!existsSync(file)) {
    fail(`Brak pliku: ${file}`);
    return '';
  }
  return readFileSync(file, 'utf8');
}

function requireMarkers(file, content, markers) {
  for (const marker of markers) {
    if (!content.includes(marker)) fail(`${file}: brak wymaganego elementu: ${marker}`);
  }
}

for (const file of files) read(file);

const index = read('index.html');
const css = read('assets/styles.css');
const app = read('assets/app.js');
const storeEntry = read('netlify/functions/store.mjs');
const store = read('netlify/functions/lib/store-app.mjs');
const cron = read('netlify/functions/cron-inpost-sync.mjs');

const version = index.match(/<meta\s+name=["']artway-version["']\s+content=["']([^"']+)/i)?.[1] || '';
if (!version) fail('index.html: brak meta artway-version');

requireMarkers('index.html', index, [
  '<main id="widok">',
  'PUBLIC_SETTINGS_START',
  'assets/styles.css',
  'assets/app.js',
  `assets/styles.css?v=${version}`,
  `assets/app.js?v=${version}`,
]);

requireMarkers('assets/styles.css', css, [
  ':root',
  '.grid',
  '.admin-page',
  '.ship-card',
  '.modal',
]);

requireMarkers('assets/app.js', app, [
  'function renderuj',
  'function zlozZamowienie',
  'function widokAdmin',
  'function widokAdminWysylki',
  'function utworzPrzesylkeAPI',
  'function synchronizujWszystkieStatusyAPI',
  'function eksportNadaniaInpostCSV',
  'function panelEtykietInpostHTML',
  'CSV kolumny A/B/C',
  'e-mail","telefon","rozmiar","paczkomat","numer_referencyjny',
  'function utworzEtykietyZaznaczoneAPI',
  'function pobierzInpostConfig',
  'function otworzGeowidget',
  'function sprawdzPaynowKonfiguracje',
  'function wyslijEmailWysylki',
  'function wykonajImportProduktow',
  'function widokDiagnostyka',
  'function osadzUstawieniaWIndexie',
]);

requireMarkers('netlify/functions/store.mjs', storeEntry, [
  "import handler from './lib/store-app.mjs'",
  'export default handler',
]);

requireMarkers('netlify/functions/lib/store-app.mjs', store, [
  "action === 'health'",
  "action === 'paynow-create'",
  "action === 'paynow-notification'",
  "action === 'inpost-create'",
  "action === 'inpost-status'",
  "action === 'inpost-sync-all'",
  "action === 'store-order-create'",
  "action === 'store-sync'",
  "action === 'store-order-delete-mine'",
  "action === 'account-login'",
  "action === 'send-status-email'",
]);

requireMarkers('netlify/functions/cron-inpost-sync.mjs', cron, [
  "schedule: '0 */6 * * *'",
  'inpost-sync-all',
  'ARTWAY_ADMIN_TOKEN',
]);

try {
  new Function(app);
} catch (error) {
  fail(`assets/app.js: błąd składni: ${error.message}`);
}

for (const file of ['netlify/functions/store.mjs', 'netlify/functions/lib/store-app.mjs', 'netlify/functions/cron-inpost-sync.mjs']) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    fail(`${file}: błąd składni`);
    if (error.stderr) console.error(String(error.stderr));
  }
}

if (!process.exitCode) console.log(`✅ Artway check OK — wersja ${version}, pliki rozbite i funkcje krytyczne obecne.`);
