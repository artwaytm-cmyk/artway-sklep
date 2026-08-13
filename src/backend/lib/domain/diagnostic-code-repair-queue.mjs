import crypto from 'node:crypto';

export const DIAGNOSTIC_CODE_REPAIR_KIND = 'diagnostic-code-repair-v1';

const clean = (value = '', limit = 700) => String(value ?? '')
  .replace(/\b(?:sk|sk-proj|sk-ant|xai)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
  .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{10,}=*/gi, 'Bearer [ukryty]')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, limit);

export function diagnosticCodeRepairContext(item = {}, options = {}) {
  return {
    kind: DIAGNOSTIC_CODE_REPAIR_KIND,
    diagnosticId: clean(item.id, 80),
    fingerprint: clean(item.fingerprint, 80),
    level: clean(item.level, 30),
    message: clean(item.message),
    source: clean(item.source, 180),
    route: clean(item.route, 300),
    release: clean(item.release, 120),
    occurrences: Math.max(1, Number(item.count) || 1),
    lastSeenAt: clean(item.lastSeenAt, 60),
    analysis: {
      classification: clean(item.analysis?.classification, 80),
      rootCause: clean(item.analysis?.rootCause, 1200),
      summary: clean(item.analysis?.summary, 700),
      confidence: Math.max(0, Math.min(1, Number(item.analysis?.confidence) || 0)),
      evidence: (Array.isArray(item.analysis?.evidence) ? item.analysis.evidence : []).slice(0, 8).map((value) => clean(value, 400)),
      validationPlan: (Array.isArray(item.analysis?.validationPlan) ? item.analysis.validationPlan : []).slice(0, 8).map((value) => clean(value, 400)),
    },
    automatic: options.automatic === true,
  };
}

export function parseDiagnosticCodeRepairContext(value = '') {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed?.kind === DIAGNOSTIC_CODE_REPAIR_KIND && parsed?.diagnosticId ? diagnosticCodeRepairContext({
      id: parsed.diagnosticId,
      fingerprint: parsed.fingerprint,
      level: parsed.level,
      message: parsed.message,
      source: parsed.source,
      route: parsed.route,
      release: parsed.release,
      count: parsed.occurrences,
      lastSeenAt: parsed.lastSeenAt,
      analysis: parsed.analysis,
    }, { automatic: parsed.automatic }) : null;
  } catch {
    return null;
  }
}

export async function enqueueDiagnosticCodeRepair(queue, item = {}, options = {}) {
  if (!queue || typeof queue.enqueue !== 'function') throw new Error('Brakuje trwałej kolejki Agenta kodu.');
  const context = diagnosticCodeRepairContext(item, options);
  if (context.analysis.classification !== 'application_bug') throw new Error('Agent kodu przyjmuje wyłącznie potwierdzone błędy aplikacji.');
  const fingerprint = crypto.createHash('sha256').update(`${context.diagnosticId}|${context.lastSeenAt}|${context.message}`).digest('hex').slice(0, 20);
  const queued = await queue.enqueue({
    requestId: `diagnostic-code-repair:${fingerprint}`,
    text: `[NAPRAWA KODU] ${context.message}`,
    context: JSON.stringify(context),
    channel: 'panel',
    user: options.automatic ? 'Agent diagnostyczny' : 'administrator',
  });
  return { jobId: queued.job?.id || '', status: queued.status, duplicate: queued.duplicate === true, workerOnline: queued.workerOnline === true };
}
