import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiPlatformControl } from '../src/backend/lib/domain/openai-platform-control.mjs';
import { createOpenAiPlatformRoute } from '../src/backend/lib/openai-platform-route.mjs';

function repository(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    read: async (key, fallback) => structuredClone(values.has(key) ? values.get(key) : fallback),
    write: async (key, value) => { values.set(key, structuredClone(value)); return value; },
    value: (key) => structuredClone(values.get(key)),
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('status pokazuje pełne możliwości Platformy i nigdy nie ujawnia obecnego klucza', async () => {
  const repo = repository(), secret = 'sk-proj-bardzo-tajny-obecny-klucz';
  const service = createOpenAiPlatformControl({
    ...repo,
    apiKey: secret,
    now: () => new Date('2026-07-26T02:00:00Z'),
    fetchImpl: async () => json({ data: [] }),
  });
  const status = await service.status({ force: true });
  assert.equal(status.keyMode, 'existing-server-key');
  assert.equal(status.connected, true);
  assert.deepEqual(status.capabilities.map((item) => item.id), [
    'responses', 'ui', 'agents', 'realtime', 'audio', 'images', 'logs', 'batches',
    'evals', 'fineTuning', 'modelUpgrade', 'optimization', 'migration', 'usage', 'apiKey',
    'localFallback',
  ]);
  assert.equal(status.policy.batchModel, 'gpt-5-nano');
  assert.doesNotMatch(JSON.stringify(status), /bardzo-tajny/);
});

test('dobowa ewaluacja tworzy plik Batch jeden raz i zapisuje tylko bezpieczne metadane', async () => {
  const repo = repository(), requests = [];
  const service = createOpenAiPlatformControl({
    ...repo,
    apiKey: 'test-key-existing',
    now: () => new Date('2026-07-26T02:30:00Z'),
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, method: options.method || 'GET', authorization: options.headers?.authorization || '' });
      if (url.endsWith('/v1/files')) return json({ id: 'file_batch_1' });
      if (url.endsWith('/v1/batches')) return json({ id: 'batch_1', status: 'validating' });
      return json({ data: [] });
    },
  });
  const first = await service.launchEvaluationBatch();
  const second = await service.launchEvaluationBatch();
  assert.equal(first.skipped, false);
  assert.equal(first.batch.cases, 3);
  assert.equal(second.skipped, true);
  assert.deepEqual(requests.map((item) => item.method), ['POST', 'POST']);
  assert.equal(repo.value('openai_platform_state').batches[0].id, 'batch_1');
  assert.doesNotMatch(JSON.stringify(repo.value('openai_platform_state')), /test-key-existing/);
});

test('zakończony Batch jest oceniany i zapisuje wynik regresji', async () => {
  const rows = [
    ['settings-revision-loop', 'data_conflict'],
    ['stale-browser-release', 'stale_client'],
    ['external-api-auth', 'external_integration'],
  ].map(([id, classification]) => JSON.stringify({
    custom_id: id,
    response: { status_code: 200, body: { output: [{ content: [{ text: JSON.stringify({ classification, reason: 'dowód' }) }] }] } },
  })).join('\n');
  const repo = repository({
    openai_platform_state: {
      batches: [{ id: 'batch_1', day: '2026-07-26', status: 'in_progress', cases: 3, createdAt: '2026-07-26T01:00:00Z' }],
    },
  });
  const service = createOpenAiPlatformControl({
    ...repo,
    apiKey: 'test-key-existing',
    now: () => new Date('2026-07-26T03:00:00Z'),
    fetchImpl: async (url) => url.includes('/content')
      ? new Response(rows, { headers: { 'content-type': 'text/plain' } })
      : json({ id: 'batch_1', status: 'completed', output_file_id: 'file_output_1' }),
  });
  const result = await service.pollBatches();
  const saved = repo.value('openai_platform_state').batches[0];
  assert.deepEqual(result, { checked: 1, updated: 1 });
  assert.equal(saved.status, 'completed');
  assert.equal(saved.score.total, 3);
  assert.equal(saved.score.passed, 3);
  assert.equal(saved.score.failed, 0);
  assert.ok(saved.score.items.every((item) => item.passed));
});

test('trasa OpenAI Platform wymaga administratora i nie uruchamia Batch przez GET', async () => {
  let launched = 0;
  const service = {
    status: async () => ({ configured: true }),
    cycle: async () => ({ ok: true }),
    launchEvaluationBatch: async () => { launched += 1; return { skipped: false }; },
  };
  const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const route = createOpenAiPlatformRoute({ service, isAdmin: (req) => req.headers.get('x-admin') === '1', respond });
  const denied = await route(new Request('https://example.test/api/store?action=openai-platform-status'), new URL('https://example.test/api/store?action=openai-platform-status'), 'openai-platform-status');
  const method = await route(new Request('https://example.test/api/store?action=openai-platform-batch-eval', { headers: { 'x-admin': '1' } }), new URL('https://example.test/api/store?action=openai-platform-batch-eval'), 'openai-platform-batch-eval');
  assert.equal(denied.status, 401);
  assert.equal(method.status, 405);
  assert.equal(launched, 0);
});
