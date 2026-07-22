import { randomUUID } from 'node:crypto';
import { CODEX_SCENARIOS, planBackgroundCycleWithCodex } from '../../agent/codex-cycle-coordinator.js';
import { buildBackgroundTaskQueue } from './lib/background-agent-scheduler.mjs';

const origin = String(process.env.ARTWAY_LOCAL_API_ORIGIN || 'http://127.0.0.1:3000').replace(/\/$/, '');
const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
if (!token) throw new Error('Brak ARTWAY_ADMIN_TOKEN dla cyklu serwerowego');

const runId = `cycle-${randomUUID()}`;
const cycleStartedAt = Date.now();
const taskLabels = {
  'detektor-zdarzen': 'Lekka kontrola nowych zdarzeń',
  'planer-kolejki': 'Plan ograniczonej kolejki zadań',
  'koordynator-codex': 'Codex rozdziela pracę agentom GPT',
  'oferty-lekkie': 'Szybka kontrola ofert Allegro',
  'oferty-pelne': 'Dobowa pełna aktualizacja ofert',
  'agent-autonomiczny': 'Kontrola operacyjna katalogu',
  'tresci-gpt-nano': 'Redakcja małej porcji treści',
  'tresci-allegro': 'Aktualizacja zmienionych opisów Allegro',
  zamowienia: 'Nowe lub zmienione zamówienia Allegro',
  komunikacja: 'Nowe wiadomości i dyskusje',
};

const taskDefinition = (id, coordinatorPlan = null) => ({
  'tresci-gpt-nano': ['agent-specialist-auto-cycle', { source: 'event-queue', maxItems: 2, coordinatorPlan }, 125_000],
  'agent-autonomiczny': ['allegro-autonomous-agent-cycle', { source: 'event-queue', maxActions: 4 }, 120_000],
  'oferty-lekkie': ['allegro-sync-offers', { limit: 10_000, details: false, source: 'hourly-catalog-delta' }, 120_000],
  'oferty-pelne': ['allegro-sync-offers', { limit: 10_000, details: true, detailsLimit: 200, maintenanceLimit: 20, complianceLimit: 10, source: 'daily-bounded-offers-sync' }, 150_000],
}[id]);

