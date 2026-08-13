import { isDeepStrictEqual } from 'node:util';
import {
  manufacturerProfileProductPatch,
  resolveManufacturerProfile,
} from './manufacturer-profile-registry.mjs';
import { synchronizeProductIdentifierAliases } from './product-identifiers.mjs';
import { assertSafeAgentEditorialFields } from './product-editorial-safety.mjs';

const MAX_FIELDS = 180;
const MAX_PAYLOAD_BYTES = 750_000;

export const CATALOG_PRODUCT_PREPARATION_FIELDS = new Set([
  // Główna kartoteka i edytor administratora. Wszystkie pola przechodzą przez
  // uwierzytelniony endpoint, rebase na najnowszym rekordzie i odczyt zwrotny.
  'nazwa', 'name', 'opisKrotki', 'krotkiOpis', 'opis', 'kategoria', 'category',
  'cena', 'cenaAllegro', 'cenaVonHalsky', 'cenaZakupu', 'staraCena',
  'cenaZaktualizowanoAt', 'cenaAllegroZaktualizowanoAt', 'cenaVonHalskyZaktualizowanoAt',
  'cenaZakupuZaktualizowanoAt', 'cenaManualna', 'cenaAllegroManualna',
  'cenaVonHalskyManualna', 'cenaZakupuPrywatna', 'cenaZrodlo',
  'cenaAllegroZrodlo', 'cenaVonHalskyZrodlo', 'cenaZakupuZrodlo',
  'cenaZakupuNetto', 'cenaZakupuVat', 'cenaZakupuWaluta', 'cenaZakupuDokument',
  'cenaZakupuKsef', 'cenaZakupuDostawca', 'cenaZakupuDataDokumentu', 'cenaZakupuDopasowanie',
  'producent', 'marka', 'gtin', 'ean', 'kodProducenta', 'mpn', 'numerReferencyjny',
  'manufacturerProfileId', 'manufacturerProfile', 'manufacturerProfileResolvedAt',
  'manufacturerProfileConfidence', 'manufacturerProfileMethod', 'manufacturerProfileEvidence',
  'externalId', 'sku', 'rozmiar', 'vatRate', 'badge', 'ikona', 'kolor',
  'zdjecie', 'zdjecia', 'warianty', 'parametry', 'parameters', 'auxiliarySources',
  'productPackagingFacts',
  'allegroProductSet',
  'aktywny', 'ukryty', 'sprzedazAktywna', 'saleAvailable',
  'profitabilityReviewed', 'profitabilityReviewedAt', 'profitabilityReviewedBy',
  'profitabilityReviewRevision', 'profitabilityReviewSignature', 'profitabilityReviewSnapshot',
  'allegroCommissionAmount', 'allegroCommissionRate', 'allegroRecurringFees',
  'allegroFeePrice', 'allegroFeeCalculatedAt', 'allegroFeeCurrency',
  'allegroFeeDetails', 'allegroFeeSource', 'allegroFeeTotal',
  'allegroAdditionalCost', 'allegroAdsPercent', 'kosztPakowania',
  'sklepAdditionalCost', 'sklepPaymentPercent', 'allegroPriceRecommendedAt',
  'sklepPriceRecommendedAt', 'vonHalskyPriceRecommendedAt',
  'nazwa', 'allegroTitle', 'opisKrotki', 'opis', 'allegroShortDescription',
  'allegroDescription', 'producent', 'marka', 'gtin', 'ean', 'kodProducenta',
  'mpn', 'zdjecie', 'zdjecia', 'sourceEvidence', 'sourceMaterial',
  'sourceUrl', 'producentUrl', 'externalId', 'sku', 'numerReferencyjny',
  'parametryProducenta', 'parametryZrodla', 'dostepnoscProducenta',
  'stanProducenta', 'stanProducentaDokladny', 'stanProducentaZrodlo',
  'producentStatus', 'producentSprawdzonoAt',
  'allegroCategoryId', 'allegroProductId', 'allegroCatalogIdentityConfirmed',
  'allegroCatalogCheckedAt', 'allegroCatalogSource', 'allegroParameters', 'allegroParameterResolution',
  'allegroDescriptionSections', 'allegroSafetyInformation',
  'allegroParameterEvidence', 'allegroSafetyInformationProvenance', 'identifierRepairEvidence',
  'allegroResponsibleProducer', 'allegroShippingSubsidy', 'contentEditorial',
  'allegroShippingRateId', 'allegroShippingRateName',
  'allegroReturnPolicyId', 'allegroReturnPolicyName',
  'allegroImpliedWarrantyId', 'allegroImpliedWarrantyName',
  'allegroWarrantyId', 'allegroWarrantyName',
  'contentEditorialPreparedAt', 'contentEditorialSource',
  'agentTextModel', 'agentTextReviewedAt', 'agentTextRunId', 'agentTextMode',
  'vonHalskyTitle', 'vonHalskyShortDescription', 'vonHalskyDescription',
  'vonHalskyContentMode', 'vonHalskyContentUpdatedAt', 'vonHalskyContentSource',
  'vonHalskyCategoryId', 'vonHalskyCategoryName', 'vonHalskyCategoryPath',
  'vonHalskyAttributes', 'vonHalskyAttributeDefinitions',
  'vonHalskyRequiredAttributesMissing', 'vonHalskyAttributesVerifiedAt', 'vonHalskyAttributesUpdatedAt',
  'vonHalskyGpsrRequired', 'vonHalskyDoesNotRequireGpsrInfo',
  'vonHalskyResponsibleProducer', 'vonHalskyResponsibleProducerStatus',
  'vonHalskyResponsibleProducerMissing', 'vonHalskySafetyInformation',
  'vonHalskyBatchNumber', 'vonHalskyCeMarking',
  'vonHalskyAgentSavedFields', 'vonHalskyAgentConfirmedAt',
  'vonHalskyAgentPreparationRunId', 'vonHalskyAgentPreparationSource',
  'vonHalskyAgentSaveState', 'vonHalskyAgentReadbackConfirmed',
  'agentQualityReviewStatus', 'agentQualityConfirmedAt', 'agentQualityReadbackConfirmed',
  'agentQualityRunId', 'agentQualityInputFingerprint', 'agentQualityChannels',
  'agentQualitySavedFields',
  'vonHalskyEditorialSyncPending', 'vonHalskyEditorialSyncPendingAt',
  'vonHalskyEditorialSyncRunId', 'vonHalskyEditorialSyncState',
  'vonHalskyEditorialSyncCheckedAt', 'vonHalskyEditorialSyncError',
  'vonHalskyEditorialSyncedAt',
  'vonHalskyRemoteStatus', 'vonHalskyProviderStatus', 'vonHalskyRemoteErrors',
  'vonHalskyRemotePresent', 'vonHalskyRemoteVerifiedAt',
  'allegroDescriptionSource', 'allegroEditorialSyncPending',
  'allegroEditorialSyncPendingAt', 'allegroEditorialSyncRunId',
  'allegroEditorialSyncState', 'allegroEditorialSyncCheckedAt',
  'allegroEditorialSyncedAt',
  'allegroEditorialSyncRequestedAt', 'allegroEditorialSyncError',
  'allegroAgentPreparationStatus', 'allegroAgentPreparationMissing',
  'allegroAgentSavedFields', 'allegroAgentPreparedAt',
  'allegroAgentPreparationStartedAt', 'allegroAgentPreparationSource',
  'allegroAgentDraftOperation', 'allegroAgentCompliancePolicy',
  'allegroAgentComplianceCheckedAt', 'allegroAgentPreparationError',
  'allegroAgentPreparationCheckedAt',
  'allegroAgentPreparationFingerprint', 'allegroAgentPreparationVersion',
  'allegroAgentPreparationRunId', 'allegroAgentPreparationConfirmedAt',
  'allegroAgentPreparationConfirmedRevision', 'allegroAgentPreparationRetryCount',
  'allegroAgentPreparationNextRetryAt', 'allegroPreparationManifest',
  'seoTitle', 'seoDescription', 'seoKeywords', 'seoScore', 'seoReviewedAt',
  'seoSource', 'seoMode',
  'allegroOfferId', 'allegroStock', 'allegroSyncedAt', 'allegroSyncSource',
  'allegroPublicationAgentStatus', 'allegroPublicationLastAttemptAt',
  'allegroPublicationLastSuccessAt', 'allegroPublicationLastErrorCode',
  'allegroPublicationLastError', 'allegroPublicationAgentTaskId',
  'allegroPublicationReportId', 'allegroPublicationSpecialistRunId',
  'allegroPublicationFailureCount',
  'allegroStatus', 'allegroPublicationStatus', 'allegroAgentPublishedAt',
  'allegroAgentPublicationError', 'allegroOfferWithdrawnAt', 'allegroOfferWithdrawnReason',
  'agentImportAt', 'agentImportConfidence', 'agentImportSource', 'agentImportUrl',
  'agentOnboardingStatus', 'agentOnboardingStartedAt', 'agentOnboardingCheckedAt',
  'agentOnboardingCompletedAt', 'agentOnboardingMissing',
  'createdAt', 'createdBy', 'importedAt', 'importItemKey', 'storageOrigin',
  'sourceRefreshedAt', 'sourceRefreshStatus', 'contentSource', 'contentSourceUrl',
  'contentVerifiedAt', 'producentAlertAktywny', 'producentOstatniBlad',
  'seoPromoted', 'seoPromotedAt',
]);

