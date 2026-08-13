import { isValidGtin } from './product-identifiers.mjs';

export const SOURCE_IMAGE_POLICY_VERSION = 5;

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

function samePublicHost(left, right) {
  try {
    const leftHost = new URL(text(left)).hostname.toLowerCase().replace(/^www\./, '');
    const rightHost = new URL(text(right)).hostname.toLowerCase().replace(/^www\./, '');
    return !!leftHost && leftHost === rightHost;
  } catch {
    return false;
  }
}

function legacySourceImageIdentity(pageUrl, imageUrl) {
  try {
    if (!samePublicHost(pageUrl, imageUrl)) return false;
    const page = new URL(text(pageUrl));
    const image = new URL(text(imageUrl));
    if (!/\.(?:jpe?g|png|webp)$/i.test(image.pathname)) return false;
    const productId = page.pathname.match(/product-pol-(\d+)-/i)?.[1] || '';
    return !!productId && new RegExp(`(?:^|[-_])${productId}(?:[-_.]|$)`).test(image.pathname);
  } catch {
    return false;
  }
}

function identifier(value) {
  return text(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^0+(?=\d{8,14}$)/, '');
}

function words(value) {
  return new Set(text(value, 500).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length > 1));
}

const GENERIC_SOURCE_PATH_WORDS = new Set([
  'product', 'produkt', 'pol', 'image', 'zdjecie', 'foto', 'photo',
  'alexander', 'multigra', 'milliwood', 'planszowa', 'edukacyjna',
  'drewniane', 'drewniany', 'puzzle', 'zestaw', 'zabawka',
]);

function distinctiveSourcePathOverlap(pageUrl = '', imageUrl = '') {
  try {
    const pageWords = words(decodeURIComponent(new URL(text(pageUrl)).pathname));
    const imageWords = words(decodeURIComponent(new URL(text(imageUrl)).pathname));
    return [...pageWords].filter((word) => (
      word.length >= 8
      && !GENERIC_SOURCE_PATH_WORDS.has(word)
      && imageWords.has(word)
    ));
  } catch {
    return [];
  }
}

function nameSimilarity(left, right) {
  const a = words(left), b = words(right);
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((word) => b.has(word)).length;
  return (2 * common) / (a.size + b.size);
}

function identityBoundExistingImage(product = {}, imageUrl = '') {
  let path = '';
  try {
    const url = new URL(text(imageUrl));
    if (url.protocol !== 'https:') return false;
    path = decodeURIComponent(url.pathname);
  } catch {
    return false;
  }
  const normalizedPath = identifier(path);
  const productCode = identifier(product.kodProducenta || product.mpn || product.externalId || product.sku);
  const productEan = identifier(product.gtin || product.ean);
  const identifierMatch = (productCode.length >= 4 && normalizedPath.includes(productCode))
    || (productEan.length >= 8 && normalizedPath.includes(productEan));
  if (!identifierMatch) return false;
  const productWords = words(product.nazwa || product.name);
  const imageWords = words(path);
  const sharedWords = [...productWords].filter((word) => imageWords.has(word));
  return sharedWords.length >= 2;
}

function sourceNamedExistingImage(product = {}, pageUrl = '', imageUrl = '', {
  exactIdentity = false,
} = {}) {
  try {
    if (!samePublicHost(pageUrl, imageUrl)) return false;
    const image = new URL(text(imageUrl));
    if (image.protocol !== 'https:' || !/\.(?:jpe?g|png|webp)$/i.test(image.pathname)) return false;
    const productWords = words(product.nazwa || product.name);
    const imageWords = words(decodeURIComponent(image.pathname));
    const sharedWords = [...productWords].filter((word) => imageWords.has(word));
    const manufacturerWords = words(`${product.producent || ''} ${product.marka || ''}`);
    const meaningfulSharedWords = sharedWords.filter((word) => (
      !GENERIC_SOURCE_PATH_WORDS.has(word)
      && !manufacturerWords.has(word)
    ));
    const overlap = sharedWords.length / Math.max(1, Math.min(productWords.size, imageWords.size));
    return (meaningfulSharedWords.length >= 2
        && sharedWords.length >= 3
        && (overlap >= 0.5 || sharedWords.filter((word) => word.length >= 6).length >= 3))
      || (meaningfulSharedWords.length >= 2
        && sharedWords.length >= 2
        && overlap >= 2 / 3
        && sharedWords.every((word) => word.length >= 6))
      // Przy dokładnie potwierdzonym EAN/kodzie trzy wyróżniające słowa
      // długości co najmniej 5 znaków są wystarczające także wtedy, gdy długa
      // nazwa kartoteki obniża procent podobieństwa (np. Pamięć Farma Multigra).
      || (exactIdentity
        && meaningfulSharedWords.length >= 2
        && sharedWords.length >= 3
        && sharedWords.every((word) => word.length >= 5))
      || (exactIdentity && distinctiveSourcePathOverlap(pageUrl, imageUrl).length >= 1);
  } catch {
    return false;
  }
}

