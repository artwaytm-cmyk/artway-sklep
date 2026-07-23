import crypto from 'node:crypto';
import { allegroSanitizePlainText } from '../allegro-compliance.mjs';
import { allegroContentCompliance, vonHalskyContentCompliance } from './channel-content-compliance.mjs';
import { AGENT_ACTION_POLICY, NEVER_AUTOMATIC } from './agent-action-policy.mjs';
import { decisionFingerprint, decisionSubjectKey, normalizeDecisionReceipt } from './agent-decision-state.mjs';
import { SPECIALISTS } from './agent-specialist-definitions.mjs';

const STATE_KEY = 'agent_specialists_state';
const MAX_HISTORY = 240;
const MAX_DECISIONS = 240;
const MAX_DECISION_RECEIPTS = 2000;
const MAX_WRITE_ATTEMPTS = 8;
const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  automaticEnabled: true,
  dailyLimit: 240,
  automaticDailyLimit: 200,
  automaticBatchSize: 12,
  cacheHours: 24,
  safeAutoApply: true,
  autoApplyProductEditorial: true,
  autoUpdateLinkedAllegroContent: true,
  autoPrepareCustomerReplyDrafts: true,
  autoAuditCatalogIdentity: true,
  confidenceThreshold: 0.92,
  learningEnabled: true,
  approvalWarmupCount: 3,
  learnedAutoApplyThreshold: 0.86,
  decisionRetentionDays: 30,
});

const PROMPT_VERSION = '2026-07-23.3';
const PRODUCT_OUTPUT_TO_FIELD = Object.freeze({ title: 'nazwa', short_description: 'opisKrotki', long_description: 'opis', seo_title: 'seoTitle', seo_description: 'seoDescription', seo_keywords: 'seoKeywords', allegro_title: 'allegroTitle', allegro_description: 'allegroDescription', von_halsky_title: 'vonHalskyTitle', von_halsky_short_description: 'vonHalskyShortDescription', von_halsky_description: 'vonHalskyDescription' });

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
    dailyLimit: number(source.dailyLimit, DEFAULT_CONFIG.dailyLimit, 1, 500),
    automaticDailyLimit: number(source.automaticDailyLimit, DEFAULT_CONFIG.automaticDailyLimit, 0, 400),
    automaticBatchSize: number(source.automaticBatchSize, DEFAULT_CONFIG.automaticBatchSize, 1, 12),
    cacheHours: number(source.cacheHours, DEFAULT_CONFIG.cacheHours, 1, 168),
    safeAutoApply: source.safeAutoApply !== false,
    autoApplyProductEditorial: source.autoApplyProductEditorial !== false,
    autoUpdateLinkedAllegroContent: source.autoUpdateLinkedAllegroContent !== false,
    autoPrepareCustomerReplyDrafts: source.autoPrepareCustomerReplyDrafts !== false,
    autoAuditCatalogIdentity: source.autoAuditCatalogIdentity !== false,
    confidenceThreshold: number(source.confidenceThreshold, DEFAULT_CONFIG.confidenceThreshold, 0.75, 1),
    learningEnabled: source.learningEnabled !== false,
    approvalWarmupCount: number(source.approvalWarmupCount, DEFAULT_CONFIG.approvalWarmupCount, 0, 20),
    learnedAutoApplyThreshold: number(source.learnedAutoApplyThreshold, DEFAULT_CONFIG.learnedAutoApplyThreshold, 0.6, 1),
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

function normalizeFieldStats(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(source).slice(0, 30).map(([key, item]) => [clean(key, 80), {
    approved: number(item?.approved, 0, 0, 100_000), rejected: number(item?.rejected, 0, 0, 100_000),
  }]).filter(([key]) => key));
}

