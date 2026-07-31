import {
  productEditorialFingerprint,
  providerQuotaUnavailable,
} from './agent-specialists-support.mjs';
import { enrichAllegroProductEvidence } from './allegro-parameter-enrichment.mjs';
import { editorialProductContentReport, editorialSourceTextIsSafe, stripEditorialExpandControls } from './product-editorial-safety.mjs';
import {
  ALLEGRO_PREPARATION_VERSION,
  allegroAutomaticPreparationDisposition,
  allegroPreparationAttemptDisposition,
  allegroPreparationRetryState,
} from './allegro-preparation-queue.mjs';
import { enrichProductFromAuxiliarySources } from './product-auxiliary-source-enrichment.mjs';
import { deterministicProductEditorialFallback } from './product-editorial-fallback.mjs';

const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function editorialReady(product = {}) {
  const editorial = asObject(product.contentEditorial), channels = asObject(editorial.channelStates);
  return channels.store?.status === 'ready'
    && channels.allegro?.status === 'ready'
    && editorialProductContentReport(product, 'store').ready
    && editorialProductContentReport(product, 'allegro').ready;
}

function editorialCurrent(product = {}) {
  const editorial = asObject(product.contentEditorial), channels = asObject(editorial.channelStates);
  const fingerprint = productEditorialFingerprint(product);
  return editorialProductContentReport(product, 'store').ready
    && editorialProductContentReport(product, 'allegro').ready
    && ['store', 'allegro', 'vonHalsky'].every((channel) => (
    channels[channel]?.status === 'ready'
    && channels[channel]?.inputFingerprint === fingerprint
    ));
}

function changedFields(before = {}, after = {}, fields = []) {
  return fields.filter((field) => JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null));
}

