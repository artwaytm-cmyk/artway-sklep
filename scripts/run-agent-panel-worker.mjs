import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { AGENT_PANEL_INSTRUCTIONS } from '../src/backend/lib/domain/agent-panel-instructions.mjs';
import { parseAgentProductBacklogCommand } from '../src/backend/lib/domain/agent-panel-product-command.mjs';
import { createAgentProviderRouter } from '../src/backend/lib/domain/agent-provider-router.mjs';
import { parseDiagnosticCodeRepairContext } from '../src/backend/lib/domain/diagnostic-code-repair-queue.mjs';

const origin = String(process.env.ARTWAY_LOCAL_API_ORIGIN || process.env.ARTWAY_API_URL || 'http://127.0.0.1:3000').replace(/\/api\/store.*$/i, '').replace(/\/+$/, '');
const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
const workerId = `artway-panel-${process.pid}-${randomUUID().slice(0, 8)}`;
const waitMs = Math.max(15_000, Math.min(55_000, Number(process.env.CODEX_AGENT_WAIT_MS) || 50_000));
const productBacklogEnabled = process.env.ARTWAY_AGENT_PRODUCT_BACKLOG !== 'false';
const productBacklogIntervalMs = Math.max(60_000, Math.min(30 * 60_000, Number(process.env.ARTWAY_AGENT_PRODUCT_INTERVAL_MS) || 5 * 60_000));
const productBacklogBatchSize = Math.max(1, Math.min(100, Number(process.env.ARTWAY_AGENT_PRODUCT_BATCH_SIZE) || 10));
const providerRouter = createAgentProviderRouter();
const exec = promisify(execFile);
const repositoryRoot = path.resolve(process.env.ARTWAY_CODE_REPAIR_ROOT || process.cwd());
const repairStateRoot = path.resolve(process.env.ARTWAY_CODE_REPAIR_STATE_DIR || '/srv/artway/ops/code-repairs');
let nextProductBacklogAt = 0;

if (!token) throw new Error('Brak ARTWAY_ADMIN_TOKEN dla procesu Agenta panelu.');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeError(error) {
  const message = String(error?.message || error || 'Nieznany błąd');
  const cause = String(error?.cause?.message || error?.cause?.code || '').trim();
  return `${message}${cause && !message.includes(cause) ? `: ${cause}` : ''}`
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
    // Odpowiedź 409 po zapisie oferty nadal zawiera offer.id i stan odczytu.
    // Worker musi je zachować, aby późniejsza kontrola nie szukała oferty od
    // zera ani nie ryzykowała utworzenia duplikatu.
    error.responseData = data;
    throw error;
  }
  return data;
}

async function runtime(event, payload = {}) {
  return api('agent-runtime-report', { method: 'POST', body: { event, workerId, source: 'panel-worker', ...payload }, timeout: 10_000 }).catch(() => null);
}

const repairPathAllowed = (value = '') => /^(?:src\/(?:backend|frontend|styles)\/.+\.(?:js|mjs|css)|tests\/.+\.(?:js|mjs)|assets\/.+\.(?:js|css))$/.test(String(value));

async function command(file, args, options = {}) {
  const result = await exec(file, args, { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 24 * 1024 * 1024, timeout: options.timeout || 120_000, env: process.env });
  return String(result.stdout || '').trim();
}

async function git(args, options = {}) {
  return command('git', args, options);
}

function statusPaths(raw = '') {
  return String(raw).split('\0').filter(Boolean).map((line) => line.slice(3)).filter(Boolean);
}

async function codeRepairReport(context, job, repairStatus, fields = {}) {
  return api('diagnostics-code-repair-report', {
    method: 'POST',
    body: { ids: [context.diagnosticId], repairStatus, jobId: job.id, ...fields },
    timeout: 20_000,
  }).catch(() => null);
}

async function rollbackCodeRepair(baseHead, initialPaths) {
  const head = await git(['rev-parse', 'HEAD']).catch(() => '');
  if (head !== baseHead) return;
  const current = statusPaths(await git(['status', '--porcelain=v1', '-z']));
  const added = current.filter((file) => !initialPaths.has(file) && repairPathAllowed(file));
  const tracked = [], untracked = [];
  for (const file of added) {
    const known = await git(['ls-files', '--error-unmatch', '--', file]).then(() => true).catch(() => false);
    (known ? tracked : untracked).push(file);
  }
  if (tracked.length) await git(['restore', '--staged', '--worktree', '--', ...tracked]).catch(() => {});
  if (untracked.length) {
    const quarantine = path.join(repairStateRoot, 'quarantine', `${Date.now()}-${randomUUID().slice(0, 8)}`);
    await mkdir(quarantine, { recursive: true });
    for (const file of untracked) {
      const target = path.join(quarantine, file.replaceAll('/', '__'));
      await rename(path.join(repositoryRoot, file), target).catch(() => {});
    }
  }
}

