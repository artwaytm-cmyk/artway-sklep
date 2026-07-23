const INTEGRATION_METHODS = new Set(['api', 'integrator']);
const INTEGRATORS = new Set(['base', 'apilo', 'idosell', 'sellassist', 'shoper', 'atomstore', 'xsale', 'other']);

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
  const method = INTEGRATION_METHODS.has(text(raw.integrationMethod, 20))
    ? text(raw.integrationMethod, 20)
    : (INTEGRATION_METHODS.has(previous.integrationMethod) ? previous.integrationMethod : defaults.integrationMethod);
  const integrator = INTEGRATORS.has(text(raw.integrator, 30))
    ? text(raw.integrator, 30)
    : (INTEGRATORS.has(previous.integrator) ? previous.integrator : '');
  const onboardingRaw = raw.onboarding && typeof raw.onboarding === 'object' ? raw.onboarding : {};
  const onboardingPrevious = previous.onboarding && typeof previous.onboarding === 'object' ? previous.onboarding : {};
  const onboarding = Object.fromEntries(Object.keys(defaults.onboarding).map((key) => [
    key,
    typeof onboardingRaw[key] === 'boolean' ? onboardingRaw[key] : onboardingPrevious[key] === true,
  ]));
  return {
    integrationMethod: method,
    integrator: method === 'integrator' ? integrator : '',
    channelAlias: (text(raw.channelAlias ?? previous.channelAlias ?? defaults.channelAlias, 20).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'VH').slice(0, 2),
    merchantStoreName: text(raw.merchantStoreName ?? previous.merchantStoreName ?? defaults.merchantStoreName, 120),
    notificationEmail: text(raw.notificationEmail ?? previous.notificationEmail, 200).toLowerCase(),
    minimumStock: integer(raw.minimumStock, integer(previous.minimumStock, defaults.minimumStock, 0, 99999), 0, 99999),
    maximumStock: integer(raw.maximumStock, integer(previous.maximumStock, defaults.maximumStock, 1, 99999), 1, 99999),
    syncIntervalMinutes: integer(raw.syncIntervalMinutes, integer(previous.syncIntervalMinutes, defaults.syncIntervalMinutes, 15, 1440), 15, 1440),
    automaticPriceSync: typeof raw.automaticPriceSync === 'boolean' ? raw.automaticPriceSync : previous.automaticPriceSync !== false,
    automaticStockSync: typeof raw.automaticStockSync === 'boolean' ? raw.automaticStockSync : previous.automaticStockSync !== false,
    automaticResume: typeof raw.automaticResume === 'boolean' ? raw.automaticResume : previous.automaticResume !== false,
    customerZone: typeof raw.customerZone === 'boolean' ? raw.customerZone : previous.customerZone !== false,
    onboarding,
    updatedAt: new Date().toISOString(),
  };
}

function canonicalGtin(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return [8, 12, 13, 14].includes(digits.length) ? digits : '';
}

function descriptionText(product = {}) {
  return text(product.opisAllegro || product.opis || product.dlugiOpis || product.description, 20_000);
}

export function vonHalskyProductReadiness(product = {}) {
  const name = text(product.nazwa || product.name, 200);
  const description = descriptionText(product);
  const ean = canonicalGtin(product.gtin || product.ean || product.EAN);
  const manufacturerCode = text(product.kodProducenta || product.mpn || product.externalId || product.sku, 120);
  const brand = text(product.marka || product.producent, 120);
  const image = text(product.zdjecie || product.image || product.imageUrl, 2000);
  const price = Number(product.cena ?? product.price);
  const issues = [];
  if (name.length < 7 || name.length > 150) issues.push('Nazwa musi mieć 7–150 znaków');
  if (description.length < 100) issues.push('Opis musi mieć co najmniej 100 znaków');
  if (/https?:\/\/|www\./i.test(description)) issues.push('Opis nie może zawierać linków');
  if (!ean && !(manufacturerCode && brand)) issues.push('Wymagany EAN albo kod producenta i marka');
  if (!image) issues.push('Brak zdjęcia produktu');
  if (!Number.isFinite(price) || price <= 0) issues.push('Brak poprawnej ceny');
  const score = Math.max(0, Math.round(100 - issues.length * 18));
  return {
    ready: issues.length === 0,
    score,
    issues,
    identifiers: { ean, manufacturerCode, brand },
    nameLength: name.length,
    descriptionLength: description.length,
    hasImage: Boolean(image),
    price: Number.isFinite(price) ? price : 0,
  };
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
  const required = ['INPOST_VON_HALSKY_API_BASE_URL', 'INPOST_VON_HALSKY_CLIENT_ID', 'INPOST_VON_HALSKY_CLIENT_SECRET', 'INPOST_VON_HALSKY_MERCHANT_ID'];
  const missingEnv = required.filter((key) => !text(env?.[key], 4000));
  return {
    configured: missingEnv.length === 0,
    missingEnv,
    merchantConfigured: Boolean(text(env?.INPOST_VON_HALSKY_MERCHANT_ID, 200)),
    apiBaseConfigured: Boolean(text(env?.INPOST_VON_HALSKY_API_BASE_URL, 2000)),
    credentialsConfigured: Boolean(text(env?.INPOST_VON_HALSKY_CLIENT_ID, 1000) && text(env?.INPOST_VON_HALSKY_CLIENT_SECRET, 4000)),
    documentationPrivate: true,
  };
}
