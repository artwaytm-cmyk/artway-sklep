import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_ACTION_POLICY, automaticEditorialAssessment, createAgentSpecialists, DEFAULT_CONFIG, normalizeProductContentEditorialResult, productEditorialAutomaticEligibility, productEditorialFingerprint, productEditorialQuality, productEditorialState, productFacts, productPatch, providerQuotaUnavailable, PROMPT_VERSION, SPECIALISTS, sanitizeContext } from '../src/backend/lib/domain/agent-specialists.mjs';

test('automatyczny Agent nie przepisuje aktywnej starszej oferty bez nowego zdarzenia', () => {
  const product = {
    id: 17,
    allegroOfferId: '123456789',
    allegroStatus: 'ACTIVE',
    nazwa: 'Gotowa oferta',
    opisKrotki: 'Krótki opis',
    opis: 'Pełny opis produktu, który ma wystarczającą długość do sprzedaży i nie wymaga ponownej redakcji bez zmiany źródła.'.repeat(2),
  };
  const eligibility = productEditorialAutomaticEligibility(product, productEditorialState(product));
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reason, 'legacy_active_listing_grandfathered');
  assert.equal(productEditorialAutomaticEligibility({ ...product, forceEditorialRefresh: true }, productEditorialState({ ...product, forceEditorialRefresh: true })).eligible, true);
});

test('zmiana promptu nie uruchamia ponownej redakcji czystej aktywnej oferty', () => {
  const product = {
    id: 18,
    allegroOfferId: '987654321',
    allegroStatus: 'ACTIVE',
    nazwa: 'Gotowa gra edukacyjna',
    opisKrotki: 'Gra edukacyjna wspierająca koncentrację i logiczne myślenie.',
    opis: 'Gra edukacyjna przeznaczona do wspólnej zabawy, ćwiczenia koncentracji oraz logicznego myślenia podczas czytelnej rozgrywki.'.repeat(2),
    contentEditorial: {
      status: 'ready',
      inputFingerprint: 'odcisk-starszej-wersji-promptu',
      sourceFingerprint: '',
      channelStates: {
        store: { status: 'ready', promptVersion: 'starszy-prompt', inputFingerprint: 'stary' },
        allegro: { status: 'ready', promptVersion: 'starszy-prompt', inputFingerprint: 'stary' },
      },
    },
  };
  const eligibility = productEditorialAutomaticEligibility(product, productEditorialState(product));
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reason, 'active_listing_verification_only');
});

test('blokada limitu dostawcy rozpoznaje błędy quota i nie myli zwykłego błędu treści', () => {
  assert.equal(providerQuotaUnavailable(Object.assign(new Error('You exceeded your current quota'), { code: 'insufficient_quota' })), true);
  assert.equal(providerQuotaUnavailable(new Error('Opis nie przeszedł kontroli jakości')), false);
});
import { createAgentSpecialistRoute } from '../src/backend/lib/agent-specialist-route.mjs';
import { SPECIALIST_PLAYBOOK_VERSION, specialistPlaybook } from '../src/backend/lib/domain/agent-specialist-playbooks.mjs';

