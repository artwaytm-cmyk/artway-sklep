import crypto from 'node:crypto';

const INVENTORY_DECISIONS_KEY = 'inventory_stock_decisions';

const SETTINGS_KEY = 'settings';
const MAX_ITEMS = 500;
const MAX_ACTIVE = 200;
const MAX_STOCK = 1_000_000;
const CONFIRMATION_LEASE_MS = 5 * 60 * 1000;
const REMINDER_LEASE_MS = 5 * 60 * 1000;
const REMINDER_MESSAGE_BYTES = 3800;
const TERMINAL_STATUSES = new Set(['confirmed', 'rejected']);

function decisionError(message, code = 'inventory_decision_error', status = 409, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function clean(value = '', limit = 300) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
}

function html(value = '') {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function integer(value, field, { min = 0, max = MAX_STOCK } = {}) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw decisionError(`Pole ${field} musi być liczbą całkowitą od ${min} do ${max}.`, 'inventory_decision_invalid_number', 422);
  }
  return number;
}

function normalizeInventoryLocation(value = '') {
  const replacements = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' };
  return clean(value, 100).toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (letter) => replacements[letter] || letter)
    .toUpperCase()
    .replace(/[^A-Z0-9._/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function settingsRecord(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const data = source.data && typeof source.data === 'object' && !Array.isArray(source.data) ? source.data : {};
  const rev = Number(source.rev || 0);
  return {
    ...source,
    data,
    rev: Number.isSafeInteger(rev) && rev >= 0 ? rev : 0,
    updated_at: clean(source.updated_at, 40) || null,
  };
}

function registry(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const claimSource = source.reminderClaim && typeof source.reminderClaim === 'object' && !Array.isArray(source.reminderClaim)
    ? source.reminderClaim
    : null;
  const reminderClaim = claimSource && clean(claimSource.token, 80) && clean(claimSource.slot, 40)
    ? {
      token: clean(claimSource.token, 80),
      slot: clean(claimSource.slot, 40),
      claimedAt: clean(claimSource.claimedAt, 40),
      leaseUntil: clean(claimSource.leaseUntil, 40),
      decisionIds: Array.isArray(claimSource.decisionIds)
        ? [...new Set(claimSource.decisionIds.map((id) => clean(id, 16)).filter(Boolean))].slice(0, MAX_ACTIVE)
        : [],
    }
    : null;
  return {
    schema: 1,
    items: Array.isArray(source.items) ? source.items.filter((item) => item && typeof item === 'object') : [],
    lastReminderSlot: clean(source.lastReminderSlot, 40),
    reminderClaim,
    updatedAt: clean(source.updatedAt, 40) || null,
  };
}

function stockValue(settings = {}, productId = '') {
  const stocks = settings.artway_stany && typeof settings.artway_stany === 'object' && !Array.isArray(settings.artway_stany)
    ? settings.artway_stany
    : {};
  if (!Object.prototype.hasOwnProperty.call(stocks, productId) || stocks[productId] === '' || stocks[productId] == null) return null;
  const value = Number(stocks[productId]);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function productLocation(settings = {}, productId = '') {
  const cards = settings.artway_magazyn_produkty && typeof settings.artway_magazyn_produkty === 'object' && !Array.isArray(settings.artway_magazyn_produkty)
    ? settings.artway_magazyn_produkty
    : {};
  return normalizeInventoryLocation(cards[String(productId)]?.lokalizacja || cards[String(productId)]?.location);
}

function previewStock(before, mode, quantity) {
  if (mode === 'increment') {
    if (before === null) return null;
    return integer(before + quantity, 'stan po zmianie');
  }
  return quantity;
}

function productIdentity(raw = {}, productId = '') {
  const product = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    id: productId,
    name: clean(product.name || product.nazwa || `Produkt ${productId}`, 240),
    sku: clean(product.sku, 120),
    externalId: clean(product.externalId || product.external_id || product.EXTERNAL_ID || product.mpn || product.kodProducenta, 120),
    ean: clean(product.ean || product.gtin || product.EAN || product.GTIN, 32),
  };
}

function actorData(raw = {}) {
  const actor = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    id: clean(actor.id || actor.userId, 100),
    name: clean(actor.name || actor.user || actor.email || 'administrator', 160) || 'administrator',
  };
}

function publicDecision(item = {}) {
  return {
    id: clean(item.id, 40),
    requestId: clean(item.requestId, 160),
    status: clean(item.status, 40),
    mode: item.mode === 'increment' ? 'increment' : 'set',
    quantity: Number(item.quantity),
    expectedStock: item.expectedStock === null ? null : Number(item.expectedStock),
    expectedRev: Number(item.expectedRev),
    after: item.after === null ? null : Number(item.after),
    location: clean(item.location, 40),
    suggestedLocation: clean(item.suggestedLocation, 40),
    expectedLocation: clean(item.expectedLocation, 40),
    product: productIdentity(item.product, clean(item.productId, 120)),
    productId: clean(item.productId, 120),
    source: clean(item.source, 80),
    channel: item.channel === 'panel' ? 'panel' : 'telegram',
    chatId: clean(item.chatId, 100),
    messageThreadId: Number(item.messageThreadId) > 0 ? Number(item.messageThreadId) : null,
    createdAt: clean(item.createdAt, 40),
    locationAssignedAt: clean(item.locationAssignedAt, 40),
    confirmedAt: clean(item.confirmedAt, 40),
    rejectedAt: clean(item.rejectedAt, 40),
    lastReminderAt: clean(item.lastReminderAt, 40),
    lastError: clean(item.lastError, 300),
    result: item.result && typeof item.result === 'object' ? { ...item.result } : null,
  };
}

function compactItems(items = []) {
  const active = items.filter((item) => !TERMINAL_STATUSES.has(item.status));
  const finished = items.filter((item) => TERMINAL_STATUSES.has(item.status))
    .sort((left, right) => String(right.confirmedAt || right.rejectedAt || right.createdAt || '').localeCompare(String(left.confirmedAt || left.rejectedAt || left.createdAt || '')));
  return [...active, ...finished.slice(0, Math.max(0, MAX_ITEMS - active.length))];
}

function activeInventoryLocations(settings = {}, productId = '') {
  const byCode = new Map();
  const rows = Array.isArray(settings.artway_magazyn_lokalizacje) ? settings.artway_magazyn_lokalizacje : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || row.aktywna === false) continue;
    const code = normalizeInventoryLocation(row.kod || row.code);
    if (!code || byCode.has(code)) continue;
    byCode.set(code, {
      code,
      name: clean(row.nazwa || row.name, 160),
      type: clean(row.typ || row.type || 'miejsce', 80),
      source: 'active',
      current: false,
    });
  }
  const cards = settings.artway_magazyn_produkty && typeof settings.artway_magazyn_produkty === 'object' && !Array.isArray(settings.artway_magazyn_produkty)
    ? settings.artway_magazyn_produkty
    : {};
  const current = normalizeInventoryLocation(cards[String(productId)]?.lokalizacja || cards[String(productId)]?.location);
  if (current) {
    const old = byCode.get(current);
    byCode.set(current, { ...(old || { code: current, name: '', type: 'miejsce', source: 'product_card' }), current: true });
  }
  return [...byCode.values()].sort((left, right) => Number(right.current) - Number(left.current)
    || left.code.localeCompare(right.code, 'pl', { numeric: true }));
}

