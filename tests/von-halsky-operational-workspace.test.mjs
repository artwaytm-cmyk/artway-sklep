import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Von Halsky używa lekkich, stronicowanych odczytów operacyjnych', async () => {
  const [repository, route, workspace] = await Promise.all([
    read('src/backend/lib/domain/von-halsky-state-repository.mjs'),
    read('src/backend/lib/von-halsky-route.mjs'),
    read('src/frontend/11b-von-halsky-workspace.js'),
  ]);
  assert.match(route, /von-halsky-dashboard-summary/);
  assert.match(route, /von-halsky-records/);
  assert.match(route, /von-halsky-product-queue/);
  assert.match(repository, /vonHalskyRecordOrderBy/);
  assert.match(repository, /pagination: 'cursor'/);
  assert.match(repository, /VON_HALSKY_PRODUCT_QUEUE_SQL/);
  assert.match(repository, /readSnapshot\(pool, namespace, fallback, \['diagnostics'\]\)/);
  assert.match(workspace, /vonHalskyPobierzKolejkeProduktow/);
  assert.match(workspace, /von-halsky-product-queue/);
  assert.match(route, /selection: url\.searchParams\.get\('selection'\)/);
  assert.match(repository, /selectedIds: selected\.rows/);
  assert.match(repository, /stage === 'sprzedaz'/);
  assert.match(repository, /selling',COUNT\(\*\) FILTER\(WHERE remote_status='PUBLISHED'\)/);
});