const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const CATALOG_PRODUCT_RECEIPT_FIELDS = [
  'lastAdminMutationId', 'lastAdminMutationAt', 'lastAdminMutationBy',
  'lastAdminMutationArea', 'lastAdminMutationFields',
];
const CATALOG_PRODUCT_RESERVED_FIELDS = new Set(['id', '_catalog', 'stan', 'dostepny', '__proto__', 'prototype', 'constructor']);
const allowedProductField = (key) => CATALOG_PRODUCT_PREPARATION_FIELDS.has(key)
  || (/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(String(key)) && !CATALOG_PRODUCT_RESERVED_FIELDS.has(String(key)));
// PostgreSQL JSONB porządkuje klucze obiektów niezależnie od kolejności
// otrzymanej w żądaniu. Kontrola odczytu musi więc porównywać strukturę,
// a nie tekst JSON, inaczej poprawnie opublikowany obiekt wygląda jak błąd.
const same = (left, right) => isDeepStrictEqual(left, right);

export function sanitizeCatalogProductFields(fields = {}, { allowEmpty = false } = {}) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    const error = new Error('Pola produktu muszą być obiektem.');
    error.status = 422;
    throw error;
  }
  const entries = Object.entries(fields);
  if ((!entries.length && !allowEmpty) || entries.length > MAX_FIELDS) {
    const error = new Error('Nieprawidłowa liczba pól produktu.');
    error.status = 422;
    throw error;
  }
  const unknown = entries.map(([key]) => key).filter((key) => !allowedProductField(key));
  if (unknown.length) {
    const error = new Error(`Niedozwolone pola kartoteki: ${unknown.slice(0, 8).join(', ')}`);
    error.status = 422;
    error.code = 'catalog_product_fields_not_allowed';
    throw error;
  }
  const clean = Object.fromEntries(entries.filter(([, value]) => value !== undefined));
  if (Object.prototype.hasOwnProperty.call(clean, 'auxiliarySources')) {
    const seen = new Set();
    clean.auxiliarySources = (Array.isArray(clean.auxiliarySources) ? clean.auxiliarySources : [])
      .map((source) => {
        const item = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
        const url = String(item.url || '').trim().slice(0, 3000);
        if (!/^https?:\/\//i.test(url) || seen.has(url)) return null;
        seen.add(url);
        return {
          url,
          label: String(item.label || '').trim().slice(0, 160),
          origin: String(item.origin || 'agent').trim().slice(0, 80),
          verifiedAt: String(item.verifiedAt || '').trim().slice(0, 80),
        };
      })
      .filter(Boolean)
      .slice(0, 12);
  }
  if (Buffer.byteLength(JSON.stringify(clean), 'utf8') > MAX_PAYLOAD_BYTES) {
    const error = new Error('Zmiana produktu jest zbyt duża.');
    error.status = 413;
    throw error;
  }
  return clean;
}

