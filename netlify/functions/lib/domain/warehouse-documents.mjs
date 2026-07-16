import crypto from 'node:crypto';
import { canonicalGtin } from './product-identifiers.mjs';

const MAX_QUANTITY = 1_000_000;
const MAX_DOCUMENTS = 250;
const MAX_MOVEMENTS = 3000;

const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];
const text = (value = '', limit = 300) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const identifierKey = (value = '') => text(value, 180).toLowerCase().replace(/\s+/g, '').replace(/^(sku|ean|gtin|kod)[:#-]?/i, '');

function fail(message, code, status = 422, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  throw error;
}

function integer(value, name, min = 0, max = MAX_QUANTITY) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isSafeInteger(number) || number < min || number > max) fail(`Pole ${name} musi być liczbą całkowitą od ${min} do ${max}.`, 'warehouse_document_invalid_quantity');
  return number;
}

function documentType(value = '') {
  const type = text(value, 10).toUpperCase();
  if (!['PZ', 'WZ'].includes(type)) fail('Wybierz dokument PZ albo WZ.', 'warehouse_document_invalid_type');
  return type;
}

function documentRegistry(data = {}) {
  return array(object(data).artway_dokumenty_magazynowe).map((document) => structuredClone(document));
}

function currentStock(data = {}, productId = '') {
  const stocks = object(data.artway_stany);
  if (!Object.prototype.hasOwnProperty.call(stocks, productId) || stocks[productId] === '' || stocks[productId] == null) return null;
  const value = Number(stocks[productId]);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function warsawParts(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
}

function nextDocumentNumber(data = {}, type = 'PZ', now = new Date()) {
  const parts = warsawParts(now), period = `${parts.year}-${parts.month}`, key = `${type}:${period}`;
  const sequences = { ...object(data.artway_dokumenty_magazynowe_seq) };
  const sequence = Math.max(0, Number(sequences[key]) || 0) + 1;
  sequences[key] = sequence;
  return { number: `${type}/${parts.year}/${parts.month}/${String(sequence).padStart(4, '0')}`, sequences };
}

function productSnapshot(product = {}, data = {}) {
  const id = text(product.id ?? product.produktId, 160), meta = object(data?.artway_magazyn_produkty?.[id]);
  return {
    productId: id,
    name: text(product.nazwa || product.name || `Produkt ${id}`, 300),
    sku: text(product.sku || product.SKU, 160),
    externalId: text(product.externalId || product.EXTERNAL_ID, 160),
    ean: text(product.gtin || product.ean || product.GTIN || product.EAN || meta.kod, 40),
    producerCode: text(product.kodProducenta || product.mpn || meta.kodDostawcy, 160),
    location: text(meta.lokalizacja, 80).toUpperCase(),
    image: text(product.zdjecie || product.image, 1500),
  };
}

function productMatchesCode(product = {}, data = {}, code = '') {
  const snapshot = productSnapshot(product, data), canonical = canonicalGtin(code);
  if (canonical && canonicalGtin(snapshot.ean) === canonical) return 'EAN/GTIN';
  const wanted = identifierKey(code);
  if (!wanted) return '';
  const identifiers = [snapshot.productId, snapshot.externalId, snapshot.sku, snapshot.producerCode];
  const meta = object(data?.artway_magazyn_produkty?.[snapshot.productId]);
  identifiers.push(meta.kod, meta.kodDostawcy, meta.optimaCode, meta.supplierCode);
  return identifiers.some((value) => identifierKey(value) === wanted) ? 'kod produktu' : '';
}

function resolveProduct(products = [], data = {}, input = {}) {
  const productId = text(input.productId, 160);
  if (productId) {
    const exact = products.find((product) => text(product?.id ?? product?.produktId, 160) === productId);
    if (!exact) fail('Nie znaleziono produktu w aktualnym katalogu.', 'warehouse_document_product_not_found', 404);
    return { product: exact, matchedBy: 'ID produktu' };
  }
  const scanCode = text(input.scanCode || input.code, 180);
  if (!scanCode) fail('Wskaż produkt albo zeskanuj kod.', 'warehouse_document_product_required');
  const matches = products.map((product) => ({ product, matchedBy: productMatchesCode(product, data, scanCode) })).filter((entry) => entry.matchedBy);
  if (!matches.length) fail('Kod nie pasuje do żadnej kartoteki produktu.', 'warehouse_document_product_not_found', 404, { scanCode });
  if (matches.length > 1) fail('Kod pasuje do kilku produktów. Wybierz właściwą kartotekę ręcznie.', 'warehouse_document_product_ambiguous', 409, {
    scanCode,
    alternatives: matches.slice(0, 10).map(({ product }) => productSnapshot(product, data)),
  });
  return matches[0];
}

function requireDraft(doc = {}, expectedRevision) {
  if (!doc?.id) fail('Nie znaleziono dokumentu magazynowego.', 'warehouse_document_not_found', 404);
  if (doc.status !== 'draft') fail('Zmienić można wyłącznie dokument roboczy.', 'warehouse_document_not_editable', 409);
  const expected = Number(expectedRevision), revision = Math.max(1, Number(doc.revision) || 1);
  if (!Number.isSafeInteger(expected) || expected !== revision) fail('Dokument zmienił się na innym urządzeniu. Odśwież jego aktualną wersję.', 'warehouse_document_revision_conflict', 409, { currentRevision: revision });
  return revision;
}

function trimDocuments(documents = []) {
  const sorted = [...documents].sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')));
  const active = sorted.filter((document) => document.status === 'draft');
  if (active.length > MAX_DOCUMENTS) fail('Za dużo otwartych dokumentów magazynowych. Zamknij lub anuluj starsze szkice.', 'warehouse_document_limit', 409);
  return [...active, ...sorted.filter((document) => document.status !== 'draft').slice(0, Math.max(0, MAX_DOCUMENTS - active.length))];
}

function resultPayload(record = {}, document = null, extra = {}) {
  const data = object(record.data), documents = documentRegistry(data);
  return {
    ok: true,
    document: document ? documents.find((item) => item.id === document.id) || document : null,
    documents,
    rev: Math.max(0, Number(record.rev) || 0),
    updated_at: record.updated_at || null,
    ...extra,
  };
}

export function createWarehouseDocumentService({
  readVersioned,
  writeIfVersion,
  mergeSettings = async (data) => data,
  catalogProducts = (data) => array(data?.artway_produkty_katalog),
  now = () => new Date(),
  settingsLimit = 4 * 1024 * 1024,
  maxAttempts = 4,
} = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') throw new TypeError('Dokumenty magazynowe wymagają wersjonowanego repozytorium.');

  async function mutate(handler) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
      const record = object(version.value), data = object(record.data), timestamp = now().toISOString();
      const result = await handler({ record, data, timestamp });
      if (result.changed === false) return resultPayload(record, result.document, { duplicate: true, ...object(result.extra) });
      const nextData = result.data, size = JSON.stringify(nextData).length;
      if (size > settingsLimit) fail('Rejestr dokumentów magazynowych przekracza limit danych.', 'warehouse_document_settings_too_large', 413);
      const next = { ...record, data: nextData, rev: Math.max(0, Number(record.rev) || 0) + 1, updated_at: timestamp };
      const write = await writeIfVersion('settings', next, version);
      if (write?.modified) return resultPayload(next, result.document, object(result.extra));
    }
    fail('Magazyn zmienił się podczas zapisu. Odśwież dokument i spróbuj ponownie.', 'warehouse_document_write_conflict', 409);
  }

  async function list({ limit = 200 } = {}) {
    const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null }), record = object(version.value);
    const documents = documentRegistry(record.data).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, Math.min(MAX_DOCUMENTS, Math.max(1, Number(limit) || 200)));
    return { ok: true, documents, rev: Math.max(0, Number(record.rev) || 0), updated_at: record.updated_at || null };
  }

  async function create(body = {}, actor = 'administrator') {
    return mutate(async ({ data, timestamp }) => {
      const type = documentType(body.type), generated = nextDocumentNumber(data, type, now());
      const document = {
        id: `WD-${crypto.randomUUID()}`,
        number: generated.number,
        type,
        status: 'draft',
        warehouse: text(body.warehouse || data?.artway_magazyn_ustawienia?.nazwa || 'Magazyn główny', 160),
        reference: text(body.reference, 160),
        note: text(body.note, 500),
        lines: [],
        revision: 1,
        createdAt: timestamp,
        createdBy: text(actor, 200) || 'administrator',
        updatedAt: timestamp,
        updatedBy: text(actor, 200) || 'administrator',
        mutationIds: [],
      };
      const documents = trimDocuments([document, ...documentRegistry(data)]);
      return { changed: true, document, data: { ...data, artway_dokumenty_magazynowe: documents, artway_dokumenty_magazynowe_seq: generated.sequences }, extra: { created: true } };
    });
  }

  async function update(body = {}, actor = 'administrator') {
    return mutate(async ({ data, timestamp }) => {
      const documents = documentRegistry(data), index = documents.findIndex((document) => document.id === text(body.documentId, 160));
      const doc = documents[index], revision = requireDraft(doc, body.expectedRevision);
      doc.warehouse = text(body.warehouse || doc.warehouse || 'Magazyn główny', 160);
      doc.reference = text(body.reference, 160);
      doc.note = text(body.note, 500);
      doc.revision = revision + 1; doc.updatedAt = timestamp; doc.updatedBy = text(actor, 200) || 'administrator';
      documents[index] = doc;
      return { changed: true, document: doc, data: { ...data, artway_dokumenty_magazynowe: trimDocuments(documents) } };
    });
  }

  async function upsertLine(body = {}, actor = 'administrator') {
    return mutate(async ({ data, timestamp }) => {
      const documents = documentRegistry(data), index = documents.findIndex((document) => document.id === text(body.documentId, 160));
      const doc = documents[index], revision = requireDraft(doc, body.expectedRevision), requestId = text(body.requestId, 160);
      if (requestId && array(doc.mutationIds).includes(requestId)) return { changed: false, document: doc };
      const merged = object(await mergeSettings(data)), products = array(catalogProducts(merged));
      const { product, matchedBy } = resolveProduct(products, merged, body), snapshot = productSnapshot(product, merged);
      const lines = array(doc.lines), lineIndex = lines.findIndex((line) => line.productId === snapshot.productId), previous = lineIndex >= 0 ? lines[lineIndex] : null;
      const mode = body.mode === 'set' ? 'set' : 'increment';
      const supplied = integer(body.quantity ?? 1, 'ilość', 1);
      const quantity = mode === 'set' ? supplied : integer((Number(previous?.quantity) || 0) + supplied, 'ilość', 1);
      const location = text(body.location || previous?.location || snapshot.location, 80).toUpperCase();
      const line = {
        ...snapshot,
        ...(previous || {}),
        ...snapshot,
        lineId: previous?.lineId || `WDL-${crypto.randomUUID()}`,
        quantity,
        location,
        matchedBy,
        scanCount: Math.max(0, Number(previous?.scanCount) || 0) + (body.scanCode ? 1 : 0),
        addedAt: previous?.addedAt || timestamp,
        addedBy: previous?.addedBy || text(actor, 200) || 'administrator',
        updatedAt: timestamp,
        updatedBy: text(actor, 200) || 'administrator',
      };
      if (lineIndex >= 0) lines[lineIndex] = line; else lines.push(line);
      doc.lines = lines; doc.revision = revision + 1; doc.updatedAt = timestamp; doc.updatedBy = text(actor, 200) || 'administrator';
      doc.totalQuantity = lines.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      doc.mutationIds = [...array(doc.mutationIds), ...(requestId ? [requestId] : [])].slice(-100);
      documents[index] = doc;
      return { changed: true, document: doc, data: { ...data, artway_dokumenty_magazynowe: trimDocuments(documents) }, extra: { line, matchedBy } };
    });
  }

  async function removeLine(body = {}, actor = 'administrator') {
    return mutate(async ({ data, timestamp }) => {
      const documents = documentRegistry(data), index = documents.findIndex((document) => document.id === text(body.documentId, 160));
      const doc = documents[index], revision = requireDraft(doc, body.expectedRevision), lineId = text(body.lineId, 160), before = array(doc.lines);
      const lines = before.filter((line) => line.lineId !== lineId && (!body.productId || line.productId !== text(body.productId, 160)));
      if (lines.length === before.length) fail('Nie znaleziono pozycji dokumentu.', 'warehouse_document_line_not_found', 404);
      doc.lines = lines; doc.totalQuantity = lines.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      doc.revision = revision + 1; doc.updatedAt = timestamp; doc.updatedBy = text(actor, 200) || 'administrator'; documents[index] = doc;
      return { changed: true, document: doc, data: { ...data, artway_dokumenty_magazynowe: trimDocuments(documents) } };
    });
  }

  async function confirm(body = {}, actor = 'administrator') {
    return mutate(async ({ data, timestamp }) => {
      const documents = documentRegistry(data), index = documents.findIndex((document) => document.id === text(body.documentId, 160));
      const doc = documents[index], requestId = text(body.requestId, 160);
      if (doc?.status === 'confirmed' && requestId && doc.confirmationRequestId === requestId) return { changed: false, document: doc, extra: { stockUpdates: doc.stockUpdates || {}, movements: [] } };
      const revision = requireDraft(doc, body.expectedRevision), lines = array(doc.lines);
      if (!lines.length) fail('Dokument nie zawiera żadnej pozycji.', 'warehouse_document_empty');
      const stocks = { ...object(data.artway_stany) }, cards = { ...object(data.artway_magazyn_produkty) }, movements = [...array(data.artway_ruchy_magazynowe)];
      const stockUpdates = {}, movementIds = [], finalizedLines = [];
      for (const line of lines) {
        const productId = text(line.productId, 160), quantity = integer(line.quantity, 'ilość', 1), before = currentStock({ artway_stany: stocks }, productId);
        if (doc.type === 'WZ' && before === null) fail(`Produkt „${line.name}” nie ma monitorowanego stanu. Najpierw wykonaj PZ lub inwentaryzację.`, 'warehouse_document_untracked_stock', 409, { productId });
        if (doc.type === 'WZ' && before < quantity) fail(`Za mały stan produktu „${line.name}”: dostępne ${before}, wymagane ${quantity}.`, 'warehouse_document_insufficient_stock', 409, { productId, available: before, required: quantity });
        const base = before === null ? 0 : before, delta = doc.type === 'PZ' ? quantity : -quantity, after = integer(base + delta, 'stan po operacji');
        stocks[productId] = after; stockUpdates[productId] = after;
        const movementId = `MAG-${crypto.randomUUID()}`; movementIds.push(movementId);
        movements.unshift({
          id: movementId, data: timestamp,
          dataTxt: new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'medium' }).format(now()),
          produktId: productId, produktNazwa: text(line.name, 300), sku: text(line.sku || line.externalId, 160),
          typ: doc.type === 'PZ' ? 'przyjęcie PZ' : 'rozchód WZ', ilosc: delta, stanPrzed: before, stanPo: after,
          dokument: doc.number, powod: text(doc.reference || doc.note || (doc.type === 'PZ' ? 'Przyjęcie magazynowe' : 'Rozchód magazynowy'), 300),
          operator: text(actor, 200) || 'administrator', source: 'warehouse-document', lokalizacjaPrzed: text(cards[productId]?.lokalizacja, 80), lokalizacjaPo: text(line.location || cards[productId]?.lokalizacja, 80),
        });
        cards[productId] = { ...object(cards[productId]), ...(line.location ? { lokalizacja: text(line.location, 80) } : {}), aktualizacja: timestamp, operator: text(actor, 200) || 'administrator' };
        finalizedLines.push({ ...line, stockBefore: before, stockAfter: after, delta, confirmedAt: timestamp });
      }
      doc.lines = finalizedLines; doc.status = 'confirmed'; doc.revision = revision + 1; doc.confirmedAt = timestamp; doc.confirmedBy = text(actor, 200) || 'administrator';
      doc.updatedAt = timestamp; doc.updatedBy = doc.confirmedBy; doc.confirmationRequestId = requestId || `confirm-${crypto.randomUUID()}`; doc.movementIds = movementIds; doc.stockUpdates = stockUpdates;
      documents[index] = doc;
      return {
        changed: true, document: doc,
        data: { ...data, artway_stany: stocks, artway_magazyn_produkty: cards, artway_ruchy_magazynowe: movements.slice(0, MAX_MOVEMENTS), artway_dokumenty_magazynowe: trimDocuments(documents) },
        extra: { stockUpdates, movements: movements.slice(0, movementIds.length), confirmed: true },
      };
    });
  }

  async function cancel(body = {}, actor = 'administrator') {
    return mutate(async ({ data, timestamp }) => {
      const documents = documentRegistry(data), index = documents.findIndex((document) => document.id === text(body.documentId, 160));
      const doc = documents[index], revision = requireDraft(doc, body.expectedRevision);
      doc.status = 'cancelled'; doc.revision = revision + 1; doc.cancelledAt = timestamp; doc.cancelledBy = text(actor, 200) || 'administrator';
      doc.cancelReason = text(body.reason || 'Anulowano dokument roboczy', 300); doc.updatedAt = timestamp; doc.updatedBy = doc.cancelledBy; documents[index] = doc;
      return { changed: true, document: doc, data: { ...data, artway_dokumenty_magazynowe: trimDocuments(documents) }, extra: { cancelled: true } };
    });
  }

  return Object.freeze({ list, create, update, upsertLine, removeLine, confirm, cancel });
}