function normalizeLearning(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const product = source.product_content && typeof source.product_content === 'object' ? source.product_content : {};
  return {
    product_content: {
      approvals: number(product.approvals, 0, 0, 100_000), dismissals: number(product.dismissals, 0, 0, 100_000), corrections: number(product.corrections, 0, 0, 100_000),
      fieldStats: normalizeFieldStats(product.fieldStats),
      examples: (Array.isArray(product.examples) ? product.examples : []).slice(0, 12).map((example) => ({
        id: clean(example?.id, 120), productId: clean(example?.productId, 120), outcome: ['approved', 'dismissed', 'corrected'].includes(example?.outcome) ? example.outcome : 'approved',
        note: clean(example?.note, 500), actor: clean(example?.actor, 120), at: clean(example?.at, 40),
        fields: (Array.isArray(example?.fields) ? example.fields : []).slice(0, 8).map((field) => ({ key: clean(field?.key, 80), currentValue: clean(field?.currentValue, 1200), value: clean(field?.value, 2500), accepted: field?.accepted === true })).filter((field) => field.key),
      })),
      updatedAt: clean(product.updatedAt, 40),
    },
  };
}

function learningAutonomy(learning = {}, settings = DEFAULT_CONFIG) {
  const profile = normalizeLearning(learning).product_content, stats = Object.values(profile.fieldStats);
  const approvedFields = stats.reduce((sum, item) => sum + item.approved, 0), rejectedFields = stats.reduce((sum, item) => sum + item.rejected, 0);
  const acceptanceRate = approvedFields + rejectedFields > 0 ? approvedFields / (approvedFields + rejectedFields) : 0;
  const enabled = settings.learningEnabled !== false;
  const ready = enabled && profile.approvals >= settings.approvalWarmupCount && acceptanceRate >= settings.learnedAutoApplyThreshold;
  const trustedFields = Object.entries(profile.fieldStats).filter(([, item]) => item.approved >= 2 && item.approved / Math.max(1, item.approved + item.rejected) >= settings.learnedAutoApplyThreshold).map(([key]) => key);
  return { enabled, ready, approvals: profile.approvals, dismissals: profile.dismissals, corrections: profile.corrections, approvedFields, rejectedFields, acceptanceRate, trustedFields, warmupRequired: settings.approvalWarmupCount, threshold: settings.learnedAutoApplyThreshold, remainingApprovals: Math.max(0, settings.approvalWarmupCount - profile.approvals) };
}

function learningPrompt(learning = {}, specialist = '') {
  if (specialist !== 'product_content') return '';
  const profile = normalizeLearning(learning).product_content;
  if (!profile.examples.length) return 'Brak przykładów preferowanego stylu. Przygotuj konserwatywną, kompletną redakcję opartą wyłącznie na przekazanych faktach; nie zakładaj nieznanych parametrów.';
  const examples = profile.examples.slice(0, 4).map((example, index) => {
    const fields = example.fields.slice(0, 4).map((field) => `${field.accepted ? 'zaakceptowano' : 'nie zaakceptowano'} ${field.key}: ${field.value}`).join(' | ');
    return `Przykład ${index + 1} (${example.outcome})${example.note ? `, uwaga administratora: ${example.note}` : ''}: ${fields}`;
  }).join('\n');
  return `Ucz się wyłącznie z poniższych jawnych zatwierdzeń i korekt administratora. Naśladuj zaakceptowany poziom konkretności, układ i ton; nie kopiuj danych jednego produktu do drugiego. Odrzucone pola pokazują, czego unikać.\n${examples}`;
}

function state(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const receiptRows = [
    ...(Array.isArray(source.decisionReceipts) ? source.decisionReceipts : []),
    ...(Array.isArray(source.decisions) ? source.decisions : []).filter((item) => ['approved', 'dismissed', 'resolved'].includes(item?.status)),
  ].map((item) => normalizeDecisionReceipt(item)).filter((item) => item.subjectKey);
  const receiptKeys = new Set();
  return {
    config: config(source.config),
    history: (Array.isArray(source.history) ? source.history : []).slice(0, MAX_HISTORY),
    decisions: (Array.isArray(source.decisions) ? source.decisions : []).slice(0, MAX_DECISIONS),
    decisionReceipts: receiptRows.sort((a, b) => String(b.resolvedAt || b.updatedAt).localeCompare(String(a.resolvedAt || a.updatedAt))).filter((item) => !receiptKeys.has(item.subjectKey) && receiptKeys.add(item.subjectKey)).slice(0, MAX_DECISION_RECEIPTS),
    communicationScan: source.communicationScan && typeof source.communicationScan === 'object' ? { signal: clean(source.communicationScan.signal, 100), lastAt: clean(source.communicationScan.lastAt, 40) } : { signal: '', lastAt: '' },
    learning: normalizeLearning(source.learning),
    lastCycle: source.lastCycle && typeof source.lastCycle === 'object' ? source.lastCycle : null,
    updatedAt: clean(source.updatedAt, 40),
  };
}

