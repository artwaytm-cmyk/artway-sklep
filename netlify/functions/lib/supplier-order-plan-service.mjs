import {
  approveSupplierPlanDraft,
  cancelSupplierPlanDraft,
  receiveSupplierPlanLine,
  supplierLineIdentifiers,
  supplierLineStableKey,
  upsertSupplierPlanLine,
} from './domain/supplier-order-plan.mjs';
import crypto from 'node:crypto';

const DEFAULT_ATTEMPTS = 4;
const DEFAULT_LIMIT = 4 * 1024 * 1024;

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value = '', limit = 300) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
}

function normalized(value = '') {
  return text(value, 180).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fail(message, code, status = 422, extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, extra);
  throw error;
}

function conflict(message, code = 'supplier_order_write_conflict') {
  return fail(message, code, 409);
}

function supplierOrders(data = {}) {
  return array(object(data).artway_agent_ai_zlecenia);
}

/** Genericzny zapis ustawień nie może nadpisać wersjonowanego Planu zatowarowania. */
export function preserveSupplierPlanOnGenericSettings(incoming = {}, previous = {}) {
  return {
    ...object(incoming),
    artway_agent_ai_zlecenia: structuredClone(supplierOrders(previous)),
  };
}

function supplierNamesOfDraft(draft = {}) {
  const names = [
    draft.supplier, draft.dostawca, ...array(draft.dostawcy),
    ...array(draft.pozycje || draft.items).map((line) => line?.dostawca || line?.supplier),
  ].map((value) => text(value, 160)).filter(Boolean);
  const unique = new Map();
  names.forEach((name) => { if (!unique.has(normalized(name))) unique.set(normalized(name), name); });
  return [...unique.values()];
}

/** Kontakty pochodzą wyłącznie z serwerowej kartoteki producentów. */
export function resolveCanonicalSupplierContacts(draft = {}, data = {}, requestedNames = []) {
  const canonicalNames = supplierNamesOfDraft(draft);
  if (!canonicalNames.length) fail('Dokument nie ma przypisanego producenta.', 'supplier_missing');
  const requested = [...new Set(array(requestedNames).map((name) => normalized(name)).filter(Boolean))].sort();
  const canonical = canonicalNames.map((name) => normalized(name)).sort();
  if (requested.length && JSON.stringify(requested) !== JSON.stringify(canonical)) {
    fail('Lista producentów z żądania nie odpowiada zatwierdzonemu dokumentowi.', 'supplier_mismatch', 422);
  }
  const records = array(object(data).artway_producenci);
  return canonicalNames.map((name) => {
    const matches = records.filter((record) => normalized(record?.name || record?.nazwa) === normalized(name));
    if (matches.length !== 1) fail(`Brak jednoznacznej kartoteki producenta: ${name}.`, 'supplier_contact_missing', 422);
    const record = matches[0], orderEmail = text(record?.orderEmail || record?.email, 300).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orderEmail)) fail(`Uzupełnij e-mail zamówień producenta: ${name}.`, 'supplier_contact_missing', 422);
    return { ...record, name, orderEmail };
  });
}

function productAliases(product = {}) {
  return new Set(supplierLineIdentifiers(product));
}

function findProduct(products = [], body = {}, drafts = []) {
  const productId = text(body.productId ?? body.product?.id ?? body.product?.produktId, 160);
  const lineKey = text(body.lineKey, 220);
  const currentLine = drafts.flatMap((draft) => array(draft?.pozycje || draft?.items)).find((line) => {
    if (lineKey && supplierLineStableKey(line) === lineKey) return true;
    return productId && text(line?.produktId ?? line?.productId, 160) === productId;
  });
  const canonicalId = productId || text(currentLine?.produktId ?? currentLine?.productId, 160);
  if (canonicalId) {
    const exact = products.find((product) => text(product?.id ?? product?.produktId, 160) === canonicalId);
    if (!exact) fail('Nie znaleziono produktu w aktualnym katalogu.', 'supplier_product_not_found', 404);
    return exact;
  }
  const probe = { ...object(body.product), ...body };
  const wanted = productAliases(probe);
  if (!wanted.size) fail('Wskaż produkt z aktualnego katalogu.', 'supplier_product_not_found', 404);
  const matches = products.filter((product) => supplierLineIdentifiers(product).some((identifier) => wanted.has(identifier)));
  if (matches.length > 1) fail('Identyfikator pasuje do kilku kartotek. Wybierz konkretny produkt.', 'supplier_product_ambiguous', 409);
  if (!matches.length) fail('Nie znaleziono produktu w aktualnym katalogu.', 'supplier_product_not_found', 404);
  return matches[0];
}

