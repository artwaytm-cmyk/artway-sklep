const text = (value, max = 300) => String(value ?? '').trim().slice(0, max);

function key(value = '') {
  return text(value, 500).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

let directoryCache = { expiresAt: 0, items: [] };
export async function allegroResponsibleProducerDirectory(call, timestamp = Date.now()) {
  if (typeof call !== 'function') throw new TypeError('Brak klienta API Allegro.');
  if (directoryCache.expiresAt > timestamp) return directoryCache.items;
  const raw = await call('/sale/responsible-producers', { parameters: { limit: 1000, offset: 0 } });
  const items = (Array.isArray(raw?.responsibleProducers) ? raw.responsibleProducers : []).map((item) => ({
    id: text(item?.id, 120), name: text(item?.name, 200), tradeName: text(item?.producerData?.tradeName, 200),
  })).filter((item) => item.id);
  directoryCache = { expiresAt: timestamp + 15 * 60_000, items };
  return items;
}

export function allegroSelectResponsibleProducer(product = {}, producers = []) {
  const targets = [...new Set([
    product.producent, product.marka, product.manufacturer, product.brand,
  ].map(key).filter(Boolean))];
  if (!targets.length) return null;
  const candidates = (Array.isArray(producers) ? producers : []).map((producer) => {
    const names = [...new Set([producer?.name, producer?.tradeName, producer?.producerData?.tradeName].map(key).filter(Boolean))];
    let score = 0;
    for (const target of targets) for (const name of names) {
      if (target === name) score = Math.max(score, 100);
      else if (target.length >= 4 && name.length >= 4 && (target.includes(name) || name.includes(target))) score = Math.max(score, 92);
    }
    return { producer, score };
  }).filter((item) => text(item.producer?.id, 120) && item.score >= 92).sort((left, right) => right.score - left.score);
  if (!candidates.length || (candidates[1] && candidates[1].score === candidates[0].score)) return null;
  return {
    id: text(candidates[0].producer.id, 120),
    name: text(candidates[0].producer.name || candidates[0].producer.tradeName, 200),
    score: candidates[0].score,
  };
}

export function allegroBuildContentProductSet({ draftItem = {}, existingItem = {}, responsibleProducer = null } = {}) {
  const productId = text(draftItem?.product?.id || existingItem?.product?.id, 120);
  if (!productId) return [];
  const output = { product: { id: productId } };
  if (existingItem?.quantity && typeof existingItem.quantity === 'object') output.quantity = structuredClone(existingItem.quantity);
  const responsibleProducerId = text(existingItem?.responsibleProducer?.id || responsibleProducer?.id, 120);
  if (responsibleProducerId) output.responsibleProducer = { type: 'ID', id: responsibleProducerId };
  if (existingItem?.responsiblePerson?.id) output.responsiblePerson = { id: text(existingItem.responsiblePerson.id, 120) };
  if (existingItem?.safetyInformation && typeof existingItem.safetyInformation === 'object') output.safetyInformation = structuredClone(existingItem.safetyInformation);
  if (typeof existingItem?.marketedBeforeGPSRObligation === 'boolean') output.marketedBeforeGPSRObligation = existingItem.marketedBeforeGPSRObligation;
  if (Array.isArray(existingItem?.deposits)) output.deposits = structuredClone(existingItem.deposits);
  return [output];
}

export function allegroCatalogParametersForPatch(parameters = []) {
  return (Array.isArray(parameters) ? parameters : []).map((parameter) => {
    const out = { id: text(parameter?.id, 80) };
    if (Array.isArray(parameter?.values) && parameter.values.length) out.values = parameter.values.map((value) => text(value, 500));
    if (Array.isArray(parameter?.valuesIds) && parameter.valuesIds.length) out.valuesIds = parameter.valuesIds.map((value) => text(value, 120));
    if (parameter?.rangeValue && typeof parameter.rangeValue === 'object') out.rangeValue = structuredClone(parameter.rangeValue);
    return out;
  }).filter((parameter) => parameter.id && (parameter.values?.length || parameter.valuesIds?.length || parameter.rangeValue));
}

export async function allegroSyncEditorialOffer({
  offerId = '', prepared = {}, product = {}, responsibleProducers = null,
  loadResponsibleProducers = async () => [], patchFromDraft, writePatch, waitForOperation = async () => {},
} = {}) {
  if (typeof patchFromDraft !== 'function' || typeof writePatch !== 'function') throw new TypeError('Brak obsługi zapisu oferty Allegro.');
  const existingOffer = prepared?.existingOffer?.offer || {}, existingSetItem = existingOffer?.productSet?.[0] || {};
  const existingProductId = text(existingOffer.productId || existingSetItem?.product?.id, 120);
  const foundCatalogProductId = text(prepared?.catalogMatch?.selected?.id, 120);
  const explicitlyLinked = text(product.allegroOfferId, 100) === text(offerId, 100);
  if (existingProductId && foundCatalogProductId && existingProductId !== foundCatalogProductId && !explicitlyLinked) {
    return { skipped: 'catalog_identity_conflict', responsibleProducers, gpsrMatched: false, categoryRepaired: false };
  }
  let responsibleProducer = existingSetItem?.responsibleProducer?.id ? { id: existingSetItem.responsibleProducer.id } : null;
  let directory = responsibleProducers, gpsrMatched = false;
  if (!responsibleProducer) {
    const target = { ...product, producent: prepared?.autoFilled?.producent || product.producent, marka: prepared?.autoFilled?.marka || product.marka };
    const catalogDirectory = (prepared?.catalogMatch?.selected?.productSafety?.responsibleProducers || []).map((item) => ({ id: item?.id, name: item?.name, tradeName: item?.producerData?.tradeName }));
    responsibleProducer = allegroSelectResponsibleProducer(target, catalogDirectory);
    if (!responsibleProducer) {
      if (directory === null) directory = await loadResponsibleProducers().catch(() => []);
      responsibleProducer = allegroSelectResponsibleProducer(target, directory);
    }
    gpsrMatched = !!responsibleProducer;
  }
  const catalogProductId = text(prepared?.payload?.productSet?.[0]?.product?.id, 120);
  const exactExistingProduct = catalogProductId && catalogProductId === existingProductId;
  const preparedCategoryId = text(prepared?.payload?.category?.id, 80);
  const categoryRepair = !!(exactExistingProduct && preparedCategoryId && preparedCategoryId !== text(existingOffer.categoryId, 80));
  const patch = patchFromDraft(prepared.payload, { publicationAction: 'keep', contentOnly: true, includeCatalogProduct: true, repairCatalogCategory: categoryRepair });
  patch.productSet = allegroBuildContentProductSet({ draftItem: prepared?.payload?.productSet?.[0], existingItem: existingSetItem, responsibleProducer });
  if (categoryRepair && patch.productSet[0]?.product) patch.productSet[0].product.parameters = allegroCatalogParametersForPatch(prepared?.catalogMatch?.selected?.parameters);
  let meta;
  try {
    meta = await writePatch(patch);
  } catch (error) {
    const catalogValidation = /InvalidParameterIdsInCategory|DependencyValidator|DataIntegrity/i.test(text(error?.message || error, 1000));
    if (!categoryRepair && catalogValidation && existingSetItem?.responsibleProducer?.id) {
      meta = await writePatch(patchFromDraft(prepared.payload, { publicationAction: 'keep', contentOnly: true }));
    } else throw error;
  }
  await waitForOperation(meta?.location || '');
  return { meta, skipped: '', responsibleProducers: directory, gpsrMatched, categoryRepaired: categoryRepair };
}
