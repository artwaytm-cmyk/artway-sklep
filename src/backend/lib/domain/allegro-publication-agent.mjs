export const ALLEGRO_AGENT_OFFER_PROCEDURE = Object.freeze([
  'Najpierw sprawdź poprawność cyfry kontrolnej EAN/GTIN, a następnie zgodność GTIN, nazwy, producenta i parametrów.',
  'Traktuj producenta, markę i wydawcę jako trzy osobne fakty. Przykład: producent Alexander, marka MilliWOOD. Jeśli słownik Allegro nie zawiera marki, użyj dopuszczalnej wartości właściciela marki wyłącznie w parametrze kanału i nie nadpisuj marki w sklepie.',
  'Każdy parametr dopasuj do aktualnego ID kategorii, typu, słownika i ograniczeń zwróconych przez API Allegro. Zapisz źródło wartości oraz ewentualny fallback słownikowy.',
  'Jeżeli oferta istnieje, połącz ją z produktem i aktualizuj zamiast tworzyć duplikat.',
  'Nigdy nie wybieraj produktu katalogowego po samej nazwie ani samym MPN. UUID katalogu wolno zapisać tylko po dokładnej weryfikacji lub ręcznej decyzji administratora.',
  'Jeżeli produktu nie ma EAN, przygotuj nową kartotekę z kategorią i kompletem parametrów, bez podpinania istniejącego UUID katalogowego.',
  'Uzupełnij producenta, markę, wydawcę, EAN, MPN, kategorię, UUID i wszystkie wymagane parametry. Zdjęcia pobieraj wyłącznie z konkretnego linku źródłowego produktu; nigdy z podobnej oferty ani katalogu Allegro.',
  'Każde zdjęcie zweryfikuj technicznie: właściwy produkt, dłuższy bok 500–2560 px, obsługiwany format i poprawny odczyt. Obraz 300–499 px albo większy niż 2560 px dopasuj z zachowaniem proporcji, orientacji i bez dodawania napisów; następnie wyślij przez /sale/images.',
  'Nie ustawiaj rynków na siłę. Nie wysyłaj additionalMarketplaces ani osobnych cen dla allegro-cz, allegro-sk lub allegro-hu; odczytaj wynik i zaraportuj bazowy rynek. Nie zmieniaj samodzielnie cenników dostawy, a jako domyślny stosuj istniejący cennik artway2.',
  'Nową ofertę zapisz jako INACTIVE; brak stanu magazynowego oznacza 0.',
  'Po sukcesie odczytaj ofertę ponownie. Sukces wymaga offerId, potwierdzonego statusu, odczytanego rynku bazowego, zapisanego zdjęcia oraz powiązania produkt sklepu–produkt katalogowy–oferta; rynku nie ustawiaj na siłę.',
  'Jeżeli brakuje danych, nie zgaduj: zapisz dokładne braki i błąd API do jednej kolejki ponowienia.',
]);

export function buildAllegroPublicationSuccessFields({
  text = (value, limit = 1000) => String(value ?? '').slice(0, limit).trim(),
  product = {},
  details = {},
  link = {},
  autoPatch = {},
  now = new Date().toISOString(),
} = {}) {
  const verifiedStatus = text(
    details.verifiedOffer?.status || details.verifiedOffer?.publication?.status
      || details.offer?.status || details.offer?.publication?.status || details.expectedStatus || '',
    80,
  ).toUpperCase();
  const marketplace = text(details.verifiedOffer?.publication?.marketplaces?.base?.id, 80);
  const imagePublication = details.imagePublication && typeof details.imagePublication === 'object' ? details.imagePublication : {};
  return {
    ...autoPatch, allegroOfferId: text(details.offerId, 100),
    ...(Number.isFinite(Number(details.draft?.stock?.available)) ? { allegroStock: Math.max(0, Math.floor(Number(details.draft.stock.available))) } : {}),
    ...(link.catalogProductId ? { allegroProductId: link.catalogProductId } : {}),
    ...(link.categoryId ? { allegroCategoryId: link.categoryId } : {}),
    ...(link.producent ? { producent: link.producent } : {}),
    ...(verifiedStatus ? { allegroStatus: verifiedStatus } : {}),
    allegroSyncedAt: now, allegroSyncSource: 'artway-store',
    allegroAgentPreparationStatus: 'published', allegroAgentPreparationMissing: [],
    allegroAgentPreparationError: '', allegroAgentPublishedAt: now,
    allegroPublicationAgentStatus: 'completed', allegroPublicationLastSuccessAt: now,
    allegroMarketplaceId: marketplace,
    allegroImagePublishedCount: Array.isArray(imagePublication.published) ? imagePublication.published.length : 0,
    allegroImageAdaptedCount: Array.isArray(imagePublication.published) ? imagePublication.published.filter((item) => item?.adapted).length : 0,
    allegroImagePublishedAt: Array.isArray(imagePublication.published) && imagePublication.published.length ? now : text(product.allegroImagePublishedAt, 80),
    allegroPublicationLastErrorCode: '', allegroPublicationLastError: '',
    allegroPublicationAgentTaskId: '', allegroPublicationReportId: '', allegroPublicationSpecialistRunId: '',
  };
}