function memoryRepository(initial = {}) {
  const values = new Map(Object.entries(structuredClone(initial))), versions = new Map([...values.keys()].map((key) => [key, 1]));
  const productData = values.get('settings')?.data || {};
  const products = new Map();
  for (const list of [
    productData.artway_produkty_katalog,
    productData.artway_produkty_dodane,
  ]) for (const product of Array.isArray(list) ? list : []) {
    if (product?.id !== undefined) products.set(String(product.id), structuredClone(product));
  }
  for (const [id, patch] of Object.entries(productData.artway_produkty_edytowane || {})) {
    products.set(String(id), { ...(products.get(String(id)) || { id }), ...structuredClone(patch) });
  }
  return {
    values,
    products,
    readVersioned: async (key, fallback) => ({ value: structuredClone(values.has(key) ? values.get(key) : fallback), version: versions.get(key) || 0 }),
    writeIfVersion: async (key, value, expected) => {
      if ((versions.get(key) || 0) !== expected.version) return { modified: false };
      values.set(key, structuredClone(value)); versions.set(key, (versions.get(key) || 0) + 1); return { modified: true };
    },
    loadProducts: async () => new Map([...products.entries()].map(([id, product]) => [id, structuredClone(product)])),
    saveProductFields: async ({ productId, fields = {}, remove = [] }) => {
      const id = String(productId), current = products.get(id) || { id };
      const next = { ...current, ...structuredClone(fields) };
      for (const field of remove) delete next[field];
      products.set(id, next);
      return {
        confirmed: true,
        product: structuredClone(next),
        publication: { published: true, readbackConfirmed: true },
      };
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

function requestInstructions(body = {}) {
  if (typeof body.instructions === 'string') return body.instructions;
  return (Array.isArray(body.input) ? body.input : [])
    .filter((item) => item?.role === 'developer')
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .map((item) => item?.text || '')
    .join('\n');
}

test('zespół zawiera konkretne role do treści, promocji, komunikacji i nadzoru', () => {
  assert.deepEqual(Object.keys(SPECIALISTS), ['product_content', 'store_compliance', 'allegro_offer', 'allegro_compliance', 'allegro_publication', 'von_halsky_offer', 'von_halsky_compliance', 'customer_reply', 'seo_promotion', 'campaign_copy', 'banner_copy', 'supplier_message', 'catalog_quality', 'operations_supervisor']);
  assert.match(SPECIALISTS.allegro_offer.rules, /poza Allegro/i);
  assert.match(SPECIALISTS.allegro_compliance.rules, /dostaw/i);
  assert.match(SPECIALISTS.allegro_publication.rules, /nie zgaduj/i);
  assert.match(SPECIALISTS.von_halsky_compliance.rules, /linki/i);
  assert.match(SPECIALISTS.supplier_message.rules, /cen/i);
  assert.match(specialistPlaybook('von_halsky_offer'), /nie może zawierać linków/i);
  assert.match(specialistPlaybook('operations_supervisor'), /Bramka jakości/i);
  assert.equal(SPECIALIST_PLAYBOOK_VERSION, PROMPT_VERSION);
});

test('administrator nadaje bezpieczne automatyki, ale stałych blokad nie można wyłączyć', () => {
  const configurable = AGENT_ACTION_POLICY.automatic.filter((item) => item.configKey);
  assert.deepEqual(configurable.map((item) => item.configKey), [
    'autoApplyProductEditorial', 'autoUpdateLinkedAllegroContent',
    'autoPrepareCustomerReplyDrafts', 'autoAuditCatalogIdentity',
  ]);
  assert.equal(DEFAULT_CONFIG.autoPrepareCustomerReplyDrafts, true);
  assert.equal(DEFAULT_CONFIG.autoAuditCatalogIdentity, true);
  assert.ok(AGENT_ACTION_POLICY.approvalRequired.length >= 5);
  assert.ok(AGENT_ACTION_POLICY.approvalRequired.every((item) => !item.configKey), 'chroniona decyzja nie może dostać przełącznika automatyki');
});

test('kontekst usuwa sekrety i prywatne dane przed wysłaniem do modelu', () => {
  const safe = sanitizeContext({ email: 'klient@example.com', phone: '530038914', nested: { token: 'sekret', note: 'Napisz do klient@example.com lub +48 530 038 914', key: 'sk-proj-abcdefghijklmnop' } });
  assert.equal('email' in safe, false);
  assert.equal('phone' in safe, false);
  assert.equal('token' in safe.nested, false);
  assert.doesNotMatch(JSON.stringify(safe), /klient@example\.com|530\s*038\s*914|sk-proj-/);
});

test('końcowy zapis opisu usuwa techniczny stan dostawcy oraz identyfikatory katalogowe', () => {
  const patch = productPatch({ fields: [
    { key: 'short_description', value: 'Gra edukacyjna, kod 2648. Rozmiar uniwersalny 483 szt.' },
    { key: 'long_description', value: '<p>Gra wspiera spostrzegawczość. Kod producenta: 2648, EAN 5906018026481.</p><ul><li></li></ul><p>Źródło: sklep producenta.</p>' },
  ] });
  assert.equal(patch.opisKrotki, 'Gra edukacyjna.');
  assert.doesNotMatch(patch.opis, /Kod producenta|EAN|2648|5906018026481|Źródło|<li>\s*<\/li>/i);
  assert.match(patch.opis, /spostrzegawczość/i);
});

test('agent dostaje oczyszczone fakty zamiast kontrolek i stanu sklepu producenta', () => {
  const facts = productFacts({
    id: 113, nazwa: 'Ale Pary – Jedzonko', producent: 'Alexander',
    opisKrotki: 'Dodaj do porównania Rozmiar: uniwersalny, 483 sztuki. Produkt dostępny.',
    opis: 'Dodaj do listy zakupowej. Wysyłka w czwartek. Sprawdź czasy i koszty wysyłki. 12,00 zł brutto / 1 szt.',
    sourceMaterial: { longDescription: 'Ale Pary – Jedzonko. Rozmiar uniwersalny 483 szt. Produkt jest dostępny.' },
  });
  const serialized = JSON.stringify(facts);
  assert.doesNotMatch(serialized, /Dodaj do|483 szt|Produkt (?:jest )?dostępny|Wysyłka w|12,00 zł/i);
  assert.match(serialized, /Ale Pary – Jedzonko/);
});

test('uwaga o niewprowadzaniu sprzeczności nie jest błędnie traktowana jako konflikt produktu', () => {
  const assessment = automaticEditorialAssessment({ target: { channels: 'store_only' }, result: {
    confidence: 0.94,
    editorialNotes: ['Upewnij się, aby nie wprowadzać sprzeczności w przyszłych aktualizacjach.'],
    fields: [
      { key: 'title', value: 'Gra rodzinna Alexander' },
      { key: 'short_description', value: 'Rodzinna gra rozwijająca spostrzegawczość.' },
      { key: 'long_description', value: '<h2>Wspólna rozgrywka</h2><p>Gra rodzinna pozwala ćwiczyć spostrzegawczość i logiczne myślenie podczas wspólnej zabawy.</p><p>Czytelne zasady ułatwiają rozpoczęcie rozgrywki i poznanie jej najważniejszych elementów.</p>' },
      { key: 'seo_title', value: 'Gra rodzinna Alexander' },
      { key: 'seo_description', value: 'Poznaj rodzinną grę Alexander rozwijającą spostrzegawczość i logiczne myślenie.' },
    ],
  } });
  assert.equal(assessment.eligible, true);
});

test('rozbieżne opcjonalne parametry nie są konfliktem tożsamości produktu', () => {
  const assessment = automaticEditorialAssessment({ specialist: 'allegro_offer', result: {
    confidence: 0.9,
    warnings: ['Wiek 4+ i 7-107 oraz liczba graczy 2 i 2-4 są sprzeczne, dlatego pominięto je w opisie.'],
    missingFacts: ['Potwierdzony wiek produktu.', 'Potwierdzona liczba graczy.'],
    fields: [
      { key: 'allegro_title', value: 'Multigra Piotruś i Pamięć Święta' },
      { key: 'allegro_description', value: 'Świąteczny zestaw 25 kart do dwóch klasycznych gier karcianych: Piotruś i Pamięć. Karty pozwalają ćwiczyć spostrzegawczość i skojarzenia podczas wspólnej zabawy.' },
    ],
  } });
  assert.equal(assessment.eligible, true);
  assert.equal(assessment.reason, 'safe_editorial_policy');
});

test('tytuł główny uzupełnia brakujące pole nazwy w częściowym wyniku redaktora sklepu', () => {
  const result = normalizeProductContentEditorialResult({
    title: 'Piotruś + Pamięć – Święta, gra karciana Multigra Alexander',
    summary: 'Świąteczny zestaw kart do rodzinnej zabawy.',
    content: 'Kompletna redakcja produktu.',
    fields: [
      { key: 'short_description', value: 'Świąteczny zestaw 25 kart do gier Piotruś i Pamięć.' },
      { key: 'long_description', value: '<h2>Piotruś i Pamięć</h2><p>Świąteczny zestaw zawiera 25 kart do dwóch klasycznych gier karcianych.</p><p>Rozgrywka pozwala ćwiczyć spostrzegawczość i skojarzenia podczas wspólnej zabawy.</p>' },
      { key: 'seo_title', value: 'Piotruś i Pamięć Święta – Multigra' },
      { key: 'seo_description', value: 'Świąteczny zestaw 25 kart do dwóch klasycznych gier karcianych.' },
    ],
    warnings: ['Wiek i liczba graczy są sprzeczne, dlatego pominięto je w treści.'],
    missingFacts: ['Potwierdzony wiek produktu.'],
    confidence: 0.9,
    readyForApproval: false,
    complianceStatus: 'needs_review',
  });
  const fields = Object.fromEntries(result.fields.map((field) => [field.key, field.value]));
  assert.equal(fields.title, 'Piotruś + Pamięć – Święta, gra karciana Multigra Alexander');
  assert.equal(result.readyForApproval, true);
  assert.equal(result.complianceStatus, 'ready');
});

test('kompletna treść modelu bez tablicy fields jest automatycznie zamieniana na pola edytora', () => {
  const result = normalizeProductContentEditorialResult({
    title: 'Ale Pary – Jedzonko – Alexander',
    summary: 'Edukacyjna gra z serii Ale Pary przeznaczona do wspólnej zabawy.',
    content: '<h2>Wspólna zabawa</h2><p>Ale Pary – Jedzonko to edukacyjna gra marki Alexander, która wspiera spostrzegawczość oraz kojarzenie pasujących elementów.</p><p>Proste zasady pozwalają szybko rozpocząć rozgrywkę i skupić się na wspólnej zabawie.</p>',
    fields: [], warnings: [], missingFacts: [], confidence: 0.55, readyForApproval: false, complianceStatus: 'ready',
  });
  assert.deepEqual(result.fields.map((field) => field.key), ['title', 'short_description', 'long_description', 'seo_title', 'seo_description', 'seo_keywords']);
  assert.equal(result.readyForApproval, true);
  assert.equal(result.complianceStatus, 'ready');
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
  assert.match(requestBody.instructions, /brak opcjonalnych parametrów.*nie jest missingFact/i);
  const status = await service.status();
  assert.equal(status.usage.today, 1);
  assert.equal(status.usage.inputTokens, 300);
});

test('produkcyjny specjalista wywołuje opublikowaną wersję promptu OpenAI Platform', async () => {
  const repo = memoryRepository(); let requestBody;
  const service = createAgentSpecialists({
    ...repo, apiKey: 'real-key', model: 'gpt-5-nano', now: () => new Date('2026-07-21T12:00:00.000Z'),
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify(openAiPayload([{ key: 'subject', label: 'Temat', value: 'Odpowiedź Artway' }, { key: 'reply', label: 'Odpowiedź', value: 'Dziękujemy za wiadomość.' }])), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const run = await service.run({ specialist: 'customer_reply', instruction: 'Przygotuj odpowiedź', context: { thread: 'Pytanie o przesyłkę.' } });
  assert.deepEqual(requestBody.prompt, SPECIALISTS.customer_reply.platformPrompt);
  assert.equal(requestBody.model, 'gpt-5-nano');
  assert.equal(run.platformAgent.id, SPECIALISTS.customer_reply.platformPrompt.id);
  assert.equal(run.platformAgent.version, SPECIALISTS.customer_reply.platformPrompt.version);
  assert.equal(run.platformAgent.available, true);
  assert.equal(run.platformAgent.fallback, false);
});

test('GPT-5.4 mini cacheuje długi stały playbook, ogranicza wynik i zapisuje odczyt cache', async () => {
  const repo = memoryRepository(); let requestBody;
  const service = createAgentSpecialists({
    ...repo, apiKey: 'real-key', now: () => new Date('2026-07-26T08:00:00.000Z'),
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      const payload = openAiPayload([{ key: 'subject', label: 'Temat', value: 'Odpowiedź Artway' }, { key: 'reply', label: 'Odpowiedź', value: 'Dziękujemy za wiadomość.' }]);
      payload.model = 'gpt-5.4-mini';
      payload.usage = { input_tokens: 2400, output_tokens: 300, total_tokens: 2700, input_tokens_details: { cached_tokens: 1800, cache_write_tokens: 0 } };
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const run = await service.run({ specialist: 'customer_reply', instruction: 'Przygotuj odpowiedź', context: { thread: 'Pytanie o przesyłkę.' } });
  assert.equal(requestBody.model, 'gpt-5.4-mini');
  assert.equal(requestBody.max_output_tokens, 1200);
  assert.equal(requestBody.prompt_cache_key, undefined);
  assert.equal(requestBody.prompt_cache_options, undefined);
  assert.match(requestBody.instructions, /Typowe pomyłki tej roli/i);
  assert.equal(run.usage.cachedTokens, 1800);
  assert.equal(run.promptCache.enabled, true);
  assert.equal(run.promptCache.mode, 'automatic');
});

test('błąd referencji promptu uruchamia jeden jawny fallback do wersjonowanych reguł serwera', async () => {
  const repo = memoryRepository(); const requests = [];
  const service = createAgentSpecialists({
    ...repo, apiKey: 'real-key', model: 'gpt-5-nano', now: () => new Date('2026-07-21T12:00:00.000Z'),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body); requests.push(body);
      if (body.prompt) return new Response(JSON.stringify({ error: { code: 'prompt_not_found', param: 'prompt.id', message: 'Prompt not found.' } }), { status: 404, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify(openAiPayload([{ key: 'subject', label: 'Temat', value: 'Odpowiedź Artway' }, { key: 'reply', label: 'Odpowiedź', value: 'Dziękujemy za wiadomość.' }])), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const run = await service.run({ specialist: 'customer_reply', instruction: 'Przygotuj odpowiedź', context: { thread: 'Pytanie o przesyłkę.' } });
  assert.equal(requests.length, 2);
  assert.ok(requests[0].prompt);
  assert.equal(requests[1].model, 'gpt-5-nano');
  assert.equal(run.platformAgent.available, false);
  assert.equal(run.platformAgent.fallback, true);
  assert.match(run.platformAgent.error, /Prompt not found/i);
});

test('pusta lub niepełna odpowiedź 200 jest raz ponawiana z regułami serwera i pełnym budżetem wyniku', async () => {
  const repo = memoryRepository(); const requests = [];
  const service = createAgentSpecialists({
    ...repo, apiKey: 'real-key', now: () => new Date('2026-07-26T08:30:00.000Z'),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body); requests.push(body);
      if (requests.length === 1) {
        return new Response(JSON.stringify({
          status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
          output: [{ type: 'reasoning', content: [] }], usage: { input_tokens: 1000, output_tokens: 2600, total_tokens: 3600 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify(openAiPayload([
        { key: 'title', label: 'Nazwa', value: 'Gra rodzinna Alexander' },
        { key: 'short_description', label: 'Opis krótki', value: 'Rodzinna gra do wspólnej zabawy.' },
        { key: 'long_description', label: 'Opis pełny', value: '<h2>Rodzinna rozgrywka</h2><p>Gra wspiera spostrzegawczość i wspólne spędzanie czasu.</p>' },
        { key: 'seo_title', label: 'SEO title', value: 'Gra rodzinna Alexander' },
        { key: 'seo_description', label: 'SEO description', value: 'Poznaj rodzinną grę Alexander do wspólnej zabawy.' },
        { key: 'seo_keywords', label: 'SEO keywords', value: 'gra rodzinna, Alexander' },
      ])), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const run = await service.run({
    specialist: 'product_content', instruction: 'Uporządkuj opis.',
    context: { product: { name: 'Gra', producer: 'Alexander' } }, target: { type: 'product', productId: '17' },
  });
  assert.equal(requests.length, 2);
  assert.ok(requests[0].prompt);
  assert.equal(requests[1].prompt, undefined);
  assert.equal(requests[1].reasoning.effort, 'low');
  assert.equal(requests[1].max_output_tokens, 3600);
  assert.equal(run.status, 'completed');
  assert.equal(run.platformAgent.fallback, true);
});

test('dzienny limit Agenta resetuje się o północy czasu polskiego, a nie według UTC', async () => {
  const repo = memoryRepository({ agent_specialists_state: { config: { dailyLimit: 10, automaticDailyLimit: 10 }, history: [
    { id: 'before-midnight', source: 'automatic', status: 'completed', createdAt: '2026-07-18T21:59:00.000Z', usage: { inputTokens: 10 } },
    { id: 'after-midnight', source: 'automatic', status: 'completed', createdAt: '2026-07-18T22:01:00.000Z', usage: { inputTokens: 20 } },
  ], decisions: [] } });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-18T22:30:00.000Z'), fetchImpl: async () => new Response('{}', { status: 500 }) });
  const status = await service.status();
  assert.equal(status.usage.limitDay, '2026-07-19');
  assert.equal(status.usage.today, 1);
  assert.equal(status.usage.automaticToday, 1);
  assert.equal(status.usage.inputTokens, 20);
});

test('sztuczne limity nie blokują pracy, dopóki administrator wyraźnie ich nie włączy', async () => {
  const repo = memoryRepository({ agent_specialists_state: { config: {
    dailyLimit: 1, automaticDailyLimit: 1, automaticInputTokenLimit: 20_000, automaticOutputTokenLimit: 10_000,
  }, history: [{
    id: 'earlier', source: 'automatic', status: 'completed', createdAt: '2026-07-26T08:00:00.000Z',
    usage: { inputTokens: 30_000, outputTokens: 15_000 },
  }], decisions: [] } });
  let calls = 0;
  const service = createAgentSpecialists({
    ...repo, apiKey: 'test-key', now: () => new Date('2026-07-26T09:00:00.000Z'),
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify(openAiPayload([{ key: 'short_description', label: 'Opis krótki', value: 'Rodzinna gra logiczna.' }])), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const result = await service.run({
    specialist: 'product_content', source: 'automatic', instruction: 'Popraw opis po raz pierwszy.',
    context: { product: { name: 'Gra', producer: 'Alexander' } }, target: { type: 'product', productId: '17' },
  });
  assert.equal(result.status, 'completed');
  assert.equal(calls, 1);
  const status = await service.status();
  assert.equal(status.usage.limitsEnabled, false);
  assert.equal(status.usage.dailyLimitReached, false);
  assert.equal(status.usage.automaticLimitReached, false);
});

test('zatwierdzenie szkicu zapisuje wyłącznie dozwolone pola produktu i jest idempotentne', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 17, nazwa: 'Gra', cena: 20 }] }, rev: 4, updated_at: null } });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => new Response(JSON.stringify(openAiPayload([{ key: 'title', label: 'Nazwa', value: 'Gra' }, { key: 'short_description', label: 'Opis krótki', value: 'Krótki opis.' }, { key: 'long_description', label: 'Opis pełny', value: '<p>Pełny opis.</p>' }])), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const run = await service.run({ specialist: 'product_content', context: { name: 'Gra' }, target: { type: 'product', productId: '17' } });
  const first = await service.applyProductDraft(run.id, { email: 'admin@example.com' }), second = await service.applyProductDraft(run.id, { email: 'admin@example.com' });
  assert.equal(first.applied, true);
  assert.equal(second.duplicate, true);
  const product = repo.products.get('17');
  assert.equal(product.opisKrotki, 'Krótki opis.');
  assert.equal(product.opis, '<p>Pełny opis.</p>');
  assert.equal(product.cena, 20);
  assert.equal(product.agentTextModel, 'gpt-5-nano-2025-08-07');
});

test('produkcyjna ścieżka Agenta wymaga zapisu, publikacji i zgodnego odczytu serwerowego', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 18, nazwa: 'Gra', cena: 20 }] }, rev: 4, updated_at: null } });
  const calls = [];
  const service = createAgentSpecialists({
    ...repo,
    apiKey: 'test-key',
    now: () => new Date('2026-07-26T07:10:00.000Z'),
    fetchImpl: async () => new Response(JSON.stringify(openAiPayload([
      { key: 'title', label: 'Nazwa', value: 'Gra rodzinna' },
      { key: 'short_description', label: 'Opis krótki', value: 'Krótki opis rodzinnej gry.' },
      { key: 'long_description', label: 'Opis pełny', value: '<h2>Rodzinna gra</h2><p>Gra pozwala wspólnie spędzić czas i ćwiczyć spostrzegawczość podczas rozgrywki.</p><ul><li>Czytelne zasady</li><li>Wspólna zabawa</li></ul>' },
      { key: 'seo_title', label: 'SEO title', value: 'Gra rodzinna' },
      { key: 'seo_description', label: 'SEO description', value: 'Poznaj rodzinną grę do wspólnej zabawy i ćwiczenia spostrzegawczości.' },
      { key: 'seo_keywords', label: 'SEO keywords', value: 'gra rodzinna' },
    ])), { status: 200, headers: { 'content-type': 'application/json' } }),
    saveProductFields: async (input) => {
      calls.push(input);
      return {
        mutationId: input.mutationId,
        confirmedAt: '2026-07-26T07:10:00.000Z',
        publication: { published: true, readbackConfirmed: true, revision: 'catalog-18' },
      };
    },
  });
  const run = await service.run({ specialist: 'product_content', context: { name: 'Gra' }, target: { type: 'product', productId: '18' } });
  const result = await service.applyProductDraft(run.id, { source: 'background-agent' }, { editorialAutomatic: true, editorialPolicyValidated: true });
  assert.equal(result.applied, true);
  assert.equal(result.persistence.readbackConfirmed, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].mutationId, /^agent-editorial:/);
  assert.equal(calls[0].area, 'agent-editorial-store');
  assert.equal((await service.status()).history.find((item) => item.id === run.id).approvalStatus, 'auto_applied');
});

test('Agent nie oznacza szkicu jako wykonanego, gdy serwer nie potwierdzi publikacji', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 19, nazwa: 'Gra' }] }, rev: 1 } });
  const fields = [
    { key: 'title', label: 'Nazwa', value: 'Gra rodzinna' },
    { key: 'short_description', label: 'Opis krótki', value: 'Krótki opis rodzinnej gry.' },
    { key: 'long_description', label: 'Opis pełny', value: '<h2>Rodzinna gra</h2><p>Gra pozwala wspólnie spędzić czas i ćwiczyć spostrzegawczość podczas rozgrywki.</p><ul><li>Czytelne zasady</li><li>Wspólna zabawa</li></ul>' },
    { key: 'seo_title', label: 'SEO title', value: 'Gra rodzinna' },
    { key: 'seo_description', label: 'SEO description', value: 'Poznaj rodzinną grę do wspólnej zabawy i ćwiczenia spostrzegawczości.' },
    { key: 'seo_keywords', label: 'SEO keywords', value: 'gra rodzinna' },
  ];
  const service = createAgentSpecialists({
    ...repo, apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify(openAiPayload(fields)), { status: 200, headers: { 'content-type': 'application/json' } }),
    saveProductFields: async () => ({ publication: { published: true, readbackConfirmed: false } }),
  });
  const run = await service.run({ specialist: 'product_content', context: { name: 'Gra' }, target: { type: 'product', productId: '19' } });
  await assert.rejects(
    () => service.applyProductDraft(run.id, { source: 'background-agent' }, { editorialAutomatic: true, editorialPolicyValidated: true }),
    (error) => error.code === 'agent_product_persistence_unconfirmed',
  );
  assert.equal((await service.status()).history.find((item) => item.id === run.id).approvalStatus, 'draft');
});

