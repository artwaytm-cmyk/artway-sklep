import crypto from 'node:crypto';

export function createInfaktRoute(deps = {}) {
  const {
    odpowiedz, czyAdmin, tekst, czytaj, zapisz, numerZamowienia,
    infaktPublicConfig, infaktDostawcyUstawienia, infaktDostawcyDozwoleni,
    infaktPobierzKosztyDozwolone, infaktKosztDoZwrotu, infaktSynchronizujCenyZakupu,
    infaktPrzypiszCeneZakupu, infaktCofnijDopasowanieCeny, infaktWywolaj,
    infaktPayloadZamowienia, infaktRef, infaktInvoiceFromTask, infaktErrorText,
  } = deps;
  return async function infaktRoute(req, url, action) {
    // ─── INFAKT: faktury, statusy asynchroniczne i dokumenty ───
    if (action === 'infakt-status') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const config = infaktPublicConfig(); let connection = null;
      if (config.configured && url.searchParams.get('verify') === '1') {
        try { const data = await infaktWywolaj('/api/v3/invoices.json', { parameters: { limit: 1, offset: 0, fields: 'id,uuid,number,status,invoice_date,gross_price' } }); connection = { ok: true, count: Number(data?.metainfo?.total_count ?? data?.entities?.length ?? 0) }; }
        catch (e) { connection = { ok: false, error: tekst(e.message, 700), code: e.code || 'infakt_error' }; }
      }
      const [links, suppliers, purchaseSync] = await Promise.all([czytaj('infakt_invoice_links', { items: {}, updated_at: null }), infaktDostawcyUstawienia(), czytaj('infakt_purchase_price_sync', { pendingItems: [], recentMatches: [], updated_at: null })]);
      return odpowiedz({ ok: true, config, connection, links: links.items || {}, suppliers, purchaseSync, updated_at: links.updated_at || null });
    }

    if (action === 'infakt-supplier-access') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      if (req.method === 'GET') return odpowiedz({ ok: true, suppliers: await infaktDostawcyUstawienia() });
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), items = infaktDostawcyDozwoleni(body.items), updated_at = new Date().toISOString();
      await zapisz('infakt_supplier_access', { items, updated_at });
      return odpowiedz({ ok: true, suppliers: { items, updated_at } });
    }

    if (action === 'infakt-costs') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const suppliers = await infaktDostawcyUstawienia();
      if (!suppliers.items.length) return odpowiedz({ ok: true, costs: [], suppliers, scanned: 0, message: 'Biała lista dostawców jest pusta — żaden dokument kosztowy nie został ujawniony.' });
      const wanted = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 100) || 100));
      const result = await infaktPobierzKosztyDozwolone(suppliers.items, { wanted, maxScan: 5000 });
      const collected = result.items.map(({ document, supplier }) => infaktKosztDoZwrotu(document, supplier));
      const scanned = result.scanned;
      const purchaseSync = await czytaj('infakt_purchase_price_sync', { pendingItems: [], recentMatches: [], updated_at: null });
      return odpowiedz({ ok: true, costs: collected, suppliers, purchaseSync, scanned, returned: collected.length });
    }

    if (action === 'infakt-purchase-sync') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({})), purchaseSync = await infaktSynchronizujCenyZakupu({ days: body.days, limit: body.limit, force: body.force === true });
      return odpowiedz({ ok: true, purchaseSync });
    }

    if (action === 'infakt-purchase-match') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({})), result = await infaktPrzypiszCeneZakupu(tekst(body.itemKey, 100), tekst(body.productId, 100));
      return odpowiedz({ ok: true, ...result });
    }

    if (action === 'infakt-purchase-unmatch') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({})), result = await infaktCofnijDopasowanieCeny(tekst(body.matchId, 100));
      return odpowiedz({ ok: true, ...result });
    }

    if (action === 'infakt-invoices') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const linksRec = await czytaj('infakt_invoice_links', { items: {} }), ownUuids = new Set(Object.values(linksRec?.items || {}).map((x) => tekst(x?.invoiceUuid, 200)).filter(Boolean));
      if (!ownUuids.size) return odpowiedz({ ok: true, invoices: [], metainfo: { count: 0, total_count: 0 }, config: infaktPublicConfig() });
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 50) || 50)), offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);
      const data = await infaktWywolaj('/api/v3/invoices.json', { parameters: { limit: 100, offset, order: 'invoice_date desc', fields: 'id,uuid,number,status,invoice_date,sale_date,payment_date,paid_date,gross_price,left_to_pay,currency,client_company_name,client_first_name,client_last_name,client_tax_code' } });
      const invoices = (Array.isArray(data.entities) ? data.entities : []).filter((x) => ownUuids.has(tekst(x?.uuid, 200))).slice(0, limit);
      return odpowiedz({ ok: true, invoices, metainfo: { count: invoices.length, total_count: ownUuids.size }, config: infaktPublicConfig() });
    }

    if (action === 'infakt-create-invoice') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({})), orderNumber = numerZamowienia(body.orderNumber || body.nrZamowienia);
      if (!orderNumber) return odpowiedz({ ok: false, error: 'Brak numeru zamówienia', code: 'validation' }, 422);
      const [ordersRec, linksRec] = await Promise.all([czytaj('orders', { items: [] }), czytaj('infakt_invoice_links', { items: {}, updated_at: null })]);
      const order = (Array.isArray(ordersRec.items) ? ordersRec.items : []).find((x) => numerZamowienia(x?.nr) === orderNumber);
      if (!order) return odpowiedz({ ok: false, error: 'Nie znaleziono zamówienia', code: 'not_found' }, 404);
      const links = linksRec.items && typeof linksRec.items === 'object' ? { ...linksRec.items } : {}, existing = links[orderNumber];
      if (existing && !['error', 'cancelled'].includes(String(existing.status || '').toLowerCase()) && body.force !== true) return odpowiedz({ ok: true, duplicatePrevented: true, link: existing, message: 'Faktura lub zadanie inFakt już istnieje dla tego zamówienia.' });
      const payload = infaktPayloadZamowienia(order, { status: 'draft', invoiceDate: body.invoiceDate, sendToKsef: false });
      const data = await infaktWywolaj('/api/v3/async/invoices.json', { method: 'POST', bodyObj: payload });
      const reference = infaktRef(data), now = new Date().toISOString();
      if (!reference) { const e = new Error('inFakt nie zwrócił numeru referencyjnego zadania'); e.code = 'infakt_missing_reference'; throw e; }
      links[orderNumber] = { orderNumber, taskReference: reference, status: 'processing', processingCode: data.processing_code || 100, processingDescription: tekst(data.processing_description || 'Zlecenie przyjęte', 500), createdAt: now, updatedAt: now, sendToKsef: payload.send_to_ksef, payloadHash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
      await zapisz('infakt_invoice_links', { items: links, updated_at: now });
      return odpowiedz({ ok: true, duplicatePrevented: false, link: links[orderNumber], task: data }, 201);
    }

    if (action === 'infakt-task-status') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const reference = tekst(url.searchParams.get('reference'), 200).trim(), orderNumber = numerZamowienia(url.searchParams.get('orderNumber'));
      if (!reference && !orderNumber) return odpowiedz({ ok: false, error: 'Brak referencji zadania', code: 'validation' }, 422);
      const linksRec = await czytaj('infakt_invoice_links', { items: {}, updated_at: null }), links = linksRec.items && typeof linksRec.items === 'object' ? { ...linksRec.items } : {};
      const current = orderNumber ? links[orderNumber] : Object.values(links).find((x) => x.taskReference === reference), ref = reference || current?.taskReference;
      if (!ref) return odpowiedz({ ok: false, error: 'Nie znaleziono referencji zadania', code: 'not_found' }, 404);
      const data = await infaktWywolaj(`/api/v3/async/invoices/status/${encodeURIComponent(ref)}.json`), invoice = infaktInvoiceFromTask(data), code = Number(data.processing_code || data.code || 0), now = new Date().toISOString();
      const status = code === 201 || invoice?.uuid ? 'created' : code === 422 ? 'error' : 'processing', key = orderNumber || current?.orderNumber;
      const link = { ...(current || {}), orderNumber: key || '', taskReference: ref, status, processingCode: code, processingDescription: tekst(data.processing_description || data.description || '', 700), invoiceId: invoice?.id || current?.invoiceId || null, invoiceUuid: tekst(invoice?.uuid || current?.invoiceUuid || '', 200), invoiceNumber: tekst(invoice?.number || current?.invoiceNumber || '', 120), error: status === 'error' ? infaktErrorText(data, 'Nie udało się utworzyć faktury') : '', updatedAt: now };
      if (key) { links[key] = link; await zapisz('infakt_invoice_links', { items: links, updated_at: now }); }
      return odpowiedz({ ok: true, status, link, task: data });
    }

    if (action === 'infakt-sync') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const linksRec = await czytaj('infakt_invoice_links', { items: {}, updated_at: null }), links = linksRec.items && typeof linksRec.items === 'object' ? { ...linksRec.items } : {}, results = [];
      for (const [orderNumber, current] of Object.entries(links).filter(([, x]) => x?.taskReference && x.status === 'processing').slice(0, 25)) {
        try { const data = await infaktWywolaj(`/api/v3/async/invoices/status/${encodeURIComponent(current.taskReference)}.json`), invoice = infaktInvoiceFromTask(data), code = Number(data.processing_code || data.code || 0), status = code === 201 || invoice?.uuid ? 'created' : code === 422 ? 'error' : 'processing'; links[orderNumber] = { ...current, status, processingCode: code, processingDescription: tekst(data.processing_description || '', 700), invoiceId: invoice?.id || current.invoiceId || null, invoiceUuid: tekst(invoice?.uuid || current.invoiceUuid || '', 200), invoiceNumber: tekst(invoice?.number || current.invoiceNumber || '', 120), error: status === 'error' ? infaktErrorText(data, 'Błąd tworzenia') : '', updatedAt: new Date().toISOString() }; results.push({ orderNumber, status }); }
        catch (e) { results.push({ orderNumber, status: 'error', error: tekst(e.message, 500) }); }
      }
      await zapisz('infakt_invoice_links', { items: links, updated_at: new Date().toISOString() });
      let purchaseSync = null; try { purchaseSync = await infaktSynchronizujCenyZakupu({ days: 180, limit: 25, force: false }); } catch (error) { purchaseSync = { available: false, errors: [tekst(error.message, 500)] }; }
      return odpowiedz({ ok: true, links, results, purchaseSync });
    }
    return null;
  };
}