async function adminGet(action, params = {}) {
  const url = new URL(`${origin}/api/store`);
  url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { 'x-admin-token': token }, signal: AbortSignal.timeout(30_000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(String(data?.error || `HTTP ${response.status}`).slice(0, 500));
  return data;
}

async function report(event, payload = {}) {
  try {
    const response = await fetch(`${origin}/api/store?action=agent-runtime-report`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ event, runId, source: 'vps-event-queue', ...payload }), signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch { return false; }
}

function publicError(error = '') {
  const message = String(error || '').slice(0, 300);
  if (/client authentication failed|unauthori[sz]ed|invalid[_ ]token|oauth/i.test(message)) return 'Autoryzacja Allegro wygasła — odnowienie połączenia jest wymagane w ustawieniach Allegro.';
  return message || 'Etap nie został wykonany.';
}

function changeCount(label, data = {}) {
  if (label === 'zamowienia') return Math.max(0, Number(data.imported_new || 0)) + Math.max(0, Number(data.refreshed || 0));
  if (label === 'komunikacja') return Math.max(0, Number(data.syncSummary?.newBuyerMessages || 0));
  if (label === 'tresci-gpt-nano') return Math.max(0, Number(data.cycle?.applied?.length || 0)) + Math.max(0, Number(data.cycle?.decisions?.length || 0));
  return Math.max(0, Number(data.changed ?? data.updated ?? data.autoMapped ?? 0));
}

async function run(label, action, body, timeoutMs = 120_000) {
  const started = Date.now();
  await report('cycle_step', { step: { id: label, label: taskLabels[label] || label, status: 'running', startedAt: new Date(started).toISOString() } });
  try {
    const response = await fetch(`${origin}/api/store?action=${encodeURIComponent(action)}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(String(data?.error || `HTTP ${response.status}`).slice(0, 500));
    const state = data?.state || {}, changes = changeCount(label, data);
    const result = {
      label, ok: true, skipped: !!(data?.skipped || data?.cycle?.skipped), durationMs: Date.now() - started,
      count: Number(data?.count ?? data?.fetched ?? data?.offers?.length ?? data?.cycle?.prepared?.length) || 0,
      changes, applied: Number(data?.cycle?.applied?.length || 0), mapped: Number(data?.autoMapped ?? state?.mapping?.autoMapped) || 0,
    };
    const detail = result.skipped ? 'Nie wykryto pracy — bez szerokiego ponownego zapisu.' : changes ? `Wykryto lub zapisano ${changes} zmian.` : `Sprawdzono ograniczoną porcję ${result.count} rekordów; brak nowych zmian.`;
    await report('cycle_step', { step: { id: label, label: taskLabels[label] || label, status: result.skipped ? 'skipped' : 'completed', startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), durationMs: result.durationMs, count: changes || result.count, detail } });
    return result;
  } catch (error) {
    const result = { label, ok: false, durationMs: Date.now() - started, changes: 0, error: publicError(error?.message || error) };
    const recoverable = /Autoryzacja Allegro wygasła/i.test(result.error);
    await report('cycle_step', { step: { id: label, label: taskLabels[label] || label, status: recoverable ? 'warning' : 'failed', startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), durationMs: result.durationMs, error: result.error } });
    return result;
  }
}

function fallbackCoordinatorPlan(snapshot = {}) {
  const assignments = [], add = (scenarioId, priority, reason) => {
    const definition = CODEX_SCENARIOS[scenarioId];
    if (definition) assignments.push({ scenarioId, scenarioVersion: definition.version, specialist: definition.specialist, priority, reason, automatic: definition.automatic, objective: definition.objective, qualityGates: [...definition.qualityGates] });
  };
  const summary = snapshot?.operations?.summary || {}, editorial = snapshot?.specialists?.lastCycle?.editorialProgress || {};
  if (Number(summary.communicationWaiting) > 0) add('customer-reply-draft', 1, 'Pojawiła się rozmowa wymagająca szkicu.');
  if (Number(editorial.pending) > 0 || !snapshot?.specialists?.lastCycle) add('catalog-editorial', 2, 'Kolejka treści ma oczekujące produkty.');
  add('catalog-identity-control', 3, 'Ograniczona kontrola identyfikacji bieżącej porcji.');
  return { coordinator: 'safe-fallback', coordinatorVersion: '2026-07-22.1', runId, summary: 'Bezpieczny plan małej porcji zadań.', assignments, confidence: 0 };
}

async function coordinatorCycle(snapshot) {
  const started = Date.now();
  await report('cycle_step', { step: { id: 'koordynator-codex', label: taskLabels['koordynator-codex'], status: 'running', startedAt: new Date(started).toISOString() } });
  try {
    const planned = await planBackgroundCycleWithCodex(snapshot, { timeoutMs: 30_000 });
    const plan = planned.ok ? { ...planned.plan, runId } : fallbackCoordinatorPlan(snapshot);
    await report('cycle_step', { step: { id: 'koordynator-codex', label: taskLabels['koordynator-codex'], status: planned.ok ? 'completed' : 'warning', startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - started, count: plan.assignments.length, detail: `${planned.ok ? 'Codex' : 'Plan awaryjny'} przydzielił ${plan.assignments.length} scenariusze dla jednej porcji pracy.` } });
    return { ok: planned.ok, plan, error: planned.ok ? '' : planned.reason };
  } catch (error) {
    const plan = fallbackCoordinatorPlan(snapshot);
    await report('cycle_step', { step: { id: 'koordynator-codex', label: taskLabels['koordynator-codex'], status: 'warning', startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - started, count: plan.assignments.length, error: publicError(error?.message || error), detail: 'Użyto ograniczonego planu awaryjnego.' } });
    return { ok: false, plan, error: publicError(error?.message || error) };
  }
}

let previousRuntime = {};
try { previousRuntime = (await adminGet('agent-runtime-status')).runtime || {}; } catch { previousRuntime = {}; }
await report('cycle_start', { steps: [
  { id: 'zamowienia', label: taskLabels.zamowienia }, { id: 'komunikacja', label: taskLabels.komunikacja },
  { id: 'planer-kolejki', label: taskLabels['planer-kolejki'] },
] });

// Te dwa wywołania są detektorami zmian i działają równolegle. Nie uruchamiają
// automatycznie pełnej kontroli 10 000 ofert ani całego katalogu.
const detectorResults = await Promise.all([
  run('zamowienia', 'allegro-sync-orders', { limit: 200, source: 'event-detector' }, 90_000),
  run('komunikacja', 'allegro-sync-communications', { limit: 20, autoReply: true, source: 'event-detector' }, 90_000),
]);

let specialists = {}, operations = {};
try { [specialists, operations] = await Promise.all([adminGet('agent-specialists-status', { historyLimit: 5 }), adminGet('agent-operations-summary')]); } catch { /* plan działa także na samym harmonogramie */ }
const planned = buildBackgroundTaskQueue({ runtime: previousRuntime, specialists, operations, detectorResults, maxJobs: 2 });
await report('cycle_step', { step: {
  id: 'planer-kolejki', label: taskLabels['planer-kolejki'], status: 'completed', startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
  count: planned.queue.length, detail: planned.queue.length ? `Wybrano: ${planned.queue.map((item) => taskLabels[item.id]).join(' → ')}. Odłożono: ${planned.deferred.length}.` : 'Brak konkretnego zadania do wykonania. Ciężkie kontrole pominięto.',
} });

const results = [...detectorResults];
let coordinator = null;
if (planned.queue.some((item) => item.id === 'tresci-gpt-nano')) {
  coordinator = await coordinatorCycle({ specialists, operations });
  results.push({ label: 'koordynator-codex', ok: coordinator.ok, warning: !coordinator.ok, count: coordinator.plan?.assignments?.length || 0, error: coordinator.error || '' });
}
for (const job of planned.queue) {
  const [action, body, timeout] = taskDefinition(job.id, coordinator?.plan || null);
  const result = await run(job.id, action, body, timeout);
  results.push(result);
  if (job.id === 'tresci-gpt-nano' && result.applied > 0) results.push(await run('tresci-allegro', 'allegro-auto-maintenance', { limit: 12, source: 'changed-editorial-only' }, 90_000));
}

const failed = results.filter((result) => !result.ok);
const hardFailure = failed.length >= 3;
const status = hardFailure ? 'failed' : failed.length ? 'degraded' : 'completed';
const summary = planned.queue.length
  ? `Detektory wykryły ${planned.changes} zmian; wykonano ${planned.queue.length} zadań z ograniczonej kolejki${planned.deferred.length ? `, ${planned.deferred.length} odłożono` : ''}.`
  : `Detektory wykryły ${planned.changes} zmian; ciężkie kontrole nie były potrzebne.`;
await report('cycle_finish', { status, summary: failed.length ? `${summary} ${failed.length} etap(y) wymagają uwagi.` : summary, durationMs: Date.now() - cycleStartedAt });
process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ok: !hardFailure, status, queue: planned.queue, deferred: planned.deferred, results })}\n`);
if (hardFailure) process.exitCode = 1;
