import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { diagnosticCodeRepairContext, enqueueDiagnosticCodeRepair, parseDiagnosticCodeRepairContext } from '../src/backend/lib/domain/diagnostic-code-repair-queue.mjs';

test('kolejka naprawy kodu przekazuje tylko zanonimizowany i ograniczony kontekst', async () => {
  let input = null;
  const queue = { enqueue: async (value) => { input = value; return { job: { id: 'CX-REPAIR' }, status: 'queued', workerOnline: true }; } };
  const result = await enqueueDiagnosticCodeRepair(queue, {
    id: 'diag-1', fingerprint: 'abc', level: 'blad',
    message: 'ReferenceError sk-proj-1234567890123456 dla Bearer bardzo-dlugi-sekretny-token',
    source: 'backend:inpost-label', route: '/api/store', count: 9, lastSeenAt: '2026-08-08T07:54:34.000Z',
    analysis: { classification: 'application_bug', confidence: 0.96, rootCause: 'Zmienna użyta przed inicjalizacją.', evidence: ['ReferenceError'], validationPlan: ['Test etykiety'] },
  }, { automatic: true });
  assert.equal(result.jobId, 'CX-REPAIR');
  assert.match(input.requestId, /^diagnostic-code-repair:/);
  assert.doesNotMatch(JSON.stringify(input), /sk-proj-|bardzo-dlugi-sekretny-token/);
  const parsed = parseDiagnosticCodeRepairContext(input.context);
  assert.equal(parsed.diagnosticId, 'diag-1');
  assert.equal(parsed.analysis.classification, 'application_bug');
  assert.equal(parsed.automatic, true);
});

test('kolejka naprawy kodu odrzuca problem niebędący błędem aplikacji', async () => {
  await assert.rejects(() => enqueueDiagnosticCodeRepair({ enqueue: async () => ({}) }, {
    id: 'diag-2', message: 'Timeout API', analysis: { classification: 'transient' },
  }), /wyłącznie potwierdzone błędy aplikacji/);
  assert.equal(parseDiagnosticCodeRepairContext('{nie-json'), null);
  assert.equal(diagnosticCodeRepairContext({ id: 'x', count: -3 }).occurrences, 1);
});

test('worker i systemd tworzą kontrolowany przepływ Codex → test → marker → atomowe wydanie', async () => {
  const [worker, deployer, agentService, deployService, deployPath] = await Promise.all([
    readFile('scripts/run-agent-panel-worker.mjs', 'utf8'),
    readFile('scripts/deploy-ready-code-repair.mjs', 'utf8'),
    readFile('ops/systemd/artway-agent.service', 'utf8'),
    readFile('ops/systemd/artway-code-repair-deploy.service', 'utf8'),
    readFile('ops/systemd/artway-code-repair-deploy.path', 'utf8'),
  ]);
  assert.match(worker, /codex[\s\S]*exec[\s\S]*workspace-write/);
  assert.match(worker, /npm[\s\S]*test/);
  assert.match(worker, /Agent repair:/);
  assert.match(worker, /pending\.json/);
  assert.match(agentService, /ProtectSystem=strict/);
  assert.match(agentService, /ProtectHome=tmpfs/);
  assert.match(agentService, /BindReadOnlyPaths=\/home\/artway\/\.codex/);
  assert.match(agentService, /ReadWritePaths=\/srv\/artway\/shop \/srv\/artway\/ops\/code-repairs/);
  assert.match(deployer, /npm[\s\S]*deploy:atomic/);
  assert.match(deployer, /verified: true/);
  assert.match(deployService, /ProtectSystem=strict/);
  assert.match(deployPath, /PathExists=\/srv\/artway\/ops\/code-repairs\/pending\.json/);
});
