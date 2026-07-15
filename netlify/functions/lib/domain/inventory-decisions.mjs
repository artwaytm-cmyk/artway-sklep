import crypto from 'node:crypto';
import { applyInventoryStockSet } from './inventory.mjs';

export const INVENTORY_DECISIONS_KEY = 'inventory_stock_decisions';

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

export function normalizeInventoryLocation(value = '') {
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

export function activeInventoryLocations(settings = {}, productId = '') {
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

export function inventoryDecisionCallback(action = '', id = '', location = '') {
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

export function parseInventoryDecisionCallback(value = '') {
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

export function renderInventoryLocationPrompt(decisionInput = {}, locationsInput = []) {
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

export function renderInventoryDecisionConfirmation(decisionInput = {}) {
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

export function renderInventoryDecisionReminder(decisionsInput = [], options = {}) {
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

export function inventoryReminderSlot(now = new Date()) {
  const local = warsawClock(now);
  return local.hour === 16 ? `${local.date}T16:00` : null;
}

export function createInventoryDecisionService({
  readVersioned,
  writeIfVersion,
  settingsReadVersioned = readVersioned,
  settingsWriteIfVersion = writeIfVersion,
  decisionsReadVersioned = readVersioned,
  decisionsWriteIfVersion = writeIfVersion,
  settingsLimit = 4 * 1024 * 1024,
  reminderLeaseMs = REMINDER_LEASE_MS,
  now = () => new Date(),
  idFactory = defaultDecisionId,
} = {}) {
  if (typeof settingsReadVersioned !== 'function' || typeof settingsWriteIfVersion !== 'function'
    || typeof decisionsReadVersioned !== 'function' || typeof decisionsWriteIfVersion !== 'function') {
    throw new Error('Decyzje magazynowe wymagają osobnego wersjonowanego odczytu i zapisu ustawień oraz rejestru decyzji.');
  }

  async function changeDecisions(mutator, attempts = 8) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const version = await decisionsReadVersioned(INVENTORY_DECISIONS_KEY, { schema: 1, items: [], lastReminderSlot: '', updatedAt: null });
      const current = registry(version.value);
      const outcome = await mutator(current, version);
      if (outcome?.write === false) return outcome.value;
      const next = {
        ...current,
        ...(outcome?.record || {}),
        schema: 1,
        items: compactItems(outcome?.record?.items || current.items),
        updatedAt: now().toISOString(),
      };
      const write = await decisionsWriteIfVersion(INVENTORY_DECISIONS_KEY, next, version);
      if (write?.modified) return outcome?.value;
    }
    throw decisionError('Rejestr decyzji zmienił się podczas zapisu. Spróbuj ponownie.', 'inventory_decision_write_conflict');
  }

  async function readSettings() {
    const version = await settingsReadVersioned(SETTINGS_KEY, { data: {}, rev: 0, updated_at: null });
    return { version, record: settingsRecord(version.value) };
  }

  async function createDraft(input = {}) {
    const requestId = clean(input.requestId, 160);
    const productId = clean(input.productId, 120);
    if (!requestId || !productId) throw decisionError('Brakuje identyfikatora żądania albo produktu.', 'inventory_decision_invalid_draft', 422);
    const mode = clean(input.mode || 'set', 20).toLowerCase();
    if (!['set', 'increment'].includes(mode)) throw decisionError('Nieobsługiwany tryb zmiany stanu.', 'inventory_decision_invalid_mode', 422);
    const quantity = integer(input.quantity, 'quantity');
    const { record: current } = await readSettings();
    const expectedStock = stockValue(current.data, productId);
    if (mode === 'increment' && expectedStock === null) {
      throw decisionError('Nie można dodać sztuk do produktu bez monitorowanego stanu.', 'inventory_unlimited_stock', 409);
    }
    const locations = activeInventoryLocations(current.data, productId);
    const suggestedLocation = locations.find((location) => location.current)?.code || '';
    const createdAt = now().toISOString();
    const id = clean(idFactory(requestId, input), 16);
    if (!/^IV[a-f0-9]{14}$/i.test(id)) throw decisionError('Generator zwrócił nieprawidłowy identyfikator decyzji.', 'inventory_decision_id_invalid', 500);
    const draft = {
      id,
      requestId,
      status: 'awaiting_location',
      productId,
      product: productIdentity(input.product, productId),
      mode,
      quantity,
      expectedStock,
      expectedRev: current.rev,
      after: previewStock(expectedStock, mode, quantity),
      location: '',
      suggestedLocation,
      expectedLocation: '',
      source: clean(input.source || 'agent', 80) || 'agent',
      channel: input.channel === 'panel' ? 'panel' : 'telegram',
      chatId: clean(input.chatId, 100),
      messageThreadId: Number(input.messageThreadId) > 0 ? Number(input.messageThreadId) : null,
      actor: actorData(input.actor || { name: input.operator }),
      reason: clean(input.reason || 'Zmiana przygotowana przez Agenta', 300),
      createdAt,
      updatedAt: createdAt,
      lastError: '',
    };
    return changeDecisions((record) => {
      const existing = record.items.find((item) => item.requestId === requestId);
      if (existing) {
        const sameOperation = String(existing.productId || '') === productId
          && (existing.mode === 'increment' ? 'increment' : 'set') === mode
          && Number(existing.quantity) === quantity;
        if (!sameOperation) {
          throw decisionError('Identyfikator żądania był już użyty dla innej decyzji magazynowej.', 'inventory_decision_request_id_conflict', 409);
        }
        return { write: false, value: { decision: publicDecision(existing), duplicate: true, locations: activeInventoryLocations(current.data, existing.productId) } };
      }
      if (record.items.filter((item) => !TERMINAL_STATUSES.has(item.status)).length >= MAX_ACTIVE) {
        throw decisionError('Za dużo zmian oczekuje na decyzję. Potwierdź albo odrzuć wcześniejsze.', 'inventory_decision_queue_full', 429);
      }
      return { record: { items: [...record.items, draft] }, value: { decision: publicDecision(draft), duplicate: false, locations } };
    });
  }

  async function assignLocation(idInput = '', locationInput = '', actorInput = {}) {
    const id = clean(idInput, 16);
    const { record: current } = await readSettings();
    return changeDecisions((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw decisionError('Nie znaleziono decyzji magazynowej.', 'inventory_decision_not_found', 404);
      const old = record.items[index];
      if (old.status === 'confirmed') throw decisionError('Ta zmiana została już potwierdzona.', 'inventory_decision_already_confirmed');
      if (old.status === 'rejected') throw decisionError('Ta zmiana została odrzucona.', 'inventory_decision_already_rejected');
      if (old.status === 'confirming') throw decisionError('Potwierdzenie jest właśnie zapisywane.', 'inventory_decision_in_progress');
      const location = ensureLocation(current.data, old.productId, locationInput);
      const expectedLocation = productLocation(current.data, old.productId);
      const expectedStock = stockValue(current.data, old.productId);
      if (old.mode === 'increment' && expectedStock === null) throw decisionError('Produkt nie ma monitorowanego stanu.', 'inventory_unlimited_stock');
      const timestamp = now().toISOString();
      const decision = {
        ...old,
        status: 'pending_confirmation',
        location,
        expectedLocation,
        expectedStock,
        expectedRev: current.rev,
        after: previewStock(expectedStock, old.mode, Number(old.quantity)),
        locationAssignedAt: timestamp,
        locationAssignedBy: actorData(actorInput),
        updatedAt: timestamp,
        lastError: '',
      };
      const items = [...record.items];
      items[index] = decision;
      return { record: { items }, value: { decision: publicDecision(decision), locations: activeInventoryLocations(current.data, old.productId) } };
    });
  }

  async function setPendingAfterConflict(id, current, message) {
    return changeDecisions((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw decisionError('Nie znaleziono decyzji magazynowej.', 'inventory_decision_not_found', 404);
      const old = record.items[index];
      if (old.status === 'confirmed' || old.status === 'rejected') return { write: false, value: publicDecision(old) };
      const expectedStock = stockValue(current.data, old.productId);
      const suggestedLocation = productLocation(current.data, old.productId);
      const timestamp = now().toISOString();
      const decision = {
        ...old,
        status: 'awaiting_location',
        location: '',
        suggestedLocation,
        expectedLocation: suggestedLocation,
        expectedStock,
        expectedRev: current.rev,
        after: previewStock(expectedStock, old.mode, Number(old.quantity)),
        confirmationStartedAt: '',
        lastError: clean(message, 300),
        updatedAt: timestamp,
      };
      const items = [...record.items]; items[index] = decision;
      return { record: { items }, value: publicDecision(decision) };
    });
  }

  async function releaseConfirmationForRetry(id, current, message) {
    return changeDecisions((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw decisionError('Nie znaleziono decyzji magazynowej.', 'inventory_decision_not_found', 404);
      const old = record.items[index];
      if (old.status === 'confirmed' || old.status === 'rejected') return { write: false, value: publicDecision(old) };
      const timestamp = now().toISOString();
      const decision = {
        ...old,
        status: 'pending_confirmation',
        expectedRev: current.rev,
        confirmationStartedAt: '',
        lastError: clean(message, 300),
        updatedAt: timestamp,
      };
      const items = [...record.items]; items[index] = decision;
      return { record: { items }, value: publicDecision(decision) };
    });
  }

  async function markConfirmed(id, result, actorInput = {}) {
    return changeDecisions((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw decisionError('Nie znaleziono decyzji magazynowej.', 'inventory_decision_not_found', 404);
      const old = record.items[index];
      if (old.status === 'confirmed') return { write: false, value: { decision: publicDecision(old), duplicate: true } };
      const timestamp = now().toISOString();
      const decision = {
        ...old,
        status: 'confirmed',
        confirmedAt: timestamp,
        confirmedBy: actorData(actorInput),
        confirmationStartedAt: '',
        updatedAt: timestamp,
        lastError: '',
        result: {
          before: result.before === null ? null : Number(result.before),
          after: Number(result.after),
          delta: Number(result.delta),
          movementId: clean(result.movementId, 160),
          rev: Number(result.rev),
          updated_at: clean(result.updated_at, 40),
        },
      };
      const items = [...record.items]; items[index] = decision;
      return { record: { items }, value: { decision: publicDecision(decision), duplicate: false } };
    });
  }

  async function confirm(idInput = '', actorInput = {}) {
    const id = clean(idInput, 16);
    const locked = await changeDecisions((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw decisionError('Nie znaleziono decyzji magazynowej.', 'inventory_decision_not_found', 404);
      const old = record.items[index];
      if (old.status === 'confirmed') return { write: false, value: { decision: publicDecision(old), duplicate: true } };
      if (old.status === 'rejected') throw decisionError('Odrzuconej decyzji nie można potwierdzić.', 'inventory_decision_already_rejected');
      if (old.status === 'awaiting_location') throw decisionError('Najpierw przypisz lokalizację produktu.', 'inventory_decision_location_required', 422);
      if (!old.location) throw decisionError('Brakuje lokalizacji produktu.', 'inventory_decision_location_required', 422);
      if (old.status === 'confirming') return { write: false, value: { decision: publicDecision(old), duplicate: false, resumed: true } };
      if (old.status !== 'pending_confirmation') throw decisionError('Decyzja nie jest gotowa do potwierdzenia.', 'inventory_decision_not_pending');
      const timestamp = now().toISOString();
      const decision = { ...old, status: 'confirming', confirmationStartedAt: timestamp, confirmationStartedBy: actorData(actorInput), updatedAt: timestamp };
      const items = [...record.items]; items[index] = decision;
      return { record: { items }, value: { decision: publicDecision(decision), duplicate: false } };
    });
    if (locked.duplicate) return locked;
    const decision = locked.decision;

    let current;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const settings = await readSettings();
      current = settings.record;
      const previousMovement = movementForDecision(current.data, id);
      if (previousMovement) return markConfirmed(id, resultFromMovement(previousMovement, current.rev), actorInput);

      const actualStock = stockValue(current.data, decision.productId);
      const actualLocation = productLocation(current.data, decision.productId);
      if (actualStock !== decision.expectedStock || actualLocation !== decision.expectedLocation) {
        const refreshed = await setPendingAfterConflict(id, current, 'Stan lub lokalizacja zmieniły się. Wybierz lokalizację i potwierdź ponownie.');
        throw decisionError('Dane produktu zmieniły się od przygotowania decyzji. Wymagane jest ponowne wskazanie lokalizacji i osobne potwierdzenie.', 'inventory_decision_stale', 409, { decision: refreshed });
      }
      ensureLocation(current.data, decision.productId, decision.location);

      const mutation = applyInventoryStockSet(current, {
        productId: decision.productId,
        mode: decision.mode,
        quantity: decision.quantity,
        expectedStock: decision.expectedStock,
        expectedRev: current.rev,
        confirmed: true,
        confirmInventory: true,
        requireLocation: true,
        location: decision.location,
        expectedLocation: decision.expectedLocation,
        product: decision.product,
        source: clean(decision.source || 'inventory-decision', 80),
        requestId: `inventory-decision:${id}`,
        operator: actorData(actorInput).name,
        reason: clean(decision.reason || 'Osobno potwierdzona decyzja magazynowa', 300),
      }, now());
      if (Buffer.byteLength(JSON.stringify(mutation.record.data || {}), 'utf8') > Math.max(1024, Number(settingsLimit) || 4 * 1024 * 1024)) {
        const refreshed = await setPendingAfterConflict(id, current, 'Rejestr magazynowy osiągnął limit rozmiaru. Zmiana nie została zapisana.');
        throw decisionError('Rejestr magazynowy jest zbyt duży. Wymagane jest uporządkowanie historii przed zapisem.', 'inventory_decision_settings_too_large', 413, { decision: refreshed });
      }
      const write = await settingsWriteIfVersion(SETTINGS_KEY, mutation.record, settings.version);
      if (write?.modified) return markConfirmed(id, mutation.result, actorInput);
    }
    const latest = await readSettings();
    current = latest.record;
    const recoveredMovement = movementForDecision(current.data, id);
    if (recoveredMovement) return markConfirmed(id, resultFromMovement(recoveredMovement, current.rev), actorInput);
    const actualStock = stockValue(current.data, decision.productId), actualLocation = productLocation(current.data, decision.productId);
    if (actualStock !== decision.expectedStock || actualLocation !== decision.expectedLocation) {
      const refreshed = await setPendingAfterConflict(id, current, 'Stan lub lokalizacja zmieniły się podczas zapisu. Wybierz lokalizację i potwierdź ponownie.');
      throw decisionError('Dane produktu zmieniły się podczas zapisu. Wymagane jest ponowne wskazanie lokalizacji i osobne potwierdzenie.', 'inventory_decision_stale', 409, { decision: refreshed });
    }
    const retry = await releaseConfirmationForRetry(id, current, 'Baza była chwilowo zajęta. Sprawdź podsumowanie i potwierdź tę samą decyzję ponownie.');
    throw decisionError('Baza była chwilowo zajęta. Nic nie zapisano; potwierdź tę samą decyzję ponownie.', 'inventory_decision_write_conflict', 409, { decision: retry });
  }

  async function reject(idInput = '', actorInput = {}) {
    const id = clean(idInput, 16);
    return changeDecisions((record) => {
      const index = record.items.findIndex((item) => item.id === id);
      if (index < 0) throw decisionError('Nie znaleziono decyzji magazynowej.', 'inventory_decision_not_found', 404);
      const old = record.items[index];
      if (old.status === 'rejected') return { write: false, value: { decision: publicDecision(old), duplicate: true } };
      if (old.status === 'confirmed') throw decisionError('Potwierdzonej zmiany nie można odrzucić.', 'inventory_decision_already_confirmed');
      if (old.status === 'confirming') throw decisionError('Zmiana jest właśnie zapisywana. Odśwież jej stan.', 'inventory_decision_in_progress');
      const timestamp = now().toISOString();
      const decision = { ...old, status: 'rejected', rejectedAt: timestamp, rejectedBy: actorData(actorInput), updatedAt: timestamp, lastError: '' };
      const items = [...record.items]; items[index] = decision;
      return { record: { items }, value: { decision: publicDecision(decision), duplicate: false } };
    });
  }

  async function get(idInput = '') {
    const id = clean(idInput, 16);
    const version = await decisionsReadVersioned(INVENTORY_DECISIONS_KEY, { schema: 1, items: [], lastReminderSlot: '', updatedAt: null });
    const decision = registry(version.value).items.find((item) => item.id === id);
    if (!decision) throw decisionError('Nie znaleziono decyzji magazynowej.', 'inventory_decision_not_found', 404);
    return publicDecision(decision);
  }

  async function list(options = {}) {
    const version = await decisionsReadVersioned(INVENTORY_DECISIONS_KEY, { schema: 1, items: [], lastReminderSlot: '', updatedAt: null });
    const statuses = new Set((Array.isArray(options.statuses) ? options.statuses : []).map((item) => clean(item, 40)).filter(Boolean));
    return registry(version.value).items.filter((item) => !statuses.size || statuses.has(item.status)).map(publicDecision);
  }

  async function prepareReminder(at = now()) {
    const timestamp = at instanceof Date ? at : new Date(at);
    const slot = Number.isFinite(timestamp.getTime()) ? inventoryReminderSlot(timestamp) : null;
    if (!slot) return { due: false, reason: 'outside_window', slot: null, messages: [], decisions: [] };
    const claimedAt = timestamp.toISOString();
    const leaseDuration = Math.max(30_000, Math.min(15 * 60 * 1000, Number(reminderLeaseMs) || REMINDER_LEASE_MS));
    const leaseUntil = new Date(timestamp.getTime() + leaseDuration).toISOString();
    const claimToken = crypto.randomUUID();
    return changeDecisions((record) => {
      if (record.lastReminderSlot === slot) return { write: false, value: { due: false, reason: 'already_sent', slot, messages: [], decisions: [] } };
      const currentClaim = record.reminderClaim;
      const claimActive = currentClaim?.slot === slot && Date.parse(currentClaim.leaseUntil) > timestamp.getTime();
      if (claimActive) {
        return {
          write: false,
          value: {
            due: false,
            reason: 'already_claimed',
            slot,
            claimExpiresAt: currentClaim.leaseUntil,
            messages: [],
            decisions: [],
          },
        };
      }
      const items = record.items.map((item) => {
        if (item.status !== 'confirming') return item;
        const startedAt = Date.parse(item.confirmationStartedAt || item.updatedAt || '');
        if (Number.isFinite(startedAt) && timestamp.getTime() - startedAt < CONFIRMATION_LEASE_MS) return item;
        return {
          ...item,
          status: 'pending_confirmation',
          confirmationStartedAt: '',
          lastError: 'Poprzednia próba nie zakończyła się jednoznacznie. Sprawdź dane i potwierdź ponownie; zapis nie zostanie zdublowany.',
          updatedAt: claimedAt,
        };
      });
      const pending = items.filter((item) => ['awaiting_location', 'pending_confirmation'].includes(item.status));
      if (!pending.length) return { write: false, value: { due: false, reason: 'nothing_pending', slot, messages: [], decisions: [] } };
      return {
        record: {
          items,
          reminderClaim: {
            token: claimToken,
            slot,
            claimedAt,
            leaseUntil,
            decisionIds: pending.map((item) => item.id),
          },
        },
        value: {
          due: true,
          reason: 'pending_confirmations',
          slot,
          claimToken,
          claimExpiresAt: leaseUntil,
          messages: renderInventoryDecisionReminder(pending),
          decisions: pending.map(publicDecision),
        },
      };
    });
  }

  async function completeReminder(claimTokenInput = '', at = now()) {
    const claimToken = clean(claimTokenInput, 80);
    if (!claimToken) throw decisionError('Brakuje tokenu rezerwacji przypomnienia.', 'inventory_reminder_claim_required', 422);
    const timestamp = at instanceof Date ? at : new Date(at);
    const completedAt = Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : now().toISOString();
    return changeDecisions((record) => {
      const claim = record.reminderClaim;
      if (!claim || claim.token !== claimToken) {
        throw decisionError('Rezerwacja przypomnienia wygasła albo należy do innego procesu.', 'inventory_reminder_claim_invalid', 409);
      }
      const ids = new Set(claim.decisionIds);
      const items = record.items.map((item) => ids.has(item.id)
        ? { ...item, lastReminderAt: completedAt, updatedAt: completedAt }
        : item);
      return {
        record: { items, lastReminderSlot: claim.slot, reminderClaim: null },
        value: { completed: true, duplicate: false, slot: claim.slot, decisions: claim.decisionIds.length, completedAt },
      };
    });
  }

  async function releaseReminder(claimTokenInput = '') {
    const claimToken = clean(claimTokenInput, 80);
    if (!claimToken) throw decisionError('Brakuje tokenu rezerwacji przypomnienia.', 'inventory_reminder_claim_required', 422);
    return changeDecisions((record) => {
      const claim = record.reminderClaim;
      if (!claim) return { write: false, value: { released: false, reason: 'not_claimed' } };
      if (claim.token !== claimToken) {
        throw decisionError('Rezerwacja przypomnienia należy do innego procesu.', 'inventory_reminder_claim_invalid', 409);
      }
      return {
        record: { reminderClaim: null },
        value: { released: true, slot: claim.slot },
      };
    });
  }

  return Object.freeze({ assignLocation, completeReminder, confirm, createDraft, get, list, prepareReminder, reject, releaseReminder });
}
