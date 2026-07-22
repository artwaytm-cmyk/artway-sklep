const MINUTE = 60_000;

const JOBS = Object.freeze({
  'tresci-gpt-nano': { intervalMinutes: 15, priority: 100 },
  'agent-autonomiczny': { intervalMinutes: 60, priority: 70 },
  'oferty-lekkie': { intervalMinutes: 60, priority: 55 },
  'oferty-pelne': { intervalMinutes: 24 * 60, priority: 40 },
});

function dateMs(value = '') {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function lastStepAt(runtime = {}, id = '') {
  const runs = [runtime?.lastRun, ...(Array.isArray(runtime?.history) ? runtime.history : [])].filter(Boolean);
  let latest = 0;
  for (const run of runs) {
    for (const step of Array.isArray(run?.steps) ? run.steps : []) {
      if (step?.id !== id || !['completed', 'skipped', 'warning'].includes(step?.status)) continue;
      latest = Math.max(latest, dateMs(step.completedAt || run.completedAt));
    }
  }
  return latest;
}

function detectorChanges(results = []) {
  return (Array.isArray(results) ? results : []).reduce((sum, item) => sum + Math.max(0, Number(item?.changes || 0)), 0);
}

function buildBackgroundTaskQueue({ runtime = {}, specialists = {}, operations = {}, detectorResults = [], now = new Date(), maxJobs = 2 } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : dateMs(now) || Date.now();
  const pendingEditorial = Math.max(0, Number(specialists?.lastCycle?.editorialProgress?.pending || 0));
  const changes = detectorChanges(detectorResults);
  const operational = operations?.summary || operations || {};
  const hasOperationalWork = [operational.activeAllegro, operational.communicationWaiting, operational.offerTasks, operational.supplierOrders]
    .some((value) => Number(value || 0) > 0);
  const candidates = [];

  const addIfDue = (id, enabled = true, eventBoost = 0, forceForEvent = false) => {
    if (!enabled) return;
    const definition = JOBS[id], previous = lastStepAt(runtime, id);
    const ageMinutes = previous ? Math.max(0, (nowMs - previous) / MINUTE) : Number.POSITIVE_INFINITY;
    if (previous && ageMinutes < definition.intervalMinutes && !forceForEvent) return;
    const overdue = Number.isFinite(ageMinutes) ? Math.min(100, ageMinutes / definition.intervalMinutes * 10) : 100;
    candidates.push({ id, priority: definition.priority + eventBoost + overdue, dueBecause: previous ? `minęło ${Math.floor(ageMinutes)} min` : 'pierwsze wykonanie' });
  };

  // Konkretne nowe zdarzenie ma pierwszeństwo. Bez zmian katalog jest obrabiany
  // sukcesywnie w małych porcjach, a nie szerokim przebiegiem wszystkich usług.
  addIfDue('tresci-gpt-nano', changes > 0 || pendingEditorial > 0, changes > 0 ? 80 : 0, changes > 0);
  addIfDue('agent-autonomiczny', changes > 0 || hasOperationalWork, changes > 0 ? 35 : 0, changes > 0);
  addIfDue('oferty-pelne', true);
  addIfDue('oferty-lekkie', true);

  const fullDue = candidates.some((item) => item.id === 'oferty-pelne');
  const unique = candidates
    .filter((item) => !(fullDue && item.id === 'oferty-lekkie'))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return {
    changes,
    pendingEditorial,
    queue: unique.slice(0, Math.max(1, Math.min(3, Number(maxJobs) || 2))),
    deferred: unique.slice(Math.max(1, Math.min(3, Number(maxJobs) || 2))),
  };
}

export { JOBS, buildBackgroundTaskQueue, detectorChanges, lastStepAt };
