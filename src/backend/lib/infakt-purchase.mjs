// Czyste funkcje odczytu kosztów inFakt/KSeF i ochrony danych handlowych.
// Ten moduł nie odczytuje sekretów ani bazy — dzięki temu można go bezpiecznie testować.

export const PRYWATNE_POLA_PRODUKTU = Object.freeze([
  'cenaZakupu',
  'cenaZakupuNetto',
  'cenaZakupuVat',
  'cenaZakupuWaluta',
  'cenaZakupuPrywatna',
  'cenaZakupuZrodlo',
  'cenaZakupuDokument',
  'cenaZakupuKsef',
  'cenaZakupuDostawca',
  'cenaZakupuDataDokumentu',
  'cenaZakupuDopasowanie',
  'cenaZakupuZaktualizowanoAt',
  'cenaZakupuHistoria',
  'allegroCommissionAmount',
  'allegroCommissionRate',
  'allegroRecurringFees',
  'allegroFeePrice',
  'allegroFeeDetails',
  'allegroFeeCalculatedAt',
  'allegroFeeSource',
  'allegroFeeCurrency',
  'allegroFeeTotal',
  'kosztPakowania',
  'sklepAdditionalCost',
  'sklepPaymentPercent',
  'allegroAdditionalCost',
  'allegroShippingSubsidy',
  'allegroAdsPercent',
  'sklepPriceTargetMargin',
  'allegroPriceTargetMargin',
  'sourceMaterial',
]);

export const POLA_CENY_ZAKUPU = Object.freeze([
  'cenaZakupu', 'cenaZakupuNetto', 'cenaZakupuVat', 'cenaZakupuWaluta',
  'cenaZakupuPrywatna', 'cenaZakupuZrodlo', 'cenaZakupuDokument', 'cenaZakupuKsef',
  'cenaZakupuDostawca', 'cenaZakupuDataDokumentu', 'cenaZakupuDopasowanie',
  'cenaZakupuZaktualizowanoAt', 'cenaZakupuHistoria',
]);

const PRYWATNE_POLA = new Set(PRYWATNE_POLA_PRODUKTU);
const KLUCZE_LIST_PRODUKTOW = new Set(['artway_produkty_dodane', 'artway_produkty_katalog']);
const KLUCZE_MAP_PRODUKTOW = new Set(['artway_produkty_edytowane']);
const PRYWATNE_POLA_USTAWIEN = new Set(['celMarzySklep', 'celMarzyAllegro', 'allegroJednostkiOplatCyklicznych', 'domyslneKosztyRentownosci']);
const PRYWATNE_KLUCZE_ADMINA = new Set([
  'artway_ruchy_magazynowe',
  'artway_magazyn_ustawienia',
  'artway_magazyn_produkty',
  'artway_magazyn_lokalizacje',
  'artway_faktury_szkice',
  'artway_agent_ai_historia',
  'artway_agent_ai_pamiec',
  'artway_agent_ai_zlecenia',
  'artway_producenci',
  'artway_agent_ai_linki_producentow',
  'artway_agent_ai_allegro_zadania',
]);

function tekst(value, max = 400) {
  return String(value == null ? '' : value).slice(0, max).trim();
}

export function infaktNazwaDostawcy(value = '') {
  return tekst(value, 240).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();
}

