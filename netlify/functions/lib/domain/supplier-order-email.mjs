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

function verifiedManufacturerCode(row = {}) {
  const candidates = [
    ['kodProducenta', row.kodProducenta],
    ['mpn', row.mpn],
    ['manufacturerCode', row.manufacturerCode],
    ['producerCode', row.producerCode],
    ['externalId', row.externalId],
    ['sku', row.sku],
    ['kod', row.kod],
  ];
  for (const [field, candidate] of candidates) {
    const value = text(candidate, 80).trim();
    if (!value || /^(?:-|—|brak|n\/a)$/i.test(value) || /\b(?:lub|albo|or)\b/i.test(value)) continue;
    if (field === 'kod' && value === text(row.produktId || row.productId, 80).trim()) continue;
    if (/^[\p{L}\p{N}][\p{L}\p{N}._\/-]{0,79}$/u.test(value)) return value;
  }
  return '';
}

const decimal = (value, minimum = 0) => {
  const number = Math.max(minimum, Number(String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
};

const safeFilenamePart = (value, fallback) => producerKey(value).slice(0, 80) || fallback;

/**
 * Plik tekstowy importowany w Comarch ERP Optima jako: TOWAR;ILOŚĆ;CENA.
 * Plik celowo nie ma wiersza nagłówkowego. Pozycja bez pewnego identyfikatora
 * nie jest zgadywana i trafia do raportu missingIdentifiers.
 */
export function buildComarchOptimaTxt(rows = [], { orderNumber = '', supplierName = '' } = {}) {
  const lines = [];
  const missingIdentifiers = [];
  for (const [index, row] of (Array.isArray(rows) ? rows : []).entries()) {
    const identifier = validGtin(row.ean || row.gtin) || verifiedManufacturerCode(row);
    if (!identifier) {
      missingIdentifiers.push({
        row: index + 1,
        name: text(row.nazwa || row.name || 'Produkt', 300).trim(),
        code: text(row.kod || row.kodProducenta || row.mpn, 80).trim(),
        ean: text(row.ean || row.gtin, 40).trim(),
        reason: 'Brak poprawnego EAN lub jednoznacznego kodu producenta',
      });
      continue;
    }
    const amount = Number(row.ilosc ?? row.quantity);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    // Cena jest w Optimie opcjonalna. Zamówienia Artway-TM do producentów
    // nigdy nie przekazują cen ani wartości, dlatego trzecie pole pozostaje
    // świadomie puste również wtedy, gdy kartoteka ma cenę zakupu.
    lines.push(`${identifier};${decimal(amount, 0)};`);
  }
  const filename = `zamowienie-optima-${safeFilenamePart(supplierName, 'producent')}-${safeFilenamePart(orderNumber, 'zamowienie')}.txt`;
  const content = lines.length ? `\uFEFF${lines.join('\r\n')}` : '';
  return {
    format: 'TOWAR;ILOŚĆ;CENA',
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
    .map((row) => ({
      dostawca: text(row?.dostawca || name, 120).trim(),
      kod: text(row?.kodProducenta || row?.mpn || row?.manufacturerCode || row?.externalId || row?.sku || row?.kod || '—', 80).trim() || '—',
      ean: text(row?.ean || row?.gtin, 80).trim(),
      nazwa: text(row?.nazwa || row?.name || 'Produkt', 300).trim(),
      ilosc: Math.max(0, Number(row?.ilosc ?? row?.quantity) || 0),
    }))
    .filter((row) => row.ilosc > 0)
    .slice(0, 500);
}

function minimalOrderEmail({ rows, number, name, to, subject, includeOptima = false }) {
  const textRows = rows.map((row) => `${row.kod} | ${row.nazwa} | ${decimal(row.ilosc)}`).join('\n');
  const plain = `Cześć,\n\nDzisiejsze zamówienie:\n\nKod | Nazwa | Zamawiana ilość\n${textRows}\n\nPozdrowienia dla całej ekipy!\nArtway-TM`;
  const table = rows.map((row) => `<tr><td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:700;white-space:nowrap">${escapeHtml(row.kod)}</td><td style="padding:12px 14px;border-bottom:1px solid #e5e7eb">${escapeHtml(row.nazwa)}</td><td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:800;white-space:nowrap">${escapeHtml(decimal(row.ilosc))}</td></tr>`).join('');
  const html = `<!doctype html><html lang="pl"><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033"><div style="max-width:720px;margin:0 auto;padding:28px 14px"><div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:26px;box-shadow:0 8px 30px rgba(15,23,42,.06)"><p style="font-size:17px;margin:0 0 20px">Cześć,</p><p style="font-size:17px;margin:0 0 18px"><b>Dzisiejsze zamówienie:</b></p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden"><thead><tr style="background:#f1f5f9;text-align:left"><th style="padding:11px 14px">Kod</th><th style="padding:11px 14px">Nazwa</th><th style="padding:11px 14px;text-align:center">Zamawiana ilość</th></tr></thead><tbody>${table}</tbody></table></div><p style="margin:24px 0 0;line-height:1.65">Pozdrowienia dla całej ekipy!<br><b>Artway-TM</b></p></div></div></body></html>`;
  const optima = includeOptima ? buildComarchOptimaTxt(rows, { orderNumber: number, supplierName: name }) : null;
  return { name, to, rows, subject, text: plain, html, optima, attachments: optima?.attachment ? [optima.attachment] : [] };
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
  return minimalOrderEmail({
    ...common,
    includeOptima: ['alexander', 'multigra'].includes(producerFamily(name)),
  });
}
