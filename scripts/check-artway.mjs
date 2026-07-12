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
  'netlify/functions/cron-allegro-orders.mjs',
  'netlify/functions/cron-allegro-communications.mjs',
  'netlify/functions/cron-allegro-offers.mjs',
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
const cronAllegroOrders = read('netlify/functions/cron-allegro-orders.mjs');
const cronAllegroCommunications = read('netlify/functions/cron-allegro-communications.mjs');
const cronAllegroOffers = read('netlify/functions/cron-allegro-offers.mjs');

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
  '.warehouse-hero',
  '.warehouse-meta',
  '.warehouse-plan',
  '.stat-filter',
  '.ai-agent-hero',
  '.ai-restock-card',
  '.allegro-operation-success',
  '.allegro-activate-control',
  '.modal',
]);

requireMarkers('assets/app.js', app, [
  'function renderuj',
  'function zlozZamowienie',
  'function widokAdmin',
  'function widokAdminMagazyn',
  'function widokAdminAgentAI',
  'artway_dostepnosc',
  'LIMIT_POTWIERDZENIA_DOSTEPNOSCI',
  'artway_magazyn_produkty',
  'artway_agent_ai_historia',
  'function eksportujZatowarowanieCSV',
  'function audytMagazynuAI',
  'function zapiszKartotekeMagazynu',
  'function ustawFiltrMagazynu',
  'stat-filter',
  'Plan zatowarowania',
  'Kartoteka magazynowa',
  'artway_ruchy_magazynowe',
  'artway_faktury_szkice',
  'inFakt / szkice faktur',
  'function widokAdminWysylki',
  'function utworzPrzesylkeAPI',
  'function synchronizujWszystkieStatusyAPI',
  'function eksportNadaniaInpostCSV',
  'function panelEtykietInpostHTML',
  'function czyEtykietaInpostGotowa',
  'label_not_ready',
  'TXT z nagłówkami InPost',
  'tryb==="tab"||tryb==="tsv"||tryb==="inpost"',
  'e-mail","telefon","rozmiar","paczkomat","numer_referencyjny',
  'kurierInpostAktywny: true',
  'nazwa:"Kurier InPost", koszt:20',
  'function kartaAdminZamowieniaHTML',
  'function adminZamowienieSnapshotHTML',
  'function adminPozycjeZamowieniaHTML',
  'orders-stat-grid',
  'order-detail-page',
  'OPLATA_PACZKA_WEEKEND = 5',
  'INPOST_DOMYSLNY_SP_NADANIA = "parcel_locker"',
  'shipment-manager-box',
  'inpost-like-title',
  'Dane odbiorcy',
  'name="pobranieAktywne"',
  'name="sposobNadania"',
  'name="punktNadania"',
  'Paczka w Weekend (+',
  'function kosztyZamowienia',
  'function utworzEtykietyZaznaczoneAPI',
  'function pobierzInpostConfig',
  'function otworzGeowidget',
  'function sprawdzPaynowKonfiguracje',
  'function wyslijEmailWysylki',
  'function wykonajImportProduktow',
  'function widokDiagnostyka',
  'function osadzUstawieniaWIndexie',
  'function allegroOfertaDlaProduktuSklepu',
  'function allegroWystawianiePanelHTML',
  'function allegroZmienCenyZaznaczonychOfert',
  'function allegroPoprawOpisyWFormularzu',
  'function allegroAnalizaMagazynowaZamowienia',
  'function agentAIAllegroZleceniaTekst',
  'function allegroRozniceOfertyProduktu',
  'function allegroZadaniaAgentaOfertHTML',
  'function allegroAktualizujZaznaczoneOfertyDanymiSklepu',
  'function allegroZapiszWynikOperacji',
  'ALLEGRO_PROCEDURA_AGENTA_OFERT',
  'Agent: aktualizuj ofertę',
  'function agentAIWykonajOferteAllegro',
  'wystaw Origami Kot na Allegro',
  'function allegroStanOfertyProduktu',
  'function allegroAktywujProduktZListy',
  'stan oferty Allegro',
  'function allegroSynchronizujWszystko',
  'automatycznie co 6 godzin',
  'allegroZamowienia.filter(statusAllegroRezerwujeMagazyn)',
  'badge:zadaniaWystawiania',
  'stock:allegroStanOfertyProduktu',
  'nowy produkt = 0 szt.',
  'function allegroWyslijOdpowiedz',
  'function allegroAgentPropozycjaOdpowiedzi',
  'function allegroHistoriaRozmowyHTML',
  'telegramReminders',
  '"producent"',
  'Zrealizowane lokalnie',
  'function potwierdzWidoczneStanyMagazynu',
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
  "action === 'inpost-label'",
  "action === 'inpost-status'",
  "action === 'inpost-sync-all'",
  'function inpostEtykietaGotowa',
  'inpostCzekajNaEtykiete',
  "action === 'store-order-create'",
  "action === 'store-sync'",
  "action === 'store-order-delete-mine'",
  "action === 'account-login'",
  "action === 'send-status-email'",
  'function kosztyEmail',
  'Paczka w Weekend',
  'end_of_week_collection',
  'dropoff_point',
  'inpostPobranieAktywne',
  'inpostSposobNadaniaZamowienia',
  'artway_dostepnosc',
  'artway_magazyn_produkty',
  'artway_agent_ai_historia',
  'artway_ruchy_magazynowe',
  'artway_faktury_szkice',
  "action === 'allegro-description-improve'",
  "action === 'allegro-create-product-offer'",
  "action === 'allegro-offer-price-change'",
  'function allegroDopasowanieOferty',
  'function allegroSekcjeOpisu',
  'function allegroZnajdzProduktKatalogu',
  "action === 'allegro-order-warehouse-stage'",
  'function allegroAgentPrzetworzZamowienia',
  'function allegroAutoMapujOfertyZKartoteka',
  'function allegroZapiszZadanieAgentaOferty',
  'function allegroCzekajNaOperacjeOferty',
  'ALLEGRO_AGENT_OFFER_PROCEDURE',
  'agentDecision:',
  'function allegroScalParametryBezDuplikatow',
  'Number(details.draft?.stock?.available)',
  'const stockRaw = Number(opt.stock ?? p.stan ?? 0)',
  'allegroParameters: autoParameters',
  "...(!sourceImages.length ? {} : { zdjecie: sourceImages[0]",
  'options.descriptionSections = allegroSekcjeOpisu(preparedProduct',
  "action === 'allegro-send-reply'",
  "action === 'allegro-reply-suggestion'",
  'allegro_orders_baseline_v2',
  'function allegroWyslijPrzypomnieniaTelegram',
  'humanReplyNeeded',
  "telegramKomorka('KOD', 15)",
  "telegramKomorka('NAZWA', 30)",
  "telegramKomorka('POTRZEBNA ILOŚĆ', 16)",
  "'zrealizowane'",
]);

