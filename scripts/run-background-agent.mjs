import { randomUUID } from 'node:crypto';
import { CODEX_SCENARIOS, planBackgroundCycleWithCodex } from '../../agent/codex-cycle-coordinator.js';

const origin = String(process.env.ARTWAY_LOCAL_API_ORIGIN || 'http://127.0.0.1:3000').replace(/\/$/, '');
const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
if (!token) throw new Error('Brak ARTWAY_ADMIN_TOKEN dla cyklu serwerowego');

const runId = `cycle-${randomUUID()}`;
const cycleStartedAt = Date.now();

let tasks = [
  ['oferty-lekkie', 'allegro-sync-offers', { limit: 10000, details: false, source: 'scheduled-catalog-refresh' }],
  ['tresci-gpt-nano', 'agent-specialist-auto-cycle', { source: 'vps-systemd-timer' }],
  ['tresci-allegro', 'allegro-auto-maintenance', { limit: 50, source: 'scheduled-editorial-sync' }],
  ['oferty-pelne', 'allegro-sync-offers', { limit: 10000, details: true, detailsLimit: 1000, maintenanceLimit: 50, complianceLimit: 20, source: 'scheduled-offers-sync' }],
  ['agent-autonomiczny', 'allegro-autonomous-agent-cycle', { source: 'vps-systemd-timer', maxActions: 10 }],
  ['zamowienia', 'allegro-sync-orders', { limit: 200, source: 'scheduled-stock-agent' }],
  ['komunikacja', 'allegro-sync-communications', { limit: 20, autoReply: true, source: 'scheduled-communications' }],
];

const taskLabels = {
  'koordynator-codex': 'Codex rozdziela pracę agentom GPT',
  'oferty-lekkie': 'Szybka kontrola ofert Allegro',
  'oferty-pelne': 'Pełna aktualizacja danych ofert',
  'agent-autonomiczny': 'Autonomiczna kontrola katalogu',
  'tresci-gpt-nano': 'Szkice treści przez specjalistów GPT-5 nano',
  'tresci-allegro': 'Zapis gotowych opisów w ofertach Allegro',
  zamowienia: 'Nowe zamówienia i stany Allegro',
  komunikacja: 'Nowe wiadomości i dyskusje',
};

