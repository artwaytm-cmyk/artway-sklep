import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentRuntime } from '../netlify/functions/lib/domain/agent-runtime.mjs';

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
      xai: { configured: true, connected: true, model: 'grok-4.20-0309-non-reasoning' },
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