function manufacturerKey(product = {}) {
  return String(product.producent || product.marka || product.manufacturer || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const SOURCE_PAGE_NOISE = /(?:dodaj produkty podając kody|wgraj pliki z kodami|przejdź do koszyka|zaloguj się|twoje konto|newsletter|polityka prywatności|regulamin sklepu|menu główne)/i;
function usefulProductText(value = '', minimum = 20) {
  const clean = String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length >= minimum && !SOURCE_PAGE_NOISE.test(clean) && editorialSourceTextIsSafe(clean);
}

export function createAllegroPreparationWorker({
  text,
  readSettings,
  loadProducts,
  getCatalogProduct,
  sourceUrlOf,
  inspectSource,
  sourceImages,
  editorialize,
  prepareDraft,
  enforceDraft,
  verifyIdentity,
  preparationCurrent,
  preparationFingerprint,
  saveProduct,
  requestFactory,
  reportProgress = async () => {},
} = {}) {
  const required = { text, readSettings, loadProducts, getCatalogProduct, sourceUrlOf, inspectSource, sourceImages, editorialize, prepareDraft, enforceDraft, verifyIdentity, preparationCurrent, preparationFingerprint, saveProduct, requestFactory };
  const missingDependency = Object.entries(required).find(([, value]) => typeof value !== 'function');
  if (missingDependency) throw new Error(`Serwerowe przygotowanie Allegro wymaga funkcji: ${missingDependency[0]}`);

  return async function prepareProduct(task = {}) {
    const productId = text(task.productId, 100).trim();
    if (!productId) throw Object.assign(new Error('Brakuje ID produktu w kolejce.'), { status: 422 });
    const workId = `allegro-preparation:${productId}`;
    const progress = async (work = {}) => {
      try {
        await reportProgress({
          id: workId,
          runId: task.id,
          productId,
          channel: 'allegro',
          action: 'przygotowanie produktu do Allegro',
          target: 'centralna kartoteka i szkic Allegro',
          attempt: Math.max(1, Number(task.attempt) || 1),
          ...work,
        });
      } catch {
        // Telemetria jest obserwacją pracy i nigdy nie może zatrzymać zapisu.
      }
    };
    const latestSettings = await readSettings();
    const products = await loadProducts(latestSettings.data || {});
    const indexedProduct = products.get(productId);
    const centralProduct = await getCatalogProduct(productId);
    const stored = indexedProduct && centralProduct
      ? { ...indexedProduct, ...centralProduct }
      : (centralProduct || indexedProduct);
    if (!stored) throw Object.assign(new Error(`Nie znaleziono produktu ${productId}.`), { status: 404 });
    const productName = stored.nazwa || stored.name || `Produkt ${productId}`;
    await progress({
      productName,
      phase: 'kartoteka',
      status: 'running',
      message: 'Pobrano najnowszą wersję produktu z centralnej kartoteki. Sprawdzam, które pola rzeczywiście wymagają zmiany.',
    });

    const automaticDisposition = allegroAutomaticPreparationDisposition(stored);
    if (task.operation === 'allegro-auto-remediation' && automaticDisposition.verificationOnly) {
      await progress({
        productName,
        phase: 'weryfikacja_oferty',
        status: 'confirmed',
        fields: [],
        target: automaticDisposition.offerId,
        message: 'Oferta jest aktywna i prawidłowo powiązana. Kontrola zakończona bez ponownej redakcji i bez zapisu produktu.',
      });
      return {
        status: 'completed',
        ready: true,
        name: productName,
        missing: [],
        savedFields: [],
        mutationId: '',
        reused: true,
        verificationOnly: true,
        offerId: automaticDisposition.offerId,
      };
    }

    if (preparationCurrent(stored) && editorialReady(stored)) {
      await progress({
        productName,
        phase: 'weryfikacja',
        status: 'confirmed',
        fields: [],
        message: 'Kartoteka, opisy i odcisk danych są aktualne. Nie wykonano zbędnego ponownego zapisu.',
      });
      return {
        status: 'completed',
        ready: true,
        name: stored.nazwa || stored.name || `Produkt ${productId}`,
        missing: [],
        savedFields: [],
        mutationId: stored.lastAdminMutationId || '',
        reused: true,
      };
    }

    const startedAt = new Date().toISOString(), request = requestFactory();
    let product = enrichAllegroProductEvidence({ ...stored }, products).product;
    const producerKey = manufacturerKey(product);
    if (producerKey && !product.allegroResponsibleProducer?.id) {
      const trustedProducer = [...products.values()].find((candidate) => (
        String(candidate?.id) !== productId
        && manufacturerKey(candidate) === producerKey
        && candidate?.allegroResponsibleProducer?.id
      ))?.allegroResponsibleProducer;
      if (trustedProducer?.id) product.allegroResponsibleProducer = structuredClone(trustedProducer);
    }
    const sourceUrl = sourceUrlOf(product);
    if (sourceUrl) {
      await progress({
        productName,
        phase: 'źródło',
        status: 'running',
        fields: ['ean', 'kodProducenta', 'producent', 'parametryProducenta', 'zdjecia'],
        target: sourceUrl,
        message: 'Pobieram fakty z przypisanej strony producenta: identyfikatory, producenta, parametry i właściwe zdjęcia produktu.',
      });
      const inspected = await inspectSource(sourceUrl).catch(() => null);
      const incoming = asObject(inspected?.product);
      const sourceCode = text(incoming.kodProducenta || incoming.numerReferencyjny || incoming.mpn || incoming.externalId || incoming.sku, 160).trim();
      const fill = {
        gtin: incoming.gtin || incoming.ean,
        ean: incoming.ean || incoming.gtin,
        kodProducenta: sourceCode,
        mpn: sourceCode,
        externalId: sourceCode,
        sku: sourceCode,
        producent: incoming.producent || incoming.marka,
        marka: incoming.marka || incoming.producent,
        parametryProducenta: incoming.parametryProducenta,
        parametryZrodla: incoming.parametryZrodla,
      };
      for (const [field, value] of Object.entries(fill)) {
        if ((product[field] === undefined || product[field] === null || String(product[field]).trim() === '') && value !== undefined && value !== null && value !== '') product[field] = value;
      }
      const inspectedImages = sourceImages(product, inspected || {});
      if (inspectedImages.ok) product = { ...product, ...inspectedImages.patch };
      product.sourceUrl = incoming.sourceUrl || incoming.producentUrl || sourceUrl;
      product.producentUrl = incoming.producentUrl || incoming.sourceUrl || sourceUrl;
      // Dowód galerii w wersji SOURCE_IMAGE_POLICY_VERSION jest częścią
      // inspectedImages.patch. Nie wolno nadpisać go starszym blokiem
      // sourceEvidence zwróconym przez parser strony.
      product.sourceEvidence = {
        ...(incoming.sourceEvidence && typeof incoming.sourceEvidence === 'object' ? incoming.sourceEvidence : {}),
        ...(product.sourceEvidence && typeof product.sourceEvidence === 'object' ? product.sourceEvidence : {}),
      };
      product.sourceMaterial = {
        url: product.sourceUrl,
        title: incoming.nazwa || incoming.name || '',
        shortDescription: incoming.opisKrotki || incoming.krotkiOpis || '',
        longDescription: incoming.opis || incoming.description || '',
        parameters: incoming.parametryProducenta || incoming.parametryZrodla || {},
        evidence: incoming.sourceEvidence || {},
        inspectedAt: inspected?.checkedAt || incoming.producentSprawdzonoAt || new Date().toISOString(),
      };
      // Dane strony są materiałem faktograficznym. Zastępują treść sklepu
      // automatycznie tylko wtedy, gdy obecne pole jest puste albo zawiera
      // wcześniej omyłkowo skopiowany interfejs sklepu producenta.
      if (usefulProductText(incoming.opisKrotki) && !usefulProductText(product.opisKrotki)) {
        product.opisKrotki = incoming.opisKrotki;
      }
      if (usefulProductText(incoming.opis) && !usefulProductText(product.opis)) {
        product.opis = incoming.opis;
      }
      await progress({
        productName,
        phase: 'źródło_pobrane',
        status: 'running',
        fields: Object.entries(fill).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([field]) => field),
        message: inspected
          ? 'Dane źródłowe zostały odczytane i dopasowane do pól tej kartoteki.'
          : 'Źródło nie zwróciło nowych danych. Kontynuuję na potwierdzonych danych kartoteki.',
      });
    }
    const auxiliary = await enrichProductFromAuxiliarySources({
      product,
      primaryUrl: sourceUrl,
      inspectSource,
    });
    product = auxiliary.product;
    if (auxiliary.evidence.length) {
      await progress({
        productName,
        phase: 'źródła_pomocnicze',
        status: 'running',
        fields: auxiliary.changedFields,
        message: 'Sprawdziłem źródła pomocnicze. Użyłem ich wyłącznie do uzupełnienia braków zgodnych z tożsamością produktu.',
      });
    }
    product = enrichAllegroProductEvidence(product, products).product;
    await progress({
      productName,
      phase: 'parametry',
      status: 'running',
      fields: Object.keys(asObject(product.allegroParameterEvidence)),
      message: `Dopasowuję parametry według faktycznego producenta „${product.producent || product.marka || 'nieustalony'}”, danych źródłowych i bezpiecznego konsensusu podobnych produktów.`,
    });

    const actor = { source: 'allegro-preparation-queue', email: task.requestedBy || 'administrator' };
    await progress({
      productName,
      phase: 'opisy',
      status: 'running',
      fields: ['nazwa', 'opisKrotki', 'opis', 'allegroTitle', 'allegroDescription'],
      message: task.skipEditorial === true
        ? 'Redakcja AI jest chwilowo odłożona; zapisuję teraz wszystkie pewne dane deterministyczne.'
        : 'Agent poprawia nazwę, opis krótki i długi oraz niezależnie kontroluje treść zgodną z zasadami Allegro.',
    });
    let editorial = editorialCurrent(product)
      ? {
          product,
          warnings: [],
          editorialReused: true,
        }
      : task.skipEditorial === true
      ? {
          product,
          warnings: ['Redakcja AI oczekuje na odnowienie limitu; dane źródłowe, kategoria i parametry są nadal przygotowywane.'],
          editorialSkipped: true,
        }
      : await editorialize(product, sourceUrl, actor);
    const firstChannelStates = asObject(asObject(editorial.product?.contentEditorial).channelStates);
    if (editorial.editorialReused !== true && task.skipEditorial !== true && (
      firstChannelStates.store?.status !== 'ready'
      || firstChannelStates.allegro?.status !== 'ready'
    )) {
      // Identyczne, zakończone kanały zostaną zwrócone z cache specjalistów.
      // Ponawiamy tylko dlatego, że co najmniej jeden kanał nie dostarczył
      // poprawnego wyniku strukturalnego albo nie przeszedł bramki jakości.
      editorial = await editorialize(product, sourceUrl, actor);
    }
    const unresolvedChannelStates = asObject(asObject(editorial.product?.contentEditorial).channelStates);
    if (
      unresolvedChannelStates.store?.status !== 'ready'
      || unresolvedChannelStates.allegro?.status !== 'ready'
    ) {
      const fallbackProduct = deterministicProductEditorialFallback(editorial.product || product);
      if (fallbackProduct) {
        editorial = {
          ...editorial,
          product: fallbackProduct,
          editorialFallback: true,
          warnings: [
            ...asArray(editorial.warnings),
            'Treść przygotowano lokalnie z potwierdzonego materiału źródłowego, ponieważ zewnętrzny redaktor nie zwrócił gotowego wyniku.',
          ],
        };
      }
    }
    product = editorial.product;
    await progress({
      productName,
      phase: 'kategoria_i_szkic',
      status: 'running',
      fields: ['allegroCategoryId', 'allegroProductId', 'allegroParameters', 'allegroDescriptionSections'],
      message: 'Dobieram katalog i kategorię Allegro, uzupełniam wymagane parametry oraz buduję finalny układ sekcji oferty.',
    });
    const draft = await prepareDraft(request, product, { publicationAction: 'keep', relatedProducts: products });
    const compliance = enforceDraft(draft.payload || {});
    await progress({
      productName,
      phase: 'kontrola',
      status: 'running',
      fields: ['ean', 'allegroCategoryId', 'allegroParameters', 'allegroSafetyInformation'],
      message: 'Sprawdzam tożsamość EAN/kodu producenta, kompletność parametrów, GPSR i zgodność opisu przed zapisem.',
    });
    const identityCheck = await verifyIdentity(request, product, compliance.draft, draft);
    const channelStates = asObject(asObject(editorial.product?.contentEditorial).channelStates);
    const missing = [...new Set([
      ...asArray(draft.missing),
      ...(compliance.compliance.ok ? [] : ['opis niezgodny z zasadami Allegro']),
      ...(identityCheck.ok ? [] : [identityCheck.reason]),
      ...(channelStates.store?.status === 'ready' ? [] : ['redakcja opisu sklepu przez Agenta']),
      ...(channelStates.allegro?.status === 'ready' ? [] : ['redakcja opisu Allegro przez Agenta']),
    ].filter(Boolean))];
    const auto = asObject(draft.autoFilled);
    const fields = {
      nazwa: product.nazwa,
      opisKrotki: product.opisKrotki,
      opis: product.opis,
      allegroTitle: product.allegroTitle || auto.allegroTitle,
      allegroShortDescription: stripEditorialExpandControls(product.allegroShortDescription || product.opisKrotki || ''),
      allegroDescription: product.allegroDescription,
      allegroDescriptionSections: compliance.draft?.description?.sections || product.allegroDescriptionSections,
      producent: auto.producent || product.producent,
      marka: auto.marka || product.marka || auto.producent || product.producent,
      gtin: auto.gtin || product.gtin || product.ean,
      ean: auto.ean || product.ean || product.gtin,
      kodProducenta: auto.kodProducenta || product.kodProducenta || product.mpn,
      mpn: auto.mpn || product.mpn || product.kodProducenta,
      zdjecie: auto.zdjecie || product.zdjecie,
      zdjecia: asArray(auto.zdjecia).length ? auto.zdjecia : product.zdjecia,
      sourceEvidence: auto.sourceEvidence || product.sourceEvidence,
      sourceMaterial: product.sourceMaterial,
      sourceUrl: product.sourceUrl,
      producentUrl: product.producentUrl,
      externalId: product.externalId,
      sku: product.sku,
      numerReferencyjny: product.numerReferencyjny,
      parametryProducenta: product.parametryProducenta,
      parametryZrodla: product.parametryZrodla,
      allegroCategoryId: auto.allegroCategoryId || product.allegroCategoryId,
      allegroCategoryName: auto.allegroCategoryName || product.allegroCategoryName,
      allegroCategoryResolution: auto.allegroCategoryResolution || product.allegroCategoryResolution,
      allegroProductId: auto.allegroProductId || product.allegroProductId,
      allegroParameters: auto.allegroParameters || product.allegroParameters,
      allegroParameterResolution: auto.allegroParameterResolution || product.allegroParameterResolution,
      allegroSafetyInformation: auto.allegroSafetyInformation || product.allegroSafetyInformation,
      allegroResponsibleProducer: auto.allegroResponsibleProducer || product.allegroResponsibleProducer,
      allegroParameterEvidence: product.allegroParameterEvidence,
      allegroSafetyInformationProvenance: product.allegroSafetyInformationProvenance,
      allegroShippingSubsidy: product.allegroShippingSubsidy ?? 3,
      allegroPreparationManifest: {
        version: 1,
        operation: draft.existingOffer ? 'update' : 'create',
        categoryId: auto.allegroCategoryId || product.allegroCategoryId || '',
        categoryName: auto.allegroCategoryName || product.allegroCategoryName || '',
        categorySource: auto.allegroCategoryResolution?.source || product.allegroCategoryResolution?.source || '',
        categoryConfidence: Number(auto.allegroCategoryResolution?.confidence || product.allegroCategoryResolution?.confidence) || 0,
        catalogProductId: auto.allegroProductId || product.allegroProductId || '',
        parameterCount: asArray(compliance.draft?.productSet?.[0]?.product?.parameters).length + asArray(compliance.draft?.parameters).length,
        descriptionSectionCount: asArray(compliance.draft?.description?.sections).length,
        shippingRateId: compliance.draft?.delivery?.shippingRates?.id || '',
        imageSource: draft.publicationReadiness?.imageSource || '',
        imageAdaptationRequired: draft.publicationReadiness?.imageAdaptationRequired === true,
        imageInspection: asArray(draft.publicationReadiness?.imageInspection).slice(0, 16),
        preparedAt: new Date().toISOString(),
      },
      contentEditorial: product.contentEditorial,
      contentEditorialPreparedAt: product.contentEditorialPreparedAt,
      contentEditorialSource: product.contentEditorialSource,
      vonHalskyTitle: product.vonHalskyTitle,
      vonHalskyShortDescription: product.vonHalskyShortDescription,
      vonHalskyDescription: product.vonHalskyDescription,
      vonHalskyContentMode: product.vonHalskyContentMode,
      vonHalskyContentUpdatedAt: product.vonHalskyContentUpdatedAt,
      vonHalskyContentSource: product.vonHalskyContentSource,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      seoKeywords: product.seoKeywords,
    };
    for (const key of Object.keys(fields)) if (fields[key] === undefined) delete fields[key];
    const editorialWarnings = asArray(editorial.warnings).map((warning) => String(warning || '').trim()).filter(Boolean);
    const finalEditorialStates = asObject(asObject(product.contentEditorial).channelStates);
    const providerUnavailable = (
      task.skipEditorial === true
      || editorialWarnings.some((warning) => providerQuotaUnavailable(warning))
    ) && (
      finalEditorialStates.store?.status !== 'ready'
      || finalEditorialStates.allegro?.status !== 'ready'
    );
    const ready = missing.length === 0, completedAt = new Date().toISOString(), fingerprintProduct = { ...stored, ...fields };
    const automaticAttempt = Math.max(1, Number(task.attempt) || 1);
    const disposition = allegroPreparationAttemptDisposition({
      ready,
      providerUnavailable,
      attempt: automaticAttempt,
    });
    const retry = providerUnavailable
      ? {
          retryCount: Math.max(1, Number(stored?.allegroAgentPreparationRetryCount) || 0) + 1,
          nextRetryAt: new Date(Date.parse(completedAt) + 6 * 60 * 60_000).toISOString(),
        }
      : allegroPreparationRetryState(stored, missing, { ready, now: new Date(completedAt) });
    const savedFields = changedFields(stored, fingerprintProduct, Object.keys(fields));
    Object.assign(fields, {
      allegroAgentPreparationStatus: disposition === 'completed'
        ? 'ready'
        : disposition === 'waiting_provider'
          ? 'waiting_provider'
          : disposition === 'decision_required'
            ? 'decision_required'
            : 'retrying',
      allegroAgentPreparationMissing: missing,
      allegroAgentSavedFields: savedFields,
      allegroAgentPreparedAt: completedAt,
      allegroAgentPreparationStartedAt: startedAt,
      allegroAgentPreparationSource: 'agent-serwerowy',
      allegroAgentDraftOperation: draft.existingOffer ? 'update' : 'create',
      allegroAgentCompliancePolicy: compliance.compliance.policyId || '',
      allegroAgentComplianceCheckedAt: compliance.compliance.checkedAt || completedAt,
      allegroAgentPreparationError: editorialWarnings.length ? editorialWarnings.join('; ').slice(0, 2000) : '',
      allegroAgentPreparationFingerprint: preparationFingerprint(fingerprintProduct),
      allegroAgentPreparationVersion: ALLEGRO_PREPARATION_VERSION,
      allegroAgentPreparationRunId: task.id,
      allegroAgentPreparationConfirmedAt: ready ? completedAt : '',
      allegroAgentPreparationRetryCount: retry.retryCount,
      allegroAgentPreparationNextRetryAt: disposition === 'decision_required' ? '' : retry.nextRetryAt,
      allegroAgentPreparationDecision: disposition === 'decision_required'
        ? {
            required: true,
            reason: 'automatic_remediation_exhausted',
            attempts: automaticAttempt,
            missing,
            createdAt: completedAt,
          }
        : null,
      // Jawna flaga naprawy jest zdarzeniem jednorazowym. Po potwierdzonym
      // odczycie kompletnego produktu musi zniknąć razem z technicznym błędem
      // zgodności, inaczej selektor ponownie zleci tę samą ciężką redakcję.
      ...(ready ? {
        forceEditorialRefresh: false,
        allegroComplianceError: '',
      } : {}),
    });
    // task.id pozostaje ten sam podczas automatycznych ponowień. Numer próby
    // rozdziela faktycznie różne wyniki, a jednocześnie zachowuje
    // idempotencję ponownego wysłania dokładnie tej samej próby.
    const mutationId = `allegro-preparation:${productId}:${task.id}:attempt-${Math.max(1, Number(task.attempt) || 1)}`;
    await progress({
      productName,
      phase: 'zapis',
      status: 'running',
      fields: savedFields,
      message: savedFields.length
        ? `Zapisuję ${savedFields.length} zmienionych pól do jedynej centralnej kartoteki i wykonuję odczyt potwierdzający.`
        : 'Nie wykryto zmiany wartości; zapisuję wynik kontroli i status przygotowania.',
    });
    const persisted = await saveProduct({
      productId,
      fields,
      mutationId,
      actor: task.requestedBy || 'administrator',
      area: 'allegro-preparation',
    });
    await progress({
      productName: persisted.product?.nazwa || productName,
      phase: ready
        ? 'zapis_potwierdzony'
        : disposition === 'waiting_provider'
          ? 'oczekiwanie_na_dostawce'
          : disposition === 'decision_required'
            ? 'decyzja_wymagana'
            : 'automatyczna_korekta',
      status: ready
        ? 'confirmed'
        : disposition === 'waiting_provider'
          ? 'waiting_provider'
          : disposition === 'decision_required'
            ? 'decision_required'
            : 'pending',
      fields: savedFields,
      nextRetryAt: disposition === 'decision_required' ? '' : retry.nextRetryAt,
      message: ready
        ? `Zapis centralny potwierdzony. Produkt jest gotowy do wystawienia lub aktualizacji w Allegro.${savedFields.length ? ` Zmieniono: ${savedFields.join(', ')}.` : ''}`
        : disposition === 'waiting_provider'
          ? `Zapisano wszystkie dane niezależne od AI. Redakcja zostanie wznowiona automatycznie po odnowieniu dostępu dostawcy; brakujące pola: ${missing.join(', ')}.`
          : disposition === 'decision_required'
            ? `Automatyczne sposoby uzupełnienia zostały wyczerpane. Potrzebna jest konkretna decyzja wyłącznie dla: ${missing.join(', ')}.`
            : `Zapisano wynik próby ${automaticAttempt}. Brakuje: ${missing.join(', ')}. Następna korekta jest już częścią tej samej kolejki.`,
    });
    return {
      status: disposition,
      ready,
      name: persisted.product?.nazwa || product.nazwa || `Produkt ${productId}`,
      missing,
      savedFields,
      mutationId,
      providerUnavailable,
      nextRetryAt: disposition === 'decision_required' ? '' : retry.nextRetryAt,
      decision: disposition === 'decision_required'
        ? {
            reason: 'automatic_remediation_exhausted',
            attempts: automaticAttempt,
            missing,
          }
        : null,
      error: providerUnavailable ? editorialWarnings.join('; ').slice(0, 1000) : '',
    };
  };
}