test('kolejne kanały zachowują wcześniejszy stan produktu także przy istniejącej warstwie edycji', async () => {
  const originalEditorial = {
    status: 'partial_ready',
    channelStates: {
      store: { status: 'ready', promptVersion: PROMPT_VERSION, inputFingerprint: 'previous' },
    },
  };
  const repo = memoryRepository({ settings: { data: {
    artway_produkty_dodane: [{ id: 20, nazwa: 'Gra', opisKrotki: 'Opis', opis: 'Pełny opis produktu wymagający dalszego przygotowania redakcyjnego dla wszystkich kanałów sprzedaży.' }],
    artway_produkty_edytowane: { 20: { contentEditorial: originalEditorial, seoTitle: 'Gra', seoDescription: 'Opis gry' } },
  }, rev: 2 } });
  const vhFields = [
    { key: 'von_halsky_title', label: 'Nazwa', value: 'Gra rodzinna' },
    { key: 'von_halsky_short_description', label: 'Opis krótki', value: 'Rodzinna gra do wspólnej zabawy.' },
    { key: 'von_halsky_description', label: 'Opis pełny', value: '<h2>Rodzinna zabawa</h2><p>Gra pozwala wspólnie spędzić czas i ćwiczyć spostrzegawczość podczas rozgrywki.</p><ul><li>Czytelne zasady</li><li>Wspólna zabawa</li></ul>' },
  ];
  const service = createAgentSpecialists({
    ...repo, apiKey: 'test-key', now: () => new Date('2026-07-26T07:15:00.000Z'),
    fetchImpl: async () => new Response(JSON.stringify(openAiPayload(vhFields)), { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  const run = await service.run({ specialist: 'von_halsky_offer', context: { name: 'Gra' }, target: { type: 'product', productId: '20' } });
  await service.applyProductDraft(run.id, {}, { editorialAutomatic: true, editorialPolicyValidated: true });
  const saved = repo.products.get('20');
  assert.ok(saved.contentEditorial.channelStates.store, 'stan wcześniejszego kanału nie może zostać usunięty');
  assert.ok(saved.contentEditorial.channelStates.vonHalsky, 'nowy kanał powinien zostać dopisany');
});

test('równoległe wywołanie timera i panelu nie uruchamia drugiej redakcji tego samego produktu', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{
    id: 21, nazwa: 'Gra rodzinna', producent: 'Alexander', kategoria: 'Gry',
    opisKrotki: 'Krótki opis.', opis: 'Pełny opis gry rodzinnej wymagający profesjonalnego uporządkowania przed publikacją w kanałach sprzedaży.',
  }] }, rev: 1 } });
  let release;
  const responseReady = new Promise((resolve) => { release = resolve; });
  const fields = [
    { key: 'title', label: 'Nazwa', value: 'Gra rodzinna Alexander' },
    { key: 'short_description', label: 'Opis krótki', value: 'Rodzinna gra Alexander do wspólnej zabawy.' },
    { key: 'long_description', label: 'Opis pełny', value: '<h2>Rodzinna rozgrywka</h2><p>Gra pozwala wspólnie spędzić czas i ćwiczyć spostrzegawczość podczas rozgrywki.</p><ul><li>Czytelne zasady</li><li>Wspólna zabawa</li></ul>' },
    { key: 'seo_title', label: 'SEO title', value: 'Gra rodzinna Alexander' },
    { key: 'seo_description', label: 'SEO description', value: 'Poznaj rodzinną grę Alexander do wspólnej zabawy i ćwiczenia spostrzegawczości.' },
    { key: 'seo_keywords', label: 'SEO keywords', value: 'gra rodzinna, Alexander' },
  ];
  const service = createAgentSpecialists({
    ...repo, apiKey: 'test-key',
    fetchImpl: async () => {
      await responseReady;
      return new Response(JSON.stringify(openAiPayload(fields)), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const first = service.automaticCycle({ maxItems: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  const concurrent = await service.automaticCycle({ maxItems: 1 });
  assert.equal(concurrent.skipped, true);
  assert.equal(concurrent.reason, 'already_running');
  release();
  const completed = await first;
  assert.equal(completed.applied.length, 1);
});

test('poprawiona treść nie zmienia odcisku źródła i kolejny cykl nie redaguje ponownie tego samego kanału', async () => {
  const sourceMaterial = {
    allegroOfferDescription: 'Gra liczbowa dla dzieci od 8 lat. Zestaw zawiera planszę, pionki, żetony, kostki oraz instrukcję.',
  };
  const original = {
    id: 22, nazwa: 'LICZ NA SIEBIE', producent: 'Alexander', kategoria: 'Gry edukacyjne',
    gtin: '5906018000221', opisKrotki: 'Stary skrót.', opis: 'Stary opis.',
    allegroCategoryId: '123', sourceMaterial,
  };
  const edited = {
    ...original,
    nazwa: 'Licz na Siebie – gra edukacyjna Alexander',
    opisKrotki: 'Edukacyjna gra liczbowa dla dzieci od 8 lat.',
    opis: '<h2>Nauka przez zabawę</h2><p>Gra wspiera ćwiczenie działań matematycznych podczas rodzinnej rozgrywki.</p><ul><li>Plansza</li><li>Pionki i żetony</li></ul>',
  };
  assert.equal(productEditorialFingerprint(original), productEditorialFingerprint(edited));

  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [original] }, rev: 1 } });
  const storeFields = [
    { key: 'title', label: 'Nazwa', value: edited.nazwa },
    { key: 'short_description', label: 'Opis krótki', value: edited.opisKrotki },
    { key: 'long_description', label: 'Opis pełny', value: edited.opis },
    { key: 'seo_title', label: 'SEO title', value: edited.nazwa },
    { key: 'seo_description', label: 'SEO description', value: 'Edukacyjna gra liczbowa Alexander dla dzieci od 8 lat.' },
    { key: 'seo_keywords', label: 'SEO keywords', value: 'gra liczbowa, Alexander' },
  ];
  const vonHalskyFields = [
    { key: 'von_halsky_title', label: 'Nazwa', value: 'Alexander Licz na Siebie gra edukacyjna' },
    { key: 'von_halsky_short_description', label: 'Opis krótki', value: 'Gra liczbowa dla dzieci od 8 lat.' },
    { key: 'von_halsky_description', label: 'Opis pełny', value: '<h2>Gra liczbowa</h2><p>Zestaw pozwala ćwiczyć działania matematyczne podczas rozgrywki.</p><ul><li>Plansza</li><li>Pionki</li></ul>' },
  ];
  const calls = [];
  const service = createAgentSpecialists({
    ...repo, apiKey: 'test-key',
    fetchImpl: async (_url, options) => {
      const instructions = requestInstructions(JSON.parse(options.body));
      const channel = /Redaktor Von Halsky/.test(instructions) ? 'vonHalsky' : 'store';
      calls.push(channel);
      return new Response(JSON.stringify(openAiPayload(channel === 'store' ? storeFields : vonHalskyFields)), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  const first = await service.automaticCycle({ maxItems: 1 });
  const second = await service.automaticCycle({ maxItems: 1 });
  assert.equal(first.applied[0].channel, 'store');
  assert.equal(second.applied[0].channel, 'vonHalsky');
  assert.deepEqual(calls, ['store', 'vonHalsky']);
});

test('automatyczny cykl zapisuje trzy niezależne i bezpieczne wersje kanałów', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 99, nazwa: 'NOWA GRA | SKLEP', producent: 'Alexander', kategoria: 'Gry rodzinne', gtin: '5906018000092', opis: 'Słaby opis.', opisKrotki: 'Stary skrót.', allegroCategoryId: '123' }] }, rev: 1 } });
  let calls = 0;
  const longDescription = '<h2>Rodzinna rozgrywka</h2><p>Ta gra pozwala wspólnie spędzić czas, ćwiczyć spostrzegawczość i poznawać zasady opisane w dołączonej instrukcji.</p><ul><li>Czytelne zasady</li><li>Wspólna zabawa</li></ul>';
  const storeFields = [
    { key: 'title', label: 'Nazwa', value: 'Nowa gra rodzinna' },
    { key: 'short_description', label: 'Opis krótki', value: 'Rodzinna gra oparta na czytelnych zasadach i wspólnej zabawie.' },
    { key: 'long_description', label: 'Opis pełny', value: longDescription },
    { key: 'seo_title', label: 'SEO title', value: 'Nowa gra rodzinna – Alexander' },
    { key: 'seo_description', label: 'SEO description', value: 'Poznaj rodzinną grę Alexander z czytelnymi zasadami i wspólną rozgrywką.' },
    { key: 'seo_keywords', label: 'Frazy SEO', value: 'gra rodzinna, Alexander' },
  ];
  const allegroFields = [
    { key: 'allegro_title', label: 'Tytuł', value: 'Nowa gra rodzinna Alexander' },
    { key: 'allegro_description', label: 'Opis', value: '<h2>Rodzinna rozgrywka</h2><p>Gra pozwala ćwiczyć spostrzegawczość i wspólnie poznawać czytelne zasady.</p><ul><li>Wspólna zabawa</li><li>Czytelna instrukcja</li></ul>' },
  ];
  const vhFields = [
    { key: 'von_halsky_title', label: 'Nazwa', value: 'Nowa gra rodzinna Alexander' },
    { key: 'von_halsky_short_description', label: 'Opis krótki', value: 'Rodzinna gra Alexander oparta na czytelnych zasadach i wspólnej zabawie.' },
    { key: 'von_halsky_description', label: 'Opis pełny', value: '<h2>Rodzinna zabawa</h2><p>Gra pozwala ćwiczyć spostrzegawczość podczas wspólnej rozgrywki i poznawania czytelnych zasad.</p><ul><li>Prosta forma</li><li>Wspólny czas</li></ul>' },
  ];
  const service = createAgentSpecialists({
    ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'),
    fetchImpl: async (_url, options) => {
      calls += 1;
      const instructions = requestInstructions(JSON.parse(options.body));
      const fields = /Redaktor oferty Allegro/.test(instructions) ? allegroFields : /Redaktor Von Halsky/.test(instructions) ? vhFields : storeFields;
      return new Response(JSON.stringify(openAiPayload(fields)), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.prepared.length, 3);
  assert.ok(cycle.prepared.every((item) => item.status === 'auto_applied'));
  assert.equal(cycle.applied.length, 3);
  assert.equal((await service.status()).decisions.some((item) => item.kind === 'product_content_review'), false);
  const product = [...repo.products.values()][0];
  assert.equal(product.nazwa, 'Nowa gra rodzinna');
  assert.equal(product.opis, longDescription);
  assert.notEqual(product.allegroDescription, longDescription);
  assert.notEqual(product.vonHalskyDescription, longDescription);
  assert.equal(product.contentEditorial.status, 'ready');
  assert.equal(product.contentEditorial.channels, 'independent_store_allegro_von_halsky');
  assert.equal(product.contentEditorial.targets.vonHalsky, true);
  assert.equal(product.contentEditorial.targets.allegro, true);
  assert.equal(product.vonHalskyContentMode, 'custom');
  assert.equal(product.vonHalskyContentSource, 'agent-independent-von-halsky-content');
  assert.deepEqual(Object.fromEntries(Object.entries(product.contentEditorial.channelStates).map(([key, value]) => [key, value.status])), { store: 'ready', vonHalsky: 'ready', allegro: 'ready' });
  assert.equal(product.allegroEditorialSyncPending, true);
  assert.equal(product.allegroEditorialSyncState, 'queued');
  assert.ok(Array.isArray(product.allegroDescriptionSections));
  const second = await service.automaticCycle();
  assert.equal(second.reason, 'no_candidates');
  assert.equal(calls, 3);
  const status = await service.status();
  assert.equal(status.history[0].approvalStatus, 'auto_applied');
  assert.equal(status.history[0].source, 'automatic');
  assert.equal(status.policy.cycleMinutes, 15);
  assert.equal(status.policy.editorialAutonomy, true);
  assert.equal(status.policy.linkedAllegroContentAutonomy, true);
  assert.equal(status.learning.productContent.approvals, 0);
  assert.equal(status.learning.productContent.ready, false);
  assert.equal(status.learning.productContent.remainingApprovals, 0);
  assert.equal(status.lastCycle.editorialProgress.ready, 1);
  assert.equal(status.lastCycle.editorialProgress.pending, 0);
  assert.match(status.policy.neverAutomatic.join(' '), /Wiadomość do klienta/i);
});

test('redakcja sklepu zachowuje starszy osobny opis Von Halsky bez nadpisania', async () => {
  const legacy = {
    id: 109, nazwa: 'Gra edukacyjna', producent: 'Alexander', kategoria: 'Gry edukacyjne', gtin: '5906018001099',
    opisKrotki: 'Stary opis sklepu.', opis: 'Stary pełny opis sklepu, który wymaga uporządkowania i zapisania we wspólnej kartotece produktu.',
    vonHalskyContentMode: 'custom', vonHalskyShortDescription: 'Lepsze wprowadzenie z prezentacji Von Halsky.',
    vonHalskyDescription: 'Pełna prezentacja Von Halsky zawierająca potwierdzone informacje o edukacyjnej zabawie i najważniejszych cechach produktu.',
  };
  const facts = productFacts(legacy);
  assert.match(facts.channelContent.vonHalsky.fullDescription, /Pełna prezentacja Von Halsky/);
  const fields = [
    { key: 'title', label: 'Nazwa', value: 'Gra edukacyjna Alexander' },
    { key: 'short_description', label: 'Opis krótki', value: 'Edukacyjna gra Alexander przygotowana do wspólnej, rozwijającej zabawy.' },
    { key: 'long_description', label: 'Opis pełny', value: '<h2>Rozwijająca zabawa</h2><p>Gra edukacyjna pozwala ćwiczyć ważne umiejętności podczas wspólnej zabawy zgodnej z zasadami produktu.</p><ul><li>Czytelna forma rozgrywki</li><li>Wspólne spędzanie czasu</li></ul>' },
    { key: 'seo_title', label: 'SEO title', value: 'Gra edukacyjna Alexander' },
    { key: 'seo_description', label: 'SEO description', value: 'Poznaj edukacyjną grę Alexander przygotowaną do wspólnej i rozwijającej zabawy.' },
    { key: 'seo_keywords', label: 'Frazy SEO', value: 'gra edukacyjna, Alexander' },
  ];
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [legacy] }, rev: 1 } });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-23T12:00:00.000Z'), fetchImpl: async () => new Response(JSON.stringify(openAiPayload(fields)), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const run = await service.run({ specialist: 'product_content', context: { product: facts }, target: { type: 'product', productId: '109' } });
  const applied = await service.applyProductDraft(run.id, {}, { editorialAutomatic: true, editorialPolicyValidated: true });
  assert.equal(applied.applied, true);
  const saved = repo.products.get('109');
  assert.equal(saved.vonHalskyContentMode, 'custom');
  assert.equal(saved.vonHalskyDescription, legacy.vonHalskyDescription);
  assert.equal(saved.opis, fields[2].value);
  assert.equal(saved.contentEditorial.channels, 'independent_store_von_halsky');
  assert.deepEqual(saved.contentEditorial.targets, { store: true, vonHalsky: true, allegro: false });
});

