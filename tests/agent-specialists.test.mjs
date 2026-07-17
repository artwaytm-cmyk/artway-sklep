import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentSpecialists, SPECIALISTS, sanitizeContext } from '../netlify/functions/lib/domain/agent-specialists.mjs';
import { createAgentSpecialistRoute } from '../netlify/functions/lib/agent-specialist-route.mjs';

function memoryRepository(initial = {}) {
  const values = new Map(Object.entries(structuredClone(initial))), versions = new Map([...values.keys()].map((key) => [key, 1]));
  return {
    values,
    readVersioned: async (key, fallback) => ({ value: structuredClone(values.has(key) ? values.get(key) : fallback), version: versions.get(key) || 0 }),
    writeIfVersion: async (key, value, expected) => {
      if ((versions.get(key) || 0) !== expected.version) return { modified: false };
      values.set(key, structuredClone(value)); versions.set(key, (versions.get(key) || 0) + 1); return { modified: true };
    },
  };
}

function openAiPayload(fields = []) {
  const result = {
    title: 'Profesjonalny szkic produktu', summary: 'Uporządkowano treść bez dopisywania parametrów.', content: 'Gotowy szkic do kontroli.', fields,
    suggestions: ['Sprawdź kategorię'], warnings: [], missingFacts: [], factsUsed: ['nazwa', 'producent'], confidence: 0.94, readyForApproval: true, complianceStatus: 'ready',
  };
  return { model: 'gpt-5-nano-2025-08-07', usage: { input_tokens: 300, output_tokens: 180, total_tokens: 480 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] };
}

test('zespół zawiera konkretne role do treści, promocji, komunikacji i nadzoru', () => {
  assert.deepEqual(Object.keys(SPECIALISTS), ['product_content', 'allegro_offer', 'customer_reply', 'seo_promotion', 'campaign_copy', 'banner_copy', 'supplier_message', 'catalog_quality', 'operations_supervisor']);
  assert.match(SPECIALISTS.allegro_offer.rules, /poza Allegro/i);
  assert.match(SPECIALISTS.supplier_message.rules, /cen/i);
});

test('kontekst usuwa sekrety i prywatne dane przed wysłaniem do modelu', () => {
  const safe = sanitizeContext({ email: 'klient@example.com', phone: '530038914', nested: { token: 'sekret', note: 'Napisz do klient@example.com lub +48 530 038 914', key: 'sk-proj-abcdefghijklmnop' } });
  assert.equal('email' in safe, false);
  assert.equal('phone' in safe, false);
  assert.equal('token' in safe.nested, false);
  assert.doesNotMatch(JSON.stringify(safe), /klient@example\.com|530\s*038\s*914|sk-proj-/);
});

test('GPT-5 nano używa Responses API, ścisłego schematu i pamięci identycznego zadania', async () => {
  const repo = memoryRepository(); let calls = 0, requestBody;
  const service = createAgentSpecialists({
    ...repo, apiKey: 'test-key', model: 'gpt-5-nano', now: () => new Date('2026-07-17T12:00:00.000Z'),
    fetchImpl: async (url, options) => { calls += 1; requestBody = JSON.parse(options.body); assert.equal(url, 'https://api.openai.com/v1/responses'); return new Response(JSON.stringify(openAiPayload([{ key: 'short_description', label: 'Opis krótki', value: 'Rodzinna gra logiczna.' }, { key: 'unknown', label: 'Obce pole', value: 'nie zapisuj' }])), { status: 200, headers: { 'content-type': 'application/json' } }); },
  });
  const input = { specialist: 'product_content', instruction: 'Popraw opis', context: { product: { name: 'Gra', producer: 'Alexander' } }, target: { type: 'product', productId: '17' } };
  const first = await service.run(input, { email: 'admin@example.com' }), second = await service.run(input, { email: 'admin@example.com' });
  assert.equal(calls, 1);
  assert.equal(second.cached, true);
  assert.equal(first.result.fields.length, 1);
  assert.equal(first.result.fields[0].key, 'short_description');
  assert.equal(requestBody.model, 'gpt-5-nano');
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.text.format.type, 'json_schema');
  assert.equal(requestBody.text.format.strict, true);
  assert.match(requestBody.instructions, /wyłącznie z przekazanych faktów/i);
  const status = await service.status();
  assert.equal(status.usage.today, 1);
  assert.equal(status.usage.inputTokens, 300);
});

