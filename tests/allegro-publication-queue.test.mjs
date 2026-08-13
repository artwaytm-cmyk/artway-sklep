import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicationRepairReadbackConfirmed } from '../src/backend/lib/allegro-publication-queue-route.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('publikacja Allegro ma osobną trwałą kolejkę z dzierżawą i idempotentnym workerem', async () => {
  const migration = await read('db/migrations/0021_allegro_publication_queue.sql');
  const route = await read('src/backend/lib/allegro-publication-queue-route.mjs');
  const preparationRoute = await read('src/backend/lib/allegro-preparation-route.mjs');
  const preparationQueue = await read('src/backend/lib/domain/allegro-preparation-postgres-queue.mjs');
  const worker = await read('scripts/run-agent-panel-worker.mjs');
  const store = await read('src/backend/lib/store-app.mjs');
  for (const relation of [
    'artway_allegro_publication_batches',
    'artway_allegro_publication_tasks',
    'artway_allegro_publication_queue_state',
  ]) assert.match(migration, new RegExp(relation));
  assert.match(migration, /FOR EACH ROW EXECUTE FUNCTION artway_notify_allegro_publication_work/);
  assert.match(migration, /WHERE status IN \('queued','running'\)/);
  assert.match(route, /FOR UPDATE SKIP LOCKED/);
  assert.match(route, /lease_until=NOW\(\)\+INTERVAL '8 minutes'/);
  assert.match(route, /tracked\.length !== requested\.length/);
  assert.match(route, /allegro-publication-queue-control/);
  assert.match(route, /allegro-publication-decision/);
  assert.match(route, /decorateAllegroPublicationStatus/);
  assert.match(route, /prepareProducts\(\[product\]/);
  assert.match(route, /prioritize: true/);
  assert.match(route, /replaceExistingPriority: false/);
  assert.match(preparationRoute, /replaceExistingPriority/);
  assert.match(preparationRoute, /defaultPriority: 200_000/);
  assert.match(preparationRoute, /priorityReason: 'administrator_manual_selection'/);
  assert.match(preparationRoute, /startsAfterCurrent: true/);
  assert.match(preparationQueue, /if \(replaceExisting\)/);
  assert.match(route, /getProducts/);
  assert.match(route, /reconcileDecisionTasks/);
  assert.match(route, /remote-state-before-retry/);
  assert.match(route, /allegro_catalog_identity_conflict/);
  assert.match(route, /closeConfirmedRepairTasks/);
  assert.match(route, /status='repaired'/);
  assert.match(route, /publicationRetried: false/);
  assert.match(worker, /processNextPublication/);
  assert.match(worker, /operationId: taskId/);
  assert.match(worker, /allegro-publication-queue-complete/);
  assert.match(worker, /allegro-publication-queue-fail/);
  assert.match(worker, /error\.responseData = data/);
  assert.match(worker, /responseData\?\.offer\?\.id/);
  assert.match(store, /createAllegroPublicationQueueRoute/);
  assert.match(store, /reconcileTasks: allegroUzgodnijZadaniaPublikacji/);
  assert.match(store, /preparationReport: productFullPreparationReport/);
  assert.match(store, /allegro-publication-readback/);
  assert.match(store, /centralProductCatalog\.getMany/);
  assert.match(store, /allegroPublicationQueueRoute\(req, url, action\)/);
  assert.match(store, /seo-automation-status/);
});

test('panel Agenta pokazuje publikacje i umożliwia wykonanie decyzji produktowej', async () => {
  const runtime = await read('src/frontend/10-agent-ai-admin-workspace.js');
  const workspace = await read('src/frontend/11-agent-ai-workspace.js');
  const actions = await read('src/frontend/12a-product-actions.js');
  const styles = await read('src/styles/33-agent-observability.css');
  assert.match(runtime, /allegro-publication-queue-status/);
  assert.match(runtime, /von-halsky-overview/);
  assert.match(runtime, /seo-automation-status/);
  assert.match(workspace, /function agentAIPublikacjaKolejkaHTML/);
  assert.match(workspace, /WSPÓLNY PULPIT • NIEZALEŻNE TRWAŁE KOLEJKI SERWERA/);
  assert.match(workspace, /Przygotowanie wszystkich kanałów/);
  assert.match(workspace, /Publikacja i aktualizacja/);
  assert.match(workspace, /Pozycjonowanie produktów/);
  assert.match(workspace, /agentAIVonHalskySteruj/);
  assert.match(workspace, /function agentAIProduktoweDecyzjeHTML/);
  assert.match(workspace, /Agent: pełna naprawa ze źródeł/);
  assert.match(workspace, /Tylko dane pewne/);
  assert.match(workspace, /Zapamiętaj mój wybór/);
  assert.match(workspace, /allegro-preparation-decision/);
  assert.match(workspace, /allegro-preparation-queue-prioritize/);
  assert.match(workspace, /Ponów operację po potwierdzeniu/);
  assert.match(workspace, /agentAIWybierzRozwiazaniePublikacji/);
  assert.match(workspace, /Agent porządkuje galerię|Agent naprawia i przygotowuje kontrolę/);
  assert.match(workspace, /agentPublicationDecisionRemember/);
  assert.match(workspace, /PROPOZYCJA Z PAMIĘCI/);
  assert.doesNotMatch(workspace, /NAUCZONY WYBÓR/);
  assert.match(actions, /allegro-publication-queue-enqueue/);
  assert.doesNotMatch(actions.slice(actions.indexOf('async function asortymentPotwierdzOperacjeZewnetrzna'), actions.indexOf('function asortymentOperacjaZewnetrznaOpis')), /for\(const sourceProduct of products\)/);
  assert.match(styles, /\.agent-publication-queue/);
  assert.match(styles, /\.agent-channel-queues/);
  assert.match(styles, /\.agent-product-decision/);
  assert.match(workspace, /konkretne braki/);
});

test('błąd publikacji zamyka się jako naprawiony wyłącznie po nowszym pełnym odczycie', () => {
  const row = { result: { adminResolution: 'repair_then_review', adminResolutionAt: '2026-08-06T08:00:00.000Z' } };
  const newerProduct = { allegroAgentPreparationConfirmedAt: '2026-08-06T08:01:00.000Z' };
  const olderProduct = { allegroAgentPreparationConfirmedAt: '2026-08-06T07:59:00.000Z' };
  assert.equal(publicationRepairReadbackConfirmed(row, newerProduct, { ready: true }), true);
  assert.equal(publicationRepairReadbackConfirmed(row, newerProduct, { ready: false }), false);
  assert.equal(publicationRepairReadbackConfirmed(row, olderProduct, { ready: true }), false);
  assert.equal(publicationRepairReadbackConfirmed({ ...row, repair_completed_at: '2026-08-06T08:02:00.000Z' }, olderProduct, { ready: true }), true);
  assert.equal(publicationRepairReadbackConfirmed({ result: { adminResolution: 'manual_editor', adminResolutionAt: '2026-08-06T08:00:00.000Z' } }, newerProduct, { ready: true }), false);
});
