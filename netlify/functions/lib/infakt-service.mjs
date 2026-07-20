import crypto from 'node:crypto';
import { tekst } from './core/http.mjs';
import { createCatalogProductUpdater as allegroAktualizatorProduktowCentralnych } from './domain/catalog-product-updater.mjs';
import {
  infaktDostawcyDozwoleni,
  infaktCenaZakupuFields,
  infaktDopasujPozycje,
  infaktIndeksProduktow,
  infaktKsefPozycje,
  infaktKsefNumerZTekstu,
  infaktNazwaDostawcy,
  infaktNormalizujDokumentKosztowy,
  infaktParametryListyKsef,
  infaktMigawkaCenyZakupu,
  infaktPrzygotujCofniecieDopasowania,
  infaktSugestieNazwy,
  infaktXmlZOdpowiedzi,
  infaktZnajdzDostawce,
} from './infakt-purchase.mjs';

export function infaktCredentialLooksMasked(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/^(?:\*+|•+|x{6,}|<[^>]+>|\[[^\]]+\])(?:[a-z]{0,12})?$/i.test(raw)) return true;
  const special = [...raw].filter((char) => !/[a-z0-9\s]/i.test(char)).length;
  const letters = [...raw].filter((char) => /[a-z0-9]/i.test(char)).length;
  return raw.length >= 12 && special >= 10 && letters <= 8;
}