test('stare oznaczenie ready nie ukrywa surowego opisu dostawcy i Agent nadpisuje oba pola opisów', async () => {
  const legacy = {
    id: 100, nazwa: 'Loteryjka obrazkowa', producent: 'Alexander', kategoria: 'Gry edukacyjne', gtin: '5906018000108',
    opisKrotki: 'Dodaj do porównania. Produkt dostępny.',
    opis: '<p>Dodaj do listy zakupowej. Rozmiar uniwersalny 810 szt. Produkt dostępny. Wysyłka w czwartek. Sprawdź czasy i koszty wysyłki. Skontaktuj się z nami.</p><p>Gra obrazkowa przeznaczona do wspólnej zabawy.</p>',
    allegroTitle: 'Loteryjka obrazkowa Alexander',
    allegroDescription: '<p>Produkt dostępny. Skontaktuj się z nami przed zakupem i sprawdź koszt wysyłki.</p>',
    seoTitle: 'Loteryjka obrazkowa – Alexander', seoDescription: 'Gra obrazkowa Alexander dla dzieci.',
  };
  const fingerprint = productEditorialFingerprint(legacy);
  legacy.contentEditorial = { status: 'ready', promptVersion: PROMPT_VERSION, inputFingerprint: fingerprint, channels: 'shared_store_von_halsky' };
  assert.equal(productEditorialQuality(legacy).ready, false);
  assert.deepEqual(productEditorialQuality(legacy).issues.sort(), ['comparison_control', 'shopping_list_control', 'source_availability', 'source_contact', 'source_size_stock', 'source_shipping_control', 'source_stock'].sort());
  assert.equal(productEditorialState(legacy).current, false);

  const longDescription = '<h2>Wspólna zabawa z obrazkami</h2><p>Loteryjka obrazkowa pomaga ćwiczyć spostrzegawczość i kojarzenie elementów podczas rodzinnej rozgrywki.</p><ul><li>Czytelne ilustracje</li><li>Proste zasady zabawy</li></ul>';
  const fields = [
    { key: 'title', label: 'Nazwa', value: 'Loteryjka obrazkowa Alexander' },
    { key: 'short_description', label: 'Opis krótki', value: 'Obrazkowa gra rozwijająca spostrzegawczość i umiejętność kojarzenia.' },
    { key: 'long_description', label: 'Opis pełny', value: longDescription },
    { key: 'seo_title', label: 'SEO title', value: 'Loteryjka obrazkowa – Alexander' },
    { key: 'seo_description', label: 'SEO description', value: 'Poznaj loteryjkę obrazkową Alexander wspierającą spostrzegawczość podczas zabawy.' },
    { key: 'seo_keywords', label: 'Frazy', value: 'loteryjka obrazkowa, Alexander' },
  ];
  const repo = memoryRepository({ settings: { data: {
    artway_produkty_dodane: [legacy],
    artway_produkty_edytowane: { '100': { opisKrotki: legacy.opisKrotki, opis: legacy.opis, allegroOfferId: 'offer-100' } },
  }, rev: 1 } });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-19T12:00:00.000Z'), fetchImpl: async () => new Response(JSON.stringify(openAiPayload(fields)), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.applied.length, 1);
  const saved = repo.products.get('100');
  assert.equal(saved.opisKrotki, 'Obrazkowa gra rozwijająca spostrzegawczość i umiejętność kojarzenia.');
  assert.equal(saved.opis, longDescription);
  assert.equal(saved.opis, longDescription, 'zapis musi trafić do centralnej kartoteki');
  assert.equal(saved.agentTextMode, 'autonomous-editorial');
  assert.ok(saved.agentTextRunId);
  assert.ok(saved.agentTextReviewedAt);
  assert.equal(productEditorialQuality(saved).ready, true);
  assert.equal(productEditorialState(saved).currentChannels.store, true);
  assert.equal(productEditorialState(saved).current, false, 'pozostałe kanały zachowują własne niezależne kolejki');
});

