function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function applyCatalogProductOperations({ data = {}, products = new Map(), operations = [], createUpdater } = {}) {
  if (typeof createUpdater !== 'function') throw new Error('Brak aktualizatora katalogu produktów.');
  const grouped = new Map();
  for (const operation of Array.isArray(operations) ? operations : []) {
    const id = String(operation?.id ?? '').trim();
    if (!id) continue;
    const current = grouped.get(id) || { id, expectedProduct: operation.expectedProduct, operations: [] };
    if (current.expectedProduct === undefined && operation.expectedProduct !== undefined) current.expectedProduct = operation.expectedProduct;
    current.operations.push(operation);
    grouped.set(id, current);
  }

  const updater = createUpdater(data, products.keys());
  const skippedProductIds = [];
  let appliedOperations = 0;
  for (const group of grouped.values()) {
    const latestProduct = products.get(group.id);
    if (!latestProduct || (group.expectedProduct !== undefined && !sameValue(latestProduct, group.expectedProduct))) {
      skippedProductIds.push(group.id);
      continue;
    }
    for (const operation of group.operations) {
      if (updater.apply(group.id, operation.fields || {}, Array.isArray(operation.remove) ? operation.remove : [])) appliedOperations++;
    }
  }
  const changed = updater.commit();
  return { changed, appliedOperations, skippedProductIds };
}

export function createCatalogProductOperationWriter({ mutateLatest, loadProducts, createUpdater } = {}) {
  if (typeof mutateLatest !== 'function' || typeof loadProducts !== 'function' || typeof createUpdater !== 'function') {
    throw new Error('Writer operacji katalogowych wymaga mutatora, katalogu i aktualizatora.');
  }
  return async function writeOperations(operations = [], updatedAt = null) {
    const updates = (Array.isArray(operations) ? operations : [])
      .filter((operation) => operation && String(operation.id ?? '').trim())
      .map((operation) => ({
        id: String(operation.id),
        fields: operation.fields && typeof operation.fields === 'object' ? operation.fields : {},
        remove: Array.isArray(operation.remove) ? operation.remove : [],
        expectedProduct: operation.expectedProduct,
      }));
    if (!updates.length) return { modified: false, attempts: 0, changed: false, appliedOperations: 0, skippedProductIds: [] };
    let rebase = { changed: false, appliedOperations: 0, skippedProductIds: [] };
    const result = await mutateLatest(async (latestData) => {
      const latestProducts = await loadProducts(latestData);
      rebase = applyCatalogProductOperations({ data: latestData, products: latestProducts, operations: updates, createUpdater });
      return rebase.changed;
    }, { updatedAt });
    return { ...result, ...rebase };
  };
}

/**
 * Produkcyjny writer kartoteki. Każda operacja trafia bezpośrednio do jednego
 * rekordu produktu w PostgreSQL. Nie tworzy już kopii w settings ani w
 * localStorage. Zachowuje dotychczasowy kontrakt odpowiedzi, aby edytor cen,
 * mapowanie i Agent mogły przejść na nowe źródło bez okresu dwóch zapisów.
 */
export function createCentralCatalogProductOperationWriter({
  catalog,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maxAttempts = 3,
} = {}) {
  if (!catalog || typeof catalog.get !== 'function' || typeof catalog.patchProductFields !== 'function') {
    throw new Error('Centralny writer operacji wymaga kanonicznej kartoteki produktów.');
  }
  return async function writeCentralOperations(operations = [], updatedAt = null) {
    const grouped = new Map();
    for (const operation of Array.isArray(operations) ? operations : []) {
      const id = String(operation?.id ?? '').trim();
      if (!id) continue;
      const current = grouped.get(id) || {
        id,
        fields: {},
        remove: new Set(),
        expectedProduct: operation.expectedProduct,
        expectedFields: operation.expectedFields && typeof operation.expectedFields === 'object'
          ? operation.expectedFields
          : null,
        operationCount: 0,
      };
      if (current.expectedProduct === undefined && operation.expectedProduct !== undefined) {
        current.expectedProduct = operation.expectedProduct;
      }
      for (const [field, expectation] of Object.entries(
        operation.expectedFields && typeof operation.expectedFields === 'object'
          ? operation.expectedFields
          : {},
      )) {
        if (!current.expectedFields) current.expectedFields = {};
        if (!Object.prototype.hasOwnProperty.call(current.expectedFields, field)) {
          current.expectedFields[field] = expectation;
        }
      }
      for (const field of Array.isArray(operation.remove) ? operation.remove : []) {
        const name = String(field || '').trim();
        if (!name) continue;
        current.remove.add(name);
        delete current.fields[name];
      }
      for (const [field, value] of Object.entries(
        operation.fields && typeof operation.fields === 'object' ? operation.fields : {},
      )) {
        current.remove.delete(field);
        current.fields[field] = value;
      }
      current.operationCount += 1;
      grouped.set(id, current);
    }
    const updates = [...grouped.values()];
    if (!updates.length) {
      return {
        modified: false, attempts: 0, changed: false,
        appliedOperations: 0, skippedProductIds: [],
      };
    }
    const skippedProductIds = [];
    const publications = [];
    let appliedOperations = 0;
    let attempts = 1;
    let nextIndex = 0;
    const transientCodes = new Set(['55P03', '40P01', '40001']);
    const patchWithRetry = async (operation, mutationId, options) => {
      const limit = Math.max(1, Math.min(5, Number(maxAttempts) || 3));
      for (let attempt = 1; attempt <= limit; attempt += 1) {
        try {
          const result = await catalog.patchProductFields(operation.id, operation.fields, [...operation.remove], { mutationId, ...options });
          attempts = Math.max(attempts, attempt);
          return result;
        } catch (error) {
          const code = String(error?.code || error?.cause?.code || '').toUpperCase();
          if (!transientCodes.has(code) || attempt >= limit) throw error;
          attempts = Math.max(attempts, attempt + 1);
          await wait(75 * attempt);
        }
      }
      return null;
    };
    const worker = async () => {
      while (nextIndex < updates.length) {
        const index = nextIndex++;
        const operation = updates[index];
        const current = await catalog.get(operation.id, { admin: true });
        if (!current) {
          skippedProductIds.push(operation.id);
          continue;
        }
        const mutationId = String(
          operation.fields?.lastAdminMutationId
          || `product-operation:${operation.id}:${String(updatedAt || Date.now())}:${index}`,
        ).slice(0, 200);
        const result = await patchWithRetry(operation, mutationId, {
          actor: operation.fields?.lastAdminMutationBy || 'server',
          area: operation.fields?.lastAdminMutationArea || 'product',
          expectedFields: operation.expectedFields,
        });
        if (!result?.updated) {
          skippedProductIds.push(operation.id);
          continue;
        }
        appliedOperations += operation.operationCount;
        publications.push(result);
      }
    };
    await Promise.all(Array.from({ length: Math.min(8, updates.length) }, () => worker()));
    return {
      modified: appliedOperations > 0,
      attempts,
      changed: appliedOperations > 0,
      appliedOperations,
      skippedProductIds,
      publications,
      updated_at: updatedAt || new Date().toISOString(),
    };
  };
}
