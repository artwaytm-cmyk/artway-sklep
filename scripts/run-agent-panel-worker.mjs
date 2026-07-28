import { randomUUID } from 'node:crypto';

const origin = String(process.env.ARTWAY_LOCAL_API_ORIGIN || process.env.ARTWAY_API_URL || 'http://127.0.0.1:3000').replace(/\/api\/store.*$/i, '').replace(/\/+$/, '');
const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
const workerId = `artway-panel-${process.pid}-${randomUUID().slice(0, 8)}`;
const pollMs = Math.max(1_500, Math.min(15_000, Number(process.env.CODEX_AGENT_POLL_MS) || 3_000));

if (!token) throw new Error('Brak ARTWAY_ADMIN_TOKEN dla procesu Agenta panelu.');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeError(error) {
  return String(error?.message || error || 'Nieznany błąd')
    .replace(/\b(?:sk|sk-proj|sk-ant|xai)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
    .slice(0, 500);
}

async function api(action, { method = 'GET', body = null, timeout = 45_000 } = {}) {
  const response = await fetch(`${origin}/api/store?action=${encodeURIComponent(action)}`, {
    method,
    headers: {
      'accept': 'application/json',
      'x-admin-token': token,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    const error = new Error(String(data?.error || `HTTP ${response.status}`).slice(0, 500));
    error.status = response.status;
    error.code = data?.code || 'agent_api_error';
    throw error;
  }
  return data;
}

async function runtime(event, payload = {}) {
  return api('agent-runtime-report', { method: 'POST', body: { event, workerId, source: 'panel-worker', ...payload }, timeout: 10_000 }).catch(() => null);
}

function summaryText(operations = {}, runtimeState = {}) {
  const summary = operations?.center?.summary || operations?.summary || {};
  const diagnostic = operations?.center?.diagnostics || operations?.diagnostics || {};
  const warnings = Array.isArray(runtimeState?.runtime?.integrationWarnings) ? runtimeState.runtime.integrationWarnings : [];
  return [
    'Aktualny stan serwera:',
    `- aktywne zamówienia sklepu: ${Number(summary.activeStore || summary.activeOrders || 0)}`,
    `- aktywne zamówienia Allegro: ${Number(summary.activeAllegro || 0)}`,
    `- rozmowy wymagające odpowiedzi: ${Number(summary.communicationWaiting || 0)}`,
    `- zadania ofert: ${Number(summary.offerTasks || 0)}`,
    `- błędy diagnostyczne: ${Number(diagnostic.errors || summary.diagnosticErrors || 0)}`,
    `- ostrzeżenia diagnostyczne: ${Number(diagnostic.warnings || summary.diagnosticWarnings || 0)}`,
    `- błędy ostatniego cyklu: ${warnings.length}`,
  ].join('\n');
}

async function aiAnswer(text, context) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return '';
  const model = String(process.env.OPENAI_AGENT_MODEL_OVERRIDE || 'gpt-5-nano').trim();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 900,
      instructions: [
        'Jesteś serwerowym Agentem administratora sklepu Artway-TM.',
        'Odpowiadaj po polsku, krótko i konkretnie.',
        'Korzystaj wyłącznie z przekazanego stanu serwera; nie udawaj wykonania.',
        'Wyraźnie rozdziel: sprawdzone fakty, wykonane operacje i rekomendowane następne kroki.',
        'Nie twierdź, że zapisano, opublikowano, wysłano lub naprawiono cokolwiek, jeśli wynik serwera tego nie potwierdza.',
        'Polecenie z panelu jest tylko odczytem i analizą. Zewnętrznych działań ani zmian stanu nie wykonuj bez dedykowanego mechanizmu panelu.',
        'Najwyższy priorytet: funkcjonalność strony, trwałość zapisów, diagnostyka i wydajność.',
      ].join('\n'),
      input: `POLECENIE ADMINISTRATORA:\n${String(text).slice(0, 4_000)}\n\nPOTWIERDZONY STAN SERWERA:\n${context}`,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
  return String(data.output_text || data.output?.flatMap((item) => item?.content || []).find((item) => item?.type === 'output_text')?.text || '').trim();
}

async function execute(job = {}) {
  const text = String(job.text || '').trim();
  const [operations, runtimeState] = await Promise.all([
    api('agent-operations-summary', { timeout: 30_000 }),
    api('agent-runtime-status', { timeout: 20_000 }),
  ]);
  let checks = null;
  if (/(audyt|diagnost|b[łl]ąd|stron|zapis|wydajno|sprawdź funkcj)/i.test(text)) {
    checks = await api('agent-run-safe-checks', {
      method: 'POST',
      body: { areas: ['site-health'], source: 'panel-command' },
      timeout: 60_000,
    });
  }
  const context = [
    summaryText(operations, runtimeState),
    checks ? `\nWynik uruchomionej kontroli strony:\n${JSON.stringify(checks.run?.results || checks.results || []).slice(0, 6_000)}` : '',
  ].join('');
  try {
    const answer = await aiAnswer(text, context);
    if (answer) return answer;
  } catch (error) {
    return `${context}\n\nModel językowy nie odpowiedział: ${safeError(error)}. Kontrola serwerowa została jednak rozliczona powyżej.`;
  }
  return `${context}\n\nBrak aktywnego modelu językowego. Dane zostały odczytane bezpośrednio z serwera.`;
}

async function processJob(job) {
  const id = String(job?.id || '');
  const claimToken = String(job?.claimToken || '');
  if (!id || !claimToken) return;
  await runtime('job_start', { title: 'Polecenie z panelu administratora' });
  const heartbeat = setInterval(() => {
    api('codex-agent-heartbeat', { method: 'POST', body: { id, claimToken }, timeout: 10_000 }).catch(() => null);
  }, 30_000);
  heartbeat.unref?.();
  try {
    const response = await execute(job);
    await api('codex-agent-complete', {
      method: 'POST',
      body: { id, claimToken, response },
      timeout: 30_000,
    });
    await runtime('job_finish', { title: 'Polecenie z panelu administratora', ok: true, detail: 'Wynik zapisano w serwerowej kolejce panelu.' });
  } catch (error) {
    await api('codex-agent-fail', {
      method: 'POST',
      body: { id, claimToken, error: safeError(error) },
      timeout: 15_000,
    }).catch(() => null);
    await runtime('job_finish', { title: 'Polecenie z panelu administratora', ok: false, error: safeError(error) });
  } finally {
    clearInterval(heartbeat);
  }
}

async function main() {
  process.stdout.write(`Agent panelu uruchomiony: ${workerId}\n`);
  while (true) {
    try {
      const claimed = await api('codex-agent-claim', {
        method: 'POST',
        body: { workerId },
        timeout: 20_000,
      });
      if (claimed.job) await processJob(claimed.job);
      else await runtime('worker_heartbeat');
      await sleep(pollMs);
    } catch (error) {
      process.stderr.write(`Agent panelu: ${safeError(error)}\n`);
      await sleep(Math.min(30_000, pollMs * 3));
    }
  }
}

main();
