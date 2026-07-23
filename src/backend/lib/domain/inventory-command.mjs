import { mergeCatalogProducts } from './catalog-quality.mjs';
import {
  renderInventoryDecisionConfirmation,
  renderInventoryLocationPrompt,
} from './inventory-decisions.mjs';

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

function decisionId(value = '') {
  return text(value, 80).match(/\b(IV[a-f0-9]{14})\b/i)?.[1] || '';
}

function decisionActor(meta = {}) {
  return { id: text(meta.userId || '', 100), name: text(meta.user || 'administrator', 160) || 'administrator' };
}

function commandCard(card = {}) {
  return { message: card.text || '', replyMarkup: card.replyMarkup };
}

export function createInventoryNaturalCommandHandler({ readVersioned, decisions } = {}) {
  if (typeof readVersioned !== 'function' || !decisions || typeof decisions.createDraft !== 'function') throw new Error('Inventory handler wymaga wersjonowanego repozytorium i serwisu decyzji.');
  return async function handleInventoryNaturalCommand(rawText = '', meta = {}) {
    const raw = text(rawText, 1000), normalized = normalize(raw), id = decisionId(raw);
    const parsedInventoryCommand = parseInventoryNaturalCommand(raw);
    const actor = decisionActor(meta);
    const rejectIntent = /\b(?:nie\s+potwierdz\w*|odrzuc\w*|anuluj\w*)\b/.test(normalized);
    const confirmIntent = !rejectIntent && /\b(?:potwierdz\w*|zatwierdz\w*|akceptuj\w*)\b/.test(normalized);
    if (id && (rejectIntent || (confirmIntent && !/\blokalizacj/.test(normalized)))) {
      return {
        intent: 'inventory-decision',
        message: '<b>🔐 Decyzja wymaga człowieka</b>\nKońcowe „Potwierdzam” albo „Nie potwierdzam” działa wyłącznie z przycisku lub jako dokładna odpowiedź administratora w Telegramie. Agent nie zmienił stanu magazynu.',
      };
    }

    const locationMatch = raw.match(/^(?:lokalizacja|lokacja|miejsce)\s+(?:(IV[a-f0-9]{14})\s+)?([A-Za-z0-9._/-]{1,40})\s*[.!]?$/i);
    // Skrócona lokalizacja bez prefiksu jest dozwolona tylko dla kodu z
    // cyfrą (np. A-R01-P01). Sam ukośnik nie może kwalifikować komend takich
    // jak /status albo /magazyn jako lokalizacji magazynowej.
    const bareLocation = /^(?=.*\d)[A-Za-z0-9._/-]{1,40}$/.test(raw) && !raw.startsWith('/') ? raw : '';
    if (locationMatch || bareLocation) {
      let targetId = locationMatch?.[1] || id;
      const location = locationMatch?.[2] || bareLocation;
      if (!targetId) {
        const awaiting = (await decisions.list({ statuses: ['awaiting_location'] }))
          .filter((item) => item.channel === 'telegram' && (!meta.chatId || item.chatId === String(meta.chatId)));
        if (awaiting.length !== 1) {
          return { intent: 'inventory-decision', message: awaiting.length
            ? '<b>📍 Wskaż numer decyzji</b>\nCzeka kilka produktów. Napisz: „lokalizacja IV… A-R01-P01”.'
            : '<b>📍 Brak decyzji oczekującej na lokalizację</b>\nNajpierw podaj produkt i zmianę stanu.' };
        }
        targetId = awaiting[0].id;
      }
      const result = await decisions.assignLocation(targetId, location, actor);
      return { intent: 'inventory-decision', ...commandCard(renderInventoryDecisionConfirmation(result.decision)) };
    }

    if ((confirmIntent || rejectIntent) && !id && !parsedInventoryCommand) {
      return { intent: 'inventory-decision', message: '<b>🔐 Każdą zmianę zatwierdzamy osobno</b>\nUżyj przycisku „Potwierdzam” albo „Nie potwierdzam” przy konkretnej decyzji. Ogólne potwierdzenie niczego nie zmieniło.' };
    }

    const command = parsedInventoryCommand;
    if (!command) return null;
    if (command.conflict) return { intent: 'inventory', message: '<b>⚠️ Polecenie jest niejednoznaczne</b>\nWidzę jednocześnie stan bezwzględny i przyjęcie. Napisz osobno „ustaw stan …” albo „przyjmij … szt.”. Nic nie zostało zapisane.' };
    const requestId = text(meta.requestId || '', 160);
    if (!requestId) throw Object.assign(new Error('Brakuje identyfikatora wiadomości. Nic nie zostało zapisane.'), { code: 'inventory_request_id_required', status: 422 });
    const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
    const current = version.value || { data: {}, rev: 0, updated_at: null };
    const data = current.data && typeof current.data === 'object' ? current.data : {};
    const match = matchInventoryProduct(mergeCatalogProducts(data).activeProducts, command.query);
    if (match.status === 'not_found') return { intent: 'inventory', message: `<b>⚠️ Nie znalazłem produktu</b>\nFraza: ${html(command.query)}\nNic nie zostało zapisane.` };
    if (match.status !== 'matched') {
      const rows = (match.alternatives || []).slice(0, 5).map((product) => `• ${html(product.nazwa || product.name || product.id)} · ID ${html(product.id)}`).join('\n');
      return { intent: 'inventory', message: `<b>⚠️ Potrzebuję dokładniejszego kodu</b>\nPasuje więcej niż jedna kartoteka. Podaj ID, EXTERNAL_ID, EAN lub SKU.\n${rows}` };
    }
    const product = match.product;
    const result = await decisions.createDraft({
      requestId,
      productId: String(product.id),
      product: { name: product.nazwa || product.name, sku: product.sku || '', externalId: product.externalId || product.EXTERNAL_ID || product.mpn || '', ean: product.ean || product.gtin || '' },
      mode: command.mode,
      quantity: command.quantity,
      source: text(meta.source || 'telegram-webhook', 80),
      channel: meta.channel === 'panel' ? 'panel' : 'telegram',
      chatId: meta.chatId,
      messageThreadId: meta.messageThreadId,
      actor,
      reason: `Naturalne polecenie administratora: ${text(command.raw, 300)}`,
    });
    if (result.decision.status === 'confirmed') return { intent: 'inventory-decision', message: '<b>✅ Ta decyzja była już wcześniej potwierdzona przez administratora.</b>\nAgent nie wykonał nowej zmiany.' };
    if (result.decision.status === 'rejected') return { intent: 'inventory-decision', message: '<b>❌ Ta decyzja była już wcześniej odrzucona przez administratora.</b>\nAgent nie wykonał nowej zmiany.' };
    if (result.decision.status === 'pending_confirmation') return { intent: 'inventory-decision', ...commandCard(renderInventoryDecisionConfirmation(result.decision)) };
    return { intent: 'inventory-decision', ...commandCard(renderInventoryLocationPrompt(result.decision, result.locations)) };
  };
}
