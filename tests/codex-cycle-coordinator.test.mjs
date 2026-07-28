import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CODEX_SCENARIOS,
  coordinatorSnapshot,
  createCoordinatorPrompt,
  validateCoordinatorPlan,
} from '../src/backend/lib/domain/codex-cycle-coordinator.mjs';

test('koordynator korzysta tylko z zamkniętej listy wersjonowanych scenariuszy', () => {
  const plan = validateCoordinatorPlan({
    summary: 'Praca dla katalogu i diagnostyki.',
    assignments: [
      { scenarioId: 'catalog-editorial', priority: 1, reason: 'Są oczekujące kartoteki.' },
      { scenarioId: 'nieistniejacy-scenariusz', priority: 1, reason: 'Nie wolno wykonać.' },
      { scenarioId: 'catalog-editorial', priority: 2, reason: 'Duplikat.' },
    ],
    confidence: 0.95,
  });
  assert.equal(plan.assignments.length, 1);
  assert.equal(plan.assignments[0].specialist, CODEX_SCENARIOS['catalog-editorial'].specialist);
  assert.equal(plan.assignments[0].scenarioVersion, CODEX_SCENARIOS['catalog-editorial'].version);
});

test('koordynator dostaje tylko ograniczone liczniki, bez danych klientów i sekretów', () => {
  const snapshot = coordinatorSnapshot({
    operations: { summary: { newOrders: 4, communicationWaiting: 2, customerEmail: 'klient@example.test' } },
    specialists: { lastCycle: { status: 'completed', editorialProgress: { total: 100, ready: 25, pending: 75 } } },
    token: 'sekret',
  });
  const prompt = createCoordinatorPrompt(snapshot);
  assert.equal(snapshot.newOrders, 4);
  assert.equal(snapshot.editorial.pending, 75);
  assert.doesNotMatch(prompt, /klient@example|sekret/);
  assert.match(prompt, /Nie zlecaj wysyłek, płatności, publikacji ani zmian magazynowych/);
});