export function createInfaktService({ read, write }) {
  const czytaj = read;
  const zapisz = write;
  const INFAKT_ENVY = new Set(['production', 'sandbox']);
  function infaktKonfiguracja() {
    const env = INFAKT_ENVY.has(String(process.env.INFAKT_ENV || '').toLowerCase()) ? String(process.env.INFAKT_ENV).toLowerCase() : 'production';
    const apiKey = tekst(process.env.INFAKT_API_KEY || '', 500).trim();
    const credentialIssue = infaktCredentialLooksMasked(apiKey) ? 'masked_placeholder' : '';
    return { apiKey, configured: !!apiKey && !credentialIssue, credentialStored: !!apiKey, credentialIssue, env, baseUrl: env === 'sandbox' ? 'https://api.sandbox-infakt.pl' : 'https://api.infakt.pl', paymentDays: Math.max(0, Math.min(365, Number(process.env.INFAKT_PAYMENT_DAYS || 7) || 7)) };
  }
  function infaktPublicConfig() {
    const c = infaktKonfiguracja();
    return {
      configured: c.configured,
      credentialStored: c.credentialStored,
      credentialIssue: c.credentialIssue,
      env: c.env,
      paymentDays: c.paymentDays,
      missingEnv: c.configured ? [] : ['INFAKT_API_KEY'],
      requiredScopes: ['api:costs:read', 'api:invoices:read', 'api:invoices:write'],
      blockedOperations: ['costs:write', 'accounting', 'bank_accounts:write', 'ksef:integration:write'],
      policy: 'supplier-costs-read-and-customer-invoices-create-only',
    };
  }
  async function infaktDostawcyUstawienia() {
    const rec = await czytaj('infakt_supplier_access', { items: [], updated_at: null });
    return { items: infaktDostawcyDozwoleni(rec?.items), updated_at: rec?.updated_at || null };
  }
  function infaktKosztDoZwrotu(koszt = {}, dostawca = null) {
    koszt = infaktNormalizujDokumentKosztowy(koszt);
    return {
      uuid: tekst(koszt.uuid, 200),
      number: tekst(koszt.number, 160),
      seller_name: tekst(koszt.seller_name, 240),
      description: tekst(koszt.description, 600),
      net_price: Number(koszt.net_price) || 0,
      gross_price: Number(koszt.gross_price) || 0,
      tax_price: Number(koszt.tax_price) || 0,
      currency: tekst(koszt.currency || 'PLN', 12),
      issue_date: tekst(koszt.issue_date, 30),
      received_date: tekst(koszt.received_date, 30),
      due_date: tekst(koszt.due_date, 30),
      created_at: tekst(koszt.created_at, 80),
      category: tekst(koszt.category, 160),
      kind: tekst(koszt.kind, 80),
      statuses: (Array.isArray(koszt.statuses) ? koszt.statuses : []).slice(0, 20).map((s) => ({ symbol: tekst(s?.symbol, 80), name: tekst(s?.name, 120), group: tekst(s?.group, 80) })),
      supplier: dostawca ? { id: dostawca.id, name: dostawca.name } : null,
    };
  }
  async function infaktPobierzKosztyDozwolone(suppliers = [], { wanted = 200, maxScan = 5000 } = {}) {
    const items = [];
    let scanned = 0;
    const safeWanted = Math.max(1, Math.min(1000, Number(wanted) || 200));
    const safeMaxScan = Math.max(100, Math.min(10000, Number(maxScan) || 5000));
    for (let offset = 0; offset < safeMaxScan && items.length < safeWanted; offset += 100) {
      const data = await infaktWywolaj('/api/v3/documents/costs.json', { parameters: { limit: 100, offset } });
      const entities = Array.isArray(data?.entities) ? data.entities : [];
      scanned += entities.length;
      for (const raw of entities) {
        const document = infaktNormalizujDokumentKosztowy(raw);
        const supplier = infaktZnajdzDostawce(document, suppliers);
        if (supplier) items.push({ document, supplier });
        if (items.length >= safeWanted) break;
      }
      if (entities.length < 100 || !data?.metainfo?.next) break;
    }
    return { items, scanned };
  }
  async function infaktSynchronizujCenyZakupu({ days = 180, limit = 25, force = false } = {}) {
    const suppliers = await infaktDostawcyUstawienia(), previous = await czytaj('infakt_purchase_price_sync', { documents: {}, pendingItems: [], recentMatches: [], updated_at: null }), now = new Date().toISOString();
    const report = { source: 'inFakt dokument kosztowy → KSeF XML', available: true, startedAt: now, updated_at: now, lastListAttemptAt: now, days, scannedDocuments: 0, allowedDocuments: 0, processedDocuments: 0, lineCount: 0, matchedCount: 0, priceUpdatedCount: 0, unchangedCount: 0, pendingCount: 0, errors: [], documents: { ...(previous.documents || {}) }, costDocuments: { ...(previous.costDocuments || {}) }, lineMappings: { ...(previous.lineMappings || {}) }, pendingItems: [], recentMatches: Array.isArray(previous.recentMatches) ? previous.recentMatches.slice(0, 200) : [] };
    if (!suppliers.items.length) { report.available = false; report.errors.push('Biała lista dostawców jest pusta.'); await zapisz('infakt_purchase_price_sync', report); return report; }
    const lastAttempt = Date.parse(previous.lastListAttemptAt || ''), cooldownMs = 11 * 60 * 1000;
    if (!force && Number.isFinite(lastAttempt) && Date.now() - lastAttempt < cooldownMs) return { ...previous, cooldown: true, nextListAt: new Date(lastAttempt + cooldownMs).toISOString(), message: 'Użyto ostatniego wyniku, aby nie przekroczyć limitu 6 listowań KSeF na godzinę.' };
    const since = infaktParametryListyKsef({ days, limit: 20 })['q[invoice_date_gteq]'];
    let costsResult;
    try { costsResult = await infaktPobierzKosztyDozwolone(suppliers.items, { wanted: 1000, maxScan: 5000 }); }
    catch (error) {
      report.available = false;
      report.pendingItems = Array.isArray(previous.pendingItems) ? previous.pendingItems : [];
      report.pendingCount = report.pendingItems.length;
      report.errors.push(`Odczyt dokumentów kosztowych inFakt: ${tekst(error.message, 500)}`);
      await zapisz('infakt_purchase_price_sync', report); return report;
    }
    const uniqueCosts = new Map();
    for (const entry of costsResult.items) {
      const date = tekst(entry.document.issue_date, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < since) continue;
      const key = `${entry.supplier.id}|${entry.document.number}|${date}|${entry.document.gross_price}`;
      if (!uniqueCosts.has(key)) uniqueCosts.set(key, entry);
    }
    const costCandidates = [...uniqueCosts.values()].sort((a, b) => String(b.document.issue_date).localeCompare(String(a.document.issue_date)) || String(b.document.created_at || '').localeCompare(String(a.document.created_at || '')));
    const batchLimit = Math.max(1, Math.min(5, Number(limit) || 5));
    const selectedCosts = (force ? costCandidates : costCandidates.filter(({ document }) => !['processed', 'no_ksef'].includes(report.costDocuments[tekst(document.uuid, 200)]?.status))).slice(0, batchLimit);
    report.costDocumentsScanned = costsResult.scanned;
    report.allowedCostDocuments = costsResult.items.length;
    if (!selectedCosts.length) {
      report.pendingItems = Array.isArray(previous.pendingItems) ? previous.pendingItems : [];
      report.pendingCount = report.pendingItems.length;
      report.recentMatches = Array.isArray(previous.recentMatches) ? previous.recentMatches.slice(0, 500) : [];
      report.message = costCandidates.length ? 'Wszystkie znalezione faktury KSeF zostały już przeanalizowane.' : 'Brak faktur dozwolonych dostawców w wybranym okresie.';
      await zapisz('infakt_purchase_price_sync', report); return report;
    }
    const invoices = [];
    for (const { document, supplier } of selectedCosts) {
      const costKey = tekst(document.uuid, 200);
      try {
        const detail = await infaktWywolaj(`/api/v3/documents/costs/${encodeURIComponent(costKey)}.json`);
        const ksefNumber = infaktKsefNumerZTekstu(detail);
        if (!ksefNumber) {
          report.costDocuments[costKey] = { status: 'no_ksef', invoiceNumber: document.number, invoiceDate: document.issue_date, checkedAt: now };
          continue;
        }
        invoices.push({ ksef_number: ksefNumber, invoice_number: document.number, invoice_date: document.issue_date, seller_name: document.seller_name, seller_tax_code: document.seller_tax_code, sourceCostUuid: costKey, sourceSupplierId: supplier.id });
        report.costDocuments[costKey] = { status: 'identified', ksefNumber, invoiceNumber: document.number, invoiceDate: document.issue_date, checkedAt: now };
      } catch (error) {
        report.errors.push(`${tekst(document.number || costKey, 160)}: odczyt szczegółów kosztu — ${tekst(error.message, 300)}`);
        report.costDocuments[costKey] = { status: 'error', error: tekst(error.message, 300), checkedAt: now };
      }
    }
    report.scannedDocuments = selectedCosts.length; report.allowedDocuments = invoices.length;
    const settingsRec = await czytaj('settings', { data: {}, rev: 0, updated_at: null }), data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {}, products = allegroAgentProduktyCentralne(data), index = infaktIndeksProduktow(products), updater = allegroAktualizatorProduktowCentralnych(data);
    const processedKeys = new Set(), selectedInvoices = invoices.filter((invoice) => force || report.documents[tekst(invoice?.ksef_number, 200)]?.status !== 'processed').reverse();
    for (const invoice of selectedInvoices) {
      const documentKey = tekst(invoice.ksef_number, 200); if (!documentKey) continue;
      const supplier = infaktZnajdzDostawce(invoice, suppliers.items);
      try {
        const response = await infaktWywolaj(`/api/v3/ksef2/import/${encodeURIComponent(documentKey)}.json`, { parameters: { file_format: 'xml' }, raw: true, accept: 'application/xml, text/xml, application/json' });
        const xml = infaktXmlZOdpowiedzi(await response.text());
        const lines = infaktKsefPozycje(xml); if (!lines.length) throw new Error('Dokument XML nie zawiera rozpoznawalnych pozycji FaWiersz'); processedKeys.add(documentKey); report.lineCount += lines.length; report.processedDocuments++;
        for (const line of lines) {
          const lineSignature = crypto.createHash('sha256').update(`${supplier?.id || invoice.seller_name}|${line.ean}|${line.code}|${infaktNazwaDostawcy(line.name)}`).digest('hex').slice(0, 24);
          const itemKey = crypto.createHash('sha256').update(`${documentKey}|${line.row}|${lineSignature}`).digest('hex').slice(0, 24);
          const sourceItem = { itemKey, lineSignature, invoiceNumber: tekst(invoice.invoice_number, 120), ksefNumber: documentKey, invoiceDate: tekst(invoice.invoice_date, 20), supplier: supplier?.name || tekst(invoice.seller_name, 200), row: line.row, name: line.name, ean: line.ean, code: line.code, quantity: line.quantity, unitNet: line.unitNet, unitGross: line.unitGross, taxRate: line.taxRate, priceBasis: line.priceBasis, currency: line.currency };
          const rememberedProduct = products.get(String(previous?.lineMappings?.[lineSignature] || ''));
          const match = rememberedProduct ? { product: rememberedProduct, method: 'zapamiętane dopasowanie dostawcy', confidence: 100 } : infaktDopasujPozycje(line, products, index, supplier), validPrice = line.currency === 'PLN' && line.quantity > 0 && line.unitGross > 0;
          if (match.product && validPrice) {
            const product = products.get(String(match.product.id)) || match.product, oldDate = String(product.cenaZakupuDataDokumentu || ''), shouldUpdate = force || !oldDate || String(invoice.invoice_date || '') >= oldDate;
            const beforeFields = shouldUpdate ? infaktMigawkaCenyZakupu(product) : null;
            if (shouldUpdate) { const fields = infaktCenaZakupuFields(product, line, invoice, supplier, match.method); if (Number(product.cenaZakupu || 0) !== Number(fields.cenaZakupu)) report.priceUpdatedCount++; else report.unchangedCount++; updater.apply(product.id, fields); products.set(String(product.id), { ...product, ...fields }); }
            else report.unchangedCount++;
            report.matchedCount++; report.recentMatches = report.recentMatches.filter((entry) => entry.itemKey !== itemKey || entry.status === 'reverted'); report.recentMatches.unshift({ matchId: crypto.createHash('sha256').update(`${itemKey}|${product.id}|${now}`).digest('hex').slice(0, 24), itemKey, lineSignature, productId: String(product.id), productName: tekst(product.nazwa, 200), price: +line.unitGross.toFixed(2), quantity: line.quantity, method: match.method, confidence: match.confidence, invoiceNumber: tekst(invoice.invoice_number, 120), invoiceDate: tekst(invoice.invoice_date, 20), supplier: supplier?.name || invoice.seller_name, updatedAt: now, status: 'active', priceApplied: shouldUpdate, beforeFields, sourceItem });
          } else {
            report.pendingItems.push({ ...sourceItem, reason: !validPrice ? 'Brak poprawnej ceny brutto, ilości lub waluta inna niż PLN' : (match.reason || 'Brak jednoznacznego dopasowania'), suggestions: infaktSugestieNazwy(line, products, supplier) });
          }
        }
        report.documents[documentKey] = { status: 'processed', invoiceNumber: tekst(invoice.invoice_number, 120), invoiceDate: tekst(invoice.invoice_date, 20), supplier: supplier?.name || tekst(invoice.seller_name, 200), lines: lines.length, processedAt: now };
        if (invoice.sourceCostUuid) report.costDocuments[invoice.sourceCostUuid] = { ...(report.costDocuments[invoice.sourceCostUuid] || {}), status: 'processed', lines: lines.length, processedAt: now };
      } catch (error) { report.errors.push(`${tekst(invoice.invoice_number || documentKey, 160)}: ${tekst(error.message, 400)}`); report.documents[documentKey] = { status: 'error', error: tekst(error.message, 400), processedAt: now }; if (invoice.sourceCostUuid) report.costDocuments[invoice.sourceCostUuid] = { ...(report.costDocuments[invoice.sourceCostUuid] || {}), status: 'error', error: tekst(error.message, 400), processedAt: now }; }
    }
    updater.commit(); if (updater.changed) await zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now });
    const oldPending = Array.isArray(previous.pendingItems) ? previous.pendingItems : [], newKeys = new Set(report.pendingItems.map((x) => x.itemKey)); report.pendingItems = [...report.pendingItems, ...oldPending.filter((x) => !newKeys.has(x.itemKey) && !processedKeys.has(x.ksefNumber))].slice(0, 1000); report.pendingCount = report.pendingItems.length; report.lineMappings = { ...(previous.lineMappings || {}) }; report.recentMatches = report.recentMatches.slice(0, 500); report.updated_at = new Date().toISOString();
    await zapisz('infakt_purchase_price_sync', report); return report;
  }
  async function infaktPrzypiszCeneZakupu(itemKey = '', productId = '') {
    const [sync, settingsRec] = await Promise.all([czytaj('infakt_purchase_price_sync', { pendingItems: [], recentMatches: [] }), czytaj('settings', { data: {}, rev: 0 })]), item = (Array.isArray(sync.pendingItems) ? sync.pendingItems : []).find((x) => x.itemKey === itemKey), data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {}, products = allegroAgentProduktyCentralne(data), product = products.get(String(productId));
    if (!item) { const error = new Error('Nie znaleziono oczekującej pozycji faktury'); error.status = 404; throw error; } if (!product) { const error = new Error('Nie znaleziono produktu'); error.status = 404; throw error; } if (!(Number(item.unitGross) > 0) || item.currency !== 'PLN') { const error = new Error('Pozycja nie ma poprawnej ceny brutto w PLN'); error.status = 422; throw error; }
    const updater = allegroAktualizatorProduktowCentralnych(data), beforeFields = infaktMigawkaCenyZakupu(product), invoice = { invoice_number: item.invoiceNumber, ksef_number: item.ksefNumber, invoice_date: item.invoiceDate, seller_name: item.supplier }, fields = infaktCenaZakupuFields(product, item, invoice, { name: item.supplier }, 'ręczne zatwierdzenie'); updater.apply(product.id, fields); updater.commit();
    const now = new Date().toISOString(), matchId = crypto.createHash('sha256').update(`${itemKey}|${product.id}|${now}`).digest('hex').slice(0, 24); sync.pendingItems = sync.pendingItems.filter((x) => x.itemKey !== itemKey); sync.pendingCount = sync.pendingItems.length; sync.matchedCount = (Number(sync.matchedCount) || 0) + 1; sync.priceUpdatedCount = (Number(sync.priceUpdatedCount) || 0) + 1; sync.lineMappings = { ...(sync.lineMappings || {}), ...(item.lineSignature ? { [item.lineSignature]: String(product.id) } : {}) }; sync.recentMatches = [{ matchId, itemKey, lineSignature: item.lineSignature || '', productId: String(product.id), productName: tekst(product.nazwa, 200), price: Number(item.unitGross), quantity: Number(item.quantity), method: 'ręczne zatwierdzenie', confidence: 100, invoiceNumber: item.invoiceNumber, invoiceDate: item.invoiceDate, supplier: item.supplier, updatedAt: now, status: 'active', priceApplied: true, beforeFields, sourceItem: item }, ...(Array.isArray(sync.recentMatches) ? sync.recentMatches.filter((entry) => entry.itemKey !== itemKey || entry.status === 'reverted') : [])].slice(0, 500); sync.updated_at = now;
    await Promise.all([zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now }), zapisz('infakt_purchase_price_sync', sync)]); return { item, product: { id: String(product.id), name: product.nazwa, cenaZakupu: fields.cenaZakupu }, sync };
  }
  async function infaktCofnijDopasowanieCeny(matchId = '') {
    const [sync, settingsRec] = await Promise.all([czytaj('infakt_purchase_price_sync', { pendingItems: [], recentMatches: [] }), czytaj('settings', { data: {}, rev: 0 })]);
    const matches = Array.isArray(sync.recentMatches) ? sync.recentMatches : [], index = matches.findIndex((entry) => String(entry.matchId || entry.itemKey) === String(matchId));
    if (index < 0) { const error = new Error('Nie znaleziono dopasowania w historii'); error.status = 404; throw error; }
    const match = matches[index];
    if (match.status === 'reverted') { const error = new Error('To dopasowanie zostało już cofnięte'); error.status = 409; throw error; }
    if (match.priceApplied === false) { const error = new Error('To dopasowanie nie zmieniło ceny produktu'); error.status = 409; throw error; }
    const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {}, product = allegroAgentProduktyCentralne(data).get(String(match.productId));
    if (!product) { const error = new Error('Produkt z dopasowania już nie istnieje'); error.status = 404; throw error; }
    const rollback = infaktPrzygotujCofniecieDopasowania(product, match);
    if (!rollback.ok) { const error = new Error(rollback.error); error.status = 409; throw error; }
    const updater = allegroAktualizatorProduktowCentralnych(data); updater.apply(product.id, rollback.fields, rollback.remove); updater.commit();
    sync.lineMappings = { ...(sync.lineMappings || {}) }; let removedAliases = 0;
    if (match.lineSignature && String(sync.lineMappings[match.lineSignature] || '') === String(product.id)) { delete sync.lineMappings[match.lineSignature]; removedAliases = 1; }
    else if (!match.lineSignature && String(match.method || '').includes('ręczne')) for (const [signature, id] of Object.entries(sync.lineMappings)) if (String(id) === String(product.id)) { delete sync.lineMappings[signature]; removedAliases++; }
    const now = new Date().toISOString(), sourceItem = match.sourceItem && typeof match.sourceItem === 'object' ? { ...match.sourceItem, reason: 'Cofnięto wcześniejsze dopasowanie — wybierz właściwy produkt' } : null;
    if (sourceItem?.itemKey && !(sync.pendingItems || []).some((entry) => entry.itemKey === sourceItem.itemKey)) sync.pendingItems = [sourceItem, ...(sync.pendingItems || [])].slice(0, 1000);
    matches[index] = { ...match, status: 'reverted', revertedAt: now, removedAliases };
    sync.recentMatches = matches; sync.pendingCount = (sync.pendingItems || []).length; sync.matchedCount = Math.max(0, (Number(sync.matchedCount) || 0) - 1); sync.updated_at = now;
    await Promise.all([zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now }), zapisz('infakt_purchase_price_sync', sync)]);
    return { sync, product: { id: String(product.id), name: product.nazwa }, restored: Object.prototype.hasOwnProperty.call(rollback.fields, 'cenaZakupu') ? rollback.fields.cenaZakupu : null, requiresResync: !sourceItem };
  }
  function infaktErrorText(data, fallback = 'Błąd inFakt') {
    const errors = data?.errors || data?.error || data?.message;
    if (typeof errors === 'string') return tekst(errors, 1000);
    if (Array.isArray(errors)) return tekst(errors.map((x) => typeof x === 'string' ? x : x?.message || JSON.stringify(x)).join('; '), 1000);
    if (errors && typeof errors === 'object') return tekst(Object.entries(errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; '), 1000);
    return fallback;
  }
  async function infaktWywolaj(path, { method = 'GET', bodyObj = null, parameters = {}, raw = false, accept = '' } = {}) {
    const c = infaktKonfiguracja();
    if (!c.configured) {
      const masked = c.credentialIssue === 'masked_placeholder';
      const e = new Error(masked ? 'Na serwerze zapisano maskę zamiast prawidłowego klucza API inFakt.' : 'inFakt nie jest skonfigurowany. Dodaj INFAKT_API_KEY po stronie serwera.');
      e.code = masked ? 'infakt_credential_masked' : 'infakt_not_configured';
      e.status = 503;
      throw e;
    }
    const url = new URL(path, c.baseUrl); for (const [k, v] of Object.entries(parameters || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    const body = bodyObj === null ? undefined : JSON.stringify(bodyObj);
    const response = await fetch(url, { method, headers: { 'X-inFakt-ApiKey': c.apiKey, Accept: accept || (raw ? 'application/pdf, application/json' : 'application/json'), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body });
    if (raw && response.ok) return response;
    const txt = await response.text(); let data = {}; try { data = txt ? JSON.parse(txt) : {}; } catch { data = { raw: tekst(txt, 2000) }; }
    if (!response.ok) { const e = new Error(infaktErrorText(data, `inFakt HTTP ${response.status}`)); e.status = response.status; e.code = response.status === 401 ? 'infakt_auth' : response.status === 422 ? 'infakt_validation' : 'infakt_error'; e.infakt = data; throw e; }
    return data;
  }
  function infaktDataISO(value = '') { const d = value ? new Date(value) : new Date(); return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10); }
  function infaktMetodaPlatnosci(z = {}) { const p = String(z.platnoscId || z.platnosc || '').toLowerCase(); if (p.includes('pobran')) return 'delivery'; if (p.includes('kart')) return 'card'; if (p.includes('gotow')) return 'cash'; return 'transfer'; }
  function infaktPayloadZamowienia(z = {}, options = {}) {
    const client = z.klient || {}, address = z.adresDostawy || {}, company = tekst(client.firma || z.firma || '', 250).trim(), nip = String(client.nip || z.nip || '').replace(/\D/g, ''), fullName = tekst(`${client.imie || ''} ${client.nazwisko || ''}`, 200).trim(), nameParts = fullName.split(/\s+/).filter(Boolean);
    const lines = (Array.isArray(z.pozycjeDane) ? z.pozycjeDane : []).map((p) => { const quantity = Math.max(0.001, Number(p.ilosc) || 1), unitGross = Number(p.cena) || Number(p.wartosc) / quantity || 0; return { name: tekst(p.nazwa || p.produkt || 'Produkt', 300), quantity, gross_price: grosze(unitGross), tax_symbol: String(p.vatRate || p.vat || 23).replace('%', '') || '23', unit: 'szt.', ...(p.gtin || p.ean ? { gtin: tekst(p.gtin || p.ean, 80) } : {}) }; }).filter((p) => p.gross_price > 0);
    const deliveryGross = grosze(Number(z.kosztDostawy || 0) + Number(z.kosztPaczkaWeekend || 0) + Number(z.kosztPlatnosci || 0));
    if (deliveryGross > 0) lines.push({ name: 'Dostawa i usługi dodatkowe', quantity: 1, gross_price: deliveryGross, tax_symbol: '23', unit: 'szt.' });
    if (!lines.length) { const total = grosze(z.razem); if (total > 0) lines.push({ name: `Zamówienie ${tekst(z.nr, 100)}`, quantity: 1, gross_price: total, tax_symbol: '23', unit: 'szt.' }); }
    if (!lines.length) { const e = new Error('Zamówienie nie ma pozycji o dodatniej wartości'); e.code = 'infakt_empty_invoice'; throw e; }
    const invoiceDate = infaktDataISO(options.invoiceDate), due = new Date(`${invoiceDate}T12:00:00Z`); due.setUTCDate(due.getUTCDate() + infaktKonfiguracja().paymentDays);
    const invoice = { status: options.status === 'paid' ? 'paid' : 'draft', currency: 'PLN', payment_method: infaktMetodaPlatnosci(z), invoice_date: invoiceDate, sale_date: infaktDataISO(z.ts || z.createdAt || invoiceDate), payment_date: due.toISOString().slice(0, 10), sale_type: 'merchandise', notes: tekst(`Zamówienie Artway-TM: ${z.nr}`, 500), client_business_activity_kind: company || nip ? 'other_business' : 'private_person', client_company_name: company || (nip ? fullName || 'Klient firmowy' : undefined), client_first_name: company ? undefined : (nameParts[0] || 'Klient'), client_last_name: company ? undefined : (nameParts.slice(1).join(' ') || 'Artway-TM'), client_tax_code: nip || undefined, client_street: tekst(address.ulica || client.ulica || '', 160) || undefined, client_street_number: tekst(address.nrDomu || client.nrDomu || '', 40) || undefined, client_flat_number: tekst(address.nrLokalu || client.nrLokalu || '', 40) || undefined, client_city: tekst(address.miasto || client.miasto || '', 120) || undefined, client_post_code: tekst(address.kod || address.kodPocztowy || client.kod || client.kodPocztowy || '', 30) || undefined, services: lines };
    if (invoice.status === 'paid') invoice.paid_date = invoiceDate;
    Object.keys(invoice).forEach((key) => invoice[key] === undefined && delete invoice[key]);
    // Integracja sklepu ma celowo wąski zakres: wystawienie FV klienta, bez operacji KSeF.
    return { invoice, send_to_ksef: false };
  }
  function infaktRef(data = {}) { return tekst(data.invoice_task_reference_number || data.task_reference_number || data.reference_number || '', 200).trim(); }
  function infaktInvoiceFromTask(data = {}) { return data.invoice || data.entity || data.result?.invoice || data.result || {}; }
  

  return {
    infaktPublicConfig,
    infaktDostawcyUstawienia,
    infaktKosztDoZwrotu,
    infaktPobierzKosztyDozwolone,
    infaktSynchronizujCenyZakupu,
    infaktPrzypiszCeneZakupu,
    infaktCofnijDopasowanieCeny,
    infaktErrorText,
    infaktWywolaj,
    infaktPayloadZamowienia,
    infaktRef,
    infaktInvoiceFromTask,
  };
}
