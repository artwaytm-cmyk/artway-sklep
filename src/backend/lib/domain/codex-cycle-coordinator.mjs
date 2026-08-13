import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(MODULE_DIR, 'codex-cycle-plan.schema.json');
const CODEX_BIN = '/usr/local/bin/codex';
const MAX_OUTPUT_BYTES = 64 * 1024;

export const CODEX_SCENARIOS = Object.freeze({
  'catalog-editorial': Object.freeze({ version: '2026-07-28.1', specialist: 'product_content', automatic: true, objective: 'Przygotuj i zapisz bezpieczną treść produktu na podstawie potwierdzonych faktów.', qualityGates: ['rozpoznana tożsamość', 'opis krótki i pełny', 'zgodność kanału', 'brak danych kontaktowych'] }),
  'customer-reply-draft': Object.freeze({ version: '2026-07-28.1', specialist: 'customer_reply', automatic: false, objective: 'Przeanalizuj rozmowę i fakty zamówienia; przygotuj szkic bez wysyłki.', qualityGates: ['pełny kontekst rozmowy', 'potwierdzony status zamówienia i przesyłki', 'brak niepotwierdzonych obietnic'] }),
  'catalog-identity-control': Object.freeze({ version: '2026-07-28.1', specialist: 'catalog_quality', automatic: true, objective: 'Wykryj pewne braki identyfikacji i nie zgaduj parametrów produktu.', qualityGates: ['jednoznaczny produkt', 'dowody zamiast podobieństwa nazwy', 'decyzja tylko przy realnym braku'] }),
  'supplier-order-draft': Object.freeze({ version: '2026-07-28.1', specialist: 'supplier_message', automatic: false, objective: 'Przygotuj krótki szablon wokół kanonicznej tabeli Planu zatowarowania.', qualityGates: ['kod, nazwa, ilość', 'bez cen', 'bez zmiany rewizji dokumentu', 'wysyłka wymaga potwierdzenia'] }),
  'seo-free-promotion': Object.freeze({ version: '2026-07-28.1', specialist: 'seo_promotion', automatic: true, objective: 'Przygotuj bezpłatne SEO wyłącznie na podstawie faktów produktu.', qualityGates: ['naturalny język', 'brak niepotwierdzonych przewag', 'brak płatnej promocji'] }),
});

const safeText = (value = '', limit = 240) => String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, limit);
const safeNumber = (value = 0, max = 1_000_000) => Math.max(0, Math.min(max, Number(value) || 0));

export function coordinatorSnapshot(input = {}) {
  const summary = input?.operations?.summary || {};
  const specialists = input?.specialists || {};
  return Object.freeze({
    newOrders: safeNumber(summary.newOrders),
    activeAllegro: safeNumber(summary.activeAllegro),
    communicationWaiting: safeNumber(summary.communicationWaiting),
    supplierNeedsDecision: safeNumber(summary.supplierNeedsDecision),
    producerLinks: safeNumber(summary.producerLinks),
    offerTasks: safeNumber(summary.offerTasks),
    editorial: {
      total: safeNumber(specialists?.lastCycle?.editorialProgress?.total),
      ready: safeNumber(specialists?.lastCycle?.editorialProgress?.ready),
      pending: safeNumber(specialists?.lastCycle?.editorialProgress?.pending),
      review: safeNumber(specialists?.lastCycle?.editorialProgress?.review),
    },
    openDecisions: safeNumber(specialists?.decisionStats?.open),
    highDecisions: safeNumber(specialists?.decisionStats?.high),
    lastCycleStatus: safeText(specialists?.lastCycle?.status || 'unknown', 40),
  });
}

export function createCoordinatorPrompt(snapshot = {}) {
  const registry = Object.entries(CODEX_SCENARIOS).map(([scenarioId, value]) => ({ scenarioId, ...value }));
  return [
    'Jesteś nadrzędnym koordynatorem i właścicielem wyniku Codex sklepu Artway-TM.',
    'Codex rozpoznaje zamiar, ustala kolejność, deleguje ograniczone podzadania wyspecjalizowanym agentom i odpowiada za kontrolę wyniku. Agenci są wyłącznie pomocnikami.',
    'Operacje deterministyczne i trwałe zapisy wykonują kontrolowane usługi domenowe sklepu; nie wolno zastępować ich swobodnym tekstem modelu.',
    'Przydzielasz pracę wyłącznie do zamkniętego rejestru scenariuszy i odbierasz ją według bramek jakości.',
    'Zwróć tylko JSON zgodny ze schematem. Nie używaj narzędzi ani danych spoza wejścia.',
    'Każdy scenarioId może wystąpić najwyżej raz. Priorytet 1 oznacza najwyższy.',
    'Wybieraj tylko pracę potwierdzoną licznikami. Nie zlecaj wysyłek, płatności, publikacji ani zmian magazynowych.',
    'Jeśli są oczekujące opisy, wybierz catalog-editorial. Jeśli klient czeka, wybierz customer-reply-draft.',
    'supplier-order-draft wybierz tylko dla realnych braków aktywnych zamówień.',
    `Rejestr scenariuszy: ${JSON.stringify(registry)}`,
    `Bezpieczne liczniki: ${JSON.stringify(coordinatorSnapshot(snapshot))}`,
  ].join('\n');
}

