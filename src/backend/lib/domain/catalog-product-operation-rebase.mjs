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
