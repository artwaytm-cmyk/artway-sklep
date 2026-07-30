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
  assert.match(repository, /ORDER BY updated_at DESC,record_id/);
  assert.match(repository, /pagination: 'cursor'/);
  assert.match(repository, /VON_HALSKY_PRODUCT_QUEUE_SQL/);
  assert.match(repository, /readSnapshot\(pool, namespace, fallback, \['diagnostics'\]\)/);
  assert.match(workspace, /vonHalskyPobierzKolejkeProduktow/);
  assert.match(workspace, /von-halsky-product-queue/);
});

test('pulpit i zamówienia Von Halsky mają jeden responsywny standard operacyjny', async () => {
  const [operations, workspace, style] = await Promise.all([
    read('src/frontend/11d-von-halsky-operations-workspace.js'),
    read('src/frontend/11b-von-halsky-workspace.js'),
    read('src/styles/37-von-halsky-workspace.css'),
  ]);
  assert.match(operations, /function vonHalskyDashboardWorkspaceHTML/);
  assert.match(operations, /function vonHalskyOrdersWorkspaceHTML/);
  assert.match(operations, /von-halsky-dashboard-summary/);
  assert.match(operations, /von-halsky-records/);
  assert.match(operations, /Eksport CSV/);
  assert.match(operations, /vonHalskyAktualizujPulpitDOM/);
  assert.match(operations, /aria-busy/);
  assert.match(operations, /vonHalskyPodmienWyspe\("\[data-vh-dashboard\]"/);
  assert.doesNotMatch(operations, /\bconfirm\(/);
  assert.doesNotMatch(operations, /\bprompt\(/);
  assert.match(workspace, /typeof vonHalskyOrdersWorkspaceHTML/);
  assert.match(workspace, /typeof vonHalskyDashboardWorkspaceHTML/);
  assert.match(workspace, /typeof vonHalskyAktualizujPulpitDOM/);
  assert.ok(workspace.indexOf('label:"📦 Zamówienia"')<workspace.indexOf('label:"🏷️ Wystawianie"'));
  assert.match(style, /\.von-halsky-dashboard-kpis/);
  assert.match(style, /\.von-halsky-dashboard-pro\.is-refreshing::after/);
  assert.match(style, /\.von-halsky-order-tabbar/);
  assert.match(style, /@media\(max-width:700px\)/);
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
