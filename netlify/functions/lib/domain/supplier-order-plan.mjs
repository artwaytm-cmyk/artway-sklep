import crypto from 'node:crypto';

const MAX_QUANTITY = 1_000_000;
const EDITABLE_STATUSES = new Set([
  '', 'szkic', 'do sprawdzenia', 'zaakceptowane', 'wyslane na telegram',
  'draft', 'review', 'approved', 'telegram preview',
]);
const RECEIVABLE_STATUSES = new Set([
  'wyslane do producenta', 'wyslane do dostawcy', 'czesciowo wyslane e mailem',
  'czesciowo zrealizowane', 'sent', 'partially sent', 'partially fulfilled',
]);
const CORRECTABLE_STATUSES = new Set([
  'wyslane do producenta', 'wyslane do dostawcy', 'czesciowo wyslane e mailem',
  'sent', 'partially sent',
]);

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
  return text(value, 200).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function integer(value, { min = 0, max = MAX_QUANTITY, field = 'quantity' } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    const error = new TypeError(`Nieprawidłowa wartość pola ${field}.`);
    error.code = 'supplier_order_validation';
    error.status = 422;
    throw error;
  }
  return number;
}

function fail(message, code, status = 422, extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, extra);
  throw error;
}

function nowDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) throw new TypeError('Nieprawidłowa data operacji planu zatowarowania.');
  return date;
}

function statusKey(value = '') {
  return normalized(value);
}

function isEditable(draft = {}) {
  return EDITABLE_STATUSES.has(statusKey(draft.status));
}

function supplierOf(draft = {}) {
  return text(draft.supplier || draft.dostawca || draft.dostawcy?.[0] || draft.pozycje?.[0]?.dostawca, 160);
}

function draftItems(draft = {}) {
  return array(draft.pozycje || draft.items);
}

