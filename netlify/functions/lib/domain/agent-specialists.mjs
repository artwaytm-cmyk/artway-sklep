import crypto from 'node:crypto';

const STATE_KEY = 'agent_specialists_state';
const MAX_HISTORY = 240;
const MAX_WRITE_ATTEMPTS = 8;
const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  automaticEnabled: true,
  dailyLimit: 60,
  automaticDailyLimit: 10,
  automaticBatchSize: 2,
  cacheHours: 24,
});

const SPECIALISTS = Object.freeze({
  product_content: {
    icon: '✨', label: 'Redaktor produktu', area: 'Katalog i sklep',
    description: 'Tworzy spójny tytuł, krótki i pełny opis oraz pola SEO wyłącznie z przekazanych faktów.',
    fields: ['title', 'short_description', 'long_description', 'seo_title', 'seo_description', 'seo_keywords'],
    rules: 'Zachowaj dokładną nazwę handlową produktu; poprawiaj ją tylko przy oczywistej literówce. Pełny opis formatuj prostym HTML: p, h2, ul, li i strong. Nie dodawaj parametrów, których nie ma w faktach.',
  },
  allegro_offer: {
    icon: '🟠', label: 'Redaktor oferty Allegro', area: 'Allegro',
    description: 'Przygotowuje tytuł i układ opisu zgodny z zasadami Allegro, bez kontaktu i sprzedaży poza platformą.',
    fields: ['allegro_title', 'allegro_description', 'selling_points', 'missing_parameters'],
    rules: 'Nigdy nie dodawaj telefonu, e-maila, adresu strony, prośby o kontakt, negocjowania ceny ani zachęty do zakupu poza Allegro. Opis: wyłącznie p, h2, ul, li i strong, bez linków.',
  },
  customer_reply: {
    icon: '💬', label: 'Opiekun klienta', area: 'Wiadomości i dyskusje',
    description: 'Układa serdeczny szkic odpowiedzi na podstawie całej rozmowy, zamówienia i potwierdzonego statusu przesyłki.',
    fields: ['subject', 'reply'],
    rules: 'Nie obiecuj zwrotu, ponownej wysyłki, terminu ani statusu, którego nie potwierdzają fakty. To zawsze szkic do zatwierdzenia.',
  },
  seo_promotion: {
    icon: '🔎', label: 'Specjalista SEO', area: 'Pozycjonowanie',
    description: 'Przygotowuje naturalne frazy, meta dane i plan bezpłatnej promocji bez upychania słów kluczowych.',
    fields: ['seo_title', 'meta_description', 'keywords', 'slug', 'internal_link_anchor', 'promotion_plan'],
    rules: 'Nie twórz niepotwierdzonych przewag, bestsellerów ani obietnic. Używaj marki Allegro wyłącznie opisowo i zgodnie z kontekstem.',
  },
  campaign_copy: {
    icon: '📣', label: 'Strateg promocji', area: 'Promocje i kody rabatowe',
    description: 'Buduje gotowy zestaw tekstów kampanii i bezpłatny plan promocji dla wskazanych produktów.',
    fields: ['campaign_name', 'headline', 'subheadline', 'cta', 'store_announcement', 'social_post', 'promotion_plan'],
    rules: 'Kod, rabat, daty i warunki muszą pochodzić z faktów. Jeśli ich brak, wskaż je jako brak zamiast wymyślać.',
  },
  banner_copy: {
    icon: '🎨', label: 'Dyrektor bannera', area: 'Grafiki AI',
    description: 'Z krótkiej intencji tworzy precyzyjny brief grafiki oraz tekst nakładany przez stronę.',
    fields: ['headline', 'subheadline', 'cta', 'image_brief', 'mobile_crop_guidance', 'alt_text'],
    rules: 'Brief nie może prosić modelu obrazu o generowanie liter. Teksty są nakładane osobno przez sklep. Nie kopiuj chronionych postaci ani marek.',
  },
  supplier_message: {
    icon: '🏭', label: 'Koordynator producenta', area: 'Plan zatowarowania',
    description: 'Redaguje krótki e-mail do producenta wokół kanonicznej tabeli zamówienia.',
    fields: ['subject', 'intro', 'closing', 'import_instruction'],
    rules: 'Nie dodawaj cen, marż ani stanów. Nie zmieniaj kodów, nazw i ilości z tabeli. Treść ma być krótka i serdeczna.',
  },
  catalog_quality: {
    icon: '🛡️', label: 'Kontroler jakości', area: 'Audyt treści',
    description: 'Wykrywa sprzeczności, duplikaty tekstu, braki i ryzykowne sformułowania, nie zapisując zmian samodzielnie.',
    fields: ['assessment', 'recommended_changes', 'compliance_notes'],
    rules: 'Oddziel błędy pewne od podejrzeń. Nie oznaczaj duplikatu bez jednoznacznych identyfikatorów lub bardzo mocnych dowodów.',
  },
});

