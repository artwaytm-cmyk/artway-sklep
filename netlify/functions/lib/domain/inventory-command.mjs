function text(value = '', limit = 500) {
  return String(value ?? '').trim().slice(0, limit);
}

function normalize(value = '') {
  return text(value, 1000).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')
    .replace(/[^\p{L}\p{N}/._-]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function identifier(value = '') {
  return normalize(value).replace(/\s+/g, '');
}

const CONFIRMATION_WORD = /\b(?:zatwierdz\w*|potwierdz\w*|zapis\w*|akcept\w*|zaakcept\w*)\b/;
const QUOTED_TEXT_PATTERNS = [
  /„[^”\n]*”/g, /“[^”\n]*”/g, /«[^»\n]*»/g, /‹[^›\n]*›/g,
  /‘[^’\n]*’/g, /"[^"\n]*"/g, /'[^'\n]*'/g, /`[^`\n]*`/g,
];

function confirmationContext(raw = '', normalized = normalize(raw)) {
  const quoted = [];
  let outside = String(raw ?? '');
  for (const pattern of QUOTED_TEXT_PATTERNS) {
    outside = outside.replace(pattern, (match) => {
      quoted.push(normalize(match.slice(1, -1)));
      return ' ';
    });
  }
  const outsideNormalized = normalize(outside);
  const confirmationOutsideQuotes = CONFIRMATION_WORD.test(outsideNormalized);
  const unclosedQuote = /["'„”“«»‹›‘’`]/u.test(outside);
  const questionOrReference = /[?？]/u.test(String(raw))
    || /\b(?:czy|co\s+(?:oznacza|znaczy)|napisz|powiedz|odpowiedz|slowo)\b/.test(normalized);
  const quotedConfirmation = quoted.some((segment) => CONFIRMATION_WORD.test(segment));
  const quotedInventoryCommand = quoted.some((segment) => (
    /\b\d{1,7}\s*(?:szt|sztuk|sztuki|sztuka)\b/.test(segment)
    && (/\b(?:mam|mamy)\b[\s\S]*\bna stanie\b/.test(segment)
      || /\b(?:ustaw|ustawiam|skoryguj|zmien|przyjmij|przyjac|dodaj|doloz|zwieksz|dopisz|uzupelnij)\b/.test(segment))
  ));
  const negatedBefore = /\b(?:nie|bez)\b(?:\s+\w+){0,18}\s+\b(?:zatwierdz\w*|potwierdz\w*|zapis\w*|akcept\w*|zaakcept\w*)\b/.test(normalized);
  const revokedAfter = /\b(?:zatwierdz\w*|potwierdz\w*|zapis\w*|akcept\w*|zaakcept\w*)\b(?:\s+\w+){0,18}\s+\b(?:ale|lecz|jednak)\b(?:\s+\w+){0,8}\s+\bnie\b/.test(normalized)
    || /\b(?:zatwierdz\w*|potwierdz\w*|zapis\w*|akcept\w*|zaakcept\w*)\b(?:\s+\w+){0,20}\s+\b(?:anuluj\w*|cofnij\w*|odwol\w*|rezygn\w*|nie\s+(?:rob\w*|wykonuj\w*|zapisuj\w*|zmieniaj\w*|ustawiaj\w*|dodawaj\w*|zatwierdzaj\w*|potwierdzaj\w*|akceptuj\w*))\b/.test(normalized);
  const cancelled = /\b(?:anuluj\w*|cofnij\w*|odwol\w*|rezygn\w*)\b/.test(normalized);
  const deferred = /\b(?:jutro|pojutrze|pozniej|nastepnie|dopiero|wieczorem|rano|za\s+(?:chwile|moment|\d+\s*(?:minut|godzin|dni|tygodni))|po\s+(?:weekendzie|urlopie|swietach)|w\s+(?:weekend|poniedzialek|wtorek|srode|czwartek|piatek|sobote|niedziele))\b/.test(normalized)
    || /\b(?:gdy|kiedy|jak)\b(?:\s+\w+){0,8}\s+\b(?:bedzie|bede|wroce|dostane|przyjdzie)\b/.test(normalized)
    || /\b(?:po|o)\s+\d{1,2}(?::|\.)\d{2}\b/i.test(String(raw))
    || /\bpo\s+godzinie\s+\d{1,2}\b/.test(normalized);

  return {
    confirmed: confirmationOutsideQuotes
      && !negatedBefore && !revokedAfter && !cancelled && !deferred && !questionOrReference && !unclosedQuote
      && !quotedInventoryCommand && !(quotedConfirmation && !confirmationOutsideQuotes),
    quotedInventoryCommand,
    quotedConfirmation,
  };
}

export function parseInventoryNaturalCommand(input = '') {
  const raw = text(input, 1000), normalized = normalize(raw);
  if (!normalized || /\b(?:koszyk|koszyka|zamowienie klienta)\b/.test(normalized)) return null;
  const quantityMatches = [...normalized.matchAll(/\b(\d{1,7})\s*(?:szt|sztuk|sztuki|sztuka)\b/g)];
  const quantityMatch = quantityMatches.at(-1);
  if (!quantityMatch) return null;
  const increment = /\b(?:przyjmij|przyjac|dodaj|doloz|zwieksz|dopisz|uzupelnij)\b(?:\s+\w+){0,5}\s+\d{1,7}\s*(?:szt|sztuk|sztuki|sztuka)\b/.test(normalized);
  const set = /\b(?:mam|mamy)\b[\s\S]*\bna stanie\b/.test(normalized)
    || /\b(?:ustaw|ustawiam|skoryguj|zmien)\b[\s\S]*\b(?:stan|stanie|magazyn|magazynie)\b/.test(normalized)
    || /\b(?:stan|stanie)\b[\s\S]*\b(?:wynosi|jest)\b/.test(normalized);
  if (!increment && !set) return null;
  const quantity = Number(quantityMatch[1]);
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1_000_000) return null;
  const quotedOrExplanatory = /\b(?:klient\s+napisal|wiadomosc\s+klienta|w\s+instrukcji|przyklad|cytat|zacytowal|wyjasnij|co\s+mam\s+odpowiedziec)\b/.test(normalized);
  if (quotedOrExplanatory) return null;
  const confirmed = confirmationContext(raw, normalized).confirmed;
  const query = normalized
    .replace(quantityMatch[0], ' ')
    .replace(/\b(?:mam|mamy|obecnie|aktualnie|teraz|na|w|stanie|stanu|stan|magazynie|magazynu|magazyn|magazynowy|magazynowa|produktu|produkt|towaru|towar|przyjmij|przyjac|dodaj|doloz|zwieksz|dopisz|uzupelnij|ustaw|ustawiam|skoryguj|zmien|wynosi|jest|sprawdz|sprawdzi|oraz|i|prosze|zatwierdz|potwierdz|zapisz)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (!query) return null;
  const conflict = (increment && set) || quantityMatches.length > 1;
  return { type: 'inventory-stock-change', mode: increment && !set ? 'increment' : 'set', quantity, query, confirmed: conflict ? false : confirmed, conflict, raw };
}

function similarWord(left = '', right = '') {
  if (left === right) return true;
  if (left.length < 5 || right.length < 5) return false;
  const length = Math.min(7, left.length, right.length);
  return left.slice(0, length) === right.slice(0, length);
}

export function matchInventoryProduct(products = [], query = '') {
  const normalizedQuery = normalize(query), tokens = normalizedQuery.split(/\s+/).filter(Boolean), ids = new Set(tokens.map(identifier).filter(Boolean));
  const candidates = (Array.isArray(products) ? products : []).map((product) => {
    const fields = [
      ['ID', product?.id], ['EXTERNAL_ID', product?.externalId || product?.EXTERNAL_ID || product?.external_id],
      ['EAN', product?.ean || product?.EAN || product?.gtin || product?.GTIN],
      ['kod producenta', product?.kodProducenta || product?.mpn || product?.MPN || product?.manufacturerCode],
      ['SKU', product?.sku || product?.SKU],
    ].filter(([, value]) => text(value, 160));
    const matchedBy = fields.filter(([, value]) => ids.has(identifier(value))).map(([label]) => label);
    const name = normalize(product?.nazwa || product?.name || ''), nameTokens = name.split(/\s+/).filter(Boolean);
    let score = matchedBy.length ? 100 + matchedBy.length * 5 : 0;
    if (name === normalizedQuery) score += 80;
    else if (name.includes(normalizedQuery) && normalizedQuery.length >= 3) score += 45;
    else if (normalizedQuery.includes(name) && name.length >= 5) score += 35;
    for (const token of tokens) {
      if (token.length < 3 || /^\d+$/.test(token)) continue;
      if (nameTokens.includes(token)) score += 8;
      else if (nameTokens.some((word) => similarWord(token, word))) score += 4;
    }
    return { product, score, matchedBy };
  }).filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || text(a.product?.nazwa || a.product?.name).localeCompare(text(b.product?.nazwa || b.product?.name), 'pl'));

  const strong = candidates.filter((candidate) => candidate.matchedBy.length > 0);
  if (strong.length === 1) return { status: 'matched', product: strong[0].product, matchedBy: strong[0].matchedBy, alternatives: candidates.slice(0, 5).map((item) => item.product) };
  if (strong.length > 1) return { status: 'ambiguous', product: null, alternatives: strong.slice(0, 5).map((item) => item.product) };
  if (!candidates.length) return { status: 'not_found', product: null, alternatives: [] };
  if (candidates.length > 1 && candidates[0].score - candidates[1].score < 8) return { status: 'ambiguous', product: null, alternatives: candidates.slice(0, 5).map((item) => item.product) };
  return { status: 'matched', product: candidates[0].product, matchedBy: ['nazwa'], alternatives: candidates.slice(0, 5).map((item) => item.product) };
}

function html(value = '') {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stockValue(settings = {}, productId = '') {
  const stocks = settings.artway_stany && typeof settings.artway_stany === 'object' ? settings.artway_stany : {};
  if (!Object.prototype.hasOwnProperty.call(stocks, productId) || stocks[productId] === '' || stocks[productId] == null || !Number.isFinite(Number(stocks[productId]))) return null;
  return Math.max(0, Math.floor(Number(stocks[productId])));
}

function previousRequest(settings = {}, requestId = '') {
  if (!requestId || !Array.isArray(settings.artway_ruchy_magazynowe)) return null;
  return settings.artway_ruchy_magazynowe.find((movement) => String(movement?.sourceRequestId || '') === requestId) || null;
}

export function createInventoryNaturalCommandHandler({ readVersioned, writeIfVersion } = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') throw new Error('Inventory handler wymaga wersjonowanego repozytorium.');
  return async function handleInventoryNaturalCommand(rawText = '', meta = {}) {
    const command = parseInventoryNaturalCommand(rawText);
    if (!command) return null;
    if (command.conflict) return { intent: 'inventory', message: '<b>⚠️ Polecenie jest niejednoznaczne</b>\nWidzę jednocześnie stan bezwzględny i przyjęcie. Napisz osobno „ustaw stan …” albo „przyjmij … szt.”. Nic nie zostało zapisane.' };
    const requestId = text(meta.requestId || '', 160), operator = text(meta.user || 'administrator', 160) || 'administrator';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
      const current = version.value || { data: {}, rev: 0, updated_at: null };
      const data = current.data && typeof current.data === 'object' ? current.data : {};
      const match = matchInventoryProduct(mergeCatalogProducts(data).activeProducts, command.query);
      if (match.status === 'not_found') return { intent: 'inventory', message: `<b>⚠️ Nie znalazłem produktu</b>\nFraza: ${html(command.query)}\nNic nie zostało zapisane.` };
      if (match.status !== 'matched') {
        const rows = (match.alternatives || []).slice(0, 5).map((product) => `• ${html(product.nazwa || product.name || product.id)} · ID ${html(product.id)}`).join('\n');
        return { intent: 'inventory', message: `<b>⚠️ Potrzebuję dokładniejszego kodu</b>\nPasuje więcej niż jedna kartoteka. Podaj ID, EXTERNAL_ID, EAN lub SKU.\n${rows}` };
      }

      const product = match.product, productId = String(product.id), before = stockValue(data, productId);
      const identity = `ID ${html(productId)} · EXTERNAL_ID ${html(product.externalId || product.EXTERNAL_ID || product.mpn || '—')} · EAN ${html(product.ean || product.gtin || '—')}`;
      const oldMovement = previousRequest(data, requestId);
      if (oldMovement) return {
        intent: 'inventory',
        message: `<b>✅ To polecenie jest już zapisane</b>\n${html(product.nazwa || product.name || `Produkt ${productId}`)}\n${identity}\nStan: <b>${oldMovement.stanPrzed === null ? 'niemonitorowany' : oldMovement.stanPrzed}</b> → <b>${oldMovement.stanPo} szt.</b>`,
        replyMarkup: { inline_keyboard: [[{ text: 'Otwórz magazyn', url: 'https://artwaytm.pl/#/admin/magazyn/stany' }]] },
      };
      if (command.mode === 'increment' && before === null) return { intent: 'inventory', message: `<b>⚠️ ${html(product.nazwa || product.name)}</b>\nProdukt nie ma jeszcze monitorowanego stanu. Najpierw ustaw stan bezwzględny.` };
      const after = command.mode === 'increment' ? before + command.quantity : command.quantity;
      if (!command.confirmed) return {
        intent: 'inventory',
        message: `<b>🔎 ${html(product.nazwa || product.name || `Produkt ${productId}`)}</b>\n${identity}\nStan: <b>${before === null ? 'niemonitorowany' : before}</b> → <b>${after} szt.</b>\n\nTo tylko podgląd. Dopisz „zatwierdź”, aby zapisać.`,
      };

      const mutation = applyInventoryStockSet(current, {
        productId, mode: command.mode, quantity: command.quantity, expectedStock: before, expectedRev: Number(current.rev || 0), confirmed: true, confirmInventory: true,
        source: 'telegram-webhook', requestId, operator, reason: `Naturalne polecenie administratora: ${text(command.raw, 300)}`,
        product: { name: product.nazwa || product.name, sku: product.sku || '', externalId: product.externalId || product.EXTERNAL_ID || product.mpn || '', ean: product.ean || product.gtin || '' },
      }, new Date());
      const write = await writeIfVersion('settings', mutation.record, version);
      if (!write?.modified) continue;
      return {
        intent: 'inventory',
        message: `<b>✅ Stan zatwierdzony</b>\n${html(mutation.result.product.name)}\n${identity}\nStan: <b>${mutation.result.before === null ? 'niemonitorowany' : mutation.result.before}</b> → <b>${mutation.result.after} szt.</b> · zmiana ${mutation.result.delta >= 0 ? '+' : ''}${mutation.result.delta}\nZapisano ruch i potwierdzenie inwentaryzacji.`,
        replyMarkup: { inline_keyboard: [[{ text: 'Otwórz magazyn', url: 'https://artwaytm.pl/#/admin/magazyn/stany' }]] },
      };
    }
    const error = new Error('Baza zmieniła się podczas zapisu. Spróbuj ponownie, aby uniknąć podwójnej korekty.');
    error.code = 'inventory_write_conflict'; error.status = 409; throw error;
  };
}
import { mergeCatalogProducts } from './catalog-quality.mjs';
import { applyInventoryStockSet } from './inventory.mjs';