function infaktKodKlucz(value = '') { return tekst(value, 200).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function infaktEanKlucz(value = '') { const digits = tekst(value, 80).replace(/\D/g, ''); return digits.length >= 8 && digits.length <= 14 ? digits : ''; }
function infaktTokenyNazwy(value = '') {
  const stop = new Set(['gra', 'gry', 'zestaw', 'szt', 'sztuka', 'produkt', 'dla', 'oraz', 'mini', 'duzy', 'maly', 'the', 'and']);
  return [...new Set(infaktNazwaDostawcy(value).split(' ').filter((x) => x.length >= 3 && !stop.has(x)))];
}

export function infaktIndeksProduktow(products = new Map()) {
  const ean = new Map(), code = new Map(), name = new Map(), add = (map, key, product) => { if (!key) return; const list = map.get(key) || []; if (!list.some((p) => String(p.id) === String(product.id))) list.push(product); map.set(key, list); };
  for (const product of products.values()) {
    [product.gtin, product.ean, product.kodEan].forEach((value) => add(ean, infaktEanKlucz(value), product));
    [product.kodProducenta, product.mpn, product.sku, product.externalId, product.kod].forEach((value) => add(code, infaktKodKlucz(value), product));
    add(name, infaktNazwaDostawcy(product.nazwa), product);
  }
  return { ean, code, name };
}

export function infaktSugestieNazwy(line = {}, products = new Map(), supplier = null) {
  const wanted = infaktTokenyNazwy(line.name), supplierKey = infaktNazwaDostawcy(supplier?.name || '');
  if (!wanted.length) return [];
  return [...products.values()].map((product) => {
    const current = infaktTokenyNazwy(product.nazwa), common = wanted.filter((x) => current.includes(x)).length, producer = infaktNazwaDostawcy(product.producent || product.marka || ''), supplierBoost = supplierKey && (producer.includes(supplierKey) || supplierKey.includes(producer)) ? 0.12 : 0;
    return { product, score: current.length ? common / Math.max(wanted.length, current.length) + supplierBoost : 0 };
  }).filter((x) => x.score >= 0.45).sort((a, b) => b.score - a.score).slice(0, 3).map(({ product, score }) => ({ id: String(product.id), name: tekst(product.nazwa, 200), sku: tekst(product.sku || product.externalId || product.kodProducenta, 100), ean: tekst(product.gtin || product.ean, 80), score: +Math.min(0.99, score).toFixed(2) }));
}

export function infaktDopasujPozycje(line = {}, products = new Map(), index = {}, supplier = null) {
  const eanKey = infaktEanKlucz(line.ean), codeKey = infaktKodKlucz(line.code);
  if (eanKey) { const list = index.ean.get(eanKey) || []; if (list.length === 1) return { product: list[0], method: 'EAN/GTIN', confidence: 100 }; if (list.length > 1) return { conflict: true, reason: 'EAN występuje przy kilku produktach' }; }
  if (codeKey) {
    const list = index.code.get(codeKey) || [];
    if (list.length === 1) return { product: list[0], method: 'kod produktu', confidence: 96 };
    if (list.length > 1) {
      const supplierKey = infaktNazwaDostawcy(supplier?.name || ''), sameSupplier = list.filter((p) => { const producer = infaktNazwaDostawcy(p.producent || p.marka || ''); return supplierKey && producer && (producer.includes(supplierKey) || supplierKey.includes(producer)); });
      if (sameSupplier.length === 1) return { product: sameSupplier[0], method: 'kod + dostawca', confidence: 94 };
      return { conflict: true, reason: 'Kod występuje przy kilku produktach' };
    }
  }
  const nameKey = infaktNazwaDostawcy(line.name), nameList = index.name.get(nameKey) || [];
  if (nameKey && nameList.length === 1) return { product: nameList[0], method: 'identyczna nazwa', confidence: 90 };
  return { product: null, reason: eanKey || codeKey ? 'Brak produktu z takim kodem' : 'Faktura nie zawiera EAN ani kodu produktu' };
}

export function infaktCenaZakupuFields(product = {}, line = {}, invoice = {}, supplier = {}, method = '') {
  const now = new Date().toISOString(), price = +Number(line.unitGross || 0).toFixed(2), history = Array.isArray(product.cenaZakupuHistoria) ? product.cenaZakupuHistoria.slice(0, 29) : [];
  const net = +Number(line.unitNet || 0).toFixed(2), vat = Math.max(0, +(price - net).toFixed(2));
  const entry = { price, net, vat, quantity: Number(line.quantity || 0), document: tekst(invoice.invoice_number, 120), ksefNumber: tekst(invoice.ksef_number, 180), supplier: tekst(supplier.name || invoice.seller_name, 200), date: tekst(invoice.invoice_date, 20), method, priceBasis: tekst(line.priceBasis || '', 80), updatedAt: now };
  return { cenaZakupu: price, cenaZakupuNetto: net, cenaZakupuVat: vat, cenaZakupuWaluta: tekst(line.currency || 'PLN', 12), cenaZakupuPrywatna: true, cenaZakupuZrodlo: 'inFakt / KSeF', cenaZakupuDokument: entry.document, cenaZakupuKsef: entry.ksefNumber, cenaZakupuDostawca: entry.supplier, cenaZakupuDataDokumentu: entry.date, cenaZakupuDopasowanie: method, cenaZakupuZaktualizowanoAt: now, cenaZakupuHistoria: [entry, ...history.filter((x) => x?.ksefNumber !== entry.ksefNumber || Number(x?.price) !== price)].slice(0, 30) };
}

export function infaktMigawkaCenyZakupu(product = {}) {
  return Object.fromEntries(POLA_CENY_ZAKUPU.filter((key) => Object.prototype.hasOwnProperty.call(product, key)).map((key) => [key, structuredClone(product[key])]));
}

export function infaktPrzygotujCofniecieDopasowania(product = {}, match = {}) {
  const samePrice = Number(product.cenaZakupu || 0) === Number(match.price || 0);
  const sameDocument = !match.invoiceNumber || String(product.cenaZakupuDokument || '') === String(match.invoiceNumber);
  const sameDate = !match.invoiceDate || String(product.cenaZakupuDataDokumentu || '') === String(match.invoiceDate);
  if (!samePrice || !sameDocument || !sameDate) return { ok: false, conflict: true, error: 'Produkt ma już nowszą cenę zakupu. Cofnięcie zostało zablokowane, aby jej nie nadpisać.' };
  const before = match.beforeFields && typeof match.beforeFields === 'object' ? structuredClone(match.beforeFields) : null;
  if (before) return { ok: true, fields: before, remove: POLA_CENY_ZAKUPU.filter((key) => !Object.prototype.hasOwnProperty.call(before, key)) };
  const history = Array.isArray(product.cenaZakupuHistoria) ? structuredClone(product.cenaZakupuHistoria) : [];
  const targetIndex = history.findIndex((entry) => Number(entry?.price || 0) === Number(match.price || 0) && (!match.invoiceNumber || String(entry?.document || '') === String(match.invoiceNumber)));
  if (targetIndex >= 0) history.splice(targetIndex, 1);
  const previous = history[0];
  if (!previous) return { ok: true, fields: {}, remove: [...POLA_CENY_ZAKUPU] };
  return { ok: true, fields: { cenaZakupu: Number(previous.price) || 0, cenaZakupuNetto: Number(previous.net) || 0, cenaZakupuVat: Number(previous.vat) || 0, cenaZakupuWaluta: product.cenaZakupuWaluta || 'PLN', cenaZakupuPrywatna: true, cenaZakupuZrodlo: 'inFakt / KSeF', cenaZakupuDokument: previous.document || '', cenaZakupuKsef: previous.ksefNumber || '', cenaZakupuDostawca: previous.supplier || '', cenaZakupuDataDokumentu: previous.date || '', cenaZakupuDopasowanie: previous.method || '', cenaZakupuZaktualizowanoAt: previous.updatedAt || '', cenaZakupuHistoria: history }, remove: [] };
}

export function infaktRdzenNazwyDostawcy(value = '') {
  return infaktNazwaDostawcy(value)
    .replace(/\b(spolka z ograniczona odpowiedzialnoscia|sp z oo|sp zoo|spolka akcyjna|sa|sc|s c|firma handlowa|fh|phu)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function infaktDostawcyDozwoleni(raw = []) {
  const result = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const name = tekst(item?.name || item?.sellerName || item, 200).trim();
    const sellerName = tekst(item?.sellerName || item?.apiSellerName || name, 240).trim();
    const match = infaktNazwaDostawcy(sellerName);
    const taxCode = tekst(item?.taxCode || item?.nip || item?.sellerTaxCode, 30).replace(/\D/g, '');
    if (!name || !match || item?.active === false) continue;
    if (!result.some((entry) => entry.match === match || (taxCode && entry.taxCode === taxCode))) {
      result.push({ id: tekst(item?.id || match, 120), name, sellerName, match, root: infaktRdzenNazwyDostawcy(sellerName), taxCode });
    }
  }
  return result.slice(0, 100);
}

export function infaktZnajdzDostawce(invoice = {}, suppliers = []) {
  const seller = infaktNazwaDostawcy(invoice.seller_name);
  const root = infaktRdzenNazwyDostawcy(invoice.seller_name);
  const taxCode = tekst(invoice.seller_tax_code, 30).replace(/\D/g, '');
  const exact = suppliers.find((entry) => (taxCode && entry.taxCode === taxCode) || entry.match === seller);
  if (exact) return exact;
  if (!root || root.length < 4) return null;
  const candidates = suppliers.filter((entry) => entry.root && (entry.root === root || entry.root.includes(root) || root.includes(entry.root)));
  return candidates.length === 1 ? candidates[0] : null;
}

export function produktBezDanychPrywatnych(product = {}) {
  if (!product || typeof product !== 'object' || Array.isArray(product)) return product;
  const result = { ...product };
  for (const field of PRYWATNE_POLA) delete result[field];
  return result;
}

export function ustawieniaPubliczneBezDanychPrywatnych(settings = {}) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const result = { ...settings };
  for (const key of PRYWATNE_KLUCZE_ADMINA) delete result[key];
  for (const key of KLUCZE_LIST_PRODUKTOW) {
    if (Array.isArray(result[key])) result[key] = result[key].map(produktBezDanychPrywatnych);
  }
  for (const key of KLUCZE_MAP_PRODUKTOW) {
    if (!result[key] || typeof result[key] !== 'object' || Array.isArray(result[key])) continue;
    result[key] = Object.fromEntries(Object.entries(result[key]).map(([id, product]) => [id, produktBezDanychPrywatnych(product)]));
  }
  if (result.artway_ustawienia && typeof result.artway_ustawienia === 'object' && !Array.isArray(result.artway_ustawienia)) {
    result.artway_ustawienia = { ...result.artway_ustawienia };
    for (const field of PRYWATNE_POLA_USTAWIEN) delete result.artway_ustawienia[field];
  }
  return result;
}

function xmlOdkoduj(value = '') {
  return String(value || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code) || 32)).trim();
}

