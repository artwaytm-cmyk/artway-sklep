const text = (value, max = 1000) => String(value ?? '').slice(0, max);

const escapeHtml = (value) => text(value, 10000)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const producerKey = (value = '') => text(value, 160).trim().toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

function producerFamily(value = '') {
  const key = producerKey(value);
  if (key.includes('alexander')) return 'alexander';
  if (key.includes('multigra')) return 'multigra';
  return key;
}

export function validGtin(value = '') {
  const digits = text(value, 40).replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return '';
  const expected = Number(digits.at(-1));
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let index = body.length - 1, weight = 3; index >= 0; index--, weight = weight === 3 ? 1 : 3) sum += Number(body[index]) * weight;
  return (10 - (sum % 10)) % 10 === expected ? digits : '';
}

const businessIdentifier = (value) => {
  const candidate = text(value, 80).trim();
  if (!candidate || /^(?:-|—|brak|n\/a|null|undefined)$/i.test(candidate)) return '';
  // Nie eksportujemy połączonych wariantów typu „2387 lub SL2871”. Taki
  // identyfikator nie wskazuje jednoznacznie jednej kartoteki w Optimie.
  if (/\b(?:lub|albo|or)\b/i.test(candidate)) return '';
  return /^[\p{L}\p{N}][\p{L}\p{N}._\/-]{0,79}$/u.test(candidate) ? candidate : '';
};

const nested = (row, field) => [row, row?.product, row?.produkt]
  .map((source) => source?.[field])
  .find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const firstNested = (row, fields = []) => fields.map((field) => nested(row, field))
  .find((value) => value !== undefined && value !== null && String(value).trim() !== '');

/**
 * Wybiera biznesowy identyfikator produktu do tabeli zamówienia i pliku
 * Optimy. Kolejność jest stała: EXTERNAL_ID → SKU → kod producenta →
 * jawny kod katalogowy → EAN/GTIN. Lokalne `id`/`produktId` nigdy nie jest
 * samodzielnym kandydatem. Jawne EXTERNAL_ID, SKU i kod producenta pozostają
 * kodami biznesowymi także wtedy, gdy tekstowo pokrywają się z lokalnym ID;
 * tylko ogólne pola kodu muszą się od niego różnić.
 */
export function supplierProductIdentifier(row = {}) {
  const candidates = [
    ['external_id', nested(row, 'externalId')],
    ['external_id', nested(row, 'external_id')],
    ['external_id', nested(row, 'EXTERNAL_ID')],
    ['sku', nested(row, 'sku')],
    ['sku', nested(row, 'SKU')],
    ['manufacturer_code', nested(row, 'kodProducenta')],
    ['manufacturer_code', nested(row, 'mpn')],
    ['manufacturer_code', nested(row, 'manufacturerCode')],
    ['manufacturer_code', nested(row, 'manufacturer_code')],
    ['manufacturer_code', nested(row, 'producerCode')],
  ];
  const internalIds = new Set([
    row?.id, row?.produktId, row?.productId, row?.product_id, row?.internalId, row?.localId,
    row?.product?.id, row?.product?.productId, row?.produkt?.id, row?.produkt?.produktId,
  ].map((value) => text(value, 80).trim().toUpperCase()).filter(Boolean));
  for (const [source, raw] of candidates) {
    const value = businessIdentifier(raw);
    if (!value) continue;
    return { value, source };
  }
  const fallbackCandidates = [
    ['optima_code', firstNested(row, ['optimaCode', 'supplierOptimaCode', 'kodOptima', 'comarchCode'])],
    ['supplier_code', nested(row, 'supplierCode')],
    ['supplier_code', nested(row, 'kodDostawcy')],
    ['supplier_code', nested(row, 'catalogCode')],
    ['supplier_code', nested(row, 'towarCode')],
    ['stable_code', nested(row, 'kod')],
    ['stable_code', nested(row, 'code')],
  ];
  for (const [source, raw] of fallbackCandidates) {
    const value = businessIdentifier(raw);
    if (!value || internalIds.has(value.toUpperCase())) continue;
    return { value, source };
  }
  const gtin = ['ean', 'gtin', 'EAN', 'GTIN']
    .map((field) => validGtin(nested(row, field)))
    .find(Boolean) || '';
  if (gtin) return { value: gtin, source: 'gtin' };
  return { value: '', source: '' };
}

