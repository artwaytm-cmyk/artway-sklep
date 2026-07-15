import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryStockRoute } from '../netlify/functions/lib/inventory-route.mjs';

test('bezpośredni endpoint zawsze wymaga trwałej decyzji, niezależnie od deklarowanego źródła', async () => {
  let reads = 0;
  const route = createInventoryStockRoute({
    isAdmin: () => true,
    rateLimit: () => null,
    readVersioned: async () => { reads += 1; return { value: { data: {}, rev: 0 } }; },
    respond: (payload, status = 200) => ({ payload, status }),
    settingsLimit: 4 * 1024 * 1024,
    text: (value, limit = 500) => String(value || '').slice(0, limit),
    writeIfVersion: async () => ({ modified: true }),
  });
  for (const source of ['', 'manual-admin', 'admin-agent-panel', 'telegram-webhook', 'codex-worker', 'dowolne-zrodlo']) {
    const request = new Request('https://artwaytm.pl/api/store?action=inventory-stock-set', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source }),
    });
    const result = await route(request, new URL(request.url), 'inventory-stock-set');
    assert.equal(result.status, 409);
    assert.equal(result.payload.code, 'inventory_decision_required');
  }
  assert.equal(reads, 0);
});
