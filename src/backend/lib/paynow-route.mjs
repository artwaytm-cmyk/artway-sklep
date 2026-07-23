export function createPaynowRoute(deps = {}) {
  const {
    respond,
    isAdmin,
    rateLimit,
    text,
    read,
    write,
    readDeletedOrders,
    deletedOrderMap,
    filterUndeletedOrders,
    normalizeOrder,
    orderNumber,
    orderLimit,
    finalStatuses,
    configure,
    diagnose,
    paymentStatus,
    idempotencyKey,
    call,
    paymentPayload,
    updateOrder,
    signNotification,
    compareSignature,
    cents,
    currencyText,
    sendNewOrderEmails,
    emailConfig,
    appendEmailHistory,
    sendStatusEmail,
  } = deps;

  return async function paynowRoute(req, url, action) {
    if (action === 'paynow-config') {
      const cfg = configure(req);
      return respond({
        ok: true,
        configured: cfg.configured,
        env: cfg.env,
        apiBaseUrl: cfg.apiBaseUrl,
        continueUrl: cfg.continueUrl,
        notificationUrl: cfg.notificationUrl,
        requiredEnv: ['PAYNOW_API_KEY', 'PAYNOW_SIGNATURE_KEY', 'PAYNOW_ENV'],
        optionalEnv: ['PAYNOW_CONTINUE_URL', 'PAYNOW_NOTIFICATION_URL'],
      });
    }

    if (action === 'paynow-diagnose') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const limited = rateLimit(req, 'paynow-diagnose', 30, 60 * 60 * 1000);
      if (limited) return limited;
      try {
        const result = await diagnose(req);
        return respond(result, result.ok ? 200 : 503);
      } catch (error) {
        return respond({
          ok: false,
          configured: true,
          connected: false,
          error: text(error?.message || 'Test Paynow nie powiódł się', 500),
          code: 'paynow_diagnostic_failed',
        }, Number(error?.status) || 502);
      }
    }

    if (action === 'paynow-create') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const cfg = configure(req);
      if (!cfg.configured) return respond({
        ok: false,
        configured: false,
        error: 'Paynow nie jest skonfigurowany po stronie serwera. Ustaw PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY w chronionym środowisku backendu VPS.',
        code: 'paynow_not_configured',
      }, 503);
      const body = await req.json().catch(() => ({}));
      const order = normalizeOrder(body.order);
      if (!order) return respond({ ok: false, error: 'Brak danych zamówienia' }, 422);
      const deleted = deletedOrderMap(await readDeletedOrders());
      if (deleted.has(order.nr)) return respond({ ok: false, error: 'Zamówienie jest usunięte i nie może dostać nowej płatności', code: 'deleted' }, 409);

      const record = await read('orders', { items: [] });
      const items = filterUndeletedOrders(record.items || [], deleted);
      const existingIndex = items.findIndex((item) => item.nr === order.nr);
      const savedOrder = existingIndex >= 0 ? items[existingIndex] : order;
      const previousPayment = savedOrder.paynow || {};
      if (previousPayment.redirectUrl && !finalStatuses.has(String(previousPayment.status || '').toUpperCase())) {
        return respond({
          ok: true,
          configured: true,
          reused: true,
          redirectUrl: previousPayment.redirectUrl,
          paymentId: previousPayment.paymentId || '',
          status: previousPayment.status || '',
          paymentStatus: paymentStatus(previousPayment.status),
          paynow: previousPayment,
        });
      }
      if (existingIndex < 0) {
        items.unshift(savedOrder);
        while (items.length > orderLimit) items.pop();
        await write('orders', { items, updated_at: new Date().toISOString() });
      }

      const payload = paymentPayload(savedOrder, req);
      const requestKey = idempotencyKey('ord', savedOrder.nr);
      const data = await call(req, '/v3/payments', { method: 'POST', bodyObj: payload, idempotencyKey: requestKey });
      const status = text(data.status, 40).toUpperCase();
      const paymentId = text(data.paymentId, 40);
      const redirectUrl = text(data.redirectUrl, 1000);
      const updated = await updateOrder({ externalId: savedOrder.nr, paymentId, status, redirectUrl, env: cfg.env });
      let email = null;
      try {
        email = await sendNewOrderEmails(updated || { ...savedOrder, paynow: { paymentId, status, redirectUrl, env: cfg.env } });
      } catch (error) {
        email = { configured: emailConfig().configured, sent: false, error: error.message };
        await appendEmailHistory(savedOrder.nr, { typ: 'potwierdzenie', status: 'błąd wysyłki', blad: error.message, automatyczne: true });
      }
      return respond({
        ok: true,
        configured: true,
        env: cfg.env,
        redirectUrl,
        paymentId,
        status,
        paymentStatus: paymentStatus(status),
        paynow: updated?.paynow || { paymentId, status, redirectUrl, env: cfg.env },
        email,
      }, 201);
    }

    if (action === 'paynow-status') {
      const cfg = configure(req);
      if (!cfg.configured) return respond({ ok: false, configured: false, error: 'Paynow nie jest skonfigurowany po stronie serwera.', code: 'paynow_not_configured' }, 503);
      let paymentId = text(url.searchParams.get('paymentId'), 40).trim();
      const number = orderNumber(url.searchParams.get('nr'));
      if (!paymentId && number) {
        const record = await read('orders', { items: [] });
        const order = (record.items || []).find((item) => item.nr === number);
        paymentId = text(order?.paynow?.paymentId, 40).trim();
      }
      if (!paymentId) return respond({ ok: false, error: 'Brak paymentId Paynow' }, 422);
      const data = await call(req, `/v3/payments/${encodeURIComponent(paymentId)}/status`, {
        method: 'GET',
        idempotencyKey: idempotencyKey('stat', paymentId),
      });
      const status = text(data.status, 40).toUpperCase();
      const updated = await updateOrder({ externalId: number, paymentId: data.paymentId || paymentId, status, env: cfg.env });
      return respond({
        ok: true,
        configured: true,
        paymentId: data.paymentId || paymentId,
        status,
        paymentStatus: paymentStatus(status),
        order: updated ? { nr: updated.nr, status: updated.status, platnoscStatus: updated.platnoscStatus, paynow: updated.paynow } : null,
      });
    }

    if (action === 'paynow-notification') {
      if (req.method !== 'POST') return new Response('', { status: 405 });
      const cfg = configure(req);
      const rawBody = await req.text();
      if (!cfg.configured) return new Response('', { status: 503 });
      const signature = req.headers.get('signature') || req.headers.get('Signature') || '';
      const expected = signNotification(rawBody, cfg.signatureKey);
      if (!compareSignature(signature, expected)) return new Response('', { status: 401 });
      let data = {};
      try { data = JSON.parse(rawBody || '{}'); } catch { return new Response('', { status: 400 }); }
      await updateOrder({
        externalId: data.externalId,
        paymentId: data.paymentId,
        status: text(data.status, 40).toUpperCase(),
        modifiedAt: text(data.modifiedAt, 80),
        env: cfg.env,
      });
      return new Response('', { status: 202, headers: { 'cache-control': 'no-store' } });
    }

    if (action === 'paynow-configure-urls') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const cfg = configure(req);
      if (!cfg.configured) return respond({ ok: false, configured: false, error: 'Najpierw ustaw PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY w chronionym środowisku backendu VPS.', code: 'paynow_not_configured' }, 503);
      const body = await req.json().catch(() => ({}));
      const payload = {
        notificationUrl: text(body.notificationUrl || cfg.notificationUrl, 1000),
        continueUrl: text(body.continueUrl || cfg.continueUrl, 1000),
      };
      await call(req, '/v3/configuration/shop/urls', { method: 'POST', bodyObj: payload });
      return respond({ ok: true, configured: true, env: cfg.env, ...payload });
    }

    if (action === 'paynow-refund') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const cfg = configure(req);
      if (!cfg.configured) return respond({
        ok: false,
        configured: false,
        error: 'Paynow nie jest skonfigurowany po stronie serwera. Ustaw PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY w chronionym środowisku backendu VPS.',
        code: 'paynow_not_configured',
      }, 503);
      const body = await req.json().catch(() => ({}));
      const number = orderNumber(body.nr || body.number);
      if (!number) return respond({ ok: false, error: 'Brak numeru zamówienia' }, 422);
      const record = await read('orders', { items: [] });
      const items = Array.isArray(record.items) ? record.items : [];
      const index = items.findIndex((item) => item.nr === number);
      if (index < 0) return respond({ ok: false, error: 'Nie znaleziono zamówienia', code: 'not_found' }, 404);
      const order = { ...items[index] };
      const paymentId = text(order?.paynow?.paymentId, 40).trim();
      if (!paymentId) return respond({ ok: false, error: 'To zamówienie nie ma płatności Paynow — zwrot pieniędzy zrób w banku, a zamówienie oznacz jako „zwrot pieniędzy”.', code: 'no_payment' }, 409);
      const currentStatus = String(order?.paynow?.status || '').toUpperCase();
      if (currentStatus !== 'CONFIRMED') return respond({ ok: false, error: `Zwrot możliwy tylko dla opłaconej płatności (CONFIRMED). Obecny status Paynow: ${currentStatus || 'brak'}.`, code: 'not_confirmed' }, 409);
      const fullAmount = cents(order.razem);
      const refunded = (Array.isArray(order?.paynow?.refunds) ? order.paynow.refunds : []).reduce((sum, refund) => sum + (Number(refund.amount) || 0), 0);
      const amount = body.amount != null && body.amount !== '' ? cents(body.amount) : fullAmount - refunded;
      if (amount <= 0) return respond({ ok: false, error: 'Kwota zwrotu musi być większa od zera' }, 422);
      if (amount + refunded > fullAmount) return respond({ ok: false, error: `Kwota zwrotu przekracza pozostałą kwotę płatności (pozostało ${currencyText((fullAmount - refunded) / 100)}).`, code: 'amount_too_large' }, 409);
      const rawReason = String(body.reason || '').toUpperCase();
      const reason = ['RMA', 'REFUND_BEFORE_14', 'REFUND_AFTER_14', 'OTHER'].includes(rawReason) ? rawReason : '';
      const bodyObj = reason ? { amount, reason } : { amount };
      const requestKey = idempotencyKey('ref', `${paymentId}${Date.now()}`);
      const data = await call(req, `/v3/payments/${encodeURIComponent(paymentId)}/refunds`, { method: 'POST', bodyObj, idempotencyKey: requestKey });
      const refundId = text(data.refundId, 60);
      const refundStatus = text(data.status, 40).toUpperCase();
      const refunds = Array.isArray(order?.paynow?.refunds) ? order.paynow.refunds.slice() : [];
      refunds.push({ refundId, status: refundStatus, amount, reason, ts: new Date().toISOString() });
      const fullRefund = amount + refunded >= fullAmount;
      order.paynow = { ...order.paynow, refunds, updatedAt: new Date().toISOString() };
      order.status = 'zwrot pieniędzy';
      order.platnoscStatus = fullRefund ? 'zwrócone' : 'częściowy zwrot';
      const shipping = order.wysylka || {};
      shipping.historia = [...(Array.isArray(shipping.historia) ? shipping.historia : []), {
        czas: new Date().toLocaleString('pl-PL'),
        status: 'Zwrot pieniędzy Paynow',
        opis: `${currencyText(amount / 100)} • ${refundId || '—'} • ${refundStatus || '—'}`,
      }];
      order.wysylka = shipping;
      items[index] = order;
      await write('orders', { items, updated_at: new Date().toISOString() });
      let email = null;
      try { email = await sendStatusEmail(order, 'zwrot_pieniedzy', { kwota: amount / 100 }); }
      catch (error) { email = { sent: false, error: error.message }; }
      const after = await read('orders', { items: [] });
      const saved = (after.items || []).find((item) => item.nr === number) || order;
      return respond({
        ok: true,
        configured: true,
        refundId,
        status: refundStatus,
        amount,
        fullRefund,
        email,
        order: { nr: saved.nr, status: saved.status, platnoscStatus: saved.platnoscStatus, paynow: saved.paynow },
        powiadomienia: saved?.wysylka?.powiadomienia || [],
      }, 201);
    }

    return null;
  };
}
