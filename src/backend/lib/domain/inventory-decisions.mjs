import crypto from 'node:crypto';
import { applyInventoryStockSet } from './inventory.mjs';
import { INVENTORY_DECISIONS_KEY, SETTINGS_KEY, MAX_ITEMS, MAX_ACTIVE, MAX_STOCK, CONFIRMATION_LEASE_MS, REMINDER_LEASE_MS, REMINDER_MESSAGE_BYTES, TERMINAL_STATUSES, decisionError, clean, html, integer, normalizeInventoryLocation, settingsRecord, registry, stockValue, productLocation, previewStock, productIdentity, actorData, publicDecision, compactItems, activeInventoryLocations, ensureLocation, movementForDecision, resultFromMovement, defaultDecisionId, callback, inventoryDecisionCallback, parseInventoryDecisionCallback, stockLabel, renderInventoryLocationPrompt, renderInventoryDecisionConfirmation, renderInventoryDecisionReminder, warsawClock, inventoryReminderSlot } from './inventory-decision-support.mjs';

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

export { INVENTORY_DECISIONS_KEY, normalizeInventoryLocation, activeInventoryLocations, inventoryDecisionCallback, parseInventoryDecisionCallback, renderInventoryLocationPrompt, renderInventoryDecisionConfirmation, renderInventoryDecisionReminder, inventoryReminderSlot };
