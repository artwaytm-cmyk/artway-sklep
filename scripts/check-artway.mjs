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
  'netlify/functions/cron-supplier-availability.mjs',
  'netlify/functions/cron-infakt-sync.mjs',
  'netlify/functions/cron-seo-daily.mjs',
  'netlify/functions/sitemap.mjs',
  'netlify/functions/google-products.mjs',
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
const css = read('assets/styles.css');
const app = read('assets/app.js');
const storeEntry = read('netlify/functions/store.mjs');
const store = read('netlify/functions/lib/store-app.mjs');
const cron = read('netlify/functions/cron-inpost-sync.mjs');
const cronAllegroOrders = read('netlify/functions/cron-allegro-orders.mjs');
const cronAllegroCommunications = read('netlify/functions/cron-allegro-communications.mjs');
const cronAllegroOffers = read('netlify/functions/cron-allegro-offers.mjs');
const cronSupplierAvailability = read('netlify/functions/cron-supplier-availability.mjs');
const cronInfaktSync = read('netlify/functions/cron-infakt-sync.mjs');
const cronSeoDaily = read('netlify/functions/cron-seo-daily.mjs');
const sitemap = read('netlify/functions/sitemap.mjs');
const googleProducts = read('netlify/functions/google-products.mjs');
const robots = read('robots.txt');

