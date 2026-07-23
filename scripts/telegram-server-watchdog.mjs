import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { telegramApi, telegramWebhookSecret } from '../src/backend/lib/domain/telegram-communication.mjs';

const BACKEND_SERVICE = 'artway-backend.service';
const AGENT_SERVICE = 'artway-agent.service';

function normalizedOrigin(value = '') {
  return String(value || 'https://artwaytm.pl').trim().replace(/\/$/, '');
}

function systemd(action, unit) {
  const result = spawnSync('/usr/bin/systemctl', [action, unit], { encoding: 'utf8', timeout: 20_000 });
  return { ok: result.status === 0, status: result.status, output: String(result.stdout || result.stderr || '').trim().slice(0, 500) };
}

async function jsonRequest(url, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, { ...options, signal: options.signal || AbortSignal.timeout(12_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(String(body?.error || `HTTP ${response.status}`).slice(0, 300));
  return body;
}

export async function runTelegramServerWatchdog({
  env = process.env,
  fetchImpl = fetch,
  telegramApiImpl = telegramApi,
  serviceController = systemd,
} = {}) {
  const origin = normalizedOrigin(env.ARTWAY_PUBLIC_ORIGIN);
  const localOrigin = normalizedOrigin(env.ARTWAY_LOCAL_API_ORIGIN || 'http://127.0.0.1:3000');
  const webhookUrl = `${origin}/api/telegram/webhook`;
  const report = {
    at: new Date().toISOString(),
    backend: 'unknown',
    agent: 'unknown',
    telegram: 'unknown',
    webhook: 'unknown',
    repairs: [],
  };

  try {
    const health = await jsonRequest(`${localOrigin}/healthz`, {}, fetchImpl);
    report.backend = health?.ok === true ? 'online' : 'degraded';
  } catch {
    const repair = serviceController('restart', BACKEND_SERVICE);
    report.repairs.push({ component: 'backend', ok: repair.ok });
    report.backend = repair.ok ? 'restarted' : 'offline';
  }

  const agentActive = serviceController('is-active', AGENT_SERVICE);
  if (!agentActive.ok) {
    const repair = serviceController('restart', AGENT_SERVICE);
    report.repairs.push({ component: 'agent', ok: repair.ok });
    report.agent = repair.ok ? 'restarted' : 'offline';
  } else {
    report.agent = 'online';
  }

  if (report.backend !== 'offline' && env.ARTWAY_ADMIN_TOKEN) {
    try {
      const status = await jsonRequest(`${localOrigin}/api/store?action=telegram-center-status&live=1`, {
        headers: { accept: 'application/json', 'x-admin-token': String(env.ARTWAY_ADMIN_TOKEN) },
      }, fetchImpl);
      if (status?.agentWorker?.workerOnline !== true) {
        const repair = serviceController('restart', AGENT_SERVICE);
        report.repairs.push({ component: 'agent-heartbeat', ok: repair.ok });
        report.agent = repair.ok ? 'restarted' : 'offline';
      }
    } catch (error) {
      report.agentStatusError = String(error?.message || error).slice(0, 180);
    }
  }

  try {
    const [bot, webhook] = await Promise.all([
      telegramApiImpl('getMe', {}, env),
      telegramApiImpl('getWebhookInfo', {}, env),
    ]);
    report.telegram = bot?.is_bot === true ? 'online' : 'degraded';
    const needsRepair = String(webhook?.url || '') !== webhookUrl;
    if (needsRepair) {
      const secret = telegramWebhookSecret(env);
      if (!secret) throw new Error('Brak bezpiecznego sekretu webhooka.');
      await telegramApiImpl('setWebhook', {
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
        max_connections: 20,
      }, env);
      report.repairs.push({ component: 'telegram-webhook', ok: true });
      report.webhook = 'repaired';
    } else {
      report.webhook = 'online';
    }
    report.pendingUpdates = Math.max(0, Number(webhook?.pending_update_count) || 0);
  } catch (error) {
    report.telegram = 'offline';
    report.webhook = 'offline';
    report.telegramError = String(error?.message || error).slice(0, 180);
  }

  report.ok = !['offline'].includes(report.backend)
    && !['offline'].includes(report.agent)
    && report.telegram === 'online'
    && ['online', 'repaired'].includes(report.webhook);
  return report;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const result = await runTelegramServerWatchdog();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}
