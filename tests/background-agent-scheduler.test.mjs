import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBackgroundTaskQueue, lastStepAt } from '../scripts/lib/background-agent-scheduler.mjs';

const completedRun = (at, steps) => ({ completedAt: at, steps: steps.map((id) => ({ id, status: 'completed', completedAt: at })) });

test('kolejka Agenta wybiera najwyżej dwa konkretne zadania i nie dubluje lekkiej oraz pełnej synchronizacji ofert', () => {
  const plan = buildBackgroundTaskQueue({
    runtime: { history: [] },
    specialists: { lastCycle: { editorialProgress: { pending: 40 } } },
    operations: { summary: { activeAllegro: 3 } },
    detectorResults: [{ changes: 2 }],
    now: new Date('2026-07-22T10:00:00Z'),
  });
  assert.equal(plan.queue.length, 2);
  assert.equal(plan.queue[0].id, 'tresci-gpt-nano');
  assert.equal(plan.queue.some((item) => item.id === 'oferty-lekkie'), false);
  assert.equal(plan.deferred.length > 0, true);
});

test('brak nowych zdarzeń nie uruchamia ponownie ciężkich zadań przed terminem', () => {
  const at = '2026-07-22T09:50:00Z';
  const plan = buildBackgroundTaskQueue({
    runtime: { lastRun: completedRun(at, ['tresci-gpt-nano', 'agent-autonomiczny', 'oferty-lekkie', 'oferty-pelne']) },
    specialists: { lastCycle: { editorialProgress: { pending: 20 } } },
    operations: { summary: { activeAllegro: 4 } },
    detectorResults: [{ changes: 0 }],
    now: new Date('2026-07-22T10:00:00Z'),
  });
  assert.deepEqual(plan.queue, []);
});

test('nowe zdarzenie omija zegar i natychmiast tworzy małą kolejkę pracy', () => {
  const at = '2026-07-22T09:55:00Z';
  const plan = buildBackgroundTaskQueue({
    runtime: { lastRun: completedRun(at, ['tresci-gpt-nano', 'agent-autonomiczny', 'oferty-lekkie', 'oferty-pelne']) },
    specialists: { lastCycle: { editorialProgress: { pending: 20 } } },
    operations: { summary: { activeAllegro: 4 } },
    detectorResults: [{ changes: 1 }],
    now: new Date('2026-07-22T10:00:00Z'),
  });
  assert.deepEqual(plan.queue.map((item) => item.id), ['tresci-gpt-nano', 'agent-autonomiczny']);
});

test('historia wykonania jest trwałym zegarem harmonogramu kolejki', () => {
  const runtime = { history: [completedRun('2026-07-22T08:00:00Z', ['oferty-lekkie'])] };
  assert.equal(lastStepAt(runtime, 'oferty-lekkie'), Date.parse('2026-07-22T08:00:00Z'));
});
