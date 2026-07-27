import crypto from 'node:crypto';

const RECORD_KEY = 'system_diagnostics';
const MAX_GROUPS = 500;
const MAX_EVENTS_PER_REQUEST = 25;
const MAX_WRITE_ATTEMPTS = 8;
const OPEN_STATUSES = new Set(['open', 'investigating']);
const ANALYSIS_STATUSES = new Set(['idle', 'queued', 'running', 'completed', 'failed']);

function clean(value = '', limit = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\b(?:sk|sk-proj|sk-ant|xai)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{10,}=*/gi, 'Bearer [ukryty]')
    .replace(/([?&](?:token|secret|key|code|password)=)[^&\s]+/gi, '$1[ukryte]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[ukryty e-mail]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function iso(value = '', fallback = '') {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function safeRoute(value = '') {
  const raw = clean(value, 300);
  if (!raw) return '';
  return raw
    .replace(/https?:\/\/[^/]+/gi, '')
    .replace(/[?&](?:token|secret|key|code|password)=[^&#\s]+/gi, '')
    .slice(0, 300);
}

function normalizedFingerprintText(value = '') {
  return clean(value, 700)
    .toLowerCase()
    .replace(/\b\d{4}-\d{2}-\d{2}t[\d:.+-]+z?\b/g, '<czas>')
    .replace(/\b\d{10,}\b/g, '<id>')
    .replace(/:\d+:\d+\b/g, ':<linia>')
    .replace(/\s+/g, ' ')
    .trim();
}

function eventFingerprint(event = {}) {
  return crypto.createHash('sha256')
    .update([
      event.level,
      normalizedFingerprintText(event.source),
      normalizedFingerprintText(event.message),
      normalizedFingerprintText(event.route),
    ].join('|'))
    .digest('hex')
    .slice(0, 24);
}

function safeEvent(value = {}, now = new Date()) {
  const level = ['blad', 'ostrzezenie'].includes(String(value?.level || value?.poziom || '').toLowerCase())
    ? String(value.level || value.poziom).toLowerCase()
    : '';
  const message = clean(value?.message || value?.tresc, 700);
  if (!level || !message) return null;
  const event = {
    level,
    message,
    source: clean(value?.source || value?.zrodlo || 'przeglądarka', 180),
    route: safeRoute(value?.route),
    release: clean(value?.release, 100),
    kind: clean(value?.kind || 'runtime', 60),
    at: iso(value?.at, now.toISOString()),
  };
  return { ...event, fingerprint: eventFingerprint(event) };
}

function safeItem(value = {}) {
  const status = ['open', 'investigating', 'resolved', 'ignored'].includes(value?.status) ? value.status : 'open';
  return {
    id: clean(value?.id || value?.fingerprint, 80),
    fingerprint: clean(value?.fingerprint, 80),
    level: value?.level === 'ostrzezenie' ? 'ostrzezenie' : 'blad',
    message: clean(value?.message, 700),
    source: clean(value?.source, 180),
    route: safeRoute(value?.route),
    release: clean(value?.release, 100),
    kind: clean(value?.kind, 60) || 'runtime',
    status,
    count: Math.max(1, Math.min(1_000_000, Number(value?.count) || 1)),
    firstSeenAt: iso(value?.firstSeenAt),
    lastSeenAt: iso(value?.lastSeenAt),
    resolvedAt: iso(value?.resolvedAt),
    resolvedBy: clean(value?.resolvedBy, 180),
    resolution: clean(value?.resolution, 500),
    analysis: safeAnalysis(value?.analysis),
  };
}

function safeAnalysis(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    status: ANALYSIS_STATUSES.has(source.status) ? source.status : 'idle',
    model: clean(source.model, 100),
    reasoning: clean(source.reasoning, 30),
    mode: clean(source.mode, 30),
    classification: clean(source.classification, 80),
    rootCause: clean(source.rootCause, 1200),
    summary: clean(source.summary, 700),
    confidence: Math.max(0, Math.min(1, Number(source.confidence) || 0)),
    evidence: (Array.isArray(source.evidence) ? source.evidence : []).slice(0, 8).map((item) => clean(item, 400)).filter(Boolean),
    recommendedActions: (Array.isArray(source.recommendedActions) ? source.recommendedActions : []).slice(0, 8).map((item) => ({
      action: clean(item?.action, 500),
      risk: ['low', 'medium', 'high'].includes(item?.risk) ? item.risk : 'medium',
      automatic: item?.automatic === true,
    })).filter((item) => item.action),
    validationPlan: (Array.isArray(source.validationPlan) ? source.validationPlan : []).slice(0, 8).map((item) => clean(item, 400)).filter(Boolean),
    safeAutomaticAction: ['none', 'retry_read_only_check', 'refresh_cached_version'].includes(source.safeAutomaticAction) ? source.safeAutomaticAction : 'none',
    requiresHumanApproval: source.requiresHumanApproval !== false,
    queuedAt: iso(source.queuedAt),
    startedAt: iso(source.startedAt),
    analyzedAt: iso(source.analyzedAt),
    error: clean(source.error, 700),
  };
}

function safeRecord(value = {}) {
  const items = (Array.isArray(value?.items) ? value.items : [])
    .map(safeItem)
    .filter((item) => item.id && item.message)
    .sort((left, right) => String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)))
    .slice(0, MAX_GROUPS);
  return {
    items,
    updatedAt: iso(value?.updatedAt),
    lastIngestAt: iso(value?.lastIngestAt),
  };
}