function xmlPole(xml = '', name = '') {
  const safe = String(name).replace(/[^A-Za-z0-9_]/g, '');
  const match = String(xml).match(new RegExp(`<(?:(?:[A-Za-z0-9_]+):)?${safe}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_]+):)?${safe}>`, 'i'));
  return xmlOdkoduj(match?.[1]?.replace(/<[^>]+>/g, ' ') || '');
}

function xmlLiczba(value) {
  const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function eanZTekstu(value = '') {
  const candidates = String(value).match(/(?:^|\D)(\d{8,14})(?=\D|$)/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, '');
    if (![8, 12, 13, 14].includes(digits.length)) continue;
    const check = Number(digits.at(-1));
    const body = digits.slice(0, -1).split('').reverse();
    const sum = body.reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
    if ((10 - (sum % 10)) % 10 === check) return digits;
  }
  return '';
}

export function infaktKsefPozycje(xml = '') {
  const rows = [...String(xml).matchAll(/<(?:(?:[A-Za-z0-9_]+):)?FaWiersz(?:\s[^>]*)?>([\s\S]*?)<\/(?:(?:[A-Za-z0-9_]+):)?FaWiersz>/gi)];
  const currency = xmlPole(xml, 'KodWaluty') || 'PLN';
  const additionalByRow = new Map();
  for (const match of String(xml).matchAll(/<(?:(?:[A-Za-z0-9_]+):)?DodatkowyOpis(?:\s[^>]*)?>([\s\S]*?)<\/(?:(?:[A-Za-z0-9_]+):)?DodatkowyOpis>/gi)) {
    const block = match[1], rowNumber = Math.max(0, Math.floor(xmlLiczba(xmlPole(block, 'NrWiersza'))));
    const key = tekst(xmlPole(block, 'Klucz'), 80).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const value = tekst(xmlPole(block, 'Wartosc'), 200);
    if (!rowNumber || !key || !value) continue;
    additionalByRow.set(rowNumber, { ...(additionalByRow.get(rowNumber) || {}), [key]: value });
  }
  return rows.map((match, index) => {
    const row = match[1];
    const rowNumber = Math.max(1, Math.floor(xmlLiczba(xmlPole(row, 'NrWierszaFa'))) || index + 1);
    const additional = additionalByRow.get(rowNumber) || {};
    const name = tekst(xmlPole(row, 'P_7') || xmlPole(row, 'NazwaTowaru') || `Pozycja ${index + 1}`, 300);
    const quantity = Math.max(0, xmlLiczba(xmlPole(row, 'P_8B')));
    const taxRaw = xmlPole(row, 'P_12');
    const taxRate = /^\d+(?:[.,]\d+)?$/.test(taxRaw) ? xmlLiczba(taxRaw) : 0;
    const declaredUnitNet = xmlLiczba(xmlPole(row, 'P_9A'));
    const declaredUnitGross = xmlLiczba(xmlPole(row, 'P_9B'));
    const lineNet = xmlLiczba(xmlPole(row, 'P_11'));
    const lineGross = xmlLiczba(xmlPole(row, 'P_11A'));

    // Wartości wiersza po rabatach są ważniejsze od ceny katalogowej P_9A/P_9B.
    const net = quantity > 0 && lineNet > 0 ? lineNet / quantity : declaredUnitNet;
    const gross = quantity > 0 && lineGross > 0
      ? lineGross / quantity
      : (lineNet > 0 && net > 0 ? net * (1 + taxRate / 100) : (declaredUnitGross || (net > 0 ? net * (1 + taxRate / 100) : 0)));
    const explicitEan = tekst(xmlPole(row, 'GTIN') || xmlPole(row, 'EAN') || additional.GTIN || additional.EAN, 80).replace(/\s+/g, '');
    const code = tekst(xmlPole(row, 'Indeks') || xmlPole(row, 'KodTowaru') || xmlPole(row, 'SKU') || xmlPole(row, 'NrKatalogowy') || additional.INDEKS || additional.SKU || additional.KODTOWARU, 120);

    return {
      row: rowNumber,
      name,
      ean: explicitEan || eanZTekstu(`${code} ${name}`),
      code,
      quantity: +quantity.toFixed(4),
      unit: tekst(xmlPole(row, 'P_8A') || 'szt.', 40),
      unitNet: +net.toFixed(4),
      unitGross: +gross.toFixed(4),
      declaredUnitNet: +declaredUnitNet.toFixed(4),
      lineNet: +lineNet.toFixed(4),
      lineGross: +lineGross.toFixed(4),
      taxRate,
      currency,
      priceBasis: lineGross > 0 || lineNet > 0 ? 'wartość wiersza po rabatach' : 'cena jednostkowa',
    };
  }).filter((row) => row.name || row.ean || row.code);
}