test('wynik zawierający kontrolki strony dostawcy jest automatycznie odrzucany także dla samego sklepu', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 102, nazwa: 'Gra obrazkowa', producent: 'Alexander', opisKrotki: 'Skrót', opis: 'Opis źródłowy.' }] }, rev: 1 } });
  const fields = [
    { key: 'title', label: 'Nazwa', value: 'Gra obrazkowa Alexander' },
    { key: 'short_description', label: 'Opis krótki', value: 'Produkt dostępny. Dodaj do porównania.' },
    { key: 'long_description', label: 'Opis pełny', value: '<h2>Gra obrazkowa</h2><p>Dodaj do listy zakupowej. Produkt marki Alexander przeznaczony jest do wspólnej zabawy i ćwiczenia spostrzegawczości.</p><p>Ilustracje ułatwiają rozpoznawanie elementów oraz wspierają spokojną, rodzinną rozgrywkę.</p>' },
    { key: 'seo_title', label: 'SEO title', value: 'Gra obrazkowa Alexander' },
    { key: 'seo_description', label: 'SEO description', value: 'Gra obrazkowa producenta Alexander do wspólnej zabawy.' },
    { key: 'seo_keywords', label: 'Frazy', value: 'gra obrazkowa, Alexander' },
  ];
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-19T12:00:00.000Z'), fetchImpl: async () => new Response(JSON.stringify(openAiPayload(fields)), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.applied.length, 0);
  assert.equal(cycle.prepared[0].reason, 'source_page_noise');
  const product = repo.products.get('102');
  assert.equal(product.opisKrotki, 'Skrót');
  assert.equal(product.contentEditorial.status, 'retry_pending');
});

