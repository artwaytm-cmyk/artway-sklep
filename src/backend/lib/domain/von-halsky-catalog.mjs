import { vonHalskyPublicApiConfig } from './von-halsky-api-client.mjs';
import { sourcePageUrl, verifiedSourceImages } from './source-product-images.mjs';

function text(value, max = 240) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function integer(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export function vonHalskyDefaultSettings() {
  return {
    integrationMethod: 'api',
    integrator: '',
    channelAlias: 'VH',
    merchantStoreName: 'Artway-TM',
    notificationEmail: '',
    minimumStock: 1,
    maximumStock: 25,
    syncIntervalMinutes: 15,
    automaticPriceSync: true,
    automaticStockSync: true,
    automaticResume: true,
    catalogAutomationEnabled: false,
    testOfferCode: '1410',
    customerZone: true,
    onboarding: {
      merchantAccount: false,
      merchantProfile: false,
      paymentKyc: false,
      technicalDocs: false,
      catalogConnection: false,
    },
    updatedAt: null,
  };
}

export function normalizeVonHalskySettings(raw = {}, previous = {}) {
  const defaults = vonHalskyDefaultSettings();
  const onboardingRaw = raw.onboarding && typeof raw.onboarding === 'object' ? raw.onboarding : {};
  const onboardingPrevious = previous.onboarding && typeof previous.onboarding === 'object' ? previous.onboarding : {};
  const maximumStock = integer(raw.maximumStock, integer(previous.maximumStock, defaults.maximumStock, 1, 99999), 1, 99999);
  const minimumStock = Math.min(maximumStock, integer(raw.minimumStock, integer(previous.minimumStock, defaults.minimumStock, 0, 99999), 0, 99999));
  const onboarding = Object.fromEntries(Object.keys(defaults.onboarding).map((key) => [
    key,
    typeof onboardingRaw[key] === 'boolean' ? onboardingRaw[key] : onboardingPrevious[key] === true,
  ]));
  return {
    integrationMethod: 'api',
    integrator: '',
    channelAlias: (text(raw.channelAlias ?? previous.channelAlias ?? defaults.channelAlias, 20).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'VH').slice(0, 2),
    merchantStoreName: text(raw.merchantStoreName ?? previous.merchantStoreName ?? defaults.merchantStoreName, 120),
    notificationEmail: text(raw.notificationEmail ?? previous.notificationEmail, 200).toLowerCase(),
    minimumStock,
    maximumStock,
    syncIntervalMinutes: integer(raw.syncIntervalMinutes, integer(previous.syncIntervalMinutes, defaults.syncIntervalMinutes, 15, 1440), 15, 1440),
    automaticPriceSync: typeof raw.automaticPriceSync === 'boolean' ? raw.automaticPriceSync : previous.automaticPriceSync !== false,
    automaticStockSync: typeof raw.automaticStockSync === 'boolean' ? raw.automaticStockSync : previous.automaticStockSync !== false,
    automaticResume: typeof raw.automaticResume === 'boolean' ? raw.automaticResume : previous.automaticResume !== false,
    catalogAutomationEnabled: typeof raw.catalogAutomationEnabled === 'boolean' ? raw.catalogAutomationEnabled : previous.catalogAutomationEnabled === true,
    testOfferCode: text(raw.testOfferCode ?? previous.testOfferCode ?? defaults.testOfferCode, 120),
    customerZone: typeof raw.customerZone === 'boolean' ? raw.customerZone : previous.customerZone !== false,
    onboarding,
    updatedAt: new Date().toISOString(),
  };
}

function gtinChecksum(digits = '') {
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) return false;
  const payload = digits.slice(0, -1).split('').reverse();
  const sum = payload.reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

function canonicalGtin(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return gtinChecksum(digits) ? digits : '';
}

function descriptionPlain(value, max = 20_000) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, max);
}

export function vonHalskyProductPresentation(product = {}) {
  const custom = String(product.vonHalskyContentMode || '').toLowerCase() === 'custom';
  const storeName = String(product.nazwa || product.name || '').trim();
  const storeShort = String(product.opisKrotki || product.krotkiOpis || product.shortDescription || '').trim();
  const storeLong = String(product.opis || product.dlugiOpis || product.description || '').trim();
  const name = String(custom ? product.vonHalskyTitle || storeName : storeName).trim();
  const shortDescription = String(custom ? product.vonHalskyShortDescription || storeShort : storeShort).trim();
  const longDescription = String(custom ? product.vonHalskyDescription || storeLong : storeLong).trim();
  const shortPlain = descriptionPlain(shortDescription, 2_000);
  const longPlain = descriptionPlain(longDescription, 20_000);
  const description = [shortPlain, longPlain]
    .filter((value, index, list) => value && (index === 0 || value !== list[0]))
    .join('\n\n');
  return {
    mode: custom ? 'custom' : 'store',
    source: custom ? 'von_halsky_override_with_store_fallback' : 'store_canonical_content',
    name: text(name, 200),
    shortDescription: shortPlain,
    description,
    rawDescription: [shortDescription, longDescription].filter(Boolean).join('\n\n').slice(0, 50_000),
  };
}