export function validateCoordinatorPlan(candidate = {}) {
  if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.assignments)) {
    throw new Error('codex_coordinator_invalid_plan');
  }
  const used = new Set();
  const assignments = [];
  for (const raw of candidate.assignments.slice(0, 6)) {
    const scenarioId = safeText(raw?.scenarioId, 80);
    const definition = CODEX_SCENARIOS[scenarioId];
    if (!definition || used.has(scenarioId)) continue;
    used.add(scenarioId);
    assignments.push(Object.freeze({
      scenarioId,
      scenarioVersion: definition.version,
      specialist: definition.specialist,
      priority: Math.max(1, Math.min(5, Number(raw?.priority) || 5)),
      reason: safeText(raw?.reason, 180),
      automatic: definition.automatic,
      objective: definition.objective,
      qualityGates: [...definition.qualityGates],
    }));
  }
  return Object.freeze({
    summary: safeText(candidate.summary || 'Codex przydzielił zadania do scenariuszy.', 240),
    assignments: Object.freeze(assignments.sort((left, right) => left.priority - right.priority)),
    confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0)),
    coordinator: 'codex',
    coordinatorVersion: '2026-07-28.1',
    plannedAt: new Date().toISOString(),
  });
}

function parseStructuredOutput(raw = '') {
  const source = String(raw || '').trim();
  for (let start = 0; start < source.length; start += 1) {
    if (source[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}' && --depth === 0) return JSON.parse(source.slice(start, index + 1));
    }
  }
  throw new Error('codex_coordinator_invalid_output');
}

function safeChildEnv(env = process.env) {
  const result = {
    PATH: env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: env.HOME || '',
    LANG: env.LANG || 'pl_PL.UTF-8',
    LC_ALL: env.LC_ALL || '',
    NO_COLOR: '1',
  };
  if (env.CODEX_HOME) result.CODEX_HOME = env.CODEX_HOME;
  return result;
}

function runCodex(prompt, { env = process.env, timeoutMs = 25_000, cwd } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let outputBytes = 0;
    let settled = false;
    const child = spawn(CODEX_BIN, [
      'exec', '--sandbox', 'read-only', '--ephemeral', '--ignore-user-config', '--ignore-rules',
      '--skip-git-repo-check', '--output-schema', SCHEMA_PATH, '--color', 'never',
      '--cd', cwd, '-c', 'shell_environment_policy.inherit="none"', '-',
    ], { cwd, env: safeChildEnv(env), stdio: ['pipe', 'pipe', 'pipe'] });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ ok: false, reason: 'timeout', stdout: '' });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      if (settled) return;
      stdout += chunk.toString('utf8');
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill('SIGKILL');
        finish({ ok: false, reason: 'output_limit', stdout: '' });
      }
    });
    child.stderr.on('data', (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill('SIGKILL');
        finish({ ok: false, reason: 'output_limit', stdout: '' });
      }
    });
    child.on('error', () => finish({ ok: false, reason: 'unavailable', stdout: '' }));
    child.on('close', (code) => finish({ ok: code === 0, reason: code === 0 ? '' : 'codex_failed', stdout: code === 0 ? stdout : '' }));
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
  });
}

export async function planBackgroundCycleWithCodex(snapshot = {}, options = {}) {
  const isolatedRoot = await mkdtemp(join(tmpdir(), 'artway-cycle-coordinator-'));
  try {
    const result = await runCodex(createCoordinatorPrompt(snapshot), {
      env: options.env || process.env,
      timeoutMs: Math.max(10_000, Math.min(45_000, Number(options.timeoutMs) || 25_000)),
      cwd: isolatedRoot,
    });
    if (!result.ok) return { ok: false, reason: result.reason || 'codex_failed', plan: null };
    return { ok: true, plan: validateCoordinatorPlan(parseStructuredOutput(result.stdout)) };
  } catch {
    return { ok: false, reason: 'invalid_plan', plan: null };
  } finally {
    await rm(isolatedRoot, { recursive: true, force: true }).catch(() => {});
  }
}
