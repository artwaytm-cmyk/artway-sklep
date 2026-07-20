const MAX_AUDIT = 500;

const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];
const text = (value = '', limit = 300) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const code = (value = '') => text(value, 100).toUpperCase().replace(/\s+/g, '-');

function fail(message, errorCode, status = 422, details = {}) {
  const error = new Error(message);
  error.code = errorCode;
  error.status = status;
  error.details = details;
  throw error;
}

function locationList(data = {}) {
  return array(object(data).artway_magazyn_lokalizacje).map((location) => structuredClone(location));
}

function subtreeCodes(locations = [], rootCode = '') {
  const root = code(rootCode), result = new Set(root ? [root] : []);
  let changed = true, guard = 0;
  while (changed && guard++ < locations.length + 2) {
    changed = false;
    for (const location of locations) {
      const own = code(location?.kod), parent = code(location?.parentKod);
      if (own && parent && result.has(parent) && !result.has(own)) { result.add(own); changed = true; }
    }
  }
  return result;
}

function impactOf(data = {}, rootCode = '') {
  const locations = locationList(data), root = code(rootCode), location = locations.find((item) => code(item?.kod) === root);
  if (!location) fail('Nie znaleziono wskazanej lokalizacji.', 'warehouse_location_not_found', 404);
  const subtree = subtreeCodes(locations, root), cards = object(data.artway_magazyn_produkty), documents = array(data.artway_dokumenty_magazynowe);
  const products = Object.entries(cards).filter(([, card]) => subtree.has(code(card?.lokalizacja))).map(([productId, card]) => ({ productId, location: code(card?.lokalizacja) }));
  const draftLines = [];
  const historicalLines = [];
  for (const document of documents) {
    for (const line of array(document?.lines)) {
      if (!subtree.has(code(line?.location))) continue;
      const row = { documentId: text(document.id, 160), number: text(document.number, 80), lineId: text(line.lineId, 160), productId: text(line.productId, 160), location: code(line.location) };
      if (document.status === 'draft') draftLines.push(row); else historicalLines.push(row);
    }
  }
  const targets = locations.filter((item) => item?.aktywna !== false && item?.typ === 'półka' && !subtree.has(code(item?.kod))).map((item) => ({
    kod: code(item.kod), nazwa: text(item.nazwa, 160), parentKod: code(item.parentKod), strefa: text(item.strefa, 100),
  }));
  return {
    location: structuredClone(location), subtree: [...subtree], descendants: Math.max(0, subtree.size - 1),
    products, draftLines, historicalLines, targets,
  };
}

function publicImpact(impact = {}) {
  return {
    location: impact.location,
    subtree: impact.subtree,
    descendants: impact.descendants,
    affectedProducts: impact.products.length,
    affectedDraftLines: impact.draftLines.length,
    historicalReferences: impact.historicalLines.length,
    targets: impact.targets,
    directDelete: impact.descendants === 0 && impact.products.length === 0 && impact.draftLines.length === 0,
  };
}

export function createWarehouseLocationService({ readVersioned, writeIfVersion, now = () => new Date(), maxAttempts = 4 } = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') throw new TypeError('Lokalizacje magazynowe wymagają wersjonowanego repozytorium.');

  async function preview(body = {}) {
    const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null }), record = object(version.value);
    return { ok: true, ...publicImpact(impactOf(record.data, body.code)), rev: Math.max(0, Number(record.rev) || 0), updated_at: record.updated_at || null };
  }

  async function remove(body = {}, actor = 'administrator') {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null }), record = object(version.value), data = object(record.data);
      const impact = impactOf(data, body.code), root = code(body.code), removeDescendants = body.includeDescendants === true;
      if (impact.descendants && !removeDescendants) fail(`Lokalizacja ${root} zawiera ${impact.descendants} elementów. Potwierdź usunięcie całej gałęzi.`, 'warehouse_location_has_children', 409, publicImpact(impact));
      const target = code(body.targetLocation), clearAssignments = body.clearAssignments === true;
      const affected = impact.products.length + impact.draftLines.length;
      if (affected && !target && !clearAssignments) fail('Wybierz półkę docelową albo pozostaw produkty bez lokalizacji.', 'warehouse_location_assignment_decision_required', 409, publicImpact(impact));
      if (target && !impact.targets.some((item) => item.kod === target)) fail('Wybrana półka docelowa nie istnieje, jest nieaktywna albo należy do usuwanej gałęzi.', 'warehouse_location_target_invalid', 409, publicImpact(impact));

      const removed = new Set(removeDescendants ? impact.subtree : [root]), timestamp = now().toISOString();
      const locations = locationList(data).filter((item) => !removed.has(code(item?.kod)));
      const cards = { ...object(data.artway_magazyn_produkty) };
      let movedProducts = 0;
      for (const [productId, card] of Object.entries(cards)) {
        if (!removed.has(code(card?.lokalizacja))) continue;
        cards[productId] = { ...object(card), lokalizacja: target || '', aktualizacja: timestamp, operator: text(actor, 200) || 'administrator' };
        movedProducts++;
      }
      let movedDraftLines = 0;
      const documents = array(data.artway_dokumenty_magazynowe).map((document) => {
        if (document?.status !== 'draft') return document;
        let changed = false;
        const lines = array(document.lines).map((line) => {
          if (!removed.has(code(line?.location))) return line;
          changed = true; movedDraftLines++;
          return { ...line, location: target || '', updatedAt: timestamp, updatedBy: text(actor, 200) || 'administrator' };
        });
        return changed ? { ...document, lines, revision: Math.max(1, Number(document.revision) || 1) + 1, updatedAt: timestamp, updatedBy: text(actor, 200) || 'administrator' } : document;
      });
      const audit = [{
        id: `WLD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, rootCode: root, removedCodes: [...removed],
        removedLocations: locationList(data).filter((item) => removed.has(code(item?.kod))), targetLocation: target || '',
        assignmentMode: target ? 'move' : affected ? 'clear' : 'empty', movedProducts, movedDraftLines,
        historicalReferencesPreserved: impact.historicalLines.length, deletedAt: timestamp, deletedBy: text(actor, 200) || 'administrator',
      }, ...array(data.artway_magazyn_lokalizacje_usuniete)].slice(0, MAX_AUDIT);
      const nextData = {
        ...data,
        artway_magazyn_lokalizacje: locations,
        artway_magazyn_produkty: cards,
        artway_dokumenty_magazynowe: documents,
        artway_magazyn_lokalizacje_usuniete: audit,
      };
      const next = { ...record, data: nextData, rev: Math.max(0, Number(record.rev) || 0) + 1, updated_at: timestamp };
      const write = await writeIfVersion('settings', next, version);
      if (write?.modified) return {
        ok: true, deleted: true, rootCode: root, removedCodes: [...removed], movedProducts, movedDraftLines,
        historicalReferencesPreserved: impact.historicalLines.length, targetLocation: target || '', locations, warehouseProducts: cards,
        warehouseDocuments: documents, rev: next.rev, updated_at: timestamp,
      };
    }
    fail('Lokalizacje zmieniły się podczas zapisu. Odśwież widok i spróbuj ponownie.', 'warehouse_location_write_conflict', 409);
  }

  return Object.freeze({ preview, remove });
}
