import crypto from 'node:crypto';
import { mergeCatalogProducts } from './domain/catalog-quality.mjs';
import { applyProductSaleDecisionBatch } from './domain/product-sale-decisions.mjs';

const ACTIONS = new Set(['product-url-inspect', 'product-url-prepare', 'product-sale-availability', 'product-sale-decision', 'supplier-availability-sample']);

export function createProductAvailabilityRoute(deps) {
  const { respond, isAdmin, text, read, write, inspectProduct, prepareProduct, syncSaleChannels, mappingItems, isAllegroOrderActive, fetchProduct, notify } = deps;
  return async function productAvailabilityRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    const body = await req.json().catch(() => ({}));

    if (action === 'product-url-inspect') {
      const target = text(body.url, 1000).trim();
      if (!/^https?:\/\//i.test(target)) return respond({ ok: false, error: 'Podaj pełny adres URL produktu' }, 422);
      return respond(await inspectProduct(target));
    }

    if (action === 'product-url-prepare') {
      const target = text(body.url, 1000).trim();
      if (!/^https?:\/\//i.test(target)) return respond({ ok: false, error: 'Podaj pełny adres URL produktu' }, 422);
      const rawChoice = body.choice, choice = rawChoice === null || rawChoice === undefined || rawChoice === '' ? null : Number(rawChoice);
      if (choice !== null && (!Number.isInteger(choice) || choice < 0 || choice > 20)) return respond({ ok: false, error: 'Nieprawidłowy wybór produktu', code: 'validation' }, 422);
      return respond(await prepareProduct(req, target, { choice }));
    }

    if (action === 'product-sale-availability') {
      const productId = text(body.productId, 100).trim(), available = body.available === true;
      if (!productId) return respond({ ok: false, error: 'Brak identyfikatora produktu', code: 'validation' }, 422);
      const settingsRec = await read('settings', { data: {}, rev: 0, updated_at: null }), data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
      const availability = data.artway_dostepnosc && typeof data.artway_dostepnosc === 'object' ? { ...data.artway_dostepnosc } : {}, previousAvailability = { ...availability }, now = new Date().toISOString();
      if (available) delete availability[productId];
      else availability[productId] = { status: 'niedostepny', powod: text(body.reason || 'Ręcznie wyłączony ze sprzedaży', 500), data: now, operator: 'administrator', source: 'manual', automatic: false };
      data.artway_dostepnosc = availability;
      const saleAutomation = await syncSaleChannels(req, [{ ok: true, productId, status: available ? 'dostepny' : 'brak', available, quantity: available ? 1 : 0, checkedAt: now }], data, { previousAvailability });
      if (!saleAutomation.complete) return respond({ ok: false, error: 'Nie zmieniono sprzedaży, ponieważ Allegro nie potwierdziło całej operacji. System wycofał wykonane części i zapisał diagnostykę.', code: 'sale_channel_sync_failed', productId, available, saleAutomation }, 502);
      await write('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now });
      return respond({ ok: true, synchronized: true, productId, available, saleAutomation, updated_at: now });
    }

    if (action === 'product-sale-decision') {
      const settingsRec = await read('settings', { data: {}, rev: 0, updated_at: null });
      const previousAvailability = settingsRec.data?.artway_dostepnosc && typeof settingsRec.data.artway_dostepnosc === 'object' ? { ...settingsRec.data.artway_dostepnosc } : {};
      const batch = applyProductSaleDecisionBatch({ body, data: settingsRec.data, operator: 'administrator' }), { data, results, checks, audit, nowIso } = batch;
      const saleAutomation = await syncSaleChannels(req, checks, data, { previousAvailability });
      if (!saleAutomation.complete) return respond({ ok: false, error: 'Decyzja nie została zapisana, ponieważ Allegro nie potwierdziło całej operacji. System wycofał wykonane części i zapisał diagnostykę.', code: 'sale_channel_sync_failed', changed: 0, saleAutomation }, 502);
      const agentHistory = Array.isArray(data.artway_agent_ai_historia) ? [...data.artway_agent_ai_historia] : [];
      audit.forEach((entry, index) => agentHistory.unshift({ id: `AI-DEC-${Date.now().toString(36)}-${index}`, ...entry, data: nowIso, dataTxt: new Date(nowIso).toLocaleString('pl-PL'), dane: { ...entry.dane, saleAutomation } }));
      data.artway_agent_ai_historia = agentHistory.slice(0, 500);
      await write('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: nowIso });
      return respond({ ok: true, synchronized: true, ...results[0], changed: results.length, results, saleAutomation, updated_at: nowIso });
    }

    const settingsRec = await read('settings', { data: {}, rev: 0, updated_at: null }), data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
    const warehouse = data.artway_magazyn_ustawienia && typeof data.artway_magazyn_ustawienia === 'object' ? data.artway_magazyn_ustawienia : {};
    const threshold = Math.max(1, Math.min(1000000, Number(body.threshold ?? warehouse.progNiskiProducenta ?? 50) || 50));
    const limit = Math.max(1, Math.min(25, Number(body.limit ?? warehouse.producentProbka ?? 8) || 8));
    const requestedIds = new Set((Array.isArray(body.productIds) ? body.productIds : []).map((value) => text(value, 100).trim()).filter(Boolean));
    const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {}, baseMap = mergeCatalogProducts(data).map;
    const [storeOrdersRec, allegroOrdersRec, mappingsRec] = await Promise.all([read('orders', { items: [] }), read('allegro_orders', { items: [] }), read('allegro_mappings', { items: {} })]);
    const sales = new Map(), nowMs = Date.now(), day = 86400000, cutoff30 = nowMs - 30 * day, cutoff90 = nowMs - 90 * day;
    const sale = (id, channel, quantity, at, active = false) => {
      const key = text(id, 100).trim(), count = Math.max(0, Number(quantity) || 0), time = Number(at) || 0;
      if (!key || !count) return;
      const record = sales.get(key) || { sklep30: 0, allegro30: 0, sklep90: 0, allegro90: 0, activeDemand: 0, score: 0 };
      if (time >= cutoff90) record[`${channel}90`] += count;
      if (time >= cutoff30) record[`${channel}30`] += count;
      if (active) record.activeDemand += count;
      sales.set(key, record);
    };
    const orderTime = (order = {}) => { const raw = order.ts ?? order.createdAt ?? order.firstFetchedAt ?? order.data ?? order.date ?? '', number = Number(raw); return Number.isFinite(number) && number > 1000000000 ? (number < 100000000000 ? number * 1000 : number) : (Date.parse(raw) || 0); };
    for (const order of Array.isArray(storeOrdersRec.items) ? storeOrdersRec.items : []) {
      const status = String(order?.status || '').toLowerCase(), active = !['anulowane', 'dostarczone', 'zakończone', 'zwrot', 'zwrot pieniędzy'].includes(status);
      if (status === 'anulowane') continue;
      for (const line of Array.isArray(order?.pozycjeDane) ? order.pozycjeDane : []) sale(line.id, 'sklep', line.ilosc || 1, orderTime(order), active);
    }
    const mappings = mappingItems(mappingsRec), offerToProduct = new Map();
    for (const [offerId, mapping] of Object.entries(mappings)) { const id = text(mapping?.productId ?? mapping?.produktId ?? mapping?.id ?? mapping, 100).trim(); if (id) offerToProduct.set(String(offerId), id); }
    for (const product of baseMap.values()) if (product.allegroOfferId) offerToProduct.set(String(product.allegroOfferId), String(product.id));
    for (const order of Array.isArray(allegroOrdersRec.items) ? allegroOrdersRec.items : []) {
      const active = isAllegroOrderActive(order), status = String(order?.status || '').toUpperCase(); if (status === 'CANCELLED') continue;
      for (const line of Array.isArray(order?.lineItems) ? order.lineItems : []) { const id = offerToProduct.get(String(line.offerId || line.offer?.id || '')); if (id) sale(id, 'allegro', line.quantity || 1, orderTime(order), active); }
    }
    for (const record of sales.values()) record.score = record.sklep30 * 4 + record.allegro30 * 5 + record.sklep90 + record.allegro90 + record.activeDemand * 8;
    let candidates = [...baseMap.values()].filter((product) => /^https?:\/\//i.test(text(product.producentUrl || product.sourceUrl, 1000).trim())).map((product) => ({ ...product, _sales: sales.get(String(product.id)) || { sklep30: 0, allegro30: 0, sklep90: 0, allegro90: 0, activeDemand: 0, score: 0 } }));
    if (requestedIds.size) candidates = candidates.filter((product) => requestedIds.has(String(product.id)));
    else {
      const bestsellers = candidates.filter((product) => product._sales.score > 0).sort((left, right) => right._sales.score - left._sales.score || (Date.parse(left.producentSprawdzonoAt || '') || 0) - (Date.parse(right.producentSprawdzonoAt || '') || 0));
      const priorityCount = Math.min(bestsellers.length, Math.max(1, Math.ceil(limit * 0.75))), priority = bestsellers.slice(0, priorityCount), priorityIds = new Set(priority.map((product) => String(product.id)));
      const stale = candidates.filter((product) => !priorityIds.has(String(product.id))).sort((left, right) => (Date.parse(left.producentSprawdzonoAt || '') || 0) - (Date.parse(right.producentSprawdzonoAt || '') || 0));
      const pool = stale.slice(0, Math.max(limit, Math.min(stale.length, limit * 4)));
      for (let index = pool.length - 1; index > 0; index--) { const random = Math.floor(Math.random() * (index + 1)); [pool[index], pool[random]] = [pool[random], pool[index]]; }
      candidates = [...priority, ...pool.slice(0, Math.max(0, limit - priority.length))];
    }
    candidates = candidates.slice(0, limit);
    const checkedAt = new Date().toISOString(), results = [];
    for (let offset = 0; offset < candidates.length; offset += 4) {
      const checked = await Promise.all(candidates.slice(offset, offset + 4).map(async (product) => {
        const productId = String(product.id), sourceUrl = text(product.producentUrl || product.sourceUrl, 1000).trim();
        try {
          const parsed = await fetchProduct(sourceUrl), quantityRaw = parsed.availability?.quantity;
          const quantity = quantityRaw === null || quantityRaw === undefined || quantityRaw === '' ? null : Math.max(0, Math.floor(Number(quantityRaw) || 0)), available = parsed.availability?.available === true;
          const status = quantity === 0 ? 'brak' : (quantity !== null && quantity <= threshold ? 'niski' : (available ? (quantity === null ? 'dostepny_nieznany' : 'dostepny') : 'nieznany'));
          return { ok: true, productId, name: text(product.nazwa || parsed.product?.nazwa || 'Produkt', 300), sourceUrl, quantity, exact: quantity !== null && parsed.availability?.exact === true, status, available, source: text(parsed.availability?.source || '', 120), checkedAt, sales: product._sales || {} };
        } catch (error) { return { ok: false, productId, name: text(product.nazwa || 'Produkt', 300), sourceUrl, status: 'blad', error: text(error.message || error, 500), checkedAt, sales: product._sales || {} }; }
      }));
      results.push(...checked);
    }
    const changedAlerts = [];
    for (const result of results) {
      const previous = edits[result.productId] && typeof edits[result.productId] === 'object' ? edits[result.productId] : {};
      if (!result.ok) { edits[result.productId] = { ...previous, producentOstatniaProbaAt: checkedAt, producentOstatniBlad: result.error }; continue; }
      const history = Array.isArray(previous.producentStanHistoria) ? [...previous.producentStanHistoria] : [];
      history.unshift({ at: checkedAt, status: result.status, quantity: result.quantity, exact: result.exact });
      const alertActive = ['niski', 'brak'].includes(result.status), alertHash = alertActive ? result.status : '';
      if (alertActive && alertHash !== previous.producentAlertHash) changedAlerts.push(result);
      edits[result.productId] = { ...previous, producentUrl: result.sourceUrl, sourceUrl: result.sourceUrl, dostepnoscProducenta: result.status === 'brak' ? 'niedostępny' : (result.available ? 'dostępny' : 'do sprawdzenia'), stanProducenta: result.quantity === null ? '' : result.quantity, stanProducentaDokladny: result.exact, stanProducentaZrodlo: result.source, producentStatus: result.status, producentSprawdzonoAt: checkedAt, producentOstatniaProbaAt: checkedAt, producentOstatniBlad: '', producentAlertAktywny: alertActive, producentAlertHash: alertHash, producentPriorytetWynik: Number(result.sales?.score || 0), sprzedazSklep30: Number(result.sales?.sklep30 || 0), sprzedazAllegro30: Number(result.sales?.allegro30 || 0), sprzedazRazem30: Number(result.sales?.sklep30 || 0) + Number(result.sales?.allegro30 || 0), aktywneZapotrzebowanie: Number(result.sales?.activeDemand || 0), producentStanHistoria: history.slice(0, 5) };
    }
    data.artway_produkty_edytowane = edits;
    let saleAutomation = { siteHidden: 0, siteRestored: 0, allegroHidden: 0, allegroRestored: 0, unchanged: 0, errors: [] };
    try { saleAutomation = await syncSaleChannels(req, results, data); }
    catch (error) { saleAutomation.errors = [{ action: 'availability-automation', error: text(error?.message || error, 700), code: text(error?.code || '', 120) }]; }
    const agentHistory = Array.isArray(data.artway_agent_ai_historia) ? [...data.artway_agent_ai_historia] : [];
    const summary = { checked: results.length, priorityChecked: results.filter((result) => Number(result.sales?.score || 0) > 0).length, available: results.filter((result) => ['dostepny', 'dostepny_nieznany'].includes(result.status)).length, low: results.filter((result) => result.status === 'niski').length, unavailable: results.filter((result) => result.status === 'brak').length, unknown: results.filter((result) => ['nieznany', 'blad'].includes(result.status)).length, alerts: changedAlerts.length, threshold, saleAutomation };
    agentHistory.unshift({ id: `AI-SUP-${Date.now().toString(36)}`, typ: 'dostepnosc-producentow', opis: `Agent wyrywkowo sprawdził ${summary.checked} produktów u producentów`, data: checkedAt, dataTxt: new Date().toLocaleString('pl-PL'), operator: text(body.source || 'agent-serwerowy', 100), dane: summary });
    data.artway_agent_ai_historia = agentHistory.slice(0, 500);
    await write('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: checkedAt });
    const auditRec = await read('supplier_availability_audit', { items: [], updated_at: null }), audit = Array.isArray(auditRec.items) ? [...auditRec.items] : [];
    audit.unshift(...results.map((result) => ({ id: crypto.randomUUID(), ...result, threshold, runSource: text(body.source || 'manual', 100) })));
    await write('supplier_availability_audit', { items: audit.slice(0, 5000), updated_at: checkedAt });
    let telegram = { sent: false };
    if (changedAlerts.length) {
      const alertFingerprint = changedAlerts.map((result) => `${result.productId}:${result.status}`).sort().join('|');
      const automation = [saleAutomation.siteHidden ? `ukryto w sklepie: ${saleAutomation.siteHidden}` : '', saleAutomation.siteRestored ? `przywrócono w sklepie: ${saleAutomation.siteRestored}` : '', saleAutomation.allegroHidden ? `wstrzymano na Allegro: ${saleAutomation.allegroHidden}` : '', saleAutomation.allegroRestored ? `wznowiono na Allegro: ${saleAutomation.allegroRestored}` : '', saleAutomation.errors?.length ? `błędy automatyki: ${saleAutomation.errors.length}` : ''].filter(Boolean).join(' · ');
      try { telegram = await notify({ key: 'supplier-availability', legacyPrefix: 'supplier-availability:', fingerprint: alertFingerprint, category: 'supplier', severity: 'warning', count: changedAlerts.length, title: 'Dostępność u producentów', description: automation, doneWhen: 'Każda zmiana dostępności ma zapisaną decyzję sprzedażową.', items: changedAlerts.slice(0, 8).map((result) => `${result.name} · ${result.status === 'brak' ? 'brak' : `${result.quantity} szt.`}`), href: 'https://artwaytm.pl/#/admin/magazyn/dostawcy' }, '', { source: 'supplier-availability' }); }
      catch (error) { telegram = { sent: false, error: text(error.message || error, 300) }; }
    }
    return respond({ ok: true, summary, results, checkedAt, saleAutomation, telegram });
  };
}
