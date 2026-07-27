function clean(value = '', limit = 500) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, limit);
}

function safeError(value = '') {
  return clean(value, 500)
    .replace(/\b(?:sk|sk-proj|sk-ant)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{10,}=*/gi, 'Bearer [ukryty]');
}

export function createPlatformPromptProfile(definition, { enabled = true, apiKey = '', model = '' } = {}) {
  const id = clean(definition?.platformPrompt?.id, 120), version = clean(definition?.platformPrompt?.version, 40);
  if (!enabled || !id || !version || !clean(apiKey, 500)) return null;
  return { id, version, name: clean(definition?.label, 180), model: clean(model, 100), available: true };
}

function promptReferenceFailure(response, payload) {
  if (![400, 404, 409, 422].includes(Number(response?.status))) return false;
  const message = `${payload?.error?.code || ''} ${payload?.error?.param || ''} ${payload?.error?.message || ''}`.toLowerCase();
  return /prompt|pmpt_|version/.test(message);
}

function cacheConfigurationFailure(response, payload) {
  if (![400, 422].includes(Number(response?.status))) return false;
  const message = `${payload?.error?.code || ''} ${payload?.error?.param || ''} ${payload?.error?.message || ''}`.toLowerCase();
  return /prompt_cache|cache.breakpoint|cache breakpoint/.test(message);
}

function supportsExplicitPromptCache(model = '') {
  return /^gpt-5\.(?:[6-9]|\d{2,})(?:-|$)/i.test(clean(model, 100));
}

function supportsAutomaticPromptCache(model = '') {
  return /^gpt-5(?:\.|$|-)/i.test(clean(model, 100));
}

function cachedInput(staticInstructions = '', input = '') {
  return [
    {
      role: 'developer',
      content: [{
        type: 'input_text',
        text: String(staticInstructions || ''),
        prompt_cache_breakpoint: { mode: 'explicit' },
      }],
    },
    {
      role: 'user',
      content: [{ type: 'input_text', text: String(input || '') }],
    },
  ];
}

function structuredOutputReady(payload = {}) {
  const parts = (Array.isArray(payload.output) ? payload.output : []).flatMap((item) => Array.isArray(item?.content) ? item.content : []);
  if (parts.some((part) => part?.type === 'refusal')) return true;
  const value = parts.find((part) => part?.type === 'output_text' && String(part?.text || '').trim())?.text || payload.output_text;
  if (!String(value || '').trim()) return false;
  try { return !!JSON.parse(String(value)); } catch { return false; }
}

export async function requestSpecialistResponse({
  fetchImpl,
  apiKey,
  model,
  reasoning = 'low',
  maxOutputTokens = 1600,
  promptCacheKey = '',
  promptProfile,
  instructions,
  input,
  resultSchema,
}) {
  const useAutomaticCache = supportsAutomaticPromptCache(model);
  const useExplicitCache = supportsExplicitPromptCache(model) && clean(promptCacheKey, 200);
  const common = {
    store: false,
    model,
    reasoning: { effort: reasoning },
    max_output_tokens: Math.max(700, Math.min(3600, Number(maxOutputTokens) || 1600)),
    ...(useExplicitCache ? {
      input: cachedInput(instructions, input),
      prompt_cache_key: clean(promptCacheKey, 200),
      prompt_cache_options: { mode: 'explicit', ttl: '30m' },
    } : { instructions, input }),
    text: { format: { type: 'json_schema', name: 'artway_specialist_result', strict: true, schema: resultSchema } },
  };
  const call = async (usePrompt, useCache = useExplicitCache, overrides = {}) => {
    const body = {
      ...common,
      ...(!useCache && useExplicitCache ? {
        input,
        instructions,
        prompt_cache_key: undefined,
        prompt_cache_options: undefined,
      } : {}),
      ...overrides,
      ...(usePrompt ? { prompt: { id: promptProfile.id, version: promptProfile.version } } : {}),
    };
    Object.keys(body).forEach((key) => body[key] === undefined && delete body[key]);
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    return { response, payload: await response.json().catch(() => ({})) };
  };
  let primary = await call(!!promptProfile);
  let cacheFallback = false;
  if (!primary.response.ok && useExplicitCache && cacheConfigurationFailure(primary.response, primary.payload)) {
    primary = await call(!!promptProfile, false);
    cacheFallback = true;
  }
  let selected = primary, promptApplied = !!promptProfile, promptFallback = false, promptError = '', outputRetry = false;
  if (!primary.response.ok && promptProfile && promptReferenceFailure(primary.response, primary.payload)) {
    selected = await call(false, !cacheFallback);
    promptApplied = false;
    promptFallback = true;
    promptError = safeError(primary.payload?.error?.message || 'Profil promptu OpenAI jest chwilowo niedostępny.');
  }
  if (selected.response.ok && !structuredOutputReady(selected.payload)) {
    // Odpowiedź 200 może być niepełna (np. model zużył budżet na rozumowanie)
    // albo opublikowany prompt może zwrócić tekst poza ścisłym JSON-em.
    // Jedna kontrolowana próba korzysta z reguł serwera, niskiego rozumowania
    // i większego budżetu wyniku; nie zapisujemy wadliwej odpowiedzi.
    selected = await call(false, false, { reasoning: { effort: 'low' }, max_output_tokens: 3600 });
    promptApplied = false;
    promptFallback = !!promptProfile;
    outputRetry = true;
    promptError ||= 'Pierwsza odpowiedź nie zawierała kompletnego wyniku strukturalnego; użyto bezpiecznej ponownej próby.';
  }
  return {
    ...selected, promptApplied, promptFallback, outputRetry,
    promptCacheEnabled: useAutomaticCache,
    promptCacheMode: useExplicitCache && !cacheFallback ? 'explicit' : 'automatic',
    promptCacheFallback: cacheFallback,
    promptError,
  };
}
