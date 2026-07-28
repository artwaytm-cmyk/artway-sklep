import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnosticAgentWorkflow } from '../src/backend/lib/domain/diagnostic-agent-workflow.mjs';
import { diagnosticsModelPolicy, specialistModelPolicy } from '../src/backend/lib/domain/agent-model-policy.mjs';

test('diagnostyka rutynowa używa GPT-5.4 mini, a pełny GPT-5.4 jest zarezerwowany dla eskalacji', () => {
  assert.deepEqual(diagnosticsModelPolicy({}), {
    model: 'gpt-5.4-mini',
    tier: 'standard-routine',
    reasoning: 'low',
    mode: 'standard',
    maxOutputTokens: 2200,
    escalation: false,
  });
  assert.equal(diagnosticsModelPolicy({}, { escalation: true }).model, 'gpt-5.4');
  assert.equal(specialistModelPolicy('product_content', { env: {} }).model, 'gpt-5.4-mini');
  assert.equal(specialistModelPolicy('seo_promotion', { env: {} }).model, 'gpt-5.4-nano');
  assert.equal(specialistModelPolicy('allegro_publication', { env: {} }).model, 'gpt-5.4-mini');
  assert.equal(specialistModelPolicy('allegro_publication', { env: {}, escalation: true }).model, 'gpt-5.4');
});

test('stary ogólny OPENAI_MODEL nie wyłącza routingu specjalistów', () => {
  const env = { OPENAI_MODEL: 'gpt-5.6-terra' };
  assert.equal(specialistModelPolicy('allegro_publication', { env }).model, 'gpt-5.4-mini');
  assert.equal(specialistModelPolicy('seo_promotion', { env }).model, 'gpt-5.4-nano');
});

test('workflow Agents SDK zwraca strukturalną analizę i nie przekazuje sekretu w danych śledzenia', async () => {
  let captured = null;
  const expected = {
    classification: 'data_conflict',
    rootCause: 'Przeglądarka ponawia zapis z nieaktualną rewizją.',
    confidence: 0.97,
    evidence: ['Ten sam komunikat wystąpił wielokrotnie.'],
    recommendedActions: [{ action: 'Scalić rekordy po updatedAt.', risk: 'low', automatic: false }],
    validationPlan: ['Wykonać dwa równoległe zapisy i potwierdzić jedną nowszą rewizję.'],
    safeAutomaticAction: 'refresh_cached_version',
    requiresHumanApproval: false,
    summary: 'Konflikt wersji domeny ustawień.',
  };
  const workflow = createDiagnosticAgentWorkflow({
    apiKey: 'sk-proj-nie-wolno-go-przekazac',
    env: {},
    now: () => new Date('2026-07-26T01:00:00.000Z'),
    runAgent: async (agent, input, options) => {
      captured = { agent, input, options };
      return { finalOutput: expected };
    },
  });
  const result = await workflow.analyze({
    id: 'diag-1',
    fingerprint: 'abc',
    level: 'blad',
    message: 'Błąd zapisu token=sekret',
    source: 'panel',
    count: 18,
  }, { manual: true, deep: true });
  assert.equal(workflow.status().model, 'gpt-5.4-mini');
  assert.equal(workflow.status().escalation.model, 'gpt-5.4');
  assert.equal(captured.agent.model, 'gpt-5.4');
  assert.equal(captured.agent.modelSettings.reasoning.effort, 'high');
  assert.equal(captured.options.traceIncludeSensitiveData, false);
  assert.doesNotMatch(captured.input, /sk-proj-nie-wolno/);
  assert.equal(result.classification, 'data_conflict');
  assert.equal(result.analyzedAt, '2026-07-26T01:00:00.000Z');
});
