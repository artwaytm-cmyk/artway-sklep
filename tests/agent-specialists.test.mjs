import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticEditorialAssessment, createAgentSpecialists, normalizeProductContentEditorialResult, productEditorialFingerprint, productEditorialQuality, productEditorialState, productFacts, productPatch, PROMPT_VERSION, SPECIALISTS, sanitizeContext } from '../netlify/functions/lib/domain/agent-specialists.mjs';
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
  assert.equal('model' in requestBody, false);
  assert.equal(run.platformAgent.id, SPECIALISTS.customer_reply.platformPrompt.id);
  assert.equal(run.platformAgent.version, SPECIALISTS.customer_reply.platformPrompt.version);
  assert.equal(run.platformAgent.available, true);
  assert.equal(run.platformAgent.fallback, false);
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

test('automatyczny cykl sam zapisuje kompletną bezpieczną redakcję bez okresu oczekiwania na zatwierdzenia', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 99, nazwa: 'NOWA GRA | SKLEP', producent: 'Alexander', kategoria: 'Gry rodzinne', gtin: '5906018000092', opis: 'Słaby opis.', opisKrotki: 'Stary skrót.', allegroCategoryId: '123' }] }, rev: 1 } });
  let calls = 0;
  const longDescription = '<h2>Rodzinna rozgrywka</h2><p>Ta gra pozwala wspólnie spędzić czas, ćwiczyć spostrzegawczość i poznawać zasady opisane w dołączonej instrukcji.</p><ul><li>Czytelne zasady</li><li>Wspólna zabawa</li></ul>';
  const fields = [
    { key: 'title', label: 'Nazwa', value: 'Nowa gra rodzinna' },
    { key: 'short_description', label: 'Opis krótki', value: 'Rodzinna gra oparta na czytelnych zasadach i wspólnej zabawie.' },
    { key: 'long_description', label: 'Opis pełny', value: longDescription },
    { key: 'seo_title', label: 'SEO title', value: 'Nowa gra rodzinna – Alexander' },
    { key: 'seo_description', label: 'SEO description', value: 'Poznaj rodzinną grę Alexander z czytelnymi zasadami i wspólną rozgrywką.' },
    { key: 'seo_keywords', label: 'Frazy SEO', value: 'gra rodzinna, Alexander' },
  ];
  const editorialPayload = openAiPayload(fields), rawEditorial = JSON.parse(editorialPayload.output[0].content[0].text);
  editorialPayload.output[0].content[0].text = JSON.stringify({ ...rawEditorial, confidence: 0.38, readyForApproval: false, complianceStatus: 'needs_review', missingFacts: ['wiek', 'liczba graczy', 'zdjęcia', 'stan i dostępność'], warnings: ['Brak opcjonalnych danych: wiek, liczba graczy i zdjęcia.'] });
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => { calls += 1; return new Response(JSON.stringify(editorialPayload), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.prepared.length, 1);
  assert.equal(cycle.prepared[0].status, 'auto_applied');
  assert.equal(cycle.applied.length, 1);
  assert.equal((await service.status()).decisions.some((item) => item.kind === 'product_content_review'), false);
  const product = repo.values.get('settings').data.artway_produkty_dodane[0];
  assert.equal(product.nazwa, 'Nowa gra rodzinna');
  assert.equal(product.opis, longDescription);
  assert.equal(product.allegroDescription, longDescription);
  assert.equal(product.contentEditorial.status, 'ready');
  assert.equal(product.contentEditorial.channels, 'shared_store_and_allegro');
  assert.equal(product.contentEditorial.targets.allegro, true);
  assert.equal(product.allegroEditorialSyncPending, true);
  assert.equal(product.allegroEditorialSyncState, 'queued');
  assert.ok(Array.isArray(product.allegroDescriptionSections));
  const second = await service.automaticCycle();
  assert.equal(second.reason, 'no_candidates');
  assert.equal(calls, 1);
  const status = await service.status();
  assert.equal(status.history[0].approvalStatus, 'auto_applied');
  assert.equal(status.history[0].source, 'automatic');
  assert.equal(status.policy.cycleMinutes, 15);
  assert.equal(status.policy.editorialAutonomy, true);
  assert.equal(status.policy.linkedAllegroContentAutonomy, true);
  assert.equal(status.learning.productContent.approvals, 0);
  assert.equal(status.learning.productContent.ready, false);
  assert.equal(status.learning.productContent.remainingApprovals, 3);
  assert.equal(status.lastCycle.editorialProgress.ready, 1);
  assert.equal(status.lastCycle.editorialProgress.pending, 0);
  assert.match(status.policy.neverAutomatic.join(' '), /Wiadomość do klienta/i);
});