export function createCatalogProductFieldSaver({
  writeOperations,
  readProduct,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof writeOperations !== 'function' || typeof readProduct !== 'function') {
    throw new Error('Trwały zapis produktu wymaga zapisu operacji i odczytu centralnej kartoteki.');
  }
  return async function saveCatalogProductFields({
    productId,
    fields,
    remove = [],
    mutationId,
    actor = 'administrator',
    area = 'allegro-preparation',
  } = {}) {
    const id = String(productId || '').trim();
    if (!id) {
      const error = new Error('Brakuje identyfikatora produktu.');
      error.status = 422;
      throw error;
    }
    const rawRemove = Array.isArray(remove) ? remove : [];
    const changedAt = now();
    const requested = sanitizeCatalogProductFields(fields, { allowEmpty: rawRemove.length > 0 });
    assertSafeAgentEditorialFields(requested, area);
    let currentProduct = null;
    try {
      currentProduct = await readProduct(id);
    } catch {
      currentProduct = null;
    }
    const candidate = { ...(currentProduct || {}), ...requested };
    const producerChanged = own(requested, 'producent')
      && String(requested.producent || '').trim() !== String(currentProduct?.producent || '').trim();
    const producerProfileFields = [
      'manufacturerProfileId', 'manufacturerProfile', 'manufacturerProfileResolvedAt',
      'manufacturerProfileConfidence', 'manufacturerProfileMethod', 'manufacturerProfileEvidence',
    ];
    const profileWasRemoved = rawRemove.some((field) => producerProfileFields.includes(String(field || '').trim()));
    if ((producerChanged && !own(requested, 'manufacturerProfileId')) || profileWasRemoved) {
      for (const field of producerProfileFields) delete candidate[field];
    }
    const codeFields = ['kodProducenta', 'numerReferencyjny', 'mpn', 'externalId', 'sku'];
    const codeWasChanged = codeFields.some((field) => own(requested, field));
    const requestedCode = codeFields.map((field) => requested[field]).find((value) => String(value ?? '').trim()) || '';
    const identifiers = synchronizeProductIdentifierAliases(candidate, {
      code: requestedCode,
      overwrite: codeWasChanged,
    });
    const identifierPatch = Object.fromEntries(
      [...codeFields, 'gtin', 'ean']
        .filter((field) => own(identifiers, field) && (!own(candidate, field) || !same(candidate[field], identifiers[field])))
        .map((field) => [field, identifiers[field]]),
    );
    const producerResolution = resolveManufacturerProfile(candidate, {
      profileId: own(requested, 'manufacturerProfileId')
        ? requested.manufacturerProfileId
        : candidate.manufacturerProfileId || '',
    });
    const resolvedAt = currentProduct?.manufacturerProfileId === producerResolution?.profile?.id
      ? currentProduct.manufacturerProfileResolvedAt || changedAt
      : changedAt;
    const resolvedPatch = manufacturerProfileProductPatch(candidate, producerResolution, resolvedAt);
    const changedResolvedPatch = Object.fromEntries(Object.entries(resolvedPatch)
      .filter(([field, value]) => !own(candidate, field) || !same(candidate[field], value)));
    const clean = sanitizeCatalogProductFields(
      { ...requested, ...identifierPatch, ...changedResolvedPatch },
      { allowEmpty: rawRemove.length > 0 },
    );
    const removeFields = [...new Set(rawRemove
      .map((field) => String(field || '').trim())
      .filter((field) => allowedProductField(field) && !Object.prototype.hasOwnProperty.call(clean, field)))];
    const changedPatch = Object.fromEntries(Object.entries(clean)
      .filter(([field, value]) => !own(currentProduct, field) || !same(currentProduct[field], value)));
    const effectiveRemove = removeFields.filter((field) => own(currentProduct, field));
    const changedFields = [...Object.keys(changedPatch), ...effectiveRemove];
    if (!changedFields.length && currentProduct) {
      return {
        productId: id,
        fields: {},
        remove: [],
        changedFields: [],
        confirmedFields: [],
        mutationId: String(mutationId || currentProduct.lastAdminMutationId || '').slice(0, 160),
        confirmedAt: changedAt,
        modified: false,
        idempotent: true,
        product: currentProduct,
      };
    }
    const receipt = {
      lastAdminMutationId: String(mutationId || `product-${id}-${Date.now().toString(36)}`).slice(0, 160),
      lastAdminMutationAt: changedAt,
      lastAdminMutationBy: String(actor || 'administrator').slice(0, 200),
      lastAdminMutationArea: String(area || 'product').slice(0, 80),
      lastAdminMutationFields: changedFields,
    };
    const expected = { ...changedPatch, ...receipt };
    const saved = await writeOperations([{ id, fields: expected, remove: effectiveRemove }], changedAt);
    if (saved?.skippedProductIds?.includes(id)) {
      const error = new Error('Produkt nie istnieje w centralnym katalogu.');
      error.status = 404;
      error.code = 'catalog_product_not_found';
      throw error;
    }
    // Centralny writer zwraca dokładnie ten rekord, który utworzył pod
    // blokadą wiersza. To jest atomowe potwierdzenie zapisu. Osobny odczyt
    // pozostaje fallbackiem dla starszych writerów i testowych adapterów.
    let publication = Array.isArray(saved?.publications)
      ? saved.publications.find((item) => String(item?.productId || '') === id)
      : null;
    let product = publication?.product || await readProduct(id, saved?.value?.data);
    if (!product) {
      const error = new Error('Po zapisie nie udało się odczytać centralnej kartoteki produktu.');
      error.status = 500;
      error.code = 'catalog_product_readback_missing';
      throw error;
    }
    let mismatches = Object.entries(expected)
      .filter(([key, value]) => !own(product, key) || !same(product[key], value))
      .map(([key]) => key);
    mismatches.push(...effectiveRemove.filter((key) => own(product, key)));
    const businessMismatches = mismatches.filter((field) => !CATALOG_PRODUCT_RECEIPT_FIELDS.includes(field));
    // Stary dziennik mutacji może przetrwać migrację lub odbudowę rekordu,
    // podczas gdy odpowiadające mu pola biznesowe zniknęły z kartoteki.
    // Powtórka tej samej operacji jest wtedy formalnie idempotentna, ale nie
    // wolno uznać jej za potwierdzony zapis. Odtwarzamy brakujące pola jednym
    // nowym, audytowalnym wpisem i z blokadą na dokładnie odczytany stan.
    if (businessMismatches.length && publication?.idempotent === true) {
      const repairMutationId = `${receipt.lastAdminMutationId}:repair:${Date.now().toString(36)}`.slice(0, 200);
      const repairReceipt = { ...receipt, lastAdminMutationId: repairMutationId };
      const repairExpected = { ...changedPatch, ...repairReceipt };
      const repairExpectedFields = Object.fromEntries(
        [...new Set([...Object.keys(changedPatch), ...effectiveRemove])].map((field) => [field, {
          present: own(product, field),
          ...(own(product, field) ? { value: product[field] } : {}),
        }]),
      );
      const repaired = await writeOperations([{
        id,
        fields: repairExpected,
        remove: effectiveRemove,
        expectedFields: repairExpectedFields,
      }], changedAt);
      if (repaired?.skippedProductIds?.includes(id)) {
        const error = new Error('Kartoteka zmieniła się podczas bezpiecznego odtwarzania pól. Odśwież dane i ponów operację.');
        error.status = 409;
        error.code = 'catalog_product_repair_conflict';
        throw error;
      }
      publication = Array.isArray(repaired?.publications)
        ? repaired.publications.find((item) => String(item?.productId || '') === id)
        : null;
      product = publication?.product || await readProduct(id, repaired?.value?.data);
      if (!product) {
        const error = new Error('Po odtworzeniu pól nie udało się odczytać centralnej kartoteki produktu.');
        error.status = 500;
        error.code = 'catalog_product_readback_missing';
        throw error;
      }
      mismatches = Object.entries(repairExpected)
        .filter(([key, value]) => !own(product, key) || !same(product[key], value))
        .map(([key]) => key);
      mismatches.push(...effectiveRemove.filter((key) => own(product, key)));
      if (!mismatches.length) {
        return {
          productId: id,
          fields: repairExpected,
          remove: effectiveRemove,
          changedFields,
          confirmedFields: Object.keys(repairExpected),
          mutationId: repairMutationId,
          recoveredMutationId: receipt.lastAdminMutationId,
          confirmedAt: changedAt,
          rev: repaired?.value?.rev,
          modified: repaired?.modified === true,
          idempotent: false,
          repaired: true,
          product,
        };
      }
    }
    // Przy poprawnej powtórce pola biznesowe są nadal zgodne, ale metadane
    // ostatniej mutacji mogły legalnie zostać zastąpione przez późniejszy
    // zapis. Nie wymagamy cofnięcia nowszego pokwitowania tylko po to, aby
    // potwierdzić starszą, już widoczną wartość.
    if (!businessMismatches.length && publication?.idempotent === true) {
      return {
        productId: id,
        fields: changedPatch,
        remove: effectiveRemove,
        changedFields,
        confirmedFields: Object.keys(changedPatch),
        mutationId: receipt.lastAdminMutationId,
        confirmedAt: changedAt,
        rev: saved?.value?.rev,
        modified: false,
        idempotent: true,
        product,
      };
    }
    if (mismatches.length) {
      const error = new Error(`Serwer nie potwierdził pól: ${mismatches.slice(0, 12).join(', ')}`);
      error.status = 409;
      error.code = 'catalog_product_readback_mismatch';
      error.mismatches = mismatches;
      throw error;
    }
    return {
      productId: id,
      fields: expected,
      remove: effectiveRemove,
      changedFields,
      confirmedFields: Object.keys(expected),
      mutationId: receipt.lastAdminMutationId,
      confirmedAt: changedAt,
      rev: saved?.value?.rev,
      modified: saved?.modified === true,
      idempotent: saved?.modified !== true,
      product,
    };
  };
}

