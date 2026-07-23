import crypto from 'node:crypto';

const KEY = 'agent_runtime';
const MAX_HISTORY = 72;
const MAX_ACTIVITY = 160;
const MAX_STEPS = 24;
const MAX_WRITE_ATTEMPTS = 8;
const WORKER_ONLINE_MS = 150_000;
const CYCLE_FRESH_MS = 35 * 60_000;

function clean(value = '', limit = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, limit);
}

function iso(value = '', fallback = '') {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function number(value = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
}

function safeError(value = '') {
  return clean(value, 300)
    .replace(/\b(?:sk|sk-proj|sk-ant|xai)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{10,}=*/gi, 'Bearer [ukryty]');
}

function safeProvider(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    configured: source.configured === true,
    connected: source.connected === true,
    enabled: source.enabled !== false,
    model: clean(source.model, 80),
    lastCheckedAt: iso(source.lastCheckedAt),
    lastSuccessAt: iso(source.lastSuccessAt),
    error: safeError(source.error),
  };
}

function safeStep(value = {}) {
  const status = ['queued', 'running', 'completed', 'skipped', 'warning', 'failed'].includes(value?.status)
    ? value.status
    : 'queued';
  return {
    id: clean(value?.id || value?.label, 80),
    label: clean(value?.label || value?.id, 120),
    status,
    startedAt: iso(value?.startedAt),
    completedAt: iso(value?.completedAt),
    durationMs: number(value?.durationMs, 0, 60 * 60_000),
    count: number(value?.count, 0, 10_000_000),
    detail: clean(value?.detail, 220),
    error: safeError(value?.error),
  };
}

function safeRun(value = {}) {
  const status = ['running', 'completed', 'degraded', 'failed'].includes(value?.status) ? value.status : 'running';
  return {
    id: clean(value?.id, 100),
    source: clean(value?.source, 100),
    status,
    startedAt: iso(value?.startedAt),
    completedAt: iso(value?.completedAt),
    durationMs: number(value?.durationMs, 0, 12 * 60 * 60_000),
    summary: clean(value?.summary, 240),
    steps: (Array.isArray(value?.steps) ? value.steps : []).slice(0, MAX_STEPS).map(safeStep),
  };
}

function safeActivity(value = {}) {
  return {
    id: clean(value?.id, 100) || crypto.randomUUID(),
    at: iso(value?.at, new Date().toISOString()),
    type: clean(value?.type, 60) || 'system',
    status: ['info', 'running', 'success', 'warning', 'error'].includes(value?.status) ? value.status : 'info',
    title: clean(value?.title, 140),
    detail: clean(value?.detail, 260),
    source: clean(value?.source, 100),
  };
}

function asRecord(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    updatedAt: iso(source.updatedAt),
    worker: {
      id: clean(source.worker?.id, 120),
      startedAt: iso(source.worker?.startedAt),
      lastSeenAt: iso(source.worker?.lastSeenAt),
      currentTask: clean(source.worker?.currentTask, 160),
      currentTaskStartedAt: iso(source.worker?.currentTaskStartedAt),
      completedJobs: number(source.worker?.completedJobs, 0, 100_000_000),
      failedJobs: number(source.worker?.failedJobs, 0, 100_000_000),
    },
    providers: {
      codex: safeProvider(source.providers?.codex),
      openai: safeProvider(source.providers?.openai),
      anthropic: safeProvider(source.providers?.anthropic),
      xai: safeProvider(source.providers?.xai),
    },
    currentRun: source.currentRun?.id ? safeRun(source.currentRun) : null,
    history: (Array.isArray(source.history) ? source.history : []).slice(0, MAX_HISTORY).map(safeRun),
    activity: (Array.isArray(source.activity) ? source.activity : []).slice(0, MAX_ACTIVITY).map(safeActivity),
  };
}

function activity(record, item) {
  return [safeActivity(item), ...record.activity].slice(0, MAX_ACTIVITY);
}

function upsertStep(run, step) {
  const next = safeStep(step), steps = [...(run?.steps || [])];
  const index = steps.findIndex((item) => item.id === next.id);
  if (index >= 0) steps[index] = { ...steps[index], ...next };
  else steps.push(next);
  return { ...run, steps: steps.slice(0, MAX_STEPS) };
}

