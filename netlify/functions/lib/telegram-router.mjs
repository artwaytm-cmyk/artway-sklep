import { telegramHtml } from './domain/telegram-communication.mjs';
import { telegramAgentReport } from './telegram-center.mjs';

const ACTIONS = new Set([
  'telegram-center-status', 'telegram-settings-save', 'telegram-register-webhook', 'telegram-dispatch', 'telegram-inbound-command',
  'telegram-incident-action', 'telegram-delivery-action', 'telegram-dashboard-refresh', 'telegram-send-note', 'telegram-test', 'telegram-send-agent-report', 'telegram-send-supplier-order',
]);

export function createTelegramRouter({ center, getOperationalCenter, isAdmin, respond, sessionOf, publicOrigin, supplierTables, text }) {
  return async function telegramRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (action === 'telegram-center-status') {
      const operational = await getOperationalCenter();
      return respond({ ok: true, center: operational, ...(await center.view(operational, url.searchParams.get('live') === '1')) });
    }
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({})), session = sessionOf(req), operator = session?.email || 'administrator';
    if (action === 'telegram-settings-save') return respond({ ok: true, settings: await center.saveSettings(body.settings || body, operator) });
    if (action === 'telegram-register-webhook') return respond({ ok: true, ...(await center.registerWebhook(publicOrigin(req))) });
    if (action === 'telegram-dispatch') {
      const operational = await getOperationalCenter(), dispatch = await center.dispatch(operational, { source: text(body.source || 'admin-panel', 80), force: body.force === true, forceDigest: body.forceDigest === true });
      return respond({ ok: true, dispatch, center: operational });
    }
    if (action === 'telegram-inbound-command') {
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