test('zatwierdzenie szkicu zapisuje wyłącznie dozwolone pola produktu i jest idempotentne', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 17, nazwa: 'Gra', cena: 20 }] }, rev: 4, updated_at: null } });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => new Response(JSON.stringify(openAiPayload([{ key: 'title', label: 'Nazwa', value: 'Gra' }, { key: 'short_description', label: 'Opis krótki', value: 'Krótki opis.' }, { key: 'long_description', label: 'Opis pełny', value: '<p>Pełny opis.</p>' }])), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const run = await service.run({ specialist: 'product_content', context: { name: 'Gra' }, target: { type: 'product', productId: '17' } });
  const first = await service.applyProductDraft(run.id, { email: 'admin@example.com' }), second = await service.applyProductDraft(run.id, { email: 'admin@example.com' });
  assert.equal(first.applied, true);
  assert.equal(second.duplicate, true);
  const product = repo.values.get('settings').data.artway_produkty_dodane[0];
  assert.equal(product.opisKrotki, 'Krótki opis.');
  assert.equal(product.opis, '<p>Pełny opis.</p>');
  assert.equal(product.cena, 20);
  assert.equal(product.agentTextModel, 'gpt-5-nano-2025-08-07');
});

test('automatyczny cykl uzupełnia wyłącznie puste pola przy wysokiej pewności', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 99, nazwa: 'Nowa gra', producent: 'Alexander', opis: '', opisKrotki: '' }] }, rev: 1 } });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => new Response(JSON.stringify(openAiPayload([{ key: 'short_description', label: 'Opis krótki', value: 'Szkic.' }])), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.prepared.length, 1);
  assert.equal(cycle.prepared[0].status, 'auto_applied');
  assert.equal(cycle.applied.length, 1);
  assert.equal(repo.values.get('settings').data.artway_produkty_dodane[0].opisKrotki, 'Szkic.');
  assert.equal(repo.values.get('settings').data.artway_produkty_dodane[0].nazwa, 'Nowa gra');
  const status = await service.status();
  assert.equal(status.history[0].approvalStatus, 'auto_applied');
  assert.equal(status.history[0].source, 'automatic');
  assert.equal(status.policy.cycleMinutes, 15);
  assert.match(status.policy.neverAutomatic.join(' '), /wysyłanie wiadomości/);
});

test('nowa wiadomość tworzy szkic i decyzję, lecz nie jest wysyłana automatycznie', async () => {
  const repo = memoryRepository({
    settings: { data: {}, rev: 1 },
    allegro_communications: { threads: [{ id: 't-1', subject: 'Paczka', needsReply: true, humanReplyNeeded: true, newIncomingCount: 1, latestNewIncomingKey: 'm-1', messages: [{ id: 'm-1', authorRole: 'BUYER', text: 'Gdzie jest paczka?', createdAt: '2026-07-17T11:50:00.000Z' }] }], issues: [], updated_at: '2026-07-17T11:55:00.000Z' },
  });
  const replyPayload = openAiPayload([{ key: 'reply', label: 'Odpowiedź', value: 'Dziękujemy za wiadomość. Sprawdzamy potwierdzony status przesyłki.' }]);
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => new Response(JSON.stringify(replyPayload), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.prepared[0].type, 'communication');
  const status = await service.status();
  assert.equal(status.decisions.length, 1);
  assert.equal(status.decisions[0].kind, 'customer_reply');
  assert.equal(status.decisions[0].risk, 'high');
  assert.equal(status.history[0].approvalStatus, 'draft');
  assert.equal(repo.values.has('allegro_communications'), true);
});

test('decyzję można odłożyć i nie wraca ona do otwartych przed terminem', async () => {
  const repo = memoryRepository({
    agent_specialists_state: { config: {}, history: [], decisions: [{ id: 'd-1', fingerprint: 'fp-1', kind: 'catalog_identity', status: 'open', risk: 'medium', title: 'Brak EAN', target: { type: 'product', productId: '1' }, createdAt: '2026-07-17T10:00:00.000Z', updatedAt: '2026-07-17T10:00:00.000Z' }] },
  });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => new Response('{}', { status: 500 }) });
  const decision = await service.updateDecision('d-1', 'snooze', { days: 2 }, { email: 'admin@example.com' });
  assert.equal(decision.status, 'snoozed');
  assert.equal((await service.status()).decisions.length, 0);
});

test('trasa wymaga administratora i nigdy nie deklaruje automatycznej publikacji', async () => {
  const service = { status: async () => ({ configured: true }), run: async () => ({ id: 'gpt-1' }), configure: async (value) => value, applyProductDraft: async () => ({ applied: true }), automaticCycle: async () => ({ prepared: [] }) };
  const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const denied = createAgentSpecialistRoute({ service, isAdmin: () => false, respond });
  const deniedResponse = await denied(new Request('https://example.com/api?action=agent-specialists-status'), new URL('https://example.com/api?action=agent-specialists-status'), 'agent-specialists-status');
  assert.equal(deniedResponse.status, 401);
  const route = createAgentSpecialistRoute({ service, isAdmin: () => true, respond, sessionOf: () => ({ email: 'admin@example.com' }) });
  const response = await route(new Request('https://example.com/api?action=agent-specialist-run', { method: 'POST', body: '{}' }), new URL('https://example.com/api?action=agent-specialist-run'), 'agent-specialist-run');
  const body = await response.json();
  assert.equal(body.draftOnly, true);
  assert.equal(body.sentExternally, false);
  assert.equal(body.published, false);
});
