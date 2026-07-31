import crypto from 'node:crypto';

const STATE_KEY = 'openai_platform_state';
const STATUS_CACHE_MS = 15 * 60_000;
const ACTIVE_BATCH = new Set(['validating', 'in_progress', 'finalizing', 'cancelling']);
const DIAGNOSTIC_CASES = Object.freeze([
  {
    id: 'settings-revision-loop',
    input: { level: 'blad', message: 'Domena ustawień jest zapisywana równolegle ze starą rewizją i zapis wraca do kolejki.', count: 18 },
    expected: 'data_conflict',
  },
  {
    id: 'stale-browser-release',
    input: { level: 'blad', message: 'Przeglądarka uruchomiła starszy plik JavaScript i zgłosiła SyntaxError po nowym wydaniu.', source: 'browser' },
    expected: 'stale_client',
  },
  {
    id: 'external-api-auth',
    input: { level: 'blad', message: 'Zewnętrzne API przewoźnika zwróciło HTTP 401.', source: 'integration' },
    expected: 'external_integration',
  },
]);

const EVAL_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['classification', 'reason'],
  properties: {
    classification: { type: 'string', enum: ['application_bug', 'data_conflict', 'external_integration', 'stale_client', 'configuration', 'performance', 'unknown'] },
    reason: { type: 'string' },
  },
});

function clean(value = '', limit = 500) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, limit);
}

function safeError(value = '') {
  return clean(value, 700)
    .replace(/\b(?:sk|sk-proj)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{10,}=*/gi, 'Bearer [ukryty]');
}

function dayInPoland(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function baseState(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    connection: source.connection && typeof source.connection === 'object' ? source.connection : {},
    batches: Array.isArray(source.batches) ? source.batches.slice(0, 30) : [],
    lastDailyBatchDay: clean(source.lastDailyBatchDay, 20),
    updatedAt: clean(source.updatedAt, 40),
  };
}

function responseOutputText(body = {}) {
  if (typeof body.output_text === 'string') return body.output_text;
  return (Array.isArray(body.output) ? body.output : [])
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .map((item) => item?.text || item?.value || '')
    .filter(Boolean)
    .join('\n');
}

function evaluationRequest(testCase, model) {
  return {
    custom_id: testCase.id,
    method: 'POST',
    url: '/v1/responses',
    body: {
      model,
      store: false,
      reasoning: { effort: 'low' },
      max_output_tokens: 320,
      instructions: [
        'Jesteś kontrolerem diagnostyki systemu sklepu Artway-TM.',
        'Klasyfikuj wyłącznie na podstawie przekazanych faktów.',
        'Nie twierdź, że problem naprawiono. Zwróć krótki, techniczny powód.',
      ].join(' '),
      input: JSON.stringify(testCase.input),
      text: { format: { type: 'json_schema', name: 'artway_diagnostic_eval', strict: true, schema: EVAL_SCHEMA } },
    },
  };
}

function scoreBatchContent(content = '') {
  const expected = new Map(DIAGNOSTIC_CASES.map((item) => [item.id, item.expected]));
  const items = String(content || '').split(/\r?\n/).filter(Boolean).map((line) => {
    try {
      const row = JSON.parse(line), id = clean(row.custom_id, 120), body = row?.response?.body || {};
      const output = JSON.parse(responseOutputText(body) || '{}');
      const classification = clean(output.classification, 80);
      return { id, expected: expected.get(id) || '', classification, passed: expected.get(id) === classification, status: Number(row?.response?.status_code || 0) };
    } catch {
      return { id: '', expected: '', classification: '', passed: false, status: 0 };
    }
  });
  return { total: items.length, passed: items.filter((item) => item.passed).length, failed: items.filter((item) => !item.passed).length, items };
}