const RESULT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Krótka nazwa przygotowanego szkicu.' },
    summary: { type: 'string', description: 'Jednozdaniowe podsumowanie wykonanej pracy.' },
    content: { type: 'string', description: 'Główna treść szkicu albo najważniejszy rezultat.' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['key', 'label', 'value'],
        additionalProperties: false,
      },
    },
    suggestions: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
    missingFacts: { type: 'array', items: { type: 'string' } },
    factsUsed: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    readyForApproval: { type: 'boolean' },
    complianceStatus: { type: 'string', enum: ['ready', 'needs_review', 'blocked_missing_facts'] },
  },
  required: ['title', 'summary', 'content', 'fields', 'suggestions', 'warnings', 'missingFacts', 'factsUsed', 'confidence', 'readyForApproval', 'complianceStatus'],
  additionalProperties: false,
});

function clean(value = '', limit = 1000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, limit);
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function config(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    enabled: source.enabled !== false,
    automaticEnabled: source.automaticEnabled !== false,
    dailyLimit: number(source.dailyLimit, DEFAULT_CONFIG.dailyLimit, 1, 200),
    automaticDailyLimit: number(source.automaticDailyLimit, DEFAULT_CONFIG.automaticDailyLimit, 0, 100),
    automaticBatchSize: number(source.automaticBatchSize, DEFAULT_CONFIG.automaticBatchSize, 1, 5),
    cacheHours: number(source.cacheHours, DEFAULT_CONFIG.cacheHours, 1, 168),
  };
}

function safeError(value = '') {
  return clean(value, 500)
    .replace(/\b(?:sk|sk-proj|sk-ant)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{10,}=*/gi, 'Bearer [ukryty]');
}

function sanitizeText(value = '', limit = 12000) {
  return clean(value, limit)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[e-mail ukryty]')
    .replace(/(?<!\d)(?:\+?48[\s-]?)?(?:\d[\s-]?){9}(?!\d)/g, '[telefon ukryty]')
    .replace(/\b(?:sk|sk-proj|sk-ant)-[A-Za-z0-9_-]{10,}\b/gi, '[sekret ukryty]');
}

function sanitizeContext(value, depth = 0) {
  if (depth > 5) return '[pominięto zbyt głębokie dane]';
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return sanitizeText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitizeContext(item, depth + 1));
  if (typeof value !== 'object') return sanitizeText(value);
  const blocked = /^(?:password|haslo|token|secret|apiKey|authorization|cookie|session|email|phone|telefon|pesel|nip|address|adres)$/i;
  return Object.fromEntries(Object.entries(value).slice(0, 120).filter(([key]) => !blocked.test(key)).map(([key, item]) => [clean(key, 80), sanitizeContext(item, depth + 1)]));
}

function state(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    config: config(source.config),
    history: (Array.isArray(source.history) ? source.history : []).slice(0, MAX_HISTORY),
    updatedAt: clean(source.updatedAt, 40),
  };
}

