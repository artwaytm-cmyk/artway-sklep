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