async function adminGet(action, params = {}) {
  const url = new URL(`${origin}/api/store`);
  url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { 'x-admin-token': token }, signal: AbortSignal.timeout(30_000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(String(data?.error || `HTTP ${response.status}`).slice(0, 500));
  return data;
}

function fallbackCoordinatorPlan(snapshot = {}) {
  const assignments = [], add = (scenarioId, priority, reason) => {
    const definition = CODEX_SCENARIOS[scenarioId];
    if (definition) assignments.push({ scenarioId, scenarioVersion: definition.version, specialist: definition.specialist, priority, reason, automatic: definition.automatic, objective: definition.objective, qualityGates: [...definition.qualityGates] });
  };
  const summary = snapshot?.operations?.summary || {}, editorial = snapshot?.specialists?.lastCycle?.editorialProgress || {};
  if (Number(summary.communicationWaiting) > 0) add('customer-reply-draft', 1, 'Klient czeka na szkic odpowiedzi.');
  if (Number(editorial.pending) > 0 || !snapshot?.specialists?.lastCycle) add('catalog-editorial', 2, 'Katalog ma pozycje oczekujące na redakcję.');
  add('catalog-identity-control', 3, 'Stała bezpieczna kontrola identyfikacji katalogu.');
  if (Number(summary.supplierOrders) > 0) add('supplier-order-draft', 4, 'Plan zawiera aktywny dokument producenta.');
  return { coordinator: 'safe-fallback', coordinatorVersion: '2026-07-21.1', runId, summary: 'Codex był chwilowo niedostępny; wykonano wyłącznie bezpieczny plan awaryjny.', assignments, confidence: 0 };
}

async function coordinatorCycle() {
  const started = Date.now();
  await report('cycle_step', { step: { id: 'koordynator-codex', label: taskLabels['koordynator-codex'], status: 'running', startedAt: new Date(started).toISOString() } });
  try {
    const [specialists, operations] = await Promise.all([
      adminGet('agent-specialists-status', { historyLimit: 5 }),
      adminGet('agent-operations-summary'),
    ]);
    const planned = await planBackgroundCycleWithCodex({ specialists, operations }, { timeoutMs: 30_000 });
    const plan = planned.ok ? { ...planned.plan, runId } : fallbackCoordinatorPlan({ specialists, operations });
    await report('cycle_step', { step: {
      id: 'koordynator-codex', label: taskLabels['koordynator-codex'], status: planned.ok ? 'completed' : 'warning',
      startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - started,
      count: plan.assignments.length, detail: `${planned.ok ? 'Codex' : 'Plan awaryjny'} przydzielił ${plan.assignments.length} scenariusze GPT. ${plan.summary}`,
    } });
    return { ok: planned.ok, plan, error: planned.ok ? '' : planned.reason };
  } catch (error) {
    const plan = fallbackCoordinatorPlan();
    await report('cycle_step', { step: {
      id: 'koordynator-codex', label: taskLabels['koordynator-codex'], status: 'warning',
      startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - started,
      count: plan.assignments.length, error: publicError(error?.message || error), detail: 'Uruchomiono ograniczony plan awaryjny.',
    } });
    return { ok: false, plan, error: publicError(error?.message || error) };
  }
}

async function report(event, payload = {}) {
  try {
    const response = await fetch(`${origin}/api/store?action=agent-runtime-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ event, runId, source: 'vps-systemd-timer', ...payload }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function publicError(error = '') {
  const message = String(error || '').slice(0, 300);
  if (/client authentication failed|unauthori[sz]ed|invalid[_ ]token|oauth/i.test(message)) {
    return 'Autoryzacja Allegro wygasła — odnowienie połączenia jest wymagane w ustawieniach Allegro.';
  }
  return message || 'Etap nie został wykonany.';
}

async function run(label, action, body) {
  const started = Date.now();
  await report('cycle_step', {
    step: { id: label, label: taskLabels[label] || label, status: 'running', startedAt: new Date(started).toISOString() },
  });
  try {
    const response = await fetch(`${origin}/api/store?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(String(data?.error || `HTTP ${response.status}`).slice(0, 500));
    const state = data?.state || {};
    const result = { label, ok: true, skipped: !!(data?.skipped || data?.cycle?.skipped), durationMs: Date.now() - started, count: Number(data?.count ?? data?.fetched ?? data?.offers?.length ?? data?.cycle?.prepared?.length) || 0, mapped: Number(data?.autoMapped ?? state?.mapping?.autoMapped) || 0, duplicatesEnded: Number(state?.duplicateOffersEnded) || 0, review: Number(state?.reviewCount) || 0 };
    await report('cycle_step', {
      step: {
        id: label,
        label: taskLabels[label] || label,
        status: result.skipped ? 'skipped' : 'completed',
        startedAt: new Date(started).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: result.durationMs,
        count: result.count,
        detail: result.skipped ? 'Brak nowych danych — etap pominięty bez ponownego zapisu.' : `Przetworzono ${result.count} rekordów.`,
      },
    });
    return result;
  } catch (error) {
    const result = { label, ok: false, durationMs: Date.now() - started, error: publicError(error?.message || error) };
    const recoverable = /Autoryzacja Allegro wygasła/i.test(result.error);
    await report('cycle_step', {
      step: {
        id: label,
        label: taskLabels[label] || label,
        status: recoverable ? 'warning' : 'failed',
        startedAt: new Date(started).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: result.durationMs,
        error: result.error,
      },
    });
    return result;
  }
}

await report('cycle_start', { steps: ['koordynator-codex', ...tasks.map(([id]) => id)].map((id) => ({ id, label: taskLabels[id] || id })) });
const coordinator = await coordinatorCycle();
tasks = tasks.map((task) => task[0] === 'tresci-gpt-nano'
  ? [task[0], task[1], { ...task[2], coordinatorPlan: coordinator.plan }]
  : task);
const results = [];
for (const task of tasks) results.push(await run(...task));
results.unshift({ label: 'koordynator-codex', ok: coordinator.ok, warning: !coordinator.ok, count: coordinator.plan?.assignments?.length || 0, error: coordinator.error || '' });
const failed = results.filter((result) => !result.ok);
const hardFailure = failed.some((result) => result.label === 'agent-autonomiczny') || failed.length >= 3;
const status = hardFailure ? 'failed' : failed.length ? 'degraded' : 'completed';
const summary = hardFailure
  ? `${failed.length} z ${results.length} etapów nie zostało wykonanych.`
  : failed.length
    ? `Agent działa; ${failed.length} integracje wymagają uwagi administratora.`
    : `Wszystkie ${results.length} etapów wykonano prawidłowo.`;
await report('cycle_finish', { status, summary, durationMs: Date.now() - cycleStartedAt });
process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ok: !hardFailure, status, results })}\n`);
if (hardFailure) process.exitCode = 1;