function descriptionSource(product = {}) {
  return vonHalskyProductPresentation(product).rawDescription;
}

function descriptionText(product = {}) {
  return vonHalskyProductPresentation(product).description;
}

function productImages(product = {}) {
  if (sourcePageUrl(product)) return verifiedSourceImages(product);
  const values = [
    ...(Array.isArray(product.zdjecia) ? product.zdjecia : []),
    ...(Array.isArray(product.images) ? product.images : []),
    product.zdjecie,
    product.image,
    product.imageUrl,
  ];
  return [...new Set(values.map((item) => text(typeof item === 'object' ? item?.url : item, 2000)).filter(Boolean))];
}

function uuid(value) {
  const normalized = text(value, 80).toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized) ? normalized : '';
}

function absoluteImageUrl(value, origin = 'https://artwaytm.pl') {
  try {
    const url = new URL(text(value, 2000), origin);
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

function fileNameFromUrl(value, index) {
  try {
    const raw = decodeURIComponent(new URL(value).pathname.split('/').filter(Boolean).at(-1) || '');
    const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 480);
    if (cleaned.length >= 5) return cleaned;
  } catch { /* nazwa zastępcza poniżej */ }
  return `artway-product-${index + 1}.jpg`;
}

function vonHalskyAttributeValues(product = {}) {
  const source = product.vonHalskyAttributes && typeof product.vonHalskyAttributes === 'object'
    ? product.vonHalskyAttributes
    : {};
  return Object.entries(source).flatMap(([id, raw]) => {
    const attributeId = uuid(id);
    if (!attributeId) return [];
    const values = (Array.isArray(raw) ? raw : [raw]).map((value) => text(value, 1024)).filter(Boolean);
    return values.length ? [{ id: attributeId, lang: 'pl', values }] : [];
  });
}

export function vonHalskyEffectivePrice(product = {}) {
  for (const candidate of [product.cenaVonHalsky, product.vonHalskyPrice, product.cenaAllegro, product.allegroPrice, product.cena, product.price]) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export function vonHalskyProductReadiness(product = {}) {
  const presentation = vonHalskyProductPresentation(product);
  const name = presentation.name;
  const rawDescription = descriptionSource(product);
  const description = descriptionText(product);
  const ean = canonicalGtin(product.gtin || product.ean || product.EAN);
  const manufacturerCode = text(product.kodProducenta || product.mpn || product.externalId || product.sku, 120);
  const brand = text(product.marka || product.producent, 120);
  const images = productImages(product);
  const price = vonHalskyEffectivePrice(product);
  const categoryId = uuid(product.vonHalskyCategoryId || product.inpostVonHalskyCategoryId);
  const issues = [];
  const warnings = [];
  if (name.length < 7 || name.length > 150) issues.push('Nazwa musi mieć 7–150 znaków');
  if (description.length < 100) issues.push('Opis musi mieć co najmniej 100 znaków');
  if (/https?:\/\/|www\.|<a\b/i.test(rawDescription)) issues.push('Opis nie może zawierać linków');
  if (/<img\b/i.test(rawDescription)) issues.push('Opis nie może zawierać osadzonych zdjęć');
  if (!ean && !(manufacturerCode && brand)) issues.push('Wymagany EAN albo kod producenta i marka');
  if (!images.length) issues.push('Brak zdjęcia produktu');
  if (!Number.isFinite(price) || price <= 0) issues.push('Brak poprawnej ceny');
  if (!categoryId) warnings.push('Brak kategorii Von Halsky');
  if (!text(product.externalId || product.sku || product.id, 160)) warnings.push('Brak stabilnego EXTERNAL_ID');
  if (images.length === 1) warnings.push('Warto dodać więcej niż jedno zdjęcie');
  if (!Object.keys(product.parametry || product.parameters || {}).length) warnings.push('Brak parametrów kategorii');
  const score = Math.max(0, Math.round(100 - issues.length * 18 - warnings.length * 3));
  return {
    ready: issues.length === 0,
    score,
    issues,
    warnings,
    identifiers: { ean, manufacturerCode, brand, categoryId },
    publishable: issues.length === 0 && Boolean(categoryId) && Boolean(brand),
    publicationIssues: [
      ...(!categoryId ? ['Brak kategorii Von Halsky'] : []),
      ...(!brand ? ['Brak marki wymaganej przez kontrakt Von Halsky'] : []),
    ],
    nameLength: name.length,
    descriptionLength: description.length,
    presentationMode: presentation.mode,
    presentationSource: presentation.source,
    hasImage: images.length > 0,
    imageCount: images.length,
    price: Number.isFinite(price) ? price : 0,
  };
}

export function vonHalskyOfferProjection(product = {}, settings = {}) {
  const readiness = vonHalskyProductReadiness(product);
  const presentation = vonHalskyProductPresentation(product);
  const available = product.sprzedazAktywna !== false && product.saleAvailable !== false && product.dostepny !== false && product.aktywny !== false && product.ukryty !== true && product?._catalog?.availability?.saleAvailable !== false;
  const maximumStock = Math.max(1, Number(settings.maximumStock) || 25);
  const minimumStock = Math.max(0, Math.min(maximumStock, Number(settings.minimumStock) || 0));
  const physicalStock = Math.max(0, Number(product.stan ?? product.stock) || 0);
  return {
    externalId: text(product.externalId || product.sku || product.id, 160),
    gtin: readiness.identifiers.ean,
    manufacturerCode: readiness.identifiers.manufacturerCode,
    brand: readiness.identifiers.brand,
    name: text(presentation.name, 150),
    description: presentation.description,
    category: text(product.kategoria || product.category, 240),
    categoryId: readiness.identifiers.categoryId,
    attributes: vonHalskyAttributeValues(product),
    parameters: product.parametry || product.parameters || {},
    images: productImages(product),
    price: readiness.price,
    currency: 'PLN',
    available,
    stock: available ? Math.max(minimumStock, Math.min(maximumStock, physicalStock)) : 0,
    readiness,
  };
}

export function vonHalskyOfferProposal(projection = {}, {
  storefrontOrigin = 'https://artwaytm.pl',
  taxRateInfo = '23%',
  daysToShip = 1,
} = {}) {
  const categoryId = uuid(projection.categoryId);
  if (!projection?.readiness?.ready || projection?.readiness?.publishable === false || !categoryId) {
    const error = new Error(`Oferta ${text(projection.externalId, 160) || 'bez identyfikatora'} nie spełnia wymagań publikacji Von Halsky.`);
    error.code = 'von_halsky_offer_not_ready';
    error.status = 422;
    error.details = { issues: [...(projection?.readiness?.issues || []), ...(projection?.readiness?.publicationIssues || [])] };
    throw error;
  }
  const images = (Array.isArray(projection.images) ? projection.images : [])
    .map((value) => absoluteImageUrl(value, storefrontOrigin))
    .filter(Boolean)
    .slice(0, 16)
    .map((fileUrl, index) => ({ fileName: fileNameFromUrl(fileUrl, index), fileUrl, priority: index + 1 }));
  const product = {
    name: text(projection.name, 150),
    description: String(projection.description || '').slice(0, 100_000),
    brand: text(projection.brand, 100),
    categoryId,
    sku: text(projection.externalId, 100),
  };
  if (projection.attributes?.length) product.attributes = projection.attributes;
  if (projection.manufacturerCode) product.manufacturerProductNumber = text(projection.manufacturerCode, 500);
  if (projection.gtin) product.ean = text(projection.gtin, 100);
  return {
    externalId: text(projection.externalId, 500),
    product,
    stock: { quantity: Math.max(0, Math.min(999_999, Number(projection.stock) || 0)), unit: 'UNIT' },
    price: {
      grossPrice: { amount: Number(Number(projection.price).toFixed(2)), currency: text(projection.currency, 3) || 'PLN' },
      taxRateInfo: text(projection.taxRateInfo || taxRateInfo, 100),
    },
    shippingTime: { daysToShip: Math.max(0, Math.min(365, Number(projection.daysToShip ?? daysToShip) || 0)) },
    images,
    features: { refundable: projection.refundable !== false },
  };
}

export function deduplicateVonHalskyOffers(projections = []) {
  const selected = new Map();
  const conflicts = [];
  for (const item of Array.isArray(projections) ? projections : []) {
    const gtin = text(item?.gtin, 20);
    const fallback = `${text(item?.brand, 120).toLowerCase()}|${text(item?.manufacturerCode, 120).toLowerCase()}`;
    const key = gtin ? `gtin:${gtin}` : (fallback !== '|' ? `brand-code:${fallback}` : `external:${text(item?.externalId, 160)}`);
    const previous = selected.get(key);
    if (!previous) {
      selected.set(key, item);
      continue;
    }
    const previousScore = Number(previous?.readiness?.score) || 0;
    const currentScore = Number(item?.readiness?.score) || 0;
    const keepCurrent = currentScore > previousScore || (currentScore === previousScore && item.available === true && previous.available !== true);
    const kept = keepCurrent ? item : previous;
    const rejected = keepCurrent ? previous : item;
    selected.set(key, kept);
    conflicts.push({ key, keptExternalId: text(kept?.externalId, 160), rejectedExternalId: text(rejected?.externalId, 160) });
  }
  return { items: [...selected.values()], conflicts };
}

export function summarizeVonHalskyCatalog(products = []) {
  const items = (Array.isArray(products) ? products : []).map((product) => vonHalskyProductReadiness(product));
  return {
    total: items.length,
    ready: items.filter((item) => item.ready).length,
    needsWork: items.filter((item) => !item.ready).length,
    withEan: items.filter((item) => item.identifiers.ean).length,
    averageScore: items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0,
  };
}

export function vonHalskyPublicConfig(env = process.env) {
  return vonHalskyPublicApiConfig(env);
}
