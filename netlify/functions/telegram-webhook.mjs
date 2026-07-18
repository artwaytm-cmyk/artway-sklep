import crypto from 'node:crypto';
import {
  editTelegramHtml,
  sendTelegramHtml,
  telegramActorAllowed,
  telegramApproverAllowed,
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

const SERVER_LOCAL_COMMANDS = new Set(['start', 'pomoc', 'settings']);

function cleanTelegramText(value = '', limit = 1600) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, limit);
}

export function telegramCommandRoute(value = '') {
  const match = String(value ?? '').trim().match(/^\/([a-z0-9_]+)(?:@[a-z0-9_]+)?(?:\s|$)/i);
  if (!match) return 'agent';
  return SERVER_LOCAL_COMMANDS.has(match[1].toLowerCase()) ? 'local' : 'agent';
}

export function telegramReplyContext(reply = null) {
  if (!reply || typeof reply !== 'object') return '';
  return cleanTelegramText(reply.text || reply.caption || '', 1600);
}

export function telegramMessageMedia(message = null) {
  if (!message || typeof message !== 'object') return null;
  const source = message.voice || message.audio || null;
  const kind = message.voice ? 'voice' : message.audio ? 'audio' : '';
  const fileId = cleanTelegramText(source?.file_id || '', 500);
  if (!source || !kind || !fileId) return null;
  return {
    kind,
    fileId,
    mimeType: cleanTelegramText(source.mime_type || '', 160),
    fileName: cleanTelegramText(source.file_name || '', 240),
  };
}

