const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, max = 1000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
export const centralProductOwn = (object, key) => Object.prototype.hasOwnProperty.call(asObject(object), String(key)) || Object.prototype.hasOwnProperty.call(asObject(object), key);
export const CENTRAL_PRODUCT_DERIVED_FIELDS = new Set(['_catalog', 'stan', 'dostepny']);

export const CENTRAL_ALLEGRO_PREPARATION_FIELDS = Object.freeze([
  'nazwa', 'allegroTitle', 'opisKrotki', 'opis', 'allegroDescription',
  'producent', 'marka', 'gtin', 'ean', 'kodProducenta', 'mpn', 'zdjecie',
  'zdjecia', 'sourceEvidence', 'allegroCategoryId', 'allegroProductId',
  'allegroParameters', 'allegroDescriptionSections', 'allegroSafetyInformation',
  'parametryProducenta', 'parametryZrodla', 'sourceMaterial', 'productPackagingFacts',
  'allegroParameterEvidence', 'allegroCategoryResolution', 'allegroParameterResolution',
  'allegroSafetyInformationProvenance',
  'allegroProductSet',
  'allegroResponsibleProducer', 'allegroShippingSubsidy',
  'allegroShippingRateId', 'allegroShippingRateName',
  'allegroReturnPolicyId', 'allegroReturnPolicyName',
  'allegroImpliedWarrantyId', 'allegroImpliedWarrantyName',
  'allegroWarrantyId', 'allegroWarrantyName',
]);

export function centralPreparationStableJson(value) {
  if (Array.isArray(value)) return `[${value.map(centralPreparationStableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${centralPreparationStableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function stablePreparationValue(value) {
  if (Array.isArray(value)) return value.map(stablePreparationValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:at|date|time|timestamp)$/i.test(key))
    .map(([key, entry]) => [key, stablePreparationValue(entry)]));
}

function preparationHash(product = {}, { stableEvidence = true } = {}) {
  const stableFields = new Set([
    'sourceEvidence', 'sourceMaterial', 'productPackagingFacts',
    'allegroParameterEvidence', 'allegroCategoryResolution',
    'allegroParameterResolution', 'allegroSafetyInformationProvenance',
  ]);
  const raw = centralPreparationStableJson(CENTRAL_ALLEGRO_PREPARATION_FIELDS.map((key) => [
    key,
    stableEvidence && stableFields.has(key)
      ? stablePreparationValue(product[key] ?? null)
      : product[key] ?? null,
  ]));
  let hash = 2166136261;
  for (const byte of Buffer.from(raw, 'utf8')) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function centralCatalogApplyAuthority(product = {}, authority = {}) {
  const source = { ...asObject(product) };
  const saved = asObject(authority?.data);
  const fields = [...new Set(asArray(authority?.fields || authority?.authoritative_fields)
    .map((field) => text(field, 120))
    .filter((field) => field && !CENTRAL_PRODUCT_DERIVED_FIELDS.has(field)))];
  for (const field of fields) {
    if (centralProductOwn(saved, field)) source[field] = saved[field];
    else delete source[field];
  }
  return source;
}

export function centralAllegroPreparationFingerprint(product = {}) {
  return `allegro-preparation-v6-${preparationHash(product)}`;
}

export function centralAllegroPreparationCurrent(product = {}) {
  const status = text(product.allegroAgentPreparationStatus, 40).toLowerCase();
  const missing = asArray(product.allegroAgentPreparationMissing).map((item) => text(item, 300)).filter(Boolean);
  if (!['ready', 'published'].includes(status) || missing.length) return false;
  if (status === 'published' && text(product.allegroOfferId, 120)) return true;
  const version = Number(product.allegroAgentPreparationVersion) || 0;
  const savedFingerprint = text(product.allegroAgentPreparationFingerprint, 120);
  if (version >= 4 && savedFingerprint.startsWith('allegro-preparation-v6-')) {
    return savedFingerprint === centralAllegroPreparationFingerprint(product);
  }
  if (version >= 4 && savedFingerprint.startsWith('allegro-preparation-v4-')) {
    return savedFingerprint === `allegro-preparation-v4-${preparationHash(product, { stableEvidence: false })}`;
  }
  return version === 3
    && text(product.lastAdminMutationArea, 80) === 'allegro-preparation'
    && text(product.lastAdminMutationId, 160).startsWith('allegro-preparation:')
    && asArray(product.lastAdminMutationFields).includes('allegroAgentPreparationFingerprint');
}
