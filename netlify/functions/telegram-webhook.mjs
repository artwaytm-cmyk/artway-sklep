import crypto from 'node:crypto';
import {
  editTelegramHtml,
  sendTelegramHtml,
  telegramActorAllowed,
  telegramApi,
  telegramConfig,
  telegramNaturalIntent,
  telegramWebhookSecret,
} from './lib/domain/telegram-communication.mjs';
import {
  createInventoryDecisionService,
  parseInventoryDecisionCallback,
  renderInventoryDecisionConfirmation,
} from './lib/domain/inventory-decisions.mjs';
import { createStoreRepository } from './lib/core/store-repository.mjs';

const inventoryRepository = createStoreRepository({ name: 'artway-sklep' });
const inventoryDecisions = createInventoryDecisionService({
  readVersioned: inventoryRepository.readVersioned,
  writeIfVersion: inventoryRepository.writeIfVersion,
});

function equal(left = '', right = '') {
  const a = Buffer.from(String(left)), b = Buffer.from(String(right));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function response() {
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

function html(value = '') {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function normalizeTelegramAgentInput(value = '', botUsername = 'magazyn_artway_bot') {
  const username = String(botUsername || 'magazyn_artway_bot').trim().replace(/^@/, '');
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionPattern = new RegExp(`^@${escapedUsername}(?=$|[\\s,:;.!?–—-])`, 'i');
  const commandPattern = new RegExp(`^/agent(?:@${escapedUsername})?(?:\\s+([\\s\\S]*))?$`, 'i');
  let text = String(value ?? '').trim(), forceCodex = false;

  if (mentionPattern.test(text)) {
    text = text.replace(mentionPattern, '').replace(/^[\s,:;.!?–—-]+/, '').trim();
    forceCodex = true;
  }
  const command = text.match(commandPattern);
  if (command) {
    text = String(command[1] || '').trim();
    forceCodex = true;
  }
  if (forceCodex && !text) text = 'Pokaż pomoc Agenta';
  return { text, forceCodex };
}

export function parseInventoryDecisionText(value = '') {
  const match = String(value ?? '').trim().match(/^(nie\s+potwierdzam|potwierdzam)\s+(IV[a-f0-9]{14})[.!]?$/i);
  if (!match) return null;
  return { action: /^nie\s+/i.test(match[1]) ? 'reject' : 'confirm', id: `IV${match[2].slice(2).toLowerCase()}` };
}

function inventoryDecisionFinalCard(decision = {}, rejected = false) {
  if (rejected || decision.status === 'rejected') {
    return {
      text: `<b>❌ Zmiana odrzucona</b>\n${html(decision.product?.name || `Produkt ${decision.productId || ''}`)}\nStan magazynu pozostał bez zmian.`,
      replyMarkup: undefined,
    };
  }
  const before = decision.result?.before ?? decision.expectedStock;
  const after = decision.result?.after ?? decision.after;
  return {
    text: `<b>✅ Zmiana magazynowa zapisana</b>\n${html(decision.product?.name || `Produkt ${decision.productId || ''}`)}\nStan: <b>${before === null ? 'niemonitorowany' : html(before)}</b> → <b>${html(`${after} szt.`)}</b>\nLokalizacja: <b>${html(decision.location || '—')}</b>`,
    replyMarkup: undefined,
  };
}

async function executeInventoryDecision(action = {}, actor = {}) {
  if (action.action === 'location') {
    const result = await inventoryDecisions.assignLocation(action.id, action.location || '', actor);
    return { ...result, ...renderInventoryDecisionConfirmation(result.decision) };
  }
  if (action.action === 'confirm') {
    const result = await inventoryDecisions.confirm(action.id, actor);
    return { ...result, ...inventoryDecisionFinalCard(result.decision, false) };
  }
  const result = await inventoryDecisions.reject(action.id, actor);
  return { ...result, ...inventoryDecisionFinalCard(result.decision, true) };
}

function inventoryKeyboardWithoutDecision(markup = {}, id = '') {
  const rows = Array.isArray(markup?.inline_keyboard) ? markup.inline_keyboard : [];
  const callbackIds = rows.flat().map((button) => parseInventoryDecisionCallback(button?.callback_data || '')?.id).filter(Boolean);
  const hasOther = callbackIds.some((value) => value !== id);
  const inlineKeyboard = rows.map((row) => row.filter((button) => parseInventoryDecisionCallback(button?.callback_data || '')?.id !== id)).filter((row) => row.length);
  return { hasOther, replyMarkup: { inline_keyboard: inlineKeyboard } };
}

export default async (request) => {
  if (request.method !== 'POST') return response();
  const expected = telegramWebhookSecret(process.env), received = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!equal(received, expected)) return response();
  const update = await request.json().catch(() => ({})), callback = update.callback_query || null, message = callback?.message || update.message || null;
  if (!message?.chat?.id) return response();
  const config = telegramConfig(process.env), chatId = String(message.chat.id), sender = callback?.from || message.from || {}, userId = String(sender.id || '');
  const allowed = config.allowedChatIds.has(chatId) && telegramActorAllowed(config, { chatId, userId, chatType: message.chat.type || '' });
  if (!allowed) {
    await sendTelegramHtml('<b>🔒 Brak dostępu do bota.</b>', { chatId, silent: true }, process.env).catch(() => null);
    return response();
  }
  const rawInput = String(callback?.data || message.text || message.caption || '').trim();
  const normalizedInput = callback?.id ? { text: rawInput, forceCodex: false } : normalizeTelegramAgentInput(rawInput);
  const input = normalizedInput.text;
  if (!input && message.voice) {
    await sendTelegramHtml('<b>🎙 Otrzymałem nagranie.</b>\nTranskrypcja jest wyłączona. Napisz krótko tekstem.', { chatId, replyTo: message.message_id }, process.env).catch(() => null);
    return response();
  }
  try {
    const inventoryAction = callback?.id ? parseInventoryDecisionCallback(input) : parseInventoryDecisionText(input);
    if (inventoryAction) {
      const decisionData = await executeInventoryDecision(inventoryAction, {
        id: userId,
        name: [sender.first_name, sender.last_name].filter(Boolean).join(' ') || sender.username || 'Telegram',
      });
      if (!callback?.id) {
        await sendTelegramHtml(decisionData.text, { chatId, replyTo: message.message_id, messageThreadId: message.message_thread_id || null }, process.env);
        return response();
      }
      const keyboard = inventoryKeyboardWithoutDecision(message.reply_markup || {}, inventoryAction.id);
      if (inventoryAction.action === 'location' && !keyboard.hasOther) {
        await editTelegramHtml(decisionData.text, { chatId, messageId: message.message_id, replyMarkup: decisionData.replyMarkup }, process.env).catch(() => null);
      } else if (inventoryAction.action === 'location') {
        await telegramApi('editMessageReplyMarkup', { chat_id: chatId, message_id: message.message_id, reply_markup: keyboard.replyMarkup }, process.env).catch(() => null);
        await sendTelegramHtml(decisionData.text, { chatId, replyMarkup: decisionData.replyMarkup, messageThreadId: message.message_thread_id || null }, process.env);
      } else if (keyboard.hasOther) {
        await telegramApi('editMessageReplyMarkup', { chat_id: chatId, message_id: message.message_id, reply_markup: keyboard.replyMarkup }, process.env).catch(() => null);
      } else {
        await editTelegramHtml(decisionData.text, { chatId, messageId: message.message_id, replyMarkup: { inline_keyboard: [] } }, process.env).catch(() => null);
      }
      const notice = inventoryAction.action === 'confirm' ? 'Zmiana została potwierdzona.' : inventoryAction.action === 'reject' ? 'Zmiana została odrzucona.' : 'Lokalizacja zapisana — teraz potwierdź decyzję.';
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: notice, show_alert: false }, process.env).catch(() => null);
      return response();
    }
    const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
    if (!token) {
      await sendTelegramHtml('⚠️ Dane sklepu są chwilowo niedostępne.', { chatId, replyTo: message.message_id }, process.env).catch(() => null);
      return response();
    }
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
      body: JSON.stringify({
        intent: telegramNaturalIntent(input), text: input, chatId, messageThreadId: message.message_thread_id || null,
        replyTo: message.message_id || null, requestId: String(update.update_id || `${chatId}:${message.message_id || ''}`),
        user: sender.username || [sender.first_name, sender.last_name].filter(Boolean).join(' '), userId,
        source: 'telegram-webhook', deferToCodex: normalizedInput.forceCodex || !input.startsWith('/'),
      }),
    });
    const data = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok || !data.ok) throw new Error(data.error || `HTTP ${apiResponse.status}`);
    if (callback?.id) await telegramApi('answerCallbackQuery', { callback_query_id: callback.id }, process.env).catch(() => null);
    if (data.deferred) {
      await telegramApi('sendChatAction', { chat_id: chatId, action: 'typing', ...(Number(message.message_thread_id) > 0 ? { message_thread_id: Number(message.message_thread_id) } : {}) }, process.env).catch(() => null);
      return response();
    }
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