/**
 * Identyfikator pola TOWAR dla Kolektora danych Optimy producenta. Lokalne
 * EXTERNAL_ID/SKU sklepu nie jest automatycznie kodem kartoteki kontrahenta.
 * Pierwszeństwo ma jawny kod Optimy/dostawcy, następnie kod producenta i EAN.
 */
export function comarchOptimaProductIdentifier(row = {}) {
  const explicitCandidates = [
    ['optima_code', firstNested(row, ['optimaCode', 'supplierOptimaCode', 'kodOptima', 'comarchCode'])],
    ['supplier_code', firstNested(row, ['kodDostawcy', 'supplierCode', 'vendorCode', 'towarCode'])],
    ['manufacturer_code', firstNested(row, ['kodProducenta', 'mpn', 'manufacturerCode', 'manufacturer_code', 'producerCode'])],
  ];
  for (const [source, raw] of explicitCandidates) {
    const value = businessIdentifier(raw);
    if (value) return { value, source };
  }
  const gtin = ['ean', 'gtin', 'EAN', 'GTIN']
    .map((field) => validGtin(nested(row, field)))
    .find(Boolean) || '';
  if (gtin) return { value: gtin, source: 'gtin' };
  return { value: '', source: '' };
}

function supplierTableIdentifier(row = {}) {
  return supplierProductIdentifier(row);
}

