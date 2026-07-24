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

export function allegroCatalogRecoveryHint(error = {}) {
  const errors = allegroErrors(error);
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
    const catalog = hint.kind === 'refresh_parameters' ? null : await loadCatalog(hint.productId);
    const decision = hint.kind === 'refresh_parameters'
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
