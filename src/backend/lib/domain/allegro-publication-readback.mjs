import { scoreAllegroProductMapping } from './allegro-product-mapping.mjs';
import { canonicalGtin } from './product-identifiers.mjs';

const clean = (value = '', limit = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const key = (value = '') => clean(value, 500).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function evaluateAllegroPublicationReadback({ task = {}, product = {}, products = [], offer = {} } = {}) {
  const productId = clean(task.productId || product.id, 100);
  const offerId = clean(offer.id || task.targetId || task.result?.offerId || product.allegroOfferId, 120);
  if (!productId || !offerId || !offer?.id) {
    return { confirmed: false, offerId, reason: 'Brak pewnego ID oferty albo świeżego odczytu tej oferty z Allegro.' };
  }
  const remoteStatus = clean(offer.status || offer.publication?.status, 80).toUpperCase();
  const expectedStatus = clean(task.result?.expectedStatus || (task.operation === 'activate' ? 'ACTIVE' : task.operation === 'draft' ? 'INACTIVE' : ''), 80).toUpperCase();
  const statusConfirmed = expectedStatus ? remoteStatus === expectedStatus : ['ACTIVE', 'INACTIVE'].includes(remoteStatus);
  const ean = canonicalGtin(product.gtin || product.ean || '');
  const external = key(product.externalId || product.sku || '');
  const rows = products instanceof Map ? [...products.values()] : (Array.isArray(products) ? products : []);
  const candidates = rows.filter((candidate) => {
    if (String(candidate?.allegroOfferId || '') === offerId) return true;
    const candidateEan = canonicalGtin(candidate?.gtin || candidate?.ean || '');
    const candidateExternal = key(candidate?.externalId || candidate?.sku || '');
    return Boolean(ean && external && candidateEan === ean && candidateExternal === external);
  }).map((candidate) => ({
    product: candidate,
    validation: scoreAllegroProductMapping(candidate, offer),
    exactName: key(candidate?.nazwa || candidate?.name) === key(offer?.name || offer?.offerName),
  })).filter((entry) => entry.validation.valid)
    .sort((left, right) => Number(right.exactName) - Number(left.exactName)
      || Number(right.validation.similarity) - Number(left.validation.similarity)
      || Number(right.validation.score) - Number(left.validation.score));
  const best = candidates[0], second = candidates[1];
  const uniqueWinner = !!best && String(best.product?.id || '') === productId && (
    candidates.length === 1
    || best.exactName === true
    || Number(best.validation.similarity) - Number(second?.validation?.similarity || 0) >= 10
  );
  const validation = scoreAllegroProductMapping(product, offer);
  if (!uniqueWinner) {
    return {
      confirmed: false,
      offerId,
      status: remoteStatus,
      errorCode: 'allegro_catalog_identity_conflict',
      reason: `Oferta ${offerId} pasuje do więcej niż jednej kartoteki. Najlepsze dopasowanie: ${clean(best?.product?.nazwa || best?.product?.name || 'nieustalone', 250)}. Agent zatrzymał automatyczne ponowienie, aby nie utworzyć duplikatu.`,
      identity: validation,
      selectedProductId: clean(best?.product?.id, 100),
    };
  }
  if (!statusConfirmed || !validation.valid || validation.score < 88) {
    return {
      confirmed: false,
      offerId,
      status: remoteStatus,
      reason: statusConfirmed ? 'Tożsamość oferty nie została potwierdzona.' : `Odczytany status ${remoteStatus || 'brak'} nie odpowiada oczekiwanemu ${expectedStatus || 'stanowi końcowemu'}.`,
      identity: validation,
    };
  }
  return { confirmed: true, offerId, status: remoteStatus, identity: validation, selectedProductId: productId };
}