export function telegramInboundKind(message = null, callback = null) {
  if (callback) return 'callback';
  if (message?.voice) return 'voice';
  if (message?.audio) return 'audio';
  if (/^\//.test(String(message?.text || message?.caption || '').trim())) return 'command';
  return 'text';
}

export function telegramActorRef(userId = '', chatId = '', secret = '') {
  if (!String(userId).trim() || !String(chatId).trim() || !String(secret).trim()) return '';
  return crypto.createHmac('sha256', String(secret)).update(`${String(userId).trim()}|${String(chatId).trim()}`).digest('hex').slice(0, 24);
}

export function telegramSharedConversationTarget(message = {}, config = {}) {
  const sourceChatId = String(message?.chat?.id || '').trim();
  const sharedChatId = String(config?.chatId || '').trim();
  const privateChat = String(message?.chat?.type || '') === 'private';
  const privateRoom = privateChat && config?.sharedMode === 'private-room';
  const broadcastChatIds = privateRoom ? telegramPrivateTeamRecipients(config, sourceChatId) : [];
  const canonicalPrivateChatId = privateRoom
    ? ([...(config?.approverUserIds instanceof Set ? config.approverUserIds : [])]
      .find((value) => broadcastChatIds.includes(String(value))) || sourceChatId)
    : sourceChatId;
  const sharedGroup = /^-\d+$/.test(sharedChatId);
  const bridged = !privateRoom && privateChat && sharedGroup && sharedChatId !== sourceChatId;
  return {
    sourceChatId,
    chatId: bridged ? sharedChatId : canonicalPrivateChatId,
    messageThreadId: bridged ? null : (message?.message_thread_id || null),
    replyTo: bridged ? null : (message?.message_id || null),
    bridged,
    sharedPrivate: privateRoom,
    broadcastChatIds,
    conversationRoom: privateRoom ? 'team' : '',
    ...(privateRoom ? { chatLabel: 'Wspólny pokój zespołu' } : {}),
  };
}

export function telegramPrivateTeamRecipients(config = {}, sourceChatId = '') {
  const source = String(sourceChatId || '').trim();
  const configured = config?.teamUserIds instanceof Set ? [...config.teamUserIds] : [];
  return [...new Set([source, ...configured]
    .map((value) => String(value || '').trim())
    .filter((value) => /^[1-9]\d*$/.test(value)))]
    .slice(0, 20);
}

export function telegramGroupMessageUrl(chatId = '', messageId = '') {
  const match = String(chatId || '').match(/^-100(\d+)$/), id = Number(messageId);
  return match && Number.isSafeInteger(id) && id > 0 ? `https://t.me/c/${match[1]}/${id}` : '';
}

async function bridgePrivateMessageToSharedConversation({ message, input, senderLabel, config }) {
  const target = telegramSharedConversationTarget(message, config);
  if (target.sharedPrivate) {
    const sourceChatId = target.sourceChatId;
    const description = input || (message?.voice ? '🎤 Wiadomość głosowa' : message?.audio ? '🎧 Wiadomość audio' : 'Wiadomość');
    const recipients = target.broadcastChatIds;
    const mirrored = await Promise.allSettled(recipients.map((chatId) => sendTelegramHtml(
      `<b>👤 ${html(senderLabel || 'Użytkownik Telegram')}</b>\n${html(description)}`,
      { chatId },
      process.env,
    )));
    const delivered = mirrored.flatMap((result, index) => result.status === 'fulfilled'
      ? [{ chatId: recipients[index], result: result.value }]
      : []);
    if (!delivered.length) throw mirrored.find((result) => result.status === 'rejected')?.reason || new Error('Nie udało się zapisać wiadomości we wspólnym pokoju.');
    if (message?.voice || message?.audio) {
      await Promise.allSettled(recipients.map((chatId) => telegramApi('copyMessage', {
        chat_id: chatId,
        from_chat_id: sourceChatId,
        message_id: Number(message.message_id),
      }, process.env)));
    }
    await telegramApi('deleteMessage', {
      chat_id: sourceChatId,
      message_id: Number(message.message_id),
    }, process.env).catch(() => null);
    const primaryMirror = delivered.find((item) => item.chatId === target.chatId) || delivered[0];
    return { ...target, replyTo: primaryMirror.result?.message_id || null };
  }
  if (!target.bridged) return target;
  const sourceChatId = target.sourceChatId;
  const description = input || (message?.voice ? '🎤 Wiadomość głosowa' : message?.audio ? '🎧 Wiadomość audio' : 'Wiadomość');
  const mirrored = await sendTelegramHtml(
    `<b>👤 ${html(senderLabel || 'Użytkownik Telegram')}</b>\n${html(description)}`,
    { chatId: target.chatId },
    process.env,
  );
  const groupMessageId = mirrored?.message_id || null;
  if (message?.voice || message?.audio) {
    await telegramApi('copyMessage', {
      chat_id: target.chatId,
      from_chat_id: sourceChatId,
      message_id: Number(message.message_id),
    }, process.env).catch(() => null);
  }
  const groupUrl = telegramGroupMessageUrl(target.chatId, groupMessageId);
  await sendTelegramHtml(
    '<b>✅ Polecenie przeniesiono do wspólnego centrum.</b>\nOdpowiedź Agenta pojawi się w grupie „Magazyn Artway”, widocznej dla całego zespołu.',
    {
      chatId: sourceChatId,
      silent: true,
      ...(groupUrl ? { replyMarkup: { inline_keyboard: [[{ text: 'Otwórz wspólną rozmowę', url: groupUrl }]] } } : {}),
    },
    process.env,
  ).catch(() => null);
  return { ...target, replyTo: groupMessageId, chatLabel: 'Magazyn Artway' };
}

async function sendToDelivery(message, delivery = {}, options = {}) {
  const primary = String(delivery.chatId || '').trim();
  const recipients = [...new Set([primary, ...(Array.isArray(delivery.broadcastChatIds) ? delivery.broadcastChatIds : [])]
    .map((value) => String(value || '').trim()).filter(Boolean))];
  const results = await Promise.allSettled(recipients.map((chatId) => sendTelegramHtml(message, {
    chatId,
    ...(chatId === primary && options.replyTo ? { replyTo: options.replyTo } : {}),
    ...(chatId === primary && Number(options.messageThreadId) > 0 ? { messageThreadId: options.messageThreadId } : {}),
    ...(chatId === primary && options.replyMarkup ? { replyMarkup: options.replyMarkup } : {}),
    ...(options.silent === true ? { silent: true } : {}),
  }, process.env)));
  const delivered = results.flatMap((result, index) => result.status === 'fulfilled'
    ? [{ chatId: recipients[index], result: result.value }]
    : []);
  if (!delivered.length) throw results.find((result) => result.status === 'rejected')?.reason || new Error('Nie udało się dostarczyć wiadomości do wspólnego pokoju.');
  const preferred = delivered.find((item) => item.chatId === primary) || delivered[0];
  return {
    ...preferred.result,
    message_ids: delivered.map((item) => ({ chat_id: item.chatId, message_id: item.result?.message_id || null })),
  };
}

async function auditRejectedInbound(origin = '', token = '', kind = 'unknown', actorHash = '') {
  if (!origin || !token) return;
  await fetch(`${origin}/api/store?action=telegram-inbound-audit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ accepted: false, deferred: false, kind, actorHash }),
  }).catch(() => null);
}

async function auditOutbound(origin = '', token = '', input = {}) {
  if (!origin || !token) return;
  await fetch(`${origin}/api/store?action=telegram-outbound-audit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(input),
  }).catch(() => null);
}

