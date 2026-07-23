import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { allegroCheckText, allegroSanitizePlainText, allegroSanitizeDescription, allegroEnforceDraft } from '../src/backend/lib/allegro-compliance.mjs';
import { infaktKsefPozycje, ustawieniaPubliczneBezDanychPrywatnych } from '../src/backend/lib/infakt-purchase.mjs';

const files = [
  'index.html',
  'assets/styles.css',
  'assets/app.js',
  'assets/admin.css',
  'assets/admin.js',
  'assets/admin-core.js',
  'assets/admin-agent.js',
  'assets/admin-warehouse.js',
  'assets/admin-commerce.js',
  'assets/admin-inventory.js',
  'assets/admin-catalog.js',
  'assets/admin-personalization.js',
  'assets/admin-system.js',
  'products.json',
  'src/backend/store.mjs',
  'src/backend/lib/store-app.mjs',
  'src/backend/lib/system-route.mjs',
  'src/backend/lib/store-data-route.mjs',
  'src/backend/lib/inpost-route.mjs',
  'src/backend/lib/infakt-route.mjs',
  'src/backend/lib/paynow-route.mjs',
  'src/backend/lib/agent-operations-route.mjs',
  'src/backend/lib/allegro-communications-route.mjs',
  'src/backend/lib/allegro-mapping-route.mjs',
  'src/backend/lib/product-availability-route.mjs',
  'src/backend/lib/email-route.mjs',
  'src/backend/lib/email-service.mjs',
  'src/backend/lib/inpost-service.mjs',
  'src/backend/lib/paynow-service.mjs',
  'src/backend/lib/infakt-service.mjs',
  'src/backend/lib/product-source-inspection-service.mjs',
  'src/backend/lib/product-source-matching.mjs',
  'src/backend/lib/allegro-offer-withdrawal-route.mjs',
  'src/backend/lib/core/http.mjs',
  'src/backend/lib/core/store-repository.mjs',
  'src/backend/lib/domain/orders.mjs',
  'src/backend/lib/domain/catalog-quality.mjs',
  'src/backend/lib/domain/product-editorial-pipeline.mjs',
  'src/backend/lib/domain/product-link-package-preparer.mjs',
  'src/backend/lib/domain/product-sale-decisions.mjs',
  'src/backend/lib/domain/product-sale-channel-links.mjs',
  'src/backend/lib/domain/allegro-reply-assistant.mjs',
  'src/backend/lib/domain/telegram-communication.mjs',
  'src/backend/lib/telegram-center.mjs',
  'src/backend/lib/telegram-router.mjs',
  'src/backend/lib/allegro-compliance.mjs',
  'src/backend/lib/infakt-purchase.mjs',
  'src/backend/cron-inpost-sync.mjs',
  'src/backend/cron-allegro-orders.mjs',
  'src/backend/cron-allegro-communications.mjs',
  'src/backend/cron-allegro-offers.mjs',
  'src/backend/cron-supplier-availability.mjs',
  'src/backend/cron-infakt-sync.mjs',
  'src/backend/cron-seo-daily.mjs',
  'src/backend/cron-telegram-center.mjs',
  'src/backend/telegram-webhook.mjs',
  'src/backend/sitemap.mjs',
  'src/backend/google-products.mjs',
  'robots.txt',
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
const cssPublic = read('assets/styles.css');
const cssAdmin = read('assets/admin.css');
const css = `${cssPublic}\n${cssAdmin}`;
const appPublic = read('assets/app.js');
const appAdmin = read('assets/admin.js');
const app = `${appPublic}\n${appAdmin}`;
const storeEntry = read('src/backend/store.mjs');
const store = read('src/backend/lib/store-app.mjs');
const agentOperationsRoute = read('src/backend/lib/agent-operations-route.mjs');
const allegroCommunicationsRoute = read('src/backend/lib/allegro-communications-route.mjs');
const allegroMappingRoute = read('src/backend/lib/allegro-mapping-route.mjs');
const productAvailabilityRoute = read('src/backend/lib/product-availability-route.mjs');
const emailRoute = read('src/backend/lib/email-route.mjs');
const storeRuntime = [
  store,
  read('src/backend/lib/system-route.mjs'),
  read('src/backend/lib/store-data-route.mjs'),
  read('src/backend/lib/inpost-route.mjs'),
  read('src/backend/lib/infakt-route.mjs'),
  read('src/backend/lib/paynow-route.mjs'),
  agentOperationsRoute,
  allegroCommunicationsRoute,
  allegroMappingRoute,
  productAvailabilityRoute,
  emailRoute,
  read('src/backend/lib/email-service.mjs'),
  read('src/backend/lib/inpost-service.mjs'),
  read('src/backend/lib/paynow-service.mjs'),
  read('src/backend/lib/infakt-service.mjs'),
  read('src/backend/lib/product-source-inspection-service.mjs'),
  read('src/backend/lib/product-source-matching.mjs'),
].join('\n');
const productEditorial = read('src/backend/lib/domain/product-editorial-pipeline.mjs');
const productLinkPackage = read('src/backend/lib/domain/product-link-package-preparer.mjs');
const productSaleDecisions = read('src/backend/lib/domain/product-sale-decisions.mjs');
const productSaleChannelLinks = read('src/backend/lib/domain/product-sale-channel-links.mjs');
const allegroOfferWithdrawal = read('src/backend/lib/allegro-offer-withdrawal-route.mjs');
const allegroCompliance = read('src/backend/lib/allegro-compliance.mjs');
const infaktPurchase = read('src/backend/lib/infakt-purchase.mjs');
const telegramCommunication = read('src/backend/lib/domain/telegram-communication.mjs');
const telegramCenter = read('src/backend/lib/telegram-center.mjs');
const telegramRouter = read('src/backend/lib/telegram-router.mjs');
const cron = read('src/backend/cron-inpost-sync.mjs');
const cronAllegroOrders = read('src/backend/cron-allegro-orders.mjs');
const cronAllegroCommunications = read('src/backend/cron-allegro-communications.mjs');
const cronAllegroOffers = read('src/backend/cron-allegro-offers.mjs');
const cronSupplierAvailability = read('src/backend/cron-supplier-availability.mjs');
const cronInfaktSync = read('src/backend/cron-infakt-sync.mjs');
const cronSeoDaily = read('src/backend/cron-seo-daily.mjs');
const cronTelegramCenter = read('src/backend/cron-telegram-center.mjs');
const telegramWebhook = read('src/backend/telegram-webhook.mjs');
const sitemap = read('src/backend/sitemap.mjs');
const googleProducts = read('src/backend/google-products.mjs');
const robots = read('robots.txt');

requireMarkers('assets/app.js', appPublic, [
  'GENERATED FILE — edit src/frontend/*.js and run npm run build',
]);
requireMarkers('assets/admin.js', appAdmin, [
  'GENERATED FILE — edit src/frontend/*.js and run npm run build',
]);
requireMarkers('assets/styles.css', cssPublic, [
  'GENERATED FILE — edit src/styles/*.css and run npm run build',
]);
requireMarkers('assets/admin.css', cssAdmin, [
  'GENERATED FILE — edit src/styles/*.css and run npm run build',
]);

const version = index.match(/<meta\s+name=["']artway-version["']\s+content=["']([^"']+)/i)?.[1] || '';
if (!version) fail('index.html: brak meta artway-version');

requireMarkers('index.html', index, [
  '<main id="widok"',
  'class="skip-link"',
  'PUBLIC_SETTINGS_START',
  'assets/styles.css',
  'assets/app.js',
  `/assets/styles.css?v=${version}`,
  `/assets/app.js?v=${version}`,
  'artway-seo-schema',
  'og:site_name',
  'twitter:card',
]);

requireMarkers('połączonych assets CSS', css, [
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
  '.product-profit-editor',
  '.profitability-table',
  '.profitability-result',
  '.supplier-monitor-panel',
  '.supplier-availability',
  '.supplier-priority',
  '.warehouse-generator',
  '.warehouse-stock-card',
  '.warehouse-stock-toolbar',
  '.agent-site-grid',
  '.agent-page-header',
  '.agent-task-archive',
  '.product-agent-onboarding',
  '.agent-product-onboarding-list',
  '.infakt-hero',
  '.infakt-order-card',
  '.store-duplicate-center',
  '.assortment-search-primary',
  '.assortment-catalog-hero',
  '.assortment-filter-panel',
  '.allegro-dashboard-links',
  '.product-link-one-workspace',
  '.product-link-inline-workspace',
  '.product-add-control',
  '.product-add-progress-track',
  '.product-add-duplicate-check',
  '.product-source-evidence',
  '.seo-hero',
  '.seo-technical-grid',
  '.seo-advanced-toolbar',
  '.seo-bulk-toolbar',
  '.seo-product-table',
  '.modal',
  '.catalog-quality-page',
]);

requireMarkers('połączonych assets JS', app, [
  'function renderuj',
  'function zlozZamowienie',
  'function widokAdmin',
  'function widokAdminMagazyn',
  'function magazynSzukajProdukty',
  'function asortymentSzukajProdukty',
  'function widokAdminSEO',
  'function widokAdminJakoscKatalogu',
  'function katalogJakoscPobierz',
  'function seoUruchomPlanDzienny',
  'indexNowEnabled',
  'function seoEksportujFeedGoogleCSV',
  'function seoAktualizujMetaDlaTrasy',
  'function seoFiltrujKolejke',
  'function seoZaznaczWszystkieWyniki',
  'function seoWykonajOperacjeZbiorcza',
  'function seoProduktyWorkspaceHTML',
  'autoAllProducts',
  'seoMode',
  'artway_seo_ustawienia',
  'product-seo-editor',
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
  'inFakt i faktury',
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
  'offerDefaultsAudit',
  'function allegroZapiszUstawieniaOfert',
  'function agentAIStatusRoboczyProducenta',
  'function agentAIWyslijZlecenieEmail',
  'function agentAIUzgodnijPlanZSerwerem',
  'supplier-order-reconcile',
  'function producenciKartotekaPanelHTML',
  'artway_producenci',
  'function allegroListaProducentow',
  'function allegroProducentKanoniczny',
  'function allegroUruchomAutomatycznaKonserwacje',
  'Automatycznie poprawiaj krótki opis, pełny opis i układ',
  'function allegroDopasowaniePozycjiDoProduktu',
  'function allegroOtworzMapowaniePozycji',
  'name="cenaAllegro"',
  'name="cenaZakupu"',
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
  'function allegroTypAutoraHTML',
  'function allegroAktywujKafelkiKomunikacji',
  'function ustawKafelkowyFiltrAsortymentu',
  'filtrAllegroProduktow==="polaczone"',
  'Sprawdź nowe wiadomości',
  'function allegroCentrumDuplikatowHTML',
  'function allegroRozstrzygnijDuplikaty',
  'function allegroKomunikacjaPasujaca',
  'function allegroKomunikacjaZalatwiona',
  'function allegroKomunikacjaWymagaOdpowiedzi',
  'function allegroOznaczSpraweWewnetrznie',
  'function allegroOznaczZaznaczoneSprawy',
  'function allegroRentownoscProduktu',
  'function allegroPobierzProwizjeProduktu',
  'function allegroRentownoscPanelHTML',
  'function producentDostepnoscInfo',
  'function agentAISprawdzDostepnoscProducentow',
  'function sprzedazKanalyMagazynowe',
  'function priorytetDostepnosciProduktu',
  'function generujRegalyIPolkiMagazynu',
  'function wyczyscFiltryStanowMagazynu',
  'Generator obszaru, regałów i półek',
  'Lokalizacja nadrzędna',
  'Co mamy obecnie na magazynie',
  'Priorytet sprzedaży',
  'function agentAICentrumTekst',
  'function agentAIWyslijRaportTelegram',
  'function agentAIWykonajPlanBezpieczny',
  'function agentAIKonkretneDzialanie',
  'artway_agent_ai_plan_cykl',
  'function agentAIAnalizaAktywna',
  'function agentAIOznaczZadanieWykonane',
  'Wróci tylko, gdy pojawi się nowy problem',
  'function agentAIProduktyWdrozeniePanelHTML',
  'Najwyższy priorytet przy dodawaniu',
  'Wykonaj bezpieczne działania',
  'Funkcjonalność strony — priorytet 1',
  'Pobieranie i świeżość danych — priorytet 2',
  'Kontekst całej strony',
  '#/admin/magazyn/dostawcy',
  'Próg ostrzeżenia u producenta',
  'stan_u_producenta',
  '#/admin/allegro/rentownosc',
  'name="allegroCommissionAmount"',
  'Otwórz istniejącą ofertę',
  'Opłacalność i wyliczenie marżowe',
  '#/admin/allegro/wiadomosci',
  '#/admin/allegro/dyskusje',
  'telegramReminders',
  '"producent"',
  'Zrealizowane lokalnie',
  'function potwierdzWidoczneStanyMagazynu',
  'ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI=3',
  'function sklepRentownoscProduktu',
  'function rentownoscKanalowaPanelHTML',
  'function domyslneUstawieniaRentownosci',
  'function zapiszDomyslneUstawieniaRentownosci',
  'function zastosujDomyslneKosztyProduktow',
  'Domyślne koszty i cele',
  'function ustawRekomendowanaCeneProduktu',
  'function wyborCenyMarzowejHTML',
  'function aktualizujWyborCenyMarzowej',
  'function zastosujWyborCenyMarzowej',
  'Opublikuj na Allegro',
  'function automatyczniePobierzDaneZrodlaProduktu',
  'function widokAdminProduktyZLinku',
  'function agentAIDodajProduktTylkoZLinku',
  'Pobierz dane z linku produktu',
  'bez automatycznego zapisu',
  'function produktDodawanieAktualizuj',
  'function produktDodawaniePotwierdzNowy',
  'data-product-add-control',
  'Postęp dodawania produktu',
  'Produkt już istnieje',
  'data-product-final-approval',
  'Zatwierdź i dodaj produkt',
  'Zweryfikowane źródło produktu',
  'product-url-prepare',
  'allegroSynchronizujPowiazanyProduktPoZapisie(next,{forceFees:true})',
  'artway_cel_marzy_sklep',
  'artway_cel_marzy_allegro',
  'autoUpdateOffers',
  'autoFees',
  'function audytDuplikatowSklepu',
  'function filtrujDuplikatySklepu',
  'function usunKopieGrupyProduktuTrwale',
  'Pozostaw 1 i usuń trwale',
  'kanoniczneDuplikatySklepu',
  'artway_produkty_sortowanie_admin',
  'EXTERNAL_ID / SKU (domyślnie)',
  'function widokAdminInfakt',
  '#/admin/infakt/zamowienia',
  '#/admin/infakt/dostawcy',
  'function infaktLadujKoszty',
  'function infaktSynchronizujCenyZakupu',
  'function infaktPrzypiszCeneZakupu',
  'function infaktCenyZakupuPanelHTML',
  'function infaktZapiszDostawcow',
  'inFakt i faktury',
]);

if (!app.includes('const zadaniaAgenta=typeof agentAIAnalizaAktywna==="function"') || !app.includes('"/admin/agent-ai": zadaniaAgenta')) {
  fail('assets/app.js: licznik Agent AI musi uwzględniać wyłącznie aktywne zadania');
}
if (!app.includes('akcja:"#/admin/agent-ai/produkty"') || !app.includes('href:"#/admin/agent-ai/produkty"')) {
  fail('assets/app.js: zadanie wdrożenia produktu musi prowadzić do dedykowanej podstrony Agenta');
}
if (!app.includes('agentOnboardingStatus="processing"') && !app.includes('agentOnboardingStatus:"processing"')) {
  fail('assets/app.js: nowy produkt administratora nie uruchamia priorytetowej kontroli Agenta');
}

requireMarkers('src/backend/store.mjs', storeEntry, [
  "import handler from './lib/store-app.mjs'",
  'export default handler',
]);

requireMarkers('backend aplikacji po podziale domenowym', storeRuntime, [
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
  "'send-status-email'",
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
  "action === 'allegro-fee-preview'",
  'function allegroPodsumujKalkulacjeOplat',
  "'/pricing/offer-fee-preview'",
  'allegro_fee_preview_audit',
  "'supplier-availability-sample'",
  "action === 'seo-daily-run'",
  "action === 'catalog-quality-audit'",
  'function seoWykonajDziennyPlan',
  'function katalogWykonajAudyt',
  'mergeCatalogProducts',
  "action === 'product-url-prepare'",
  'function przygotujPakietProduktuZLinku',
  'function inspectProductUrl',
  'function inspectProductUrlViaReader',
  'function parsujProduktZMarkdown',
  'bezpłatny odczyt zapasowy źródła',
  'function stripHtmlZPodzialem',
  'function produktLinkDuplikaty',
  "action === 'product-sale-availability'",
  'const synchronizujSprzedazZDostepnosciaProducenta',
  'createProductSaleChannelSynchronizer',
  'function stanProducentaZHtml',
  'IdoSell sizes.amount',
  'supplier_availability_audit',
  'producentStanHistoria',
  'priorityChecked',
  'activeDemand',
  "action === 'agent-operations-summary'",
  "'agent-run-safe-checks'",
  'function agentPriorytetWykonawczy',
  'site_function_check',
  'data_sync',
  'agent_action_runs',
  'agentCentrumOperacyjne',
  'function allegroDopasowanieOferty',
  'function allegroSekcjeOpisu',
  'function allegroZnajdzProduktKatalogu',
  "action === 'allegro-order-warehouse-stage'",
  'function allegroAgentPrzetworzZamowienia',
  'completedLocally',
  'function allegroAutoMapujOfertyZKartoteka',
  'function allegroAutoUzupelnijKatalogProduktow',
  'function allegroPowiazanieWiarygodne',
  'function allegroScalSzczegolyOferty',
  "action === 'allegro-auto-maintenance'",
  "action === 'email-send-supplier-order'",
  'function producentEmailZlecenia',
  'supplier_order_email_audit',
  "'artway_producenci'",
  'allegro_catalog_maintenance',
  'ALLEGRO_DEFAULT_PRODUCERS',
  "operator: 'auto-quarantine:name-conflict'",
  'function allegroZapiszZadanieAgentaOferty',
  'function allegroCzekajNaOperacjeOferty',
  'ALLEGRO_AGENT_OFFER_PROCEDURE',
  'agentDecision:',
  'function allegroScalParametryBezDuplikatow',
  'Number(details.draft?.stock?.available)',
  'const ALLEGRO_DEFAULT_OFFER_STOCK = 5',
  'const stockRaw = Number(opt.offerStock',
  "action === 'allegro-offer-settings'",
  "action === 'allegro-apply-offer-defaults'",
  'publication: { republish: true }',
  'allegro_offer_defaults_audit',
  'artway_produkty_katalog',
  'function allegroPrzeliczZamowieniaPoMapowaniu',
  'allegroParameters: autoParameters',
  'const productSourceUrl = sourcePageUrl(product)',
  'const sourceResult = inspectedSourceImages(product, inspection',
  "productSourceUrl ? { ...product, zdjecie: '', zdjecia: [], ...sourceImagePatch }",
  'options.descriptionSections = allegroSekcjeOpisu(preparedProduct',
  "action === 'allegro-send-reply'",
  "action === 'allegro-reply-suggestion'",
  'function allegroAutoReplyWyslanaDlaRozmowy',
  'function allegroTypAutoraWiadomosci',
  'function allegroCzyWiadomoscSprzedawcy',
  'newBuyerMessages',
  'allegroSystemMessages',
  ':first-contact`',
  'function allegroSprawdzKontekstOdpowiedzi',
  '/order/checkout-forms/${encodeURIComponent(found.orderId)}/shipments',
  "action === 'allegro-communication-resolve'",
  'function allegroZastosujStatusyWewnetrzne',
  'allegro_communication_internal_history',
  'allegro_orders_baseline_v2',
  'function allegroWyslijPrzypomnieniaTelegram',
  'humanReplyNeeded',
  'telegramCenter.managedEvent',
  "'zrealizowane'",
  'function infaktKonfiguracja',
  "'X-inFakt-ApiKey'",
  "action === 'infakt-status'",
  "action === 'infakt-invoices'",
  "action === 'infakt-costs'",
  "action === 'infakt-purchase-sync'",
  "action === 'infakt-purchase-match'",
  "action === 'infakt-purchase-unmatch'",
  "action === 'infakt-supplier-access'",
  "action === 'infakt-create-invoice'",
  "action === 'infakt-sync'",
  "'/api/v3/async/invoices.json'",
  'infakt_invoice_links',
  'infakt_supplier_access',
  'infakt_purchase_price_sync',
  'function infaktSynchronizujCenyZakupu',
  'infaktParametryListyKsef',
  "accept: 'application/xml, text/xml, application/json'",
  "'api:costs:read'",
  'send_to_ksef',
  'companyOrdersWithoutInvoice',
  'function allegroOpisPelnyTekst',
  'offersUpdated',
  'feesUpdated',
  'autoUpdateOffers',
  'autoFees',
]);

requireMarkers('src/backend/lib/domain/product-sale-decisions.mjs', productSaleDecisions, [
  'applyProductSaleDecisionBatch',
  "source: 'producent-agent'",
  "'wait_available'",
  "'hide_manual'",
  "'manual_available'",
]);

requireMarkers('src/backend/lib/domain/product-sale-channel-links.mjs', productSaleChannelLinks, [
  'buildProductSaleChannelLinks',
  'createProductSaleChannelSynchronizer',
  'scoreAllegroProductMapping',
  'blockedOfferIds',
  'strong-identity:',
  "status: 'ENDED'",
  'allegroCzekajNaOperacjeOferty',
  'allegro_availability_automation',
]);

requireMarkers('src/backend/lib/allegro-offer-withdrawal-route.mjs', allegroOfferWithdrawal, [
  "'allegro-resolve-duplicate'",
  "'allegro-withdraw-offers'",
  'allegro_duplicate_resolution_audit',
  'allegro_offer_withdrawal_audit',
  "status: 'ENDED'",
  'republish: false',
]);

requireMarkers('src/backend/lib/infakt-purchase.mjs', infaktPurchase, [
  'PRYWATNE_POLA_PRODUKTU',
  'function produktBezDanychPrywatnych',
  'function ustawieniaPubliczneBezDanychPrywatnych',
  'function infaktKsefPozycje',
  'wartość wiersza po rabatach',
]);

requireMarkers('src/backend/lib/domain/telegram-communication.mjs', telegramCommunication, [
  'function telegramEventDecision',
  'function telegramDigestSlot',
  '<b>NAZWA PRODUKTU · KOD · ZAMAWIANA ILOŚĆ</b>',
  'function telegramSupplierQuantity',
  "kind: 'editable-order'",
  'function telegramNaturalIntent',
  'function telegramIncidentId',
  'function editTelegramHtml',
]);

requireMarkers('src/backend/lib/telegram-center.mjs', telegramCenter, [
  'function createTelegramCenter',
  'async function managedEvent',
  'async function dispatch',
  'async function incidentAction',
  'async function refreshDashboard',
  'async function registerWebhook',
  'async function inbound',
]);

requireMarkers('src/backend/lib/telegram-router.mjs', telegramRouter, [
  "'telegram-center-status'",
  "'telegram-settings-save'",
  "'telegram-register-webhook'",
  "'telegram-dispatch'",
  "'telegram-incident-action'",
  "'telegram-delivery-action'",
  "'telegram-dashboard-refresh'",
  "'telegram-send-agent-report'",
]);

requireMarkers('src/backend/cron-telegram-center.mjs', cronTelegramCenter, ["schedule: '*/15 * * * *'", "action=telegram-dispatch"]);
requireMarkers('src/backend/telegram-webhook.mjs', telegramWebhook, ['x-telegram-bot-api-secret-token', 'telegram-inbound-command', 'telegram-incident-action', 'allowedChatIds']);

const ksefTestRows = infaktKsefPozycje(`<?xml version="1.0"?><Faktura><KodWaluty>PLN</KodWaluty><FaWiersz><P_7>Gra testowa 5901234123457</P_7><P_8A>szt.</P_8A><P_8B>2</P_8B><P_9A>100.00</P_9A><P_11>180.00</P_11><P_11A>221.40</P_11A><P_12>23</P_12><Indeks>ABC-123</Indeks></FaWiersz></Faktura>`);
if (ksefTestRows.length !== 1 || ksefTestRows[0].unitNet !== 90 || ksefTestRows[0].unitGross !== 110.7 || ksefTestRows[0].ean !== '5901234123457') {
  fail('inFakt/KSeF: cena jednej sztuki musi uwzględniać rzeczywistą wartość wiersza po rabacie oraz rozpoznawać EAN');
}
const ksefNetDiscountRow = infaktKsefPozycje(`<Faktura><KodWaluty>PLN</KodWaluty><FaWiersz><P_7>Gra</P_7><P_8B>2</P_8B><P_9A>100</P_9A><P_9B>123</P_9B><P_11>180</P_11><P_12>23</P_12></FaWiersz></Faktura>`)[0];
if (!ksefNetDiscountRow || ksefNetDiscountRow.unitGross !== 110.7) {
  fail('inFakt/KSeF: przy rabacie cena brutto musi wynikać z wartości netto wiersza, a nie z ceny katalogowej P_9B');
}

const publicSettingsTest = ustawieniaPubliczneBezDanychPrywatnych({
  artway_produkty_dodane: [{ id: 1, nazwa: 'Gra', cena: 99, cenaZakupu: 40, cenaZakupuHistoria: [{ price: 40 }], allegroCommissionAmount: 10 }],
  artway_produkty_edytowane: { 1: { cena: 99, cenaZakupuDokument: 'FV/1', kosztPakowania: 2 } },
  artway_produkty_katalog: [{ id: 1, cena: 99, cenaZakupuNetto: 32.52 }],
  artway_ustawienia: { kolor: '#fff', domyslneKosztyRentownosci: { kosztPakowania: 2 }, celMarzySklep: 20 },
  artway_agent_ai_historia: [{ produkt: { cenaZakupu: 40 } }],
});
const publicSettingsJson = JSON.stringify(publicSettingsTest);
if (publicSettingsJson.includes('cenaZakupu') || publicSettingsJson.includes('allegroCommissionAmount') || publicSettingsJson.includes('kosztPakowania') || publicSettingsJson.includes('celMarzySklep')) {
  fail('Bezpieczeństwo: publiczne API ustawień ujawnia cenę zakupu albo wewnętrzne dane marżowe');
}
if (publicSettingsTest.artway_produkty_dodane[0].cena !== 99 || publicSettingsTest.artway_ustawienia.kolor !== '#fff') {
  fail('Bezpieczeństwo: filtrowanie danych prywatnych nie może usuwać publicznej ceny sprzedaży ani wyglądu sklepu');
}
if ('artway_agent_ai_historia' in publicSettingsTest) {
  fail('Bezpieczeństwo: publiczne API ustawień nie może zwracać administracyjnej historii Agenta AI');
}

if ((app.match(/<input id="oneProductUrl"/g) || []).length !== 1) {
  fail('assets/app.js: dodawanie produktu z adresu musi mieć dokładnie jedno pole URL');
}

if (/stock:\s*\{\s*available:\s*Math\.max\(0,\s*Number\(opt\.stock\s*\?\?\s*p\.stan\s*\?\?\s*1\)\s*\|\|\s*1\)/.test(store)) {
  fail('src/backend/lib/store-app.mjs: stan 0 nie może być zamieniany na 1 przy wystawianiu Allegro');
}
if (app.includes('badge:produktyBezOferty')) {
  fail('assets/app.js: licznik Allegro nie może zliczać całego katalogu produktów bez oferty');
}
const telegramSupplierFlow = app.slice(app.indexOf('async function agentAIWyslijZlecenieTelegram'), app.indexOf('async function agentAIWyslijZlecenieEmail'));
if (/status\s*:\s*["'`]wysłane na Telegram/.test(telegramSupplierFlow)) {
  fail('assets/app.js: wysyłka podglądu Telegram nie może zamykać ani zmieniać statusu dokumentu producenta');
}
if (!app.includes('async function agentAIUzgodnijPlanZSerwerem') || !app.includes('supplier-order-reconcile') || app.includes('function agentAIUtworzZlecenieProducenta(')) {
  fail('assets/app.js: Plan zatowarowania musi używać kanonicznego uzgadniania serwerowego bez lokalnego generatora szkiców');
}
if (!emailRoute.includes('supplierPlan.beginEmailSend') || !emailRoute.includes('supplierPlan.markEmailResults') || !emailRoute.includes("crypto.createHash('sha256')")) {
  fail('store-app.mjs: wysyłka producenta musi wymagać zatwierdzenia bieżącej wersji i mieć idempotencję');
}
if (!app.includes('została bezpiecznie dezaktywowana') || !app.includes('...(producenciKartoteka||[]).filter(p=>p.active!==false)')) {
  fail('assets/app.js: kartoteka producentów musi chronić aktywne zamówienia i zasilać listę producentów produktów');
}
const internalResolveFlow = allegroCommunicationsRoute.slice(allegroCommunicationsRoute.indexOf("if (action === 'allegro-communication-resolve')"), allegroCommunicationsRoute.indexOf("if (action === 'allegro-communications-settings')"));
if (!internalResolveFlow.includes('sentExternally: false') || /callAllegro|sendTelegram|sendSmtp/.test(internalResolveFlow)) {
  fail('store-app.mjs: wewnętrzne zamknięcie komunikacji nie może wysyłać wiadomości ani wywoływać API Allegro');
}
const duplicateResolutionFlow = allegroOfferWithdrawal;
if (!duplicateResolutionFlow.includes("status: 'ENDED'") || !duplicateResolutionFlow.includes('keepOfferId') || !duplicateResolutionFlow.includes('withdrawOfferIds')) {
  fail('store-app.mjs: centrum duplikatów musi wymagać wyboru oferty pozostawianej i kontrolowanie kończyć wycofywane oferty');
}
if (!store.includes('function allegroKomunikacjaWewnetrznieZalatwiona') || !store.includes('function allegroKomunikacjaWymagaOdpowiedzi') || !store.includes('allegroKomunikacjaWewnetrznieZalatwiona(thread)') || !store.includes('allegroKomunikacjaWewnetrznieZalatwiona(issue)') || !store.includes('allegroKomunikacjaWewnetrznieZalatwiona(item)')) {
  fail('store-app.mjs: Agent, autoresponder i Telegram muszą pomijać sprawy załatwione wewnętrznie');
}
const communicationFilterFlow = app.slice(app.indexOf('function allegroKomunikacjaPasujaca'), app.indexOf('function allegroZaznaczWidocznaKomunikacje'));
if (!communicationFilterFlow.includes('allegroKomunikacjaWymagaOdpowiedzi(item)') || !communicationFilterFlow.includes('allegroKomunikacjaZalatwiona(item)') || !app.includes('wymaga odpowiedzi • bez załatwionych')) {
  fail('assets/app.js: filtr i licznik wymagających odpowiedzi muszą zawsze wykluczać sprawy załatwione wewnętrznie');
}
if (!store.includes("!(thread.newIncomingKeys || []).includes(sourceKey)") || !store.includes("!(issue.newIncomingKeys || []).includes(sourceKey)") || !store.includes("mode: 'first-contact-only'")) {
  fail('store-app.mjs: autoresponder Allegro musi odpowiadać tylko raz na pierwszy kontakt w nowej rozmowie');
}
if (!app.includes('function allegroKontekstOdpowiedziHTML') || !app.includes('Popraw język i układ') || !app.includes('Przygotuj profesjonalną odpowiedź') || !app.includes('Przygotowanie i poprawa tworzą tylko szkic')) {
  fail('assets/app.js: edytor odpowiedzi musi rozdzielać poprawę stylu, poprawę kontekstową i ręczne wysłanie');
}
const feePreviewFlow = store.slice(store.indexOf("action === 'allegro-fee-preview'"), store.indexOf("action === 'allegro-offer-price-change'"));
if (!feePreviewFlow.includes('commissions: summary.commissions') || !feePreviewFlow.includes('quotes: summary.quotes') || !feePreviewFlow.includes('allegroCommissionRate')) {
  fail('store-app.mjs: kalkulator Allegro musi osobno zapisywać prowizję sprzedażową, opłaty cykliczne i stawkę procentową');
}
if (!app.includes('1-variableRate-target') || !app.includes('Po zmianie ceny pobierz prowizję ponownie')) {
  fail('assets/app.js: rekomendowana cena musi uwzględniać koszty procentowe i ostrzegać o ponownym przeliczeniu prowizji');
}
const supplierFlow = productAvailabilityRoute.slice(productAvailabilityRoute.indexOf("if (action === 'supplier-availability-sample')") >= 0 ? productAvailabilityRoute.indexOf("if (action === 'supplier-availability-sample')") : productAvailabilityRoute.indexOf('const settingsRec = await read'));
if (!supplierFlow.includes("status === 'niski'") || !supplierFlow.includes('producentAlertHash') || !supplierFlow.includes('changedAlerts') || !supplierFlow.includes('stanProducentaZrodlo')) {
  fail('store-app.mjs: monitoring producentów musi rozpoznawać niski stan, zapisywać źródło i wysyłać alert tylko po zmianie');
}
if (!supplierFlow.includes("read('orders'") || !supplierFlow.includes("read('allegro_orders'") || !supplierFlow.includes('Math.ceil(limit * 0.75)') || !supplierFlow.includes('allegro30 * 5')) {
  fail('store-app.mjs: monitoring producentów musi zawsze priorytetyzować bestsellery sklepu i Allegro oraz aktywne zamówienia');
}
if (!supplierFlow.includes('syncSaleChannels') || !supplierFlow.includes('saleAutomation')) {
  fail('store-app.mjs: wynik kontroli producenta musi automatycznie ukrywać lub przywracać sprzedaż w sklepie i Allegro');
}
if (!app.includes('Brak u producenta wstrzymuje zakup, ale nie usuwa karty') || !app.includes('function produktSklepuPoId') || !app.includes('function allegroZamowienieZrealizowaneLokalnie')) {
  fail('assets/app.js: niedostępny produkt ma zachować kartę i adres, zakup ma być wstrzymany, a zrealizowane Allegro wyłączone z obsługi');
}
if (!app.includes('Fizyczne korekty ilości wykonujesz wyłącznie w karcie „Stany”') || !app.includes('Błąd pobrania nie jest traktowany jako brak')) {
  fail('assets/app.js: fizyczne stany muszą być oddzielone od dostępności producenta, a błąd strony producenta nie może oznaczać braku produktu');
}
if (!app.includes('Pakownia → Regał A → Półka 3') && !app.includes('Struktura obszarów, regałów i półek')) {
  fail('assets/app.js: lokalizacje magazynu muszą mieć czytelną hierarchię obszar/regał/półka');
}
if (!app.includes('allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI') || !app.includes('Domyślnie zawsze 3,00 zł.')) {
  fail('assets/app.js: dopłata do wysyłki Allegro musi domyślnie wynosić 3 zł w danych i edytorze');
}
if (!app.includes('await allegroSynchronizujPowiazanyProduktPoZapisie(p,{forceFees:true})') || !app.includes('await allegroSynchronizujPowiazanyProduktPoZapisie(next,{forceFees:true})')) {
  fail('assets/app.js: zapis produktu i ustawienie ceny Allegro muszą aktualizować ofertę oraz prowizję');
}
const regularProductAddFlow = app.slice(app.indexOf('function widokAdminProduktyDodaj'), app.indexOf('function widokAdminProduktyZLinku'));
if (!regularProductAddFlow.includes('agentPrepared') || !regularProductAddFlow.includes('sessionStorage.getItem("artway_prefill_product")') || !regularProductAddFlow.includes('else try{sessionStorage.removeItem("artway_prefill_product")')) {
  fail('assets/app.js: wspólny formularz musi być pusty przy zwykłym wejściu i przyjmować wyłącznie jawnie przygotowane dane Agenta');
}
if (app.includes('href="#/admin/produkty/z-linku"')) {
  fail('assets/app.js: dodawanie ręczne i z linku nie może prowadzić do osobnych stron');
}
const productAddSubmitFlow = app.slice(app.indexOf('async function dodajProdukt'), app.indexOf('async function zapiszProduktAdmin'));
if (!productAddSubmitFlow.includes('produktDodawanieAktualizuj(e.target)') || !productAddSubmitFlow.includes('if(!kontrola?.canSubmit)') || !app.includes('data-product-duplicate-fingerprint')) {
  fail('assets/app.js: dodanie produktu musi wymagać aktualnej kontroli duplikatów i gotowości formularza');
}
if (!app.includes('same EAN') && (!app.includes('ten sam EAN') || !app.includes('ten sam link producenta') || !app.includes('ten sam EXTERNAL_ID/SKU') || !app.includes('ten sam kod producenta'))) {
  fail('assets/app.js: kontrola duplikatów musi porównywać EAN, link, EXTERNAL_ID/SKU i kod producenta');
}
const oneLinkRuntime = app.slice(app.indexOf('async function agentAIUruchomJedenLink'), app.indexOf('async function agentAIDodajProduktTylkoZLinku'));
const oneLinkApprovalFlow = app.slice(app.indexOf('async function agentAIPrzygotujProduktZJednegoLinku'), app.indexOf('async function agentAIUruchomJedenLink'));
if (!oneLinkRuntime.includes('agentAIPrzygotujProduktZJednegoLinku(') || !oneLinkApprovalFlow.includes('location.hash="#/admin/produkty/dodaj?agent=1"') || oneLinkApprovalFlow.includes('produktyDodane.push(')) {
  fail('assets/app.js: odczyt linku ma tylko przygotować wspólny formularz i czekać na zatwierdzenie administratora');
}
if (!store.includes('productLinkPackagePreparer(req, target, options)') || !productLinkPackage.includes('prepareOffer(req, baseProduct') || !productLinkPackage.includes('duplicateAudit') || !productLinkPackage.includes('readyForAllegro')) {
  fail('store-app.mjs: import z linku musi w jednym przebiegu przygotować sklep, duplikaty i Allegro');
}
if (!productEditorial.includes("sourceRole: 'facts_only'") || !productEditorial.includes("channels: 'shared_store_allegro_von_halsky'") || !productEditorial.includes("targets: { store: true, vonHalsky: true, allegro: true }") || !productEditorial.includes("layoutPolicy: 'allegro_sections'")) fail('redakcja z linku musi używać źródła wyłącznie jako faktów i jednej wspólnej treści sklepu, Von Halsky oraz Allegro');
if (!store.includes("method: 'PATCH', bodyObj: patch, withMeta: true") || !store.includes("'/pricing/offer-fee-preview'") || !store.includes('allegroDescriptionSections = sections')) {
  fail('store-app.mjs: automatyczna konserwacja musi aktualizować ofertę, opisy i kalkulację opłat');
}
requireMarkers('src/backend/lib/allegro-compliance.mjs', allegroCompliance, [
  'ALLEGRO_COMPLIANCE_POLICY',
  'allegroCheckText',
  'allegroSanitizeDescription',
  'allegroEnforceDraft',
]);
requireMarkers('połączonych assets JS', app, [
  'allegroZgodnoscPanelHTML',
  'allegro-offer-compliance',
  'Blokada przed publikacją jest zawsze włączona',
]);
requireMarkers('połączonych assets CSS', css, [
  '.allegro-compliance-page',
  '.allegro-compliance-guard',
  '.allegro-compliance-table',
]);
if (allegroCheckText('Przed zakupem skontaktuj się z nami i sprawdź dostępność.').ok) fail('kontrola Allegro: nie wykryto kontaktu przed zakupem');
if (allegroCheckText('Napisz do nas: sklep@example.pl albo odwiedź www.example.pl.').ok) fail('kontrola Allegro: nie wykryto danych kontaktowych');
if (!allegroCheckText('Gra rozwija wyobraźnię i sprawność manualną. Zestaw zawiera kolorowe elementy.').ok) fail('kontrola Allegro: poprawny opis został błędnie zablokowany');
const sanitizedAllegroText = allegroSanitizePlainText('Gra rozwija wyobraźnię. Przed zakupem skontaktuj się z nami. Zestaw zawiera elementy do złożenia.');
if (!sanitizedAllegroText.check.ok || sanitizedAllegroText.text.includes('skontaktuj')) fail('kontrola Allegro: niedozwolona treść nie została usunięta');
const enforcedAllegroDraft = allegroEnforceDraft({ name: 'ORIGAMI 3D', description: { sections: [{ items: [{ type: 'TEXT', content: '<p>Wspaniały zestaw.</p><p>Zadzwoń przed zakupem: +48 530 038 914.</p>' }] }] } });
if (!enforcedAllegroDraft.compliance.ok || allegroCheckText(JSON.stringify(enforcedAllegroDraft.draft.description)).ok === false) fail('kontrola Allegro: szkic po oczyszczeniu nadal jest niezgodny');
const richAllegroDescription = allegroSanitizeDescription({ sections: [
  { items: [{ type: 'TEXT', content: '<h1>ORIGAMI 3D</h1><p><b>Kreatywny zestaw</b> rozwija koncentrację.</p><ul><li>Bez kleju</li><li>Przed zakupem skontaktuj się z nami.</li><li>554 elementy</li></ul>' }] },
  { items: [{ type: 'IMAGE', url: 'https://a.allegroimg.com/original/example.jpg' }] },
  { items: [{ type: 'TEXT', content: '<h2>Zawartość</h2><p>Instrukcja i elementy papierowe.</p>' }] },
] });
const richAllegroJson = JSON.stringify(richAllegroDescription.description);
if (!richAllegroDescription.check.ok || !richAllegroDescription.layoutPreserved || richAllegroDescription.description.sections.length !== 3) fail('kontrola Allegro: układ sekcji i zdjęć nie został zachowany');
for (const marker of ['<h1>ORIGAMI 3D</h1>', '<b>Kreatywny zestaw</b>', '<ul>', '<li>Bez kleju</li>', '<li>554 elementy</li>', '<h2>Zawartość</h2>', 'https://a.allegroimg.com/original/example.jpg']) {
  if (!richAllegroJson.includes(marker)) fail(`kontrola Allegro: korekta zgubiła element układu: ${marker}`);
}
if (richAllegroJson.includes('skontaktuj')) fail('kontrola Allegro: niedozwolony punkt listy nie został usunięty');

requireMarkers('src/backend/cron-inpost-sync.mjs', cron, [
  "schedule: '0 */6 * * *'",
  'inpost-sync-all',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('src/backend/cron-allegro-orders.mjs', cronAllegroOrders, [
  "schedule: '5,20,35,50 * * * *'",
  'allegro-sync-orders',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('src/backend/cron-allegro-communications.mjs', cronAllegroCommunications, [
  "schedule: '*/15 * * * *'",
  'allegro-sync-communications',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('src/backend/cron-allegro-offers.mjs', cronAllegroOffers, [
  "schedule: '25 */6 * * *'",
  'allegro-sync-offers',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('src/backend/cron-supplier-availability.mjs', cronSupplierAvailability, [
  "schedule: '40 */6 * * *'",
  'supplier-availability-sample',
  'scheduled-supplier-availability',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('src/backend/cron-infakt-sync.mjs', cronInfaktSync, [
  "schedule: '17 * * * *'",
  'infakt-sync',
  'INFAKT_API_KEY',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('src/backend/cron-seo-daily.mjs', cronSeoDaily, [
  "schedule: '15 4 * * *'",
  'seo-daily-run',
  'scheduled-seo-daily',
  'catalog-quality-audit',
  'scheduled-catalog-quality',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('src/backend/sitemap.mjs', sitemap, [
  'sitemaps.org/schemas/sitemap',
  'mergeCatalogProducts',
  'artway_produkty_ukryte',
  '/produkt/',
]);

requireMarkers('src/backend/google-products.mjs', googleProducts, [
  'base.google.com/ns/1.0',
  'automaticSeo',
  "productIsUnavailable(product, availability) ? 'out_of_stock' : 'in_stock'",
  '<g:price>',
  'mergeCatalogProducts',
  'artway_dostepnosc',
  'x-artway-items',
]);

requireMarkers('robots.txt', robots, [
  'User-agent: *',
  'Sitemap: https://artwaytm.pl/sitemap.xml',
]);

try {
  new Function(app);
} catch (error) {
  fail(`połączone assets JS: błąd składni: ${error.message}`);
}

for (const file of ['src/backend/store.mjs', 'src/backend/lib/store-app.mjs', 'src/backend/lib/allegro-compliance.mjs', 'src/backend/cron-inpost-sync.mjs', 'src/backend/cron-allegro-orders.mjs', 'src/backend/cron-allegro-communications.mjs', 'src/backend/cron-allegro-offers.mjs', 'src/backend/cron-supplier-availability.mjs', 'src/backend/cron-infakt-sync.mjs', 'src/backend/cron-seo-daily.mjs', 'src/backend/sitemap.mjs', 'src/backend/google-products.mjs']) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    fail(`${file}: błąd składni`);
    if (error.stderr) console.error(String(error.stderr));
  }
}

if (!process.exitCode) console.log(`✅ Artway check OK — wersja ${version}, pliki rozbite i funkcje krytyczne obecne.`);
