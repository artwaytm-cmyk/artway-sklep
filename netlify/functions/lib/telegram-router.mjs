import { sendTelegramHtml, telegramHtml } from './domain/telegram-communication.mjs';
import { telegramAgentReport } from './telegram-center.mjs';

const ACTIONS = new Set([
  'telegram-center-status', 'telegram-settings-save', 'telegram-register-webhook', 'telegram-dispatch', 'telegram-inbound-command',
  'telegram-incident-action', 'telegram-delivery-action', 'telegram-dashboard-refresh', 'telegram-send-note', 'telegram-test', 'telegram-send-agent-report', 'telegram-send-supplier-order',
  'codex-agent-claim', 'codex-agent-complete', 'codex-agent-fail', 'codex-agent-heartbeat', 'codex-agent-panel-enqueue', 'codex-agent-result',
]);

export function createTelegramRouter({ center, codexQueue, getOperationalCenter, inventoryCommand, inventoryDecisions, isAdmin, respond, sessionOf, publicOrigin, supplierTables, text, sendTelegram = sendTelegramHtml }) {
  return async function telegramRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (action === 'telegram-center-status') {
      const operational = await getOperationalCenter();
      return respond({ ok: true, center: operational, ...(await center.view(operational, url.searchParams.get('live') === '1')) });
    }
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({})), session = sessionOf(req), operator = session?.email || 'administrator';
    if (action === 'codex-agent-claim') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      return respond({ ok: true, ...(await codexQueue.claim(text(body.workerId || '', 160))) });
    }
    if (action === 'codex-agent-panel-enqueue') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      const queued = await codexQueue.enqueue({ requestId: body.requestId, text: body.text, channel: 'panel', user: operator });
      return respond({ ok: true, deferred: true, jobId: queued.job?.id || null, duplicate: queued.duplicate === true });
    }
    if (action === 'codex-agent-heartbeat') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      return respond({ ok: true, ...(await codexQueue.heartbeat(body)) });
    }
    if (action === 'codex-agent-result') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      return respond({ ok: true, ...(await codexQueue.result(body.id)) });
    }
    if (action === 'codex-agent-complete') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      const prepared = await codexQueue.prepareDelivery(body);
      if (prepared.alreadyDelivered) return respond({ ok: true, delivered: true, duplicate: true });
      if (prepared.alreadyDelivering) return respond({ ok: true, delivered: false, pending: true });
      if (prepared.job.channel === 'panel') {
        const completed = await codexQueue.markDelivered({ id: body.id, claimToken: body.claimToken, keepResponse: true });
        return respond({ ok: true, ...completed, panel: true });
      }
      let sent;
      try {
        sent = await sendTelegram(telegramHtml(prepared.job.response), {
          chatId: prepared.job.chatId,
          replyTo: prepared.job.replyTo,
          messageThreadId: prepared.job.messageThreadId,
        });
      } catch (error) {
        // Po wywołaniu zewnętrznego API nie wiemy, czy odpowiedź nie zaginęła
        // już po przyjęciu wiadomości przez Telegram. Traktujemy wynik jako
        // niejednoznaczny i nie ponawiamy automatycznie, aby nie wysłać duplikatu.
        await codexQueue.fail({ id: body.id, claimToken: body.claimToken, error: error?.message || error }).catch(() => null);
        throw error;
      }
      // Po sukcesie Telegram nie ponawiamy wysyłki, nawet jeśli sam zapis
      // audytu chwilowo zawiedzie — chroni to rozmowę przed duplikatem.
      const completed = await codexQueue.markDelivered({ id: body.id, claimToken: body.claimToken, telegramMessageId: sent?.message_id });
      return respond({ ok: true, ...completed, messageId: sent?.message_id || null });
    }
    if (action === 'codex-agent-fail') {
      if (!codexQueue) return respond({ ok: false, error: 'Kolejka Codex nie jest dostępna', code: 'codex_queue_unavailable' }, 503);
      return respond({ ok: true, ...(await codexQueue.fail(body)) });
    }
    if (action === 'telegram-settings-save') return respond({ ok: true, settings: await center.saveSettings(body.settings || body, operator) });
    if (action === 'telegram-register-webhook') return respond({ ok: true, ...(await center.registerWebhook(publicOrigin(req))) });
    if (action === 'telegram-dispatch') {
      const operational = await getOperationalCenter(), dispatch = await center.dispatch(operational, { source: text(body.source || 'admin-panel', 80), force: body.force === true, forceDigest: body.forceDigest === true });
      let inventoryReminder = { due: false, reason: 'service_unavailable', messages: 0, decisions: 0 };
      if (inventoryDecisions && typeof inventoryDecisions.prepareReminder === 'function') {
        const reminder = await inventoryDecisions.prepareReminder(new Date());
        inventoryReminder = {
          due: reminder.due === true,
          reason: reminder.reason,
          slot: reminder.slot,
          claimExpiresAt: reminder.claimExpiresAt || null,
          messages: 0,
          decisions: reminder.decisions?.length || 0,
          completed: false,
          released: false,
          errors: [],
        };
        const messages = reminder.messages || [];
        for (const message of messages) {
          try {
            await sendTelegram(message.text, { replyMarkup: message.replyMarkup, messageThreadId: body.messageThreadId || null });
            inventoryReminder.messages += 1;
          } catch (error) {
            inventoryReminder.errors.push(text(error?.message || error, 300));
            break;
          }
        }
        if (reminder.due === true && reminder.claimToken) {
          if (inventoryReminder.errors.length === 0 && inventoryReminder.messages === messages.length) {
            try {
              const completed = await inventoryDecisions.completeReminder(reminder.claimToken, new Date());
              inventoryReminder.completed = completed?.completed === true;
              inventoryReminder.reason = inventoryReminder.completed ? 'sent' : inventoryReminder.reason;
            } catch (error) {
              inventoryReminder.errors.push(text(error?.message || error, 300));
            }
          }
          if (!inventoryReminder.completed && inventoryReminder.errors.length) {
            try {
              const released = await inventoryDecisions.releaseReminder(reminder.claimToken);
              inventoryReminder.released = released?.released === true;
              inventoryReminder.reason = inventoryReminder.released ? 'delivery_failed_retryable' : inventoryReminder.reason;
            } catch (error) {
              inventoryReminder.errors.push(text(error?.message || error, 300));
            }
          }
        }
      }
      return respond({ ok: true, dispatch, inventoryReminder, center: operational });
    }
    if (action === 'telegram-inbound-command') {
      const inventory = typeof inventoryCommand === 'function' ? await inventoryCommand(body.text || body.intent || '', {
        user: body.user, userId: body.userId, chatId: body.chatId, messageThreadId: body.messageThreadId,
        requestId: body.requestId, source: body.source, channel: body.source === 'telegram-webhook' ? 'telegram' : 'panel',
      }) : null;
      if (inventory) return respond({ ok: true, ...inventory });
      if (body.deferToCodex === true && body.source === 'telegram-webhook' && codexQueue) {
        const queued = await codexQueue.enqueue({
          requestId: body.requestId, text: body.text, chatId: body.chatId, messageThreadId: body.messageThreadId,
          replyTo: body.replyTo, user: body.user, channel: 'telegram',
        });
        return respond({ ok: true, deferred: true, jobId: queued.job?.id || null, duplicate: queued.duplicate === true });
      }
      const operational = await getOperationalCenter();
      return respond({ ok: true, ...(await center.inbound(text(body.intent || body.text, 1000), operational, { text: body.text, user: body.user, chatId: body.chatId, messageThreadId: body.messageThreadId })) });
    }
    if (action === 'telegram-incident-action') {
      const actor = body.actor && typeof body.actor === 'object' ? body.actor : { name: operator, email: operator };
      return respond({ ok: true, ...(await center.incidentAction(text(body.id, 40), text(body.incidentAction || body.operation || body.eventAction, 30), actor, { direction: body.source === 'telegram-webhook' ? 'in' : 'out', source: body.source || 'admin-panel' })) });
    }
    if (action === 'telegram-delivery-action') return respond({ ok: true, ...(await center.deliveryAction(text(body.id, 80), text(body.deliveryAction, 30), operator)) });
    if (action === 'telegram-dashboard-refresh') {
      const operational = await getOperationalCenter();
      return respond({ ok: true, dashboard: await center.refreshDashboard(operational, { create: body.create === true, source: body.source || 'admin-panel' }) });
    }
    if (action === 'telegram-send-note') {
      const note = text(body.text, 1500).trim();
      if (note.length < 3) return respond({ ok: false, error: 'Wpisz treść notatki do zespołu', code: 'empty_note' }, 422);
      const sent = await center.sendManual(`<b>📌 Notatka</b>\n${telegramHtml(note)}`, { kind: 'note', title: 'Notatka administratora', source: operator, silent: body.silent === true });
      return respond({ ok: true, messageId: sent?.message_id || null, sentAt: new Date().toISOString() });
    }
    if (action === 'telegram-test') {
      const sent = await center.sendManual('<b>✅ Połączenie działa</b>\nCichy test został dostarczony.', { kind: 'test', title: 'Test połączenia', source: 'admin-panel', silent: true });
      return respond({ ok: true, messageId: sent?.message_id || null, sentAt: new Date().toISOString() });
    }
    if (action === 'telegram-send-agent-report') {
      const operational = await getOperationalCenter(), sent = await center.sendManual(telegramAgentReport(operational), { kind: 'report', title: 'Pełny raport centrum operacyjnego', source: 'admin-panel', replyMarkup: center.panelButtons() });
      return respond({ ok: true, sentAt: new Date().toISOString(), messageId: sent?.message_id || null, center: operational });
    }
    if (action === 'telegram-send-supplier-order') {
      const supplier = text(body.supplier || '', 120).trim(), order = body.order && typeof body.order === 'object' ? body.order : {}, tables = supplierTables(order, supplier);
      if (!tables.length) return respond({ ok: false, error: 'Zlecenie nie ma pozycji dla wybranego dostawcy', code: 'empty_order' }, 422);
      const messageIds = [];
      for (const table of tables) {
        const sent = await center.sendManual(table.text, { kind: 'supplier-preview', category: 'supplier', title: `Podgląd zamówienia — ${table.supplier}`, source: 'admin-panel' });
        if (sent?.message_id != null) messageIds.push(sent.message_id);
      }
      return respond({ ok: true, sentAt: new Date().toISOString(), tables: tables.length, suppliers: [...new Set(tables.map((item) => item.supplier))], messageIds });
    }
    return null;
  };
}
