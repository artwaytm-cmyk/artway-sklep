const REPAIR_STATUSES = new Set(['idle', 'queued', 'running', 'testing', 'ready', 'deploying', 'completed', 'failed']);

const clean = (value = '', limit = 700) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
const iso = (value = '') => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
};

export function diagnosticCodeRepairStatus(value = '') {
  return REPAIR_STATUSES.has(value) ? value : '';
}

export function normalizeDiagnosticCodeRepair(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    status: diagnosticCodeRepairStatus(source.status) || 'idle',
    jobId: clean(source.jobId, 160), requestedAt: iso(source.requestedAt), startedAt: iso(source.startedAt),
    testedAt: iso(source.testedAt), deployedAt: iso(source.deployedAt), commit: clean(source.commit, 80),
    release: clean(source.release, 120), summary: clean(source.summary, 700), error: clean(source.error, 700),
    automatic: source.automatic === true,
  };
}
