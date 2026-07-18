import crypto from 'node:crypto';

const STATE_KEY = 'agent_specialists_state';
const MAX_HISTORY = 240;
const MAX_DECISIONS = 240;
const MAX_WRITE_ATTEMPTS = 8;
const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  automaticEnabled: true,
  dailyLimit: 60,
  automaticDailyLimit: 30,
  automaticBatchSize: 4,
  cacheHours: 24,
  safeAutoApply: true,
  confidenceThreshold: 0.92,
  decisionRetentionDays: 30,
});

const PROMPT_VERSION = '2026-07-18.2';
const NEVER_AUTOMATIC = Object.freeze(['wysyłanie wiadomości', 'publikacja Allegro', 'zmiana ceny', 'zmiana stanu', 'usuwanie', 'zamówienie u producenta']);

const SPECIALISTS = Object.freeze({
  product_content: {
    assistantId: 'asst_bi27lcqG4p4pGx5TouNEE94J',
    icon: '✨', label: 'Redaktor produktu', area: 'Katalog i sklep',
    description: 'Tworzy spójny tytuł, krótki i pełny opis oraz pola SEO wyłącznie z przekazanych faktów.',
    fields: ['title', 'short_description', 'long_description', 'seo_title', 'seo_description', 'seo_keywords'],
    rules: 'Nazwę ze źródła traktuj jako fakt o tożsamości, a nie gotowy tytuł. Usuń dopiski sklepu źródłowego, powtórzenia i chaos wielkich liter; ułóż naturalną nazwę sprzedażową, zachowując markę, model i wariant. Pełny opis formatuj prostym HTML: p, h2, ul, li i strong. Nie dodawaj parametrów, których nie ma w faktach.',
  },
  allegro_offer: {
    assistantId: 'asst_16UEvdbo3boUso6xyYeANYnQ',
    icon: '🟠', label: 'Redaktor oferty Allegro', area: 'Allegro',
    description: 'Przygotowuje tytuł i układ opisu zgodny z zasadami Allegro, bez kontaktu i sprzedaży poza platformą.',
    fields: ['allegro_title', 'allegro_description', 'selling_points', 'missing_parameters'],
    rules: 'Nigdy nie dodawaj telefonu, e-maila, adresu strony, prośby o kontakt, negocjowania ceny ani zachęty do zakupu poza Allegro. Opis: wyłącznie p, h2, ul, li i strong, bez linków.',
  },
  customer_reply: {
    assistantId: 'asst_M2ZRdoHVzQ0jIzYZ3TCLwcoI',
    icon: '💬', label: 'Opiekun klienta', area: 'Wiadomości i dyskusje',
    description: 'Układa serdeczny szkic odpowiedzi na podstawie całej rozmowy, zamówienia i potwierdzonego statusu przesyłki.',
    fields: ['subject', 'reply'],
    rules: 'Nie obiecuj zwrotu, ponownej wysyłki, terminu ani statusu, którego nie potwierdzają fakty. To zawsze szkic do zatwierdzenia.',
  },
  seo_promotion: {
    assistantId: 'asst_LM0aFCDpHHXGgWI28ZdLHjJw',
    icon: '🔎', label: 'Specjalista SEO', area: 'Pozycjonowanie',
    description: 'Przygotowuje naturalne frazy, meta dane i plan bezpłatnej promocji bez upychania słów kluczowych.',
    fields: ['seo_title', 'meta_description', 'keywords', 'slug', 'internal_link_anchor', 'promotion_plan'],
    rules: 'Nie twórz niepotwierdzonych przewag, bestsellerów ani obietnic. Używaj marki Allegro wyłącznie opisowo i zgodnie z kontekstem.',
  },
  campaign_copy: {
    assistantId: 'asst_yr8O2brC4yJ9KFmDFpmWQNPB',
    icon: '📣', label: 'Strateg promocji', area: 'Promocje i kody rabatowe',
    description: 'Buduje gotowy zestaw tekstów kampanii i bezpłatny plan promocji dla wskazanych produktów.',
    fields: ['campaign_name', 'headline', 'subheadline', 'cta', 'store_announcement', 'social_post', 'promotion_plan'],
    rules: 'Kod, rabat, daty i warunki muszą pochodzić z faktów. Jeśli ich brak, wskaż je jako brak zamiast wymyślać.',
  },
  banner_copy: {
    assistantId: 'asst_4dPRadSuHeusSVkuzvFe9TKg',
    icon: '🎨', label: 'Dyrektor bannera', area: 'Grafiki AI',
    description: 'Z krótkiej intencji tworzy precyzyjny brief grafiki oraz tekst nakładany przez stronę.',
    fields: ['headline', 'subheadline', 'cta', 'image_brief', 'mobile_crop_guidance', 'alt_text'],
    rules: 'Brief nie może prosić modelu obrazu o generowanie liter. Teksty są nakładane osobno przez sklep. Nie kopiuj chronionych postaci ani marek.',
  },
  supplier_message: {
    assistantId: 'asst_63UuzQm4UNsjileYU7Wue7pd',
    icon: '🏭', label: 'Koordynator producenta', area: 'Plan zatowarowania',
    description: 'Redaguje krótki e-mail do producenta wokół kanonicznej tabeli zamówienia.',
    fields: ['subject', 'intro', 'closing', 'import_instruction'],
    rules: 'Nie dodawaj cen, marż ani stanów. Nie zmieniaj kodów, nazw i ilości z tabeli. Treść ma być krótka i serdeczna.',
  },
  catalog_quality: {
    assistantId: 'asst_0iw94LI9kTcnLpiOUzr8VnPj',
    icon: '🛡️', label: 'Kontroler jakości', area: 'Audyt treści',
    description: 'Wykrywa sprzeczności, duplikaty tekstu, braki i ryzykowne sformułowania, nie zapisując zmian samodzielnie.',
    fields: ['assessment', 'recommended_changes', 'compliance_notes'],
    rules: 'Oddziel błędy pewne od podejrzeń. Nie oznaczaj duplikatu bez jednoznacznych identyfikatorów lub bardzo mocnych dowodów.',
  },
  operations_supervisor: {
    assistantId: 'asst_fgnFEmmPmCSsqEiO9uIgO3Kh',
    icon: '🧭', label: 'Koordynator operacyjny', area: 'Nadzór sklepu',
    description: 'Porządkuje wykryte ryzyka, wskazuje jedną rekomendację i czytelne warianty decyzji administratora.',
    fields: ['priority', 'problem', 'recommended_action', 'alternative_action', 'decision_question'],
    rules: 'Nie wykonuj działań zewnętrznych. Podaj jedno zalecenie, jedno bezpieczne rozwiązanie alternatywne i jasno wskaż, co wymaga zatwierdzenia.',
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
          current_value: { type: 'string', description: 'Bieżąca wartość przekazana w faktach albo pusty tekst.' },
          reason: { type: 'string', description: 'Konkretna przyczyna proponowanej zmiany.' },
          evidence: { type: 'string', description: 'Fakt źródłowy będący podstawą zmiany albo informacja, że jest to redakcja istniejącej treści.' },
        },
        required: ['key', 'label', 'value', 'current_value', 'reason', 'evidence'],
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
    safeAutoApply: source.safeAutoApply !== false,
    confidenceThreshold: number(source.confidenceThreshold, DEFAULT_CONFIG.confidenceThreshold, 0.75, 1),
    decisionRetentionDays: number(source.decisionRetentionDays, DEFAULT_CONFIG.decisionRetentionDays, 7, 90),
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
    decisions: (Array.isArray(source.decisions) ? source.decisions : []).slice(0, MAX_DECISIONS),
    lastCycle: source.lastCycle && typeof source.lastCycle === 'object' ? source.lastCycle : null,
    updatedAt: clean(source.updatedAt, 40),
  };
}