function quantityOf(line = {}) {
  const value = Number(line.ilosc ?? line.quantity ?? line.qty ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function requiredOf(line = {}) {
  const value = Number(line.iloscPotrzebna ?? line.requiredQuantity ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function receivedOf(line = {}) {
  const value = Number(line.przyjeto ?? line.received ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function identifierValue(value = '') {
  return text(value, 180).toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Stabilne identyfikatory pozycji. Kolejność jest celowa: EXTERNAL_ID, SKU,
 * kod producenta, jawny kod katalogowy, EAN, a dopiero na końcu wewnętrzne ID
 * kartoteki używane wyłącznie do wewnętrznego powiązania (nigdy do eksportu).
 */
export function supplierLineIdentifiers(value = {}) {
  const source = object(value);
  const externalId = identifierValue(source.externalId ?? source.external_id ?? source.EXTERNAL_ID);
  const sku = identifierValue(source.sku ?? source.SKU);
  const manufacturerCode = identifierValue(
    source.kodProducenta ?? source.manufacturerCode ?? source.mpn ?? source.MPN,
  );
  const ean = identifierValue(source.ean ?? source.EAN ?? source.gtin ?? source.GTIN).replace(/\D/g, '');
  const productId = text(source.produktId ?? source.productId ?? source.id, 160);
  const catalogCodeCandidate = identifierValue(source.kod ?? source.code);
  const catalogCode = catalogCodeCandidate && catalogCodeCandidate !== identifierValue(productId)
    ? catalogCodeCandidate
    : '';
  return [
    externalId && `external:${externalId}`,
    sku && `sku:${sku}`,
    manufacturerCode && manufacturerCode !== '—' && `manufacturer:${manufacturerCode}`,
    catalogCode && catalogCode !== '—' && `catalog:${catalogCode}`,
    ean && `ean:${ean}`,
    productId && `product:${productId}`,
  ].filter(Boolean);
}

export function supplierLineStableKey(value = {}) {
  return supplierLineIdentifiers(value)[0] || '';
}

function sameLine(left = {}, right = {}) {
  const leftIds = new Set(supplierLineIdentifiers(left));
  return supplierLineIdentifiers(right).some((identifier) => leftIds.has(identifier));
}

function productLine(product = {}, input = {}, supplier = '') {
  // `product` jest kanoniczną kartoteką serwerową. Dane z żądania służą
  // wyłącznie do jej wskazania i nie mogą nadpisywać kodów ani nazwy.
  const source = object(product);
  const externalId = text(source.externalId ?? source.external_id ?? source.EXTERNAL_ID, 160);
  const sku = text(source.sku ?? source.SKU, 160);
  const kodProducenta = text(source.kodProducenta ?? source.manufacturerCode ?? source.mpn ?? source.MPN, 160);
  const optimaCode = text(source.optimaCode ?? source.supplierOptimaCode ?? source.kodOptima ?? source.comarchCode, 160);
  const kodDostawcy = text(source.kodDostawcy ?? source.supplierCode ?? source.vendorCode ?? source.towarCode, 160);
  const ean = text(source.ean ?? source.EAN ?? source.gtin ?? source.GTIN, 40).replace(/\D/g, '');
  const produktId = text(source.produktId ?? source.productId ?? source.id, 160);
  const rawCatalogCode = text(source.kod ?? source.code, 160);
  const catalogCode = rawCatalogCode && identifierValue(rawCatalogCode) !== identifierValue(produktId)
    ? rawCatalogCode
    : '';
  const kod = externalId || sku || kodProducenta || catalogCode || ean || '—';
  return {
    produktId,
    externalId,
    sku,
    kodProducenta,
    mpn: kodProducenta,
    optimaCode,
    kodDostawcy,
    ean,
    kod,
    nazwa: text(source.nazwa ?? source.name ?? `Produkt ${produktId || kod}`, 300),
    dostawca: supplier,
  };
}

function clearApproval(draft) {
  for (const key of ['approval', 'approvedAt', 'approvedBy', 'approvalRevision', 'approvalStatus']) delete draft[key];
}

function appendHistory(draft, at, type, message, actor) {
  draft.historia = [...array(draft.historia), {
    at,
    type,
    text: text(message, 600),
    operator: text(actor, 200) || 'administrator',
  }].slice(-150);
}

function summarize(draft) {
  const items = draftItems(draft);
  draft.pozycje = items;
  delete draft.items;
  draft.sztuk = items.reduce((sum, line) => sum + quantityOf(line), 0);
  draft.dostawcy = [supplierOf(draft)].filter(Boolean);
  return draft;
}

function nextDraft(supplier, drafts, now) {
  const seed = `${supplier}|${now.toISOString()}|${drafts.length}`;
  return {
    id: `SPD-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 14)}`,
    numer: `AZ/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(drafts.length + 1).padStart(4, '0')}`,
    typ: 'zlecenie-producent',
    tryb: 'braki',
    status: 'szkic',
    revision: 0,
    receiptRevision: 0,
    data: now.toISOString(),
    createdAt: now.toISOString(),
    supplier,
    dostawca: supplier,
    dostawcy: [supplier],
    pozycje: [],
    historia: [],
  };
}

function expectedRevision(input, draft) {
  const expected = integer(input.expectedRevision, { field: 'expectedRevision' });
  const current = Math.max(1, Number(draft.revision) || 1);
  if (expected !== current) fail(
    'Plan zatowarowania zmienił się na innym urządzeniu. Pobierz aktualną wersję.',
    'supplier_order_revision_conflict',
    409,
    { currentRevision: current },
  );
  return current;
}

/** Dodaje pozycję albo zmienia jej łączną ilość w jedynym aktywnym szkicu dostawcy. */
export function upsertSupplierPlanLine(input = {}) {
  const now = nowDate(input.now);
  const drafts = array(input.drafts).map((draft) => structuredClone(draft));
  const supplier = text(input.supplier, 160);
  if (!supplier) fail('Wybierz producenta dla pozycji.', 'supplier_missing');
  const candidate = productLine(input.product, input.line || input, supplier);
  if (!supplierLineStableKey(candidate)) fail('Produkt nie ma EXTERNAL_ID, SKU, kodu producenta, EAN ani ID kartoteki.', 'supplier_product_identifier_missing');
  const requested = integer(input.quantity, { field: 'quantity' });
  const requestedDraftId = text(input.draftId, 160);
  let draftIndex = requestedDraftId ? drafts.findIndex((draft) => text(draft.id, 160) === requestedDraftId) : -1;
  if (requestedDraftId && draftIndex < 0) fail('Nie znaleziono szkicu producenta.', 'supplier_order_not_found', 404);
  if (draftIndex >= 0) {
    const draft = drafts[draftIndex];
    if (!isEditable(draft)) fail('Wysłanego dokumentu nie można już edytować. Utwórz nowy szkic.', 'supplier_order_locked', 409);
    if (normalized(supplierOf(draft)) !== normalized(supplier)) fail('Pozycja należy do innego producenta.', 'supplier_mismatch');
    expectedRevision(input, draft);
  } else {
    draftIndex = drafts.findIndex((draft) => isEditable(draft) && normalized(supplierOf(draft)) === normalized(supplier));
    if (draftIndex >= 0) expectedRevision(input, drafts[draftIndex]);
  }

  let created = false;
  if (draftIndex < 0) {
    if (requested === 0) fail('Nowa pozycja musi mieć ilość większą od zera.', 'supplier_quantity_zero');
    drafts.unshift(nextDraft(supplier, drafts, now));
    draftIndex = 0;
    created = true;
  }
  const draft = drafts[draftIndex];
  const duplicateLocations = [], existingLines = [];
  for (let index = 0; index < drafts.length; index += 1) {
    if (!isEditable(drafts[index]) || normalized(supplierOf(drafts[index])) !== normalized(supplier)) continue;
    const lines = draftItems(drafts[index]);
    lines.forEach((line, lineIndex) => {
      if (!sameLine(line, candidate)) return;
      existingLines.push(structuredClone(line));
      duplicateLocations.push({ draftIndex: index, lineIndex });
    });
  }
  const existing = existingLines[0] || null;
  const required = existingLines.reduce((sum, line) => sum + requiredOf(line), 0);
  if (requested < required) fail(
    `Nie można ustawić mniej niż ${required} szt. wymaganych przez aktywne zamówienia.`,
    'supplier_quantity_below_required',
    422,
    { requiredQuantity: required },
  );
  const received = existingLines.reduce((sum, line) => sum + receivedOf(line), 0);
  if (requested < received) fail(
    `Nie można ustawić mniej niż ${received} szt. już przyjętych.`,
    'supplier_quantity_below_received',
    422,
    { receivedQuantity: received },
  );
  const nextLine = {
    ...(existing || {}),
    ...candidate,
    produktId: candidate.produktId || text(existing?.produktId ?? existing?.productId, 160),
    externalId: candidate.externalId || text(existing?.externalId ?? existing?.external_id, 160),
    sku: candidate.sku || text(existing?.sku, 160),
    kodProducenta: candidate.kodProducenta || text(existing?.kodProducenta ?? existing?.mpn, 160),
    mpn: candidate.kodProducenta || text(existing?.mpn ?? existing?.kodProducenta, 160),
    optimaCode: candidate.optimaCode || text(existing?.optimaCode ?? existing?.supplierOptimaCode ?? existing?.kodOptima, 160),
    kodDostawcy: candidate.kodDostawcy || text(existing?.kodDostawcy ?? existing?.supplierCode ?? existing?.vendorCode, 160),
    ean: candidate.ean || text(existing?.ean ?? existing?.gtin, 40).replace(/\D/g, ''),
    kod: candidate.kod !== '—' ? candidate.kod : (text(existing?.kod, 160) || '—'),
    nazwa: candidate.nazwa || text(existing?.nazwa ?? existing?.name, 300),
    ilosc: requested,
    iloscPotrzebna: required,
    manualExtra: Math.max(0, requested - required),
    nadwyzka: Math.max(0, requested - required),
    przyjeto: received,
    zamowienia: [...new Set(existingLines.flatMap((line) => array(line.zamowienia || line.orderRefs)).map((value) => text(value, 180)).filter(Boolean))],
    stableKey: supplierLineStableKey(candidate),
    editedManuallyAt: now.toISOString(),
    editedManuallyBy: text(input.actor, 200) || 'administrator',
  };
  // Scalaj tylko dokumenty tego samego producenta. Każdy dokument, z którego
  // faktycznie usunięto duplikat, dostaje nową rewizję i traci zatwierdzenie.
  const locationsByDraft = new Map();
  for (const location of duplicateLocations) {
    if (!locationsByDraft.has(location.draftIndex)) locationsByDraft.set(location.draftIndex, new Set());
    locationsByDraft.get(location.draftIndex).add(location.lineIndex);
  }
  for (const [changedDraftIndex, lineIndexes] of locationsByDraft) {
    const changedDraft = drafts[changedDraftIndex];
    changedDraft.pozycje = draftItems(changedDraft).filter((_line, lineIndex) => !lineIndexes.has(lineIndex));
    if (changedDraftIndex !== draftIndex) {
      changedDraft.revision = Math.max(1, Number(changedDraft.revision) || 1) + 1;
      changedDraft.status = 'do sprawdzenia';
      changedDraft.updatedAt = now.toISOString();
      changedDraft.aktualizacja = now.toISOString();
      clearApproval(changedDraft);
      appendHistory(changedDraft, now.toISOString(), 'manual-line-merged', `Scalono ${nextLine.nazwa} z dokumentem ${text(draft.numer || draft.id, 160)}.`, input.actor);
    }
    summarize(changedDraft);
  }
  const targetLines = draftItems(draft).slice();
  if (requested > 0) targetLines.push(nextLine);
  draft.pozycje = targetLines;
  draft.revision = (created ? 0 : Math.max(1, Number(draft.revision) || 1)) + 1;
  draft.status = 'do sprawdzenia';
  draft.updatedAt = now.toISOString();
  draft.aktualizacja = now.toISOString();
  clearApproval(draft);
  appendHistory(
    draft,
    now.toISOString(),
    requested > 0 ? 'manual-line-upsert' : 'manual-line-remove',
    requested > 0 ? `Ustawiono ${nextLine.nazwa}: ${requested} szt.` : `Usunięto ${nextLine.nazwa} ze szkicu.`,
    input.actor,
  );
  summarize(draft);
  return { drafts, draft, created, changed: true, line: requested > 0 ? nextLine : null };
}

/** Zatwierdza wyłącznie dokładnie bieżącą rewizję dokumentu. */
export function approveSupplierPlanDraft(input = {}) {
  const now = nowDate(input.now);
  const drafts = array(input.drafts).map((draft) => structuredClone(draft));
  const draftIndex = drafts.findIndex((draft) => text(draft.id, 160) === text(input.draftId, 160));
  if (draftIndex < 0) fail('Nie znaleziono szkicu producenta.', 'supplier_order_not_found', 404);
  const draft = drafts[draftIndex];
  if (!isEditable(draft)) fail('Dokument został już wysłany i jest zablokowany.', 'supplier_order_locked', 409);
  const revisionWasMissing = !Number.isSafeInteger(Number(draft.revision)) || Number(draft.revision) < 1;
  const revision = expectedRevision(input, draft);
  draft.revision = revision;
  if (!draftItems(draft).some((line) => quantityOf(line) > 0)) fail('Nie można zatwierdzić pustego szkicu.', 'supplier_order_empty');
  const alreadyApproved = statusKey(draft.status) === 'zaakceptowane'
    && text(draft.approvedAt, 80)
    && Number(draft.approvalRevision) === revision;
  if (alreadyApproved) return { drafts, draft, changed: revisionWasMissing };
  draft.status = 'zaakceptowane';
  draft.approvedAt = now.toISOString();
  draft.approvedBy = text(input.actor, 200) || 'administrator';
  draft.approvalRevision = revision;
  draft.updatedAt = now.toISOString();
  appendHistory(draft, now.toISOString(), 'approved', `Zatwierdzono wersję ${revision}.`, input.actor);
  summarize(draft);
  return { drafts, draft, changed: true };
}

/** Anuluje tylko bieżącą, edytowalną rewizję i zachowuje pełny ślad audytowy. */
export function cancelSupplierPlanDraft(input = {}) {
  const now = nowDate(input.now);
  const drafts = array(input.drafts).map((draft) => structuredClone(draft));
  const draftIndex = drafts.findIndex((draft) => text(draft.id, 160) === text(input.draftId, 160));
  if (draftIndex < 0) fail('Nie znaleziono szkicu producenta.', 'supplier_order_not_found', 404);
  const draft = drafts[draftIndex];
  if (!isEditable(draft)) fail('Można anulować wyłącznie niewysłany szkic.', 'supplier_order_locked', 409);
  const revision = expectedRevision(input, draft);
  const timestamp = now.toISOString();
  draft.status = 'anulowane';
  draft.revision = revision + 1;
  draft.cancelledAt = timestamp;
  draft.cancelledBy = text(input.actor, 200) || 'administrator';
  draft.updatedAt = timestamp;
  draft.aktualizacja = timestamp;
  clearApproval(draft);
  appendHistory(draft, timestamp, 'cancelled', `Anulowano niewysłaną wersję ${revision}.`, input.actor);
  summarize(draft);
  return { drafts, draft, changed: true };
}

/**
 * Otwiera nową rewizję korekty po wysłaniu dokumentu. Wiadomości dostarczonej
 * do producenta nie da się usunąć, dlatego poprzednia wysyłka pozostaje w
 * niezmiennym śladzie audytowym, a bieżący dokument wraca do kontroli.
 */
export function prepareSupplierPlanCorrection(input = {}) {
  const now = nowDate(input.now);
  const drafts = array(input.drafts).map((draft) => structuredClone(draft));
  const draftIndex = drafts.findIndex((draft) => text(draft.id, 160) === text(input.draftId, 160));
  if (draftIndex < 0) fail('Nie znaleziono dokumentu producenta.', 'supplier_order_not_found', 404);
  const draft = drafts[draftIndex];
  const revision = expectedRevision(input, draft);
  if (!CORRECTABLE_STATUSES.has(statusKey(draft.status)) || !text(draft.emailSentAt, 80)) {
    fail('Korektę można utworzyć wyłącznie dla wysłanego zamówienia producenta.', 'supplier_order_not_sent', 409);
  }
  if (draftItems(draft).some((line) => receivedOf(line) > 0)) {
    fail('Nie można cofnąć wysyłki po rozpoczęciu przyjęcia dostawy. Utwórz osobny dokument korygujący.', 'supplier_order_receipt_started', 409);
  }
  const reason = text(input.reason, 500);
  if (reason.length < 3) fail('Podaj krótki powód utworzenia korekty.', 'supplier_order_correction_reason_required');
  const timestamp = now.toISOString();
  const previousSend = {
    revision,
    status: text(draft.status, 100),
    sentAt: text(draft.emailSentAt, 80),
    sentBy: text(draft.emailSentBy, 200),
    suppliers: array(draft.sentSuppliers).map((value) => text(value, 160)).filter(Boolean),
    results: array(draft.emailResults).map((result) => ({
      supplier: text(result?.supplier, 160),
      sent: !!result?.sent,
      sentAt: text(result?.sentAt, 80),
      skippedDuplicate: !!result?.skippedDuplicate,
    })),
    supersededAt: timestamp,
    supersededBy: text(input.actor, 200) || 'administrator',
    reason,
  };
  draft.supersededSends = [...array(draft.supersededSends), previousSend].slice(-50);
  draft.lastEmailSentAt = text(draft.emailSentAt, 80);
  draft.lastEmailSentBy = text(draft.emailSentBy, 200);
  draft.status = 'do sprawdzenia';
  draft.revision = revision + 1;
  draft.correctionOfRevision = revision;
  draft.correctionReason = reason;
  draft.correctionOpenedAt = timestamp;
  draft.correctionOpenedBy = text(input.actor, 200) || 'administrator';
  draft.updatedAt = timestamp;
  draft.aktualizacja = timestamp;
  for (const key of ['emailSentAt', 'emailSentBy', 'emailResults', 'sentSuppliers', 'sendLock', 'statusBeforeSend']) delete draft[key];
  clearApproval(draft);
  appendHistory(draft, timestamp, 'supplier-correction-opened', `Utworzono korektę wersji ${revision}: ${reason}`, input.actor);
  summarize(draft);
  return { drafts, draft, changed: true, previousSend };
}

/** Przyjmuje fizyczną dostawę; pełna ilość (także nadwyżka) zwiększa stan. */
export function receiveSupplierPlanLine(input = {}) {
  const now = nowDate(input.now);
  const drafts = array(input.drafts).map((draft) => structuredClone(draft));
  const settings = structuredClone(object(input.settings));
  const requestId = text(input.requestId, 240);
  if (!requestId) fail('Przyjęcie wymaga unikalnego requestId.', 'supplier_receipt_request_id_required');
  const draftIndex = drafts.findIndex((draft) => text(draft.id, 160) === text(input.draftId, 160));
  if (draftIndex < 0) fail('Nie znaleziono dokumentu producenta.', 'supplier_order_not_found', 404);
  const draft = drafts[draftIndex];
  if (!RECEIVABLE_STATUSES.has(statusKey(draft.status)) && !text(draft.emailSentAt, 80)) {
    fail('Towar można przyjąć dopiero z dokumentu wysłanego do producenta.', 'supplier_order_not_sent', 409);
  }
  const movements = array(settings.artway_ruchy_magazynowe);
  const sourceRequestId = `supplier-receipt:${requestId}`;
  const previous = movements.find((movement) => text(movement.sourceRequestId, 260) === sourceRequestId);
  if (previous) return { drafts, draft, settings, changed: false, duplicate: true, movement: previous };
  const receiptRevision = Math.max(0, Number(draft.receiptRevision) || 0);
  const expected = integer(input.expectedReceiptRevision, { field: 'expectedReceiptRevision' });
  if (expected !== receiptRevision) fail(
    'Przyjęcia tego dokumentu zmieniły się na innym urządzeniu.',
    'supplier_receipt_revision_conflict',
    409,
    { currentReceiptRevision: receiptRevision },
  );
  const probe = object(input.line || input);
  const lines = draftItems(draft).map((line) => ({ ...line }));
  const lineIndex = lines.findIndex((line) => {
    if (text(input.lineKey, 220) && supplierLineStableKey(line) === text(input.lineKey, 220)) return true;
    if (text(input.productId, 160) && text(line.produktId ?? line.productId, 160) === text(input.productId, 160)) return true;
    return supplierLineIdentifiers(probe).length > 0 && sameLine(line, probe);
  });
  if (lineIndex < 0) fail('Nie znaleziono pozycji do przyjęcia.', 'supplier_order_line_not_found', 404);
  const amount = integer(input.quantity, { min: 1, field: 'quantity' });
  const line = lines[lineIndex];
  const productId = text(line.produktId ?? line.productId, 160);
  if (!productId) fail('Pozycja nie jest połączona z kartoteką magazynową.', 'supplier_product_not_linked');
  const stock = { ...object(settings.artway_stany) };
  const before = Math.max(0, Number(stock[productId]) || 0);
  const after = before + amount;
  const received = receivedOf(line) + amount;
  const ordered = quantityOf(line);
  stock[productId] = after;
  line.przyjeto = received;
  line.przyjetaNadwyzka = Math.max(0, received - ordered);
  line.ostatniePrzyjecie = now.toISOString();
  line.statusPrzyjecia = received > ordered ? 'przyjęto z nadwyżką' : received === ordered ? 'przyjęte' : 'częściowo przyjęte';
  lines[lineIndex] = line;
  draft.pozycje = lines;
  draft.receiptRevision = receiptRevision + 1;
  draft.updatedAt = now.toISOString();
  draft.lastReceiptAt = now.toISOString();
  const allReceived = lines.length > 0 && lines.every((item) => receivedOf(item) >= quantityOf(item));
  draft.status = allReceived ? 'zrealizowane' : 'częściowo zrealizowane';
  appendHistory(draft, now.toISOString(), 'stock-receipt', `Przyjęto ${amount} szt. ${text(line.nazwa, 220)} na stan ${before} → ${after}.`, input.actor);
  summarize(draft);
  const movement = {
    id: `MAG-${crypto.createHash('sha256').update(sourceRequestId).digest('hex').slice(0, 18)}`,
    data: now.toISOString(),
    dataTxt: now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }),
    produktId: productId,
    produktNazwa: text(line.nazwa, 220),
    sku: text(line.sku || line.externalId || line.kod, 120),
    typ: 'przyjęcie',
    ilosc: amount,
    stanPrzed: before,
    stanPo: after,
    dokument: text(draft.numer || draft.id, 160),
    powod: 'Dostawa od producenta',
    operator: text(input.actor, 200) || 'administrator',
    sourceRequestId,
    supplierOrderId: text(draft.id, 160),
    supplierLineKey: supplierLineStableKey(line),
  };
  settings.artway_stany = stock;
  settings.artway_ruchy_magazynowe = [movement, ...movements].slice(0, 3000);
  return { drafts, draft, settings, changed: true, duplicate: false, movement };
}

export function supplierPlanDraftIsEditable(draft = {}) {
  return isEditable(draft);
}