async function notifyAccessDenied({ userId = '', chatId = '', replyTo = null } = {}) {
  const privateChatId = String(userId || '').trim(), sourceChatId = String(chatId || '').trim();
  if (!privateChatId) return;
  const privateText = `<b>🔒 Bot nie ma jeszcze przypisanego dostępu.</b>\nPrzekaż administratorowi te dane:\nID użytkownika: <code>${html(privateChatId)}</code>\nID czatu: <code>${html(sourceChatId)}</code>\nPo dodaniu do listy dostępu wyślij polecenie ponownie.`;
  try {
    await sendTelegramHtml(privateText, { chatId: privateChatId, silent: true }, process.env);
    return;
  } catch {
    if (!sourceChatId || sourceChatId === privateChatId) return;
  }
  await sendTelegramHtml('<b>🔒 Nie masz jeszcze dostępu do bota.</b>\nOtwórz prywatną rozmowę z botem i wyślij <code>/start</code>. Otrzymasz tam bezpiecznie identyfikatory potrzebne administratorowi.', { chatId: sourceChatId, replyTo, silent: true }, process.env).catch(() => null);
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

export function parseAgentApprovalCallback(value = '') {
  const match = String(value ?? '').match(/^aa:([cr]):(AA[a-f0-9]{12})$/);
  if (!match) return null;
  return { action: match[1] === 'c' ? 'confirm' : 'reject', id: match[2] };
}

export function telegramCallbackRoute(value = '') {
  if (parseInventoryDecisionCallback(value)) return 'inventory';
  if (parseAgentApprovalCallback(value)) return 'agent-approval';
  return 'other';
}

export function telegramInventoryDecisionAllowed(action = {}, config = {}, actor = {}) {
  if (action?.action === 'location') return true;
  if (!['confirm', 'reject'].includes(action?.action)) return false;
  return telegramApproverAllowed(config, actor);
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
  const origin = new URL(request.url).origin, token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
  const inboundKind = telegramInboundKind(message, callback);
  const privateExplicitUser = chatId === userId && config.allowedUserIds.has(userId);
  const allowed = (config.allowedChatIds.has(chatId) || privateExplicitUser)
    && telegramActorAllowed(config, { chatId, userId, chatType: message.chat.type || '' });
  if (!allowed) {
    await auditRejectedInbound(origin, token, inboundKind, telegramActorRef(userId, chatId, expected));
    if (callback?.id) {
      await telegramApi('answerCallbackQuery', {
        callback_query_id: callback.id,
        text: 'Nie masz uprawnień do obsługi tej decyzji.',
        show_alert: true,
      }, process.env).catch(() => null);
    } else {
      await notifyAccessDenied({ userId, chatId, replyTo: message.message_id || null });
    }
    return response();
  }
  const rawInput = String(callback?.data || message.text || message.caption || '').trim();
  const senderLabel = [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim() || sender.username || 'Użytkownik Telegram';
  const chatLabel = String(message.chat.title || message.chat.first_name || 'Główna grupa Telegram').trim();
  const normalizedInput = callback?.id ? { text: rawInput, forceCodex: false } : normalizeTelegramAgentInput(rawInput);
  const media = telegramMessageMedia(message);
  const input = normalizedInput.text || (media ? `[Telegram: wiadomość ${media.kind === 'voice' ? 'głosowa' : 'audio'} do transkrypcji]` : '');
  let delivery = telegramSharedConversationTarget(message, config);
  try {
    if (!callback?.id) {
      delivery = await bridgePrivateMessageToSharedConversation({ message, input, senderLabel, config });
    }
    await telegramApi('sendChatAction', {
      chat_id: delivery.chatId,
      action: 'typing',
      ...(Number(delivery.messageThreadId) > 0 ? { message_thread_id: Number(delivery.messageThreadId) } : {}),
    }, process.env).catch(() => null);
    const inventoryAction = callback?.id ? parseInventoryDecisionCallback(input) : parseInventoryDecisionText(input);
    if (inventoryAction) {
      if (!telegramInventoryDecisionAllowed(inventoryAction, config, { userId })) {
        const denied = 'Tę decyzję może zatwierdzić lub odrzucić tylko administrator zatwierdzający.';
        if (callback?.id) {
          await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: denied, show_alert: true }, process.env).catch(() => null);
        } else {
          await sendToDelivery(`<b>🔐 Wymagane zatwierdzenie administratora.</b>\n${html(denied)}`, delivery, { replyTo: delivery.replyTo, messageThreadId: delivery.messageThreadId }).catch(() => null);
        }
        return response();
      }
      const decisionData = await executeInventoryDecision(inventoryAction, {
        id: userId,
        name: [sender.first_name, sender.last_name].filter(Boolean).join(' ') || sender.username || 'Telegram',
      });
      if (!callback?.id) {
        await sendToDelivery(decisionData.text, delivery, { replyTo: delivery.replyTo, messageThreadId: delivery.messageThreadId });
        return response();
      }
      const keyboard = inventoryKeyboardWithoutDecision(message.reply_markup || {}, inventoryAction.id);
      if (inventoryAction.action === 'location' && !keyboard.hasOther) {
        await editTelegramHtml(decisionData.text, { chatId: delivery.chatId, messageId: message.message_id, replyMarkup: decisionData.replyMarkup }, process.env).catch(() => null);
      } else if (inventoryAction.action === 'location') {
        await telegramApi('editMessageReplyMarkup', { chat_id: delivery.chatId, message_id: message.message_id, reply_markup: keyboard.replyMarkup }, process.env).catch(() => null);
        await sendToDelivery(decisionData.text, delivery, { replyMarkup: decisionData.replyMarkup, messageThreadId: delivery.messageThreadId });
      } else if (keyboard.hasOther) {
        await telegramApi('editMessageReplyMarkup', { chat_id: delivery.chatId, message_id: message.message_id, reply_markup: keyboard.replyMarkup }, process.env).catch(() => null);
      } else {
        await editTelegramHtml(decisionData.text, { chatId: delivery.chatId, messageId: message.message_id, replyMarkup: { inline_keyboard: [] } }, process.env).catch(() => null);
      }
      const notice = inventoryAction.action === 'confirm' ? 'Zmiana została potwierdzona.' : inventoryAction.action === 'reject' ? 'Zmiana została odrzucona.' : 'Lokalizacja zapisana — teraz potwierdź decyzję.';
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: notice, show_alert: false }, process.env).catch(() => null);
      return response();
    }
    const agentApproval = callback?.id ? parseAgentApprovalCallback(input) : null;
    if (agentApproval && !telegramApproverAllowed(config, { userId })) {
      await telegramApi('answerCallbackQuery', {
        callback_query_id: callback.id,
        text: 'Tę decyzję może zatwierdzić lub odrzucić tylko administrator zatwierdzający.',
        show_alert: true,
      }, process.env).catch(() => null);
      return response();
    }
    if (!token) {
      await sendToDelivery('⚠️ Dane sklepu są chwilowo niedostępne.', delivery, { replyTo: delivery.replyTo }).catch(() => null);
      return response();
    }
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
        intent: telegramNaturalIntent(input), text: input, chatId: delivery.chatId, messageThreadId: delivery.messageThreadId,
        broadcastChatIds: delivery.broadcastChatIds, conversationRoom: delivery.conversationRoom,
        replyTo: delivery.replyTo, requestId: String(update.update_id || `${chatId}:${message.message_id || ''}`),
        user: sender.username || [sender.first_name, sender.last_name].filter(Boolean).join(' '), userId,
        fromLabel: senderLabel, chatLabel: delivery.chatLabel || chatLabel, chatType: delivery.bridged ? 'group' : (message.chat.type || ''),
        context: agentApproval ? cleanTelegramText(message.text || message.caption || '', 1600) : telegramReplyContext(message.reply_to_message),
        media, kind: inboundKind,
        source: 'telegram-webhook', deferToCodex: Boolean(agentApproval) || (!callback?.id && telegramCommandRoute(input) === 'agent'),
      }),
    });
    const data = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok || !data.ok) throw new Error(data.error || `HTTP ${apiResponse.status}`);
    if (callback?.id) {
      await telegramApi('answerCallbackQuery', {
        callback_query_id: callback.id,
        ...(agentApproval ? {
          text: data.deferred
            ? (agentApproval.action === 'confirm' ? 'Zatwierdzenie przekazane Agentowi.' : 'Odrzucenie przekazane Agentowi.')
            : 'Agent nie przyjął tej decyzji. Spróbuj ponownie.',
          show_alert: data.deferred !== true,
        } : {}),
      }, process.env).catch(() => null);
    }
    if (data.deferred) {
      return response();
    }
    const sent = await sendToDelivery(data.message, delivery, { replyTo: delivery.replyTo, replyMarkup: data.replyMarkup, messageThreadId: delivery.messageThreadId });
    await auditOutbound(origin, token, {
      kind: 'local-reply', status: 'sent', category: 'agent', title: 'Odpowiedź bota na polecenie', preview: data.message,
      messageId: sent?.message_id || null, fromLabel: 'Agent Artway-TM', toLabel: delivery.chatLabel || senderLabel || chatLabel,
      messageThreadId: delivery.messageThreadId, conversationKey: `telegram:${delivery.chatId}:${delivery.messageThreadId || 0}`,
      source: 'telegram-webhook',
    });
  } catch (error) {
    if (callback?.id) {
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: String(error?.message || error).slice(0, 180), show_alert: true }, process.env).catch(() => null);
      return response();
    }
    await sendToDelivery('<b>⚠️ Nie mogę teraz pobrać danych.</b>\nSpróbuj ponownie za chwilę.', { ...delivery, chatId: delivery.chatId || chatId }, { replyTo: delivery.replyTo || null }).catch(() => null);
  }
  return response();
};

export const config = { path: '/.netlify/functions/telegram-webhook' };