test('pulpit i zamówienia Von Halsky mają jeden responsywny standard operacyjny', async () => {
  const [operations, workspace, workspaceStyle, pickingStyle, sharedNavigation] = await Promise.all([
    read('src/frontend/11d-von-halsky-operations-workspace.js'),
    read('src/frontend/11b-von-halsky-workspace.js'),
    read('src/styles/37-von-halsky-workspace.css'),
    read('src/styles/37a-von-halsky-picking.css'),
    read('src/frontend/08-admin-navigation.js'),
  ]);
  const style = `${workspaceStyle}\n${pickingStyle}`;
  assert.match(operations, /function vonHalskyDashboardWorkspaceHTML/);
  assert.match(operations, /function vonHalskyOrdersWorkspaceHTML/);
  assert.match(operations, /von-halsky-dashboard-summary/);
  assert.match(operations, /von-halsky-records/);
  assert.match(operations, /von-halsky-order-shipment-preview/);
  assert.match(operations, /von-halsky-order-shipment-create/);
  assert.match(operations, /von-halsky-order-shipment-status/);
  assert.match(operations, /Podgląd i druk/);
  assert.match(operations, /inpostOtworzPodgladEtykiety/);
  assert.match(operations, /von-halsky-order-detail-grid/);
  assert.match(operations, /von-halsky-label-console/);
  assert.doesNotMatch(operations, /b64toBlob/);
  assert.match(operations, /Etap realizacji/);
  assert.match(operations, /fulfillment:/);
  assert.match(operations, /function vonHalskyEtapyZamowienHTML/);
  assert.match(operations, /function vonHalskyCentrumZamowienHTML/);
  assert.match(operations, /function vonHalskyZamowieniaKartyHTML/);
  assert.match(operations, /Centrum realizacji • Von Halsky/);
  assert.match(operations, /Zamówienia i kontakt z klientem/);
  assert.match(operations, /Nowe/);
  assert.match(operations, /Zrealizowane/);
  assert.match(operations, /Anulowane \/ zwrócone/);
  assert.match(operations, /function vonHalskyWyczyscFiltryRekordow/);
  assert.match(operations, /Sposób doręczenia/);
  assert.match(operations, /Najwyższa wartość/);
  assert.match(operations, /von-halsky-mini-flow/);
  assert.match(operations, /Etykieta/);
  assert.match(operations, /function vonHalskyRozpiskaZamowienia/);
  assert.match(operations, /function vonHalskyZaladujKartotekiZamowienia/);
  assert.match(operations, /product-catalog-query/);
  assert.match(operations, /Produkty, stan i położenie — tylko odczyt/);
  assert.doesNotMatch(operations, /function vonHalskyPrzypiszPolkePozycji/);
  assert.doesNotMatch(operations, /warehouse-product-location-assign/);
  assert.match(workspace, /period:"wszystkie"/);
  assert.match(workspace, /delivery:"wszystkie"/);
  assert.match(style, /\.von-halsky-order-stage-grid/);
  assert.match(style, /\.von-halsky-order-filter-panel/);
  assert.match(style, /\.von-halsky-order-results-head/);
  assert.match(style, /\.von-halsky-order-status\.completed/);
  assert.match(style, /\.von-halsky-picking-overview/);
  assert.match(style, /\.von-halsky-picking-procurement/);
  assert.doesNotMatch(style, /\.von-halsky-picking-location-form/);
  assert.match(operations, /replacementConfirmed/);
  assert.match(operations, /Korekta \/ ponowne nadanie/);
  assert.match(operations, /function vonHalskyKomunikacjaHTML/);
  assert.match(operations, /function vonHalskyHistoriaOperacjiHTML/);
  assert.match(operations, /von-halsky-order-message-send/);
  assert.match(operations, /Potwierdzam wysłanie jednej wiadomości/);
  assert.match(operations, /Von Halsky nie udostępnia osobnego czatu API/);
  assert.match(operations, /von-halsky-order-message-draft/);
  assert.match(operations, /Kreator wiadomości Agent AI/);
  assert.match(operations, /Przyjęta przez serwer pocztowy/);
  assert.match(operations, /doręczenie niepotwierdzone/);
  assert.match(operations, /Kopiuj ID wiadomości/);
  assert.match(operations, /Nie można potwierdzić pełnej listy reklamacji/);
  assert.match(operations, /To nie oznacza, że spraw klienta nie ma/);
  assert.match(operations, /Lista jest obecnie niepełna/);
  assert.match(workspace, /sourceHealth/);
  assert.match(operations, /Sprawy klienta/);
  assert.match(operations, /Zwroty, reklamacje i kontakt/);
  assert.match(operations, /function vonHalskySprawaNawigacjaHTML/);
  assert.match(operations, /function vonHalskyPosprzedazHTML/);
  assert.match(operations, /function vonHalskyOtworzSpraweZamowienia/);
  assert.match(operations, /Zwrot i reklamacja/);
  assert.match(operations, /data-case-section="communication"/);
  assert.match(operations, /data-case-section="after-sales"/);
  assert.match(operations, /data-template="return"/);
  assert.match(operations, /data-template="claim"/);
  assert.match(operations, /function vonHalskyRozliczenieZamowieniaHTML/);
  assert.match(operations, /Płatność i opłaty/);
  assert.doesNotMatch(operations, /href="#\/admin\/magazyn\/plan"/);
  assert.doesNotMatch(operations, /href="#\/admin\/magazyn\/stany"/);
  assert.ok(operations.indexOf('vonHalskyRozliczenieZamowieniaHTML(order)') < operations.indexOf('aria-label="Etap realizacji"'));
  assert.match(operations, /adminNaglowekListyZamowienHTML/);
  assert.match(sharedNavigation, /Eksport CSV/);
  assert.match(operations, /vonHalskyAktualizujPulpitDOM/);
  assert.match(operations, /aria-busy/);
  assert.match(operations, /current\.replaceChildren\(\.\.\.next\.childNodes\)/);
  assert.match(operations, /vonHalskyAktualizujPulpitDOM\(\{dashboard=true\}=\{\}\)/);
  assert.doesNotMatch(operations, /vonHalskyPodmienWyspe\("\[data-vh-dashboard\]"/);
  assert.doesNotMatch(operations, /\bconfirm\(/);
  assert.doesNotMatch(operations, /\bprompt\(/);
  assert.match(workspace, /typeof vonHalskyOrdersWorkspaceHTML/);
  assert.match(workspace, /typeof vonHalskyDashboardWorkspaceHTML/);
  assert.match(workspace, /typeof vonHalskyAktualizujPulpitDOM/);
  assert.ok(workspace.indexOf('label:"📦 Zamówienia"')<workspace.indexOf('label:"🏷️ Wystawianie"'));
  assert.match(style, /\.von-halsky-dashboard-kpis/);
  assert.match(style, /\.von-halsky-dashboard-pro\.is-refreshing::after/);
  assert.match(style, /\.von-halsky-order-tabbar/);
  assert.match(style, /\.von-halsky-fulfillment-flow/);
  assert.match(style, /\.von-halsky-replacement/);
  assert.match(style, /\.von-halsky-order-command-center/);
  assert.match(style, /\.von-halsky-order-ticket/);
  assert.match(style, /\.von-halsky-communication-card/);
  assert.match(style, /\.von-halsky-order-timeline/);
  assert.match(style, /\.von-halsky-case-nav/);
  assert.match(style, /\.von-halsky-case-panel/);
  assert.match(style, /\.von-halsky-case-list/);
  assert.match(style, /\.von-halsky-after-sales-card/);
  assert.match(style, /@media\(max-width:700px\)/);
});

test('statystyki dzienne Von Halsky nie używają kolidującego aliasu SQL day', async () => {
  const repository = await read('src/backend/lib/domain/von-halsky-state-repository.mjs');
  assert.match(repository, /AS sales_day/);
  assert.match(repository, /day: row\.sales_day/);
  assert.doesNotMatch(repository, /\)\s+day,\s*\n\s*COUNT/);
});

test('główny pulpit administratora pokazuje trzeci kanał sprzedaży', async () => {
  const [dashboard, style] = await Promise.all([
    read('src/frontend/19-admin-dashboard.js'),
    read('src/styles/13-dashboard.css'),
  ]);
  assert.match(dashboard, /adminPulpitLadujVonHalsky/);
  assert.match(dashboard, /von-halsky-dashboard-summary/);
  assert.match(dashboard, /Trzy kanały sprzedaży/);
  assert.match(dashboard, /sprzedazVonHalsky7/);
  assert.match(dashboard, /Von Halsky do obsługi/);
  assert.match(style, /\.dashboard-chart-legend \.von-halsky/);
});

test('niezmienione uzgodnienie nie wymusza nowej rewizji ani wpisu diagnostycznego', async () => {
  const [catalogRoute, reconciliation] = await Promise.all([
    read('src/backend/lib/domain/von-halsky-catalog-route.mjs'),
    read('src/backend/lib/domain/von-halsky-catalog-reconciliation.mjs'),
  ]);
  assert.match(catalogRoute, /reconciliationRevision: channelChanged/);
  assert.match(catalogRoute, /if \(channelChanged \|\| source !== 'background-worker'\)/);
  assert.match(reconciliation, /patchChangesProduct/);
  assert.match(reconciliation, /counts\.unchanged/);
});

test('ustawienia i edytor pokazują aktualny kontrakt, błędy oraz komplet pól naprawczych', async () => {
  const [settings, editor, workspace, catalogRoute] = await Promise.all([
    read('src/frontend/11d-von-halsky-settings-workspace.js'),
    read('src/frontend/12-product-editor-workspace.js'),
    read('src/frontend/11b-von-halsky-workspace.js'),
    read('src/backend/lib/domain/von-halsky-catalog-route.mjs'),
  ]);
  assert.match(settings, /Kanał zdarzeń API/);
  assert.match(settings, /name="defaultStock"/);
  assert.match(settings, /SOLDOUT wraca przez aktualizację stanu/);
  assert.doesNotMatch(settings, /Sekret webhooka/);
  for (const field of ['vonHalskyGpsrName', 'vonHalskyGpsrEmail', 'vonHalskyGpsrAddress', 'vonHalskyGpsrPhone', 'vonHalskySafetyInformation', 'vonHalskyBatchNumber', 'vonHalskyCeMarking']) {
    assert.match(editor, new RegExp(`name="${field}"`));
  }
  assert.match(editor, /Dokładny komunikat Von Halsky/);
  assert.match(workspace, /Popraw i ponów/);
  assert.match(workspace, /von-halsky-offer-resume/);
  assert.match(workspace, /Wyprzedane — SOLDOUT/);
  assert.match(catalogRoute, /api\.updateOffer\(remote\.offerId/);
  assert.match(catalogRoute, /remoteIdentityConflicts/);
});
