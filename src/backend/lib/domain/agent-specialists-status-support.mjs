import { activeDecision, clean } from './agent-specialists-support.mjs';

function statusDecisionData(current = {}, decisions = [], historyLimit = 30, at = new Date()) {
  const activeDecisions = decisions.filter((item) => activeDecision(item, at)).slice(0, 80);
  const referencedRunIds = new Set(activeDecisions.map((item) => clean(item.runId, 120)).filter(Boolean));
  const history = Array.isArray(current.history) ? current.history : [];
  const statusHistory = [...history.slice(0, historyLimit), ...history.filter((item) => referencedRunIds.has(clean(item?.id, 120)))]
    .filter((item, index, rows) => rows.findIndex((candidate) => candidate?.id === item?.id) === index);
  return { activeDecisions, statusHistory };
}

function automaticBatchLimit(configured = 1, requested) {
  const parsed = Number(requested);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(configured, Math.trunc(parsed))) : configured;
}

export { automaticBatchLimit, statusDecisionData };