test('kontrola Allegro zatrzymuje niedozwolony opis i planuje automatyczną ponowną próbę bez klikania', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 101, nazwa: 'Gra testowa', producent: 'Alexander', opisKrotki: 'Skrót', opis: 'Opis', gtin: '5906018000092', allegroOfferId: 'offer-101', forceEditorialRefresh: true }] }, rev: 1 } });
  const fields = [
    { key: 'title', label: 'Nazwa', value: 'Gra testowa Alexander' },
    { key: 'short_description', label: 'Opis krótki', value: 'Rodzinna gra producenta Alexander.' },
    { key: 'long_description', label: 'Opis pełny', value: '<h2>Rodzinna gra</h2><p>Skontaktuj się z nami przed zakupem, aby potwierdzić dostępność. Produkt marki Alexander przeznaczony jest do wspólnej zabawy.</p>' },
    { key: 'seo_title', label: 'SEO title', value: 'Gra testowa Alexander' },
    { key: 'seo_description', label: 'SEO description', value: 'Rodzinna gra testowa producenta Alexander.' },
    { key: 'seo_keywords', label: 'Frazy', value: 'gra rodzinna, Alexander' },
  ];
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => new Response(JSON.stringify(openAiPayload(fields)), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.applied.length, 0);
  assert.equal(cycle.prepared[0].status, 'retry_scheduled');
  const status = await service.status();
  assert.equal(status.decisions.some((item) => item.kind === 'product_content_review'), false);
  const product = repo.products.get('101');
  assert.equal(product.opis, 'Opis');
  assert.equal(product.contentEditorial.status, 'retry_pending');
  assert.match(product.contentEditorial.channelStates.store.warnings.join(' '), /source_page_noise|contact|dostęp/i);
});

