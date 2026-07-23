import { vonHalskyPublicApiConfig } from './von-halsky-api-client.mjs';

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

function descriptionSource(product = {}) {
  return String(product.opisAllegro || product.opis || product.dlugiOpis || product.description || '').slice(0, 50_000);
}

function descriptionText(product = {}) {
  return text(descriptionSource(product).replace(/<[^>]*>/g, ' '), 20_000);
}

function productImages(product = {}) {
  const values = [
    ...(Array.isArray(product.zdjecia) ? product.zdjecia : []),
    ...(Array.isArray(product.images) ? product.images : []),
    product.zdjecie,
    product.image,
    product.imageUrl,
  ];
  return [...new Set(values.map((item) => text(typeof item === 'object' ? item?.url : item, 2000)).filter(Boolean))];
}

export function vonHalskyEffectivePrice(product = {}) {
  for (const candidate of [product.cenaVonHalsky, product.vonHalskyPrice, product.cenaAllegro, product.allegroPrice, product.cena, product.price]) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export function vonHalskyProductReadiness(product = {}) {
  const name = text(product.nazwa || product.name, 200);
  const rawDescription = descriptionSource(product);
  const description = descriptionText(product);
  const ean = canonicalGtin(product.gtin || product.ean || product.EAN);
  const manufacturerCode = text(product.kodProducenta || product.mpn || product.externalId || product.sku, 120);
  const brand = text(product.marka || product.producent, 120);
  const images = productImages(product);
  const price = vonHalskyEffectivePrice(product);
  const issues = [];
  const warnings = [];
  if (name.length < 7 || name.length > 150) issues.push('Nazwa musi mieć 7–150 znaków');
  if (description.length < 100) issues.push('Opis musi mieć co najmniej 100 znaków');
  if (/https?:\/\/|www\.|<a\b/i.test(rawDescription)) issues.push('Opis nie może zawierać linków');
  if (/<img\b/i.test(rawDescription)) issues.push('Opis nie może zawierać osadzonych zdjęć');
  if (!ean && !(manufacturerCode && brand)) issues.push('Wymagany EAN albo kod producenta i marka');
  if (!images.length) issues.push('Brak zdjęcia produktu');
  if (!Number.isFinite(price) || price <= 0) issues.push('Brak poprawnej ceny');
  if (!text(product.kategoria || product.category, 240)) warnings.push('Brak kategorii kanału');
  if (!text(product.externalId || product.sku || product.id, 160)) warnings.push('Brak stabilnego EXTERNAL_ID');
  if (images.length === 1) warnings.push('Warto dodać więcej niż jedno zdjęcie');
  if (!Object.keys(product.parametry || product.parameters || {}).length) warnings.push('Brak parametrów kategorii');
  const score = Math.max(0, Math.round(100 - issues.length * 18 - warnings.length * 3));
  return {
    ready: issues.length === 0,
    score,
    issues,
    warnings,
    identifiers: { ean, manufacturerCode, brand },
    nameLength: name.length,
    descriptionLength: description.length,
    hasImage: images.length > 0,
    imageCount: images.length,
    price: Number.isFinite(price) ? price : 0,
  };
}

export function vonHalskyOfferProjection(product = {}, settings = {}) {
  const readiness = vonHalskyProductReadiness(product);
  const available = product.sprzedazAktywna !== false && product.saleAvailable !== false && product.dostepny !== false && product.aktywny !== false && product.ukryty !== true && product?._catalog?.availability?.saleAvailable !== false;
  const maximumStock = Math.max(1, Number(settings.maximumStock) || 25);
  const minimumStock = Math.max(0, Math.min(maximumStock, Number(settings.minimumStock) || 0));
  const physicalStock = Math.max(0, Number(product.stan ?? product.stock) || 0);
  return {
    externalId: text(product.externalId || product.sku || product.id, 160),
    gtin: readiness.identifiers.ean,
    manufacturerCode: readiness.identifiers.manufacturerCode,
    brand: readiness.identifiers.brand,
    name: text(product.nazwa || product.name, 150),
    description: descriptionText(product),
    category: text(product.kategoria || product.category, 240),
    parameters: product.parametry || product.parameters || {},
    images: productImages(product),
    price: readiness.price,
    currency: 'PLN',
    available,
    stock: available ? Math.max(minimumStock, Math.min(maximumStock, physicalStock)) : 0,
    readiness,
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
