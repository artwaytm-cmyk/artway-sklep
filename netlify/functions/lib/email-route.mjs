import crypto from 'node:crypto';

const ACTIONS = new Set(['email-config', 'email-test', 'email-send-supplier-order', 'send-email', 'send-status-email']);

export function createEmailRoute(deps) {
  const { respond, isAdmin, text, read, write, publicConfig, checkSmtp, supplierPlan, renderSupplierOrder, sendSmtp, sessionOf, syncProcurement, orderNumber, emailConfig, orderConfirmation, appendHistory, sendStatus } = deps;
  return async function emailRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    if (action === 'email-config') return respond({ ok: true, email: publicConfig() });
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);

    if (action === 'email-test') {
      const checkedAt = new Date().toISOString();
      try {
        const email = await checkSmtp({ force: true });
        await write('integration_health', { ...(await read('integration_health', {})), email: { authenticated: true, checkedAt, provider: email.provider || 'smtp', error: '', code: '' }, updated_at: checkedAt });
        return respond({ ok: true, configured: true, authenticated: true, email });
      } catch (error) {
        const code = text(error?.code || 'email_connection_error', 100), config = publicConfig();
        const safe = { authenticated: false, checkedAt, provider: config.provider || 'smtp', error: text(error?.message || 'Nie udało się połączyć z pocztą.', 500), code };
        await write('integration_health', { ...(await read('integration_health', {})), email: safe, updated_at: checkedAt });
        return respond({ ok: false, configured: config.configured, authenticated: false, email: { ...config, ...safe }, error: safe.error, code }, code === 'email_not_configured' || code === 'email_credential_masked' ? 503 : 502);
      }
    }

    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const body = await req.json().catch(() => ({}));

    if (action === 'email-send-supplier-order') {
      const requested = body.order && typeof body.order === 'object' ? body.order : {};
      const requestedSupplierNames = (Array.isArray(body.suppliers) ? body.suppliers : [body.supplier]).map((supplier) => text(supplier?.name || supplier?.nazwa || supplier, 160)).filter(Boolean);
      const actor = sessionOf(req)?.email || 'administrator', forceResend = body.forceResend === true, resendReason = text(body.resendReason || '', 500).trim();
      const currentPlan = await supplierPlan.beginEmailSend({ draftId: requested.id || body.draftId, expectedRevision: requested.revision ?? body.expectedRevision, requestedSupplierNames, actor, allowResend: forceResend, resendReason });
      const suppliers = currentPlan.supplierContacts, order = currentPlan.draft, revision = Math.max(1, Number(order.revision) || 1);
      let prepared, auditRec;
      try {
        prepared = suppliers.map((supplier) => renderSupplierOrder(order, supplier));
        const invalid = prepared.filter((item) => !item.validation?.ok);
        if (invalid.length) {
          await supplierPlan.markEmailResults({ draftId: order.id, expectedRevision: revision, sendLockId: currentPlan.sendLockId, results: [], actor, resend: forceResend, resendReason });
          const missingIdentifiers = [...new Set(invalid.flatMap((item) => item.validation?.missingIdentifiers || []))];
          return respond({ ok: false, error: `Uzupełnij kartotekę lub identyfikatory pozycji przed wysyłką: ${missingIdentifiers.join(', ') || invalid.map((item) => item.name || 'bez nazwy').join(', ')}`, code: 'supplier_validation', missingIdentifiers }, 422);
        }
        auditRec = await read('supplier_order_email_audit', { items: {}, updated_at: null });
      } catch (error) {
        try { await supplierPlan.markEmailResults({ draftId: order.id, expectedRevision: revision, sendLockId: currentPlan.sendLockId, results: [], actor, resend: forceResend, resendReason }); } catch {}
        throw error;
      }
      const auditItems = auditRec.items && typeof auditRec.items === 'object' ? { ...auditRec.items } : {}, results = [];
      for (const item of prepared) {
        const fingerprint = crypto.createHash('sha256').update(`${order.id}|${revision}|${item.name.toLowerCase()}|${item.to}|${item.rows.map((position) => `${position.kod}:${position.ilosc}`).join('|')}|${item.optima?.content || ''}`).digest('hex').slice(0, 32);
        if (!forceResend && auditItems[fingerprint]?.sent === true) {
          results.push({ supplier: item.name, to: item.to, sent: true, skippedDuplicate: true, sentAt: auditItems[fingerprint].sentAt, messageId: auditItems[fingerprint].messageId || '', optima: item.optima ? { filename: item.optima.filename, exportedRows: item.optima.exportedRows, missingIdentifiers: item.optima.missingIdentifiers } : null });
          continue;
        }
        try {
          const sent = await sendSmtp({ to: item.to, subject: item.subject, text: item.text, html: item.html, attachments: item.attachments });
          const sentResult = { supplier: item.name, to: item.to, sent: true, skippedDuplicate: false, sentAt: new Date().toISOString(), messageId: sent.message_id || '', provider: sent.provider || 'smtp' };
          const previousAudit = auditItems[fingerprint] && typeof auditItems[fingerprint] === 'object' ? auditItems[fingerprint] : {}, attempt = { ...sentResult, mode: forceResend ? 'resend' : 'send', reason: forceResend ? resendReason : '' };
          auditItems[fingerprint] = { ...previousAudit, sent: true, sentAt: previousAudit.sentAt || sentResult.sentAt, messageId: previousAudit.messageId || sentResult.messageId, provider: sentResult.provider, lastSentAt: sentResult.sentAt, lastMessageId: sentResult.messageId, sendCount: Math.max(0, Number(previousAudit.sendCount) || 0) + 1, attempts: [...(Array.isArray(previousAudit.attempts) ? previousAudit.attempts : []), attempt].slice(-50), orderId: text(order.id, 120), orderNumber: text(order.numer || order.id, 120), revision, fingerprint };
          try { await write('supplier_order_email_audit', { items: auditItems, updated_at: sentResult.sentAt }); }
          catch (auditError) { sentResult.auditError = text(auditError?.message || auditError, 300); }
          results.push({ ...sentResult, optima: item.optima ? { filename: item.optima.filename, exportedRows: item.optima.exportedRows, missingIdentifiers: item.optima.missingIdentifiers } : null });
        } catch (error) {
          results.push({ supplier: item.name, to: item.to, sent: false, error: text(error?.message || error, 700), code: text(error?.code || 'email_error', 120), optima: item.optima ? { filename: item.optima.filename, exportedRows: item.optima.exportedRows, missingIdentifiers: item.optima.missingIdentifiers } : null });
        }
      }
      const sentAt = results.filter((result) => result.sent).map((result) => result.sentAt).filter(Boolean).sort().pop() || null;
      const optimaMissingIdentifiers = results.flatMap((result) => (result.optima?.missingIdentifiers || []).map((item) => ({ supplier: result.supplier, ...item })));
      const plan = await supplierPlan.markEmailResults({ draftId: order.id, expectedRevision: revision, sendLockId: currentPlan.sendLockId, results, sentAt, actor, resend: forceResend, resendReason });
      const procurementWorkflow = await syncProcurement(plan.supplierOrders, 'supplier-email');
      return respond({ ok: true, allSent: results.length > 0 && results.every((result) => result.sent), resent: forceResend, sentAt, results, revision, optimaComplete: optimaMissingIdentifiers.length === 0, optimaMissingIdentifiers, draft: plan.draft, supplierOrders: plan.supplierOrders, rev: plan.rev, updated_at: plan.updated_at, procurementWorkflow: { changed: procurementWorkflow.changed } });
    }

    if (action === 'send-email') {
      const to = text(body.to, 300).trim(), subject = text(body.subject, 300).trim(), messageText = text(body.text, 20000), html = text(body.html, 30000);
      if (!to || !subject || (!messageText && !html)) return respond({ ok: false, error: 'Brak adresu, tematu albo treści e-maila' }, 422);
      try {
        const result = await sendSmtp({ to, subject, text: messageText, html: html || undefined });
        return respond({ ok: true, provider: result.provider, message_id: result.message_id, accepted: result.accepted || [] });
      } catch (error) { return respond({ ok: false, error: error.message, code: error.code || 'email_error' }, error.code === 'email_not_configured' ? 503 : 502); }
    }

    const number = orderNumber(body.nr || body.number), type = text(body.typ || body.type, 40).trim();
    if (!number || !type) return respond({ ok: false, error: 'Brak numeru zamówienia albo typu wiadomości' }, 422);
    const record = await read('orders', { items: [] }), order = (Array.isArray(record.items) ? record.items : []).find((item) => item.nr === number);
    if (!order) return respond({ ok: false, error: 'Nie znaleziono zamówienia', code: 'not_found' }, 404);
    if (!order.email) return respond({ ok: false, error: 'Zamówienie nie ma adresu e-mail klienta', code: 'no_email' }, 422);
    if (!emailConfig().configured) return respond({ ok: false, error: 'E-mail nie jest skonfigurowany po stronie serwera.', code: 'email_not_configured' }, 503);
    try {
      let result;
      if (type === 'potwierdzenie') {
        result = await sendSmtp({ to: order.email, ...orderConfirmation(order) });
        await appendHistory(order.nr, { typ: 'potwierdzenie', status: 'wysłano', provider: result.provider, id: result.message_id, automatyczne: false });
        result = { configured: true, sent: true, provider: result.provider, id: result.message_id };
      } else {
        const amount = body.kwota != null && body.kwota !== '' ? Number(body.kwota) : null;
        result = await sendStatus(order, type, amount != null ? { kwota: amount } : {});
        if (result && result.sent === false && result.error) return respond({ ok: false, error: result.error, code: result.error }, result.error === 'email_not_configured' ? 503 : 502);
      }
      const latestRecord = await read('orders', { items: [] }), latestOrder = (latestRecord.items || []).find((item) => item.nr === number) || order;
      return respond({ ok: true, provider: result.provider, message_id: result.id, sent: result.sent !== false, powiadomienia: latestOrder?.wysylka?.powiadomienia || [] });
    } catch (error) { return respond({ ok: false, error: error.message, code: error.code || 'email_error' }, error.code === 'email_not_configured' ? 503 : 502); }
  };
}
