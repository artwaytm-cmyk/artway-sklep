export const SOURCE_IMAGE_POLICY_VERSION = 2;

function text(value, max = 3000) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function uniqueImages(values = []) {
  return [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => text(typeof value === 'object' ? value?.url : value))
    .filter((value) => /^https?:\/\/\S+$/i.test(value)))].slice(0, 16);
}

function canonicalUrl(value) {
  try {
    const url = new URL(text(value));
    url.hash = '';
    ['query_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach((key) => url.searchParams.delete(key));
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function sourcePageKey(value) {
  try {
    const url = new URL(canonicalUrl(value));
    return `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  } catch {
    return '';
  }
}

function identifier(value) {
  return text(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^0+(?=\d{8,14}$)/, '');
}

function words(value) {
  return new Set(text(value, 500).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length > 1));
}

function nameSimilarity(left, right) {
  const a = words(left), b = words(right);
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((word) => b.has(word)).length;
  return (2 * common) / (a.size + b.size);
}

export function sourcePageUrl(product = {}) {
  return canonicalUrl(product.sourceUrl || product.producentUrl || product.agentImportUrl || product?.sourceEvidence?.canonicalUrl || product?.sourceEvidence?.url);
}

export function sourceProductIdentity(product = {}, inspectedProduct = {}) {
  const productEan = identifier(product.gtin || product.ean), inspectedEan = identifier(inspectedProduct.gtin || inspectedProduct.ean);
  if (productEan && inspectedEan) return { ok: productEan === inspectedEan, mode: productEan === inspectedEan ? 'ean' : 'ean_conflict' };
  const productCode = identifier(product.kodProducenta || product.mpn || product.externalId || product.sku);
  const inspectedCode = identifier(inspectedProduct.kodProducenta || inspectedProduct.mpn || inspectedProduct.externalId || inspectedProduct.sku);
  if (productCode && inspectedCode && productCode === inspectedCode) return { ok: true, mode: 'producer_code' };
  const similarity = nameSimilarity(product.nazwa || product.name, inspectedProduct.nazwa || inspectedProduct.name);
  return { ok: similarity >= 0.58, mode: similarity >= 0.58 ? 'name' : 'identity_unconfirmed', similarity: Number(similarity.toFixed(3)) };
}

export function inspectedSourceImages(product = {}, inspection = {}) {
  const inspected = inspection.product && typeof inspection.product === 'object' ? inspection.product : inspection;
  if (inspection.fromCache === true && (Number(inspected?.sourceEvidence?.imagePolicyVersion) || 0) < SOURCE_IMAGE_POLICY_VERSION) {
    return { ok: false, images: [], identity: { ok: false, mode: 'legacy_cache_rejected' }, pageUrl: '', expectedPage: sourcePageUrl(product) };
  }
  const pageUrl = canonicalUrl(inspection.canonicalUrl || inspection.resolvedUrl || inspected.sourceUrl || inspected.producentUrl);
  const expectedPage = sourcePageUrl(product);
  const identity = sourceProductIdentity(product, inspected);
  const images = uniqueImages([inspected.zdjecie, inspected.zdjecia, inspected.images]);
  if (!expectedPage || !pageUrl || !identity.ok || !images.length) return { ok: false, images: [], identity, pageUrl, expectedPage };
  const evidence = {
    ...(product.sourceEvidence && typeof product.sourceEvidence === 'object' ? product.sourceEvidence : {}),
    ...(inspected.sourceEvidence && typeof inspected.sourceEvidence === 'object' ? inspected.sourceEvidence : {}),
    imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION,
    imageSourceType: 'product_source_page',
    imageSourceUrl: pageUrl,
    imageUrls: images,
    imageIdentityMode: identity.mode,
    imagesFetchedAt: inspected.producentSprawdzonoAt || inspected?.sourceEvidence?.fetchedAt || new Date().toISOString(),
  };
  return {
    ok: true,
    images,
    identity,
    pageUrl,
    expectedPage,
    patch: { zdjecie: images[0], zdjecia: images.slice(1), sourceEvidence: evidence },
  };
}

export function verifiedSourceImages(product = {}) {
  const evidence = product.sourceEvidence && typeof product.sourceEvidence === 'object' ? product.sourceEvidence : {};
  if ((Number(evidence.imagePolicyVersion) || 0) < SOURCE_IMAGE_POLICY_VERSION) return [];
  const expectedPage = sourcePageUrl(product), evidencePage = canonicalUrl(evidence.imageSourceUrl);
  if (!expectedPage || !evidencePage || sourcePageKey(expectedPage) !== sourcePageKey(evidencePage)) return [];
  return uniqueImages(evidence.imageUrls);
}
