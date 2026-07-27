import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentRuntime } from '../src/backend/lib/domain/agent-runtime.mjs';

function memoryStore() {
  let value = {}, etag = '0';
  return {
    async readVersioned() { return { value: structuredClone(value), etag, exists: etag !== '0' }; },
    async writeIfVersion(_key, next, version) {
      if (version.etag !== etag) return { modified: false };
      value = structuredClone(next); etag = String(Number(etag) + 1); return { modified: true };
    },
  };
}

test('rejestr Agenta pokazuje realny cykl, etapy i ostrzeżenie integracji bez oznaczania workera jako offline', async () => {
  const store = memoryStore();
  let current = new Date('2026-07-17T10:00:00.000Z');
  const runtime = createAgentRuntime({ ...store, now: () => current });

  await runtime.report({
    event: 'worker_heartbeat', workerId: 'worker-1',
    providers: {
      codex: { configured: true, connected: true, model: 'Codex CLI' },
      openai: { configured: true, connected: true, model: 'gpt-5-nano' },
      xai: { configured: true, connected: true, model: 'grok-4.20-0309-non-reasoning', requestsToday: 7, dailyRequestLimit: 30, remainingToday: 23, day: '2026-07-23', usageMode: 'free-model-only', freeOnly: true },
    },
  });
  await runtime.report({ event: 'cycle_start', runId: 'cycle-1', source: 'timer', steps: [{ id: 'orders', label: 'Zamówienia Allegro' }] });
  current = new Date('2026-07-17T10:00:05.000Z');
  await runtime.report({ event: 'cycle_step', runId: 'cycle-1', step: { id: 'orders', label: 'Zamówienia Allegro', status: 'warning', error: 'Autoryzacja Allegro wygasła.' } });
  await runtime.report({ event: 'cycle_finish', runId: 'cycle-1', status: 'degraded', summary: 'Agent działa; integracja wymaga uwagi.', durationMs: 5000 });

  const state = await runtime.status({ workerOnline: true, workerLastSeenAt: current.toISOString(), counts: { queued: 1 }, active: 1 });
  assert.equal(state.state, 'degraded');
  assert.equal(state.worker.online, true);
  assert.equal(state.lastRun.status, 'degraded');
  assert.equal(state.integrationWarnings.length, 1);
  assert.equal(state.providers.openai.model, 'gpt-5-nano');
  assert.equal(state.providers.xai.model, 'grok-4.20-0309-non-reasoning');
  assert.equal(state.providers.xai.connected, true);
  assert.equal(state.providers.xai.requestsToday, 7);
  assert.equal(state.providers.xai.dailyRequestLimit, 30);
  assert.equal(state.providers.xai.remainingToday, 23);
  assert.equal(state.providers.xai.usageDay, '2026-07-23');
  assert.equal(state.providers.xai.freeOnly, true);
  assert.equal(state.queue.active, 1);
});

test('rejestr Agenta nie przechowuje tokenów w błędzie i rozlicza zadania workera', async () => {
  const store = memoryStore();
  const now = new Date('2026-07-17T11:00:00.000Z');
  const runtime = createAgentRuntime({ ...store, now: () => now });
  await runtime.report({ event: 'job_start', workerId: 'worker-2', title: 'Polecenie z panelu', source: 'panel' });
  await runtime.report({ event: 'job_finish', workerId: 'worker-2', title: 'Polecenie z panelu', source: 'panel', ok: false, error: 'sk-proj-fake12345678' });
  const state = await runtime.status({ workerOnline: true, workerLastSeenAt: now.toISOString(), counts: {}, active: 0 });
  assert.equal(state.worker.currentTask, '');
  assert.equal(state.worker.failedJobs, 1);
  assert.equal(state.activity[0].detail.includes('fake12345678'), false);
});