function outputText(payload = {}) {
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === 'refusal') throw Object.assign(new Error(clean(part.refusal, 500) || 'Model odmówił przygotowania treści.'), { code: 'openai_refusal', status: 422 });
      if (part?.type === 'output_text' && clean(part.text, 100000)) return String(part.text);
    }
  }
  if (clean(payload.output_text, 100000)) return String(payload.output_text);
  throw Object.assign(new Error('GPT-5 nano nie zwrócił treści szkicu.'), { code: 'openai_empty_output', status: 502 });
}

function normalizeResult(raw = {}, specialist) {
  const allowed = new Set(SPECIALISTS[specialist]?.fields || []), seen = new Set();
  const fields = (Array.isArray(raw.fields) ? raw.fields : []).map((field) => ({
    key: clean(field?.key, 80).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    label: clean(field?.label, 120),
    value: clean(field?.value, 30000),
  })).filter((field) => field.key && field.value && allowed.has(field.key) && !seen.has(field.key) && seen.add(field.key));
  const list = (value, limit = 20) => (Array.isArray(value) ? value : []).map((item) => clean(item, 500)).filter(Boolean).slice(0, limit);
  const missingFacts = list(raw.missingFacts);
  return {
    title: clean(raw.title, 180), summary: clean(raw.summary, 500), content: clean(raw.content, 30000), fields,
    suggestions: list(raw.suggestions), warnings: list(raw.warnings), missingFacts, factsUsed: list(raw.factsUsed),
    confidence: number(raw.confidence, 0, 0, 1),
    readyForApproval: raw.readyForApproval === true && missingFacts.length === 0,
    complianceStatus: ['ready', 'needs_review', 'blocked_missing_facts'].includes(raw.complianceStatus) ? raw.complianceStatus : (missingFacts.length ? 'blocked_missing_facts' : 'needs_review'),
  };
}

function fingerprint(specialist, instruction, context) {
  return crypto.createHash('sha256').update(JSON.stringify({ specialist, instruction, context })).digest('hex');
}

function day(value = new Date()) { return value.toISOString().slice(0, 10); }

function responseError(response, payload) {
  const error = new Error(safeError(payload?.error?.message || payload?.message || `OpenAI HTTP ${response.status}`));
  error.code = clean(payload?.error?.code || payload?.error?.type || 'openai_response_error', 100);
  error.status = response.status >= 400 && response.status < 500 ? 422 : 502;
  return error;
}

function productFacts(product = {}) {
  return sanitizeContext({
    id: product.id, name: product.nazwa || product.name, category: product.kategoria, producer: product.producent || product.marka,
    ean: product.gtin || product.ean, producerCode: product.kodProducenta || product.mpn, price: product.cena,
    shortDescription: product.opisKrotki || product.krotkiOpis, fullDescription: product.opis,
    parameters: product.parametry || product.parameters, age: product.wiek, players: product.gracze,
    sourceUrl: product.sourceUrl || product.producentUrl, seoTitle: product.seoTitle, seoDescription: product.seoDescription,
  });
}

function productPatch(result = {}) {
  const fields = Object.fromEntries((result.fields || []).map((field) => [field.key, field.value]));
  const patch = {};
  if (fields.title) patch.nazwa = fields.title;
  if (fields.short_description) patch.opisKrotki = fields.short_description;
  if (fields.long_description) patch.opis = fields.long_description;
  if (fields.seo_title) patch.seoTitle = fields.seo_title;
  if (fields.seo_description) patch.seoDescription = fields.seo_description;
  if (fields.seo_keywords) patch.seoKeywords = fields.seo_keywords;
  if (fields.allegro_title) patch.allegroTitle = fields.allegro_title;
  if (fields.allegro_description) patch.allegroDescription = fields.allegro_description;
  return patch;
}