async function executeDiagnosticCodeRepair(job, context) {
  await mkdir(repairStateRoot, { recursive: true });
  const pendingMarker = path.join(repairStateRoot, 'pending.json');
  if (await stat(pendingMarker).then(() => true).catch(() => false)) throw new Error('Poprzednia poprawka kodu czeka jeszcze na wdrożenie.');
  const baseHead = await git(['rev-parse', 'HEAD']);
  const initialStatus = await git(['status', '--porcelain=v1', '-z']);
  const initialPaths = new Set(statusPaths(initialStatus));
  const stagedPaths = String(await git(['diff', '--cached', '--name-only', '-z'])).split('\0').filter(Boolean);
  if (stagedPaths.length) throw new Error(`Repozytorium ma już przygotowane zmiany do commita: ${stagedPaths.join(', ')}`);
  const dirtyCode = [...initialPaths].filter(repairPathAllowed);
  if (dirtyCode.length) throw new Error(`Repozytorium ma niezakończoną zmianę kodu: ${dirtyCode.join(', ')}`);
  const preservedDiff = await git(['diff', '--binary', '--', ...initialPaths]).catch(() => '');
  await codeRepairReport(context, job, 'running', { startedAt: new Date().toISOString(), summary: 'Codex odtwarza błąd i przygotowuje minimalną poprawkę w kontrolowanym katalogu.' });
  let committed = false;
  try {
    const prompt = `Jesteś Agentem naprawy kodu Artway-TM na serwerze produkcyjnym. Pracujesz wyłącznie w repozytorium ${repositoryRoot}.\n\nPROBLEM DIAGNOSTYCZNY:\n${JSON.stringify(context, null, 2)}\n\nWYMAGANIA BEZWZGLĘDNE:\n- przeczytaj AGENTS.md i zachowaj istniejące obce zmiany;\n- najpierw potwierdź przyczynę w kodzie i dodaj test regresji;\n- wykonaj najmniejszą możliwą poprawkę;\n- wolno zmieniać wyłącznie src/backend, src/frontend, src/styles, tests oraz wygenerowane assets JS/CSS;\n- nie wolno zmieniać sekretów, .env, konfiguracji systemu, migracji, produktów, zamówień, package.json, lockfile, ops ani skryptów wdrożenia;\n- uruchom test celowany oraz npm run build;\n- NIE wykonuj git commit, git push, wdrożenia ani restartu usług;\n- jeśli nie da się bezpiecznie potwierdzić poprawki, nie zmieniaj plików i wyjaśnij dlaczego.\nNa końcu pozostaw repozytorium z gotową, niezatwierdzoną poprawką.`;
    const outputPath = path.join(repairStateRoot, `codex-${context.diagnosticId}-${Date.now()}.txt`);
    await command('/usr/local/bin/codex', ['exec', '--sandbox', 'workspace-write', '--ephemeral', '--ignore-user-config', '-C', repositoryRoot, '-o', outputPath, prompt], { timeout: 20 * 60_000 });
    await command('npm', ['run', 'build'], { timeout: 10 * 60_000 });
    const currentHead = await git(['rev-parse', 'HEAD']);
    if (currentHead !== baseHead) throw new Error('Agent kodu nie może samodzielnie utworzyć commita przed walidacją.');
    const currentStatus = await git(['status', '--porcelain=v1', '-z']);
    const allPaths = statusPaths(currentStatus), changed = [...new Set(allPaths.filter((file) => !initialPaths.has(file)))];
    const forbidden = changed.filter((file) => !repairPathAllowed(file));
    if (forbidden.length) throw new Error(`Poprawka dotknęła niedozwolonych plików: ${forbidden.join(', ')}`);
    if (!changed.length) {
      await codeRepairReport(context, job, 'testing', { summary: 'Kod nie wymaga nowej zmiany; Agent uruchamia pełne testy i potwierdza zgodność aktywnego wydania.' });
      await command('npm', ['test'], { timeout: 30 * 60_000 });
      const activeRelease = JSON.parse(await readFile('/srv/artway/releases/current/release.json', 'utf8'));
      if (String(activeRelease?.commit || '') !== baseHead) throw new Error('Kod nie wymaga zmiany, ale aktywne wydanie nie odpowiada przetestowanemu commitowi.');
      await codeRepairReport(context, job, 'completed', { verified: true, testedAt: new Date().toISOString(), commit: baseHead, summary: 'Kod zawierał już poprawkę; pełna kontrola nie wykazała zmiany wymagającej nowego wydania.' });
      return { response: 'Agent potwierdził, że aktualny kod zawiera już poprawkę. Problem zamknięto dopiero po kontroli źródeł.', provider: 'codex-cli', model: 'code-repair-verified' };
    }
    if (changed.length > 14) throw new Error(`Poprawka jest zbyt szeroka (${changed.length} plików). Wymaga ręcznego podziału.`);
    const afterPreservedDiff = await git(['diff', '--binary', '--', ...initialPaths]).catch(() => '');
    if (afterPreservedDiff !== preservedDiff) throw new Error('Agent naruszył wcześniejsze zmiany użytkownika; poprawka została zatrzymana.');
    const numstat = await git(['diff', '--numstat', '--', ...changed]);
    const changedLines = numstat.split('\n').filter(Boolean).reduce((sum, line) => sum + line.split('\t').slice(0, 2).reduce((n, value) => n + (Number(value) || 0), 0), 0);
    if (changedLines > 1400) throw new Error(`Poprawka jest zbyt szeroka (${changedLines} zmienionych linii).`);
    await codeRepairReport(context, job, 'testing', { summary: `Pełne testy poprawki obejmują ${changed.length} plików i ${changedLines} zmienionych linii.` });
    await command('npm', ['test'], { timeout: 30 * 60_000 });
    await git(['add', '--', ...changed]);
    await git(['commit', '-m', `Agent repair: ${context.diagnosticId}`], { timeout: 120_000 });
    const commit = await git(['rev-parse', 'HEAD']);
    const codexSummary = await readFile(outputPath, 'utf8').catch(() => 'Minimalna poprawka przygotowana przez Codex.');
    const marker = { version: 1, diagnosticId: context.diagnosticId, jobId: job.id, baseCommit: baseHead, commit, changedPaths: changed, testedAt: new Date().toISOString(), summary: String(codexSummary).trim().slice(0, 1200) };
    const temporaryMarker = `${pendingMarker}.${process.pid}.tmp`;
    await writeFile(temporaryMarker, `${JSON.stringify(marker, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryMarker, pendingMarker);
    committed = true;
    await codeRepairReport(context, job, 'ready', { testedAt: marker.testedAt, commit, summary: 'Minimalna poprawka przeszła pełny zestaw testów i czeka na atomowe wdrożenie przez osobny kontroler.' });
    return { response: `Poprawka kodu ${commit.slice(0, 12)} przeszła pełne testy. Kontroler wdroży ją atomowo i dopiero po sprawdzeniu produkcji zamknie błąd.`, provider: 'codex-cli', model: 'code-repair-tested' };
  } catch (error) {
    if (!committed) await rollbackCodeRepair(baseHead, initialPaths);
    await codeRepairReport(context, job, 'failed', { error: safeError(error), summary: 'Naprawa została zatrzymana przed wdrożeniem; kod produkcyjny nie został przełączony.' });
    throw error;
  }
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
  const input = `POLECENIE ADMINISTRATORA:\n${String(text).slice(0, 4_000)}\n\nPOTWIERDZONY STAN SERWERA:\n${context}`;
  try {
    return await providerRouter.answer({ input, instructions: AGENT_PANEL_INSTRUCTIONS, maxOutputTokens: 900 });
  } catch (providerError) {
    if (process.env.OLLAMA_FALLBACK_ENABLED === 'false') throw providerError;
  }
  const baseUrl = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const localModel = String(process.env.OLLAMA_FALLBACK_MODEL || 'qwen3.5:4b').trim();
  const local = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: localModel,
      stream: false,
      think: false,
      keep_alive: String(process.env.OLLAMA_KEEP_ALIVE || '30s'),
      messages: [
        { role: 'system', content: `${AGENT_PANEL_INSTRUCTIONS}\nDziałasz w lokalnym, bezpłatnym trybie awaryjnym.` },
        { role: 'user', content: input },
      ],
      options: { temperature: 0, num_ctx: 16_384, num_predict: 900 },
    }),
    signal: AbortSignal.timeout(150_000),
  });
  const localData = await local.json().catch(() => ({}));
  if (!local.ok) throw new Error(localData?.error || `Lokalny model HTTP ${local.status}`);
  return { text: String(localData?.message?.content || '').trim(), provider: 'ollama', model: localModel };
}

function productBacklogText(automatic = {}, requestedBatchSize = 0) {
  const enqueued = Math.max(0, Number(automatic.enqueued) || 0);
  const queue = automatic.queue || {};
  if (automatic.reason === 'queue_busy') {
    return `Agent serwerowy już pracuje. W kolejce pozostaje ${Math.max(0, Number(queue.pending) || 0)} produktów${queue.active?.productId ? `, aktualnie produkt ${queue.active.productId}` : ''}. Nie utworzono duplikatu.`;
  }
  if (automatic.reason === 'catalog_ready') {
    return 'Agent sprawdził zaległości: nie ma kolejnej bezpiecznej kartoteki do automatycznego przygotowania. Pozycje wymagające decyzji pozostają oddzielnie oznaczone.';
  }
  if (enqueued > 0) {
    return `Polecenie zostało zapisane w trwałej kolejce serwera. Dodano ${enqueued} z maksymalnie ${requestedBatchSize} produktów. Agent przetwarza je pojedynczo także po zamknięciu panelu; kolejne partie dobierze automatycznie bez tworzenia duplikatów.`;
  }
  return `Agent nie dodał nowej pracy (powód: ${String(automatic.reason || 'brak nowych kandydatów')}).`;
}

async function enqueueProductBacklog(batchSize, source) {
  const status = await api('allegro-preparation-queue-status', { timeout: 20_000 });
  if (Number(status?.queue?.pending || 0) > 0 || status?.queue?.active) {
    return { skipped: true, reason: 'queue_busy', enqueued: 0, queue: status.queue };
  }
  const response = await api('allegro-preparation-queue-auto', {
    method: 'POST',
    body: { batchSize, source },
    timeout: 60_000,
  });
  return response?.automatic || { skipped: true, reason: 'empty_response', enqueued: 0 };
}

async function maybeEnqueueProductBacklog() {
  if (!productBacklogEnabled || Date.now() < nextProductBacklogAt) return null;
  nextProductBacklogAt = Date.now() + productBacklogIntervalMs;
  try {
    const automatic = await enqueueProductBacklog(productBacklogBatchSize, 'background-agent');
    if (Number(automatic?.enqueued || 0) > 0) {
      await runtime('work_progress', {
        work: {
          id: `product-backlog:${Date.now()}`,
          channel: 'system',
          action: 'ciągłe przygotowanie katalogu',
          phase: 'queued',
          status: 'pending',
          target: 'trwała kolejka produktów',
          message: `Dodano następną bezpieczną partię ${automatic.enqueued} produktów.`,
        },
      });
    }
    return automatic;
  } catch (error) {
    await runtime('work_progress', {
      work: {
        id: 'product-backlog-scheduler',
        channel: 'system',
        action: 'ciągłe przygotowanie katalogu',
        phase: 'scheduler_error',
        status: 'failed',
        target: 'trwała kolejka produktów',
        error: safeError(error),
      },
    });
    return null;
  }
}

function publicationAction(task = {}) {
  if (task.operation === 'activate') return 'activate';
  if (task.operation === 'draft') return 'deactivate';
  return 'keep';
}

async function processNextPublication() {
  const claimed = await api('allegro-publication-queue-claim', {
    method: 'POST',
    body: { workerId },
    timeout: 20_000,
  });
  const task = claimed?.task;
  if (!task) return false;
  const taskId = String(task.id || ''), claimToken = String(task.claimToken || '');
  if (!taskId || !claimToken) return false;
  try {
    if (!task.product) {
      const missing = new Error(`Nie znaleziono centralnej kartoteki produktu ${task.productId}.`);
      missing.code = 'publication_product_not_found';
      missing.status = 404;
      throw missing;
    }
    const action = publicationAction(task);
    const response = await api('allegro-create-product-offer', {
      method: 'POST',
      body: {
        product: task.product,
        options: {
          stock: Math.max(0, Number(task.stock) || 0),
          publicationAction: action,
          publishNow: action === 'activate',
        },
        approval: {
          approved: true,
          operationId: taskId,
          productId: String(task.productId || ''),
          action: task.operation,
          approvedAt: task.approvedAt || task.createdAt || new Date().toISOString(),
        },
      },
      timeout: 210_000,
    });
    await api('allegro-publication-queue-complete', {
      method: 'POST',
      body: {
        taskId,
        claimToken,
        result: {
          offerId: String(response?.offer?.id || ''),
          mode: response?.mode || '',
          status: response?.verification?.status || response?.offer?.publication?.status || '',
          publicationConfirmed: response?.verification?.publicationConfirmed === true,
          readbackConfirmed: response?.verification?.readbackConfirmed !== false,
        },
      },
      timeout: 20_000,
    });
  } catch (error) {
    const status = Number(error?.status) || 0;
    const retryable = status === 429 || status >= 500 || ['agent_api_error', 'fetch_failed', 'ETIMEDOUT', 'ECONNRESET'].includes(String(error?.code || ''));
    const responseData = error?.responseData && typeof error.responseData === 'object' ? error.responseData : {};
    const offerId = String(responseData?.offer?.id || responseData?.offerId || '').trim();
    await api('allegro-publication-queue-fail', {
      method: 'POST',
      body: {
        taskId,
        claimToken,
        retryable,
        errorCode: String(error?.code || 'allegro_publication_failed').slice(0, 120),
        error: safeError(error),
        result: {
          retryable,
          failedAt: new Date().toISOString(),
          offerId,
          status: responseData?.verification?.status || responseData?.offer?.publication?.status || '',
          expectedStatus: responseData?.verification?.expectedStatus || '',
          publicationConfirmed: responseData?.verification?.publicationConfirmed === true,
          readbackConfirmed: responseData?.verification?.readbackConfirmed === true,
        },
      },
      timeout: 20_000,
    }).catch(() => null);
  }
  return true;
}

async function execute(job = {}) {
  const text = String(job.text || '').trim();
  const repairContext = parseDiagnosticCodeRepairContext(job.context);
  if (repairContext) return executeDiagnosticCodeRepair(job, repairContext);
  const productCommand = parseAgentProductBacklogCommand(text);
  if (productCommand) {
    const automatic = await enqueueProductBacklog(productCommand.batchSize, 'panel-command');
    return {
      response: productBacklogText(automatic, productCommand.batchSize),
      provider: 'server-queue',
      model: 'persistent-product-worker',
    };
  }
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
    if (answer?.text) return { response: answer.text, provider: answer.provider, model: answer.model };
  } catch (error) {
    return { response: `${context}\n\nModel językowy nie odpowiedział: ${safeError(error)}. Kontrola serwerowa została jednak rozliczona powyżej.`, provider: 'rules', model: 'server-rules' };
  }
  return { response: `${context}\n\nBrak aktywnego modelu językowego. Dane zostały odczytane bezpośrednio z serwera.`, provider: 'rules', model: 'server-rules' };
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
    const result = await execute(job);
    await api('codex-agent-complete', {
      method: 'POST',
      body: { id, claimToken, response: result.response },
      timeout: 30_000,
    });
    await runtime('job_finish', { title: 'Polecenie z panelu administratora', ok: true, detail: `Wynik zapisano w serwerowej kolejce panelu • ${result.provider}/${result.model}` });
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
  await runtime('worker_heartbeat', { providers: await providerRouter.status({ force: true }) });
  let consecutiveFailures = 0, lastFailure = '', lastFailureLoggedAt = 0;
  while (true) {
    try {
      if (await processNextPublication()) {
        consecutiveFailures = 0;
        continue;
      }
      const claimed = await api('codex-agent-claim', {
        method: 'POST',
        body: { workerId, waitMs },
        timeout: waitMs + 10_000,
      });
      if (claimed.job) await processJob(claimed.job);
      else {
        await runtime('worker_heartbeat', { providers: await providerRouter.status() });
        await maybeEnqueueProductBacklog();
      }
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      const detail = safeError(error), currentTime = Date.now();
      const retryMs = Math.min(60_000, 5_000 * (2 ** Math.min(4, consecutiveFailures - 1)));
      if (detail !== lastFailure || currentTime - lastFailureLoggedAt >= 5 * 60_000) {
        process.stderr.write(`${JSON.stringify({ at: new Date().toISOString(), component: 'agent-panel-worker', event: 'api_retry', detail, attempt: consecutiveFailures, retryMs })}\n`);
        lastFailure = detail;
        lastFailureLoggedAt = currentTime;
      }
      await sleep(retryMs);
    }
  }
}

main();