function resultPayload(result, record, changed) {
  const drafts = array(result.drafts);
  const draftId = text(result.draft?.id, 160);
  return {
    ok: true,
    changed,
    draft: drafts.find((draft) => text(draft?.id, 160) === draftId) || result.draft || null,
    supplierOrders: drafts,
    rev: Math.max(0, Number(record.rev) || 0),
    updated_at: record.updated_at || null,
    ...(result.line ? { line: result.line } : {}),
    ...(result.movement ? { movement: result.movement } : {}),
    ...(result.duplicate ? { duplicate: true } : {}),
    ...(result.created ? { created: true } : {}),
  };
}

export function createSupplierOrderPlanService({
  readVersioned,
  writeIfVersion,
  mergeSettings = async (data) => data,
  catalogProducts = () => [],
  now = () => new Date(),
  maxAttempts = DEFAULT_ATTEMPTS,
  settingsLimit = DEFAULT_LIMIT,
} = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') {
    throw new TypeError('Plan zatowarowania wymaga wersjonowanego repozytorium.');
  }

  async function mutate(kind, body = {}, actor = 'administrator') {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
      const record = object(version.value);
      const data = object(record.data);
      const drafts = supplierOrders(data);
      let result;
      if (kind === 'upsert') {
        const merged = object(await mergeSettings(data));
        const products = array(catalogProducts(merged));
        const product = findProduct(products, body, drafts);
        result = upsertSupplierPlanLine({
          drafts,
          ...body,
          product,
          line: { ...object(body.product), ...body, productId: body.productId ?? product?.id ?? product?.produktId },
          actor,
          now: now(),
        });
      } else if (kind === 'approve') {
        result = approveSupplierPlanDraft({ drafts, ...body, actor, now: now() });
      } else if (kind === 'receive') {
        result = receiveSupplierPlanLine({ drafts, settings: data, ...body, actor, now: now() });
      } else if (kind === 'cancel') {
        result = cancelSupplierPlanDraft({ drafts, ...body, actor, now: now() });
      } else {
        throw new TypeError('Nieznana operacja planu zatowarowania.');
      }
      if (!result.changed) return resultPayload(result, record, false);
      const nextData = kind === 'receive'
        ? { ...result.settings, artway_agent_ai_zlecenia: result.drafts }
        : { ...data, artway_agent_ai_zlecenia: result.drafts };
      if (JSON.stringify(nextData).length > settingsLimit) fail('Plan zatowarowania przekracza limit ustawień.', 'settings_too_large', 413);
      const updatedAt = now().toISOString();
      const next = { ...record, data: nextData, rev: Math.max(0, Number(record.rev) || 0) + 1, updated_at: updatedAt };
      const write = await writeIfVersion('settings', next, version);
      if (write?.modified) return resultPayload(result, next, true);
    }
    return conflict('Plan zatowarowania zmienił się podczas zapisu. Spróbuj ponownie.');
  }

  async function loadApprovedForSend({ draftId, expectedRevision } = {}) {
    const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
    const record = object(version.value);
    const drafts = supplierOrders(record.data);
    const draft = drafts.find((item) => text(item?.id, 160) === text(draftId, 160));
    if (!draft) fail('Nie znaleziono zamówienia producenta.', 'supplier_order_not_found', 404);
    const revision = Math.max(1, Number(draft.revision) || 1);
    const expected = Number(expectedRevision);
    if (!Number.isSafeInteger(expected) || expected !== revision) fail(
      'Dokument zmienił się. Zatwierdź jego aktualną wersję.',
      'supplier_order_revision_conflict',
      409,
      { currentRevision: revision },
    );
    const status = normalized(draft.status);
    if (!draft.approvedAt || Number(draft.approvalRevision) !== revision || !['zaakceptowane', 'czesciowo wyslane e mailem'].includes(status)) {
      fail('Najpierw zatwierdź dokładnie aktualną wersję zamówienia producenta.', 'approval_required');
    }
    if (!array(draft.pozycje).some((line) => Number(line?.ilosc) > 0)) fail('Zamówienie producenta jest puste.', 'supplier_order_empty');
    return { draft: structuredClone(draft), supplierOrders: drafts, rev: Math.max(0, Number(record.rev) || 0), updated_at: record.updated_at || null };
  }

  /** Blokuje zatwierdzoną rewizję przed SMTP, więc w trakcie wysyłki nie da się jej zmienić. */
  async function beginEmailSend({ draftId, expectedRevision, requestedSupplierNames = [], actor = 'administrator' } = {}) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
      const record = object(version.value), data = object(record.data);
      const drafts = supplierOrders(data).map((draft) => structuredClone(draft));
      const index = drafts.findIndex((draft) => text(draft?.id, 160) === text(draftId, 160));
      if (index < 0) fail('Nie znaleziono zamówienia producenta.', 'supplier_order_not_found', 404);
      const draft = drafts[index], revision = Math.max(1, Number(draft.revision) || 1), expected = Number(expectedRevision);
      if (!Number.isSafeInteger(expected) || expected !== revision) fail('Dokument zmienił się. Zatwierdź jego aktualną wersję.', 'supplier_order_revision_conflict', 409, { currentRevision: revision });
      const activeLock = object(draft.sendLock), lockAge = now().getTime() - Date.parse(activeLock.createdAt || '');
      if (normalized(draft.status) === 'wysylanie e mail' && Number.isFinite(lockAge) && lockAge < 15 * 60 * 1000) {
        fail('Wysyłka tego dokumentu już trwa.', 'supplier_order_send_in_progress', 409);
      }
      if (!draft.approvedAt || Number(draft.approvalRevision) !== revision || !['zaakceptowane', 'czesciowo wyslane e mailem', 'wysylanie e mail'].includes(normalized(draft.status))) {
        fail('Najpierw zatwierdź dokładnie aktualną wersję zamówienia producenta.', 'approval_required');
      }
      if (!array(draft.pozycje).some((line) => Number(line?.ilosc) > 0)) fail('Zamówienie producenta jest puste.', 'supplier_order_empty');
      let supplierContacts;
      try { supplierContacts = resolveCanonicalSupplierContacts(draft, data, requestedSupplierNames); }
      catch (error) {
        if (normalized(draft.status) !== 'wysylanie e mail' || (Number.isFinite(lockAge) && lockAge < 15 * 60 * 1000)) throw error;
        const timestamp = now().toISOString();
        draft.revision = revision;
        draft.status = draft.statusBeforeSend || 'zaakceptowane';
        delete draft.sendLock;
        delete draft.statusBeforeSend;
        draft.updatedAt = timestamp;
        drafts[index] = draft;
        const next = { ...record, data: { ...data, artway_agent_ai_zlecenia: drafts }, rev: Math.max(0, Number(record.rev) || 0) + 1, updated_at: timestamp };
        const write = await writeIfVersion('settings', next, version);
        if (write?.modified) throw error;
        continue;
      }
      const timestamp = now().toISOString();
      draft.revision = revision;
      const lockId = `send-${crypto.createHash('sha256').update(`${draft.id}|${revision}|${timestamp}`).digest('hex').slice(0, 18)}`;
      draft.statusBeforeSend = draft.statusBeforeSend || (normalized(draft.status) === 'czesciowo wyslane e mailem' ? 'częściowo wysłane e-mailem' : 'zaakceptowane');
      draft.status = 'wysyłanie e-mail';
      draft.sendLock = { id: lockId, revision, createdAt: timestamp, actor: text(actor, 200) || 'administrator' };
      draft.updatedAt = timestamp;
      drafts[index] = draft;
      const nextData = { ...data, artway_agent_ai_zlecenia: drafts };
      if (JSON.stringify(nextData).length > settingsLimit) fail('Plan zatowarowania przekracza limit ustawień.', 'settings_too_large', 413);
      const next = { ...record, data: nextData, rev: Math.max(0, Number(record.rev) || 0) + 1, updated_at: timestamp };
      const write = await writeIfVersion('settings', next, version);
      if (write?.modified) return { ...resultPayload({ drafts, draft }, next, true), sendLockId: lockId, supplierContacts };
    }
    return conflict('Nie udało się zablokować rewizji do wysyłki.', 'supplier_order_write_conflict');
  }

  async function markEmailResults({ draftId, expectedRevision, sendLockId, results = [], sentAt, actor = 'administrator' } = {}) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
      const record = object(version.value);
      const data = object(record.data);
      const drafts = supplierOrders(data).map((draft) => structuredClone(draft));
      const index = drafts.findIndex((draft) => text(draft?.id, 160) === text(draftId, 160));
      if (index < 0) fail('Nie znaleziono zamówienia producenta.', 'supplier_order_not_found', 404);
      const draft = drafts[index];
      const revision = Math.max(1, Number(draft.revision) || 1);
      if (revision !== Number(expectedRevision)) fail('Dokument zmienił się po wysyłce. Status wymaga ponownej synchronizacji.', 'supplier_order_revision_conflict', 409, { currentRevision: revision });
      if (!sendLockId || text(draft.sendLock?.id, 160) !== text(sendLockId, 160)) fail('Blokada wysyłki wygasła lub została zastąpiona.', 'supplier_order_send_lock_conflict', 409);
      const successful = array(results).filter((result) => result?.sent);
      draft.revision = revision;
      const allSent = results.length > 0 && results.every((result) => result?.sent);
      const timestamp = sentAt || now().toISOString();
      draft.status = successful.length ? (allSent ? 'wysłane do producenta' : 'częściowo wysłane e-mailem') : (draft.statusBeforeSend || 'zaakceptowane');
      if (successful.length) draft.emailSentAt = timestamp;
      draft.emailSentBy = text(actor, 200) || 'administrator';
      draft.receiptRevision = Math.max(0, Number(draft.receiptRevision) || 0);
      draft.sentSuppliers = [...new Set([
        ...array(draft.sentSuppliers),
        ...successful.map((result) => text(result.supplier, 160)).filter(Boolean),
      ])];
      draft.emailResults = array(results).map((result) => ({
        supplier: text(result?.supplier, 160),
        sent: !!result?.sent,
        skippedDuplicate: !!result?.skippedDuplicate,
        sentAt: text(result?.sentAt, 80),
        error: text(result?.error, 500),
      }));
      draft.updatedAt = timestamp;
      delete draft.sendLock;
      delete draft.statusBeforeSend;
      draft.historia = [...array(draft.historia), {
        at: timestamp,
        type: 'supplier-email',
        text: allSent ? 'Wysłano zatwierdzony dokument do producenta.' : successful.length ? 'Wysłano dokument do części producentów; pozostałe wymagają ponowienia.' : 'Wysyłka nie powiodła się; dokument odblokowano bez zmiany rewizji.',
        operator: text(actor, 200) || 'administrator',
      }].slice(-150);
      drafts[index] = draft;
      const nextData = { ...data, artway_agent_ai_zlecenia: drafts };
      if (JSON.stringify(nextData).length > settingsLimit) fail('Plan zatowarowania przekracza limit ustawień.', 'settings_too_large', 413);
      const next = { ...record, data: nextData, rev: Math.max(0, Number(record.rev) || 0) + 1, updated_at: timestamp };
      const write = await writeIfVersion('settings', next, version);
      if (write?.modified) return resultPayload({ drafts, draft }, next, true);
    }
    return conflict('Status wysyłki wymaga ponownej synchronizacji.', 'supplier_order_write_conflict');
  }

  async function abortEmailSend({ draftId, expectedRevision, sendLockId, actor = 'administrator' } = {}) {
    return markEmailResults({ draftId, expectedRevision, sendLockId, results: [], actor });
  }

  return Object.freeze({
    upsert: (body, actor) => mutate('upsert', body, actor),
    approve: (body, actor) => mutate('approve', body, actor),
    cancel: (body, actor) => mutate('cancel', body, actor),
    receive: (body, actor) => mutate('receive', body, actor),
    loadApprovedForSend,
    beginEmailSend,
    markEmailResults,
    abortEmailSend,
  });
}
