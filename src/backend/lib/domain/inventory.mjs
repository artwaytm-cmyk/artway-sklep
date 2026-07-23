const MAX_STOCK = 1_000_000;

function inventoryError(message, code, status = 422, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function safeText(value, limit = 240) {
  return String(value ?? '').trim().slice(0, limit);
}

function locationCode(value = '') {
  return safeText(value, 80).toUpperCase()
    .replace(/[^A-Z0-9._/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function integer(value, field, { min = 0, max = MAX_STOCK } = {}) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw inventoryError(`Pole ${field} musi być liczbą całkowitą od ${min} do ${max}.`, 'inventory_invalid_number');
  }
  return number;
}

function currentStock(settings = {}, productId = '') {
  const stocks = settings.artway_stany && typeof settings.artway_stany === 'object' && !Array.isArray(settings.artway_stany)
    ? settings.artway_stany
    : {};
  if (!Object.prototype.hasOwnProperty.call(stocks, productId) || stocks[productId] === '' || stocks[productId] == null) return null;
  const value = Number(stocks[productId]);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function dateInWarsaw(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function productIdentity(raw = {}, productId = '') {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    id: productId,
    name: safeText(source.name || source.nazwa || `Produkt ${productId}`, 240),
    sku: safeText(source.sku, 120),
    externalId: safeText(source.externalId || source.external_id || source.mpn || source.kodProducenta, 120),
    ean: safeText(source.ean || source.gtin, 32),
  };
}

/**
 * Tworzy minimalną, audytowalną zmianę stanu bez zastępowania danych przygotowanych
 * przez klienta. expectedRev i expectedStock chronią Agenta przed zapisem na nieaktualnej bazie.
 */
export function applyInventoryStockSet(record = {}, input = {}, now = new Date()) {
  if (input.confirmed !== true) {
    throw inventoryError('Zmiana stanu wymaga jednoznacznego potwierdzenia administratora.', 'inventory_confirmation_required', 409);
  }

  const productId = safeText(input.productId, 120);
  if (!productId) throw inventoryError('Brakuje identyfikatora produktu.', 'inventory_product_required');

  const revision = integer(record.rev ?? 0, 'rev', { min: 0, max: Number.MAX_SAFE_INTEGER });
  if (!Object.prototype.hasOwnProperty.call(input, 'expectedRev')) {
    throw inventoryError('Brakuje oczekiwanej rewizji bazy.', 'inventory_expected_revision_required');
  }
  const expectedRev = integer(input.expectedRev, 'expectedRev', { min: 0, max: Number.MAX_SAFE_INTEGER });
  if (expectedRev !== revision) {
    throw inventoryError('Baza zmieniła się od czasu sprawdzenia produktu. Odczytaj stan ponownie.', 'inventory_revision_conflict', 409, { expectedRev, actualRev: revision });
  }

  const settings = record.data && typeof record.data === 'object' && !Array.isArray(record.data) ? record.data : {};
  const before = currentStock(settings, productId);
  if (!Object.prototype.hasOwnProperty.call(input, 'expectedStock')) {
    throw inventoryError('Brakuje oczekiwanego poprzedniego stanu.', 'inventory_expected_stock_required');
  }
  const expectedStock = input.expectedStock === null ? null : integer(input.expectedStock, 'expectedStock');
  if (expectedStock !== before) {
    throw inventoryError('Stan produktu zmienił się od czasu sprawdzenia. Odczytaj go ponownie.', 'inventory_stock_conflict', 409, { expectedStock, actualStock: before });
  }

  const mode = safeText(input.mode || 'set', 20).toLowerCase();
  if (!['set', 'increment'].includes(mode)) throw inventoryError('Nieobsługiwany tryb zmiany stanu.', 'inventory_invalid_mode');
  if (!Object.prototype.hasOwnProperty.call(input, 'quantity')) {
    throw inventoryError('Brakuje ilości do zapisania.', 'inventory_quantity_required');
  }
  const quantity = integer(input.quantity, 'quantity');
  if (mode === 'increment' && before === null) {
    throw inventoryError('Nie można dodać sztuk do produktu bez monitorowanego stanu. Najpierw ustaw konkretny stan.', 'inventory_unlimited_stock', 409);
  }
  const after = mode === 'set' ? quantity : integer(before + quantity, 'stan po zmianie');
  const delta = before === null ? after : after - before;
  const timestamp = now.toISOString();
  const product = productIdentity(input.product, productId);
  const operator = safeText(input.operator || 'administrator', 160) || 'administrator';
  const source = safeText(input.source || 'admin', 80) || 'admin';
  const sourceRequestId = safeText(input.requestId, 160);
  const reason = safeText(input.reason || 'Stan potwierdzony przez administratora', 300);
  const movementId = `MAG-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const productCards = settings.artway_magazyn_produkty && typeof settings.artway_magazyn_produkty === 'object' && !Array.isArray(settings.artway_magazyn_produkty)
    ? { ...settings.artway_magazyn_produkty }
    : {};
  const oldCard = productCards[productId] && typeof productCards[productId] === 'object' ? productCards[productId] : {};
  const locationBefore = locationCode(oldCard.lokalizacja || '');
  const hasLocation = Object.prototype.hasOwnProperty.call(input, 'location');
  const locationAfter = hasLocation ? locationCode(input.location) : locationBefore;
  if (input.requireLocation === true && !locationAfter) {
    throw inventoryError('Zmiana Agenta wymaga wskazania lokalizacji magazynowej.', 'inventory_location_required', 409);
  }
  if (input.requireLocation === true && !Object.prototype.hasOwnProperty.call(input, 'expectedLocation')) {
    throw inventoryError('Brakuje oczekiwanej poprzedniej lokalizacji.', 'inventory_expected_location_required', 409);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'expectedLocation')) {
    const expectedLocation = locationCode(input.expectedLocation || '');
    if (expectedLocation !== locationBefore) {
      throw inventoryError('Lokalizacja produktu zmieniła się od czasu przygotowania decyzji. Sprawdź produkt ponownie.', 'inventory_location_conflict', 409, { expectedLocation, actualLocation: locationBefore });
    }
  }

  const stocks = settings.artway_stany && typeof settings.artway_stany === 'object' && !Array.isArray(settings.artway_stany)
    ? { ...settings.artway_stany }
    : {};
  stocks[productId] = after;

  const movements = Array.isArray(settings.artway_ruchy_magazynowe) ? [...settings.artway_ruchy_magazynowe] : [];
  movements.unshift({
    id: movementId,
    data: timestamp,
    dataTxt: new Intl.DateTimeFormat('pl-PL', {
      timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'medium',
    }).format(now),
    produktId: productId,
    produktNazwa: product.name,
    sku: product.sku || product.externalId,
    typ: input.confirmInventory === true ? 'inwentaryzacja' : (mode === 'increment' ? 'przyjęcie' : 'korekta'),
    ilosc: delta,
    stanPrzed: before,
    stanPo: after,
    dokument: safeText(input.document, 160),
    powod: reason,
    operator,
    source,
    lokalizacjaPrzed: locationBefore,
    lokalizacjaPo: locationAfter,
    ...(sourceRequestId ? { sourceRequestId } : {}),
  });

  productCards[productId] = {
    ...oldCard,
    ...(hasLocation || input.requireLocation === true ? { lokalizacja: locationAfter } : {}),
    ...(input.confirmInventory === true ? { ostatniaInwentaryzacja: dateInWarsaw(now) } : {}),
    aktualizacja: timestamp,
    operator,
  };

  const nextSettings = {
    ...settings,
    artway_stany: stocks,
    artway_ruchy_magazynowe: movements.slice(0, 3000),
    artway_magazyn_produkty: productCards,
  };
  const nextRecord = { ...record, data: nextSettings, rev: revision + 1, updated_at: timestamp };

  return {
    record: nextRecord,
    result: {
      product,
      before,
      after,
      delta,
      locationBefore,
      locationAfter,
      changed: before !== after,
      confirmedAt: input.confirmInventory === true ? timestamp : null,
      movementId,
      rev: nextRecord.rev,
      updated_at: timestamp,
    },
  };
}