function pierwszaWartosc(...values) {
  for (const value of values) if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  return '';
}

export function infaktNormalizujDokumentKsef(raw = {}) {
  const seller = raw?.seller || raw?.supplier || raw?.contractor || {};
  return {
    ...raw,
    ksef_number: tekst(pierwszaWartosc(raw.ksef_number, raw.ksefNumber, raw.ksef_reference_number, raw.reference_number, raw.referenceNumber), 200),
    invoice_number: tekst(pierwszaWartosc(raw.invoice_number, raw.invoiceNumber, raw.number, raw.document_number, raw.documentNumber), 160),
    invoice_date: tekst(pierwszaWartosc(raw.invoice_date, raw.invoiceDate, raw.issue_date, raw.issueDate, raw.sale_date), 30),
    seller_name: tekst(pierwszaWartosc(raw.seller_name, raw.sellerName, raw.supplier_name, raw.supplierName, seller.name, seller.company_name), 240),
    seller_tax_code: tekst(pierwszaWartosc(raw.seller_tax_code, raw.sellerTaxCode, raw.supplier_tax_code, raw.supplierTaxCode, seller.tax_code, seller.nip), 30).replace(/\D/g, ''),
  };
}

export function infaktListaDokumentowKsef(payload = {}) {
  const candidates = [
    payload?.entities,
    payload?.invoices,
    payload?.costs,
    payload?.documents,
    payload?.items,
    payload?.ksef_invoices,
    payload?.data?.entities,
    payload?.data?.items,
  ];
  const list = candidates.find(Array.isArray) || [];
  return list.map(infaktNormalizujDokumentKsef);
}

