import test from 'node:test';
import assert from 'node:assert/strict';
import { runTelegramServerWatchdog } from '../scripts/telegram-server-watchdog.mjs';

const env = {
  ARTWAY_PUBLIC_ORIGIN: 'https://artwaytm.pl',
  ARTWAY_LOCAL_API_ORIGIN: 'http://127.0.0.1:3000',
  ARTWAY_ADMIN_TOKEN: 'admin-test',
  TELEGRAM_BOT_TOKEN: '123:test',
};

test('watchdog nie zmienia poprawnego webhooka i potwierdza serwerowego Agenta', async () => {
  const calls = [];
  const result = await runTelegramServerWatchdog({
    env,
    fetchImpl: async (url) => new Response(JSON.stringify(url.endsWith('/healthz')
      ? { ok: true }
      : { ok: true, agentWorker: { workerOnline: true } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    telegramApiImpl: async (method) => {
      calls.push(method);
      if (method === 'getMe') return { is_bot: true };
      return { url: 'https://artwaytm.pl/api/telegram/webhook', pending_update_count: 0 };
    },
    serviceController: () => ({ ok: true }),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['getMe', 'getWebhookInfo']);
  assert.deepEqual(result.repairs, []);
});

test('watchdog sam odbudowuje brakujący webhook bez usuwania oczekujących wiadomości', async () => {
  const calls = [];
  const result = await runTelegramServerWatchdog({
    env,
    fetchImpl: async (url) => new Response(JSON.stringify(url.endsWith('/healthz')
      ? { ok: true }
      : { ok: true, agentWorker: { workerOnline: true } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    telegramApiImpl: async (method, payload) => {
      calls.push([method, payload]);
      if (method === 'getMe') return { is_bot: true };
      if (method === 'getWebhookInfo') return { url: '', pending_update_count: 2 };
      if (method === 'setWebhook') return true;
      throw new Error('unexpected');
    },
    serviceController: () => ({ ok: true }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.webhook, 'repaired');
  assert.equal(calls[2][0], 'setWebhook');
  assert.equal(calls[2][1].drop_pending_updates, false);
});