test('udany etap GPT potwierdza realne połączenie OpenAI i oddziela ostrzeżenie Allegro od AI', async () => {
  const store = memoryStore();
  let current = new Date('2026-07-18T09:00:00.000Z');
  const runtime = createAgentRuntime({ ...store, now: () => current });
  await runtime.report({ event: 'worker_heartbeat', providers: { openai: { configured: true, connected: false, model: 'gpt-5-nano' } } });
  await runtime.report({ event: 'cycle_start', runId: 'cycle-ai', steps: [{ id: 'tresci-gpt-nano', label: 'Szkice GPT' }, { id: 'zamowienia', label: 'Zamówienia Allegro' }] });
  current = new Date('2026-07-18T09:00:02.000Z');
  await runtime.report({ event: 'cycle_step', runId: 'cycle-ai', step: { id: 'tresci-gpt-nano', status: 'completed', count: 3 } });
  await runtime.report({ event: 'cycle_step', runId: 'cycle-ai', step: { id: 'zamowienia', status: 'warning', error: 'Autoryzacja Allegro wygasła.' } });
  await runtime.report({ event: 'cycle_finish', runId: 'cycle-ai', status: 'degraded' });
  const state = await runtime.status({ workerOnline: true, workerLastSeenAt: current.toISOString() });
  assert.equal(state.providers.openai.connected, true);
  assert.equal(state.providers.openai.lastSuccessAt, current.toISOString());
  assert.equal(state.integrationWarnings[0].kind, 'allegro');
});

test('rejestr rozróżnia fizyczną czynność, zapis oczekujący i publikację potwierdzoną przez kanał', async () => {
  const store = memoryStore();
  let current = new Date('2026-07-24T10:00:00.000Z');
  const runtime = createAgentRuntime({ ...store, now: () => current });
  const base = {
    id: 'editorial:P-17:allegro:fingerprint', runId: 'run-17', productId: 'P-17',
    productName: 'Gra edukacyjna', channel: 'allegro', action: 'publikacja treści w kanale',
    target: 'powiązana oferta Allegro', fields: ['allegroTitle', 'allegroDescription'],
  };
  await runtime.report({ event: 'work_progress', work: { ...base, phase: 'sending_to_allegro', status: 'running', targetRef: 'offer-17' } });
  let state = await runtime.status({ workerOnline: true, workerLastSeenAt: current.toISOString() });
  assert.equal(state.currentWork.productName, 'Gra edukacyjna');
  assert.equal(state.currentWork.phase, 'sending_to_allegro');
  current = new Date('2026-07-24T10:00:03.000Z');
  await runtime.report({ event: 'work_progress', work: { ...base, phase: 'queued_for_publication', status: 'pending', message: 'Oczekuje na API.' } });
  state = await runtime.status({ workerOnline: true, workerLastSeenAt: current.toISOString() });
  assert.equal(state.currentWork, null);
  assert.equal(state.publication.counts.pending, 1);
  current = new Date('2026-07-24T10:00:05.000Z');
  await runtime.report({ event: 'work_progress', work: { ...base, phase: 'confirmed_by_allegro', status: 'confirmed', receiptId: 'offer-17' } });
  state = await runtime.status({ workerOnline: true, workerLastSeenAt: current.toISOString() });
  assert.equal(state.publication.counts.pending, 0);
  assert.equal(state.publication.counts.confirmed, 1);
  assert.equal(state.publication.recent[0].receiptId, 'offer-17');
});

test('rejestr zachowuje każdy krótki etap pracy produktu wraz z polami', async () => {
  const store = memoryStore();
  let current = new Date('2026-07-27T08:00:00.000Z');
  const runtime = createAgentRuntime({ ...store, now: () => current });
  const base = {
    id: 'allegro-preparation:P-25', productId: 'P-25', productName: 'Gra Multigra',
    channel: 'allegro', action: 'przygotowanie produktu do Allegro',
  };
  await runtime.report({ event: 'work_progress', source: 'preparation', work: {
    ...base, phase: 'parametry', status: 'running', fields: ['ean', 'allegroParameters'],
    message: 'Dopasowuję parametry.',
  } });
  current = new Date('2026-07-27T08:00:01.000Z');
  await runtime.report({ event: 'work_progress', source: 'preparation', work: {
    ...base, phase: 'opisy', status: 'running', fields: ['opisKrotki', 'opis'],
    message: 'Poprawiam opisy.',
  } });
  const state = await runtime.status({ workerOnline: true, workerLastSeenAt: current.toISOString() });
  assert.equal(state.currentWork.phase, 'opisy');
  assert.deepEqual(state.activity.slice(0, 2).map((item) => item.phase), ['opisy', 'parametry']);
  assert.deepEqual(state.activity[0].fields, ['opisKrotki', 'opis']);
  assert.equal(state.activity[0].productId, 'P-25');
  assert.match(state.activity[0].detail, /Poprawiam opisy/);
});