function normalizeDecision(raw = {}, timestamp = new Date().toISOString()) {
  const status = ['open', 'approved', 'dismissed', 'snoozed', 'resolved'].includes(raw.status) ? raw.status : 'open';
  const risk = ['low', 'medium', 'high'].includes(raw.risk) ? raw.risk : 'medium';
  const alternatives = (Array.isArray(raw.alternatives) ? raw.alternatives : []).map((item) => clean(item, 240)).filter(Boolean).slice(0, 5);
  return {
    id: clean(raw.id, 120) || `decision_${crypto.randomUUID()}`,
    subjectKey: decisionSubjectKey(raw.kind, raw.target, raw.subjectKey),
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
    revisionCount: number(raw.revisionCount, 0, 0, 100), feedbackNote: clean(raw.feedbackNote, 500),
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
  const result = {
    title: clean(raw.title, 180), summary: clean(raw.summary, 500), content: clean(raw.content, 30000), fields,
    suggestions: list(raw.suggestions), warnings: list(raw.warnings), missingFacts, factsUsed: list(raw.factsUsed),
    confidence: number(raw.confidence, 0, 0, 1),
    readyForApproval: raw.readyForApproval === true && missingFacts.length === 0,
    complianceStatus: ['ready', 'needs_review', 'blocked_missing_facts'].includes(raw.complianceStatus) ? raw.complianceStatus : (missingFacts.length ? 'blocked_missing_facts' : 'needs_review'),
  };
  return ['product_content', 'store_compliance'].includes(specialist) ? normalizeProductContentEditorialResult(result) : result;
}

function normalizeProductContentEditorialResult(result = {}) {
  let editorialFields = Array.isArray(result.fields) ? result.fields : [];
  const fallbackTitle = clean(result.title, 300), fallbackLong = clean(result.content, 30_000);
  const fallbackPlain = fallbackLong.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const fallbackShort = clean(result.summary || fallbackPlain, 500);
  if (!editorialFields.length && fallbackTitle && !/(?:szkic|redakcja|opis)\s+produktu/i.test(fallbackTitle) && fallbackShort && fallbackPlain.length >= 150) {
    const fallbackSeoDescription = clean(fallbackShort || fallbackPlain, 180);
    editorialFields = [
      { key: 'title', label: 'Nazwa', value: fallbackTitle, currentValue: '', reason: 'Uzupełniono z kompletnego wyniku redaktora.', evidence: 'Tytuł zwrócony przez model.' },
      { key: 'short_description', label: 'Opis krótki', value: fallbackShort, currentValue: '', reason: 'Uzupełniono z podsumowania redaktora.', evidence: 'Podsumowanie oparte na faktach produktu.' },
      { key: 'long_description', label: 'Opis długi', value: fallbackLong, currentValue: '', reason: 'Uzupełniono z głównej treści redaktora.', evidence: 'Kompletna treść zwrócona przez model.' },
      { key: 'seo_title', label: 'Tytuł SEO', value: fallbackTitle.slice(0, 70), currentValue: '', reason: 'Spójny tytuł wspólnej karty produktu.', evidence: 'Nazwa produktu zwrócona przez model.' },
      { key: 'seo_description', label: 'Opis SEO', value: fallbackSeoDescription, currentValue: '', reason: 'Spójne podsumowanie wspólnej karty produktu.', evidence: 'Podsumowanie zwrócone przez model.' },
      { key: 'seo_keywords', label: 'Frazy SEO', value: fallbackTitle, currentValue: '', reason: 'Bezpieczne frazy z nazwy produktu.', evidence: 'Nazwa produktu zwrócona przez model.' },
    ];
  }
  const normalized = { ...result, fields: editorialFields };
  const fields = Object.fromEntries(editorialFields.map((field) => [field.key, clean(field.value, 30_000)]));
  const complete = clean(fields.title, 300)
    && clean(fields.short_description, 1000)
    && clean(fields.long_description, 30_000).length >= 150
    && clean(fields.seo_title, 180)
    && clean(fields.seo_description, 300);
  if (!complete) return { ...normalized, readyForApproval: false };
  // Redakcja nie może być blokowana dlatego, że karta nie zawiera opcjonalnego
  // parametru. Model ma pominąć taki fakt, a nie wymagać kliknięcia administratora.
  // Zgodność gotowej treści jest niezależnie sprawdzana deterministycznie przez
  // automaticEditorialAssessment przed jakimkolwiek zapisem.
  return {
    ...normalized, editorialNotes: [...(result.warnings || []), ...(result.missingFacts || [])].slice(0, 20), missingFacts: [], warnings: [], confidence: Math.max(0.94, Number(result.confidence) || 0),
    readyForApproval: true, complianceStatus: 'ready',
  };
}

function fingerprint(specialist, instruction, context) {
  return crypto.createHash('sha256').update(JSON.stringify({ specialist, instruction, context })).digest('hex');
}

function day(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function responseError(response, payload) {
  const error = new Error(safeError(payload?.error?.message || payload?.message || `OpenAI HTTP ${response.status}`));
  error.code = clean(payload?.error?.code || payload?.error?.type || 'openai_response_error', 100);
  error.status = response.status >= 400 && response.status < 500 ? 422 : 502;
  return error;
}

function sourceEditorialFacts(value = '', limit = 30_000) {
  const cleaned = clean(value, limit)
    .replace(/\bdodaj\s+do\s+(?:por[oó]wnania|listy\s+zakupowej|koszyka)\b/gi, ' ')
    .replace(/\brozmiar\s*:?\s*uniwersalny\s*[,;:-]?\s*\d{1,6}\s*szt(?:uk(?:a|i|ę|om)?|\.)?(?![a-ząćęłńóśźż])/gi, ' ')
    .replace(/\bprodukt\s+(?:jest\s+)?dost[eę]pn(?:y|a|e)\b/gi, ' ')
    .replace(/\bwysy[łl]ka\s+w\s+\S+|sprawd[źz]\s+czasy\s+i\s+koszty\s+wysy[łl]ki/gi, ' ')
    .replace(/\b\d+[,.]\d{2}\s*z[łl](?:\s*brutto\s*\/\s*\d+\s*szt\.?)?/gi, ' ')
    .replace(/(?:\s*[•|]\s*|\s{2,})/g, ' ').trim();
  // Ten sam filtr, który chroni zapis do Allegro, czyści materiał wejściowy
  // jeszcze przed przekazaniem go któremukolwiek redaktorowi.
  return allegroSanitizePlainText(cleaned).text;
}

function productFacts(product = {}) {
  const source = product.sourceMaterial && typeof product.sourceMaterial === 'object' ? product.sourceMaterial : {};
  return sanitizeContext({
    id: product.id, name: product.nazwa || product.name, category: product.kategoria, producer: product.producent || product.marka,
    ean: product.gtin || product.ean, producerCode: product.kodProducenta || product.mpn, price: product.cena,
    shortDescription: sourceEditorialFacts(source.shortDescription || product.opisKrotki || product.krotkiOpis, 4000),
    fullDescription: sourceEditorialFacts(source.longDescription || source.allegroCatalogDescription || source.allegroOfferDescription || product.opis),
    parameters: product.parametry || product.parameters, age: product.wiek, players: product.gracze,
    sourceUrl: product.sourceUrl || product.producentUrl,
    sourceMaterial: { ...source,
      shortDescription: sourceEditorialFacts(source.shortDescription, 4000),
      longDescription: sourceEditorialFacts(source.longDescription),
      allegroCatalogDescription: sourceEditorialFacts(source.allegroCatalogDescription),
      allegroOfferDescription: sourceEditorialFacts(source.allegroOfferDescription),
    },
    channelContent: {
      store: { title: clean(product.nazwa || product.name, 300), shortDescription: sourceEditorialFacts(product.opisKrotki || product.krotkiOpis, 4000), fullDescription: sourceEditorialFacts(product.opis) },
      allegro: { title: clean(product.allegroTitle, 300), shortDescription: sourceEditorialFacts(product.allegroShortDescription, 4000), fullDescription: sourceEditorialFacts(product.allegroDescription) },
      vonHalsky: { title: clean(product.vonHalskyTitle, 300), shortDescription: sourceEditorialFacts(product.vonHalskyShortDescription, 4000), fullDescription: sourceEditorialFacts(product.vonHalskyDescription) },
    },
    seoTitle: product.seoTitle, seoDescription: product.seoDescription,
  });
}

function productPatch(result = {}) {
  const fields = Object.fromEntries((result.fields || []).map((field) => [field.key, field.value]));
  const generatedDescription = (value, limit) => clean(value, limit)
    .replace(/\brozmiar\s*:?\s*uniwersalny\s*[,;:-]?\s*(?:to\s+)?\d{1,6}\s+szt(?:uk(?:a|i|ę|om)?|\.)?(?![a-ząćęłńóśźż])[,.]?/gi, '')
    .replace(/\bEAN\s*:?\s*\d{8,14}\b[,.]?/gi, '')
    .replace(/\b(?:kod\s+producenta|SKU)\s*:?\s*[A-Za-z0-9][A-Za-z0-9._/-]{0,60}\b[,.]?/gi, '')
    .replace(/\bkod\s*:?\s*(?=[A-Za-z0-9._/-]*\d)[A-Za-z0-9][A-Za-z0-9._/-]{0,60}\b[,.]?/gi, '')
    .replace(/<p>\s*(?:Źr[oó]d[łl]o|Materia[łl]\s+źr[oó]d[łl]owy)\s*:.*?<\/p>/gis, '')
    .replace(/<li>\s*<\/li>/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
  const patch = {};
  if (fields.title) patch.nazwa = fields.title;
  if (fields.short_description) patch.opisKrotki = generatedDescription(fields.short_description, 2000).replace(/[\s,;:-]+$/g, '').replace(/([\p{L}\p{N}])$/u, '$1.');
  if (fields.long_description) patch.opis = generatedDescription(fields.long_description, 30_000);
  if (fields.seo_title) patch.seoTitle = fields.seo_title;
  if (fields.seo_description) patch.seoDescription = fields.seo_description;
  if (fields.seo_keywords) patch.seoKeywords = fields.seo_keywords;
  if (fields.allegro_title) patch.allegroTitle = fields.allegro_title;
  if (fields.allegro_description) patch.allegroDescription = generatedDescription(fields.allegro_description, 30_000);
  if (fields.von_halsky_title) patch.vonHalskyTitle = fields.von_halsky_title;
  if (fields.von_halsky_short_description) patch.vonHalskyShortDescription = generatedDescription(fields.von_halsky_short_description, 2000);
  if (fields.von_halsky_description) patch.vonHalskyDescription = generatedDescription(fields.von_halsky_description, 30_000);
  return patch;
}

function editorialIdentityConflict(result = {}) {
  const notes = [...(result.editorialNotes || []), ...(result.warnings || []), ...(result.missingFacts || [])].join(' ')
    .replace(/\b(?:nie\s+wprowadza\S*|bez)\s+sprzeczno[śs]ci\b/gi, '');
  return /(?:sprzeczn|niejednoznaczn|nie da si[eę].{0,30}rozpozna|tożsamo[śs][ćc].{0,30}(?:niepew|brak|konflikt)|inny produkt|różne produkty)/i.test(notes);
}

const SOURCE_PAGE_NOISE = Object.freeze([
  Object.freeze({ id: 'comparison_control', pattern: /\bdodaj\s+do\s+por[oó]wnania\b/i }),
  Object.freeze({ id: 'shopping_list_control', pattern: /\bdodaj\s+do\s+listy\s+zakupowej\b/i }),
  Object.freeze({ id: 'source_availability', pattern: /\bprodukt\s+(?:jest\s+)?dost[eę]pn(?:y|a|e)\b/i }),
  Object.freeze({ id: 'source_contact', pattern: /\b(?:skontaktuj\s+si[eę]\s+z\s+nami|zapytaj\s+o\s+produkt)\b/i }),
  Object.freeze({ id: 'availability_notification', pattern: /\bpowiadom\s+(?:mnie\s+)?o\s+dost[eę]pno[śs]ci\b/i }),
  Object.freeze({ id: 'cart_control', pattern: /\b(?:przejd[źz]\s+do\s+koszyka|dodaj\s+do\s+koszyka)\b/i }),
  Object.freeze({ id: 'source_stock', pattern: /(?:^|[>\s])\d{1,6}\s*szt\.\s*(?:produkt|dost[eę]pn|wysy[łl])/i }),
  Object.freeze({ id: 'source_size_stock', pattern: /\brozmiar\s*:?\s*uniwersalny\s*[,;:-]?\s*\d{1,6}\s*szt(?:uk(?:a|i|ę|om)?|\.)?(?![a-ząćęłńóśźż])/i }),
  Object.freeze({ id: 'source_shipping_control', pattern: /\b(?:sprawd[źz]\s+czasy\s+i\s+koszty\s+wysy[łl]ki|wysy[łl]ka\s+w\s+(?:poniedzia[łl]ek|wtorek|[śs]rod[eę]|czwartek|pi[aą]tek|sobot[eę]|niedziel[eę]|dzisiaj|jutro))\b/i }),
  Object.freeze({ id: 'source_price', pattern: /\b(?:nasza\s+cena|cena\s+produktu)\s*:?\s*\d+[,.]\d{2}\s*z[łl]\b/i }),
]);

function productEditorialTextQuality(product = {}) {
  const shortDescription = clean(product.opisKrotki || product.krotkiOpis || product.short_description, 4000);
  const longDescription = clean(product.opis || product.long_description, 30_000);
  const text = `${shortDescription}\n${longDescription}`;
  const issues = SOURCE_PAGE_NOISE.filter((rule) => rule.pattern.test(text)).map((rule) => rule.id);
  return { clean: issues.length === 0, issues, shortDescription, longDescription };
}

function productEditorialQuality(product = {}) {
  const text = productEditorialTextQuality(product);
  const mode = clean(product.agentTextMode, 80);
  const persistedByAgent = ['autonomous-editorial', 'approved'].includes(mode)
    && Boolean(clean(product.agentTextRunId, 160))
    && Boolean(clean(product.agentTextReviewedAt, 80));
  return { ...text, mode, persistedByAgent, ready: text.clean && persistedByAgent };
}

function automaticEditorialAssessment(run = {}, settings = DEFAULT_CONFIG) {
  const channel = run.specialist === 'allegro_offer' || run.specialist === 'allegro_compliance' ? 'allegro'
    : run.specialist === 'von_halsky_offer' || run.specialist === 'von_halsky_compliance' ? 'vonHalsky' : 'store';
  const assessedResult = channel === 'store' ? normalizeProductContentEditorialResult(run.result || {}) : (run.result || {});
  const patch = productPatch(assessedResult), fields = Object.keys(patch);
  if (settings.autoApplyProductEditorial === false) return { eligible: false, reason: 'automatic_editorial_disabled', fields };
  if (!fields.length) return { eligible: false, reason: 'empty_patch', fields };
  const coreComplete = channel === 'allegro'
    ? clean(patch.allegroTitle, 300) && clean(patch.allegroDescription, 30_000).length >= 100
    : channel === 'vonHalsky'
      ? clean(patch.vonHalskyTitle, 300) && clean(patch.vonHalskyShortDescription, 2000) && clean(patch.vonHalskyDescription, 30_000).length >= 100
      : clean(patch.nazwa, 300) && clean(patch.opisKrotki, 2000) && clean(patch.opis, 30_000).length >= 150 && clean(patch.seoTitle, 180) && clean(patch.seoDescription, 300);
  if (!coreComplete) return { eligible: false, reason: 'incomplete_editorial', fields };
  if (Number(assessedResult?.confidence || 0) < 0.25) return { eligible: false, reason: 'invalid_editorial_output', fields };
  if (editorialIdentityConflict(assessedResult)) return { eligible: false, reason: 'product_identity_conflict', fields };
  const compliance = channel === 'allegro' ? allegroContentCompliance(patch) : channel === 'vonHalsky' ? vonHalskyContentCompliance(patch) : { ok: true, violations: [], policyId: 'artway-store-editorial-v1' };
  if (!compliance.ok) return { eligible: false, reason: channel === 'allegro' ? 'allegro_compliance' : 'von_halsky_compliance', fields, violations: compliance.violations.map((item) => item.label), channelCompliance: { [channel]: { status: 'blocked', policyId: compliance.policyId, violations: compliance.violations } }, channel };
  const editorialQuality = productEditorialTextQuality(patch);
  if (!editorialQuality.clean) return { eligible: false, reason: 'source_page_noise', fields, violations: editorialQuality.issues };
  return { eligible: true, reason: 'safe_editorial_policy', fields, channelCompliance: { [channel]: { status: 'passed', policyId: compliance.policyId, violations: [] } }, channel, modelNotes: [...(assessedResult?.warnings || []), ...(assessedResult?.missingFacts || [])].slice(0, 20) };
}

function valuePresent(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return clean(value, 50_000).length > 0;
}

function productFieldValue(product = {}, key = '') {
  const aliases = {
    nazwa: ['nazwa', 'name'], opisKrotki: ['opisKrotki', 'krotkiOpis'], opis: ['opis'], seoTitle: ['seoTitle'], seoDescription: ['seoDescription'], seoKeywords: ['seoKeywords'],
    allegroTitle: ['allegroTitle'], allegroDescription: ['allegroDescription'], vonHalskyTitle: ['vonHalskyTitle'], vonHalskyShortDescription: ['vonHalskyShortDescription'], vonHalskyDescription: ['vonHalskyDescription'],
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

function productEditorialTarget(product = {}) {
  const allegro = Boolean(
    clean(product.allegroOfferId || product.offerId, 120)
    || clean(product.allegroProductId, 120)
    || clean(product.allegroCategoryId, 80)
    || product.allegroPublicationIntent === true
    || ['queued', 'preparing', 'ready', 'published'].includes(clean(product.allegroPreparationStatus, 40).toLowerCase())
    || product.contentEditorial?.targets?.allegro === true
  );
  return { store: true, vonHalsky: true, allegro, channels: allegro ? 'independent_store_allegro_von_halsky' : 'independent_store_von_halsky' };
}

function productEditorialFingerprint(product = {}, target = productEditorialTarget(product)) {
  const source = product.sourceMaterial && typeof product.sourceMaterial === 'object' ? product.sourceMaterial : {};
  const facts = {
    promptVersion: PROMPT_VERSION,
    target: { store: target.store === true, vonHalsky: target.vonHalsky === true, allegro: target.allegro === true },
    source: {
      sourceUrl: clean(source.sourceUrl || product.sourceUrl || product.producentUrl, 1000),
      title: clean(source.title || product.nazwa || product.name, 300),
      shortDescription: clean(source.shortDescription || product.opisKrotki || product.krotkiOpis, 4000),
      longDescription: clean(source.longDescription || source.allegroCatalogDescription || source.allegroOfferDescription || product.opis, 30_000),
      producer: clean(source.producer || product.producent || product.marka, 160),
      brand: clean(source.brand || product.marka || product.producent, 160),
      category: clean(source.category || product.kategoria, 180),
      ean: clean(source.ean || product.gtin || product.ean, 80),
      producerCode: clean(source.producerCode || product.kodProducenta || product.mpn, 160),
      parameters: source.parameters || product.parametryProducenta || product.parametryZrodla || product.parametry || product.parameters || {},
    },
    category: clean(product.kategoria, 180), producer: clean(product.producent || product.marka, 160),
    ean: clean(product.gtin || product.ean, 80), producerCode: clean(product.kodProducenta || product.mpn, 160),
    parameters: product.parametryProducenta || product.parametryZrodla || product.parametry || product.parameters || {},
  };
  return crypto.createHash('sha256').update(JSON.stringify(sanitizeContext(facts))).digest('hex');
}

function productEditorialState(product = {}) {
  const target = productEditorialTarget(product), fingerprint = productEditorialFingerprint(product, target), editorial = product.contentEditorial || {}, quality = productEditorialQuality(product);
  const storeComplete = clean(product.nazwa || product.name, 300)
    && clean(product.opisKrotki || product.krotkiOpis, 500)
    && clean(product.opis, 30_000).length >= 150
    && clean(product.seoTitle, 180)
    && clean(product.seoDescription, 300);
  const channelStates = editorial.channelStates && typeof editorial.channelStates === 'object' ? editorial.channelStates : {};
  const stateCurrent = (name, complete) => channelStates[name]?.status === 'ready'
    && channelStates[name]?.promptVersion === PROMPT_VERSION
    && channelStates[name]?.inputFingerprint === fingerprint
    && Boolean(complete);
  const complete = {
    store: Boolean(storeComplete),
    allegro: !target.allegro || Boolean(clean(product.allegroTitle, 300) && clean(product.allegroDescription, 30_000).length >= 100),
    vonHalsky: Boolean(clean(product.vonHalskyTitle, 300) && clean(product.vonHalskyShortDescription, 2000) && clean(product.vonHalskyDescription, 30_000).length >= 100),
  };
  const currentChannels = { store: stateCurrent('store', complete.store), allegro: !target.allegro || stateCurrent('allegro', complete.allegro), vonHalsky: stateCurrent('vonHalsky', complete.vonHalsky) };
  const current = currentChannels.store && currentChannels.allegro && currentChannels.vonHalsky && quality.ready;
  const reviewedSameInput = Object.values(channelStates).some((entry) => entry?.status === 'needs_review' && entry?.promptVersion === PROMPT_VERSION && entry?.inputFingerprint === fingerprint);
  const retryRows = Object.values(channelStates).filter(Boolean), retryDue = retryRows.every((entry) => entry.status !== 'retry_pending' || !Number.isFinite(Date.parse(entry.retryAt || '')) || Date.parse(entry.retryAt || '') <= Date.now());
  return { target, fingerprint, current, currentChannels, reviewedSameInput, retryDue, complete, editorial, quality };
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

export { STATE_KEY, MAX_HISTORY, MAX_DECISIONS, MAX_DECISION_RECEIPTS, MAX_WRITE_ATTEMPTS, DEFAULT_CONFIG, PROMPT_VERSION, AGENT_ACTION_POLICY, NEVER_AUTOMATIC, PRODUCT_OUTPUT_TO_FIELD, SPECIALISTS, RESULT_SCHEMA, clean, number, config, safeError, sanitizeText, sanitizeContext, normalizeFieldStats, normalizeLearning, learningAutonomy, learningPrompt, state, decisionSubjectKey, decisionFingerprint, normalizeDecisionReceipt, normalizeDecision, activeDecision, outputText, normalizeResult, normalizeProductContentEditorialResult, fingerprint, day, responseError, sourceEditorialFacts, productFacts, productPatch, editorialIdentityConflict, SOURCE_PAGE_NOISE, productEditorialTextQuality, productEditorialQuality, automaticEditorialAssessment, valuePresent, productFieldValue, missingOnlyPatch, catalogProducts, productEditorialTarget, productEditorialFingerprint, productEditorialState, communicationNeedsReply, communicationFacts };