export function createOpenAiPlatformControl({
  read,
  write,
  fetchImpl = globalThis.fetch,
  apiKey = process.env.OPENAI_API_KEY,
  now = () => new Date(),
  diagnosticModel = process.env.OPENAI_DIAGNOSTICS_ESCALATION_MODEL || process.env.OPENAI_MODEL_ESCALATION || 'gpt-5.6-luna',
  balancedModel = process.env.OPENAI_MODEL_STANDARD || 'gpt-5.4-nano',
  efficientModel = process.env.OPENAI_MODEL_ECONOMY || 'gpt-5.4-nano',
  imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
  audioModel = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
  localFallbackEnabled = process.env.OLLAMA_FALLBACK_ENABLED !== 'false',
  localFallbackModel = process.env.OLLAMA_FALLBACK_MODEL || 'qwen3.5:4b',
  localBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
} = {}) {
  if (typeof read !== 'function' || typeof write !== 'function') throw new Error('Kontrola OpenAI Platform wymaga repozytorium.');
  if (typeof fetchImpl !== 'function') throw new Error('Kontrola OpenAI Platform wymaga klienta HTTP.');

  async function api(path, options = {}) {
    if (!clean(apiKey, 500)) throw Object.assign(new Error('Brakuje obecnego klucza OpenAI.'), { code: 'openai_not_configured', status: 503 });
    const response = await fetchImpl(`https://api.openai.com${path}`, {
      ...options,
      headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json', ...(options.headers || {}) },
      signal: options.signal || AbortSignal.timeout(30_000),
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('json') ? await response.json().catch(() => ({})) : await response.text();
    if (!response.ok) {
      const error = new Error(safeError(payload?.error?.message || payload?.message || payload || `OpenAI HTTP ${response.status}`));
      error.code = clean(payload?.error?.code || 'openai_platform_error', 100);
      error.status = response.status >= 400 && response.status < 500 ? 422 : 502;
      throw error;
    }
    return payload;
  }

  async function save(mutator) {
    const previous = baseState(await read(STATE_KEY, {})), next = baseState(await mutator(previous));
    next.updatedAt = now().toISOString();
    await write(STATE_KEY, next);
    return next;
  }

  async function connection(force = false) {
    const state = baseState(await read(STATE_KEY, {})), checked = Date.parse(state.connection?.checkedAt || '');
    if (!force && Number.isFinite(checked) && now().getTime() - checked < STATUS_CACHE_MS) return state.connection;
    const endpoints = [
      ['models', '/v1/models?limit=1'],
      ['batches', '/v1/batches?limit=1'],
      ['evals', '/v1/evals?limit=1'],
      ['fineTuning', '/v1/fine_tuning/jobs?limit=1'],
    ];
    const results = await Promise.all(endpoints.map(async ([name, path]) => {
      try { await api(path); return [name, { available: true, status: 200 }]; }
      catch (error) { return [name, { available: false, status: Number(error.status || 0), error: safeError(error.message) }]; }
    }));
    let local = { enabled: localFallbackEnabled === true, available: false, model: clean(localFallbackModel, 100), status: 0 };
    if (local.enabled) {
      try {
        const response = await fetchImpl(`${String(localBaseUrl).replace(/\/+$/, '')}/api/tags`, { signal: AbortSignal.timeout(5_000) });
        const payload = await response.json().catch(() => ({}));
        const models = Array.isArray(payload?.models) ? payload.models.map((item) => clean(item?.name || item?.model, 120)) : [];
        local = { ...local, available: response.ok && models.some((name) => name === local.model || name.startsWith(`${local.model}:`)), status: response.status, installedModels: models.slice(0, 20) };
      } catch (error) {
        local = { ...local, error: safeError(error?.message || error) };
      }
    }
    const value = { configured: !!clean(apiKey, 500), connected: results.some(([, item]) => item.available), checkedAt: now().toISOString(), endpoints: Object.fromEntries(results), local };
    await save((current) => ({ ...current, connection: value }));
    return value;
  }

  function capabilities(conn = {}) {
    const endpoint = (key) => conn.endpoints?.[key]?.available === true;
    return [
      { id: 'responses', label: 'Odpowiedzi i instrukcje kodowe', state: endpoint('models') ? 'active' : 'error', detail: `${diagnosticModel} / ${balancedModel} / ${efficientModel}` },
      { id: 'ui', label: 'Interfejs aplikacji', state: 'active', detail: 'własny panel administratora + Responses API' },
      { id: 'agents', label: 'Agents SDK', state: endpoint('models') ? 'active' : 'error', detail: '@openai/agents • nazwane trace wszystkich specjalistów, diagnostyka i bramki zatwierdzeń' },
      { id: 'realtime', label: 'Audio w czasie rzeczywistym', state: 'available', detail: 'nieaktywne celowo • głosówki są plikami, więc tańsza jest transkrypcja żądaniowa' },
      { id: 'audio', label: 'Transkrypcja audio', state: endpoint('models') ? 'available' : 'error', detail: `${audioModel} • funkcja dostępna dla przyszłych narzędzi panelu` },
      { id: 'images', label: 'Obrazy', state: endpoint('models') ? 'active' : 'error', detail: `${imageModel} • bannery i ikony` },
      { id: 'logs', label: 'Dzienniki i trace', state: endpoint('models') ? 'active' : 'error', detail: 'platform.openai.com/traces • role, handoff i odpowiedzi bez treści produktów oraz sekretów' },
      { id: 'batches', label: 'Partie', state: endpoint('batches') ? 'active' : 'error', detail: 'dobowa ewaluacja asynchroniczna' },
      { id: 'evals', label: 'Ewaluacje legacy', state: endpoint('evals') ? 'available' : 'unavailable', detail: 'nie są zależnością wykonawczą; regresje działają lokalnie i przez Batch' },
      { id: 'fineTuning', label: 'Dostrajanie', state: endpoint('fineTuning') ? 'available' : 'unavailable', detail: 'tylko po ewaluacji i z zatwierdzonych przykładów' },
      { id: 'modelUpgrade', label: 'Kontrolowany routing modeli', state: 'active', detail: 'GPT-5.4 nano jako model podstawowy • GPT-5.6 Luna tylko po niepoprawnym wyniku • lokalny fallback bez opłat' },
      { id: 'optimization', label: 'Optymalizacja API', state: 'active', detail: 'cache promptów, limity wyniku, fingerprinty i Batch -50%' },
      { id: 'migration', label: 'Responses + Agents SDK', state: 'active', detail: 'Responses dla deterministycznych ról; SDK dla pętli narzędziowej i trace' },
      { id: 'usage', label: 'Stosowanie', state: 'active', detail: 'lokalne tokeny, limity dzienne i historia uruchomień' },
      { id: 'apiKey', label: 'Klucz API', state: clean(apiKey, 500) ? 'active' : 'error', detail: clean(apiKey, 500) ? 'jeden obecny klucz serwerowy' : 'brak konfiguracji' },
      { id: 'localFallback', label: 'Bezpłatny tryb awaryjny', state: conn.local?.available ? 'active' : conn.local?.enabled ? 'error' : 'unavailable', detail: `${localFallbackModel} • lokalny Ollama • bez opłat za tokeny` },
    ];
  }

  async function status({ force = false } = {}) {
    const conn = await connection(force), state = baseState(await read(STATE_KEY, {}));
    return {
      configured: !!clean(apiKey, 500),
      connected: conn.connected === true,
      keyMode: 'existing-server-key',
      models: {
        diagnosticRoutine: balancedModel,
        diagnosticEscalation: diagnosticModel,
        balanced: balancedModel,
        efficient: efficientModel,
        image: imageModel,
        audio: audioModel,
        localFallback: localFallbackModel,
      },
      capabilities: capabilities(conn),
      connection: conn,
      batches: state.batches.slice(0, 10),
      policy: {
        batchEvaluation: 'daily',
        batchModel: efficientModel,
        batchReasoning: 'low',
        realtimeAudio: 'available-not-used-file-transcription-is-cheaper',
        traceSensitiveData: false,
        fineTuning: 'evals-first-approved-dataset-only',
        deprecatedEvalsDependency: false,
        deprecatedPromptObjectsDependency: false,
        agentVisibility: 'platform-traces',
        localFallback: conn.local || { enabled: false, available: false },
      },
      updatedAt: state.updatedAt || conn.checkedAt || null,
    };
  }

  async function launchEvaluationBatch({ force = false } = {}) {
    const current = baseState(await read(STATE_KEY, {})), today = dayInPoland(now());
    const sameDay = current.batches.find((item) => item.day === today && !['failed', 'cancelled', 'expired'].includes(item.status));
    if (!force && (sameDay || current.lastDailyBatchDay === today)) return { skipped: true, reason: 'already_scheduled', batch: sameDay || null };
    const entries = DIAGNOSTIC_CASES.map((item) => evaluationRequest(item, efficientModel));
    const form = new FormData();
    form.append('purpose', 'batch');
    form.append('file', new Blob([`${entries.map((item) => JSON.stringify(item)).join('\n')}\n`], { type: 'application/jsonl' }), `artway-diagnostics-${today}.jsonl`);
    const file = await api('/v1/files', { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) });
    const batch = await api('/v1/batches', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input_file_id: file.id,
        endpoint: '/v1/responses',
        completion_window: '24h',
        metadata: { project: 'artway-sklep', suite: 'diagnostics-regression', day: today },
      }),
    });
    const record = {
      id: clean(batch.id, 120), inputFileId: clean(file.id, 120), outputFileId: '', day: today,
      status: clean(batch.status || 'validating', 40), model: efficientModel, cases: entries.length,
      createdAt: now().toISOString(), updatedAt: now().toISOString(), score: null, error: '',
    };
    await save((state) => ({ ...state, lastDailyBatchDay: today, batches: [record, ...state.batches.filter((item) => item.id !== record.id)].slice(0, 30) }));
    return { skipped: false, batch: record };
  }

  async function pollBatches() {
    const state = baseState(await read(STATE_KEY, {})), pending = state.batches.filter((item) => ACTIVE_BATCH.has(item.status)).slice(0, 5);
    if (!pending.length) return { checked: 0, updated: 0 };
    let updated = 0, nextItems = [...state.batches];
    for (const item of pending) {
      try {
        const remote = await api(`/v1/batches/${encodeURIComponent(item.id)}`);
        const statusValue = clean(remote.status, 40), outputFileId = clean(remote.output_file_id, 120);
        let score = item.score || null;
        if (statusValue === 'completed' && outputFileId && !score) {
          const content = await api(`/v1/files/${encodeURIComponent(outputFileId)}/content`);
          score = scoreBatchContent(content);
        }
        nextItems = nextItems.map((entry) => entry.id === item.id ? {
          ...entry, status: statusValue || entry.status, outputFileId: outputFileId || entry.outputFileId,
          score, error: '', updatedAt: now().toISOString(),
        } : entry);
        updated += 1;
      } catch (error) {
        nextItems = nextItems.map((entry) => entry.id === item.id ? { ...entry, error: safeError(error.message), updatedAt: now().toISOString() } : entry);
      }
    }
    await save((current) => ({ ...current, batches: nextItems }));
    return { checked: pending.length, updated };
  }

  async function cycle({ force = false } = {}) {
    const connectionState = await connection(force), polling = await pollBatches();
    let launch = { skipped: true, reason: 'not_connected' };
    if (connectionState.endpoints?.batches?.available) launch = await launchEvaluationBatch({ force: false });
    return { connection: connectionState, polling, launch, status: await status() };
  }

  return Object.freeze({ status, cycle, connection, launchEvaluationBatch, pollBatches });
}

export const OPENAI_PLATFORM_STATE_KEY = STATE_KEY;
export const OPENAI_DIAGNOSTIC_EVAL_CASES = DIAGNOSTIC_CASES;
