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
  const config = telegramConfig(process.env), chatId = String(message.chat.id), sender = callback?.from || message.from || {}, userId = String(sender.id || '');
  const allowed = config.allowedChatIds.has(chatId) && (!config.allowedUserIds.size || config.allowedUserIds.has(userId));
  if (!allowed) {
    await sendTelegramHtml('<b>🔒 Brak dostępu do bota.</b>', { chatId, silent: true }, process.env).catch(() => null);
    return response();
  }
  const input = String(callback?.data || message.text || message.caption || '').trim();
  if (!input && message.voice) {
    await sendTelegramHtml('<b>🎙 Otrzymałem nagranie.</b>\nTranskrypcja jest wyłączona. Napisz krótko tekstem.', { chatId, replyTo: message.message_id }, process.env).catch(() => null);
    return response();
  }
  const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
  if (!token) {
    await sendTelegramHtml('⚠️ Dane sklepu są chwilowo niedostępne.', { chatId, replyTo: message.message_id }, process.env).catch(() => null);
    return response();
  }
  try {
    const origin = new URL(request.url).origin;
    const incidentMatch = input.match(/^tg:(ack|s1|s24|resolve|reopen):([a-f0-9]{14})$/i);
    if (callback?.id && incidentMatch) {
      const incidentResponse = await fetch(`${origin}/api/store?action=telegram-incident-action`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ id: incidentMatch[2], incidentAction: incidentMatch[1].toLowerCase(), source: 'telegram-webhook', actor: { id: userId, username: sender.username || '', name: [sender.first_name, sender.last_name].filter(Boolean).join(' ') || sender.username || 'Telegram' } }),
      });
      const incidentData = await incidentResponse.json().catch(() => ({}));
      if (!incidentResponse.ok || !incidentData.ok) throw new Error(incidentData.error || `HTTP ${incidentResponse.status}`);
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: String(incidentData.notice || 'Zapisano zmianę.').slice(0, 180), show_alert: false }, process.env).catch(() => null);
      return response();
    }
    const apiResponse = await fetch(`${origin}/api/store?action=telegram-inbound-command`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ intent: telegramNaturalIntent(input), text: input, chatId, messageThreadId: message.message_thread_id || null, user: sender.username || [sender.first_name, sender.last_name].filter(Boolean).join(' ') }),
    });
    const data = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok || !data.ok) throw new Error(data.error || `HTTP ${apiResponse.status}`);
    if (callback?.id) await telegramApi('answerCallbackQuery', { callback_query_id: callback.id }, process.env).catch(() => null);
    await sendTelegramHtml(data.message, { chatId, replyTo: message.message_id, replyMarkup: data.replyMarkup, messageThreadId: message.message_thread_id || null }, process.env);
  } catch (error) {
    if (callback?.id) {
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: String(error?.message || error).slice(0, 180), show_alert: true }, process.env).catch(() => null);
      return response();
    }
    await sendTelegramHtml('<b>⚠️ Nie mogę teraz pobrać danych.</b>\nSpróbuj ponownie za chwilę.', { chatId, replyTo: message.message_id }, process.env).catch(() => null);
  }
  return response();
};

export const config = { path: '/.netlify/functions/telegram-webhook' };
