import test from 'node:test';
import assert from 'node:assert/strict';
import { agentInternalOrigin, createAgentOperationsRoute } from '../src/backend/lib/agent-operations-route.mjs';

test('bezpieczny plan Agenta używa loopback i wykonuje synchronizacje kolejno', async () => {
  const calls = [], signals = [];
  let active = 0, maxActive = 0, saved = null;
  const center = {
    integrations: { email: true, inpost: true, allegro: true, infakt: true },
    summary: { activeAllegro: 2 },
    score: 100,
  };
  const route = createAgentOperationsRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    text: (value, max = 1000) => String(value ?? '').slice(0, max),
    read: async (_key, fallback) => fallback,
    write: async (_key, value) => { saved = value; },
    getOperationalCenter: async () => center,
    internalOrigin: () => 'http://127.0.0.1:4321',
    fetchImpl: async (url, options) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      calls.push(url);
      signals.push(options?.signal);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      const action = new URL(url).searchParams.get('action');
      if (action === 'allegro-sync-orders') return new Response(JSON.stringify({ ok: true, fetched: 7, imported_new: 1, refreshed: 6 }));
      if (action === 'inpost-sync-all') return new Response(JSON.stringify({ ok: true, sprawdzone: 3 }));
      return new Response(JSON.stringify({ ok: true, results: [{}, {}] }));
    },
  });
  const req = new Request('https://artwaytm.pl/api/store?action=agent-run-safe-checks', {
    method: 'POST',
    body: JSON.stringify({ areas: ['allegro-orders', 'inpost', 'infakt'], profile: 'full' }),
  });
  const response = await route(req, new URL(req.url), 'agent-run-safe-checks');
  assert.equal(response.status, 200);
  assert.equal(response.body.allCompleted, true);
  assert.equal(response.body.run.errors, 0);
  assert.equal(response.body.run.completed, 3);
  assert.equal(maxActive, 1);
  assert.deepEqual(calls, [
    'http://127.0.0.1:4321/api/store?action=allegro-sync-orders',
    'http://127.0.0.1:4321/api/store?action=inpost-sync-all',
    'http://127.0.0.1:4321/api/store?action=infakt-sync',
  ]);
  assert.equal(signals.length, 3);
  assert.equal(signals.every((signal) => signal instanceof AbortSignal), true);
  assert.equal(saved.items[0].errors, 0);
});

test('wewnętrzny adres Agenta odrzuca niepoprawny port', () => {
  assert.equal(agentInternalOrigin('3000'), 'http://127.0.0.1:3000');
  assert.equal(agentInternalOrigin('65536'), 'http://127.0.0.1:3000');
  assert.equal(agentInternalOrigin('tekst'), 'http://127.0.0.1:3000');
});