function ensureLocation(settings, productId, value) {
  const code = normalizeInventoryLocation(value);
  if (!code) throw decisionError('Podaj lokalizację magazynową produktu.', 'inventory_decision_location_required', 422);
  const locations = activeInventoryLocations(settings, productId);
  if (!locations.some((location) => location.code === code)) {
    throw decisionError('Ta lokalizacja nie jest aktywna ani przypisana obecnie do produktu.', 'inventory_decision_location_invalid', 422, {
      location: code,
      availableLocations: locations.map((location) => location.code).slice(0, 50),
    });
  }
  return code;
}

function movementForDecision(settings = {}, id = '') {
  const requestId = `inventory-decision:${id}`;
  const movements = Array.isArray(settings.artway_ruchy_magazynowe) ? settings.artway_ruchy_magazynowe : [];
  return movements.find((movement) => clean(movement?.sourceRequestId, 160) === requestId) || null;
}

function resultFromMovement(movement = {}, rev = 0) {
  return {
    before: movement.stanPrzed === null ? null : Number(movement.stanPrzed),
    after: Number(movement.stanPo),
    delta: Number(movement.ilosc),
    movementId: clean(movement.id, 160),
    rev: Number(rev),
    updated_at: clean(movement.data, 40),
  };
}

function defaultDecisionId(requestId = '') {
  return `IV${crypto.createHash('sha256').update(requestId || crypto.randomUUID()).digest('hex').slice(0, 14)}`;
}