const version = index.match(/<meta\s+name=["']artway-version["']\s+content=["']([^"']+)/i)?.[1] || '';
if (!version) fail('index.html: brak meta artway-version');

requireMarkers('index.html', index, [
  '<main id="widok">',
  'PUBLIC_SETTINGS_START',
  'assets/styles.css',
  'assets/app.js',
  `/assets/styles.css?v=${version}`,
  `/assets/app.js?v=${version}`,
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
  '.product-source-evidence',
  '.seo-hero',
  '.seo-technical-grid',
  '.modal',
]);

requireMarkers('assets/app.js', app, [
  'function renderuj',
  'function zlozZamowienie',
  'function widokAdmin',
  'function widokAdminMagazyn',
  'function magazynSzukajProdukty',
  'function asortymentSzukajProdukty',
  'function widokAdminSEO',
  'function seoUruchomPlanDzienny',
  'function seoEksportujFeedGoogleCSV',
  'function seoAktualizujMetaDlaTrasy',
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
  'function producenciKartotekaPanelHTML',
  'artway_producenci',
  'Nowa wersja powstaje dopiero po zatwierdzeniu i skutecznej wysyłce e-mailem',
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
  'Generator struktury',
  'Lokalizacja nadrzędna',
  'Centrum kontroli zapasu',
  'Bestsellery najpierw',
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
  'function agentAIZapiszProduktZJednegoLinku',
  'Jedno pole • pełna automatyka',
  'Zweryfikowane źródło produktu',
  '#/admin/produkty/z-linku',
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

if (!app.includes('"/admin/agent-ai": agentAIAnalizaAktywna(agentAIAnaliza()).length')) {
  fail('assets/app.js: licznik Agent AI musi uwzględniać wyłącznie aktywne zadania');
}
if (!app.includes('akcja:"#/admin/agent-ai/produkty"') || !app.includes('href:"#/admin/agent-ai/produkty"')) {
  fail('assets/app.js: zadanie wdrożenia produktu musi prowadzić do dedykowanej podstrony Agenta');
}
if (!app.includes('agentOnboardingStatus="processing"') && !app.includes('agentOnboardingStatus:"processing"')) {
  fail('assets/app.js: nowy produkt administratora nie uruchamia priorytetowej kontroli Agenta');
}

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
  "action === 'allegro-resolve-duplicate'",
  "action === 'allegro-fee-preview'",
  'function allegroPodsumujKalkulacjeOplat',
  "'/pricing/offer-fee-preview'",
  'allegro_fee_preview_audit',
  "action === 'supplier-availability-sample'",
  "action === 'seo-daily-run'",
  'function seoWykonajDziennyPlan',
  "action === 'product-url-prepare'",
  'function przygotujPakietProduktuZLinku',
  'export async function inspectProductUrl',
  'export async function inspectProductUrlViaReader',
  'function parsujProduktZMarkdown',
  'bezpłatny odczyt zapasowy źródła',
  'function stripHtmlZPodzialem',
  'function produktLinkDuplikaty',
  "action === 'product-sale-availability'",
  'function synchronizujSprzedazZDostepnosciaProducenta',
  'allegro_availability_automation',
  "source: 'producent-agent'",
  'stock: { available: 0 }',
  'function stanProducentaZHtml',
  'IdoSell sizes.amount',
  'supplier_availability_audit',
  'producentStanHistoria',
  'priorityChecked',
  'activeDemand',
  "action === 'agent-operations-summary'",
  "action === 'agent-run-safe-checks'",
  'function agentPriorytetWykonawczy',
  'site_function_check',
  'data_sync',
  'agent_action_runs',
  "action === 'telegram-send-agent-report'",
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
  "...(!sourceImages.length ? {} : { zdjecie: sourceImages[0]",
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
  'allegro_duplicate_resolution_audit',
  'allegro_orders_baseline_v2',
  'function allegroWyslijPrzypomnieniaTelegram',
  'humanReplyNeeded',
  "telegramKomorka('KOD', 15)",
  "telegramKomorka('NAZWA', 30)",
  "telegramKomorka('POTRZEBNA ILOŚĆ', 16)",
  "'zrealizowane'",
  'function infaktKonfiguracja',
  "'X-inFakt-ApiKey'",
  "action === 'infakt-status'",
  "action === 'infakt-invoices'",
  "action === 'infakt-costs'",
  "action === 'infakt-purchase-sync'",
  "action === 'infakt-purchase-match'",
  "action === 'infakt-supplier-access'",
  "action === 'infakt-create-invoice'",
  "action === 'infakt-sync'",
  "'/api/v3/async/invoices.json'",
  'infakt_invoice_links',
  'infakt_supplier_access',
  'infakt_purchase_price_sync',
  'function infaktKsefPozycje',
  'function infaktSynchronizujCenyZakupu',
  'wspólny limit 6 listowań kosztów i przychodów na godzinę',
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

if ((app.match(/<input id="oneProductUrl"/g) || []).length !== 1) {
  fail('assets/app.js: dodawanie produktu z adresu musi mieć dokładnie jedno pole URL');
}

if (/stock:\s*\{\s*available:\s*Math\.max\(0,\s*Number\(opt\.stock\s*\?\?\s*p\.stan\s*\?\?\s*1\)\s*\|\|\s*1\)/.test(store)) {
  fail('netlify/functions/lib/store-app.mjs: stan 0 nie może być zamieniany na 1 przy wystawianiu Allegro');
}
if (app.includes('badge:produktyBezOferty')) {
  fail('assets/app.js: licznik Allegro nie może zliczać całego katalogu produktów bez oferty');
}
const telegramSupplierFlow = app.slice(app.indexOf('async function agentAIWyslijZlecenieTelegram'), app.indexOf('async function agentAIWyslijZlecenieEmail'));
if (/status\s*:\s*["'`]wysłane na Telegram/.test(telegramSupplierFlow)) {
  fail('assets/app.js: wysyłka podglądu Telegram nie może zamykać ani zmieniać statusu dokumentu producenta');
}
if (!app.includes('partial=(Array.isArray(agentAIZlecenia)') || !app.includes('agentAIStatusRoboczyProducenta(z.status)')) {
  fail('assets/app.js: brak blokady nowego dokumentu oraz scalania bieżącego zamówienia producenta');
}
if (!store.includes("['zaakceptowane', 'częściowo wysłane e-mailem'].includes(status)") || !store.includes('approvalRevision !== revision') || !store.includes("crypto.createHash('sha256')")) {
  fail('store-app.mjs: wysyłka producenta musi wymagać zatwierdzenia bieżącej wersji i mieć idempotencję');
}
if (!app.includes('została bezpiecznie dezaktywowana') || !app.includes('...(producenciKartoteka||[]).filter(p=>p.active!==false)')) {
  fail('assets/app.js: kartoteka producentów musi chronić aktywne zamówienia i zasilać listę producentów produktów');
}
const internalResolveFlow = store.slice(store.indexOf("action === 'allegro-communication-resolve'"), store.indexOf("action === 'allegro-communications-settings'"));
if (!internalResolveFlow.includes('sentExternally: false') || /allegroWywolaj|wyslijTelegramHtml|wyslijEmailSMTP/.test(internalResolveFlow)) {
  fail('store-app.mjs: wewnętrzne zamknięcie komunikacji nie może wysyłać wiadomości ani wywoływać API Allegro');
}
const duplicateResolutionFlow = store.slice(store.indexOf("action === 'allegro-resolve-duplicate'"), store.indexOf("action === 'allegro-offer-price-change'"));
if (!duplicateResolutionFlow.includes("status: 'ENDED'") || !duplicateResolutionFlow.includes('keepOfferId') || !duplicateResolutionFlow.includes('withdrawOfferIds')) {
  fail('store-app.mjs: centrum duplikatów musi wymagać wyboru oferty pozostawianej i kontrolowanie kończyć wycofywane oferty');
}
if (!store.includes("if (thread.internalResolved)") || !store.includes("if (issue.internalResolved)") || !store.includes("if (item.internalResolved)")) {
  fail('store-app.mjs: Agent, autoresponder i Telegram muszą pomijać sprawy załatwione wewnętrznie');
}
if (!store.includes("!(thread.newIncomingKeys || []).includes(sourceKey)") || !store.includes("!(issue.newIncomingKeys || []).includes(sourceKey)") || !store.includes("mode: 'first-contact-only'")) {
  fail('store-app.mjs: autoresponder Allegro musi odpowiadać tylko raz na pierwszy kontakt w nowej rozmowie');
}
if (!app.includes('function allegroKontekstOdpowiedziHTML') || !app.includes('Sprawdź zamówienie i przygotuj')) {
  fail('assets/app.js: propozycja odpowiedzi musi pokazywać kontrolę zamówienia, wysyłki i magazynu przed ręcznym wysłaniem');
}
const feePreviewFlow = store.slice(store.indexOf("action === 'allegro-fee-preview'"), store.indexOf("action === 'allegro-offer-price-change'"));
if (!feePreviewFlow.includes('commissions: summary.commissions') || !feePreviewFlow.includes('quotes: summary.quotes') || !feePreviewFlow.includes('allegroCommissionRate')) {
  fail('store-app.mjs: kalkulator Allegro musi osobno zapisywać prowizję sprzedażową, opłaty cykliczne i stawkę procentową');
}
if (!app.includes('1-variableRate-target') || !app.includes('Po zmianie ceny pobierz prowizję ponownie')) {
  fail('assets/app.js: rekomendowana cena musi uwzględniać koszty procentowe i ostrzegać o ponownym przeliczeniu prowizji');
}
const supplierFlow = store.slice(store.indexOf("action === 'supplier-availability-sample'"), store.indexOf("action === 'allegro-map-offer'"));
if (!supplierFlow.includes("status === 'niski'") || !supplierFlow.includes('producentAlertHash') || !supplierFlow.includes('changedAlerts') || !supplierFlow.includes('stanProducentaZrodlo')) {
  fail('store-app.mjs: monitoring producentów musi rozpoznawać niski stan, zapisywać źródło i wysyłać alert tylko po zmianie');
}
if (!supplierFlow.includes("czytaj('orders'") || !supplierFlow.includes("czytaj('allegro_orders'") || !supplierFlow.includes('Math.ceil(limit * 0.75)') || !supplierFlow.includes('allegro30 * 5')) {
  fail('store-app.mjs: monitoring producentów musi zawsze priorytetyzować bestsellery sklepu i Allegro oraz aktywne zamówienia');
}
if (!supplierFlow.includes('synchronizujSprzedazZDostepnosciaProducenta') || !supplierFlow.includes('saleAutomation')) {
  fail('store-app.mjs: wynik kontroli producenta musi automatycznie ukrywać lub przywracać sprzedaż w sklepie i Allegro');
}
if (!app.includes('.filter(p => !produktOznaczonyNiedostepny(p))') || !app.includes('function allegroZamowienieZrealizowaneLokalnie')) {
  fail('assets/app.js: niedostępny produkt ma być ukryty w sklepie, a zrealizowane Allegro wyłączone z obsługi');
}
if (!app.includes('brak lokalnego stanu nie wyłącza produktu ze sprzedaży') || !app.includes('Błąd pobrania nie jest traktowany jako brak')) {
  fail('assets/app.js: stan lokalny musi być pomocniczy, a błąd strony producenta nie może oznaczać braku produktu');
}
if (!app.includes('strefa → regał → półka → miejsce') && !app.includes('strefy przez regał i półkę do konkretnego miejsca')) {
  fail('assets/app.js: lokalizacje magazynu muszą mieć czytelną hierarchię strefa/regał/półka/miejsce');
}
if (!app.includes('allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI') || !app.includes('Domyślnie zawsze 3,00 zł.')) {
  fail('assets/app.js: dopłata do wysyłki Allegro musi domyślnie wynosić 3 zł w danych i edytorze');
}
if (!app.includes('await allegroSynchronizujPowiazanyProduktPoZapisie(p,{forceFees:true})') || !app.includes('await allegroSynchronizujPowiazanyProduktPoZapisie(next,{forceFees:true})')) {
  fail('assets/app.js: zapis produktu i ustawienie ceny Allegro muszą aktualizować ofertę oraz prowizję');
}
const regularProductAddFlow = app.slice(app.indexOf('function widokAdminProduktyDodaj'), app.indexOf('function widokAdminProduktyZLinku'));
if (regularProductAddFlow.includes('sessionStorage.getItem("artway_prefill_product")') || !regularProductAddFlow.includes('sessionStorage.removeItem("artway_prefill_product")')) {
  fail('assets/app.js: zwykły formularz „Dodaj produkt” musi usuwać stare dane Agenta i zawsze otwierać pustą kartotekę');
}
const productUrlPrepareFlow = store.slice(store.indexOf('async function przygotujPakietProduktuZLinku'), store.indexOf('function allegroNormTekst'));
if (!productUrlPrepareFlow.includes('allegroDraftZAutoKategoria') || !productUrlPrepareFlow.includes('duplicateAudit') || !productUrlPrepareFlow.includes('readyForAllegro')) {
  fail('store-app.mjs: import z linku musi w jednym przebiegu przygotować sklep, duplikaty i Allegro');
}
if (!store.includes("method: 'PATCH', bodyObj: patch, withMeta: true") || !store.includes("'/pricing/offer-fee-preview'") || !store.includes('allegroDescriptionSections = sections')) {
  fail('store-app.mjs: automatyczna konserwacja musi aktualizować ofertę, opisy i kalkulację opłat');
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

requireMarkers('netlify/functions/cron-supplier-availability.mjs', cronSupplierAvailability, [
  "schedule: '40 */6 * * *'",
  'supplier-availability-sample',
  'scheduled-supplier-availability',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('netlify/functions/cron-infakt-sync.mjs', cronInfaktSync, [
  "schedule: '17 * * * *'",
  'infakt-sync',
  'INFAKT_API_KEY',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('netlify/functions/cron-seo-daily.mjs', cronSeoDaily, [
  "schedule: '15 4 * * *'",
  'seo-daily-run',
  'scheduled-seo-daily',
  'ARTWAY_ADMIN_TOKEN',
]);

requireMarkers('netlify/functions/sitemap.mjs', sitemap, [
  'sitemaps.org/schemas/sitemap',
  'artway_produkty_katalog',
  'artway_produkty_ukryte',
  '/produkt/',
]);

requireMarkers('netlify/functions/google-products.mjs', googleProducts, [
  'base.google.com/ns/1.0',
  '<g:availability>in_stock</g:availability>',
  '<g:price>',
  'artway_produkty_katalog',
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
  fail(`assets/app.js: błąd składni: ${error.message}`);
}

for (const file of ['netlify/functions/store.mjs', 'netlify/functions/lib/store-app.mjs', 'netlify/functions/cron-inpost-sync.mjs', 'netlify/functions/cron-allegro-orders.mjs', 'netlify/functions/cron-allegro-communications.mjs', 'netlify/functions/cron-allegro-offers.mjs', 'netlify/functions/cron-supplier-availability.mjs', 'netlify/functions/cron-infakt-sync.mjs', 'netlify/functions/cron-seo-daily.mjs', 'netlify/functions/sitemap.mjs', 'netlify/functions/google-products.mjs']) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    fail(`${file}: błąd składni`);
    if (error.stderr) console.error(String(error.stderr));
  }
}

if (!process.exitCode) console.log(`✅ Artway check OK — wersja ${version}, pliki rozbite i funkcje krytyczne obecne.`);