export function infaktParametryListyKsef({ days = 180, limit = 25, offset = 0, now = new Date() } = {}) {
  const end = now instanceof Date ? new Date(now) : new Date(now || Date.now());
  const safeEnd = Number.isNaN(end.getTime()) ? new Date() : end;
  const safeDays = Math.max(1, Math.min(730, Number(days) || 180));
  const start = new Date(safeEnd.getTime() - safeDays * 86400000);
  return {
    offset: Math.max(0, Math.floor(Number(offset) || 0)),
    // Oficjalny przykład KSeF 2.0 używa strony po 20 dokumentów.
    limit: Math.max(1, Math.min(20, Math.floor(Number(limit) || 20))),
    order: 'Asc',
    'q[invoice_date_gteq]': start.toISOString().slice(0, 10),
    'q[invoice_date_lteq]': safeEnd.toISOString().slice(0, 10),
  };
}

export function infaktNormalizujDokumentKosztowy(raw = {}) {
  const seller = raw?.seller || raw?.supplier || raw?.contractor || {};
  return {
    ...raw,
    uuid: tekst(pierwszaWartosc(raw.uuid, raw.document_uuid, raw.documentUuid, raw.id), 200),
    number: tekst(pierwszaWartosc(raw.number, raw.invoice_number, raw.invoiceNumber, raw.document_number), 160),
    seller_name: tekst(pierwszaWartosc(raw.seller_name, raw.sellerName, raw.supplier_name, raw.supplierName, seller.name, seller.company_name), 240),
    seller_tax_code: tekst(pierwszaWartosc(raw.seller_tax_code, raw.sellerTaxCode, raw.supplier_tax_code, raw.supplierTaxCode, seller.tax_code, seller.nip), 30).replace(/\D/g, ''),
    issue_date: tekst(pierwszaWartosc(raw.issue_date, raw.issueDate, raw.invoice_date, raw.invoiceDate), 30),
    received_date: tekst(pierwszaWartosc(raw.received_date, raw.receivedDate), 30),
    due_date: tekst(pierwszaWartosc(raw.due_date, raw.dueDate), 30),
    net_price: Number(pierwszaWartosc(raw.net_price, raw.netPrice)) || 0,
    gross_price: Number(pierwszaWartosc(raw.gross_price, raw.grossPrice)) || 0,
    tax_price: Number(pierwszaWartosc(raw.tax_price, raw.taxPrice)) || 0,
  };
}

