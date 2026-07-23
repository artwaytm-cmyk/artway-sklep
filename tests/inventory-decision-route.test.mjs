import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryDecisionRoute } from '../src/backend/lib/inventory-decision-route.mjs';

const product = { id: '31', nazwa: 'Gorący Ziemniak Familijny', externalId: '1410', ean: '5906018014105' };
const draft = {
  id: 'IVaaaaaaaaaaaaaa', status: 'awaiting_location', productId: '31', product: { id: '31', name: product.nazwa, externalId: '1410', ean: product.ean },
  mode: 'set', quantity: 8, expectedStock: 1, expectedRev: 10, after: 8, suggestedLocation: 'A-R01-P01', location: '', channel: 'panel',
};

function dependencies(overrides = {}) {
  return {
    decisions: {
      createDraft: async () => ({ decision: draft, duplicate: false, locations: [{ code: 'A-R01-P01', current: true }] }),
      assignLocation: async () => ({ decision: { ...draft, status: 'pending_confirmation', location: 'A-R01-P01' }, locations: [] }),
      confirm: async () => ({ decision: { ...draft, status: 'confirmed', location: 'A-R01-P01', result: { before: 1, after: 8 } }, duplicate: false }),
      reject: async () => ({ decision: { ...draft, status: 'rejected' }, duplicate: false }),
      list: async () => [draft],
    },
    isAdmin: () => true,
    rateLimit: () => null,
    readVersioned: async () => ({ value: { rev: 10, data: { artway_produkty_dodane: [product], artway_magazyn_produkty: { 31: { lokalizacja: 'A-R01-P01' } }, artway_magazyn_lokalizacje: [{ kod: 'A-R01-P01', aktywna: true }] } } }),
    respond: (payload, status = 200) => ({ payload, status }),
    sessionOf: () => ({ email: 'admin@example.test', role: 'admin' }),
    text: (value, limit = 500) => String(value || '').slice(0, limit),
    ...overrides,
  };
}

function request(action, body = {}) {
  return new Request(`https://artwaytm.pl/api/store?action=${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

test('API pierwszej wiadomości zwraca pytanie o lokalizację i nie potwierdzenie', async () => {
  const route = createInventoryDecisionRoute(dependencies());
  const req = request('inventory-decision-create', { productId: '31', mode: 'set', quantity: 8, requestId: 'panel-1' });
  const result = await route(req, new URL(req.url), 'inventory-decision-create');
  assert.equal(result.status, 200);
  assert.equal(result.payload.decision.status, 'awaiting_location');
  assert.match(result.payload.text, /Podaj lokalizację/);
  assert.equal(result.payload.replyMarkup.inline_keyboard.at(-1)[0].callback_data, 'iv:r:IVaaaaaaaaaaaaaa');
});

test('API wymaga osobnych akcji lokalizacji i końcowego potwierdzenia', async () => {
  const route = createInventoryDecisionRoute(dependencies());
  const locationReq = request('inventory-decision-location', { id: draft.id, location: 'A-R01-P01' });
  const located = await route(locationReq, new URL(locationReq.url), 'inventory-decision-location');
  assert.match(located.payload.text, /Potwierdź zmianę/);
  assert.equal(located.payload.replyMarkup.inline_keyboard[0].length, 2);

  const confirmReq = request('inventory-decision-confirm', { id: draft.id });
  const confirmed = await route(confirmReq, new URL(confirmReq.url), 'inventory-decision-confirm');
  assert.match(confirmed.payload.text, /Zmiana magazynowa zapisana/);
  assert.equal(confirmed.payload.decision.status, 'confirmed');
});

test('token techniczny może utworzyć szkic i wskazać lokalizację, ale nie może podjąć końcowej decyzji', async () => {
  let confirmed = 0, rejected = 0;
  const route = createInventoryDecisionRoute(dependencies({
    sessionOf: () => null,
    decisions: {
      createDraft: async () => ({ decision: draft, duplicate: false, locations: [{ code: 'A-R01-P01', current: true }] }),
      assignLocation: async () => ({ decision: { ...draft, status: 'pending_confirmation', location: 'A-R01-P01' }, locations: [] }),
      confirm: async () => { confirmed += 1; return { decision: draft }; },
      reject: async () => { rejected += 1; return { decision: draft }; },
      list: async () => [draft],
    },
  }));

  const createReq = request('inventory-decision-create', { productId: '31', mode: 'set', quantity: 8, requestId: 'agent-1' });
  assert.equal((await route(createReq, new URL(createReq.url), 'inventory-decision-create')).status, 200);
  const locationReq = request('inventory-decision-location', { id: draft.id, location: 'A-R01-P01' });
  assert.equal((await route(locationReq, new URL(locationReq.url), 'inventory-decision-location')).status, 200);

  for (const action of ['inventory-decision-confirm', 'inventory-decision-reject']) {
    const req = request(action, { id: draft.id, actor: { name: 'podszyty administrator' } });
    const result = await route(req, new URL(req.url), action);
    assert.equal(result.status, 403);
    assert.equal(result.payload.code, 'inventory_decision_human_admin_required');
  }
  assert.equal(confirmed, 0);
  assert.equal(rejected, 0);
});

test('końcowa decyzja przypisuje aktora z sesji administratora, ignorując dane z body', async () => {
  let seenActor = null;
  const route = createInventoryDecisionRoute(dependencies({
    decisions: {
      createDraft: async () => ({ decision: draft, duplicate: false, locations: [] }),
      assignLocation: async () => ({ decision: draft, locations: [] }),
      confirm: async (_id, actor) => {
        seenActor = actor;
        return { decision: { ...draft, status: 'confirmed', location: 'A-R01-P01', result: { before: 1, after: 8 } }, duplicate: false };
      },
      reject: async () => ({ decision: draft }),
      list: async () => [draft],
    },
  }));
  const req = request('inventory-decision-confirm', { id: draft.id, actor: { id: 'agent', name: 'Agent' } });
  const result = await route(req, new URL(req.url), 'inventory-decision-confirm');
  assert.equal(result.status, 200);
  assert.deepEqual(seenActor, { id: 'admin@example.test', name: 'admin@example.test' });
});