test('Strażnik Allegro automatycznie poprawia logistykę zatrzymaną po pierwszej redakcji', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 103, nazwa: 'Origami statek', producent: 'Alexander', opisKrotki: 'Skrót', opis: 'Opis źródłowy.', gtin: '5906018026658', allegroOfferId: '14138119461', forceEditorialRefresh: true }] }, rev: 1 } });
  const store = [
    { key: 'title', label: 'Nazwa', value: 'Moje pierwsze origami – statek – Alexander' },
    { key: 'short_description', label: 'Opis krótki', value: 'Zestaw origami dla początkujących rozwijający wyobraźnię i sprawność manualną.' },
    { key: 'long_description', label: 'Opis pełny', value: '<h2>Origami dla początkujących</h2><p>Zestaw pozwala złożyć papierowy statek i rozwija sprawność manualną.</p><p>Czytelna instrukcja prowadzi przez kolejne etapy składania modelu.</p>' },
    { key: 'seo_title', label: 'SEO title', value: 'Moje pierwsze origami statek – Alexander' },
    { key: 'seo_description', label: 'SEO description', value: 'Zestaw origami Alexander dla początkujących, wspierający wyobraźnię i sprawność manualną.' },
    { key: 'seo_keywords', label: 'Frazy', value: 'origami statek, Alexander' },
  ];
  const vonHalsky = [
    { key: 'von_halsky_title', label: 'Nazwa', value: 'Moje pierwsze origami statek Alexander' },
    { key: 'von_halsky_short_description', label: 'Opis krótki', value: 'Zestaw origami do złożenia papierowego statku i ćwiczenia sprawności manualnej.' },
    { key: 'von_halsky_description', label: 'Opis', value: '<h2>Papierowy statek</h2><p>Zestaw pozwala złożyć model statku i ćwiczyć dokładność podczas twórczej zabawy.</p><p>Czytelna instrukcja prowadzi przez kolejne etapy.</p>' },
  ];
  const unsafe = openAiPayload([{ key: 'allegro_title', label: 'Tytuł', value: 'Moje pierwsze origami statek Alexander' }, { key: 'allegro_description', label: 'Opis', value: '<h2>Origami dla początkujących</h2><p>Zestaw pozwala złożyć papierowy statek i rozwija sprawność manualną.</p><p>Wysyłka w 24 godziny kurierem InPost.</p>' }]);
  const safe = openAiPayload([{ key: 'allegro_title', label: 'Tytuł', value: 'Moje pierwsze origami statek Alexander' }, { key: 'allegro_description', label: 'Opis', value: '<h2>Origami dla początkujących</h2><p>Zestaw pozwala złożyć papierowy statek i rozwija sprawność manualną.</p><p>Czytelna instrukcja prowadzi przez kolejne etapy składania modelu.</p>' }]);
  let calls = 0;
  const service = createAgentSpecialists({
    ...repo, apiKey: 'test-key', now: () => new Date('2026-07-21T13:00:00.000Z'),
    fetchImpl: async (_url, options) => {
      calls += 1; const instructions = requestInstructions(JSON.parse(options.body));
      const payload = /Strażnik zgodności Allegro/.test(instructions) ? safe : /Redaktor oferty Allegro/.test(instructions) ? unsafe : /Redaktor Von Halsky/.test(instructions) ? openAiPayload(vonHalsky) : openAiPayload(store);
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const cycle = await service.automaticCycle();
  assert.equal(calls, 4);
  assert.equal(cycle.applied.length, 3);
  assert.ok(cycle.prepared.every((item) => item.status === 'auto_applied'));
  const status = await service.status();
  assert.deepEqual(status.history.slice(0, 4).map((item) => item.specialist), ['allegro_compliance', 'allegro_offer', 'von_halsky_offer', 'product_content']);
  const product = repo.products.get('103');
  assert.match(product.allegroDescription, /papierowy statek/i);
  assert.doesNotMatch(product.allegroDescription, /wysyłk|kurier|InPost/i);
  assert.equal(product.contentEditorial.status, 'ready');
});

test('Strażnik Von Halsky osobno poprawia strukturę treści odrzuconą przez kanał', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 104, nazwa: 'Gra edukacyjna Alexander', producent: 'Alexander', opisKrotki: 'Skrót', opis: 'Opis źródłowy.', gtin: '5906018000030' }] }, rev: 1 } });
  const store = [
    { key: 'title', label: 'Nazwa', value: 'Gra edukacyjna Alexander' },
    { key: 'short_description', label: 'Opis krótki', value: 'Gra edukacyjna wspierająca spostrzegawczość i logiczne myślenie.' },
    { key: 'long_description', label: 'Opis pełny', value: '<h2>Rozwijająca rozgrywka</h2><p>Gra zawiera elementy potrzebne do rodzinnej rozgrywki i ćwiczenia spostrzegawczości.</p><p>Czytelne zasady pomagają rozpocząć wspólną zabawę.</p>' },
    { key: 'seo_title', label: 'SEO title', value: 'Gra edukacyjna Alexander' },
    { key: 'seo_description', label: 'SEO description', value: 'Gra edukacyjna Alexander wspierająca spostrzegawczość oraz logiczne myślenie.' },
    { key: 'seo_keywords', label: 'Frazy', value: 'gra edukacyjna, Alexander' },
  ];
  const unsafe = openAiPayload([
    { key: 'von_halsky_title', label: 'Nazwa', value: 'Gra edukacyjna Alexander' },
    { key: 'von_halsky_short_description', label: 'Opis krótki', value: 'Gra edukacyjna wspierająca spostrzegawczość i logiczne myślenie.' },
    { key: 'von_halsky_description', label: 'Opis pełny', value: '<table><tr><td>Gra zawiera elementy potrzebne do rodzinnej rozgrywki i ćwiczenia spostrzegawczości.</td></tr></table><p>Czytelne zasady pomagają rozpocząć wspólną zabawę.</p>' },
  ]);
  const safe = openAiPayload([
    { key: 'von_halsky_title', label: 'Nazwa', value: 'Gra edukacyjna Alexander' },
    { key: 'von_halsky_short_description', label: 'Opis krótki', value: 'Gra edukacyjna wspierająca spostrzegawczość i logiczne myślenie.' },
    { key: 'von_halsky_description', label: 'Opis pełny', value: '<h2>Rozwijająca rozgrywka</h2><p>Gra zawiera elementy potrzebne do rodzinnej rozgrywki i ćwiczenia spostrzegawczości.</p><p>Czytelne zasady pomagają rozpocząć wspólną zabawę.</p>' },
  ]);
  let calls = 0;
  const service = createAgentSpecialists({
    ...repo, apiKey: 'test-key', now: () => new Date('2026-07-23T14:00:00.000Z'),
    fetchImpl: async (_url, options) => {
      calls += 1; const instructions = requestInstructions(JSON.parse(options.body));
      const payload = /Strażnik treści Von Halsky/.test(instructions) ? safe : /Redaktor Von Halsky/.test(instructions) ? unsafe : openAiPayload(store);
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const cycle = await service.automaticCycle();
  assert.equal(calls, 3);
  assert.equal(cycle.applied.length, 2);
  const status = await service.status();
  assert.deepEqual(status.history.slice(0, 3).map((item) => item.specialist), ['von_halsky_compliance', 'von_halsky_offer', 'product_content']);
  const product = repo.products.get('104');
  assert.doesNotMatch(product.vonHalskyDescription, /<table|<tr|<td/i);
  assert.equal(product.contentEditorial.channelStates.vonHalsky.compliance.status, 'passed');
  assert.equal(product.opis, store[2].value);
});

test('nowa wiadomość tworzy szkic i decyzję, lecz nie jest wysyłana automatycznie', async () => {
  const repo = memoryRepository({
    settings: { data: {}, rev: 1 },
    allegro_communications: { threads: [{ id: 't-1', subject: 'Paczka', needsReply: true, humanReplyNeeded: true, newIncomingCount: 1, latestNewIncomingKey: 'm-1', messages: [{ id: 'm-1', authorRole: 'BUYER', text: 'Gdzie jest paczka?', createdAt: '2026-07-17T11:50:00.000Z' }] }], issues: [], updated_at: '2026-07-17T11:55:00.000Z' },
  });
  const replyPayload = openAiPayload([{ key: 'reply', label: 'Odpowiedź', value: 'Dziękujemy za wiadomość. Sprawdzamy potwierdzony status przesyłki.' }]);
  let calls = 0;
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => { calls += 1; return new Response(JSON.stringify(replyPayload), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.prepared[0].type, 'communication');
  const status = await service.status();
  assert.equal(status.decisions.length, 1);
  assert.equal(status.decisions[0].kind, 'customer_reply');
  assert.equal(status.decisions[0].risk, 'high');
  assert.equal(status.history[0].approvalStatus, 'draft');
  assert.equal(repo.values.has('allegro_communications'), true);
  const unchanged = await service.automaticCycle();
  assert.equal(unchanged.lastCycle.communicationMode, 'unchanged_skipped');
  assert.equal(unchanged.lastCycle.communicationChecked, 0);
  assert.equal(calls, 1, 'niezmieniona rozmowa nie może ponownie zużywać modelu przed kontrolą 12-godzinną');
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

test('rozstrzygnięta sprawa nie wraca po zmianie danych technicznych ani po usunięciu jej z krótkiej historii', async () => {
  const resolvedAt = '2026-07-17T11:00:00.000Z';
  const repo = memoryRepository({
    agent_specialists_state: { config: { decisionRetentionDays: 30 }, history: [], decisions: [{
      id: 'd-resolved', kind: 'customer_reply', status: 'resolved', risk: 'high', title: 'Wiadomość obsłużona',
      target: { type: 'communication', communicationType: 'thread', communicationId: 't-1', sourceMessageId: 'm-1' },
      createdAt: resolvedAt, updatedAt: resolvedAt, resolvedAt,
    }] },
    settings: { data: {}, rev: 1 },
    allegro_communications: { threads: [{ id: 't-1', subject: 'Zmieniony temat', needsReply: true, humanReplyNeeded: true, latestNewIncomingKey: 'm-1', messages: [{ id: 'm-1', authorRole: 'BUYER', text: 'Ta sama wiadomość po synchronizacji.' }] }], issues: [] },
  });
  let calls = 0;
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => { calls += 1; return new Response(JSON.stringify(openAiPayload([{ key: 'reply', label: 'Odpowiedź', value: 'Szkic.' }])), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  await service.automaticCycle();
  assert.equal(calls, 0, 'ta sama rozstrzygnięta wiadomość nie może ponownie uruchomić modelu');
  assert.equal((await service.status()).decisions.length, 0);
  const stored = repo.values.get('agent_specialists_state');
  assert.equal(stored.decisionReceipts.length, 1, 'trwały rejestr rozstrzygnięć musi zostać zachowany niezależnie od krótkiej listy decyzji');
  stored.decisions = [];
  repo.values.set('agent_specialists_state', stored);
  await service.automaticCycle();
  assert.equal(calls, 0);
  const communication = repo.values.get('allegro_communications');
  communication.threads[0].latestNewIncomingKey = 'm-2';
  communication.threads[0].messages.push({ id: 'm-2', authorRole: 'BUYER', text: 'To jest nowa wiadomość.' });
  repo.values.set('allegro_communications', communication);
  await service.automaticCycle();
  assert.equal(calls, 1, 'rzeczywiście nowa wiadomość ma utworzyć nową decyzję');
  assert.equal((await service.status()).decisions.length, 1);
});

test('niekompletny wynik redakcji nie tworzy decyzji i wraca do automatycznej kolejki', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 51, nazwa: 'Gra', producent: 'Alexander', opisKrotki: 'Stary opis', opis: '' }] }, rev: 1 } });
  const payload = openAiPayload([{ key: 'short_description', label: 'Opis krótki', value: 'Nowy, uporządkowany opis.', current_value: 'Stary opis', reason: 'Lepsza czytelność', evidence: 'Redakcja istniejącej treści' }]);
  payload.output[0].content[0].text = JSON.stringify({ ...JSON.parse(payload.output[0].content[0].text), confidence: 0.8, complianceStatus: 'needs_review' });
  let calls = 0;
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => { calls += 1; return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.prepared[0].status, 'retry_scheduled');
  assert.equal((await service.status()).decisions.some((item) => item.kind === 'product_content_review'), false);
  const product = repo.products.get('51');
  assert.equal(product.opisKrotki, 'Stary opis');
  assert.equal(product.contentEditorial.status, 'retry_pending');
  await service.automaticCycle();
  assert.equal(calls, 2, 'ponowna próba nie może użyć tego samego wyniku z pamięci');
});

