import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentProviderRouter } from '../src/backend/lib/domain/agent-provider-router.mjs';

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return structuredClone(body); } };
}

test('router potwierdza dostawców prawdziwym probe i pokazuje odrzucenie xAI bez ujawnienia tokenu', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options.method || 'GET']);
    if (String(url).includes('api.x.ai')) return response(403, { error: { message: 'Forbidden xai-secret-token-123456789' } });
    return response(200, { data: [] });
  };
  const router = createAgentProviderRouter({
    fetchImpl,
    env: {
      OPENAI_API_KEY: 'sk-proj-openai-secret-123456789',
      OPENAI_MODEL: 'gpt-5.4-nano',
      ANTHROPIC_API_KEY: 'sk-ant-anthropic-secret-123456789',
      ANTHROPIC_MODEL: 'claude-haiku-4-5',
      XAI_API_KEY: 'xai-secret-token-123456789',
      XAI_MODEL: 'grok-4.20-0309-non-reasoning',
      AI_PROVIDER_ORDER: 'openai,anthropic,xai',
    },
    now: () => new Date('2026-08-01T09:00:00.000Z'),
  });
  const state = await router.status({ force: true });
  assert.equal(state.openai.connected, true);
  assert.equal(state.anthropic.connected, true);
  assert.equal(state.xai.connected, false);
  assert.match(state.xai.error, /403|Forbidden/i);
  assert.equal(state.xai.error.includes('secret-token'), false);
  assert.equal(calls.filter(([url]) => url.includes('/v1/models')).length, 3);
});

test('router rozdziela kolejne zadania rotacyjnie między zdrowych dostawców', async () => {
  const postCalls = [];
  const fetchImpl = async (url, options = {}) => {
    const address = String(url), method = options.method || 'GET';
    if (method === 'GET') return response(200, { data: [] });
    postCalls.push(address);
    if (address.includes('openai.com')) return response(200, { output_text: 'OpenAI wynik' });
    if (address.includes('anthropic.com')) return response(200, { content: [{ type: 'text', text: 'Claude wynik' }] });
    return response(200, { choices: [{ message: { content: 'Grok wynik' } }] });
  };
  const router = createAgentProviderRouter({
    fetchImpl,
    env: {
      OPENAI_API_KEY: 'openai-key', ANTHROPIC_API_KEY: 'anthropic-key', XAI_API_KEY: 'xai-key',
      AI_PROVIDER_ORDER: 'openai,anthropic,xai', XAI_DAILY_REQUEST_LIMIT: '30',
    },
    now: () => new Date('2026-08-01T09:05:00.000Z'),
  });
  const first = await router.answer({ input: 'A', instructions: 'I' });
  const second = await router.answer({ input: 'B', instructions: 'I' });
  const third = await router.answer({ input: 'C', instructions: 'I' });
  assert.deepEqual([first.provider, second.provider, third.provider], ['openai', 'anthropic', 'xai']);
  assert.deepEqual([first.text, second.text, third.text], ['OpenAI wynik', 'Claude wynik', 'Grok wynik']);
  assert.equal(postCalls.length, 3);
  const state = await router.status();
  assert.equal(state.xai.requestsToday, 1);
  assert.equal(state.xai.remainingToday, 29);
});