function summary(items = []) {
  const open = items.filter((item) => OPEN_STATUSES.has(item.status));
  return {
    total: items.length,
    open: open.length,
    errors: open.filter((item) => item.level === 'blad').length,
    warnings: open.filter((item) => item.level === 'ostrzezenie').length,
    occurrences: open.reduce((total, item) => total + item.count, 0),
  };
}

export function createSystemDiagnosticsRoute({
  readVersioned,
  writeIfVersion,
  respond,
  isAdmin,
  rateLimit,
  sessionOf = () => null,
  agentRuntime = null,
  diagnosticAgent = null,
  now = () => new Date(),
} = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function' || typeof respond !== 'function' || typeof isAdmin !== 'function') {
    throw new Error('Centralna diagnostyka wymaga repozytorium, odpowiedzi HTTP i autoryzacji.');
  }

  async function change(mutator) {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
      const version = await readVersioned(RECORD_KEY, {}), record = safeRecord(version.value);
      const next = safeRecord(await mutator(record));
      const write = await writeIfVersion(RECORD_KEY, next, version);
      if (write?.modified) return next;
    }
    throw Object.assign(new Error('Rejestr diagnostyczny jest równolegle aktualizowany. Ponów operację.'), { status: 409, code: 'diagnostics_write_conflict' });
  }

  let analysisQueue = Promise.resolve();
  async function analyzeOne(id = '', options = {}) {
    const safeId = clean(id, 80);
    if (!safeId || typeof diagnosticAgent?.analyze !== 'function') return false;
    const startedAt = now().toISOString();
    let target = null, correlatedEvents = [];
    await change((recordValue) => {
      target = recordValue.items.find((item) => item.id === safeId) || null;
      if (!target) return recordValue;
      correlatedEvents = recordValue.items
        .filter((item) => item.id !== safeId && (item.source === target.source || (item.route && item.route === target.route)))
        .slice(0, 12);
      return {
        ...recordValue,
        items: recordValue.items.map((item) => item.id === safeId ? safeItem({
          ...item,
          status: OPEN_STATUSES.has(item.status) ? 'investigating' : item.status,
          analysis: { ...item.analysis, status: 'running', startedAt, error: '' },
        }) : item),
        updatedAt: startedAt,
      };
    });
    if (!target) return false;
    try {
      const result = await diagnosticAgent.analyze(target, {
        correlatedEvents,
        release: target.release,
        deep: options.deep === true,
        manual: options.manual === true,
      });
      const analyzedAt = now().toISOString();
      await change((recordValue) => ({
        ...recordValue,
        items: recordValue.items.map((item) => item.id === safeId ? safeItem({
          ...item,
          status: OPEN_STATUSES.has(item.status) ? 'investigating' : item.status,
          analysis: { ...result, status: 'completed', startedAt, analyzedAt, error: '' },
        }) : item),
        updatedAt: analyzedAt,
      }));
      return true;
    } catch (error) {
      const analyzedAt = now().toISOString();
      await change((recordValue) => ({
        ...recordValue,
        items: recordValue.items.map((item) => item.id === safeId ? safeItem({
          ...item,
          analysis: { ...item.analysis, status: 'failed', startedAt, analyzedAt, error: error?.message || error },
        }) : item),
        updatedAt: analyzedAt,
      })).catch(() => {});
      return false;
    }
  }

  function enqueueAnalysis(ids = [], options = {}) {
    const uniqueIds = [...new Set(ids.map((id) => clean(id, 80)).filter(Boolean))].slice(0, 10);
    if (!uniqueIds.length || typeof diagnosticAgent?.analyze !== 'function') return 0;
    const queuedAt = now().toISOString();
    change((recordValue) => ({
      ...recordValue,
      items: recordValue.items.map((item) => uniqueIds.includes(item.id) ? safeItem({
        ...item,
        analysis: { ...item.analysis, status: 'queued', queuedAt, error: '' },
      }) : item),
      updatedAt: queuedAt,
    })).catch(() => {});
    analysisQueue = analysisQueue
      .catch(() => {})
      .then(async () => {
        for (const id of uniqueIds) await analyzeOne(id, options);
      });
    return uniqueIds.length;
  }

  async function record(rawEvents = [], { trusted = false } = {}) {
    const timestamp = now(), events = (Array.isArray(rawEvents) ? rawEvents : [])
      .slice(0, MAX_EVENTS_PER_REQUEST)
      .map((event) => safeEvent(event, timestamp))
      .filter(Boolean);
    if (!events.length) return { accepted: 0, opened: [], record: safeRecord(await readVersioned(RECORD_KEY, {}).then((entry) => entry.value)) };
    const opened = [];
    const recordValue = await change((record) => {
      const byFingerprint = new Map(record.items.map((item) => [item.fingerprint, item]));
      for (const event of events) {
        const previous = byFingerprint.get(event.fingerprint), reopened = previous && !OPEN_STATUSES.has(previous.status);
        const item = safeItem({
          ...previous,
          id: previous?.id || `diag-${event.fingerprint}`,
          ...event,
          status: previous ? (reopened ? 'open' : previous.status) : 'open',
          count: (previous?.count || 0) + 1,
          firstSeenAt: previous?.firstSeenAt || event.at,
          lastSeenAt: event.at,
          resolvedAt: reopened ? '' : previous?.resolvedAt,
          resolvedBy: reopened ? '' : previous?.resolvedBy,
          resolution: reopened ? '' : previous?.resolution,
        });
        byFingerprint.set(event.fingerprint, item);
        if (!previous || reopened) opened.push(item);
      }
      return {
        items: [...byFingerprint.values()],
        updatedAt: timestamp.toISOString(),
        lastIngestAt: timestamp.toISOString(),
      };
    });
    if (trusted && agentRuntime?.report) {
      for (const item of opened.slice(0, 10)) {
        await agentRuntime.report({
          event: 'work_progress',
          source: 'central-diagnostics',
          work: {
            id: `diagnostic:${item.fingerprint}`,
            channel: 'system',
            action: 'analiza błędu diagnostycznego',
            phase: 'triage',
            status: item.level === 'blad' ? 'failed' : 'attention',
            target: item.route || 'system',
            message: item.message,
            error: item.level === 'blad' ? item.message : '',
            attempt: item.count,
          },
        }).catch(() => {});
      }
    }
    if (trusted && diagnosticAgent?.status?.().configured) {
      enqueueAnalysis(opened.filter((item) => item.level === 'blad').map((item) => item.id), { deep: false, manual: false });
    }
    return { accepted: events.length, opened, record: recordValue };
  }

  async function route(req, url, action) {
    if (!['diagnostics-ingest', 'diagnostics-central', 'diagnostics-central-update', 'diagnostics-central-analyze'].includes(action)) return null;
    if (action === 'diagnostics-ingest') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = rateLimit?.(req, 'diagnostics-ingest', 180, 60 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({})), admin = isAdmin(req, url);
      const result = await record(body.events, { trusted: admin });
      return respond({ ok: true, accepted: result.accepted, opened: result.opened.length, summary: summary(result.record.items) }, 202);
    }
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (action === 'diagnostics-central') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const version = await readVersioned(RECORD_KEY, {}), recordValue = safeRecord(version.value);
      const status = clean(url.searchParams.get('status'), 30), level = clean(url.searchParams.get('level'), 30);
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 200));
      const items = recordValue.items
        .filter((item) => !status || status === 'all' || (status === 'open' ? OPEN_STATUSES.has(item.status) : item.status === status))
        .filter((item) => !level || level === 'all' || item.level === level)
        .slice(0, limit);
      return respond({ ok: true, items, summary: summary(recordValue.items), updatedAt: recordValue.updatedAt, version: String(version.etag || ''), agent: diagnosticAgent?.status?.() || { configured: false } });
    }
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({})), ids = new Set((Array.isArray(body.ids) ? body.ids : [body.id]).map((id) => clean(id, 80)).filter(Boolean));
    if (action === 'diagnostics-central-analyze') {
      if (!diagnosticAgent?.status?.().configured) return respond({ ok: false, error: 'Agent diagnostyczny OpenAI nie jest skonfigurowany.', code: 'openai_not_configured' }, 503);
      if (!ids.size) return respond({ ok: false, error: 'Wybierz co najmniej jeden błąd do analizy.' }, 422);
      const queued = enqueueAnalysis([...ids], { deep: true, manual: true });
      return respond({ ok: true, queued, agent: diagnosticAgent.status() }, 202);
    }
    const status = ['open', 'investigating', 'resolved', 'ignored'].includes(body.status) ? body.status : '';
    if (!ids.size || !status) return respond({ ok: false, error: 'Wybierz wpis i prawidłowy status.' }, 422);
    const at = now().toISOString(), actor = clean(sessionOf(req)?.email || 'administrator', 180), resolution = clean(body.resolution, 500);
    const updated = await change((recordValue) => ({
      ...recordValue,
      items: recordValue.items.map((item) => ids.has(item.id) ? safeItem({
        ...item,
        status,
        resolvedAt: ['resolved', 'ignored'].includes(status) ? at : '',
        resolvedBy: ['resolved', 'ignored'].includes(status) ? actor : '',
        resolution: ['resolved', 'ignored'].includes(status) ? resolution : '',
      }) : item),
      updatedAt: at,
    }));
    if (agentRuntime?.report) {
      for (const item of updated.items.filter((entry) => ids.has(entry.id))) {
        await agentRuntime.report({
          event: 'work_progress',
          source: 'central-diagnostics',
          work: {
            id: `diagnostic:${item.fingerprint}`,
            channel: 'system',
            action: 'analiza błędu diagnostycznego',
            phase: status,
            status: status === 'resolved' ? 'confirmed' : status === 'ignored' ? 'skipped' : 'attention',
            target: item.route || 'system',
            message: resolution || item.message,
            attempt: item.count,
          },
        }).catch(() => {});
      }
    }
    return respond({ ok: true, changed: ids.size, status, summary: summary(updated.items), updatedAt: updated.updatedAt });
  }

  return Object.freeze({ route, record, summary });
}
