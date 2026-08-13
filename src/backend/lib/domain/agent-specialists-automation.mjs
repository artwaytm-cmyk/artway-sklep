export function createAgentSpecialistAutomation(context = {}) {
  const {
    readState, clean, normalizeProductContentEditorialResult,
    normalizeChannelEditorialResult, automaticEditorialAssessment, productPatch,
    PRODUCT_OUTPUT_TO_FIELD, editorialChannelForSpecialist, progress,
    canonicalProduct, now, catalogProducts, missingOnlyPatch, productFieldValue,
    productEditorialTarget, productEditorialFingerprint, buildEditorialPersistencePatch,
    productEditorialSourceFingerprint, PROMPT_VERSION, readVersioned,
    saveProductFields, updateHistory, recordProductFeedback, buildEditorialRetryPatch,
    run, productEditorialState, productFacts, enforceProductEditorialCompliance,
    change, STATE_KEY, DEFAULT_CONFIG, state, activeDecision, normalizeDecision,
    loadProducts, canonicalProducts, sanitizeContext, communicationNeedsReply,
    crypto, productEditorialAutomaticEligibility, learningAutonomy,
    automaticBatchLimit, communicationFacts, decisionSubjectKey,
    decisionFingerprint, validManufacturerName, safeError, providerQuotaUnavailable,
    number, day, MAX_DECISIONS, upsertDecision,
  } = context;
  async function applyProductDraft(id = '', actor = {}, options = {}) {
    const current = await readState(), run = current.history.find((item) => item?.id === clean(id, 100));
    if (!run || run.status !== 'completed' || run.target?.type !== 'product' || !clean(run.target?.productId, 100)) throw Object.assign(new Error('Nie znaleziono szkicu produktu do zatwierdzenia.'), { code: 'agent_specialist_draft_not_found', status: 404 });
    if (['applied', 'auto_applied', 'not_needed'].includes(run.approvalStatus)) return { applied: false, duplicate: true, run };
    const editorialSpecialist = ['product_content', 'store_compliance', 'allegro_offer', 'allegro_compliance', 'von_halsky_offer', 'von_halsky_compliance'].includes(run.specialist);
    const normalizedRunResult = ['product_content', 'store_compliance'].includes(run.specialist) ? normalizeProductContentEditorialResult(run.result || {}) : normalizeChannelEditorialResult(run.result || {}, run.specialist);
    const finalAssessment = editorialSpecialist ? automaticEditorialAssessment({ ...run, result: normalizedRunResult }, { ...current.config, autoApplyProductEditorial: true }) : null;
    if (editorialSpecialist && !finalAssessment.eligible && ['allegro_compliance', 'von_halsky_compliance', 'source_page_noise'].includes(finalAssessment.reason)) throw Object.assign(new Error('Treść nie przeszła końcowej kontroli tego kanału i nie została w nim zapisana.'), { code: finalAssessment.reason, status: 422, violations: finalAssessment.violations || [] });
    const allProposed = productPatch(normalizedRunResult), requestedKeys = new Set((Array.isArray(options.fieldKeys) ? options.fieldKeys : []).map((item) => PRODUCT_OUTPUT_TO_FIELD[clean(item, 80)] || clean(item, 80)).filter(Boolean));
    const proposedPatch = requestedKeys.size ? Object.fromEntries(Object.entries(allProposed).filter(([key]) => requestedKeys.has(key))) : allProposed;
    const productId = String(run.target.productId);
    const channel = editorialChannelForSpecialist(run.specialist), workId = `editorial:${productId}:${channel}:${clean(run.target?.editorialFingerprint || run.id, 64)}`;
    await progress({
      id: workId, runId: run.id, productId, productName: clean(run.target?.name, 180), channel,
      action: 'zapis treści produktu', phase: 'saving', status: 'running',
      fields: Object.keys(proposedPatch), target: channel === 'store' ? 'kartoteka sklepu i artwaytm.pl' : channel === 'allegro' ? 'powiązana oferta Allegro' : 'katalog InPost Von Halsky',
      message: 'Zapisuję zatwierdzoną przez reguły wersję treści w głównej kartotece produktu.',
    });
    let appliedPatch = {}, contentPatch = {}, beforePatch = {};
    if (!Object.keys(proposedPatch).length) throw Object.assign(new Error('Szkic nie zawiera bezpiecznych pól produktu do zapisania.'), { code: 'agent_specialist_patch_empty', status: 422 });
    const canonicalBeforeWrite = await canonicalProduct(productId);
    const preparePersistence = (record) => {
      const previous = record && typeof record === 'object' ? record : { data: {}, rev: 0 };
      const data = { ...(previous.data || {}) };
      const timestamp = now().toISOString();
      // Dane settings są wyłącznie zgodnością odczytu podczas migracji.
      // Każdy zapis produktu kończy się w centralnej tabeli artway_products.
      const effective = canonicalBeforeWrite
        || catalogProducts(data).find((product) => String(product?.id) === productId)
        || {};
      const patch = options.missingOnly === true ? missingOnlyPatch(effective, proposedPatch) : proposedPatch;
      if (!Object.keys(patch).length) return;
      contentPatch = { ...patch };
      appliedPatch = patch;
      beforePatch = Object.fromEntries(Object.keys(patch).map((key) => [key, productFieldValue(effective, key) ?? '']));
      const editorialTarget = options.editorialTarget && typeof options.editorialTarget === 'object' ? options.editorialTarget : productEditorialTarget(effective);
      const inputFingerprint = options.editorialFingerprint || productEditorialFingerprint(effective, editorialTarget);
      const editorialReady = editorialSpecialist
        && (options.editorialPolicyValidated === true || finalAssessment?.eligible === true);
      const safePatch = { ...patch, agentTextModel: run.model, agentTextReviewedAt: timestamp, agentTextRunId: run.id, agentTextMode: options.editorialAutomatic === true ? 'autonomous-editorial' : options.missingOnly === true ? 'safe-missing-only' : 'approved' };
      if (editorialReady) {
        Object.assign(safePatch, buildEditorialPersistencePatch({
          effective, patch, run, channel: editorialChannelForSpecialist(run.specialist), target: editorialTarget,
          fingerprint: inputFingerprint, sourceFingerprint: productEditorialSourceFingerprint(effective, editorialTarget),
          promptVersion: PROMPT_VERSION, timestamp, automatic: options.editorialAutomatic === true,
          channelCompliance: finalAssessment?.channelCompliance || {}, autoUpdateLinkedAllegroContent: current.config.autoUpdateLinkedAllegroContent !== false,
        }));
      }
      appliedPatch = safePatch;
      beforePatch = Object.fromEntries(Object.keys(safePatch).map((key) => [key, productFieldValue(effective, key) ?? effective[key] ?? '']));
    };
    let persistence = null;
    const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
    preparePersistence(version.value);
    if (Object.keys(appliedPatch).length) {
      if (typeof saveProductFields !== 'function') {
        throw Object.assign(new Error('Centralna kartoteka produktów nie jest dostępna.'), {
          code: 'central_product_catalog_unavailable',
          status: 503,
        });
      }
      persistence = await saveProductFields({
        productId,
        fields: appliedPatch,
        mutationId: `agent-editorial:${run.id}:${channel}`,
        actor: clean(actor?.email || actor?.name || actor?.source || 'autonomous-agent', 200),
        area: `agent-editorial-${channel}`,
      });
      if (persistence?.publication?.published !== true || persistence?.publication?.readbackConfirmed !== true) {
        const error = new Error('Serwer nie potwierdził zapisu i publikacji treści produktu.');
        error.code = 'agent_product_persistence_unconfirmed';
        error.status = 503;
        throw error;
      }
    }
    if (!Object.keys(appliedPatch).length) {
      await updateHistory(run.id, { approvalStatus: 'not_needed', appliedAt: now().toISOString(), appliedBy: 'agent-safe-policy' });
      await progress({ id: workId, runId: run.id, productId, productName: clean(run.target?.name, 180), channel, action: 'zapis treści produktu', phase: 'unchanged', status: 'skipped', message: 'Kartoteka zawiera już tę samą wersję danych; zapis nie był potrzebny.' });
      return { applied: false, duplicate: true, noMissingFields: true, productId, patch: {} };
    }
    const appliedAt = now().toISOString(), appliedBy = clean(actor?.email || actor?.name || 'administrator', 120), automaticApply = options.missingOnly === true || options.editorialAutomatic === true;
    await updateHistory(run.id, { approvalStatus: automaticApply ? 'auto_applied' : 'applied', appliedAt, appliedBy, appliedFields: Object.keys(contentPatch), beforePatch, appliedPatch });
    if (!automaticApply && options.recordLearning !== false) await recordProductFeedback(run, 'approved', { fieldKeys: Object.keys(contentPatch), note: options.note || '' }, actor);
    await progress({
      id: workId, runId: run.id, productId, productName: clean(run.target?.name, 180), channel,
      action: channel === 'store' ? 'publikacja treści produktu' : 'publikacja treści w kanale',
      phase: channel === 'store' ? 'published' : 'queued_for_publication',
      status: channel === 'store' ? 'confirmed' : 'pending', fields: Object.keys(contentPatch),
      target: channel === 'store' ? 'artwaytm.pl' : channel === 'allegro' ? 'Allegro' : 'InPost Von Halsky',
      receiptId: run.id, completedAt: channel === 'store' ? appliedAt : '',
      message: channel === 'store'
        ? 'Zapis potwierdzony w głównej kartotece; sklep korzysta z tej samej wersji danych.'
        : 'Zapis potwierdzony w kartotece. Zmiana oczekuje na odpowiedź API kanału zewnętrznego.',
    });
    return {
      applied: true, productId, patch: contentPatch, persistedPatch: appliedPatch, before: beforePatch,
      appliedAt, appliedBy, safeAutoApply: automaticApply,
      persistence: persistence ? {
        mutationId: persistence.mutationId,
        confirmedAt: persistence.confirmedAt,
        revision: persistence.publication?.revision || '',
        readbackConfirmed: persistence.publication?.readbackConfirmed === true,
      } : null,
    };
  }

  async function markProductEditorialRetry(product = {}, draft = null, editorial = productEditorialState(product), error = '', channel = editorialChannelForSpecialist(draft?.specialist), retryDelayMs = 15 * 60_000) {
    const productId = String(product.id), timestamp = now().toISOString();
    const retryAt = new Date(now().getTime() + Math.max(15 * 60_000, Number(retryDelayMs) || 0)).toISOString();
    const patchFor = (effective) => buildEditorialRetryPatch({
      product: effective, channel, target: editorial.target, fingerprint: editorial.fingerprint,
      promptVersion: PROMPT_VERSION, timestamp, retryAt, draft, error,
    });
    if (typeof saveProductFields === 'function') {
      const effective = await canonicalProduct(productId) || product;
      const patch = patchFor(effective);
      await saveProductFields({
        productId,
        fields: patch,
        mutationId: `agent-editorial-retry:${productId}:${channel}:${Date.now()}`,
        actor: 'autonomous-agent',
        area: 'agent-editorial-retry',
      });
      return patch;
    }
    throw Object.assign(new Error('Centralna kartoteka produktów nie jest dostępna.'), {
      code: 'central_product_catalog_unavailable',
      status: 503,
    });
  }

  async function prepareProductProposal(productId = '', actor = {}, raw = {}) {
    const safeId = clean(productId, 120), settingsVersion = await readVersioned('settings', { data: {}, rev: 0 });
    const product = await canonicalProduct(safeId, settingsVersion.value?.data || {});
    if (!product) throw Object.assign(new Error('Nie znaleziono produktu do przygotowania propozycji.'), { code: 'agent_product_not_found', status: 404 });
    const editorial = productEditorialState(product), note = clean(raw.note, 500);
    const draft = await run({
      specialist: 'product_content', source: 'manual',
      instruction: note ? `Przygotuj kompletną, profesjonalną treść własnego sklepu. Nie zmieniaj pól Allegro ani Von Halsky. Uwzględnij wskazówkę administratora: ${note}` : 'Przygotuj niezależną treść własnego sklepu: popraw nazwę, opis krótki, opis pełny i SEO, opierając się wyłącznie na faktach. Nie zmieniaj pól Allegro ani Von Halsky.',
      context: { product: productFacts(product), administratorInstruction: note, editorialTarget: editorial.target, editorialFingerprint: editorial.fingerprint },
      target: { type: 'product', productId: safeId, name: clean(product.nazwa, 180), channels: editorial.target.channels, editorialFingerprint: editorial.fingerprint },
    }, actor);
    const current = await readState(), reviewed = await enforceProductEditorialCompliance({ draft, assess: (entry) => automaticEditorialAssessment(entry, current.config), run, productFacts, product, editorial, target: draft.target });
    const safeDraft = reviewed.draft, assessment = reviewed.assessment;
    if (assessment.eligible) {
      const applied = await applyProductDraft(safeDraft.id, { source: actor?.email || actor?.name || 'admin-product-editor' }, { missingOnly: false, editorialAutomatic: true, editorialPolicyValidated: true, editorialTarget: editorial.target, editorialFingerprint: editorial.fingerprint });
      const completedAt = now().toISOString();
      await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
        const previous = state(value);
        return { ...previous, decisions: previous.decisions.map((item) => item.kind === 'product_content_review' && String(item.target?.productId || '') === safeId && activeDecision(item, now()) ? normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'automatic-editorial-policy', resolutionNote: 'Bezpieczna redakcja została zapisana automatycznie zgodnie z polityką uprawnień.' }, completedAt) : item), updatedAt: completedAt };
      });
      return { run: { ...safeDraft, approvalStatus: applied.applied ? 'auto_applied' : safeDraft.approvalStatus }, decision: null, applied, automatic: true, policyReason: assessment.reason };
    }
    await markProductEditorialRetry(product, draft, editorial, assessment.reason);
    const completedAt = now().toISOString();
    await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
      const previous = state(value);
      return { ...previous, decisions: previous.decisions.map((item) => item.kind === 'product_content_review' && String(item.target?.productId || '') === safeId && activeDecision(item, now()) ? normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'automatic-editorial-retry', resolutionNote: 'Redakcja została przekazana do automatycznej ponownej próby; nie wymaga decyzji administratora.' }, completedAt) : item), updatedAt: completedAt };
    });
    return { run: draft, decision: null, automatic: true, retryScheduled: true, policyReason: assessment.reason };
  }

  async function prepareVonHalskyProposal(productId = '', actor = {}, raw = {}) {
    const safeId = clean(productId, 120), settingsVersion = await readVersioned('settings', { data: {}, rev: 0 });
    const product = await canonicalProduct(safeId, settingsVersion.value?.data || {});
    if (!product) throw Object.assign(new Error('Nie znaleziono produktu do przygotowania dla Von Halsky.'), { code: 'agent_product_not_found', status: 404 });
    const editorial = productEditorialState(product), note = clean(raw.note, 500);
    const target = {
      type: 'product', productId: safeId, name: clean(product.nazwa, 180), channel: 'vonHalsky',
      channels: editorial.target.channels, editorialFingerprint: editorial.fingerprint,
    };
    const draft = await run({
      specialist: 'von_halsky_offer',
      source: raw.source === 'automatic' ? 'automatic' : 'manual',
      instruction: [
        'Przygotuj kompletną kartę produktu InPost Von Halsky według oficjalnych zasad kanału.',
        'Najważniejsze fakty umieść na początku nazwy mającej 7–150 znaków.',
        'Zwróć krótki opis i czytelny opis pełny mający co najmniej 100 znaków.',
        'Usuń linki, osadzone obrazy, kontakt, płatności, dostawę, logistykę i hasła promocyjne.',
        'Nie wymyślaj EAN, kodu producenta, marki, kategorii, parametrów ani cech. Braki nazwij dokładnie.',
        note ? `Uwzględnij wskazówkę administratora: ${note}` : '',
      ].filter(Boolean).join(' '),
      context: {
        product: productFacts(product),
        administratorInstruction: note,
        officialRequirements: {
          identity: 'EAN/GTIN albo kod producenta i marka',
          title: '7–150 znaków; najważniejsze informacje na początku',
          description: 'minimum 100 znaków; bez linków i osadzonych obrazów',
          images: 'co najmniej jedno; zalecane białe tło, bez znaku wodnego, minimum 800×800 px',
          categoryParameters: 'uzupełniaj wyłącznie na podstawie potwierdzonych faktów i słownika API',
        },
        editorialTarget: editorial.target,
        editorialFingerprint: editorial.fingerprint,
      },
      target,
    }, actor);
    const current = await readState();
    const reviewed = await enforceProductEditorialCompliance({
      draft,
      assess: (entry) => automaticEditorialAssessment(entry, current.config),
      run,
      productFacts,
      product,
      editorial,
      target,
    });
    const safeDraft = reviewed.draft, assessment = reviewed.assessment;
    if (!assessment.eligible) {
      await markProductEditorialRetry(product, safeDraft, editorial, assessment.reason, 'vonHalsky');
      return {
        run: safeDraft,
        applied: null,
        automatic: true,
        retryScheduled: true,
        policyReason: assessment.reason,
        violations: assessment.violations || [],
      };
    }
    const applied = await applyProductDraft(safeDraft.id, {
      source: actor?.email || actor?.name || 'admin-von-halsky',
    }, {
      missingOnly: false,
      editorialAutomatic: true,
      editorialPolicyValidated: true,
      editorialTarget: editorial.target,
      editorialFingerprint: editorial.fingerprint,
    });
    return {
      run: { ...safeDraft, approvalStatus: applied.applied ? 'auto_applied' : safeDraft.approvalStatus },
      applied,
      automatic: true,
      retryScheduled: false,
      policyReason: assessment.reason,
      violations: [],
    };
  }

  async function automaticCycleUnlocked(options = {}) {
    const current = await readState();
    if (!current.config.enabled || !current.config.automaticEnabled || (current.config.limitsEnabled === true && current.config.automaticDailyLimit < 1)) return { skipped: true, reason: 'disabled', prepared: [], applied: [], decisions: [] };
    const providerCooldownUntil = Date.parse(current.lastCycle?.providerCooldownUntil || '');
    const providerCooldownActive = Number.isFinite(providerCooldownUntil) && providerCooldownUntil > now().getTime();
    const cycleStartedAt = now().toISOString();
    const coordinatorPlan = options?.coordinatorPlan && typeof options.coordinatorPlan === 'object' ? sanitizeContext(options.coordinatorPlan) : null;
    const coordinatorAssignments = Array.isArray(coordinatorPlan?.assignments) ? coordinatorPlan.assignments : [];
    const assignedScenarios = new Set(coordinatorAssignments.map((item) => clean(item?.scenarioId, 100)).filter(Boolean));
    const scenarioAssignment = (id) => coordinatorAssignments.find((item) => clean(item?.scenarioId, 100) === id) || null;
    // Brak planu oznacza zgodność wsteczną dla ręcznego uruchomienia i testów.
    // Gdy plan Codex istnieje, GPT wykonuje wyłącznie jawnie przydzielone role.
    const scenarioEnabled = (id) => !coordinatorPlan || assignedScenarios.has(id);
    const scenarioPayload = (id) => {
      const assignment = scenarioAssignment(id);
      return assignment ? {
        id, version: clean(assignment.scenarioVersion, 80), assignedBy: clean(coordinatorPlan.coordinator || 'codex', 60),
        coordinatorRunId: clean(coordinatorPlan.runId || coordinatorPlan.coordinatorRunId, 120),
        objective: clean(assignment.objective, 500), qualityGates: Array.isArray(assignment.qualityGates) ? assignment.qualityGates : [],
      } : undefined;
    };
    const [settingsVersion, communicationsVersion, canonicalCatalog] = await Promise.all([
      readVersioned('settings', { data: {}, rev: 0 }),
      readVersioned('allegro_communications', { threads: [], issues: [], updated_at: null }),
      typeof loadProducts === 'function' ? canonicalProducts() : Promise.resolve(null),
    ]);
    const data = settingsVersion.value?.data || {};
    const products = Array.isArray(canonicalCatalog) ? canonicalCatalog : catalogProducts(data);
    const communications = communicationsVersion.value || {};
    const communicationRows = [
      ...(Array.isArray(communications.threads) ? communications.threads.map((item) => ({ type: 'thread', item })) : []),
      ...(Array.isArray(communications.issues) ? communications.issues.map((item) => ({ type: 'issue', item })) : []),
    ].filter(({ item }) => communicationNeedsReply(item));
    const communicationSignal = crypto.createHash('sha256').update(JSON.stringify(communicationRows.map(({ type, item }) => [type, String(item?.id || ''), String(item?.latestNewIncomingKey || item?.latestNewIncoming?.id || item?.lastMessage?.id || '')]).sort())).digest('hex');
    const lastCommunicationScan = Date.parse(current.communicationScan?.lastAt || ''), communicationSafetyDue = !Number.isFinite(lastCommunicationScan) || now().getTime() - lastCommunicationScan >= 12 * 60 * 60_000;
    const customerReplyDraftsEnabled = current.config.autoPrepareCustomerReplyDrafts !== false;
    const catalogIdentityAuditEnabled = current.config.autoAuditCatalogIdentity !== false;
    const communicationScanDue = customerReplyDraftsEnabled && scenarioEnabled('customer-reply-draft') && (options.forceCommunicationScan === true || communicationSignal !== current.communicationScan?.signal || communicationSafetyDue);
    const editorialRows = products.map((product) => ({ product, ...productEditorialState(product) }));
    const candidates = scenarioEnabled('catalog-editorial') ? products.map((product) => {
      const editorial = productEditorialState(product), short = clean(product.opisKrotki || product.krotkiOpis, 5000), full = clean(product.opis, 30000);
      const missing = (!short ? 3 : 0) + (full.length < 250 ? 4 : 0) + (!product.seoTitle ? 2 : 0) + (!product.seoDescription ? 2 : 0);
      const channelChanged = editorial.editorial.channels && editorial.editorial.channels !== editorial.target.channels;
      const legacyVonHalskyOverride = String(product.vonHalskyContentMode || '').toLowerCase() === 'custom';
      const priority = (legacyVonHalskyOverride ? 140 : 0) + (channelChanged ? 100 : 0) + (editorial.target.allegro ? 30 : 0) + (product.sourceMaterial ? 15 : 0) + missing;
      return { product, missing, priority, editorial, eligibility: productEditorialAutomaticEligibility(product, editorial) };
    }).filter((item) => item.eligibility.eligible && !item.editorial.reviewedSameInput && item.editorial.retryDue !== false)
      .sort((a, b) => b.priority - a.priority || String(b.product.createdAt || b.product.dataDodania || '').localeCompare(String(a.product.createdAt || a.product.dataDodania || ''))) : [];
    const prepared = [], applied = [], decisionResults = [], activeFingerprints = new Set(), autoResolvedDecisionIds = new Set(), handledProductIds = new Set(), autonomy = learningAutonomy(current.learning, current.config);
    let limitReached = false, providerBlocked = providerCooldownActive, providerCooldownAt = providerCooldownActive ? new Date(providerCooldownUntil).toISOString() : '';

    const productsById = new Map(products.map((product) => [String(product.id), product]));
    for (const decision of (scenarioEnabled('catalog-editorial') ? current.decisions : []).filter((item) => item.kind === 'product_content_review' && activeDecision(item, now()))) {
      const product = productsById.get(String(decision.target?.productId || '')), runEntry = current.history.find((item) => item.id === decision.runId);
      if (!product || !runEntry) continue;
      const editorial = productEditorialState(product), sameInput = decision.target?.editorialFingerprint === editorial.fingerprint;
      const assessment = automaticEditorialAssessment(runEntry, current.config);
      if (!sameInput) continue;
      handledProductIds.add(String(product.id));
      if (!assessment.eligible) {
        await markProductEditorialRetry(product, runEntry, editorial, assessment.reason);
        prepared.push({ id: runEntry.id, productId: String(product.id), name: clean(product.nazwa, 180), status: 'retry_scheduled', reason: assessment.reason });
        autoResolvedDecisionIds.add(decision.id);
        continue;
      }
      try {
        const result = await applyProductDraft(runEntry.id, { source: 'background-agent-policy' }, { missingOnly: false, editorialAutomatic: true, editorialPolicyValidated: true, editorialTarget: editorial.target, editorialFingerprint: editorial.fingerprint });
        if (result.applied) applied.push({ id: runEntry.id, productId: String(product.id), name: clean(product.nazwa, 180), fields: Object.keys(result.patch || {}), fromDecision: decision.id });
        autoResolvedDecisionIds.add(decision.id);
      } catch (error) {
        prepared.push({ productId: String(product.id), name: clean(product.nazwa, 180), status: 'error', error: safeError(error?.message || error) });
      }
    }

    const unresolvedCommunication = communicationScanDue ? communicationRows.sort((a, b) => String(b.item?.latestNewIncoming?.createdAt || b.item?.lastMessage?.createdAt || '').localeCompare(String(a.item?.latestNewIncoming?.createdAt || a.item?.lastMessage?.createdAt || ''))) : [];

    let availableRuns = providerCooldownActive ? 0 : automaticBatchLimit(current.config.automaticBatchSize, options?.maxItems);
    // Komunikacja może zająć najwyżej dwa miejsca. Pozostała przepustowość jest
    // przeznaczona na sukcesywne przygotowanie całego katalogu produktów.
    let communicationRuns = Math.min(2, Math.max(0, availableRuns - Math.min(2, candidates.length)));
    for (const { type, item } of unresolvedCommunication.slice(0, 20)) {
      const target = { type: 'communication', communicationType: type, communicationId: String(item?.id || ''), sourceMessageId: String(item?.latestNewIncomingKey || item?.latestNewIncoming?.id || item?.lastMessage?.id || '') };
      const subjectKey = decisionSubjectKey('customer_reply', target), fp = decisionFingerprint('customer_reply', target); activeFingerprints.add(fp);
      const existing = current.decisions.find((entry) => (entry.subjectKey === subjectKey || entry.fingerprint === fp) && activeDecision(entry, now()));
      const resolved = current.decisionReceipts.find((entry) => entry.subjectKey === subjectKey && now().getTime() - Date.parse(entry.resolvedAt || '') <= current.config.decisionRetentionDays * 24 * 60 * 60_000);
      if (existing || resolved) continue;
      let draft = null;
      if (availableRuns > 0 && communicationRuns > 0) {
        try {
          draft = await run({ specialist: 'customer_reply', source: 'automatic', scenario: scenarioPayload('customer-reply-draft'), instruction: 'Przeanalizuj całą przekazaną rozmowę i przygotuj wyłącznie szkic odpowiedzi. Nie wysyłaj go. Nie obiecuj działań niepotwierdzonych w faktach.', context: { conversation: communicationFacts(item, type) }, target }, { source: 'background-agent' });
          prepared.push({ id: draft.id, type: 'communication', targetId: target.communicationId, status: 'prepared' }); availableRuns -= 1; communicationRuns -= 1;
        } catch (error) {
          if (providerQuotaUnavailable(error)) {
            availableRuns = 0; providerBlocked = true;
            providerCooldownAt = new Date(now().getTime() + 30 * 60_000).toISOString();
          } else if (error?.code === 'agent_specialist_daily_limit') { availableRuns = 0; limitReached = true; }
          else prepared.push({ type: 'communication', targetId: target.communicationId, status: 'error', error: safeError(error?.message || error) });
        }
      }
      const decision = await upsertDecision({ fingerprint: fp, kind: 'customer_reply', specialist: 'customer_reply', icon: type === 'issue' ? '🛟' : '💬', title: type === 'issue' ? 'Nowa dyskusja wymaga decyzji' : 'Nowa wiadomość wymaga odpowiedzi', summary: 'Agent przeanalizował sprawę i przygotował bezpieczny szkic. Żadna wiadomość nie została wysłana automatycznie.', recommendation: 'Sprawdź szkic w odpowiednim module i zatwierdź jego wysłanie dopiero po weryfikacji zamówienia oraz przesyłki.', alternatives: ['Popraw szkic', 'Oznacz jako załatwione wewnętrznie', 'Odłóż decyzję'], risk: 'high', target, href: `#/admin/allegro/${type === 'issue' ? 'dyskusje' : 'wiadomosci'}`, runId: draft?.id || '' });
      if (activeDecision(decision, now())) decisionResults.push(decision);
    }

    for (const item of candidates.filter((entry) => !handledProductIds.has(String(entry.product.id)))) {
      const jobs = [
        !item.editorial.currentChannels?.store && { channel: 'store', specialist: 'product_content', scenario: scenarioPayload('catalog-editorial'), instruction: 'Przygotuj kompletną, niezależną treść sklepu: nazwę, opis krótki, opis pełny i SEO. Źródło jest tylko zbiorem faktów. Nie zmieniaj pól Allegro ani Von Halsky.' },
        !item.editorial.currentChannels?.vonHalsky && { channel: 'vonHalsky', specialist: 'von_halsky_offer', instruction: 'Przygotuj kompletną, niezależną kartę Von Halsky: nazwę 7–150 znaków, krótki opis i pełny opis minimum 100 znaków. Bez linków, osadzonych zdjęć, kontaktu i logistyki.' },
        item.editorial.target.allegro && !item.editorial.currentChannels?.allegro && { channel: 'allegro', specialist: 'allegro_offer', instruction: 'Przygotuj niezależny tytuł i opis Allegro wyłącznie o produkcie. Bez kontaktu, linków, sprzedaży poza Allegro, płatności i informacji logistycznych.' },
      ].filter(Boolean);
      for (const job of jobs) {
        if (availableRuns <= 0) break;
        const target = { type: 'product', productId: String(item.product.id), name: clean(item.product.nazwa, 180), channel: job.channel, channels: item.editorial.target.channels, editorialFingerprint: item.editorial.fingerprint };
        const workId = `editorial:${target.productId}:${job.channel}:${clean(item.editorial.fingerprint, 64)}`;
        try {
          await progress({
            id: workId, productId: target.productId, productName: target.name, channel: job.channel,
            action: 'redakcja produktu', phase: 'preparing', status: 'running',
            target: job.channel === 'store' ? 'artwaytm.pl' : job.channel === 'allegro' ? 'Allegro' : 'InPost Von Halsky',
            message: `Analizuję fakty źródłowe i przygotowuję ${job.channel === 'store' ? 'nazwę, opis krótki, opis pełny i SEO' : job.channel === 'allegro' ? 'tytuł i opis zgodny z regulaminem Allegro' : 'kartę produktu dla Von Halsky'}.`,
          });
          let draft = await run({ specialist: job.specialist, source: 'automatic', ...(job.scenario ? { scenario: job.scenario } : {}), instruction: job.instruction, context: { product: productFacts(item.product), channel: job.channel, editorialTarget: item.editorial.target, editorialFingerprint: item.editorial.fingerprint }, target }, { source: 'background-agent' });
          availableRuns -= 1;
          await progress({
            id: workId, runId: draft.id, productId: target.productId, productName: target.name, channel: job.channel,
            action: 'kontrola przygotowanej treści', phase: 'validating', status: 'running',
            fields: (draft.result?.fields || []).map((field) => field?.key).filter(Boolean),
            target: job.channel === 'store' ? 'artwaytm.pl' : job.channel === 'allegro' ? 'Allegro' : 'InPost Von Halsky',
            message: 'Sprawdzam zgodność, kompletność, zakazane informacje i układ treści przed zapisem.',
          });
          const reviewed = await enforceProductEditorialCompliance({ draft, assess: (entry) => automaticEditorialAssessment(entry, current.config), run, productFacts, product: item.product, editorial: item.editorial, target });
          draft = reviewed.draft; const assessment = reviewed.assessment;
          if (assessment.eligible) {
            const result = await applyProductDraft(draft.id, { source: 'background-agent' }, { missingOnly: false, editorialAutomatic: true, editorialPolicyValidated: true, editorialTarget: item.editorial.target, editorialFingerprint: item.editorial.fingerprint });
            if (result.applied) applied.push({ id: draft.id, productId: String(item.product.id), channel: job.channel, name: clean(item.product.nazwa, 180), fields: Object.keys(result.patch || {}) });
            prepared.push({ id: draft.id, productId: String(item.product.id), channel: job.channel, name: clean(item.product.nazwa, 180), status: result.applied ? 'auto_applied' : 'not_needed' });
          } else {
            await markProductEditorialRetry(item.product, draft, item.editorial, assessment.reason, job.channel);
            await progress({
              id: workId, runId: draft.id, productId: target.productId, productName: target.name, channel: job.channel,
              action: 'kontrola przygotowanej treści', phase: 'retry_scheduled', status: 'attention',
              target: job.channel === 'store' ? 'artwaytm.pl' : job.channel === 'allegro' ? 'Allegro' : 'InPost Von Halsky',
              error: assessment.reason, nextRetryAt: new Date(now().getTime() + 15 * 60_000).toISOString(),
              message: 'Treść nie przeszła bramki jakości. Nic nie opublikowano; Agent ponowi redakcję.',
            });
            prepared.push({ id: draft.id, productId: String(item.product.id), channel: job.channel, name: clean(item.product.nazwa, 180), status: 'retry_scheduled', reason: assessment.reason });
          }
        } catch (error) {
          if (error?.code === 'agent_specialist_daily_limit') { limitReached = true; availableRuns = 0; break; }
          const quotaBlocked = providerQuotaUnavailable(error);
          if (quotaBlocked) {
            providerBlocked = true; availableRuns = 0;
            providerCooldownAt = new Date(now().getTime() + 30 * 60_000).toISOString();
          }
          await markProductEditorialRetry(
            item.product, null, item.editorial, safeError(error?.message || error), job.channel,
            quotaBlocked ? 30 * 60_000 : 15 * 60_000,
          );
          await progress({
            id: workId, productId: target.productId, productName: target.name, channel: job.channel,
            action: 'redakcja produktu', phase: 'retry_scheduled', status: 'failed',
            target: job.channel === 'store' ? 'artwaytm.pl' : job.channel === 'allegro' ? 'Allegro' : 'InPost Von Halsky',
            error: safeError(error?.message || error), nextRetryAt: quotaBlocked ? providerCooldownAt : new Date(now().getTime() + 15 * 60_000).toISOString(),
            message: 'Zapis lub kontrola nie zakończyły się powodzeniem. Niczego nie uznano za opublikowane.',
          });
          prepared.push({ productId: String(item.product.id), channel: job.channel, name: clean(item.product.nazwa, 180), status: 'error', error: safeError(error?.message || error) });
        }
      }
      if (availableRuns <= 0) break;
    }

    let openCatalogDecisionCount = current.decisions.filter((item) => item.kind === 'catalog_identity' && activeDecision(item, now())).length;
    for (const product of (catalogIdentityAuditEnabled && scenarioEnabled('catalog-identity-control') ? products : []).slice().sort((a, b) => String(b.createdAt || b.dataDodania || '').localeCompare(String(a.createdAt || a.dataDodania || ''))).slice(0, 200)) {
      const missing = [!clean(product.gtin || product.ean, 80) && 'EAN', !validManufacturerName(product.producent || product.marka) && 'producent', !clean(product.kategoria, 160) && 'kategoria'].filter(Boolean);
      if (!missing.length) continue;
      const target = { type: 'product', productId: String(product.id), name: clean(product.nazwa, 180), missing }, subjectKey = decisionSubjectKey('catalog_identity', target), fp = decisionFingerprint('catalog_identity', target); activeFingerprints.add(fp);
      const existing = current.decisions.find((entry) => (entry.subjectKey === subjectKey || entry.fingerprint === fp) && ['open', 'snoozed'].includes(entry.status));
      const resolved = current.decisionReceipts.find((entry) => entry.subjectKey === subjectKey && now().getTime() - Date.parse(entry.resolvedAt || '') <= current.config.decisionRetentionDays * 24 * 60 * 60_000);
      if (existing || resolved || openCatalogDecisionCount >= 12) continue;
      const decision = await upsertDecision({ fingerprint: fp, kind: 'catalog_identity', specialist: 'catalog_quality', icon: '🛡️', title: `Brak danych identyfikacyjnych: ${clean(product.nazwa, 120) || product.id}`, summary: `Brakuje: ${missing.join(', ')}. Agent nie może bezpiecznie zgadywać tych danych.`, recommendation: 'Uzupełnij brak z linku producenta albo karty produktu przed publikacją na zewnętrznych kanałach.', alternatives: ['Otwórz produkt', 'Odłóż na 1 dzień', 'Odrzuć ostrzeżenie'], risk: 'medium', target, href: '#/admin/asortyment/produkty' });
      if (activeDecision(decision, now())) { decisionResults.push(decision); openCatalogDecisionCount += 1; }
    }

    const productById = new Map(products.map((product) => [String(product.id), product]));
    for (const decision of current.decisions.filter((item) => activeDecision(item, now()))) {
      if (autoResolvedDecisionIds.has(decision.id)) continue;
      if (decision.kind === 'product_content_review') {
        if (!scenarioEnabled('catalog-editorial')) { activeFingerprints.add(decision.fingerprint); continue; }
        const product = productById.get(String(decision.target?.productId || ''));
        const editorial = product ? productEditorialState(product) : null;
        if (product && !editorial.current && decision.target?.editorialFingerprint === editorial.fingerprint) activeFingerprints.add(decision.fingerprint);
      }
      if (decision.kind === 'catalog_identity') {
        if (!catalogIdentityAuditEnabled || !scenarioEnabled('catalog-identity-control')) { activeFingerprints.add(decision.fingerprint); continue; }
        const product = productById.get(String(decision.target?.productId || ''));
        if (product && (!clean(product.gtin || product.ean, 80) || !validManufacturerName(product.producent || product.marka) || !clean(product.kategoria, 160))) activeFingerprints.add(decision.fingerprint);
      }
    }

    const completedAt = now().toISOString(), readyBefore = editorialRows.filter((item) => item.current).length;
    const readyAfter = Math.min(products.length, readyBefore + applied.length), reviewAfter = Math.min(products.length - readyAfter, editorialRows.filter((item) => item.reviewedSameInput).length + prepared.filter((item) => item.status === 'needs_decision').length);
    const lastCycle = { startedAt: cycleStartedAt, completedAt, prepared: prepared.length, autoApplied: applied.length, decisionsCreated: decisionResults.length, communicationChecked: unresolvedCommunication.length, communicationMode: communicationScanDue ? (communicationSafetyDue ? 'safety_12h' : 'new_event') : 'unchanged_skipped', productsChecked: products.length, autonomy, limitReached, providerBlocked, providerCooldownUntil: providerCooldownAt, limitDay: day(now()), coordinatorPlan: coordinatorPlan ? { coordinator: clean(coordinatorPlan.coordinator || 'codex', 60), runId: clean(coordinatorPlan.runId || coordinatorPlan.coordinatorRunId, 120), summary: clean(coordinatorPlan.summary, 240), confidence: number(coordinatorPlan.confidence, 0, 0, 1), assignments: coordinatorAssignments.slice(0, 8).map((item) => ({ scenarioId: clean(item?.scenarioId, 100), scenarioVersion: clean(item?.scenarioVersion, 80), specialist: clean(item?.specialist, 80), priority: number(item?.priority, 5, 1, 5), reason: clean(item?.reason, 180) })) } : null, editorialProgress: { total: products.length, ready: readyAfter, pending: Math.max(0, products.length - readyAfter - reviewAfter), review: reviewAfter, selectedThisCycle: candidates.length, processedThisCycle: prepared.filter((item) => item.productId).length }, status: providerBlocked ? 'provider_cooldown' : limitReached ? 'limit_reached' : prepared.some((item) => item.status === 'error') ? 'warning' : 'completed' };
    await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
      const previous = state(value), retentionCutoff = now().getTime() - previous.config.decisionRetentionDays * 24 * 60 * 60_000;
      const decisions = previous.decisions.map((item) => {
        if (autoResolvedDecisionIds.has(item.id)) return normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'automatic-editorial-policy', resolutionNote: 'Bezpieczna redakcja została zapisana automatycznie zgodnie z polityką uprawnień.' }, completedAt);
        if (scenarioEnabled('catalog-editorial') && item.kind === 'product_content_review' && activeDecision(item, now())) return normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'automatic-editorial-policy', resolutionNote: 'Redakcja produktu działa całkowicie automatycznie i nie wymaga już decyzji administratora.' }, completedAt);
        if (!['customer_reply', 'product_content_review', 'catalog_identity'].includes(item.kind) || !activeDecision(item, now()) || activeFingerprints.has(item.fingerprint)) return item;
        if (item.kind === 'customer_reply' && !communicationScanDue) return item;
        return normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'agent-reconciliation', resolutionNote: 'Warunek wymagający decyzji już nie występuje.' }, completedAt);
      }).filter((item) => activeDecision(item, now()) || Date.parse(item.updatedAt || item.createdAt || '') >= retentionCutoff).slice(0, MAX_DECISIONS);
      return { ...previous, decisions, communicationScan: communicationScanDue ? { signal: communicationSignal, lastAt: completedAt } : previous.communicationScan, lastCycle, updatedAt: completedAt };
    });
    const meaningful = prepared.length || applied.length || decisionResults.length;
    return { skipped: !meaningful, reason: meaningful ? '' : limitReached ? 'daily_limit' : 'no_candidates', prepared, applied, decisions: decisionResults.map((item) => ({ id: item.id, kind: item.kind, risk: item.risk })), lastCycle };
  }


  return {
    applyProductDraft, prepareProductProposal, prepareVonHalskyProposal,
    automaticCycleUnlocked,
  };
}
