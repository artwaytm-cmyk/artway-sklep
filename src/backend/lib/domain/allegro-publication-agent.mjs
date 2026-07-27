export const ALLEGRO_AGENT_OFFER_PROCEDURE = Object.freeze([
  'Najpierw sprawdź poprawność cyfry kontrolnej EAN/GTIN, a następnie zgodność GTIN, nazwy, producenta i parametrów.',
  'Jeżeli oferta istnieje, połącz ją z produktem i aktualizuj zamiast tworzyć duplikat.',
  'Nigdy nie wybieraj produktu katalogowego po samej nazwie ani samym MPN. UUID katalogu wolno zapisać tylko po dokładnej weryfikacji lub ręcznej decyzji administratora.',
  'Jeżeli produktu nie ma EAN, przygotuj nową kartotekę z kategorią i kompletem parametrów, bez podpinania istniejącego UUID katalogowego.',
  'Uzupełnij producenta, markę, EAN, MPN, kategorię, UUID i parametry. Zdjęcia pobieraj wyłącznie z konkretnego linku źródłowego produktu; nigdy z podobnej oferty ani katalogu Allegro.',
  'Nową ofertę zapisz jako INACTIVE; brak stanu magazynowego oznacza 0.',
  'Po sukcesie zapisz powiązanie produkt sklepu–produkt katalogowy–oferta i zamknij zadanie.',
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
    allegroPublicationLastErrorCode: '', allegroPublicationLastError: '',
    allegroPublicationAgentTaskId: '', allegroPublicationReportId: '', allegroPublicationSpecialistRunId: '',
  };
}

export function createAllegroPublicationAgent({
  text, canonicalGtin, linkFromPreparation, runSpecialist, mutateSettings, saveProductFields,
  now = () => new Date(),
} = {}) {
  if (![text, canonicalGtin, linkFromPreparation, runSpecialist, mutateSettings, saveProductFields].every((fn) => typeof fn === 'function')) {
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
    let task = null;
    await mutateSettings((data) => {
      const tasks = Array.isArray(data.artway_agent_ai_allegro_zadania) ? [...data.artway_agent_ai_allegro_zadania] : [];
      const index = tasks.findIndex((item) => String(item.productId) === productId && !['wykonane', 'anulowane'].includes(String(item.status || '').toLowerCase()));
      const previous = index >= 0 ? tasks[index] : {};
      task = {
        ...previous,
        id: previous.id || `AA-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        typ: 'allegro-oferta', specialist: 'allegro_publication', status: errors.length ? 'błąd API' : 'oczekuje', productId,
        productName: text(product.nazwa || product.name || `Produkt ${productId}`, 300), producent: link.producent, missing, errors,
        suggestions: {
          allegroCategoryId: auto.allegroCategoryId || link.categoryId, allegroProductId: auto.allegroProductId || link.catalogProductId,
          producent: auto.producent || link.producent, marka: auto.marka || '', gtin: auto.gtin || auto.ean || '', ean: auto.ean || auto.gtin || '',
          kodProducenta: auto.kodProducenta || auto.mpn || '', mpn: auto.mpn || auto.kodProducenta || '', zdjecie: auto.zdjecie || '',
          zdjecia: Array.isArray(auto.zdjecia) ? auto.zdjecia.slice(0, 15) : [], allegroParameters: Array.isArray(auto.allegroParameters) ? auto.allegroParameters : [],
        },
        operationId: text(details.operationId || previous.operationId, 160), catalogIdentity: catalog?.identity || null,
        specialistRunId: specialistRun?.id || '', agentDiagnosis: specialistRun?.result || null, specialistError,
        procedure: ALLEGRO_AGENT_OFFER_PROCEDURE, decision: details.prepared?.agentDecision || null,
        sourceUrl: text(product.sourceUrl || product.producentUrl || '', 800),
        attempts: (Number(previous.attempts) || 0) + 1, createdAt: previous.createdAt || timestamp, updatedAt: timestamp,
      };
      if (index >= 0) tasks[index] = task; else tasks.unshift(task);
      data.artway_agent_ai_allegro_zadania = tasks.slice(0, 500);
      const history = Array.isArray(data.artway_agent_ai_historia) ? data.artway_agent_ai_historia : [];
      history.unshift({ id: `AI-${Date.now().toString(36)}`, typ: 'allegro-oferta', opis: `Oferta produktu ${task.productName} wymaga pracy agenta: ${[...missing, ...errors.map((item) => item.message)].join(', ') || 'weryfikacja danych'}.`, data: timestamp, dataTxt: now().toLocaleString('pl-PL'), operator: 'Operator publikacji Allegro', dane: { productId, taskId: task.id, operationId: task.operationId, specialistRunId: task.specialistRunId } });
      data.artway_agent_ai_historia = history.slice(0, 500);
      return true;
    }, { updatedAt: timestamp });
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
    return task;
  }
  return Object.freeze({ recordFailure });
}
