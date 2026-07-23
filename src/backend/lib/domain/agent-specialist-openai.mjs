function clean(value = '', limit = 500) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, limit);
}

function safeError(value = '') {
  return clean(value, 500)
    .replace(/\b(?:sk|sk-proj|sk-ant)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{10,}=*/gi, 'Bearer [ukryty]');
}

export function createPlatformPromptProfile(definition, { enabled = true, apiKey = '' } = {}) {
  const id = clean(definition?.platformPrompt?.id, 120), version = clean(definition?.platformPrompt?.version, 40);
  if (!enabled || !id || !version || !clean(apiKey, 500)) return null;
  return { id, version, name: clean(definition?.label, 180), model: 'gpt-5-nano', available: true };
}

function promptReferenceFailure(response, payload) {
  if (![400, 404, 409, 422].includes(Number(response?.status))) return false;
  const message = `${payload?.error?.code || ''} ${payload?.error?.param || ''} ${payload?.error?.message || ''}`.toLowerCase();
  return /prompt|pmpt_|version/.test(message);
}

export async function requestSpecialistResponse({ fetchImpl, apiKey, model, promptProfile, instructions, input, resultSchema }) {
  const common = {
    store: false, reasoning: { effort: 'minimal' }, max_output_tokens: 3600, instructions, input,
    text: { format: { type: 'json_schema', name: 'artway_specialist_result', strict: true, schema: resultSchema } },
  };
  const call = async (usePrompt) => {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(usePrompt ? { ...common, prompt: { id: promptProfile.id, version: promptProfile.version } } : { ...common, model }),
      signal: AbortSignal.timeout(90_000),
    });
    return { response, payload: await response.json().catch(() => ({})) };
  };
  const primary = await call(!!promptProfile);
  if (primary.response.ok || !promptProfile || !promptReferenceFailure(primary.response, primary.payload)) {
    return { ...primary, promptApplied: !!promptProfile, promptFallback: false };
  }
  const fallback = await call(false);
  return {
    ...fallback, promptApplied: false, promptFallback: true,
    promptError: safeError(primary.payload?.error?.message || 'Profil promptu OpenAI jest chwilowo niedostępny.'),
  };
}