function callback(value) {
  const data = clean(value, 80);
  if (Buffer.byteLength(data, 'utf8') > 64) throw decisionError('Dane przycisku Telegram są za długie.', 'inventory_decision_callback_too_long', 500);
  return data;
}

function inventoryDecisionCallback(action = '', id = '', location = '') {
  const decisionId = clean(id, 16);
  if (!/^IV[a-f0-9]{14}$/i.test(decisionId)) throw decisionError('Nieprawidłowy identyfikator decyzji.', 'inventory_decision_id_invalid', 422);
  if (action === 'confirm') return callback(`iv:c:${decisionId}`);
  if (action === 'reject') return callback(`iv:r:${decisionId}`);
  if (action === 'location') {
    const code = normalizeInventoryLocation(location);
    if (!code) throw decisionError('Brakuje lokalizacji w przycisku.', 'inventory_decision_location_required', 422);
    return callback(`iv:l:${decisionId}:${code}`);
  }
  throw decisionError('Nieobsługiwana akcja decyzji.', 'inventory_decision_action_invalid', 422);
}

function parseInventoryDecisionCallback(value = '') {
  const raw = clean(value, 80);
  let match = raw.match(/^iv:([cr]):(IV[a-f0-9]{14})$/i);
  if (match) return { action: match[1].toLowerCase() === 'c' ? 'confirm' : 'reject', id: match[2] };
  match = raw.match(/^iv:l:(IV[a-f0-9]{14}):([A-Z0-9._/-]{1,40})$/i);
  if (match) return { action: 'location', id: match[1], location: normalizeInventoryLocation(match[2]) };
  return null;
}

function stockLabel(value) {
  return value === null ? 'niemonitorowany' : `${Number(value)} szt.`;
}

function renderInventoryLocationPrompt(decisionInput = {}, locationsInput = []) {
  const decision = publicDecision(decisionInput);
  const locations = Array.isArray(locationsInput) ? locationsInput.filter((item) => item?.code).slice(0, 8) : [];
  const current = decision.suggestedLocation;
  const rows = locations.map((location) => [{
    text: `${location.current ? '📍 ' : ''}${clean(location.code, 40)}${location.name ? ` — ${clean(location.name, 32)}` : ''}`.slice(0, 64),
    callback_data: inventoryDecisionCallback('location', decision.id, location.code),
  }]);
  rows.push([{ text: '❌ Nie zapisuj', callback_data: inventoryDecisionCallback('reject', decision.id) }]);
  return {
    text: `<b>📍 Podaj lokalizację produktu</b>\n${html(decision.product.name)}\nDecyzja: <code>${html(decision.id)}</code>\nStan po zmianie: <b>${html(stockLabel(decision.after))}</b>${current ? `\nObecna lokalizacja: <b>${html(current)}</b> — potwierdź ją albo wybierz inną.` : '\nWybierz aktywną lokalizację magazynową.'}\n\nNic nie zostało jeszcze zapisane.`,
    replyMarkup: { inline_keyboard: rows },
  };
}

function renderInventoryDecisionConfirmation(decisionInput = {}) {
  const decision = publicDecision(decisionInput);
  if (decision.status !== 'pending_confirmation') throw decisionError('Decyzja nie jest gotowa do potwierdzenia.', 'inventory_decision_not_pending');
  return {
    text: `<b>🔐 Potwierdź zmianę magazynową</b>\n${html(decision.product.name)}\nDecyzja: <code>${html(decision.id)}</code>\nStan: <b>${html(stockLabel(decision.expectedStock))}</b> → <b>${html(stockLabel(decision.after))}</b>\nLokalizacja: <b>${html(decision.location)}</b>\n\nZmiana zostanie zapisana dopiero po osobnym potwierdzeniu.`,
    replyMarkup: { inline_keyboard: [[
      { text: '✅ Potwierdzam', callback_data: inventoryDecisionCallback('confirm', decision.id) },
      { text: '❌ Nie potwierdzam', callback_data: inventoryDecisionCallback('reject', decision.id) },
    ]] },
  };
}