const decimal = (value, minimum = 0) => {
  const number = Math.max(minimum, Number(String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
};

const safeFilenamePart = (value, fallback) => producerKey(value).slice(0, 80) || fallback;
export const OPTIMA_IMPORT_INSTRUCTION = 'Otwórz dokument → Ogólne → Kolektor danych → Importuj pozycje';

/**
 * Plik tekstowy dla operacji: otwarty dokument → Ogólne → Kolektor danych →
 * Importuj pozycje. Każdy wiersz ma trzy pola `TOWAR;ILOŚĆ;CENA`, ponieważ
 * tego układu oczekuje istniejący proces Kolektora. Pole CENA zawsze pozostaje
 * puste, więc producent nie otrzymuje ceny ani wartości zamówienia. Plik nie
 * ma wiersza nagłówkowego. Pozycja bez pewnego identyfikatora nie jest
 * zgadywana i trafia do raportu missingIdentifiers.
 */
export function buildComarchOptimaTxt(rows = [], { orderNumber = '', supplierName = '' } = {}) {
  const lines = [];
  const missingIdentifiers = [];
  for (const [index, row] of (Array.isArray(rows) ? rows : []).entries()) {
    const identifier = comarchOptimaProductIdentifier(row);
    if (!identifier.value) {
      missingIdentifiers.push({
        row: index + 1,
        name: text(row.nazwa || row.name || 'Produkt', 300).trim(),
        code: text(row.externalId || row.external_id || row.sku || row.kodProducenta || row.mpn || row.kod, 80).trim(),
        ean: text(row.ean || row.gtin, 40).trim(),
        reason: 'Brak kodu Comarch Optima/dostawcy, kodu producenta lub poprawnego EAN/GTIN',
      });
      continue;
    }
    const amount = Number(row.ilosc ?? row.quantity);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    // Cena jest w Optimie opcjonalna. Zamówienia Artway-TM do producentów
    // nigdy nie przekazują cen ani wartości, dlatego trzecie pole pozostaje
    // świadomie puste również wtedy, gdy kartoteka ma cenę zakupu.
    lines.push(`${identifier.value};${decimal(amount, 0)};`);
  }
  const filename = `zamowienie-optima-${safeFilenamePart(supplierName, 'producent')}-${safeFilenamePart(orderNumber, 'zamowienie')}.txt`;
  const content = lines.join('\r\n');
  return {
    format: 'TOWAR;ILOŚĆ;CENA',
    delimiter: ';',
    columns: ['TOWAR', 'ILOŚĆ', 'CENA'],
    priceColumnEmpty: true,
    priceSourceRequired: 'program',
    importInstruction: OPTIMA_IMPORT_INSTRUCTION,
    header: false,
    filename,
    content,
    exportedRows: lines.length,
    missingIdentifiers,
    attachment: lines.length ? { filename, content, contentType: 'text/plain; charset=utf-8' } : null,
  };
}

function supplierRows(order = {}, supplier = {}) {
  const name = text(supplier.name || supplier.nazwa, 120).trim();
  const family = producerFamily(name);
  return (Array.isArray(order?.pozycje) ? order.pozycje : [])
    .filter((row) => !name || producerFamily(row?.dostawca) === family)
    .map((row) => {
      const identifier = supplierTableIdentifier(row);
      return {
        dostawca: text(row?.dostawca || name, 120).trim(),
        productId: text(firstNested(row, ['produktId', 'productId', 'id']), 160).trim(),
        kod: identifier.value || '—',
        identifierSource: identifier.source,
        externalId: text(firstNested(row, ['externalId', 'external_id', 'EXTERNAL_ID']), 80).trim(),
        sku: text(firstNested(row, ['sku', 'SKU']), 80).trim(),
        kodProducenta: text(firstNested(row, ['kodProducenta', 'mpn', 'manufacturerCode', 'manufacturer_code', 'producerCode']), 80).trim(),
        optimaCode: text(firstNested(row, ['optimaCode', 'supplierOptimaCode', 'kodOptima', 'comarchCode']), 80).trim(),
        kodDostawcy: text(firstNested(row, ['kodDostawcy', 'supplierCode', 'vendorCode', 'towarCode']), 80).trim(),
        ean: text(firstNested(row, ['ean', 'gtin', 'EAN', 'GTIN']), 40).trim(),
        nazwa: text(row?.nazwa || row?.name || 'Produkt', 300).trim(),
        ilosc: Math.max(0, Number(row?.ilosc ?? row?.quantity) || 0),
      };
    })
    .filter((row) => row.ilosc > 0);
}

function minimalOrderEmail({ rows, number, name, to, subject, includeOptima = false }) {
  const textRows = rows.map((row) => `${row.kod} | ${row.nazwa} | ${decimal(row.ilosc)}`).join('\n');
  const optima = includeOptima ? buildComarchOptimaTxt(rows, { orderNumber: number, supplierName: name }) : null;
  const optimaPlain = optima?.attachment
    ? `\n\nZałącznik dla Comarch ERP Optima: ${OPTIMA_IMPORT_INSTRUCTION} → wskaż TXT → zaznacz „Pobieraj ceny z programu”. Plik bez nagłówka; ceny są celowo puste.`
    : '';
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.ilosc) || 0), 0);
  const plain = `Cześć,\n\nprzesyłamy dzisiejsze zamówienie ${number}.\n\nKod produktu | Nazwa | Zamawiana ilość\n${textRows}\n\nRazem: ${rows.length} pozycji, ${decimal(total)} szt.${optimaPlain}\n\nPozdrowienia dla całej ekipy!\nArtway-TM`;
  const table = rows.map((row, index) => `<tr style="background:${index % 2 ? '#f8fafc' : '#ffffff'}"><td style="padding:12px 14px;border:1px solid #cbd5e1;font-weight:800;white-space:nowrap;color:#172554">${escapeHtml(row.kod)}</td><td style="padding:12px 14px;border:1px solid #cbd5e1;font-weight:600">${escapeHtml(row.nazwa)}</td><td style="padding:12px 14px;border:1px solid #cbd5e1;text-align:center;font-size:16px;font-weight:900;white-space:nowrap">${escapeHtml(decimal(row.ilosc))}</td></tr>`).join('');
  const optimaHtml = optima?.attachment
    ? `<p style="margin:18px 0 0;padding-top:12px;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;line-height:1.45"><b>Załącznik Comarch ERP Optima:</b> ${escapeHtml(OPTIMA_IMPORT_INSTRUCTION)} → wskaż TXT → zaznacz „Pobieraj ceny z programu”. Plik bez nagłówka, ceny celowo puste.</p>`
    : '';
  const html = `<!doctype html><html lang="pl"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#172033"><div style="max-width:780px;margin:0 auto;padding:20px 12px"><div style="background:#fff;border:1px solid #cbd5e1;border-radius:14px;overflow:hidden"><div style="display:flex;justify-content:space-between;gap:18px;padding:16px 20px;border-bottom:3px solid #1e3a8a"><div><div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b">Artway-TM • zamówienie</div><div style="margin-top:4px;font-size:21px;font-weight:900;color:#172554">${escapeHtml(number)}</div></div><div style="text-align:right;font-size:12px;color:#475569"><b>${escapeHtml(name)}</b><br>${escapeHtml(rows.length)} pozycji • ${escapeHtml(decimal(total))} szt.</div></div><div style="padding:18px 20px"><p style="margin:0 0 14px;font-size:15px;line-height:1.5">Cześć,<br>poniżej dzisiejsze zamówienie.</p><table style="width:100%;border-collapse:collapse;border:2px solid #1e3a8a"><thead><tr style="background:#1e3a8a;color:#fff;text-align:left"><th style="padding:11px 14px;border:1px solid #1e3a8a;width:24%">Kod produktu</th><th style="padding:11px 14px;border:1px solid #1e3a8a">Nazwa</th><th style="padding:11px 14px;border:1px solid #1e3a8a;text-align:center;width:18%">Zamawiana ilość</th></tr></thead><tbody>${table}</tbody><tfoot><tr style="background:#eaf0fb;font-weight:900"><td colspan="2" style="padding:11px 14px;border:1px solid #cbd5e1;text-align:right">Razem</td><td style="padding:11px 14px;border:1px solid #cbd5e1;text-align:center">${escapeHtml(decimal(total))} szt.</td></tr></tfoot></table><p style="margin:18px 0 0;line-height:1.6;color:#334155">Pozdrowienia dla całej ekipy!<br><b style="color:#172033">Artway-TM</b></p>${optimaHtml}</div></div></div></body></html>`;
  return { name, to, rows, subject, text: plain, html, optima, attachments: optima?.attachment ? [optima.attachment] : [] };
}

