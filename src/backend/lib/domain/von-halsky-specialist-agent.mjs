import { Agent, run as runAgent, tool } from '@openai/agents';
import { z } from 'zod';
import { vonHalskyCheckEditorial } from './von-halsky-compliance.mjs';
import {
  VON_HALSKY_AGENT_INSTRUCTIONS,
  VON_HALSKY_AGENT_VERSION,
  VON_HALSKY_DOCUMENTATION,
} from './von-halsky-agent-instructions.mjs';

const technicalSentinelPattern = /^(?:undefined|null|nan|infinity|\[object object\])$/i;
const technicalPayloadPattern = /"(?:title|content|value)"\s*:|^\s*```(?:json)?/i;

function clean(value = '', limit = 30_000) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, limit);
}

export function isVonHalskyTechnicalSentinel(value = '') {
  const normalized = clean(value, 30_000);
  return !normalized || technicalSentinelPattern.test(normalized) || technicalPayloadPattern.test(normalized);
}

function canonicalGtin(value = '') {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const payload = digits.slice(0, -1).split('').reverse();
  const sum = payload.reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1)) ? digits : null;
}

export function checkVonHalskyIdentity({
  ean = '',
  manufacturerCode = '',
  brand = '',
  producer = '',
} = {}) {
  const rawEan = clean(ean, 40);
  const gtin = canonicalGtin(rawEan);
  const code = clean(manufacturerCode, 160);
  const safeBrand = clean(brand, 160);
  const safeProducer = clean(producer, 160);
  const invalidEan = Boolean(rawEan && gtin === null);
  const hasNamedParty = /\p{L}/u.test(safeBrand || safeProducer);
  const method = gtin
    ? 'gtin'
    : code && hasNamedParty
      ? 'manufacturer_code_brand'
      : 'missing';
  return {
    ok: !invalidEan && method !== 'missing',
    method,
    gtin: gtin || '',
    manufacturerCode: code,
    brand: safeBrand,
    producer: safeProducer,
    issues: [
      ...(invalidEan ? ['EAN/GTIN ma nieprawidłową długość albo cyfrę kontrolną'] : []),
      ...(!invalidEan && method === 'missing' ? ['Wymagany jest poprawny EAN/GTIN albo kod producenta i nazwa marki/producenta'] : []),
    ],
    rule: 'exact-gtin-or-manufacturer-code-plus-named-brand',
  };
}

function validateEditorialOutput(output = {}) {
  const title = clean(output?.title?.value, 150);
  const shortDescription = clean(output?.shortDescription?.value, 1_200);
  const description = clean(output?.description?.value, 30_000);
  const sentinels = [
    ['nazwa', title],
    ['opis krótki', shortDescription],
    ['opis pełny', description],
  ].filter(([, value]) => isVonHalskyTechnicalSentinel(value)).map(([label]) => label);
  const compliance = vonHalskyCheckEditorial({
    vonHalskyTitle: title,
    vonHalskyShortDescription: shortDescription,
    vonHalskyDescription: description,
  });
  return {
    ok: sentinels.length === 0 && compliance.ok,
    title,
    shortDescription,
    description,
    sentinels,
    compliance,
  };
}

const EvidenceField = z.object({
  value: z.string().min(1).max(30_000),
  reason: z.string().min(1).max(700),
  evidence: z.string().min(1).max(700),
});

export const VonHalskyAgentResult = z.object({
  title: EvidenceField,
  shortDescription: EvidenceField,
  description: EvidenceField,
  factsUsed: z.array(z.string().min(1).max(500)).max(20),
  missingFacts: z.array(z.string().min(1).max(500)).max(20),
  warnings: z.array(z.string().min(1).max(500)).max(20),
  confidence: z.number().min(0).max(1),
  complianceStatus: z.enum(['ready', 'needs_review', 'blocked_missing_facts']),
});

const identityTool = tool({
  name: 'check_von_halsky_identity',
  description: 'Sprawdza bez zgadywania, czy tożsamość bieżącego produktu spełnia regułę EAN/GTIN albo kod producenta i nazwana marka/producent.',
  parameters: z.object({
    ean: z.string().max(40),
    manufacturerCode: z.string().max(160),
    brand: z.string().max(160),
    producer: z.string().max(160),
  }),
  execute: async (input) => checkVonHalskyIdentity(input),
});

const draftTool = tool({
  name: 'check_von_halsky_draft',
  description: 'Wykonuje deterministyczną kontrolę gotowej nazwy oraz obu opisów według polityki treści Von Halsky. Naruszenie musi zostać poprawione przed wynikiem końcowym.',
  parameters: z.object({
    title: z.string().min(1).max(150),
    shortDescription: z.string().min(1).max(1_200),
    description: z.string().min(1).max(30_000),
  }),
  execute: async ({ title, shortDescription, description }) => validateEditorialOutput({
    title: { value: title },
    shortDescription: { value: shortDescription },
    description: { value: description },
  }),
});

export function createVonHalskySpecialistAgent({
  model = 'gpt-5-nano',
  reasoning = 'low',
  maxOutputTokens = 2200,
} = {}) {
  return new Agent({
    name: 'Artway — Agent Kart Produktowych InPost Von Halsky',
    instructions: VON_HALSKY_AGENT_INSTRUCTIONS,
    model,
    modelSettings: {
      reasoning: { effort: reasoning },
      text: { verbosity: 'low' },
      maxTokens: Math.max(1200, Math.min(5000, Number(maxOutputTokens) || 2200)),
      store: false,
      retry: { maxRetries: 2 },
    },
    tools: [identityTool, draftTool],
    outputType: VonHalskyAgentResult,
  });
}

function dynamicFacts(input = '') {
  try {
    const parsed = JSON.parse(String(input || '{}'));
    return parsed?.fakty?.product && typeof parsed.fakty.product === 'object'
      ? parsed.fakty.product
      : {};
  } catch {
    return {};
  }
}

function currentChannelValue(product = {}, key = '') {
  const channel = product?.channelContent?.vonHalsky || {};
  if (key === 'title') return clean(channel.title || product.vonHalskyTitle || product.nazwa || product.name, 150);
  if (key === 'short') return clean(channel.shortDescription || product.vonHalskyShortDescription || product.opisKrotki, 1_200);
  return clean(channel.longDescription || product.vonHalskyDescription || product.opis, 30_000);
}

function sdkUsage(result = {}) {
  const usage = result?.runContext?.usage || {};
  const details = Array.isArray(usage.inputTokensDetails) ? usage.inputTokensDetails : [];
  return {
    input_tokens: Math.max(0, Number(usage.inputTokens) || 0),
    output_tokens: Math.max(0, Number(usage.outputTokens) || 0),
    total_tokens: Math.max(0, Number(usage.totalTokens) || 0),
    input_tokens_details: {
      cached_tokens: details.reduce((sum, item) => sum + Number(item?.cached_tokens || item?.cachedTokens || 0), 0),
    },
  };
}

function toolNames(result = {}) {
  return [...new Set((Array.isArray(result?.newItems) ? result.newItems : []).map((item) => (
    item?.rawItem?.name
    || item?.rawItem?.toolName
    || item?.tool?.name
    || item?.name
    || ''
  )).map((value) => clean(value, 120)).filter((value) => value.startsWith('check_von_halsky_')))];
}

function resultForGenericPipeline(output = {}, product = {}, identity = {}) {
  const checked = validateEditorialOutput(output);
  if (!checked.ok) {
    const issues = [
      ...checked.sentinels.map((field) => `${field}: techniczna albo pusta wartość`),
      ...checked.compliance.violations.map((item) => item.label),
    ];
    throw Object.assign(new Error(`Agent Von Halsky nie przeszedł bramki treści: ${issues.join(', ') || 'nieznany błąd'}.`), {
      code: 'von_halsky_agent_invalid_output',
      status: 502,
      details: { issues, policyId: checked.compliance.policyId },
    });
  }
  const missingFacts = [
    ...(Array.isArray(output.missingFacts) ? output.missingFacts : []),
    ...(identity.ok ? [] : identity.issues),
  ].map((item) => clean(item, 500)).filter(Boolean);
  const complianceStatus = missingFacts.length
    ? 'blocked_missing_facts'
    : output.complianceStatus === 'blocked_missing_facts'
      ? 'needs_review'
      : output.complianceStatus;
  return {
    title: checked.title,
    summary: checked.shortDescription,
    content: checked.description,
    fields: [
      {
        key: 'von_halsky_title',
        label: 'Nazwa Von Halsky',
        value: checked.title,
        current_value: currentChannelValue(product, 'title'),
        reason: clean(output.title.reason, 700),
        evidence: clean(output.title.evidence, 700),
      },
      {
        key: 'von_halsky_short_description',
        label: 'Opis krótki Von Halsky',
        value: checked.shortDescription,
        current_value: currentChannelValue(product, 'short'),
        reason: clean(output.shortDescription.reason, 700),
        evidence: clean(output.shortDescription.evidence, 700),
      },
      {
        key: 'von_halsky_description',
        label: 'Opis pełny Von Halsky',
        value: checked.description,
        current_value: currentChannelValue(product, 'long'),
        reason: clean(output.description.reason, 700),
        evidence: clean(output.description.evidence, 700),
      },
    ],
    suggestions: [],
    warnings: (Array.isArray(output.warnings) ? output.warnings : []).map((item) => clean(item, 500)).filter(Boolean),
    missingFacts,
    factsUsed: (Array.isArray(output.factsUsed) ? output.factsUsed : []).map((item) => clean(item, 500)).filter(Boolean),
    confidence: Math.max(0, Math.min(1, Number(output.confidence) || 0)),
    readyForApproval: checked.ok && missingFacts.length === 0 && complianceStatus === 'ready',
    complianceStatus,
  };
}

export async function requestVonHalskyAgentResponse({
  model = 'gpt-5-nano',
  qualityFallbackModel = 'gpt-5.4-nano',
  reasoning = 'low',
  maxOutputTokens = 2200,
  input = '',
  runImpl = runAgent,
} = {}) {
  const product = dynamicFacts(input);
  const identity = checkVonHalskyIdentity({
    ean: product.ean || product.gtin,
    manufacturerCode: product.producerCode || product.manufacturerCode || product.kodProducenta || product.mpn,
    brand: product.brand || product.marka,
    producer: product.producer || product.producent,
  });
  const attempts = [...new Set([clean(model, 100) || 'gpt-5-nano', clean(qualityFallbackModel, 100)].filter(Boolean))];
  let lastError = null;
  for (let index = 0; index < attempts.length; index += 1) {
    const selectedModel = attempts[index];
    try {
      const agent = createVonHalskySpecialistAgent({ model: selectedModel, reasoning, maxOutputTokens });
      const repair = index === 0 ? '' : '\nPOPRAW POPRZEDNI BŁĄD: poprzedni wynik nie przeszedł bramki. Zwróć kompletne trzy pola, bez wartości technicznych, po użyciu obu narzędzi.';
      const result = await runImpl(agent, `${String(input || '')}${repair}`, {
        workflowName: 'Artway — przygotowanie kart Von Halsky',
        groupId: clean(product.id || product.productId || product.externalId, 120) || undefined,
        traceMetadata: {
          project: 'artway-sklep',
          specialist: 'von_halsky_offer',
          rules_version: VON_HALSKY_AGENT_VERSION,
          product_id: clean(product.id || product.productId, 120),
        },
        traceIncludeSensitiveData: false,
        maxTurns: 6,
      });
      if (!result?.finalOutput) throw Object.assign(new Error('Agent Von Halsky nie zwrócił wyniku strukturalnego.'), { code: 'von_halsky_agent_empty_result', status: 502 });
      const generic = resultForGenericPipeline(result.finalOutput, product, identity);
      const payload = {
        id: clean(result.lastResponseId, 120),
        model: selectedModel,
        output_text: JSON.stringify(generic),
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(generic) }] }],
        usage: sdkUsage(result),
      };
      return {
        response: new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }),
        payload,
        qualityFallback: index > 0,
        promptApplied: false,
        promptFallback: false,
        promptCacheEnabled: false,
        promptCacheMode: 'agents-sdk',
        agentRuntime: {
          sdk: '@openai/agents',
          workflow: 'artway-von-halsky-product-card',
          agent: agent.name,
          rulesVersion: VON_HALSKY_AGENT_VERSION,
          tools: ['check_von_halsky_identity', 'check_von_halsky_draft'],
          toolsObserved: toolNames(result),
          output: 'zod-structured',
          documentation: VON_HALSKY_DOCUMENTATION,
          deterministicValidation: true,
        },
      };
    } catch (error) {
      lastError = error;
      if (index + 1 >= attempts.length) break;
    }
  }
  throw lastError || Object.assign(new Error('Agent Von Halsky nie zakończył zadania.'), { code: 'von_halsky_agent_failed', status: 502 });
}