if (/stock:\s*\{\s*available:\s*Math\.max\(0,\s*Number\(opt\.stock\s*\?\?\s*p\.stan\s*\?\?\s*1\)\s*\|\|\s*1\)/.test(store)) {
  fail('netlify/functions/lib/store-app.mjs: stan 0 nie może być zamieniany na 1 przy wystawianiu Allegro');
}
if (app.includes('badge:produktyBezOferty')) {
  fail('assets/app.js: licznik Allegro nie może zliczać całego katalogu produktów bez oferty');
}

requireMarkers('netlify/functions/cron-inpost-sync.mjs', cron, [
  "schedule: '0 */6 * * *'",
  'inpost-sync-all',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('netlify/functions/cron-allegro-orders.mjs', cronAllegroOrders, [
  "schedule: '5,20,35,50 * * * *'",
  'allegro-sync-orders',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('netlify/functions/cron-allegro-communications.mjs', cronAllegroCommunications, [
  "schedule: '*/15 * * * *'",
  'allegro-sync-communications',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('netlify/functions/cron-allegro-offers.mjs', cronAllegroOffers, [
  "schedule: '25 */6 * * *'",
  'allegro-sync-offers',
  'ARTWAY_ADMIN_TOKEN',
]);

try {
  new Function(app);
} catch (error) {
  fail(`assets/app.js: błąd składni: ${error.message}`);
}

for (const file of ['netlify/functions/store.mjs', 'netlify/functions/lib/store-app.mjs', 'netlify/functions/cron-inpost-sync.mjs', 'netlify/functions/cron-allegro-orders.mjs', 'netlify/functions/cron-allegro-communications.mjs', 'netlify/functions/cron-allegro-offers.mjs']) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    fail(`${file}: błąd składni`);
    if (error.stderr) console.error(String(error.stderr));
  }
}

if (!process.exitCode) console.log(`✅ Artway check OK — wersja ${version}, pliki rozbite i funkcje krytyczne obecne.`);
