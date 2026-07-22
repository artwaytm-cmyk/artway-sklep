import { catalogPlainText } from './catalog-quality.mjs';

const cleanText = (value, max = 5000) => catalogPlainText(value, max).replace(/\s+/g, ' ').trim();

export function seoSlug(value = '') {
  return cleanText(value, 300).toLocaleLowerCase('pl-PL').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'produkty';
}

export function seoProductUnavailable(data = {}, product = {}) {
  const records = data.artway_dostepnosc && typeof data.artway_dostepnosc === 'object' ? data.artway_dostepnosc : {};
  const record = records[String(product.id)] || null;
  if (!record) return false;
  const decision = String(record.decision || record.decyzja || '').toLowerCase();
  if (decision === 'manual_available') return false;
  if (decision === 'grace') {
    const expires = Date.parse(record.expiresAt || record.waznaDo || '');
    return Number.isFinite(expires) && expires <= Date.now();
  }
  return String(record.status || '').toLowerCase() === 'niedostepny';
}