export function createAgentSpecialists({ readVersioned, writeIfVersion, fetchImpl = globalThis.fetch, apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_TEXT_MODEL || process.env.OPENAI_MODEL || 'gpt-5-nano', now = () => new Date() } = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') throw new Error('Specjaliści GPT wymagają wersjonowanego repozytorium.');
  if (typeof fetchImpl !== 'function') throw new Error('Specjaliści GPT wymagają klienta HTTP.');

  async function change(key, fallback, mutator) {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
      const version = await readVersioned(key, fallback), next = await mutator(version.value, version);
      const write = await writeIfVersion(key, next, version);
      if (write?.modified) return next;
    }
    throw Object.assign(new Error('Dane Agenta zmieniły się równocześnie. Spróbuj ponownie.'), { code: 'agent_specialist_write_conflict', status: 409 });
  }

  async function readState() {
    const version = await readVersioned(STATE_KEY, { config: DEFAULT_CONFIG, history: [], updatedAt: '' });
    return state(version.value);
  }

  async function appendHistory(entry) {
    return change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], updatedAt: '' }, (value) => {
      const previous = state(value), timestamp = now().toISOString();
      return { ...previous, history: [entry, ...previous.history.filter((item) => item?.id !== entry.id)].slice(0, MAX_HISTORY), updatedAt: timestamp };
    });
  }

  async function updateHistory(id, patch) {
    return change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], updatedAt: '' }, (value) => {
      const previous = state(value), timestamp = now().toISOString();
      return { ...previous, history: previous.history.map((item) => item?.id === id ? { ...item, ...patch } : item), updatedAt: timestamp };
    });
  }

  async function status() {
    const current = await readState(), today = day(now()), todayRuns = current.history.filter((item) => String(item?.createdAt || '').startsWith(today));
    return {
      configured: !!clean(apiKey, 500), model: clean(model, 80), config: current.config,
      specialists: Object.entries(SPECIALISTS).map(([id, value]) => ({ id, ...value })),
      usage: {
        today: todayRuns.length,
        automaticToday: todayRuns.filter((item) => item.source === 'automatic').length,
        inputTokens: todayRuns.reduce((sum, item) => sum + Number(item?.usage?.inputTokens || 0), 0),
        outputTokens: todayRuns.reduce((sum, item) => sum + Number(item?.usage?.outputTokens || 0), 0),
      },
      history: current.history.slice(0, 80), updatedAt: current.updatedAt,
    };
  }

  async function configure(raw = {}) {
    const nextConfig = config(raw);
    const next = await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], updatedAt: '' }, (value) => ({ ...state(value), config: nextConfig, updatedAt: now().toISOString() }));
    return next.config;
  }

  async function run(raw = {}, actor = {}) {
    const specialist = clean(raw.specialist, 80), definition = SPECIALISTS[specialist];
    if (!definition) throw Object.assign(new Error('Wybierz dostępnego specjalistę GPT-5 nano.'), { code: 'agent_specialist_invalid', status: 422 });
    if (!clean(apiKey, 500)) throw Object.assign(new Error('Brakuje konfiguracji OpenAI dla GPT-5 nano.'), { code: 'openai_not_configured', status: 503 });
    const current = await readState(), source = raw.source === 'automatic' ? 'automatic' : 'manual';
    if (!current.config.enabled || (source === 'automatic' && !current.config.automaticEnabled)) throw Object.assign(new Error('Ten tryb specjalistów GPT jest wyłączony w ustawieniach.'), { code: 'agent_specialists_disabled', status: 409 });
    const today = day(now()), todayRuns = current.history.filter((item) => String(item?.createdAt || '').startsWith(today));
    if (todayRuns.length >= current.config.dailyLimit || (source === 'automatic' && todayRuns.filter((item) => item.source === 'automatic').length >= current.config.automaticDailyLimit)) {
      throw Object.assign(new Error('Osiągnięto dzienny limit kontrolujący koszt GPT-5 nano.'), { code: 'agent_specialist_daily_limit', status: 429 });
    }
    const instruction = sanitizeText(raw.instruction || `Przygotuj profesjonalny szkic jako ${definition.label}.`, 3000), context = sanitizeContext(raw.context || {}), hash = fingerprint(specialist, instruction, context);
    const cacheMs = current.config.cacheHours * 60 * 60_000, cached = current.history.find((item) => item.fingerprint === hash && item.status === 'completed' && now().getTime() - Date.parse(item.createdAt || '') <= cacheMs);
    if (cached) return { ...cached, cached: true };
    const runId = `gpt_${Date.now()}_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`, createdAt = now().toISOString(), target = sanitizeContext(raw.target || {});
    const instructions = [
      'Jesteś wyspecjalizowanym pracownikiem polskiego sklepu Artway-TM. Odpowiadasz po polsku.',
      'Korzystaj wyłącznie z przekazanych faktów. Nie zgaduj parametrów, cen, statusów, terminów, dostępności, rabatów ani warunków.',
      'Brakujące dane wpisz do missingFacts. Każdą treść traktuj jako szkic; nie twierdź, że została wysłana lub opublikowana.',
      `Rola: ${definition.label}. ${definition.description}`,
      `Szczególne reguły: ${definition.rules}`,
      `Zwróć pola tylko z tej listy: ${definition.fields.join(', ')}. Nie dodawaj innych kluczy fields.`,
      'Treść ma być konkretna, naturalna, uporządkowana i gotowa do sprawdzenia przez administratora.',
    ].join('\n');
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model, store: false, reasoning: { effort: 'minimal' }, max_output_tokens: 3600,
        instructions,
        input: JSON.stringify({ zadanie: instruction, fakty: context }),
        text: { format: { type: 'json_schema', name: 'artway_specialist_result', strict: true, schema: RESULT_SCHEMA } },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw responseError(response, payload);
    let parsed;
    try { parsed = JSON.parse(outputText(payload)); }
    catch (error) {
      if (error?.code) throw error;
      throw Object.assign(new Error('GPT-5 nano zwrócił nieprawidłowy wynik strukturalny.'), { code: 'openai_invalid_json', status: 502 });
    }
    const result = normalizeResult(parsed, specialist), usage = { inputTokens: number(payload?.usage?.input_tokens, 0, 0, 10_000_000), outputTokens: number(payload?.usage?.output_tokens, 0, 0, 10_000_000), totalTokens: number(payload?.usage?.total_tokens, 0, 0, 20_000_000) };
    const entry = {
      id: runId, specialist, specialistLabel: definition.label, status: 'completed', source, createdAt, model: clean(payload.model || model, 80),
      instruction: clean(instruction, 500), target, fingerprint: hash, result, usage, approvalStatus: 'draft',
      actor: clean(actor?.email || actor?.name || actor?.source || 'administrator', 120),
    };
    await appendHistory(entry);
    return entry;
  }

  async function applyProductDraft(id = '', actor = {}) {
    const current = await readState(), run = current.history.find((item) => item?.id === clean(id, 100));
    if (!run || run.status !== 'completed' || run.target?.type !== 'product' || !clean(run.target?.productId, 100)) throw Object.assign(new Error('Nie znaleziono szkicu produktu do zatwierdzenia.'), { code: 'agent_specialist_draft_not_found', status: 404 });
    if (run.approvalStatus === 'applied') return { applied: false, duplicate: true, run };
    const patch = productPatch(run.result), productId = String(run.target.productId);
    if (!Object.keys(patch).length) throw Object.assign(new Error('Szkic nie zawiera bezpiecznych pól produktu do zapisania.'), { code: 'agent_specialist_patch_empty', status: 422 });
    await change('settings', { data: {}, rev: 0, updated_at: null }, (record) => {
      const previous = record && typeof record === 'object' ? record : { data: {}, rev: 0 }, data = { ...(previous.data || {}) }, added = Array.isArray(data.artway_produkty_dodane) ? [...data.artway_produkty_dodane] : [], index = added.findIndex((product) => String(product?.id) === productId), timestamp = now().toISOString();
      const safePatch = { ...patch, agentTextModel: run.model, agentTextReviewedAt: timestamp, agentTextRunId: run.id };
      if (index >= 0) { added[index] = { ...added[index], ...safePatch }; data.artway_produkty_dodane = added; }
      else { const edited = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {}; edited[productId] = { ...(edited[productId] || {}), ...safePatch }; data.artway_produkty_edytowane = edited; }
      return { ...previous, data, rev: Number(previous.rev || 0) + 1, updated_at: timestamp };
    });
    const appliedAt = now().toISOString(), appliedBy = clean(actor?.email || actor?.name || 'administrator', 120);
    await updateHistory(run.id, { approvalStatus: 'applied', appliedAt, appliedBy });
    return { applied: true, productId, patch, appliedAt, appliedBy };
  }

  async function automaticCycle() {
    const current = await readState();
    if (!current.config.enabled || !current.config.automaticEnabled || current.config.automaticDailyLimit < 1) return { skipped: true, reason: 'disabled', prepared: [] };
    const settingsVersion = await readVersioned('settings', { data: {}, rev: 0 }), data = settingsVersion.value?.data || {}, edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? data.artway_produkty_edytowane : {};
    const catalog = [...(Array.isArray(data.artway_produkty_katalog) ? data.artway_produkty_katalog : []), ...(Array.isArray(data.artway_produkty_dodane) ? data.artway_produkty_dodane : [])], hidden = new Set([...(data.artway_produkty_definitywne || []), ...(data.artway_produkty_ukryte || [])].map(String)), unique = new Map();
    for (const product of catalog) if (product?.id !== undefined && !hidden.has(String(product.id))) unique.set(String(product.id), { ...product, ...(edits[String(product.id)] || {}) });
    const recentCutoff = now().getTime() - 7 * 24 * 60 * 60_000, recentTargets = new Set(current.history.filter((item) => item.source === 'automatic' && item.status === 'completed' && Date.parse(item.createdAt || '') >= recentCutoff).map((item) => String(item.target?.productId || '')).filter(Boolean));
    const candidates = [...unique.values()].map((product) => {
      const short = clean(product.opisKrotki || product.krotkiOpis, 5000), full = clean(product.opis, 30000), missing = (!short ? 3 : 0) + (full.length < 250 ? 4 : 0) + (!product.seoTitle ? 2 : 0) + (!product.seoDescription ? 2 : 0);
      return { product, missing };
    }).filter((item) => item.missing > 0 && !recentTargets.has(String(item.product.id))).sort((a, b) => b.missing - a.missing || String(b.product.createdAt || '').localeCompare(String(a.product.createdAt || ''))).slice(0, current.config.automaticBatchSize);
    const prepared = [];
    for (const item of candidates) {
      try {
        const draft = await run({ specialist: 'product_content', source: 'automatic', instruction: 'Przygotuj kompletny, profesjonalny szkic treści produktu do kontroli administratora. Zachowaj wszystkie potwierdzone fakty i zgłoś braki.', context: { product: productFacts(item.product) }, target: { type: 'product', productId: String(item.product.id), name: clean(item.product.nazwa, 180) } }, { source: 'background-agent' });
        prepared.push({ id: draft.id, productId: String(item.product.id), name: clean(item.product.nazwa, 180), status: 'prepared' });
      } catch (error) {
        if (error?.code === 'agent_specialist_daily_limit') break;
        prepared.push({ productId: String(item.product.id), name: clean(item.product.nazwa, 180), status: 'error', error: safeError(error?.message || error) });
      }
    }
    return { skipped: candidates.length === 0, reason: candidates.length ? '' : 'no_candidates', prepared };
  }

  return Object.freeze({ status, configure, run, applyProductDraft, automaticCycle, specialists: SPECIALISTS });
}

export { DEFAULT_CONFIG, RESULT_SCHEMA, SPECIALISTS, normalizeResult, productFacts, productPatch, sanitizeContext };
