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