export function createAgentRuntime({ readVersioned, writeIfVersion, now = () => new Date() } = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') {
    throw new Error('Rejestr Agenta wymaga wersjonowanego repozytorium.');
  }

  async function change(mutator) {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
      const version = await readVersioned(KEY, {}), record = asRecord(version.value), timestamp = now().toISOString();
      const next = asRecord(await mutator(record, timestamp));
      next.updatedAt = timestamp;
      const write = await writeIfVersion(KEY, next, version);
      if (write?.modified) return next;
    }
    const error = new Error('Stan Agenta zmienił się równocześnie. Ponów operację.');
    error.code = 'agent_runtime_write_conflict';
    error.status = 409;
    throw error;
  }

  async function report(input = {}) {
    const event = clean(input.event, 50), timestamp = iso(input.at, now().toISOString());
    if (!event) throw Object.assign(new Error('Brakuje rodzaju zdarzenia Agenta.'), { status: 422, code: 'agent_runtime_event_required' });
    return change((record) => {
      if (event === 'worker_heartbeat') {
        const wasTask = record.worker.currentTask;
        const currentTask = clean(input.currentTask, 160);
        const providers = input.providers && typeof input.providers === 'object'
          ? {
            codex: safeProvider({ ...record.providers.codex, ...input.providers.codex }),
            openai: safeProvider({ ...record.providers.openai, ...input.providers.openai }),
            anthropic: safeProvider({ ...record.providers.anthropic, ...input.providers.anthropic }),
            xai: safeProvider({ ...record.providers.xai, ...input.providers.xai }),
          }
          : record.providers;
        return {
          ...record,
          worker: {
            ...record.worker,
            id: clean(input.workerId, 120) || record.worker.id,
            startedAt: record.worker.startedAt || timestamp,
            lastSeenAt: timestamp,
            currentTask,
            currentTaskStartedAt: currentTask
              ? (wasTask === currentTask ? record.worker.currentTaskStartedAt || timestamp : timestamp)
              : '',
          },
          providers,
        };
      }
      if (event === 'job_start' || event === 'job_finish') {
        const running = event === 'job_start', title = clean(input.title, 140) || 'Polecenie Agenta';
        return {
          ...record,
          worker: {
            ...record.worker,
            lastSeenAt: timestamp,
            currentTask: running ? title : '',
            currentTaskStartedAt: running ? timestamp : '',
            completedJobs: record.worker.completedJobs + (!running && input.ok !== false ? 1 : 0),
            failedJobs: record.worker.failedJobs + (!running && input.ok === false ? 1 : 0),
          },
          activity: activity(record, {
            at: timestamp,
            type: 'job',
            status: running ? 'running' : input.ok === false ? 'error' : 'success',
            title,
            detail: safeError(input.detail || input.error),
            source: clean(input.source, 100) || 'worker',
          }),
        };
      }
      if (event === 'cycle_start') {
        const run = safeRun({
          id: input.runId || crypto.randomUUID(), source: input.source || 'scheduler', status: 'running', startedAt: timestamp,
          summary: 'Cykl automatyczny jest wykonywany.',
          steps: (Array.isArray(input.steps) ? input.steps : []).map((step) => ({ id: step.id || step, label: step.label || step, status: 'queued' })),
        });
        return {
          ...record,
          currentRun: run,
          activity: activity(record, { at: timestamp, type: 'cycle', status: 'running', title: 'Rozpoczęto cykl automatyczny', detail: `${run.steps.length} etapów`, source: run.source }),
        };
      }
      if (event === 'cycle_step') {
        if (!record.currentRun || clean(input.runId, 100) !== record.currentRun.id) return record;
        const step = safeStep({
          ...input.step,
          id: input.step?.id || input.stepId,
          label: input.step?.label || input.label || input.stepId,
        });
        const openAiStep = step.id === 'tresci-gpt-nano';
        const openAiFailed = openAiStep && ['warning', 'failed'].includes(step.status);
        const openAiSucceeded = openAiStep && step.status === 'completed';
        const providers = openAiStep ? {
          ...record.providers,
          openai: safeProvider({
            ...record.providers.openai,
            configured: true,
            connected: openAiSucceeded ? true : openAiFailed ? false : record.providers.openai.connected,
            lastCheckedAt: step.completedAt || timestamp,
            lastSuccessAt: openAiSucceeded ? (step.completedAt || timestamp) : record.providers.openai.lastSuccessAt,
            error: openAiFailed ? (step.error || step.detail) : openAiSucceeded ? '' : record.providers.openai.error,
          }),
        } : record.providers;
        return {
          ...record,
          providers,
          currentRun: upsertStep(record.currentRun, step),
          activity: ['completed', 'warning', 'failed'].includes(step.status)
            ? activity(record, {
              at: step.completedAt || timestamp,
              type: 'cycle_step',
              status: step.status === 'completed' ? 'success' : step.status === 'failed' ? 'error' : 'warning',
              title: step.label,
              detail: step.error || step.detail,
              source: record.currentRun.source,
            })
            : record.activity,
        };
      }
      if (event === 'cycle_finish') {
        if (!record.currentRun || clean(input.runId, 100) !== record.currentRun.id) return record;
        const finished = safeRun({
          ...record.currentRun,
          status: input.status,
          completedAt: timestamp,
          durationMs: input.durationMs,
          summary: input.summary,
        });
        return {
          ...record,
          currentRun: null,
          history: [finished, ...record.history.filter((run) => run.id !== finished.id)].slice(0, MAX_HISTORY),
          activity: activity(record, {
            at: timestamp,
            type: 'cycle',
            status: finished.status === 'completed' ? 'success' : finished.status === 'degraded' ? 'warning' : 'error',
            title: finished.status === 'completed' ? 'Cykl automatyczny zakończony' : finished.status === 'degraded' ? 'Cykl zakończony z ostrzeżeniem' : 'Cykl automatyczny nieudany',
            detail: finished.summary,
            source: finished.source,
          }),
        };
      }
      throw Object.assign(new Error('Nieobsługiwane zdarzenie Agenta.'), { status: 422, code: 'agent_runtime_event_invalid' });
    });
  }

  async function status(queue = {}) {
    const version = await readVersioned(KEY, {}), record = asRecord(version.value), current = now(), currentMs = current.getTime();
    const runtimeSeen = Date.parse(record.worker.lastSeenAt || '') || 0;
    const queueSeen = Date.parse(queue.workerLastSeenAt || '') || 0;
    const lastSeenMs = Math.max(runtimeSeen, queueSeen), workerOnline = queue.workerOnline === true || (lastSeenMs > 0 && currentMs - lastSeenMs <= WORKER_ONLINE_MS);
    const lastRun = record.history[0] || null, lastRunMs = Date.parse(lastRun?.completedAt || '') || 0;
    const cycleFresh = lastRunMs > 0 && currentMs - lastRunMs <= CYCLE_FRESH_MS;
    const integrationWarnings = (lastRun?.steps || []).filter((step) => ['warning', 'failed'].includes(step.status)).map((step) => ({
      id: step.id,
      label: step.label,
      error: step.error || step.detail,
      kind: ['oferty-lekkie', 'oferty-pelne', 'zamowienia', 'komunikacja'].includes(step.id) ? 'allegro' : step.id === 'tresci-gpt-nano' ? 'ai' : 'system',
    }));
    const state = !workerOnline ? 'offline' : record.currentRun ? 'working' : !cycleFresh ? 'stale' : integrationWarnings.length ? 'degraded' : 'online';
    return {
      state,
      worker: {
        ...record.worker,
        online: workerOnline,
        lastSeenAt: lastSeenMs ? new Date(lastSeenMs).toISOString() : '',
      },
      providers: record.providers,
      queue: {
        counts: queue.counts || {},
        active: number(queue.active, 0, 1_000_000),
      },
      currentRun: record.currentRun,
      lastRun,
      history: record.history.slice(0, 20),
      activity: record.activity.slice(0, 60),
      integrationWarnings,
      updatedAt: record.updatedAt,
      schedule: { mode: 'event_queue', detectorIntervalMinutes: 15, maxHeavyJobsPerRun: 2, lightOffersMinutes: 60, fullOffersHours: 24, nextAt: nextQuarterHour(current).toISOString() },
    };
  }

  return Object.freeze({ report, status });
}

function nextQuarterHour(date = new Date()) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setMinutes(Math.floor(next.getMinutes() / 15) * 15 + 15);
  return next;
}