export function infaktKsefNumerZTekstu(value = '') {
  let source = '';
  try { source = typeof value === 'string' ? value : JSON.stringify(value); } catch { source = String(value || ''); }
  const match = source.match(/(\d{10}-\d{8}-[A-Z0-9]{12}-[A-Z0-9]{2})/i);
  return match ? match[1].toUpperCase() : '';
}

function znajdzXml(value, depth = 0) {
  if (depth > 4 || value == null) return '';
  if (typeof value === 'string') {
    const current = value.trim();
    if (current.includes('<') && /<(?:\w+:)?(?:Faktura|Fa|FaWiersz)\b/i.test(current)) return current;
    if (current.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(current) && typeof Buffer !== 'undefined') {
      try {
        const decoded = Buffer.from(current.replace(/\s+/g, ''), 'base64').toString('utf8');
        if (decoded.includes('<') && /<(?:\w+:)?(?:Faktura|Fa|FaWiersz)\b/i.test(decoded)) return decoded;
      } catch { /* nie jest Base64 */ }
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  for (const key of ['xml', 'content', 'file', 'data', 'document', 'invoice']) {
    const found = znajdzXml(value[key], depth + 1);
    if (found) return found;
  }
  return '';
}

export function infaktXmlZOdpowiedzi(payload = '') {
  if (typeof payload !== 'string') return znajdzXml(payload);
  const trimmed = payload.trim();
  if (trimmed.startsWith('<')) return trimmed;
  try { return znajdzXml(JSON.parse(trimmed)); } catch { return znajdzXml(trimmed); }
}
