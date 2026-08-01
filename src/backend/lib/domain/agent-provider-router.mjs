const DEFAULT_TIMEOUT_MS = 45_000;
const HEALTH_TTL_MS = 15 * 60_000;

function clean(value = '', limit = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, limit);
}

function safeError(value = '') {
  return clean(value, 300)
    .replace(/\b(?:sk|sk-proj|sk-ant|xai)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{10,}=*/gi, 'Bearer [ukryty]');
}

function parseOrder(value = '') {
  const allowed = new Set(['openai', 'anthropic', 'xai']);
  const parsed = String(value || 'openai,anthropic,xai').split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item, index, all) => allowed.has(item) && all.indexOf(item) === index);
  return parsed.length ? parsed : ['openai', 'anthropic', 'xai'];
}

function outputText(data = {}) {
  if (typeof data.output_text === 'string') return data.output_text.trim();
  const responseText = (Array.isArray(data.output) ? data.output : [])
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .find((item) => item?.type === 'output_text')?.text;
  if (responseText) return String(responseText).trim();
  const anthropicText = (Array.isArray(data.content) ? data.content : [])
    .filter((item) => item?.type === 'text').map((item) => item.text).join('\n');
  if (anthropicText) return anthropicText.trim();
  return clean(data?.choices?.[0]?.message?.content || '', 60_000);
}

function usageDay(now) {
  return now().toISOString().slice(0, 10);
}

export function createAgentProviderRouter({ env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  const configs = {
    openai: {
      key: clean(env.OPENAI_API_KEY, 500),
      model: clean(env.OPENAI_AGENT_MODEL_OVERRIDE || env.OPENAI_MODEL || 'gpt-5.4-nano', 100),
      healthUrl: 'https://api.openai.com/v1/models',
    },
    anthropic: {
      key: clean(env.ANTHROPIC_API_KEY, 500),
      model: clean(env.ANTHROPIC_MODEL || 'claude-haiku-4-5', 100),
      healthUrl: 'https://api.anthropic.com/v1/models?limit=1',
    },
    xai: {
      key: clean(env.XAI_API_KEY, 500),
      model: clean(env.XAI_MODEL || 'grok-4.20-0309-non-reasoning', 100),
      healthUrl: 'https://api.x.ai/v1/models',
      enabled: env.XAI_ENABLED !== 'false',
      dailyRequestLimit: Math.max(0, Number(env.XAI_DAILY_REQUEST_LIMIT) || 30),
    },
  };
  const order = parseOrder(env.AI_PROVIDER_ORDER);
  const states = Object.fromEntries(Object.entries(configs).map(([id, config]) => [id, {
    configured: Boolean(config.key), connected: false, enabled: config.enabled !== false,
    model: config.model, lastCheckedAt: '', lastSuccessAt: '', error: '', requestsToday: 0,
    dailyRequestLimit: id === 'xai' ? config.dailyRequestLimit : 0,
    remainingToday: id === 'xai' ? config.dailyRequestLimit : 0,
    limitReached: false, usageDay: usageDay(now), usageMode: id === 'xai' ? 'paid-api-with-daily-guard' : 'metered-api', freeOnly: false,
  }]));
  let cursor = 0;

  function refreshDay(id) {
    const day = usageDay(now), state = states[id];
    if (state.usageDay !== day) {
      state.usageDay = day;
      state.requestsToday = 0;
    }
    if (id === 'xai') {
      state.remainingToday = Math.max(0, state.dailyRequestLimit - state.requestsToday);
      state.limitReached = state.dailyRequestLimit > 0 && state.remainingToday <= 0;
    }
  }

  function publicState(id) {
    refreshDay(id);
    return { ...states[id] };
  }

  function headers(id) {
    const config = configs[id];
    if (id === 'anthropic') return { 'x-api-key': config.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
    return { authorization: `Bearer ${config.key}`, 'content-type': 'application/json' };
  }

  async function request(id, url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(safeError(data?.error?.message || data?.message || `${id} HTTP ${response.status}`));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function probeOne(id, { force = false } = {}) {
    const config = configs[id], state = states[id], checked = Date.parse(state.lastCheckedAt || '') || 0;
    refreshDay(id);
    if (!state.enabled || !state.configured || state.limitReached) return publicState(id);
    if (!force && checked && now().getTime() - checked < HEALTH_TTL_MS) return publicState(id);
    state.lastCheckedAt = now().toISOString();
    try {
      await request(id, config.healthUrl, { method: 'GET', headers: headers(id) }, 15_000);
      state.connected = true;
      state.lastSuccessAt = state.lastCheckedAt;
      state.error = '';
    } catch (error) {
      state.connected = false;
      state.error = safeError(error);
    }
    return publicState(id);
  }

  async function status({ force = false } = {}) {
    await Promise.all(order.map((id) => probeOne(id, { force })));
    return {
      codex: { configured: true, connected: true, enabled: true, model: 'Codex', usageMode: 'coordinator' },
      openai: publicState('openai'), anthropic: publicState('anthropic'), xai: publicState('xai'),
    };
  }

  async function invoke(id, { input, instructions, maxOutputTokens = 900 } = {}) {
    const config = configs[id], state = states[id];
    refreshDay(id);
    if (!state.enabled || !state.configured || state.limitReached) throw new Error(`${id}: dostawca niedostępny`);
    state.lastCheckedAt = now().toISOString();
    state.requestsToday += 1;
    try {
      let data;
      if (id === 'openai') {
        data = await request(id, 'https://api.openai.com/v1/responses', {
          method: 'POST', headers: headers(id), body: JSON.stringify({ model: config.model, store: false, max_output_tokens: maxOutputTokens, instructions, input }),
        });
      } else if (id === 'anthropic') {
        data = await request(id, 'https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: headers(id), body: JSON.stringify({ model: config.model, max_tokens: maxOutputTokens, temperature: 0, system: instructions, messages: [{ role: 'user', content: input }] }),
        });
      } else {
        data = await request(id, 'https://api.x.ai/v1/chat/completions', {
          method: 'POST', headers: headers(id), body: JSON.stringify({ model: config.model, temperature: 0, max_tokens: maxOutputTokens, messages: [{ role: 'system', content: instructions }, { role: 'user', content: input }] }),
        });
      }
      const text = outputText(data);
      if (!text) throw new Error(`${id}: pusta odpowiedź modelu`);
      state.connected = true;
      state.lastSuccessAt = now().toISOString();
      state.error = '';
      refreshDay(id);
      return { text, provider: id, model: config.model };
    } catch (error) {
      state.connected = false;
      state.error = safeError(error);
      refreshDay(id);
      throw error;
    }
  }

  async function answer(payload = {}) {
    const candidates = order.map((_, index) => order[(cursor + index) % order.length]);
    cursor = (cursor + 1) % order.length;
    const errors = [];
    for (const id of candidates) {
      const state = await probeOne(id);
      if (!state.connected) {
        if (state.error) errors.push(`${id}: ${state.error}`);
        continue;
      }
      try {
        return await invoke(id, payload);
      } catch (error) {
        errors.push(`${id}: ${safeError(error)}`);
      }
    }
    const error = new Error(errors.join(' • ') || 'Brak dostępnego zewnętrznego dostawcy AI.');
    error.code = 'agent_providers_unavailable';
    throw error;
  }

  return Object.freeze({ answer, status });
}
