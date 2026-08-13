import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeAllegroOfferTasks,
  createAgentOperationalCenter,
} from '../src/backend/lib/domain/agent-operational-center.mjs';

test('kolejka Allegro zachowuje wyłącznie najnowszy, niezakończony stan produktu', () => {
  const tasks = activeAllegroOfferTasks([
    { productId: '100', status: 'błąd API', updatedAt: '2026-07-30T10:00:00Z' },
    { productId: '100', status: 'wykonane', updatedAt: '2026-07-30T10:05:00Z' },
    { productId: '200', status: 'oczekuje', updatedAt: '2026-07-30T10:06:00Z' },
    { productId: '300', status: 'zakończone', updatedAt: '2026-07-30T10:07:00Z' },
  ]);
  assert.deepEqual(tasks.map((task) => task.productId), ['200']);
});

test('zbiorcza kolejka przygotowania produktów jest pracą Agenta, a nie fałszywą decyzją administratora', async () => {
  const records = {
    settings: { data: { artway_agent_ai_allegro_zadania: [
      { productId: '100', status: 'wykonane', updatedAt: '2026-07-30T10:05:00Z' },
      { productId: '200', status: 'oczekuje', updatedAt: '2026-07-30T10:06:00Z' },
    ] }, updated_at: new Date().toISOString() },
    orders: { items: [], updated_at: new Date().toISOString() },
    allegro_orders: { items: [], updated_at: new Date().toISOString() },
    allegro_communications: { threads: [], issues: [], updated_at: new Date().toISOString() },
    allegro_offer_last_error: null,
    infakt_invoice_links: { items: {} },
    catalog_quality_audit: { report: null },
    system_diagnostics: { items: [] },
  };
  const center = createAgentOperationalCenter({
    read: async (name, fallback) => records[name] ?? fallback,
    text: (value, max = 1000) => String(value ?? '').slice(0, max),
    allegroOrderIsActive: () => false,
    communicationNeedsReply: () => false,
    mergeProducts: () => ({ products: [] }),
    orderNumber: (value) => String(value || ''),
    integrationStatus: () => ({ database: true, allegro: true, inpost: true, email: true }),
  });
  const result = await center();
  const priority = result.priorities.find((item) => item.actionId === 'allegro_offer_prepare');
  assert.ok(priority);
  assert.equal(priority.count, 1);
  assert.equal(priority.requiresApproval, false);
  assert.equal(priority.execution, 'draft');
  assert.equal(priority.actionLabel, 'Pokaż produkty');
  assert.equal(result.summary.offerTasks, 1);
});

test('centrum operacyjne używa bieżącej kolejki PostgreSQL zamiast starej kopii ustawień', async () => {
  const center = createAgentOperationalCenter({
    read: async (name, fallback) => name === 'settings'
      ? { data: { artway_agent_ai_allegro_zadania: [{ productId: 'stary', status: 'oczekuje' }] } }
      : fallback,
    text: (value, max = 1000) => String(value ?? '').slice(0, max),
    allegroOrderIsActive: () => false,
    communicationNeedsReply: () => false,
    mergeProducts: () => ({ products: [] }),
    orderNumber: (value) => String(value || ''),
    integrationStatus: () => ({ database: true, allegro: true, inpost: true, email: true }),
    preparationStatus: async () => ({
      current: [
        { productId: 'gotowy', status: 'completed' },
        { productId: 'aktualny', status: 'decision_required', missing: ['EAN'] },
      ],
    }),
  });
  const result = await center();
  assert.equal(result.summary.offerTasks, 1);
  const priority = result.priorities.find((item) => item.actionId === 'allegro_offer_prepare');
  assert.equal(priority?.count, 1);
});

test('każda sprawa centrum ma konkretną akcję, a kontrole bezpieczne nie są martwym odnośnikiem', async () => {
  const old = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const records = {
    settings: { data: { artway_agent_ai_linki_producentow: [{ id: 'link-1', status: 'oczekuje' }] }, updated_at: old },
    orders: { items: [], updated_at: old },
    allegro_orders: { items: [], updated_at: old },
    allegro_communications: { threads: [], issues: [], updated_at: old },
    allegro_offer_last_error: null,
    infakt_invoice_links: { items: {} },
    catalog_quality_audit: { report: { summary: { critical: 2 } } },
    system_diagnostics: { items: [{ id: 'diag-1', level: 'blad', status: 'open' }] },
  };
  const center = createAgentOperationalCenter({
    read: async (name, fallback) => records[name] ?? fallback,
    text: (value, max = 1000) => String(value ?? '').slice(0, max),
    allegroOrderIsActive: () => false,
    communicationNeedsReply: () => false,
    mergeProducts: () => ({ products: [] }),
    orderNumber: (value) => String(value || ''),
    integrationStatus: () => ({ database: false, allegro: true, inpost: true, email: true }),
  });
  const result = await center();
  const sync = result.priorities.find((item) => item.actionId === 'data_sync');
  const links = result.priorities.find((item) => item.actionId === 'producer_link_check');
  const diagnostics = result.priorities.find((item) => item.actionId === 'diagnostics_review');
  const quality = result.priorities.find((item) => item.actionId === 'catalog_quality');
  assert.equal(sync?.execution, 'safe_check');
  assert.equal(sync?.safeProfile, 'data');
  assert.equal(sync?.actionLabel, 'Odśwież dane');
  assert.equal(links?.href, '#/admin/agent-ai/producenci');
  assert.equal(links?.actionLabel, 'Sprawdź kolejną partię');
  assert.equal(diagnostics?.href, '#/admin/system/logi');
  assert.equal(diagnostics?.actionLabel, 'Otwórz diagnostykę');
  assert.equal(quality?.href, '#/admin/asortyment/jakosc');
  for (const item of result.priorities) assert.ok(item.actionLabel && item.href, `brak działania: ${item.title}`);
});

test('brak nowych zamówień sklepu nie jest błędnie pokazywany jako awaria synchronizacji', async () => {
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const fresh = new Date().toISOString();
  const records = {
    settings: { data: {}, updated_at: old },
    orders: { items: [], updated_at: old },
    allegro_orders: { items: [], updated_at: fresh },
    allegro_communications: { threads: [], issues: [], updated_at: fresh },
    allegro_offer_last_error: null,
    infakt_invoice_links: { items: {} },
    catalog_quality_audit: { report: null },
    system_diagnostics: { items: [] },
  };
  const center = createAgentOperationalCenter({
    read: async (name, fallback) => records[name] ?? fallback,
    text: (value, max = 1000) => String(value ?? '').slice(0, max),
    allegroOrderIsActive: () => false,
    communicationNeedsReply: () => false,
    mergeProducts: () => ({ products: [] }),
    orderNumber: (value) => String(value || ''),
    integrationStatus: () => ({ database: true, allegro: true, inpost: true, email: true }),
  });
  const result = await center();
  assert.equal(result.priorities.some((item) => item.actionId === 'data_sync'), false);
  assert.deepEqual(Object.keys(result.freshness).sort(), ['allegroOrders', 'communications']);
});