function credibleSourceResponsibleProducer(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const legalName = text(value.legalName || value.name, 500);
  const wordsCount = legalName.split(/\s+/).filter(Boolean).length;
  return legalName.length > 2
    && legalName.length <= 180
    && wordsCount <= 18
    && !/(?:\*\*|#{2,}|\bEAN\b|sk[łl]ad zestawu|liczba graczy|kod produktu|https?:|dodaj do|koszyk)/i.test(legalName);
}

function directSourceImage(pageUrl = '', imageUrl = '') {
  try {
    if (!samePublicHost(pageUrl, imageUrl)) return false;
    const image = new URL(text(imageUrl));
    return image.protocol === 'https:'
      && /\.(?:jpe?g|png|webp)$/i.test(image.pathname)
      && sourcePageKey(pageUrl) !== sourcePageKey(imageUrl);
  } catch {
    return false;
  }
}

function exactLegacySourceGtin(product = {}) {
  const evidence = product.sourceEvidence && typeof product.sourceEvidence === 'object' ? product.sourceEvidence : {};
  const manufacturer = product.parametryProducenta && typeof product.parametryProducenta === 'object' ? product.parametryProducenta : {};
  const source = product.parametryZrodla && typeof product.parametryZrodla === 'object' ? product.parametryZrodla : {};
  const productGtin = identifier(product.gtin || product.ean);
  if (!isValidGtin(productGtin)) return false;
  const sourceGtins = [manufacturer.ean, manufacturer.gtin, source.ean, source.gtin]
    .map(identifier)
    .filter(isValidGtin);
  const evidenceNames = Array.isArray(evidence.fields) ? evidence.fields.map((value) => identifier(value)) : [];
  return sourceGtins.includes(productGtin)
    && (evidenceNames.includes('ean') || evidenceNames.includes('gtin'));
}

/**
 * Podnosi stare, ale nadal weryfikowalne dowody galerii bez ponownego
 * obciążania strony producenta. Migracja jest dozwolona wyłącznie dla
 * dokładnej tożsamości EAN/kodu i bezpośrednich plików obrazu z tej samej
 * domeny. Galeria spoza zapisanego dowodu jest przy okazji usuwana.
 */
export function trustedLegacySourceImageUpgrade(product = {}) {
  const evidence = product.sourceEvidence && typeof product.sourceEvidence === 'object' ? product.sourceEvidence : {};
  const version = Number(evidence.imagePolicyVersion) || 0;
  if (version < 2 || version >= SOURCE_IMAGE_POLICY_VERSION) return null;
  const pageUrl = sourcePageUrl(product);
  const evidencePage = canonicalUrl(evidence.imageSourceUrl || evidence.canonicalUrl || evidence.resolvedUrl || evidence.url);
  if (!pageUrl || !evidencePage || sourcePageKey(pageUrl) !== sourcePageKey(evidencePage)) return null;
  const strongIdentity = ['ean', 'producer_code'].includes(text(evidence.imageIdentityMode, 40))
    || exactLegacySourceGtin(product);
  if (!strongIdentity) return null;
  let images = uniqueImages(evidence.imageUrls).filter((url) => directSourceImage(pageUrl, url));
  if (!images.length && exactLegacySourceGtin(product)) {
    images = uniqueImages([product.zdjecie, product.zdjecia, product.images])
      .filter((url) => sourceNamedExistingImage(product, pageUrl, url, { exactIdentity: true }));
  }
  if (!images.length) return null;
  const upgradedAt = new Date().toISOString();
  const upgradedEvidence = {
    ...evidence,
    imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION,
    imageSourceType: 'product_source_page',
    imageSourceUrl: evidencePage,
    imageUrls: images,
    imageIdentityMode: text(evidence.imageIdentityMode, 40) || 'ean',
    imageEvidenceUpgradedAt: upgradedAt,
    imageEvidenceUpgradeMethod: 'trusted_legacy_exact_identity',
  };
  if (upgradedEvidence.responsibleProducer
    && !credibleSourceResponsibleProducer(upgradedEvidence.responsibleProducer)) {
    delete upgradedEvidence.responsibleProducer;
  }
  return {
    zdjecie: images[0],
    zdjecia: images.slice(1),
    sourceEvidence: upgradedEvidence,
  };
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
  const sourceImages = uniqueImages([inspected.zdjecie, inspected.zdjecia, inspected.images]);
  // Część oficjalnych kart producenta potwierdza EAN i kod, ale nie publikuje
  // galerii. Wtedy można zachować istniejące zdjęcie wyłącznie, gdy jego URL
  // zawiera dokładny identyfikator produktu oraz co najmniej dwa słowa nazwy.
  // To daje dowód tożsamości bez przypisywania przypadkowej grafiki z katalogu.
  const strongIdentifierMatch = ['ean', 'producer_code'].includes(identity.mode);
  const identityBoundImages = identity.ok && !sourceImages.length
    ? uniqueImages([product.zdjecie, product.zdjecia, product.images])
      .filter((url) => identityBoundExistingImage(product, url)
        // Oficjalny odczyt może potwierdzić dokładny EAN, ale chwilowo nie
        // zwrócić galerii. Wtedy bezpiecznie zachowujemy istniejący obraz
        // IdoSell tylko z tego samego hosta i z numerem dokładnie tej strony.
        || (strongIdentifierMatch && legacySourceImageIdentity(pageUrl, url))
        || (strongIdentifierMatch && sourceNamedExistingImage(product, pageUrl, url, { exactIdentity: true })))
    : [];
  const images = sourceImages.length ? sourceImages : identityBoundImages;
  if (!expectedPage || !pageUrl || !identity.ok || !images.length) return { ok: false, images: [], identity, pageUrl, expectedPage };
  const evidence = {
    ...(product.sourceEvidence && typeof product.sourceEvidence === 'object' ? product.sourceEvidence : {}),
    ...(inspected.sourceEvidence && typeof inspected.sourceEvidence === 'object' ? inspected.sourceEvidence : {}),
    imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION,
    imageSourceType: sourceImages.length ? 'product_source_page' : 'identity_bound_existing_image',
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
  const expectedPage = sourcePageUrl(product);
  if (!expectedPage) return [];
  if ((Number(evidence.imagePolicyVersion) || 0) < SOURCE_IMAGE_POLICY_VERSION) {
    // Jednorazowa migracja starszych kartotek IdoSell: numer konkretnej strony
    // produktu musi wystąpić w ścieżce grafiki na tej samej domenie.
    return uniqueImages([
      uniqueImages(evidence.imageUrls).filter((url) => sourceNamedExistingImage(product, expectedPage, url)),
      uniqueImages([product.zdjecie, product.zdjecia, product.images])
        .filter((url) => legacySourceImageIdentity(expectedPage, url)),
    ]);
  }
  const evidencePage = canonicalUrl(evidence.imageSourceUrl);
  if (!evidencePage || sourcePageKey(expectedPage) !== sourcePageKey(evidencePage)) return [];
  const recorded = uniqueImages(evidence.imageUrls);
  if (recorded.length) return recorded;
  // Reader-fallback potrafi potwierdzić właściwą stronę produktu, ale nie
  // zwrócić galerii (np. chwilowa blokada CDN producenta). Nie wolno wtedy
  // wyzerować wcześniej pobranych zdjęć z dokładnie tej samej domeny.
  if (evidence.imageSourceType !== 'product_source_page') return [];
  return uniqueImages([product.zdjecie, product.zdjecia, product.images])
    .filter((url) => samePublicHost(url, evidencePage));
}
