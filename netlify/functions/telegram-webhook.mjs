import crypto from 'node:crypto';
import {
  sendTelegramHtml,
  telegramApi,
  telegramConfig,
  telegramNaturalIntent,
  telegramWebhookSecret,
} from './lib/domain/telegram-communication.mjs';

function equal(left = '', right = '') {
  const a = Buffer.from(String(left)), b = Buffer.from(String(right));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function response() {
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export default async (request) => {
  if (request.method !== 'POST') return response();
  const expected = telegramWebhookSecret(process.env), received = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!equal(received, expected)) return response();
  const update = await request.json().catch(() => ({})), callback = update.callback_query || null, message = callback?.message || update.message || null;
  if (!message?.chat?.id) return response();
  const config = telegramConfig(process.env), chatId = String(message.chat.id), allowed = config.allowedChatIds.has(chatId);
  if (!allowed) {
    await sendTelegramHtml('<b>🔒 Ten czat nie ma dostępu do Agenta Artway-TM.</b>\nDodaj jego ID do TELEGRAM_ALLOWED_CHAT_IDS albo korzystaj z autoryzowanej grupy.', { chatId, silent: true }, process.env).catch(() => null);
    return response();
  }
  if (callback?.id) await telegramApi('answerCallbackQuery', { callback_query_id: callback.id }, process.env).catch(() => null);
  const input = String(callback?.data || message.text || message.caption || '').trim();
  if (!input && message.voice) {
    await sendTelegramHtml('<b>🎙️ Wiadomość głosowa została odebrana.</b>\nTranskrypcja na serwerze jest wyłączona, aby nie generować płatnych kosztów API. Wyślij krótkie pytanie tekstem; bot rozumie zwykły język.', { chatId, replyTo: message.message_id }, process.env).catch(() => null);
    return response();
  }
  const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
  if (!token) {
    await sendTelegramHtml('⚠️ Agent nie ma dostępu do danych sklepu. Brakuje konfiguracji ARTWAY_ADMIN_TOKEN na serwerze.', { chatId, replyTo: message.message_id }, process.env).catch(() => null);
    return response();
  }
  try {
    const origin = new URL(request.url).origin, apiResponse = await fetch(`${origin}/api/store?action=telegram-inbound-command`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ intent: telegramNaturalIntent(input), text: input, chatId, user: message.from?.username || [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') }),
    });
    const data = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok || !data.ok) throw new Error(data.error || `HTTP ${apiResponse.status}`);
    await sendTelegramHtml(data.message, { chatId, replyTo: message.message_id, replyMarkup: data.replyMarkup }, process.env);
  } catch (error) {
    await sendTelegramHtml(`<b>⚠️ Nie udało się pobrać danych sklepu.</b>\n${String(error?.message || error).slice(0, 400)}`, { chatId, replyTo: message.message_id }, process.env).catch(() => null);
  }
  return response();
};

export const config = { path: '/.netlify/functions/telegram-webhook' };