test('ręczne uruchomienie niekompletnej redakcji także wraca do automatycznej kolejki bez decyzji', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 71, nazwa: 'Gra rodzinna', producent: 'Alexander', opisKrotki: 'Stary skrót', opis: '<p>Stary pełny opis produktu, który powinien zostać uporządkowany przez redaktora.</p>' }] }, rev: 1 } });
  const requests = [];
  const payload = openAiPayload([{ key: 'short_description', label: 'Opis krótki', value: 'Nowy skrót', current_value: 'Stary skrót', reason: 'Czytelność', evidence: 'Istniejący opis' }]);
  payload.output[0].content[0].text = JSON.stringify({ ...JSON.parse(payload.output[0].content[0].text), confidence: 0.8, complianceStatus: 'needs_review' });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async (_url, options) => { requests.push(JSON.parse(options.body)); return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const proposal = await service.prepareProductProposal('71', { email: 'admin@example.com' });
  assert.equal(proposal.retryScheduled, true);
  assert.equal(proposal.decision, null);
  assert.equal(repo.products.get('71').opisKrotki, 'Stary skrót');
  assert.equal(repo.products.get('71').contentEditorial.status, 'retry_pending');
  assert.equal(requests.length, 1);
});

test('po okresie nauki Agent sam zapisuje tylko pola o utrwalonej wysokiej akceptacji', async () => {
  const learnedFields = ['title', 'short_description', 'long_description', 'seo_title', 'seo_description', 'seo_keywords'];
  const fieldStats = Object.fromEntries(learnedFields.map((key) => [key, { approved: 3, rejected: 0 }]));
  const repo = memoryRepository({
    agent_specialists_state: { config: { learningEnabled: true, approvalWarmupCount: 3, learnedAutoApplyThreshold: 0.86, safeAutoApply: true }, history: [], decisions: [], learning: { product_content: { approvals: 3, dismissals: 0, corrections: 0, fieldStats, examples: [] } } },
    settings: { data: { artway_produkty_dodane: [{ id: 81, nazwa: 'GRA TESTOWA', producent: 'Alexander', opisKrotki: 'Skrót', opis: 'Krótki opis źródłowy.', gtin: '5906018000092' }] }, rev: 1 },
  });
  const fields = [
    { key: 'title', label: 'Nazwa', value: 'Gra testowa Alexander' }, { key: 'short_description', label: 'Opis krótki', value: 'Uporządkowany skrót produktu.' },
    { key: 'long_description', label: 'Opis pełny', value: '<h2>Gra testowa</h2><p>Uporządkowany, dłuższy opis produktu oparty wyłącznie na przekazanych danych źródłowych i przeznaczony do czytelnej prezentacji.</p><ul><li>Potwierdzony producent</li></ul>' },
    { key: 'seo_title', label: 'SEO title', value: 'Gra testowa – Alexander' }, { key: 'seo_description', label: 'SEO description', value: 'Poznaj grę testową producenta Alexander i sprawdź uporządkowane informacje o produkcie.' },
    { key: 'seo_keywords', label: 'Frazy', value: 'gra testowa, Alexander' },
  ];
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => new Response(JSON.stringify(openAiPayload(fields)), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.applied.length, 1);
  assert.equal(cycle.prepared[0].status, 'auto_applied');
  assert.equal(repo.products.get('81').nazwa, 'Gra testowa Alexander');
  assert.equal((await service.status()).learning.productContent.ready, true);
});

test('nieudane zatwierdzenie pozostaje otwarte z dokładnym kodem błędu i można je ponowić', async () => {
  const repo = memoryRepository({ agent_specialists_state: { config: {}, history: [], decisions: [{ id: 'd-fail', fingerprint: 'fp-fail', kind: 'product_content_review', specialist: 'product_content', status: 'open', runId: 'missing-run', target: { type: 'product', productId: '404' }, createdAt: '2026-07-17T10:00:00.000Z', updatedAt: '2026-07-17T10:00:00.000Z' }] } });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => new Response('{}', { status: 500 }) });
  await assert.rejects(() => service.updateDecision('d-fail', 'approve', { fieldKeys: ['short_description'] }, { email: 'admin@example.com' }), (error) => error.code === 'agent_specialist_draft_not_found');
  const failed = (await service.status()).decisions.find((item) => item.id === 'd-fail');
  assert.equal(failed.status, 'open');
  assert.equal(failed.executionStatus, 'failed');
  assert.equal(failed.lastErrorCode, 'agent_specialist_draft_not_found');
  assert.match(failed.lastError, /Nie znaleziono szkicu/i);
});

test('otwarta decyzja zawsze zwraca swój pełny szkic nawet gdy wypadł poza krótki limit historii', async () => {
  const oldDraft = { id: 'draft-required', specialist: 'customer_reply', status: 'completed', source: 'automatic', createdAt: '2026-07-01T10:00:00.000Z', target: { type: 'communication', communicationId: 'thread-7' }, result: { title: 'Szkic odpowiedzi', content: 'Dzień dobry, sprawdziliśmy zamówienie.', fields: [{ key: 'reply_body', label: 'Odpowiedź', currentValue: '', value: 'Dzień dobry, sprawdziliśmy zamówienie.' }] } };
  const recent = Array.from({ length: 12 }, (_, index) => ({ id: `recent-${index}`, specialist: 'catalog_quality', status: 'completed', createdAt: `2026-07-2${index % 2}T10:00:00.000Z`, result: { fields: [] } }));
  const repo = memoryRepository({ agent_specialists_state: { config: {}, history: [...recent, oldDraft], decisions: [{ id: 'decision-with-draft', kind: 'customer_reply', status: 'open', runId: oldDraft.id, target: oldDraft.target, createdAt: oldDraft.createdAt, updatedAt: oldDraft.createdAt }] } });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-22T12:00:00.000Z'), fetchImpl: async () => new Response('{}', { status: 500 }) });
  const status = await service.status({ historyLimit: 5 });
  assert.equal(status.history.some((item) => item.id === oldDraft.id), true);
  assert.equal(status.history.find((item) => item.id === oldDraft.id).result.content, 'Dzień dobry, sprawdziliśmy zamówienie.');
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