export function createPublishedCatalogProductFieldSaver({
  saveFields,
  publishFields,
  readPublishedProduct = null,
  saveIsPublished = false,
} = {}) {
  if (typeof saveFields !== 'function') return null;
  if (typeof publishFields !== 'function' && saveIsPublished !== true) return saveFields;
  return async function saveAndPublishCatalogProductFields(input = {}) {
    const result = await saveFields(input);
    // Po migracji artway_products jest jednocześnie źródłem zapisu i
    // publikowaną kartoteką. Ponowne PATCH tych samych pól tworzyło wyścig:
    // starszy drugi zapis mógł cofnąć nowszą zmianę, a używając tego samego
    // mutationId nie zostawiał śladu. W trybie centralnym tylko potwierdzamy
    // już wykonany zapis i przechodzimy do niezależnego odczytu.
    const publication = saveIsPublished === true
      ? {
          published: true,
          queued: false,
          central: true,
          revision: result.rev || '',
          updatedAt: result.confirmedAt,
        }
      : await publishFields({
          productId: input.productId,
          fields: result.fields,
          remove: result.remove || input.remove || [],
          mutationId: result.mutationId || input.mutationId,
          actor: input.actor || 'system',
          area: input.area || 'product',
          updatedAt: result.confirmedAt,
        });
    if (publication?.published !== true) {
      const error = new Error('Dane zapisano, ale centralna kartoteka nie potwierdziła jeszcze publikacji. System zachował zmianę i ponowi publikację.');
      error.status = 503;
      error.code = 'catalog_product_publication_pending';
      throw error;
    }
    if (typeof readPublishedProduct === 'function') {
      const publishedProduct = await readPublishedProduct(String(input.productId || ''));
      const mismatches = Object.entries(result.fields || {})
        .filter(([key, value]) => !own(publishedProduct, key) || !same(publishedProduct[key], value))
        .map(([key]) => key);
      if (!publishedProduct || mismatches.length) {
        const error = new Error(publishedProduct
          ? `Publikacja nie potwierdziła pól: ${mismatches.slice(0, 12).join(', ')}`
          : 'Po publikacji nie udało się odczytać produktu z centralnej kartoteki.');
        error.status = 503;
        error.code = publishedProduct ? 'catalog_product_publication_readback_mismatch' : 'catalog_product_publication_readback_missing';
        error.mismatches = mismatches;
        throw error;
      }
      return { ...result, product: publishedProduct, publication: { ...publication, readbackConfirmed: true } };
    }
    return { ...result, publication };
  };
}

export function createCatalogProductFieldRoute({
  respond,
  isAdmin,
  text,
  sessionOf,
  saveFields,
} = {}) {
  return async function catalogProductFieldRoute(req, url) {
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (typeof saveFields !== 'function') return respond({ ok: false, error: 'Trwały zapis kartoteki nie jest dostępny.' }, 503);
    const body = await req.json().catch(() => ({}));
    try {
      const result = await saveFields({
        productId: text(body.productId, 100),
        fields: body.fields,
        remove: Array.isArray(body.remove) ? body.remove : [],
        mutationId: text(body.mutationId, 160),
        actor: text(sessionOf(req)?.email || 'administrator', 200),
        area: text(body.area || 'allegro-preparation', 80),
      });
      return respond({ ok: true, confirmed: true, ...result });
    } catch (error) {
      return respond({
        ok: false,
        confirmed: false,
        error: text(error?.message || error, 1000),
        code: error?.code || 'catalog_product_save_failed',
        mismatches: Array.isArray(error?.mismatches) ? error.mismatches : undefined,
      }, Number(error?.status) || 500);
    }
  };
}
