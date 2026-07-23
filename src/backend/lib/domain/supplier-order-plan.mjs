import crypto from 'node:crypto';
import { RECEIVABLE_STATUSES, CORRECTABLE_STATUSES, object, array, text, normalized, integer, fail, nowDate, statusKey, isEditable, supplierOf, draftItems, quantityOf, requiredOf, receivedOf, orderAllocationsOf, updateReceiptAllocations, identifierValue, sameLine, productLine, clearApproval, appendHistory, summarize, nextDraft, expectedRevision, supplierLineIdentifiers, supplierLineStableKey } from './supplier-order-plan-support.mjs';

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
  updateReceiptAllocations(line);
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

/**
 * Przyjmuje cały dokument jednym zapisem. Domyślnie przyjmuje wszystkie
 * pozostałe ilości; lista `receipts` służy wyłącznie do korekty braków,
 * dostawy częściowej albo nadwyżki.
 */
export function receiveSupplierPlanDocument(input = {}) {
  const now = nowDate(input.now);
  const drafts = array(input.drafts).map((draft) => structuredClone(draft));
  const settings = structuredClone(object(input.settings));
  const requestId = text(input.requestId, 240);
  if (!requestId) fail('Przyjęcie dokumentu wymaga unikalnego requestId.', 'supplier_receipt_request_id_required');
  const draftIndex = drafts.findIndex((draft) => text(draft.id, 160) === text(input.draftId, 160));
  if (draftIndex < 0) fail('Nie znaleziono dokumentu producenta.', 'supplier_order_not_found', 404);
  const draft = drafts[draftIndex];
  if (!RECEIVABLE_STATUSES.has(statusKey(draft.status)) && !text(draft.emailSentAt, 80)) {
    fail('Towar można przyjąć dopiero z dokumentu wysłanego do producenta.', 'supplier_order_not_sent', 409);
  }
  const previousBatch = array(draft.receiptBatches).find((batch) => text(batch.requestId, 240) === requestId);
  if (previousBatch) return { drafts, draft, settings, changed: false, duplicate: true, receiptBatch: previousBatch, movements: [] };
  const receiptRevision = Math.max(0, Number(draft.receiptRevision) || 0);
  const expected = integer(input.expectedReceiptRevision, { field: 'expectedReceiptRevision' });
  if (expected !== receiptRevision) fail(
    'Przyjęcia tego dokumentu zmieniły się na innym urządzeniu.',
    'supplier_receipt_revision_conflict',
    409,
    { currentReceiptRevision: receiptRevision },
  );

  const correctionsProvided = Array.isArray(input.receipts);
  const corrections = new Map();
  for (const raw of array(input.receipts)) {
    const key = text(raw?.lineKey, 220) || (text(raw?.productId, 160) && `product:${text(raw.productId, 160)}`);
    if (!key) fail('Korekta przyjęcia nie wskazuje pozycji dokumentu.', 'supplier_order_line_not_found');
    if (corrections.has(key)) fail('Ta sama pozycja występuje w korekcie więcej niż raz.', 'supplier_receipt_duplicate_line');
    corrections.set(key, integer(raw?.quantity, { field: 'quantity' }));
  }

  const lines = draftItems(draft).map((line) => ({ ...line }));
  if (!lines.length) fail('Dokument producenta nie ma pozycji.', 'supplier_order_empty');
  const stock = { ...object(settings.artway_stany) };
  const existingMovements = array(settings.artway_ruchy_magazynowe);
  const movements = [];
  const rows = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineKey = supplierLineStableKey(line) || `line:${index}`;
    const productKey = `product:${text(line.produktId ?? line.productId, 160)}`;
    const ordered = quantityOf(line);
    const receivedBefore = receivedOf(line);
    const remaining = Math.max(0, ordered - receivedBefore);
    const amount = correctionsProvided
      ? (corrections.has(lineKey) ? corrections.get(lineKey) : corrections.get(productKey) || 0)
      : remaining;
    if (amount <= 0) {
      rows.push({ lineKey, productId: text(line.produktId ?? line.productId, 160), ordered, receivedBefore, receivedNow: 0, remaining });
      continue;
    }
    const productId = text(line.produktId ?? line.productId, 160);
    if (!productId) fail(`Pozycja „${text(line.nazwa, 220)}” nie jest połączona z kartoteką magazynową.`, 'supplier_product_not_linked');
    const before = Math.max(0, Number(stock[productId]) || 0);
    const after = before + amount;
    const received = receivedBefore + amount;
    stock[productId] = after;
    line.przyjeto = received;
    line.przyjetaNadwyzka = Math.max(0, received - ordered);
    line.ostatniePrzyjecie = now.toISOString();
    line.statusPrzyjecia = received > ordered ? 'przyjęto z nadwyżką' : received === ordered ? 'przyjęte' : 'częściowo przyjęte';
    updateReceiptAllocations(line);
    const sourceRequestId = `supplier-document-receipt:${requestId}:${lineKey}`;
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
      powod: 'Zbiorcze przyjęcie dokumentu producenta',
      operator: text(input.actor, 200) || 'administrator',
      sourceRequestId,
      supplierOrderId: text(draft.id, 160),
      supplierLineKey: lineKey,
      receiptBatchId: requestId,
    };
    movements.push(movement);
    rows.push({ lineKey, productId, ordered, receivedBefore, receivedNow: amount, received, remaining: Math.max(0, ordered - received), overage: Math.max(0, received - ordered) });
  }

  draft.pozycje = lines;
  draft.receiptRevision = receiptRevision + 1;
  draft.updatedAt = now.toISOString();
  draft.lastReceiptAt = now.toISOString();
  const allReceived = lines.every((line) => receivedOf(line) >= quantityOf(line));
  const receivedUnits = rows.reduce((sum, row) => sum + (row.receivedNow || 0), 0);
  const missingLines = lines.filter((line) => receivedOf(line) < quantityOf(line)).length;
  draft.status = allReceived ? 'zrealizowane' : 'częściowo zrealizowane';
  const receiptBatch = {
    id: `PRZ-${crypto.createHash('sha256').update(requestId).digest('hex').slice(0, 14)}`,
    requestId,
    at: now.toISOString(),
    operator: text(input.actor, 200) || 'administrator',
    corrected: correctionsProvided,
    receivedUnits,
    lines: rows,
    missingLines,
    completed: allReceived,
  };
  draft.receiptBatches = [...array(draft.receiptBatches), receiptBatch].slice(-100);
  appendHistory(
    draft,
    now.toISOString(),
    'stock-document-receipt',
    `Przyjęto dokument: ${receivedUnits} szt. w ${movements.length} pozycjach${missingLines ? `; ${missingLines} pozycji oczekuje na dostawę` : '; dokument kompletny'}.`,
    input.actor,
  );
  summarize(draft);
  settings.artway_stany = stock;
  settings.artway_ruchy_magazynowe = [...movements.reverse(), ...existingMovements].slice(0, 3000);
  return { drafts, draft, settings, changed: true, duplicate: false, receiptBatch, movements };
}

export function supplierPlanDraftIsEditable(draft = {}) {
  return isEditable(draft);
}

export { supplierLineIdentifiers, supplierLineStableKey } from './supplier-order-plan-support.mjs';