function decisionFingerprint(kind = '', target = {}) {
  return crypto.createHash('sha256').update(JSON.stringify({ kind, target })).digest('hex');
}

function normalizeDecision(raw = {}, timestamp = new Date().toISOString()) {
  const status = ['open', 'approved', 'dismissed', 'snoozed', 'resolved'].includes(raw.status) ? raw.status : 'open';
  const risk = ['low', 'medium', 'high'].includes(raw.risk) ? raw.risk : 'medium';
  const alternatives = (Array.isArray(raw.alternatives) ? raw.alternatives : []).map((item) => clean(item, 240)).filter(Boolean).slice(0, 5);
  return {
    id: clean(raw.id, 120) || `decision_${crypto.randomUUID()}`,
    fingerprint: clean(raw.fingerprint, 100) || decisionFingerprint(raw.kind, raw.target),
    kind: clean(raw.kind, 80), specialist: clean(raw.specialist, 80), icon: clean(raw.icon, 12) || '🧭',
    title: clean(raw.title, 180), summary: clean(raw.summary, 700), recommendation: clean(raw.recommendation, 700), alternatives,
    risk, status, requiresApproval: raw.requiresApproval !== false, target: sanitizeContext(raw.target || {}),
    href: clean(raw.href, 300), runId: clean(raw.runId, 120), createdAt: clean(raw.createdAt, 40) || timestamp,
    updatedAt: clean(raw.updatedAt, 40) || timestamp, snoozedUntil: clean(raw.snoozedUntil, 40),
    resolvedAt: clean(raw.resolvedAt, 40), resolvedBy: clean(raw.resolvedBy, 120), resolutionNote: clean(raw.resolutionNote, 500),
    operationId: clean(raw.operationId, 120), executionStatus: ['idle', 'running', 'completed', 'failed'].includes(raw.executionStatus) ? raw.executionStatus : 'idle',
    attemptCount: number(raw.attemptCount, 0, 0, 100), startedAt: clean(raw.startedAt, 40), completedAt: clean(raw.completedAt, 40),
    lastError: safeError(raw.lastError), lastErrorCode: clean(raw.lastErrorCode, 120), appliedFields: (Array.isArray(raw.appliedFields) ? raw.appliedFields : []).map((item) => clean(item, 80)).filter(Boolean).slice(0, 30),
  };
}

