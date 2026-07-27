const MODEL_DEFAULTS = Object.freeze({
  professionalEscalation: 'gpt-5.4',
  standard: 'gpt-5.4-mini',
  economical: 'gpt-5.4-nano',
});

const BALANCED_SPECIALISTS = new Set([
  'product_content',
  'store_compliance',
  'allegro_offer',
  'allegro_compliance',
  'allegro_publication',
  'von_halsky_offer',
  'von_halsky_compliance',
  'customer_reply',
  'operations_supervisor',
]);

const MEDIUM_REASONING_SPECIALISTS = new Set(['product_content', 'allegro_compliance', 'catalog_quality']);

const OUTPUT_TOKEN_BUDGETS = Object.freeze({
  product_content: 2600,
  store_compliance: 2400,
  allegro_offer: 2400,
  allegro_compliance: 2200,
  allegro_publication: 1500,
  von_halsky_offer: 2400,
  von_halsky_compliance: 2200,
  customer_reply: 1200,
  seo_promotion: 1400,
  campaign_copy: 1400,
  banner_copy: 1200,
  supplier_message: 1000,
  catalog_quality: 1500,
  operations_supervisor: 1300,
});

export const OPENAI_MODEL_PRICE_SNAPSHOT = Object.freeze({
  date: '2026-07-26',
  currency: 'USD',
  unit: '1M tokens',
  models: Object.freeze({
    'gpt-5.4': Object.freeze({ input: 2.5, cachedInput: 0.25, cacheWrite: 2.5, output: 15 }),
    'gpt-5.4-mini': Object.freeze({ input: 0.75, cachedInput: 0.075, cacheWrite: 0.75, output: 4.5 }),
    'gpt-5.4-nano': Object.freeze({ input: 0.2, cachedInput: 0.02, cacheWrite: 0.2, output: 1.25 }),
    'gpt-5.6-sol': Object.freeze({ input: 5, cachedInput: 0.5, cacheWrite: 6.25, output: 30 }),
    'gpt-5.6-terra': Object.freeze({ input: 2.5, cachedInput: 0.25, cacheWrite: 3.125, output: 15 }),
    'gpt-5.6-luna': Object.freeze({ input: 1, cachedInput: 0.1, cacheWrite: 1.25, output: 6 }),
  }),
});

function clean(value = '', limit = 100) {
  return String(value || '').trim().slice(0, limit);
}

export function specialistModelPolicy(specialist = '', { override = '', env = process.env, escalation = false } = {}) {
  const forced = clean(override);
  if (forced) return {
    model: forced,
    tier: 'override',
    reasoning: 'low',
    maxOutputTokens: OUTPUT_TOKEN_BUDGETS[specialist] || 1400,
    escalation: false,
  };
  const strongest = clean(env.OPENAI_MODEL_ESCALATION) || MODEL_DEFAULTS.professionalEscalation;
  const balanced = clean(env.OPENAI_MODEL_STANDARD) || MODEL_DEFAULTS.standard;
  const efficient = clean(env.OPENAI_MODEL_ECONOMY) || MODEL_DEFAULTS.economical;
  if (escalation === true) {
    return {
      model: strongest,
      tier: 'professional-escalation',
      reasoning: 'high',
      maxOutputTokens: Math.max(1600, OUTPUT_TOKEN_BUDGETS[specialist] || 1600),
      escalation: true,
    };
  }
  if (BALANCED_SPECIALISTS.has(specialist)) {
    return {
      model: balanced,
      tier: 'standard',
      reasoning: MEDIUM_REASONING_SPECIALISTS.has(specialist) ? 'medium' : 'low',
      maxOutputTokens: OUTPUT_TOKEN_BUDGETS[specialist] || 1400,
      escalation: false,
    };
  }
  return {
    model: efficient,
    tier: 'economical',
    reasoning: MEDIUM_REASONING_SPECIALISTS.has(specialist) ? 'medium' : 'low',
    maxOutputTokens: OUTPUT_TOKEN_BUDGETS[specialist] || 1400,
    escalation: false,
  };
}

export function diagnosticsModelPolicy(env = process.env, { escalation = false } = {}) {
  if (escalation) {
    return {
      model: clean(env.OPENAI_DIAGNOSTICS_ESCALATION_MODEL) || clean(env.OPENAI_MODEL_ESCALATION) || MODEL_DEFAULTS.professionalEscalation,
      tier: 'professional-escalation',
      reasoning: 'high',
      mode: clean(env.OPENAI_DIAGNOSTICS_MODE) === 'pro' ? 'pro' : 'standard',
      maxOutputTokens: 2200,
      escalation: true,
    };
  }
  return {
    model: clean(env.OPENAI_DIAGNOSTICS_ROUTINE_MODEL) || clean(env.OPENAI_MODEL_STANDARD) || MODEL_DEFAULTS.standard,
    tier: 'standard-routine',
    reasoning: 'low',
    mode: 'standard',
    maxOutputTokens: 1400,
    escalation: false,
  };
}

export function modelPolicySummary({ override = '', env = process.env } = {}) {
  return {
    diagnosticsRoutine: diagnosticsModelPolicy(env),
    diagnosticsEscalation: diagnosticsModelPolicy(env, { escalation: true }),
    strongestEscalation: specialistModelPolicy('allegro_publication', { override, env, escalation: true }),
    balanced: specialistModelPolicy('allegro_publication', { override, env }),
    efficient: specialistModelPolicy('seo_promotion', { override, env }),
    policy: 'gpt-5.4-nano-routine-mini-complex-gpt-5.4-escalation',
    pricing: OPENAI_MODEL_PRICE_SNAPSHOT,
  };
}

export function estimateModelUsageCost(model = '', usage = {}) {
  const price = OPENAI_MODEL_PRICE_SNAPSHOT.models[clean(model, 100)];
  if (!price) return 0;
  const input = Math.max(0, Number(usage.inputTokens) || 0);
  const cached = Math.min(input, Math.max(0, Number(usage.cachedTokens) || 0));
  const cacheWrite = Math.min(input - cached, Math.max(0, Number(usage.cacheWriteTokens) || 0));
  const uncached = Math.max(0, input - cached - cacheWrite);
  const output = Math.max(0, Number(usage.outputTokens) || 0);
  return (uncached * price.input + cached * price.cachedInput + cacheWrite * price.cacheWrite + output * price.output) / 1_000_000;
}
