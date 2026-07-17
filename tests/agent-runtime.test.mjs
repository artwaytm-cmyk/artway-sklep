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