test('stare oznaczenie ready nie ukrywa surowego opisu dostawcy i Agent nadpisuje oba pola opisów', async () => {
  const legacy = {
    id: 100, nazwa: 'Loteryjka obrazkowa', producent: 'Alexander', kategoria: 'Gry edukacyjne', gtin: '5906018000108',
    opisKrotki: 'Dodaj do porównania. Produkt dostępny.',
    opis: '<p>Dodaj do listy zakupowej. Rozmiar uniwersalny 810 szt. Produkt dostępny. Wysyłka w czwartek. Sprawdź czasy i koszty wysyłki. Skontaktuj się z nami.</p><p>Gra obrazkowa przeznaczona do wspólnej zabawy.</p>',
    seoTitle: 'Loteryjka obrazkowa – Alexander', seoDescription: 'Gra obrazkowa Alexander dla dzieci.',
  };
  const fingerprint = productEditorialFingerprint(legacy);
  legacy.contentEditorial = { status: 'ready', promptVersion: PROMPT_VERSION, inputFingerprint: fingerprint, channels: 'store_only' };
  assert.equal(productEditorialQuality(legacy).ready, false);
  assert.deepEqual(productEditorialQuality(legacy).issues.sort(), ['comparison_control', 'shopping_list_control', 'source_availability', 'source_contact', 'source_size_stock', 'source_shipping_control', 'source_stock'].sort());
  assert.equal(productEditorialState(legacy).current, false);

  const longDescription = '<h2>Wspólna zabawa z obrazkami</h2><p>Loteryjka obrazkowa pomaga ćwiczyć spostrzegawczość i kojarzenie elementów podczas rodzinnej rozgrywki.</p><ul><li>Czytelne ilustracje</li><li>Proste zasady zabawy</li></ul>';
  const fields = [
    { key: 'title', label: 'Nazwa', value: 'Loteryjka obrazkowa' },
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
  const stored = repo.values.get('settings').data;
  const saved = { ...stored.artway_produkty_dodane[0], ...stored.artway_produkty_edytowane['100'] };
  assert.equal(saved.opisKrotki, 'Obrazkowa gra rozwijająca spostrzegawczość i umiejętność kojarzenia.');
  assert.equal(saved.opis, longDescription);
  assert.equal(stored.artway_produkty_edytowane['100'].opis, longDescription, 'zapis musi trafić do nadrzędnej warstwy edycji');
  assert.equal(saved.agentTextMode, 'autonomous-editorial');
  assert.ok(saved.agentTextRunId);
  assert.ok(saved.agentTextReviewedAt);
  assert.equal(productEditorialQuality(saved).ready, true);
  assert.equal(productEditorialState(saved).current, true);
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
  const product = repo.values.get('settings').data.artway_produkty_dodane[0];
  assert.equal(product.opisKrotki, 'Skrót');
  assert.equal(product.contentEditorial.status, 'retry_pending');
});

test('kontrola Allegro zatrzymuje niedozwolony opis i planuje automatyczną ponowną próbę bez klikania', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 101, nazwa: 'Gra testowa', producent: 'Alexander', opisKrotki: 'Skrót', opis: 'Opis', gtin: '5906018000092', allegroOfferId: 'offer-101' }] }, rev: 1 } });
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
  const product = repo.values.get('settings').data.artway_produkty_dodane[0];
  assert.equal(product.opis, 'Opis');
  assert.equal(product.contentEditorial.status, 'retry_pending');
  assert.match(product.contentEditorial.warnings.join(' '), /allegro_compliance/i);
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

test('niekompletny wynik redakcji nie tworzy decyzji i wraca do automatycznej kolejki', async () => {
  const repo = memoryRepository({ settings: { data: { artway_produkty_dodane: [{ id: 51, nazwa: 'Gra', producent: 'Alexander', opisKrotki: 'Stary opis', opis: '' }] }, rev: 1 } });
  const payload = openAiPayload([{ key: 'short_description', label: 'Opis krótki', value: 'Nowy, uporządkowany opis.', current_value: 'Stary opis', reason: 'Lepsza czytelność', evidence: 'Redakcja istniejącej treści' }]);
  payload.output[0].content[0].text = JSON.stringify({ ...JSON.parse(payload.output[0].content[0].text), confidence: 0.8, complianceStatus: 'needs_review' });
  let calls = 0;
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => { calls += 1; return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.prepared[0].status, 'retry_scheduled');
  assert.equal((await service.status()).decisions.some((item) => item.kind === 'product_content_review'), false);
  const product = repo.values.get('settings').data.artway_produkty_dodane[0];
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
  assert.equal(repo.values.get('settings').data.artway_produkty_dodane[0].opisKrotki, 'Stary skrót');
  assert.equal(repo.values.get('settings').data.artway_produkty_dodane[0].contentEditorial.status, 'retry_pending');
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
    { key: 'title', label: 'Nazwa', value: 'Gra testowa' }, { key: 'short_description', label: 'Opis krótki', value: 'Uporządkowany skrót produktu.' },
    { key: 'long_description', label: 'Opis pełny', value: '<h2>Gra testowa</h2><p>Uporządkowany, dłuższy opis produktu oparty wyłącznie na przekazanych danych źródłowych i przeznaczony do czytelnej prezentacji.</p><ul><li>Potwierdzony producent</li></ul>' },
    { key: 'seo_title', label: 'SEO title', value: 'Gra testowa – Alexander' }, { key: 'seo_description', label: 'SEO description', value: 'Poznaj grę testową producenta Alexander i sprawdź uporządkowane informacje o produkcie.' },
    { key: 'seo_keywords', label: 'Frazy', value: 'gra testowa, Alexander' },
  ];
  const service = createAgentSpecialists({ ...repo, apiKey: 'test-key', now: () => new Date('2026-07-17T12:00:00.000Z'), fetchImpl: async () => new Response(JSON.stringify(openAiPayload(fields)), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const cycle = await service.automaticCycle();
  assert.equal(cycle.applied.length, 1);
  assert.equal(cycle.prepared[0].status, 'auto_applied');
  assert.equal(repo.values.get('settings').data.artway_produkty_dodane[0].nazwa, 'Gra testowa');
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
