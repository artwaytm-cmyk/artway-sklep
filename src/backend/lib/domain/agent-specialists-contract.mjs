import { SPECIALIST_PLAYBOOK_VERSION } from './agent-specialist-playbooks.mjs';

export const STATE_KEY = 'agent_specialists_state';
export const MAX_HISTORY = 240;
export const MAX_DECISIONS = 240;
export const MAX_DECISION_RECEIPTS = 2000;
export const MAX_WRITE_ATTEMPTS = 8;
export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  automaticEnabled: true,
  limitsEnabled: false,
  dailyLimit: 240,
  automaticDailyLimit: 80,
  automaticBatchSize: 3,
  automaticInputTokenLimit: 180_000,
  automaticOutputTokenLimit: 70_000,
  cacheHours: 72,
  safeAutoApply: true,
  autoApplyProductEditorial: true,
  autoUpdateLinkedAllegroContent: true,
  autoPrepareCustomerReplyDrafts: true,
  autoAuditCatalogIdentity: true,
  confidenceThreshold: 0.92,
  learningEnabled: true,
  approvalWarmupCount: 0,
  learnedAutoApplyThreshold: 0.86,
  decisionRetentionDays: 30,
});

export const PROMPT_VERSION = SPECIALIST_PLAYBOOK_VERSION;
export const PRODUCT_OUTPUT_TO_FIELD = Object.freeze({
  title: 'nazwa',
  short_description: 'opisKrotki',
  long_description: 'opis',
  seo_title: 'seoTitle',
  seo_description: 'seoDescription',
  seo_keywords: 'seoKeywords',
  allegro_title: 'allegroTitle',
  allegro_description: 'allegroDescription',
  von_halsky_title: 'vonHalskyTitle',
  von_halsky_short_description: 'vonHalskyShortDescription',
  von_halsky_description: 'vonHalskyDescription',
});

export const RESULT_SCHEMA = Object.freeze({
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
