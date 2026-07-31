function flattenCategories(items = [], parents = []) {
  return (Array.isArray(items) ? items : []).flatMap((item) => {
    const name = String(item?.name || '').trim();
    const current = {
      id: String(item?.id || ''),
      name,
      leaf: item?.leaf === true,
      doesNotRequireGpsrInfo: item?.doesNotRequireGpsrInfo === true,
      path: [...parents, name].filter(Boolean).join(' › '),
    };
    return [current, ...flattenCategories(item?.children, [...parents, name])];
  }).filter((item) => item.id);
}

export function createVonHalskyAgentRoute(context = {}) {
  const {
    respond, readVersioned, STORE_KEY, initialState, cleanState, api, mutate,
    recordDiagnostic, loadCatalog, sourceUrlOf, inspectSource, sourceImages,
    resolveVonHalskyResponsibleProducer, categoryIndexFor,
    suggestVonHalskyCategory, matchVonHalskyAttributes,
    vonHalskyAgentPreparationPatch, saveProductFields, sessionOf, progress,
    updateProductPublication, prepareProductWithAgent, safeError, matchingText,
    matchingGtin, categoryRejectionForProduct, remoteOfferSummary,
    commandReceipt, mergeBy, summarizeVonHalskyCatalog,
    deduplicateVonHalskyOffers, vonHalskyOfferProposal,
    vonHalskyOfferProjection, vonHalskyProductReadiness,
    vonHalskyPublicConfig, normalizeVonHalskySettings, env,
  } = context;
  return async function route(req, url, action) {
    if (action === 'von-halsky-agent-prepare') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (typeof saveProductFields !== 'function' || typeof prepareProductWithAgent !== 'function') {
        return respond({ ok: false, error: 'Serwerowy Agent albo centralna kartoteka produktów nie są dostępne.' }, 503);
      }
      const body = await req.json().catch(() => ({}));
      const productIds = [...new Set((Array.isArray(body.productIds) ? body.productIds : [body.productId])
        .map((value) => matchingText(value, 200))
        .filter(Boolean))].slice(0, 50);
      if (!productIds.length) return respond({ ok: false, error: 'Wybierz co najmniej jeden produkt do przygotowania.' }, 422);
      const actor = sessionOf(req) || { source: 'admin-von-halsky' };
      let state = cleanState((await readVersioned(STORE_KEY, initialState())).value);
      const config = vonHalskyPublicConfig(env());
      if (!state.settings.agentPreparationEnabled) {
        return respond({ ok: false, error: 'Przygotowanie przez Agenta jest wyłączone w ustawieniach Von Halsky.' }, 409);
      }
      if (!state.categories.length && config.configured) {
        try {
          const result = await api.fetchCategories({ depth: 4 });
          const categories = flattenCategories(result.payload).filter((item) => item.leaf);
          state = await mutate((draft) => {
            draft.categories = categories;
            return draft;
          });
        } catch { /* treść i pozostałe kontrole mogą działać bez połączenia kategorii */ }
      }
      const loaded = await loadCatalog();
      const products = Array.isArray(loaded) ? loaded : [...(loaded?.values?.() || [])];
      const productById = new Map(products.map((product) => [String(product?.id), product]));
      const categoryIndex = categoryIndexFor(state.categories);
      const publishedExternalIds = new Set((state.offers || [])
        .filter((item) => String(item?.status || item?.offer?.status || '').toUpperCase() === 'PUBLISHED')
        .map((item) => matchingText(item?.externalId || item?.offer?.externalId, 200))
        .filter(Boolean));
      const trustedProductIds = new Set(products
        .filter((item) => publishedExternalIds.has(matchingText(item?.externalId || item?.sku || item?.id, 200)))
        .map((item) => String(item?.id)));
      const results = [];
      for (const productId of productIds) {
        const product = productById.get(productId);
        if (!product) {
          results.push({ productId, status: 'error', error: 'Produkt nie istnieje w centralnej kartotece.' });
          continue;
        }
        const timestamp = new Date().toISOString();
        const workId = `von-halsky-agent:${productId}:${Date.now().toString(36)}`;
        let categoryMatch = null, attributeMatch = null, deterministicFields = {}, workingProduct = product;
        const savedFieldNames = new Set();
        try {
          await progress({
            id: workId, productId, productName: matchingText(product.nazwa || product.name, 180),
            channel: 'vonHalsky', action: 'przygotowanie produktu', phase: 'matching', status: 'running',
            target: 'katalog InPost Von Halsky',
            message: `Dopasowuję produkt do ${categoryIndex.size} końcowych kategorii z aktualnego drzewa API Von Halsky.`,
          });
          const sourceUrl = matchingText(sourceUrlOf(product), 2000);
          if (
            sourceUrl
            && typeof inspectSource === 'function'
            && typeof sourceImages === 'function'
            && !vonHalskyProductReadiness(workingProduct).hasImage
          ) {
            try {
              const inspection = await inspectSource(sourceUrl);
              const verifiedImages = sourceImages(workingProduct, inspection || {});
              if (verifiedImages?.ok && verifiedImages.patch) {
                const imageFields = {
                  ...verifiedImages.patch,
                  vonHalskySourceImageStatus: 'verified',
                  vonHalskySourceImageVerifiedAt: timestamp,
                };
                await saveProductFields({
                  productId,
                  fields: imageFields,
                  mutationId: `von-halsky-source-images:${productId}:${Date.now()}`,
                  actor: matchingText(actor?.email || actor?.name || actor?.source || 'von-halsky-agent', 200),
                  area: 'von-halsky-source-images',
                });
                Object.keys(imageFields).forEach((field) => savedFieldNames.add(field));
                workingProduct = { ...workingProduct, ...imageFields };
              } else {
                deterministicFields.vonHalskySourceImageStatus = 'requires_data';
                deterministicFields.vonHalskySourceImageEvidence = {
                  sourceUrl,
                  identityMode: matchingText(verifiedImages?.identity?.mode, 120),
                  reason: 'Źródło nie potwierdziło galerii należącej do tej kartoteki.',
                };
              }
            } catch (error) {
              deterministicFields.vonHalskySourceImageStatus = 'retry';
              deterministicFields.vonHalskySourceImageEvidence = {
                sourceUrl,
                reason: matchingText(error?.message || error, 500),
              };
            }
          }
          const categoryRejection = categoryRejectionForProduct(state, workingProduct);
          const responsibleProducer = resolveVonHalskyResponsibleProducer(workingProduct);
          deterministicFields.vonHalskyGpsrRequired = true;
          deterministicFields.vonHalskyResponsibleProducerStatus = responsibleProducer.ready ? 'ready' : 'requires_data';
          deterministicFields.vonHalskyResponsibleProducerMissing = responsibleProducer.missing;
          deterministicFields.vonHalskyResponsibleProducerEvidence = responsibleProducer.evidence;
          if (responsibleProducer.ready) deterministicFields.vonHalskyResponsibleProducer = responsibleProducer.value;
          const existingCategoryId = categoryRejection.rejected
            ? ''
            : matchingText(workingProduct.vonHalskyCategoryId || workingProduct.inpostVonHalskyCategoryId, 100);
          categoryMatch = suggestVonHalskyCategory(workingProduct, state.categories, {
            minimumConfidence: state.settings.agentMinimumConfidence,
            categoryIndex,
            relatedProducts: products,
            trustedProductIds,
          });
          let categoryId = existingCategoryId;
          if (categoryId && categoryIndex.size && !categoryIndex.ids.has(categoryId)) {
            categoryId = '';
            deterministicFields.vonHalskyCategoryId = '';
            deterministicFields.vonHalskyCategoryName = '';
            deterministicFields.vonHalskyCategoryPath = '';
            deterministicFields.vonHalskyCategoryRejectedAt = timestamp;
            deterministicFields.vonHalskyCategoryRejection = {
              rejected: true,
              reason: 'Kategoria nie występuje w aktualnym drzewie API Von Halsky.',
              previousCategoryId: existingCategoryId,
            };
          }
          if (categoryRejection.rejected) {
            deterministicFields.vonHalskyCategoryId = '';
            deterministicFields.vonHalskyCategoryName = '';
            deterministicFields.vonHalskyCategoryPath = '';
            deterministicFields.vonHalskyCategoryRejectedAt = timestamp;
            deterministicFields.vonHalskyCategoryRejection = categoryRejection;
          }
          if (!categoryId && categoryMatch.autoApplicable && state.settings.agentCategoryAutoMatchEnabled !== false) {
            categoryId = categoryMatch.selected.id;
            deterministicFields.vonHalskyCategoryId = categoryId;
            deterministicFields.vonHalskyCategoryName = categoryMatch.selected.name;
            deterministicFields.vonHalskyCategoryMatchedBy = categoryMatch.source === 'accepted_catalog_consensus'
              ? 'accepted-catalog-consensus'
              : 'agent-api-tree';
            deterministicFields.vonHalskyCategoryMatchedAt = timestamp;
            deterministicFields.vonHalskyCategoryPath = categoryMatch.selected.path;
            deterministicFields.vonHalskyCategoryRejection = null;
            deterministicFields.vonHalskyCategoryResolution = {
              categoryId,
              name: categoryMatch.selected.name,
              path: categoryMatch.selected.path,
              source: categoryMatch.source,
              confidence: categoryMatch.confidence,
              margin: categoryMatch.margin,
              evidence: categoryMatch.selected.evidence || [],
              categoryTreeSize: categoryMatch.categoryTreeSize,
              rulesVersion: categoryMatch.rulesVersion,
              resolvedAt: timestamp,
            };
          }
          if (categoryId && config.configured && state.settings.agentAttributeAutoMatchEnabled !== false) {
            try {
              const attributesResult = await api.fetchCategoryAttributes(categoryId);
              attributeMatch = matchVonHalskyAttributes(workingProduct, attributesResult.payload);
              if (Object.keys(attributeMatch.mapped).length) {
                deterministicFields.vonHalskyAttributes = {
                  ...(workingProduct.vonHalskyAttributes || {}),
                  ...attributeMatch.mapped,
                };
              }
            } catch (error) {
              attributeMatch = {
                mapped: {},
                evidence: [],
                required: 0,
                mappedRequired: 0,
                coverage: 0,
                missingRequired: [],
                error: safeError(error).message,
              };
            }
          }
          if (Object.keys(deterministicFields).length) {
            await saveProductFields({
              productId,
              fields: deterministicFields,
              mutationId: `von-halsky-agent-evidence:${productId}:${Date.now()}`,
              actor: matchingText(actor?.email || actor?.name || actor?.source || 'von-halsky-agent', 200),
              area: 'von-halsky-agent-evidence',
            });
            Object.keys(deterministicFields).forEach((field) => savedFieldNames.add(field));
            workingProduct = { ...workingProduct, ...deterministicFields };
            Object.assign(product, deterministicFields);
          }
          await progress({
            id: workId, productId, productName: matchingText(product.nazwa || product.name, 180),
            channel: 'vonHalsky', action: 'przygotowanie produktu', phase: 'editorial', status: 'running',
            target: 'katalog InPost Von Halsky',
            fields: ['vonHalskyTitle', 'vonHalskyShortDescription', 'vonHalskyDescription'],
            message: 'Agent redaguje kartę kanału i przekazuje ją do deterministycznej kontroli zgodności.',
          });
          const agent = await prepareProductWithAgent(productId, actor, { source: body.source === 'automatic' ? 'automatic' : 'manual' });
          Object.keys(agent?.applied?.persistedPatch || agent?.applied?.patch || {})
            .forEach((field) => savedFieldNames.add(field));
          const merged = {
            ...workingProduct,
            ...deterministicFields,
            ...(agent?.applied?.persistedPatch || {}),
            ...(agent?.applied?.patch || {}),
          };
          const readiness = vonHalskyProductReadiness(merged);
          const finalPatch = vonHalskyAgentPreparationPatch({
            product: merged,
            readiness,
            categoryMatch,
            attributeMatch,
            timestamp: new Date().toISOString(),
            status: agent?.retryScheduled ? 'retry' : readiness.publishable ? 'ready' : 'requires_data',
            savedFields: [...savedFieldNames],
            runId: agent?.run?.id || workId,
          });
          const finalSave = await saveProductFields({
            productId,
            fields: finalPatch,
            mutationId: `von-halsky-agent-result:${productId}:${Date.now()}`,
            actor: matchingText(actor?.email || actor?.name || actor?.source || 'von-halsky-agent', 200),
            area: 'von-halsky-agent-preparation',
          });
          const confirmedAt = new Date().toISOString();
          const confirmationFields = {
            vonHalskyAgentConfirmedAt: confirmedAt,
            vonHalskyAgentSaveState: 'confirmed',
            vonHalskyAgentReadbackConfirmed: true,
          };
          const confirmedSave = await saveProductFields({
            productId,
            fields: confirmationFields,
            mutationId: `von-halsky-agent-confirmed:${productId}:${agent?.run?.id || workId}`,
            actor: matchingText(actor?.email || actor?.name || actor?.source || 'von-halsky-agent', 200),
            area: 'von-halsky-agent-confirmation',
          });
          Object.keys(confirmationFields).forEach((field) => savedFieldNames.add(field));
          await progress({
            id: workId, runId: agent?.run?.id, productId, productName: matchingText(product.nazwa || product.name, 180),
            channel: 'vonHalsky', action: 'przygotowanie produktu', phase: readiness.publishable ? 'ready' : 'requires_data',
            status: readiness.publishable ? 'confirmed' : 'attention', target: 'katalog InPost Von Halsky',
            fields: Object.keys(agent?.applied?.patch || {}),
            completedAt: new Date().toISOString(),
            message: readiness.publishable
              ? 'Kartoteka została zapisana i po odczycie kontrolnym spełnia wymagania publikacji.'
              : `Zapisano bezpieczne poprawki. Pozostało: ${[...readiness.issues, ...readiness.publicationIssues].join(', ') || 'kontrola operatora'}.`,
          });
          results.push({
            productId,
            name: matchingText(product.nazwa || product.name, 180),
            status: finalPatch.vonHalskyAgentStatus,
            score: readiness.score,
            issues: finalPatch.vonHalskyAgentIssues,
            warnings: finalPatch.vonHalskyAgentWarnings,
            category: categoryId ? {
              id: categoryId,
              name: deterministicFields.vonHalskyCategoryName || categoryIndex.byId.get(categoryId)?.name || '',
              path: deterministicFields.vonHalskyCategoryPath || categoryIndex.byId.get(categoryId)?.path || '',
              source: deterministicFields.vonHalskyCategoryResolution?.source || workingProduct.vonHalskyCategoryMatchedBy || 'existing',
              confidence: deterministicFields.vonHalskyCategoryResolution?.confidence ?? null,
              evidence: deterministicFields.vonHalskyCategoryResolution?.evidence || [],
            } : null,
            categorySuggestion: !categoryId ? categoryMatch?.selected : null,
            categoryTreeSize: categoryIndex.size,
            responsibleProducer: responsibleProducer.ready ? {
              name: responsibleProducer.value.legalName,
              status: 'ready',
              source: responsibleProducer.value.source,
            } : {
              name: matchingText(product.producent || product.marka, 180),
              status: 'requires_data',
              missing: responsibleProducer.missing,
            },
            attributeCoverage: attributeMatch?.coverage ?? null,
            saved: true,
            readbackConfirmed: confirmedSave?.publication?.readbackConfirmed === true,
            confirmedAt,
            revision: confirmedSave?.publication?.revision || confirmedSave?.rev || finalSave?.publication?.revision || '',
            savedFields: [...new Set([...finalPatch.vonHalskyAgentSavedFields, ...Object.keys(confirmationFields)])],
            runId: agent?.run?.id || '',
            product: confirmedSave?.product || finalSave?.product || null,
          });
        } catch (error) {
          const safe = safeError(error);
          const readiness = vonHalskyProductReadiness({ ...product, ...deterministicFields });
          const failurePatch = vonHalskyAgentPreparationPatch({
            product: { ...product, ...deterministicFields },
            readiness,
            categoryMatch,
            attributeMatch,
            timestamp: new Date().toISOString(),
            status: 'error',
            error: safe.message,
            savedFields: [...savedFieldNames],
            runId: workId,
          });
          await saveProductFields({
            productId,
            fields: failurePatch,
            mutationId: `von-halsky-agent-error:${productId}:${Date.now()}`,
            actor: 'von-halsky-agent',
            area: 'von-halsky-agent-preparation',
          }).catch(() => {});
          await progress({
            id: workId, productId, productName: matchingText(product.nazwa || product.name, 180),
            channel: 'vonHalsky', action: 'przygotowanie produktu', phase: 'failed', status: 'failed',
            target: 'katalog InPost Von Halsky', error: safe.message,
            message: 'Agent nie potwierdził pełnego przygotowania. Zapisano dokładny błąd, a produktu nie przekazano do publikacji.',
          });
          results.push({ productId, name: matchingText(product.nazwa || product.name, 180), status: 'error', error: safe.message, saved: false });
        }
      }
      const ready = results.filter((item) => item.status === 'ready').length;
      const requiresData = results.filter((item) => ['requires_data', 'retry'].includes(item.status)).length;
      const failed = results.filter((item) => item.status === 'error').length;
      await recordDiagnostic({
        operation: 'agent-prepare',
        status: failed ? 'warning' : 'ok',
        message: `Agent przygotował ${results.length} produktów: gotowe ${ready}, wymagają danych ${requiresData}, błędy ${failed}.`,
      });
      // Błąd pojedynczej kartoteki nie unieważnia poprawnie zapisanych wyników
      // całej partii. Frontend musi dostać pełny raport, aby pokazać operatorowi
      // dokładne produkty wymagające poprawy zamiast zgubić wyniki w wyjątku HTTP.
      return respond({
        ok: true,
        partial: failed > 0,
        processed: results.length,
        ready,
        requiresData,
        failed,
        results,
        published: false,
      });
    }


    return null;
  };
}
