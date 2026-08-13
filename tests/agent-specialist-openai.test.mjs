import test from 'node:test';
import assert from 'node:assert/strict';
import { requestSpecialistResponse } from '../src/backend/lib/domain/agent-specialist-openai.mjs';
import { buildSpecialistInstructions } from '../src/backend/lib/domain/agent-specialist-instructions.mjs';
import { SPECIALISTS } from '../src/backend/lib/domain/agent-specialist-definitions.mjs';
import { SPECIALIST_PLAYBOOK_VERSION } from '../src/backend/lib/domain/agent-specialist-playbooks.mjs';

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: { status: { type: 'string' } },
};

function responsePayload(value, model = 'gpt-5-nano') {
  return {
    model,
    output: [{ type: 'message', content: [{ type: 'output_text', text: value }] }],
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  };
}

test('niekompletny wynik GPT-5 nano jest ponawiany jeden raz na GPT-5.4 nano', async () => {
  const calls = [];
  const result = await requestSpecialistResponse({
    apiKey: 'test',
    model: 'gpt-5-nano',
    qualityFallbackModel: 'gpt-5.4-nano',
    instructions: 'Zwróć JSON.',
    input: '{}',
    resultSchema: schema,
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      const model = calls.at(-1).body.model;
      if (calls.length < 3) return new Response(JSON.stringify(responsePayload('nie-json', model)), { status: 200 });
      return new Response(JSON.stringify(responsePayload('{"status":"ready"}', model)), { status: 200 });
    },
  });
  assert.deepEqual(calls.map((item) => item.body.model), ['gpt-5-nano', 'gpt-5-nano', 'gpt-5.4-nano']);
  assert.equal(result.qualityFallback, true);
  assert.equal(result.localFallbackApplied, false);
});

test('poprawny JSON o błędnej treści nie jest uznawany za sukces specjalisty', async () => {
  const calls = [];
  const result = await requestSpecialistResponse({
    apiKey: 'test',
    model: 'gpt-5-nano',
    qualityFallbackModel: 'gpt-5.4-nano',
    instructions: 'Zwróć JSON.',
    input: '{}',
    resultSchema: schema,
    semanticValidator: (value) => value.status === 'ready',
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      const output = calls.length < 3 ? '{"status":"empty"}' : '{"status":"ready"}';
      return new Response(JSON.stringify(responsePayload(output, calls.at(-1).body.model)), { status: 200 });
    },
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((item) => item.body.model), ['gpt-5-nano', 'gpt-5-nano', 'gpt-5.4-nano']);
  assert.equal(result.qualityFallback, true);
  assert.equal(JSON.parse(result.payload.output[0].content[0].text).status, 'ready');
});

test('brak środków przełącza specjalistę na lokalny model bez płatnego API', async () => {
  const calls = [];
  const result = await requestSpecialistResponse({
    apiKey: 'test',
    model: 'gpt-5-nano',
    qualityFallbackModel: 'gpt-5.4-nano',
    localFallback: { enabled: true, baseUrl: 'http://127.0.0.1:11434', model: 'qwen3.5:4b' },
    instructions: 'Zwróć JSON.',
    input: '{}',
    resultSchema: schema,
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes('api.openai.com')) return new Response(JSON.stringify({ error: { code: 'insufficient_quota', message: 'Brak środków.' } }), { status: 429 });
      return new Response(JSON.stringify({ model: 'qwen3.5:4b', message: { content: '{"status":"ready"}' }, prompt_eval_count: 10, eval_count: 5 }), { status: 200 });
    },
  });
  assert.equal(calls.length, 2);
  assert.match(calls[1], /127\.0\.0\.1:11434\/api\/chat/);
  assert.equal(result.payload.model, 'local:qwen3.5:4b');
  assert.equal(result.localFallbackApplied, true);
});

test('każdy specjalista ma rozbudowany prompt z błędami, przykładami i miejscem zapisu', () => {
  for (const [id, definition] of Object.entries(SPECIALISTS)) {
    const prompt = buildSpecialistInstructions({
      specialist: id,
      definition,
      promptVersion: SPECIALIST_PLAYBOOK_VERSION,
      platformProfile: definition.platformPrompt ? { ...definition.platformPrompt, name: definition.label } : null,
    });
    assert.ok(prompt.length >= 4_500, `${id}: prompt ma tylko ${prompt.length} znaków`);
    assert.match(prompt, /Miejsce i dowód zapisu:/);
    assert.match(prompt, /Typowe pomyłki tej roli/i);
    assert.match(prompt, /Przykłady poprawnego zachowania/i);
    assert.match(prompt, /Bramka jakości/i);
  }
});