export function createAllegroPublicationAgent({
  text, canonicalGtin, linkFromPreparation, runSpecialist, saveProductFields,
  onRepairRequired = null,
  now = () => new Date(),
} = {}) {
  if (![text, canonicalGtin, linkFromPreparation, runSpecialist, saveProductFields].every((fn) => typeof fn === 'function')) {
    throw new Error('Operator publikacji Allegro wymaga pełnego zestawu zależności.');
  }
  async function recordFailure(product = {}, details = {}) {
    const productId = text(product.id, 100).trim();
    if (!productId) return null;
    const missing = [...new Set((Array.isArray(details.missing) ? details.missing : []).map((item) => text(item, 250)).filter(Boolean))];
    const errors = (Array.isArray(details.errors) ? details.errors : []).map((item) => ({
      code: text(item?.code || '', 120), message: text(item?.userMessage || item?.message || item || '', 700), path: text(item?.path || '', 300),
      metadata: item?.metadata && typeof item.metadata === 'object' ? Object.fromEntries(Object.entries(item.metadata).slice(0, 20).map(([key, value]) => [text(key, 80), text(value, 500)])) : {},
    })).filter((item) => item.message || item.code).slice(0, 20);
    const link = linkFromPreparation(product, details.prepared || {}, details.draft || {});
    const auto = details.prepared?.autoFilled || {}, catalog = details.prepared?.catalogMatch?.selected || null;
    let specialistRun = null, specialistError = '';
    if (errors.length) {
      try {
        specialistRun = await runSpecialist({
          specialist: 'allegro_publication', source: 'automatic',
          instruction: 'Przeanalizuj zapisany błąd publikacji tego produktu. Podaj przyczynę, wyłącznie bezpieczne korekty i plan jednej ponownej próby. Nie deklaruj wykonania ani publikacji.',
          context: {
            product: { id: productId, name: text(product.nazwa || product.name, 300), gtin: canonicalGtin(product.gtin || product.ean || ''), manufacturer: text(product.producent || product.marka, 160), categoryId: text(product.allegroCategoryId, 100) },
            errors, missing,
            catalog: catalog ? { id: text(catalog.id, 160), name: text(catalog.name, 300), categoryId: text(catalog.categoryId, 100), identity: catalog.identity || null } : null,
            operationId: text(details.operationId, 160),
          },
          target: { type: 'product', productId, name: text(product.nazwa || product.name, 180), operationId: text(details.operationId, 160) },
        }, { source: 'allegro-publication-failure' });
      } catch (error) {
        specialistError = text(error?.message || error, 700);
      }
    }
    const timestamp = now().toISOString();
    // Nie twórz drugiej, przeglądarkowej kolejki. Źródłem prawdy jest
    // artway_allegro_preparation_tasks, a w kartotece produktu zapisujemy
    // wyłącznie bieżący stan i identyfikator konkretnej próby.
    const task = {
      id: `allegro-publication:${productId}:${Date.now().toString(36)}`,
      typ: 'allegro-oferta', specialist: 'allegro_publication', status: errors.length ? 'failed' : 'attention', productId,
      productName: text(product.nazwa || product.name || `Produkt ${productId}`, 300), producent: link.producent, missing, errors,
      suggestions: {
        allegroCategoryId: auto.allegroCategoryId || link.categoryId, allegroProductId: auto.allegroProductId || link.catalogProductId,
        producent: auto.producent || link.producent, marka: auto.marka || '', gtin: auto.gtin || auto.ean || '', ean: auto.ean || auto.gtin || '',
        kodProducenta: auto.kodProducenta || auto.mpn || '', mpn: auto.mpn || auto.kodProducenta || '', zdjecie: auto.zdjecie || '',
        zdjecia: Array.isArray(auto.zdjecia) ? auto.zdjecia.slice(0, 15) : [], allegroParameters: Array.isArray(auto.allegroParameters) ? auto.allegroParameters : [],
      },
      operationId: text(details.operationId, 160), catalogIdentity: catalog?.identity || null,
      specialistRunId: specialistRun?.id || '', agentDiagnosis: specialistRun?.result || null, specialistError,
      procedure: ALLEGRO_AGENT_OFFER_PROCEDURE, decision: details.prepared?.agentDecision || null,
      sourceUrl: text(product.sourceUrl || product.producentUrl || '', 800),
      attempts: Math.max(0, Number(product.allegroPublicationFailureCount) || 0) + 1,
      createdAt: timestamp, updatedAt: timestamp,
    };
    try {
      await saveProductFields({
        productId,
        fields: {
          allegroPublicationAgentStatus: errors.length ? 'repair_required' : 'preparing', allegroPublicationLastAttemptAt: timestamp,
          allegroPublicationLastErrorCode: errors[0]?.code || '', allegroPublicationLastError: errors[0]?.message || missing.join(', '),
          allegroPublicationAgentTaskId: task.id, allegroPublicationReportId: text(details.operationId, 160),
          allegroPublicationSpecialistRunId: specialistRun?.id || '',
          allegroPublicationFailureCount: errors.length ? task.attempts : Math.max(0, Number(product.allegroPublicationFailureCount) || 0),
        },
        mutationId: `allegro-publication-failure:${productId}:${task.id}`, actor: 'agent-allegro-publication', area: 'allegro-publication',
      });
    } catch (error) {
      task.productRecordError = text(error?.message || error, 700);
    }
    if (typeof onRepairRequired === 'function') {
      try {
        task.queue = await onRepairRequired(productId, {
          operationId: task.operationId,
          taskId: task.id,
          missing,
          errors,
        });
      } catch (error) {
        task.queueError = text(error?.message || error, 700);
      }
    }
    return task;
  }
  return Object.freeze({ recordFailure });
}