/** Walidacja kompletności wykonywana przed jakąkolwiek próbą SMTP. */
export function validateSupplierOrderEmail(item = {}) {
  const rows = Array.isArray(item.rows) ? item.rows : [];
  const missingTableIdentifiers = rows.filter((row) => !businessIdentifier(row?.kod)).map((row) => text(row?.nazwa || 'Produkt', 300));
  const requiresOptima = ['alexander', 'multigra'].includes(producerFamily(item.name));
  const missingOptimaIdentifiers = (Array.isArray(item.optima?.missingIdentifiers) ? item.optima.missingIdentifiers : [])
    .map((row) => text(row?.name || 'Produkt', 300));
  const errors = [];
  if (!text(item.name, 160).trim()) errors.push('Brak nazwy producenta');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(item.to, 300).trim())) errors.push('Brak poprawnego e-maila producenta');
  if (!rows.length) errors.push('Brak pozycji producenta');
  if (missingTableIdentifiers.length) errors.push('Pozycje bez biznesowego identyfikatora');
  if (requiresOptima && (missingOptimaIdentifiers.length || (rows.length > 0 && !item.optima?.attachment))) errors.push('Niekompletny plik Comarch ERP Optima');
  return {
    ok: errors.length === 0,
    errors,
    missingIdentifiers: [...new Set([...missingTableIdentifiers, ...missingOptimaIdentifiers])],
    requiresOptima,
  };
}

export function renderSupplierOrderEmail(order = {}, supplier = {}) {
  const name = text(supplier.name || supplier.nazwa, 120).trim();
  const to = text(supplier.orderEmail || supplier.email, 300).trim().toLowerCase();
  const rows = supplierRows(order, supplier);
  const number = text(order?.numer || order?.id || 'zamówienie', 120).trim();
  // Temat i treść są celowo stałe. Konfigurowalny szablon mógłby ponownie
  // wprowadzić cenę lub wartość, których producent nigdy nie powinien dostać.
  const subject = `Zamówienie ${number} — Artway-TM`;
  const common = { rows, number, name, to, subject };
  const rendered = minimalOrderEmail({
    ...common,
    includeOptima: ['alexander', 'multigra'].includes(producerFamily(name)),
  });
  return { ...rendered, validation: validateSupplierOrderEmail(rendered) };
}