function activeDecision(item = {}, at = new Date()) {
  if (item.status === 'open') return true;
  if (item.status !== 'snoozed') return false;
  const until = Date.parse(item.snoozedUntil || '');
  return !Number.isFinite(until) || until <= at.getTime();
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
    currentValue: clean(field?.current_value ?? field?.currentValue, 30000),
    reason: clean(field?.reason, 700),
    evidence: clean(field?.evidence, 700),
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
    sourceUrl: product.sourceUrl || product.producentUrl, sourceMaterial: product.sourceMaterial,
    seoTitle: product.seoTitle, seoDescription: product.seoDescription,
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

function valuePresent(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return clean(value, 50_000).length > 0;
}

function productFieldValue(product = {}, key = '') {
  const aliases = {
    nazwa: ['nazwa', 'name'], opisKrotki: ['opisKrotki', 'krotkiOpis'], opis: ['opis'], seoTitle: ['seoTitle'], seoDescription: ['seoDescription'], seoKeywords: ['seoKeywords'],
    allegroTitle: ['allegroTitle'], allegroDescription: ['allegroDescription'],
  };
  return (aliases[key] || [key]).map((name) => product?.[name]).find(valuePresent);
}

function missingOnlyPatch(product = {}, patch = {}) {
  return Object.fromEntries(Object.entries(patch).filter(([key, value]) => valuePresent(value) && !valuePresent(productFieldValue(product, key))));
}

function catalogProducts(data = {}) {
  const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? data.artway_produkty_edytowane : {};
  const hidden = new Set([...(data.artway_produkty_definitywne || []), ...(data.artway_produkty_ukryte || [])].map(String));
  const unique = new Map();
  for (const product of [...(Array.isArray(data.artway_produkty_katalog) ? data.artway_produkty_katalog : []), ...(Array.isArray(data.artway_produkty_dodane) ? data.artway_produkty_dodane : [])]) {
    if (product?.id === undefined || hidden.has(String(product.id))) continue;
    unique.set(String(product.id), { ...product, ...(edits[String(product.id)] || {}) });
  }
  return [...unique.values()];
}

function communicationNeedsReply(item = {}) {
  const resolved = item?.internalResolved === true || item?.internalResolution?.resolved === true;
  return !resolved && !item?.cachedOlder && !!(item?.needsReply || item?.humanReplyNeeded || Number(item?.newIncomingCount || 0) > 0);
}

function communicationFacts(item = {}, type = 'thread') {
  const messages = (Array.isArray(item.messages) ? item.messages : [item.lastMessage].filter(Boolean)).slice(-30).map((message) => ({
    author: clean(message?.authorRole || message?.author?.role || message?.authorLogin || message?.author || 'uczestnik', 80),
    text: clean(message?.text || message?.content || '', 4000), createdAt: clean(message?.createdAt || message?.date || '', 40),
  }));
  return sanitizeContext({ type, subject: item.subject || item.topic, orderId: item.orderId || item.checkoutFormId, status: item.status, chatActive: item.chatActive, messages });
}

export function createAgentSpecialists({
  readVersioned, writeIfVersion, fetchImpl = globalThis.fetch, apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_TEXT_MODEL || process.env.OPENAI_MODEL || 'gpt-5-nano', now = () => new Date(),
  platformAgentsEnabled = process.env.OPENAI_PLATFORM_AGENTS !== 'false' && !String(apiKey || '').startsWith('test-'),
} = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') throw new Error('Specjaliści GPT wymagają wersjonowanego repozytorium.');
  if (typeof fetchImpl !== 'function') throw new Error('Specjaliści GPT wymagają klienta HTTP.');
  const platformProfiles = new Map();

  async function platformAgentProfile(specialist, definition) {
    if (!platformAgentsEnabled || !definition?.assistantId || !clean(apiKey, 500)) return null;
    const cached = platformProfiles.get(specialist);
    if (cached && now().getTime() - cached.checkedAt < 6 * 60 * 60_000) return cached;
    try {
      const response = await fetchImpl(`https://api.openai.com/v1/assistants/${encodeURIComponent(definition.assistantId)}`, {
        headers: { authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'assistants=v2' }, signal: AbortSignal.timeout(20_000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw responseError(response, payload);
      const profile = {
        id: clean(payload.id, 120), name: clean(payload.name, 180) || definition.label,
        model: clean(payload.model, 80), instructions: clean(payload.instructions, 12_000),
        checkedAt: now().getTime(), available: true,
      };
      platformProfiles.set(specialist, profile);
      return profile;
    } catch (error) {
      const profile = { id: definition.assistantId, name: definition.label, model: '', instructions: '', checkedAt: now().getTime(), available: false, error: safeError(error?.message || error) };
      platformProfiles.set(specialist, profile);
      return profile;
    }
  }

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

  async function upsertDecision(raw = {}) {
    const timestamp = now().toISOString(), proposed = normalizeDecision(raw, timestamp);
    const next = await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
      const previous = state(value), existing = previous.decisions.find((item) => item?.fingerprint === proposed.fingerprint);
      const keepClosed = existing && ['approved', 'dismissed', 'resolved'].includes(existing.status);
      const decision = keepClosed ? existing : normalizeDecision({ ...existing, ...proposed, id: existing?.id || proposed.id, createdAt: existing?.createdAt || proposed.createdAt, status: existing?.status === 'snoozed' ? 'snoozed' : proposed.status }, timestamp);
      return { ...previous, decisions: [decision, ...previous.decisions.filter((item) => item?.id !== decision.id)].slice(0, MAX_DECISIONS), updatedAt: timestamp };
    });
    return next.decisions.find((item) => item.fingerprint === proposed.fingerprint) || proposed;
  }

  async function updateDecision(id = '', action = '', raw = {}, actor = {}) {
    const safeId = clean(id, 120), safeAction = clean(action, 40), timestamp = now().toISOString(), who = clean(actor?.email || actor?.name || actor?.source || 'administrator', 120);
    const statusByAction = { approve: 'approved', dismiss: 'dismissed', resolve: 'resolved', snooze: 'snoozed', reopen: 'open' };
    if (!statusByAction[safeAction]) throw Object.assign(new Error('Nieobsługiwana decyzja Agenta.'), { code: 'agent_decision_action_invalid', status: 422 });
    const previous = await readState(), decision = previous.decisions.find((item) => item?.id === safeId);
    if (!decision) throw Object.assign(new Error('Nie znaleziono decyzji Agenta.'), { code: 'agent_decision_not_found', status: 404 });
    if (safeAction === 'approve' && decision.status === 'approved' && decision.executionStatus === 'completed') return { ...decision, duplicate: true };
    const operationId = decision.operationId || `approval_${crypto.createHash('sha256').update(`${safeId}|${decision.runId || ''}`).digest('hex').slice(0, 24)}`;
    let executionResult = null;
    if (safeAction === 'approve') {
      await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
        const current = state(value);
        return {
          ...current,
          decisions: current.decisions.map((item) => item?.id === safeId ? normalizeDecision({
            ...item, operationId, executionStatus: 'running', attemptCount: Number(item.attemptCount || 0) + 1,
            startedAt: timestamp, completedAt: '', lastError: '', lastErrorCode: '', updatedAt: timestamp,
          }, timestamp) : item),
          updatedAt: timestamp,
        };
      });
      try {
        if (decision.runId && decision.target?.type === 'product') {
          executionResult = await applyProductDraft(decision.runId, actor, { missingOnly: false, fieldKeys: raw.fieldKeys });
        } else executionResult = { applied: false, directionOnly: true, patch: {} };
      } catch (error) {
        const failedAt = now().toISOString();
        await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
          const current = state(value);
          return {
            ...current,
            decisions: current.decisions.map((item) => item?.id === safeId ? normalizeDecision({
              ...item, status: 'open', operationId, executionStatus: 'failed', completedAt: failedAt,
              lastError: safeError(error?.message || error), lastErrorCode: clean(error?.code || 'agent_approval_failed', 120), updatedAt: failedAt,
            }, failedAt) : item),
            updatedAt: failedAt,
          };
        });
        error.decisionId = safeId;
        error.operationId = operationId;
        throw error;
      }
    }
    const days = number(raw.days, 1, 1, 14), patch = {
      status: statusByAction[safeAction], updatedAt: timestamp, resolvedAt: safeAction === 'snooze' || safeAction === 'reopen' ? '' : timestamp,
      resolvedBy: safeAction === 'snooze' || safeAction === 'reopen' ? '' : who, resolutionNote: clean(raw.note, 500),
      snoozedUntil: safeAction === 'snooze' ? new Date(now().getTime() + days * 24 * 60 * 60_000).toISOString() : '',
      ...(safeAction === 'approve' ? {
        operationId, executionStatus: 'completed', completedAt: now().toISOString(), lastError: '', lastErrorCode: '',
        appliedFields: Object.keys(executionResult?.patch || {}),
      } : safeAction === 'reopen' ? { executionStatus: 'idle', completedAt: '', lastError: '', lastErrorCode: '', appliedFields: [] } : {}),
    };
    const next = await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
      const current = state(value);
      return { ...current, decisions: current.decisions.map((item) => item?.id === safeId ? normalizeDecision({ ...item, ...patch }, timestamp) : item), updatedAt: timestamp };
    });
    return { ...next.decisions.find((item) => item?.id === safeId), executionResult };
  }

  async function status() {
    const current = await readState(), today = day(now()), todayRuns = current.history.filter((item) => String(item?.createdAt || '').startsWith(today));
    const decisions = current.decisions.map((item) => item.status === 'snoozed' && activeDecision(item, now()) ? { ...item, status: 'open', snoozedUntil: '' } : item);
    return {
      configured: !!clean(apiKey, 500), model: clean(model, 80), config: current.config,
      promptVersion: PROMPT_VERSION,
      policy: { mode: 'openai_platform_profiles_plus_responses', cycleMinutes: 15, safeAutoApply: current.config.safeAutoApply, neverAutomatic: NEVER_AUTOMATIC },
      platformAgents: { enabled: platformAgentsEnabled, configured: Object.values(SPECIALISTS).every((item) => !!item.assistantId), executionModel: clean(model, 80), coordinatorId: SPECIALISTS.operations_supervisor.assistantId },
      specialists: Object.entries(SPECIALISTS).map(([id, value]) => ({ id, ...value, promptVersion: PROMPT_VERSION, deployment: 'openai-platform+server', platformAvailable: platformProfiles.get(id)?.available ?? null, platformName: platformProfiles.get(id)?.name || value.label })),
      usage: {
        today: todayRuns.length,
        automaticToday: todayRuns.filter((item) => item.source === 'automatic').length,
        inputTokens: todayRuns.reduce((sum, item) => sum + Number(item?.usage?.inputTokens || 0), 0),
        outputTokens: todayRuns.reduce((sum, item) => sum + Number(item?.usage?.outputTokens || 0), 0),
      },
      decisions: decisions.filter((item) => activeDecision(item, now())).slice(0, 80),
      decisionStats: {
        open: decisions.filter((item) => activeDecision(item, now())).length,
        high: decisions.filter((item) => activeDecision(item, now()) && item.risk === 'high').length,
        completed: decisions.filter((item) => ['approved', 'resolved'].includes(item.status)).length,
      },
      history: current.history.slice(0, 80), lastCycle: current.lastCycle, updatedAt: current.updatedAt,
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
    const platformProfile = await platformAgentProfile(specialist, definition);
    const instructions = [
      platformProfile?.instructions ? `Profil specjalisty zapisany w OpenAI Platform:\n${platformProfile.instructions}` : '',
      'Jesteś wyspecjalizowanym pracownikiem polskiego sklepu Artway-TM. Odpowiadasz po polsku.',
      'Korzystaj wyłącznie z przekazanych faktów. Nie zgaduj parametrów, cen, statusów, terminów, dostępności, rabatów ani warunków.',
      'Brakujące dane wpisz do missingFacts. Każdą treść traktuj jako szkic; nie twierdź, że została wysłana lub opublikowana.',
      `Rola: ${definition.label}. ${definition.description}`,
      `Szczególne reguły: ${definition.rules}`,
      `Zwróć pola tylko z tej listy: ${definition.fields.join(', ')}. Nie dodawaj innych kluczy fields.`,
      'Dla każdego pola podaj bieżącą wartość, proponowaną wartość, konkretną przyczynę oraz fakt będący podstawą. Nie używaj ogólników.',
      'Treść ma być konkretna, naturalna, uporządkowana i gotowa do sprawdzenia przez administratora.',
    ].filter(Boolean).join('\n');
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
      instruction: clean(instruction, 500), target, fingerprint: hash, result, usage, approvalStatus: 'draft', promptVersion: PROMPT_VERSION,
      platformAgent: platformProfile ? { id: platformProfile.id, name: platformProfile.name, available: platformProfile.available } : null,
      actor: clean(actor?.email || actor?.name || actor?.source || 'administrator', 120),
    };
    await appendHistory(entry);
    return entry;
  }

  async function applyProductDraft(id = '', actor = {}, options = {}) {
    const current = await readState(), run = current.history.find((item) => item?.id === clean(id, 100));
    if (!run || run.status !== 'completed' || run.target?.type !== 'product' || !clean(run.target?.productId, 100)) throw Object.assign(new Error('Nie znaleziono szkicu produktu do zatwierdzenia.'), { code: 'agent_specialist_draft_not_found', status: 404 });
    if (['applied', 'auto_applied', 'not_needed'].includes(run.approvalStatus)) return { applied: false, duplicate: true, run };
    const outputToProduct = { title: 'nazwa', short_description: 'opisKrotki', long_description: 'opis', seo_title: 'seoTitle', seo_description: 'seoDescription', seo_keywords: 'seoKeywords', allegro_title: 'allegroTitle', allegro_description: 'allegroDescription' };
    const allProposed = productPatch(run.result), requestedKeys = new Set((Array.isArray(options.fieldKeys) ? options.fieldKeys : []).map((item) => outputToProduct[clean(item, 80)] || clean(item, 80)).filter(Boolean));
    const proposedPatch = requestedKeys.size ? Object.fromEntries(Object.entries(allProposed).filter(([key]) => requestedKeys.has(key))) : allProposed;
    const productId = String(run.target.productId);
    let appliedPatch = {}, beforePatch = {};
    if (!Object.keys(proposedPatch).length) throw Object.assign(new Error('Szkic nie zawiera bezpiecznych pól produktu do zapisania.'), { code: 'agent_specialist_patch_empty', status: 422 });
    await change('settings', { data: {}, rev: 0, updated_at: null }, (record) => {
      const previous = record && typeof record === 'object' ? record : { data: {}, rev: 0 }, data = { ...(previous.data || {}) }, added = Array.isArray(data.artway_produkty_dodane) ? [...data.artway_produkty_dodane] : [], index = added.findIndex((product) => String(product?.id) === productId), timestamp = now().toISOString();
      const effective = index >= 0 ? added[index] : { ...(catalogProducts(data).find((product) => String(product?.id) === productId) || {}), ...((data.artway_produkty_edytowane || {})[productId] || {}) };
      const patch = options.missingOnly === true ? missingOnlyPatch(effective, proposedPatch) : proposedPatch;
      if (!Object.keys(patch).length) return previous;
      appliedPatch = patch;
      beforePatch = Object.fromEntries(Object.keys(patch).map((key) => [key, productFieldValue(effective, key) ?? '']));
      const safePatch = { ...patch, agentTextModel: run.model, agentTextReviewedAt: timestamp, agentTextRunId: run.id, agentTextMode: options.missingOnly === true ? 'safe-missing-only' : 'approved' };
      if (index >= 0) { added[index] = { ...added[index], ...safePatch }; data.artway_produkty_dodane = added; }
      else { const edited = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {}; edited[productId] = { ...(edited[productId] || {}), ...safePatch }; data.artway_produkty_edytowane = edited; }
      return { ...previous, data, rev: Number(previous.rev || 0) + 1, updated_at: timestamp };
    });
    if (!Object.keys(appliedPatch).length) {
      await updateHistory(run.id, { approvalStatus: 'not_needed', appliedAt: now().toISOString(), appliedBy: 'agent-safe-policy' });
      return { applied: false, duplicate: true, noMissingFields: true, productId, patch: {} };
    }
    const appliedAt = now().toISOString(), appliedBy = clean(actor?.email || actor?.name || 'administrator', 120);
    await updateHistory(run.id, { approvalStatus: options.missingOnly === true ? 'auto_applied' : 'applied', appliedAt, appliedBy, appliedFields: Object.keys(appliedPatch), beforePatch, appliedPatch });
    return { applied: true, productId, patch: appliedPatch, before: beforePatch, appliedAt, appliedBy, safeAutoApply: options.missingOnly === true };
  }

  async function automaticCycle() {
    const current = await readState();
    if (!current.config.enabled || !current.config.automaticEnabled || current.config.automaticDailyLimit < 1) return { skipped: true, reason: 'disabled', prepared: [], applied: [], decisions: [] };
    const cycleStartedAt = now().toISOString();
    const [settingsVersion, communicationsVersion] = await Promise.all([
      readVersioned('settings', { data: {}, rev: 0 }),
      readVersioned('allegro_communications', { threads: [], issues: [], updated_at: null }),
    ]);
    const data = settingsVersion.value?.data || {}, products = catalogProducts(data), communications = communicationsVersion.value || {};
    const recentCutoff = now().getTime() - 7 * 24 * 60 * 60_000, recentTargets = new Set(current.history.filter((item) => item.source === 'automatic' && item.status === 'completed' && item.promptVersion === PROMPT_VERSION && Date.parse(item.createdAt || '') >= recentCutoff).map((item) => String(item.target?.productId || '')).filter(Boolean));
    const candidates = products.map((product) => {
      const short = clean(product.opisKrotki || product.krotkiOpis, 5000), full = clean(product.opis, 30000), missing = (!short ? 3 : 0) + (full.length < 250 ? 4 : 0) + (!product.seoTitle ? 2 : 0) + (!product.seoDescription ? 2 : 0);
      return { product, missing };
    }).filter((item) => item.missing > 0 && !recentTargets.has(String(item.product.id))).sort((a, b) => String(b.product.createdAt || b.product.dataDodania || '').localeCompare(String(a.product.createdAt || a.product.dataDodania || '')) || b.missing - a.missing);
    const prepared = [], applied = [], decisionResults = [], activeFingerprints = new Set();

    const unresolvedCommunication = [
      ...(Array.isArray(communications.threads) ? communications.threads.map((item) => ({ type: 'thread', item })) : []),
      ...(Array.isArray(communications.issues) ? communications.issues.map((item) => ({ type: 'issue', item })) : []),
    ].filter(({ item }) => communicationNeedsReply(item)).sort((a, b) => String(b.item?.latestNewIncoming?.createdAt || b.item?.lastMessage?.createdAt || '').localeCompare(String(a.item?.latestNewIncoming?.createdAt || a.item?.lastMessage?.createdAt || '')));

    let availableRuns = current.config.automaticBatchSize;
    for (const { type, item } of unresolvedCommunication.slice(0, 20)) {
      const target = { type: 'communication', communicationType: type, communicationId: String(item?.id || ''), sourceMessageId: String(item?.latestNewIncomingKey || item?.latestNewIncoming?.id || item?.lastMessage?.id || '') };
      const fp = decisionFingerprint('customer_reply', target); activeFingerprints.add(fp);
      const existing = current.decisions.find((entry) => entry.fingerprint === fp && activeDecision(entry, now()));
      if (existing) continue;
      let draft = null;
      if (availableRuns > 0) {
        try {
          draft = await run({ specialist: 'customer_reply', source: 'automatic', instruction: 'Przeanalizuj całą przekazaną rozmowę i przygotuj wyłącznie szkic odpowiedzi. Nie wysyłaj go. Nie obiecuj działań niepotwierdzonych w faktach.', context: { conversation: communicationFacts(item, type) }, target }, { source: 'background-agent' });
          prepared.push({ id: draft.id, type: 'communication', targetId: target.communicationId, status: 'prepared' }); availableRuns -= 1;
        } catch (error) {
          if (error?.code === 'agent_specialist_daily_limit') availableRuns = 0;
          else prepared.push({ type: 'communication', targetId: target.communicationId, status: 'error', error: safeError(error?.message || error) });
        }
      }
      const decision = await upsertDecision({ fingerprint: fp, kind: 'customer_reply', specialist: 'customer_reply', icon: type === 'issue' ? '🛟' : '💬', title: type === 'issue' ? 'Nowa dyskusja wymaga decyzji' : 'Nowa wiadomość wymaga odpowiedzi', summary: 'Agent przeanalizował sprawę i przygotował bezpieczny szkic. Żadna wiadomość nie została wysłana automatycznie.', recommendation: 'Sprawdź szkic w odpowiednim module i zatwierdź jego wysłanie dopiero po weryfikacji zamówienia oraz przesyłki.', alternatives: ['Popraw szkic', 'Oznacz jako załatwione wewnętrznie', 'Odłóż decyzję'], risk: 'high', target, href: `#/admin/allegro/${type === 'issue' ? 'dyskusje' : 'wiadomosci'}`, runId: draft?.id || '' });
      decisionResults.push(decision);
    }

    for (const item of candidates.slice(0, Math.max(0, availableRuns))) {
      try {
        const draft = await run({ specialist: 'product_content', source: 'automatic', instruction: 'Przygotuj kompletny, profesjonalny szkic treści produktu do kontroli administratora. Zachowaj wszystkie potwierdzone fakty i zgłoś braki.', context: { product: productFacts(item.product) }, target: { type: 'product', productId: String(item.product.id), name: clean(item.product.nazwa, 180) } }, { source: 'background-agent' });
        const eligible = current.config.safeAutoApply && draft.result?.readyForApproval === true && draft.result?.complianceStatus === 'ready' && Number(draft.result?.confidence || 0) >= current.config.confidenceThreshold && !(draft.result?.warnings || []).length && !(draft.result?.missingFacts || []).length;
        if (eligible) {
          const result = await applyProductDraft(draft.id, { source: 'background-agent' }, { missingOnly: true });
          if (result.applied) applied.push({ id: draft.id, productId: String(item.product.id), name: clean(item.product.nazwa, 180), fields: Object.keys(result.patch || {}) });
          prepared.push({ id: draft.id, productId: String(item.product.id), name: clean(item.product.nazwa, 180), status: result.applied ? 'auto_applied' : 'not_needed' });
        } else {
          const target = { type: 'product', productId: String(item.product.id), name: clean(item.product.nazwa, 180) }, fp = decisionFingerprint('product_content_review', target); activeFingerprints.add(fp);
          const decision = await upsertDecision({ fingerprint: fp, kind: 'product_content_review', specialist: 'product_content', icon: '✨', title: `Sprawdź treść: ${clean(item.product.nazwa, 120) || item.product.id}`, summary: draft.result?.summary || 'Treść wymaga sprawdzenia przed zapisem.', recommendation: draft.result?.missingFacts?.length ? 'Uzupełnij brakujące fakty, a następnie ponów przygotowanie.' : 'Zatwierdź przygotowane pola produktu albo odrzuć propozycję.', alternatives: ['Popraw dane produktu', 'Odłóż decyzję', 'Odrzuć szkic'], risk: 'medium', target, href: '#/admin/asortyment/produkty', runId: draft.id });
          decisionResults.push(decision); prepared.push({ id: draft.id, productId: String(item.product.id), name: clean(item.product.nazwa, 180), status: 'needs_decision' });
        }
      } catch (error) {
        if (error?.code === 'agent_specialist_daily_limit') break;
        prepared.push({ productId: String(item.product.id), name: clean(item.product.nazwa, 180), status: 'error', error: safeError(error?.message || error) });
      }
    }

    let openCatalogDecisionCount = current.decisions.filter((item) => item.kind === 'catalog_identity' && activeDecision(item, now())).length;
    for (const product of products.slice().sort((a, b) => String(b.createdAt || b.dataDodania || '').localeCompare(String(a.createdAt || a.dataDodania || ''))).slice(0, 200)) {
      const missing = [!clean(product.gtin || product.ean, 80) && 'EAN', !clean(product.producent || product.marka, 120) && 'producent', !clean(product.kategoria, 160) && 'kategoria'].filter(Boolean);
      if (!missing.length) continue;
      const target = { type: 'product', productId: String(product.id), name: clean(product.nazwa, 180), missing }, fp = decisionFingerprint('catalog_identity', target); activeFingerprints.add(fp);
      const existing = current.decisions.find((entry) => entry.fingerprint === fp && ['open', 'snoozed'].includes(entry.status));
      if (existing || openCatalogDecisionCount >= 12) continue;
      const decision = await upsertDecision({ fingerprint: fp, kind: 'catalog_identity', specialist: 'catalog_quality', icon: '🛡️', title: `Brak danych identyfikacyjnych: ${clean(product.nazwa, 120) || product.id}`, summary: `Brakuje: ${missing.join(', ')}. Agent nie może bezpiecznie zgadywać tych danych.`, recommendation: 'Uzupełnij brak z linku producenta albo karty produktu przed publikacją na zewnętrznych kanałach.', alternatives: ['Otwórz produkt', 'Odłóż na 1 dzień', 'Odrzuć ostrzeżenie'], risk: 'medium', target, href: '#/admin/asortyment/produkty' });
      decisionResults.push(decision); openCatalogDecisionCount += 1;
    }

    const productById = new Map(products.map((product) => [String(product.id), product]));
    for (const decision of current.decisions.filter((item) => activeDecision(item, now()))) {
      if (decision.kind === 'product_content_review') {
        const product = productById.get(String(decision.target?.productId || ''));
        if (product && (!clean(product.opisKrotki || product.krotkiOpis, 5000) || clean(product.opis, 30000).length < 250 || !product.seoTitle || !product.seoDescription)) activeFingerprints.add(decision.fingerprint);
      }
      if (decision.kind === 'catalog_identity') {
        const product = productById.get(String(decision.target?.productId || ''));
        if (product && (!clean(product.gtin || product.ean, 80) || !clean(product.producent || product.marka, 120) || !clean(product.kategoria, 160))) activeFingerprints.add(decision.fingerprint);
      }
    }

    const completedAt = now().toISOString(), lastCycle = { startedAt: cycleStartedAt, completedAt, prepared: prepared.length, autoApplied: applied.length, decisionsCreated: decisionResults.length, communicationChecked: unresolvedCommunication.length, productsChecked: products.length, status: prepared.some((item) => item.status === 'error') ? 'warning' : 'completed' };
    await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
      const previous = state(value), retentionCutoff = now().getTime() - previous.config.decisionRetentionDays * 24 * 60 * 60_000;
      const decisions = previous.decisions.map((item) => {
        if (!['customer_reply', 'product_content_review', 'catalog_identity'].includes(item.kind) || !activeDecision(item, now()) || activeFingerprints.has(item.fingerprint)) return item;
        return normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'agent-reconciliation', resolutionNote: 'Warunek wymagający decyzji już nie występuje.' }, completedAt);
      }).filter((item) => activeDecision(item, now()) || Date.parse(item.updatedAt || item.createdAt || '') >= retentionCutoff).slice(0, MAX_DECISIONS);
      return { ...previous, decisions, lastCycle, updatedAt: completedAt };
    });
    const meaningful = prepared.length || applied.length || decisionResults.length;
    return { skipped: !meaningful, reason: meaningful ? '' : 'no_candidates', prepared, applied, decisions: decisionResults.map((item) => ({ id: item.id, kind: item.kind, risk: item.risk })), lastCycle };
  }

  return Object.freeze({ status, configure, run, applyProductDraft, updateDecision, automaticCycle, specialists: SPECIALISTS });
}

export { DEFAULT_CONFIG, NEVER_AUTOMATIC, PROMPT_VERSION, RESULT_SCHEMA, SPECIALISTS, activeDecision, communicationNeedsReply, normalizeDecision, normalizeResult, productFacts, productPatch, sanitizeContext };
