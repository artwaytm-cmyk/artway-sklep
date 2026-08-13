import { canonicalGtin } from './product-identifiers.mjs';

function text(value, limit = 500) {
  return String(value ?? '').trim().slice(0, limit);
}

function allegroErrors(error = {}) {
  return Array.isArray(error?.allegro?.errors) ? error.allegro.errors.filter(Boolean) : [];
}

function categoryIdFromMessage(message = '') {
  const match = String(message).match(/existing product category\s+.+?\((\d+)\)/i)
    || String(message).match(/(?:zmień kategorię|na)\s+.+?\((\d+)\)/i);
  return match?.[1] || '';
}

const ALLEGRO_GTIN_PARAMETER_IDS = new Set(['225693', '245669', '245673']);

function dataIntegrityGtinCorrection(item = {}) {
  const code = String(item?.code || '').replaceAll('.', '').toUpperCase();
  const message = String(item?.message || item?.userMessage || '');
  const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  const describesGtin = code.includes('PRODUCTCONSTRAINTVIOLATIONEXCEPTIONDATAINTEGRITY')
    || /(?:incorrect|invalid|niepoprawny|nieprawidłowy)\s+(?:EAN|GTIN|ISBN|ISSN)/i.test(message);
  if (!describesGtin) return null;
  const parameterId = text(metadata.parameterId || message.match(/\((\d{5,})\)/)?.[1], 100);
  if (parameterId && !ALLEGRO_GTIN_PARAMETER_IDS.has(parameterId)) return null;
  const metadataExpected = text(
    metadata.expectedParameterValue || metadata.expectedValue || metadata.correctValue,
    80,
  ).replace(/\D/g, '');
  const quoted = [...message.matchAll(/["'](\d{8,14})["']/g)].map((match) => match[1]);
  const candidates = [metadataExpected, ...quoted.slice().reverse()];
  const expectedGtin = candidates.find((value) => canonicalGtin(value)) || '';
  if (!expectedGtin) return null;
  return {
    parameterId: parameterId || '225693',
    parameterName: text(metadata.parameterName || 'EAN (GTIN)', 180),
    expectedValue: expectedGtin,
    expectedValueId: '',
  };
}

export function allegroCatalogRecoveryHint(error = {}) {
  const errors = allegroErrors(error);
  const identifierCorrection = errors.map(dataIntegrityGtinCorrection).find(Boolean);
  if (identifierCorrection) {
    return {
      kind: 'identifier_value',
      productId: '',
      categoryId: '',
      expectedGtin: identifierCorrection.expectedValue,
      corrections: [identifierCorrection],
      errors,
    };
  }
  const category = errors.find((item) => String(item?.code || '').toUpperCase() === 'CATEGORY_MISMATCH');
  if (category) {
    const metadata = category.metadata && typeof category.metadata === 'object' ? category.metadata : {};
    return {
      kind: 'category',
      productId: text(metadata.existingProductId || metadata.productId, 160),
      categoryId: text(metadata.existingCategoryId || categoryIdFromMessage(category.message || category.userMessage), 80),
      categoryName: text(metadata.existingCategoryName, 180),
      requestedCategoryId: text(metadata.requestedCategoryId, 80),
      errors,
    };
  }

  const mismatches = errors.filter((item) => String(item?.code || '').toUpperCase() === 'PARAMETER_MISMATCH');
  if (mismatches.length) {
    const productIds = [...new Set(mismatches.map((item) => text(item?.metadata?.productId, 160)).filter(Boolean))];
    if (productIds.length !== 1) return null;
    return {
      kind: 'parameters',
      productId: productIds[0],
      categoryId: '',
      corrections: mismatches.map((item) => ({
        parameterId: text(item?.metadata?.parameterId, 100),
        parameterName: text(item?.metadata?.parameterName, 180),
        expectedValue: text(item?.metadata?.expectedParameterValue, 300),
        expectedValueId: text(item?.metadata?.expectedParameterValueId, 160),
      })),
      errors,
    };
  }

  const refreshable = new Set(['PARAMETERIDNOTFOUNDEXCEPTION', 'DICTIONARYPARAMETERIDNOTFOUND', 'PARAMETERCATEGORYEXCEPTION']);
  const stale = errors.filter((item) => refreshable.has(String(item?.code || '').replaceAll('.', '').toUpperCase()));
  if (!stale.length) return null;
  return {
    kind: 'refresh_parameters',
    productId: '',
    categoryId: text(stale.find((item) => item?.metadata?.categoryId)?.metadata?.categoryId, 80),
    parameterIds: [...new Set(stale.map((item) => text(item?.metadata?.parameterId, 100)).filter(Boolean))],
    errors,
  };
}

export function allegroCatalogRecoveryDecision({ hint, catalog, identity } = {}) {
  if (!hint?.productId || !catalog?.id || String(hint.productId) !== String(catalog.id)) {
    return { allowed: false, code: 'allegro_catalog_recovery_product_missing', reason: 'Allegro nie zwróciło jednoznacznego produktu katalogowego do bezpiecznej naprawy.' };
  }
  if (identity?.verified !== true) {
    return {
      allowed: false,
      code: 'allegro_catalog_identity_conflict',
      reason: `Allegro rozpoznało produkt katalogowy, ale automatyczna publikacja została zatrzymana: ${text(identity?.reason || 'tożsamość produktu nie została potwierdzona', 300)}.`,
    };
  }
  const categoryId = text(hint.categoryId || catalog.categoryId, 80);
  if (!categoryId) return { allowed: false, code: 'allegro_catalog_category_missing', reason: 'Produkt katalogowy Allegro nie ma kategorii wymaganej do ponowienia publikacji.' };
  return { allowed: true, code: 'allegro_catalog_recovery_ready', categoryId, productId: text(catalog.id, 160) };
}

export function allegroIdentifierRecoveryProduct(product = {}, hint = {}, categoryId = '') {
  const rejected = new Set([
    ...(hint.parameterIds || []),
    ...(hint.corrections || []).map((item) => String(item?.parameterId || '')).filter(Boolean),
  ]);
  const correctedGtin = hint.kind === 'identifier_value' && canonicalGtin(hint.expectedGtin)
    ? String(hint.expectedGtin).replace(/\D/g, '') : '';
  return {
    ...product, allegroCategoryId: categoryId,
    ...(correctedGtin ? { ean: correctedGtin, gtin: correctedGtin } : {}),
    ...(rejected.size ? { allegroParameters: (product.allegroParameters || []).filter((param) => !rejected.has(String(param?.id || ''))) } : {}),
  };
}

export async function executeAllegroOfferWriteWithRecovery({
  draft,
  prepared,
  existing,
  send,
  loadCatalog,
  prepareRecovery,
} = {}) {
  try {
    return { ...(await send(draft, existing)), draft, prepared, existing, catalogRecovery: null };
  } catch (error) {
    const hint = allegroCatalogRecoveryHint(error);
    if (!hint || existing?.offer?.id) throw error;
    const catalog = ['refresh_parameters', 'identifier_value'].includes(hint.kind) ? null : await loadCatalog(hint.productId);
    const decision = hint.kind === 'identifier_value'
      ? {
        allowed: Boolean(canonicalGtin(hint.expectedGtin)),
        code: 'allegro_identifier_value_recovery_ready',
        categoryId: hint.categoryId || text(draft?.category?.id, 80),
        productId: '',
      }
      : hint.kind === 'refresh_parameters'
      ? { allowed: true, code: 'allegro_parameter_refresh_ready', categoryId: hint.categoryId || text(draft?.category?.id, 80), productId: '' }
      : allegroCatalogRecoveryDecision({ hint, catalog, identity: catalog?.identity });
    if (!decision.allowed) {
      error.code = decision.code;
      error.message = decision.reason;
      error.catalogRecovery = { applied: false, hint, decision };
      throw error;
    }
    const recovered = await prepareRecovery({ hint, catalog, decision });
    if (!recovered?.draft || recovered?.ready === false) {
      error.code = 'allegro_catalog_recovery_incomplete';
      error.message = `Allegro wskazało poprawny produkt katalogowy, ale po odświeżeniu nadal brakuje danych: ${(recovered?.missing || ['pełna kontrola szkicu']).join(', ')}.`;
      error.catalogRecovery = { applied: false, hint, decision };
      throw error;
    }
    return {
      ...(await send(recovered.draft, recovered.existing)),
      ...recovered,
      catalogRecovery: {
        applied: true,
        kind: hint.kind,
        productId: decision.productId,
        categoryId: decision.categoryId,
        correctedParameters: hint.corrections || [],
      },
    };
  }
}