function renderInventoryDecisionReminder(decisionsInput = [], options = {}) {
  const decisions = (Array.isArray(decisionsInput) ? decisionsInput : [])
    .map(publicDecision).filter((item) => ['awaiting_location', 'pending_confirmation'].includes(item.status));
  const chunkSize = Math.max(1, Math.min(15, Number(options.chunkSize) || 12));
  const maxMessageBytes = Math.max(1000, Math.min(4000, Number(options.maxMessageBytes) || REMINDER_MESSAGE_BYTES));
  const messages = [];
  const header = `<b>🕓 Decyzje magazynowe do potwierdzenia</b>\n${decisions.length} ${decisions.length === 1 ? 'zmiana czeka' : 'zmiany czekają'} na Twoją decyzję. Nic nie zostanie zapisane automatycznie.`;
  const entries = decisions.map((item, index) => {
    const no = index + 1;
    const line = item.status === 'pending_confirmation'
      ? `<b>${no}. ${html(item.product.name)}</b> · <code>${html(item.id)}</code>\n${html(stockLabel(item.expectedStock))} → ${html(stockLabel(item.after))} · 📍 ${html(item.location)}`
      : `<b>${no}. ${html(item.product.name)}</b> · <code>${html(item.id)}</code>\n${html(stockLabel(item.expectedStock))} → ${html(stockLabel(item.after))} · 📍 wymaga lokalizacji${item.suggestedLocation ? ` (obecnie ${html(item.suggestedLocation)})` : ''}`;
    return { item, no, line };
  });
  const parts = [];
  let part = [];
  for (const entry of entries) {
    const candidate = [...part, entry];
    const candidateText = `${header}\n\n${candidate.map((row) => row.line).join('\n\n')}`;
    if (part.length && (candidate.length > chunkSize || Buffer.byteLength(candidateText, 'utf8') > maxMessageBytes)) {
      parts.push(part);
      part = [entry];
    } else {
      part = candidate;
    }
  }
  if (part.length) parts.push(part);
  for (const entriesPart of parts) {
    messages.push({
      text: `${header}\n\n${entriesPart.map((row) => row.line).join('\n\n')}`,
      replyMarkup: {
        inline_keyboard: entriesPart.map(({ item, no }) => {
          if (item.status === 'pending_confirmation') return [
            { text: `✅ #${no} Potwierdzam`, callback_data: inventoryDecisionCallback('confirm', item.id) },
            { text: `❌ #${no} Nie potwierdzam`, callback_data: inventoryDecisionCallback('reject', item.id) },
          ];
          return [
            item.suggestedLocation
              ? { text: `📍 #${no} Użyj ${item.suggestedLocation}`.slice(0, 64), callback_data: inventoryDecisionCallback('location', item.id, item.suggestedLocation) }
              : { text: `📍 #${no} Uzupełnij`, url: 'https://artwaytm.pl/#/admin/magazyn/stany' },
            { text: `❌ #${no} Nie potwierdzam`, callback_data: inventoryDecisionCallback('reject', item.id) },
          ];
        }),
      },
      decisionIds: entriesPart.map(({ item }) => item.id),
    });
  }
  return messages;
}

function warsawClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

function inventoryReminderSlot(now = new Date()) {
  const local = warsawClock(now);
  return local.hour === 16 ? `${local.date}T16:00` : null;
}

export { INVENTORY_DECISIONS_KEY, SETTINGS_KEY, MAX_ITEMS, MAX_ACTIVE, MAX_STOCK, CONFIRMATION_LEASE_MS, REMINDER_LEASE_MS, REMINDER_MESSAGE_BYTES, TERMINAL_STATUSES, decisionError, clean, html, integer, normalizeInventoryLocation, settingsRecord, registry, stockValue, productLocation, previewStock, productIdentity, actorData, publicDecision, compactItems, activeInventoryLocations, ensureLocation, movementForDecision, resultFromMovement, defaultDecisionId, callback, inventoryDecisionCallback, parseInventoryDecisionCallback, stockLabel, renderInventoryLocationPrompt, renderInventoryDecisionConfirmation, renderInventoryDecisionReminder, warsawClock, inventoryReminderSlot };
