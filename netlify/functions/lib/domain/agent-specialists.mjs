import crypto from 'node:crypto';
import { buildSharedProductDescriptionSections } from './product-content-layout.mjs';
import { STATE_KEY, MAX_HISTORY, MAX_DECISIONS, MAX_WRITE_ATTEMPTS, DEFAULT_CONFIG, PROMPT_VERSION, AGENT_ACTION_POLICY, NEVER_AUTOMATIC, PRODUCT_OUTPUT_TO_FIELD, SPECIALISTS, RESULT_SCHEMA, clean, number, config, safeError, sanitizeText, sanitizeContext, normalizeFieldStats, normalizeLearning, learningAutonomy, learningPrompt, state, decisionFingerprint, normalizeDecision, activeDecision, outputText, normalizeResult, normalizeProductContentEditorialResult, fingerprint, day, responseError, sourceEditorialFacts, productFacts, productPatch, editorialIdentityConflict, SOURCE_PAGE_NOISE, productEditorialTextQuality, productEditorialQuality, automaticEditorialAssessment, valuePresent, productFieldValue, missingOnlyPatch, catalogProducts, productEditorialTarget, productEditorialFingerprint, productEditorialState, communicationNeedsReply, communicationFacts } from './agent-specialists-support.mjs';

export function createAgentSpecialists({
  readVersioned, writeIfVersion, fetchImpl = globalThis.fetch, apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_TEXT_MODEL || process.env.OPENAI_MODEL || 'gpt-5-nano', now = () => new Date(),
  platformAgentsEnabled = process.env.OPENAI_PLATFORM_AGENTS !== 'false' && !String(apiKey || '').startsWith('test-'),
} = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') throw new Error('Specjaliści GPT wymagają wersjonowanego repozytorium.');
  if (typeof fetchImpl !== 'function') throw new Error('Specjaliści GPT wymagają klienta HTTP.');
  const platformProfiles = new Map();

  async function platformAgentProfile(specialist, definition) {
    if (!platformAgentsEnabled || !definition?.assistantId || !clean(apiKey, 500)) return null;
    const cached = platformProfiles.get(specialist);
    if (cached && now().getTime() - cached.checkedAt < 6 * 60 * 60_000) return cached;
    try {
      const response = await fetchImpl(`https://api.openai.com/v1/assistants/${encodeURIComponent(definition.assistantId)}`, {
        headers: { authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'assistants=v2' }, signal: AbortSignal.timeout(20_000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw responseError(response, payload);
      const profile = {
        id: clean(payload.id, 120), name: clean(payload.name, 180) || definition.label,
        model: clean(payload.model, 80), instructions: clean(payload.instructions, 12_000),
        checkedAt: now().getTime(), available: true,
      };
      platformProfiles.set(specialist, profile);
      return profile;
    } catch (error) {
      const profile = { id: definition.assistantId, name: definition.label, model: '', instructions: '', checkedAt: now().getTime(), available: false, error: safeError(error?.message || error) };
      platformProfiles.set(specialist, profile);
      return profile;
    }
  }

  async function change(key, fallback, mutator) {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
      const version = await readVersioned(key, fallback), next = await mutator(version.value, version);
      const write = await writeIfVersion(key, next, version);
      if (write?.modified) return next;
    }
    throw Object.assign(new Error('Dane Agenta zmieniły się równocześnie. Spróbuj ponownie.'), { code: 'agent_specialist_write_conflict', status: 409 });
  }

  async function readState() {
    const version = await readVersioned(STATE_KEY, { config: DEFAULT_CONFIG, history: [], updatedAt: '' });
    return state(version.value);
  }

  async function appendHistory(entry) {
    return change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], updatedAt: '' }, (value) => {
      const previous = state(value), timestamp = now().toISOString();
      return { ...previous, history: [entry, ...previous.history.filter((item) => item?.id !== entry.id)].slice(0, MAX_HISTORY), updatedAt: timestamp };
    });
  }

  async function updateHistory(id, patch) {
    return change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], updatedAt: '' }, (value) => {
      const previous = state(value), timestamp = now().toISOString();
      return { ...previous, history: previous.history.map((item) => item?.id === id ? { ...item, ...patch } : item), updatedAt: timestamp };
    });
  }

  async function recordProductFeedback(run = {}, outcome = 'approved', raw = {}, actor = {}) {
    if (run?.specialist !== 'product_content' || !['approved', 'dismissed', 'corrected'].includes(outcome)) return null;
    const timestamp = now().toISOString(), who = clean(actor?.email || actor?.name || actor?.source || 'administrator', 120);
    const requested = new Set((Array.isArray(raw.fieldKeys) ? raw.fieldKeys : []).map((key) => clean(key, 80)).filter(Boolean));
    const resultFields = (Array.isArray(run?.result?.fields) ? run.result.fields : []).filter((field) => PRODUCT_OUTPUT_TO_FIELD[field?.key]);
    const acceptedAll = outcome === 'approved' && requested.size === 0;
    const exampleFields = resultFields.map((field) => ({
      key: clean(field.key, 80), currentValue: clean(field.currentValue, 1200), value: clean(field.value, 2500),
      accepted: outcome === 'approved' && (acceptedAll || requested.has(field.key) || requested.has(PRODUCT_OUTPUT_TO_FIELD[field.key])),
    }));
    return change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], learning: {}, updatedAt: '' }, (value) => {
      const previous = state(value), learning = normalizeLearning(previous.learning), profile = learning.product_content, fieldStats = { ...profile.fieldStats };
      for (const field of exampleFields) {
        const stats = fieldStats[field.key] || { approved: 0, rejected: 0 };
        const approved = field.accepted === true;
        fieldStats[field.key] = { approved: stats.approved + (approved ? 1 : 0), rejected: stats.rejected + (approved ? 0 : 1) };
      }
      const example = {
        id: clean(run.id, 120), productId: clean(run.target?.productId, 120), outcome, note: clean(raw.note, 500), actor: who, at: timestamp, fields: exampleFields,
      };
      return {
        ...previous,
        learning: { ...learning, product_content: {
          ...profile, approvals: profile.approvals + (outcome === 'approved' ? 1 : 0), dismissals: profile.dismissals + (outcome === 'dismissed' ? 1 : 0), corrections: profile.corrections + (outcome === 'corrected' ? 1 : 0),
          fieldStats, examples: [example, ...profile.examples.filter((item) => item.id !== example.id)].slice(0, 12), updatedAt: timestamp,
        } },
        updatedAt: timestamp,
      };
    });
  }

  async function upsertDecision(raw = {}) {
    const timestamp = now().toISOString(), proposed = normalizeDecision(raw, timestamp);
    const next = await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
      const previous = state(value), existing = previous.decisions.find((item) => item?.fingerprint === proposed.fingerprint);
      const keepClosed = existing && ['approved', 'dismissed', 'resolved'].includes(existing.status);
      const decision = keepClosed ? existing : normalizeDecision({ ...existing, ...proposed, id: existing?.id || proposed.id, createdAt: existing?.createdAt || proposed.createdAt, status: existing?.status === 'snoozed' ? 'snoozed' : proposed.status }, timestamp);
      return { ...previous, decisions: [decision, ...previous.decisions.filter((item) => item?.id !== decision.id)].slice(0, MAX_DECISIONS), updatedAt: timestamp };
    });
    return next.decisions.find((item) => item.fingerprint === proposed.fingerprint) || proposed;
  }

  async function updateDecision(id = '', action = '', raw = {}, actor = {}) {
    const safeId = clean(id, 120), safeAction = clean(action, 40), timestamp = now().toISOString(), who = clean(actor?.email || actor?.name || actor?.source || 'administrator', 120);
    const statusByAction = { approve: 'approved', dismiss: 'dismissed', resolve: 'resolved', snooze: 'snoozed', reopen: 'open', revise: 'open' };
    if (!statusByAction[safeAction]) throw Object.assign(new Error('Nieobsługiwana decyzja Agenta.'), { code: 'agent_decision_action_invalid', status: 422 });
    const previous = await readState(), decision = previous.decisions.find((item) => item?.id === safeId);
    if (!decision) throw Object.assign(new Error('Nie znaleziono decyzji Agenta.'), { code: 'agent_decision_not_found', status: 404 });
    if (safeAction === 'approve' && decision.status === 'approved' && decision.executionStatus === 'completed') return { ...decision, duplicate: true };
    if (safeAction === 'revise') {
      const note = clean(raw.note, 500);
      if (!note) throw Object.assign(new Error('Napisz, co Agent ma poprawić w kolejnej propozycji.'), { code: 'agent_feedback_required', status: 422 });
      const oldRun = previous.history.find((item) => item?.id === decision.runId);
      if (!oldRun || decision.target?.type !== 'product') throw Object.assign(new Error('Ta propozycja nie ma szkicu produktu do poprawy.'), { code: 'agent_revision_not_available', status: 422 });
      await recordProductFeedback(oldRun, 'corrected', { note, fieldKeys: [] }, actor);
      const settingsVersion = await readVersioned('settings', { data: {}, rev: 0 }), product = catalogProducts(settingsVersion.value?.data || {}).find((item) => String(item?.id) === String(decision.target?.productId || ''));
      if (!product) throw Object.assign(new Error('Nie znaleziono produktu do ponownej redakcji.'), { code: 'agent_product_not_found', status: 404 });
      const editorial = productEditorialState(product);
      const revised = await run({
        specialist: 'product_content', source: 'manual',
        instruction: `Przygotuj nową, kompletną wersję treści produktu. Obowiązkowo uwzględnij korektę administratora: ${note}`,
        context: { product: productFacts(product), administratorCorrection: note, previousProposal: oldRun.result, editorialTarget: editorial.target },
        target: { ...decision.target, editorialFingerprint: editorial.fingerprint },
      }, actor);
      const revisedAt = now().toISOString();
      const next = await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], learning: {}, updatedAt: '' }, (value) => {
        const current = state(value);
        return { ...current, decisions: current.decisions.map((item) => item?.id === safeId ? normalizeDecision({
          ...item, status: 'open', runId: revised.id, summary: revised.result?.summary || item.summary,
          recommendation: 'Sprawdź poprawioną wersję uwzględniającą Twoją wskazówkę.', feedbackNote: note,
          revisionCount: Number(item.revisionCount || 0) + 1, updatedAt: revisedAt, executionStatus: 'idle', lastError: '', lastErrorCode: '',
        }, revisedAt) : item), updatedAt: revisedAt };
      });
      return { ...next.decisions.find((item) => item?.id === safeId), revised: true, previousRunId: oldRun.id };
    }
    const operationId = decision.operationId || `approval_${crypto.createHash('sha256').update(`${safeId}|${decision.runId || ''}`).digest('hex').slice(0, 24)}`;
    let executionResult = null;
    if (safeAction === 'approve') {
      await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
        const current = state(value);
        return {
          ...current,
          decisions: current.decisions.map((item) => item?.id === safeId ? normalizeDecision({
            ...item, operationId, executionStatus: 'running', attemptCount: Number(item.attemptCount || 0) + 1,
            startedAt: timestamp, completedAt: '', lastError: '', lastErrorCode: '', updatedAt: timestamp,
          }, timestamp) : item),
          updatedAt: timestamp,
        };
      });
      try {
        if (decision.runId && decision.target?.type === 'product') {
          executionResult = await applyProductDraft(decision.runId, actor, { missingOnly: false, fieldKeys: raw.fieldKeys });
        } else executionResult = { applied: false, directionOnly: true, patch: {} };
      } catch (error) {
        const failedAt = now().toISOString();
        await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
          const current = state(value);
          return {
            ...current,
            decisions: current.decisions.map((item) => item?.id === safeId ? normalizeDecision({
              ...item, status: 'open', operationId, executionStatus: 'failed', completedAt: failedAt,
              lastError: safeError(error?.message || error), lastErrorCode: clean(error?.code || 'agent_approval_failed', 120), updatedAt: failedAt,
            }, failedAt) : item),
            updatedAt: failedAt,
          };
        });
        error.decisionId = safeId;
        error.operationId = operationId;
        throw error;
      }
    }
    const days = number(raw.days, 1, 1, 14), patch = {
      status: statusByAction[safeAction], updatedAt: timestamp, resolvedAt: safeAction === 'snooze' || safeAction === 'reopen' ? '' : timestamp,
      resolvedBy: safeAction === 'snooze' || safeAction === 'reopen' ? '' : who, resolutionNote: clean(raw.note, 500),
      snoozedUntil: safeAction === 'snooze' ? new Date(now().getTime() + days * 24 * 60 * 60_000).toISOString() : '',
      ...(safeAction === 'approve' ? {
        operationId, executionStatus: 'completed', completedAt: now().toISOString(), lastError: '', lastErrorCode: '',
        appliedFields: Object.keys(executionResult?.patch || {}),
      } : safeAction === 'reopen' ? { executionStatus: 'idle', completedAt: '', lastError: '', lastErrorCode: '', appliedFields: [] } : {}),
    };
    const next = await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
      const current = state(value);
      return { ...current, decisions: current.decisions.map((item) => item?.id === safeId ? normalizeDecision({ ...item, ...patch }, timestamp) : item), updatedAt: timestamp };
    });
    const feedbackRun = previous.history.find((item) => item?.id === decision.runId);
    if (feedbackRun && safeAction === 'dismiss') await recordProductFeedback(feedbackRun, 'dismissed', raw, actor);
    return { ...next.decisions.find((item) => item?.id === safeId), executionResult };
  }

  async function status(options = {}) {
    const historyLimit = Math.max(5, Math.min(80, Number(options?.historyLimit) || 30));
    const current = await readState(), today = day(now()), todayRuns = current.history.filter((item) => { const created = new Date(item?.createdAt || ''); return Number.isFinite(created.getTime()) && day(created) === today; });
    const decisions = current.decisions.map((item) => item.status === 'snoozed' && activeDecision(item, now()) ? { ...item, status: 'open', snoozedUntil: '' } : item);
    const autonomy = learningAutonomy(current.learning, current.config), productLearning = current.learning.product_content;
    return {
      configured: !!clean(apiKey, 500), model: clean(model, 80), config: current.config,
      promptVersion: PROMPT_VERSION,
      policy: {
        mode: 'openai_platform_profiles_plus_responses', cycleMinutes: 15, safeAutoApply: current.config.safeAutoApply,
        progressiveAutonomy: true, editorialAutonomy: current.config.autoApplyProductEditorial !== false,
        linkedAllegroContentAutonomy: current.config.autoUpdateLinkedAllegroContent !== false,
        neverAutomatic: NEVER_AUTOMATIC, actionPolicy: AGENT_ACTION_POLICY,
      },
      learning: { productContent: { ...autonomy, updatedAt: productLearning.updatedAt, fieldStats: productLearning.fieldStats, recentExamples: productLearning.examples.slice(0, 6) } },
      platformAgents: { enabled: platformAgentsEnabled, configured: Object.values(SPECIALISTS).every((item) => !!item.assistantId), executionModel: clean(model, 80), coordinatorId: SPECIALISTS.operations_supervisor.assistantId },
      specialists: Object.entries(SPECIALISTS).map(([id, value]) => ({ id, ...value, promptVersion: PROMPT_VERSION, deployment: 'openai-platform+server', platformAvailable: platformProfiles.get(id)?.available ?? null, platformName: platformProfiles.get(id)?.name || value.label })),
      usage: {
        today: todayRuns.length,
        automaticToday: todayRuns.filter((item) => item.source === 'automatic').length,
        inputTokens: todayRuns.reduce((sum, item) => sum + Number(item?.usage?.inputTokens || 0), 0),
        outputTokens: todayRuns.reduce((sum, item) => sum + Number(item?.usage?.outputTokens || 0), 0),
        dailyLimitReached: todayRuns.length >= current.config.dailyLimit,
        automaticLimitReached: todayRuns.filter((item) => item.source === 'automatic').length >= current.config.automaticDailyLimit,
        limitDay: today,
      },
      decisions: decisions.filter((item) => activeDecision(item, now())).slice(0, 80),
      decisionStats: {
        open: decisions.filter((item) => activeDecision(item, now())).length,
        high: decisions.filter((item) => activeDecision(item, now()) && item.risk === 'high').length,
        completed: decisions.filter((item) => ['approved', 'resolved'].includes(item.status)).length,
      },
      history: current.history.slice(0, historyLimit), lastCycle: current.lastCycle, updatedAt: current.updatedAt,
    };
  }

  async function configure(raw = {}) {
    const nextConfig = config(raw);
    const next = await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], updatedAt: '' }, (value) => ({ ...state(value), config: nextConfig, updatedAt: now().toISOString() }));
    return next.config;
  }

  async function run(raw = {}, actor = {}) {
    const specialist = clean(raw.specialist, 80), definition = SPECIALISTS[specialist];
    if (!definition) throw Object.assign(new Error('Wybierz dostępnego specjalistę GPT-5 nano.'), { code: 'agent_specialist_invalid', status: 422 });
    if (!clean(apiKey, 500)) throw Object.assign(new Error('Brakuje konfiguracji OpenAI dla GPT-5 nano.'), { code: 'openai_not_configured', status: 503 });
    const current = await readState(), source = raw.source === 'automatic' ? 'automatic' : 'manual';
    if (!current.config.enabled || (source === 'automatic' && !current.config.automaticEnabled)) throw Object.assign(new Error('Ten tryb specjalistów GPT jest wyłączony w ustawieniach.'), { code: 'agent_specialists_disabled', status: 409 });
    const today = day(now()), todayRuns = current.history.filter((item) => { const created = new Date(item?.createdAt || ''); return Number.isFinite(created.getTime()) && day(created) === today; });
    if (todayRuns.length >= current.config.dailyLimit || (source === 'automatic' && todayRuns.filter((item) => item.source === 'automatic').length >= current.config.automaticDailyLimit)) {
      throw Object.assign(new Error('Osiągnięto dzienny limit kontrolujący koszt GPT-5 nano.'), { code: 'agent_specialist_daily_limit', status: 429 });
    }
    const instruction = sanitizeText(raw.instruction || `Przygotuj profesjonalny szkic jako ${definition.label}.`, 3000), context = sanitizeContext(raw.context || {}), learnedGuidance = current.config.learningEnabled ? learningPrompt(current.learning, specialist) : '', hash = fingerprint(specialist, instruction, { context, learningUpdatedAt: current.learning?.product_content?.updatedAt || '' });
    const cacheMs = current.config.cacheHours * 60 * 60_000, cached = current.history.find((item) => item.fingerprint === hash && item.status === 'completed' && now().getTime() - Date.parse(item.createdAt || '') <= cacheMs);
    if (cached) return { ...cached, cached: true };
    const runId = `gpt_${Date.now()}_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`, createdAt = now().toISOString(), target = sanitizeContext(raw.target || {});
    const platformProfile = await platformAgentProfile(specialist, definition);
    const instructions = [
      'Jesteś wyspecjalizowanym pracownikiem polskiego sklepu Artway-TM. Odpowiadasz po polsku.',
      'Korzystaj wyłącznie z przekazanych faktów. Nie zgaduj parametrów, cen, statusów, terminów, dostępności, rabatów ani warunków.',
      'Brakujące dane wpisz do missingFacts. Każdą treść traktuj jako szkic; nie twierdź, że została wysłana lub opublikowana.',
      `Rola: ${definition.label}. ${definition.description}`,
      `Szczególne reguły: ${definition.rules}`,
      learnedGuidance ? `Pamięć zatwierdzeń administratora:\n${learnedGuidance}` : '',
      `Zwróć pola tylko z tej listy: ${definition.fields.join(', ')}. Nie dodawaj innych kluczy fields.`,
      specialist === 'product_content' ? 'Zwróć kompletny zestaw: title, short_description, long_description, seo_title, seo_description i seo_keywords. Popraw wartości istniejące, jeśli są chaotyczne lub słabe; nie pomijaj pola tylko dlatego, że nie jest puste. Brak opcjonalnych parametrów (wiek, liczba graczy, czas gry, zdjęcia, cena, stan, dostępność lub zawartość opakowania) nie jest missingFact i nie blokuje redakcji — po prostu ich nie dodawaj. Materiał ze strony źródłowej jest wyłącznie zbiorem faktów: usuń z niego menu, kontrolki sklepu, „Dodaj do porównania”, „Dodaj do listy zakupowej”, koszyk, dostępność, liczbę sztuk, ceny, terminy wysyłki, prośby o kontakt i powiadomienie o dostępności. Ciąg „Rozmiar uniwersalny” połączony z liczbą sztuk jest kontrolką stanu sklepu źródłowego, a nie rozmiarem lub zawartością produktu — zawsze go usuń. Nie umieszczaj w opisie ceny, stanu, dostępności, terminu dostawy, danych kontaktowych, adresów stron, SKU, EAN, kodu producenta ani akapitu wskazującego źródło. Każdy punkt listy musi zawierać konkretną treść. Jeśli można bezpiecznie opisać produkt na podstawie nazwy, producenta i istniejącej treści, ustaw readyForApproval=true oraz complianceStatus=ready. missingFacts stosuj wyłącznie, gdy nie da się rozpoznać tożsamości produktu albo fakty są ze sobą sprzeczne.' : '',
      platformProfile?.instructions && specialist !== 'product_content' ? `Dodatkowy profil roli zapisany w OpenAI Platform:\n${platformProfile.instructions}\nStosuj ten profil tylko w zakresie zgodnym z powyższymi bieżącymi regułami Artway. Bieżąca lista pól i zakazy mają pierwszeństwo.` : '',
      platformProfile && specialist === 'product_content' ? `Używasz profilu OpenAI Platform „${platformProfile.name || definition.label}”, ale jego starsza treść instrukcji nie jest dołączana do redakcji. Obowiązuje wyłącznie powyższa, wersjonowana polityka Artway ${PROMPT_VERSION}, aby stary profil nie przywracał treści źródłowej.` : '',
      'Dla każdego pola podaj bieżącą wartość, proponowaną wartość, konkretną przyczynę oraz fakt będący podstawą. Nie używaj ogólników.',
      'Treść ma być konkretna, naturalna, uporządkowana i gotowa do sprawdzenia przez administratora.',
    ].filter(Boolean).join('\n');
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model, store: false, reasoning: { effort: 'minimal' }, max_output_tokens: 3600,
        instructions,
        input: JSON.stringify({ zadanie: instruction, fakty: context }),
        text: { format: { type: 'json_schema', name: 'artway_specialist_result', strict: true, schema: RESULT_SCHEMA } },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw responseError(response, payload);
    let parsed;
    try { parsed = JSON.parse(outputText(payload)); }
    catch (error) {
      if (error?.code) throw error;
      throw Object.assign(new Error('GPT-5 nano zwrócił nieprawidłowy wynik strukturalny.'), { code: 'openai_invalid_json', status: 502 });
    }
    const result = normalizeResult(parsed, specialist), usage = { inputTokens: number(payload?.usage?.input_tokens, 0, 0, 10_000_000), outputTokens: number(payload?.usage?.output_tokens, 0, 0, 10_000_000), totalTokens: number(payload?.usage?.total_tokens, 0, 0, 20_000_000) };
    const entry = {
      id: runId, specialist, specialistLabel: definition.label, status: 'completed', source, createdAt, model: clean(payload.model || model, 80),
      instruction: clean(instruction, 500), target, fingerprint: hash, result, usage, approvalStatus: 'draft', promptVersion: PROMPT_VERSION,
      platformAgent: platformProfile ? { id: platformProfile.id, name: platformProfile.name, available: platformProfile.available } : null,
      actor: clean(actor?.email || actor?.name || actor?.source || 'administrator', 120),
    };
    await appendHistory(entry);
    return entry;
  }

  async function applyProductDraft(id = '', actor = {}, options = {}) {
    const current = await readState(), run = current.history.find((item) => item?.id === clean(id, 100));
    if (!run || run.status !== 'completed' || run.target?.type !== 'product' || !clean(run.target?.productId, 100)) throw Object.assign(new Error('Nie znaleziono szkicu produktu do zatwierdzenia.'), { code: 'agent_specialist_draft_not_found', status: 404 });
    if (['applied', 'auto_applied', 'not_needed'].includes(run.approvalStatus)) return { applied: false, duplicate: true, run };
    const normalizedRunResult = run.specialist === 'product_content' ? normalizeProductContentEditorialResult(run.result || {}) : (run.result || {});
    const allProposed = productPatch(normalizedRunResult), requestedKeys = new Set((Array.isArray(options.fieldKeys) ? options.fieldKeys : []).map((item) => PRODUCT_OUTPUT_TO_FIELD[clean(item, 80)] || clean(item, 80)).filter(Boolean));
    const proposedPatch = requestedKeys.size ? Object.fromEntries(Object.entries(allProposed).filter(([key]) => requestedKeys.has(key))) : allProposed;
    const productId = String(run.target.productId);
    let appliedPatch = {}, contentPatch = {}, beforePatch = {};
    if (!Object.keys(proposedPatch).length) throw Object.assign(new Error('Szkic nie zawiera bezpiecznych pól produktu do zapisania.'), { code: 'agent_specialist_patch_empty', status: 422 });
    await change('settings', { data: {}, rev: 0, updated_at: null }, (record) => {
      const previous = record && typeof record === 'object' ? record : { data: {}, rev: 0 }, data = { ...(previous.data || {}) }, added = Array.isArray(data.artway_produkty_dodane) ? [...data.artway_produkty_dodane] : [], index = added.findIndex((product) => String(product?.id) === productId), timestamp = now().toISOString();
      const effective = index >= 0 ? added[index] : { ...(catalogProducts(data).find((product) => String(product?.id) === productId) || {}), ...((data.artway_produkty_edytowane || {})[productId] || {}) };
      const patch = options.missingOnly === true ? missingOnlyPatch(effective, proposedPatch) : proposedPatch;
      if (!Object.keys(patch).length) return previous;
      contentPatch = { ...patch };
      appliedPatch = patch;
      beforePatch = Object.fromEntries(Object.keys(patch).map((key) => [key, productFieldValue(effective, key) ?? '']));
      const editorialTarget = options.editorialTarget && typeof options.editorialTarget === 'object' ? options.editorialTarget : productEditorialTarget(effective);
      const inputFingerprint = options.editorialFingerprint || productEditorialFingerprint(effective, editorialTarget);
      const mergedProduct = { ...effective, ...patch };
      const editorialReady = run.specialist === 'product_content'
        && (options.editorialPolicyValidated === true || (normalizedRunResult?.readyForApproval === true && normalizedRunResult?.complianceStatus === 'ready'))
        && clean(mergedProduct.nazwa || mergedProduct.name, 300)
        && clean(mergedProduct.opisKrotki || mergedProduct.krotkiOpis, 500)
        && clean(mergedProduct.opis, 30_000).length >= 150;
      const safePatch = { ...patch, agentTextModel: run.model, agentTextReviewedAt: timestamp, agentTextRunId: run.id, agentTextMode: options.editorialAutomatic === true ? 'autonomous-editorial' : options.missingOnly === true ? 'safe-missing-only' : 'approved' };
      if (editorialReady) {
        const sharedName = clean(mergedProduct.nazwa || mergedProduct.name, 300), sharedDescription = clean(mergedProduct.opis, 30_000);
        Object.assign(safePatch, {
          allegroTitle: sharedName.slice(0, 75),
          allegroDescription: sharedDescription,
          allegroDescriptionSections: buildSharedProductDescriptionSections({ ...mergedProduct, nazwa: sharedName, allegroDescription: sharedDescription }),
          contentEditorial: {
            ...(effective.contentEditorial || {}), status: 'ready', sourceRole: effective.sourceMaterial ? 'facts_only' : 'catalog_facts',
            channels: editorialTarget.channels, targets: { store: true, allegro: editorialTarget.allegro === true },
            layoutPolicy: 'allegro_sections', promptVersion: PROMPT_VERSION, inputFingerprint,
            preparedAt: timestamp, runId: run.id, model: run.model, preparedBy: options.editorialAutomatic === true ? 'autonomous-agent' : 'administrator-approved-agent', warnings: [],
          },
          contentEditorialPreparedAt: timestamp,
          contentEditorialSource: options.editorialAutomatic === true ? 'autonomous-agent-specialist' : 'approved-agent-specialist',
        });
        if (editorialTarget.allegro === true && current.config.autoUpdateLinkedAllegroContent !== false) Object.assign(safePatch, {
          allegroEditorialSyncPending: true,
          allegroEditorialSyncPendingAt: timestamp,
          allegroEditorialSyncRunId: run.id,
          allegroEditorialSyncState: 'queued',
          allegroEditorialSyncError: '',
        });
        if (!effective.sourceMaterial) safePatch.sourceMaterial = {
          sourceUrl: clean(effective.sourceUrl || effective.producentUrl, 1000), fetchedAt: timestamp,
          title: clean(effective.nazwa || effective.name, 300), shortDescription: clean(effective.opisKrotki || effective.krotkiOpis, 4000),
          longDescription: clean(effective.opis, 20_000), producer: clean(effective.producent || effective.marka, 160),
          brand: clean(effective.marka || effective.producent, 160), category: clean(effective.kategoria, 180),
          ean: clean(effective.gtin || effective.ean, 80), producerCode: clean(effective.kodProducenta || effective.mpn, 160),
          parameters: effective.parametryProducenta || effective.parametryZrodla || effective.parametry || effective.parameters || {},
        };
      }
      appliedPatch = safePatch;
      beforePatch = Object.fromEntries(Object.keys(safePatch).map((key) => [key, productFieldValue(effective, key) ?? effective[key] ?? '']));
      const edited = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
      // Warstwa artway_produkty_edytowane ma pierwszeństwo podczas odczytu.
      // Jeśli już istnieje, zapis wyłącznie do produktu dodanego byłby niewidoczny
      // w edytorze i stary opis wróciłby po odświeżeniu strony.
      if (index >= 0 && !edited[productId]) { added[index] = { ...added[index], ...safePatch }; data.artway_produkty_dodane = added; }
      else { edited[productId] = { ...(edited[productId] || {}), ...safePatch }; data.artway_produkty_edytowane = edited; }
      return { ...previous, data, rev: Number(previous.rev || 0) + 1, updated_at: timestamp };
    });
    if (!Object.keys(appliedPatch).length) {
      await updateHistory(run.id, { approvalStatus: 'not_needed', appliedAt: now().toISOString(), appliedBy: 'agent-safe-policy' });
      return { applied: false, duplicate: true, noMissingFields: true, productId, patch: {} };
    }
    const appliedAt = now().toISOString(), appliedBy = clean(actor?.email || actor?.name || 'administrator', 120), automaticApply = options.missingOnly === true || options.editorialAutomatic === true;
    await updateHistory(run.id, { approvalStatus: automaticApply ? 'auto_applied' : 'applied', appliedAt, appliedBy, appliedFields: Object.keys(contentPatch), beforePatch, appliedPatch });
    if (!automaticApply && options.recordLearning !== false) await recordProductFeedback(run, 'approved', { fieldKeys: Object.keys(contentPatch), note: options.note || '' }, actor);
    return { applied: true, productId, patch: contentPatch, persistedPatch: appliedPatch, before: beforePatch, appliedAt, appliedBy, safeAutoApply: automaticApply };
  }

  async function markProductEditorialRetry(product = {}, draft = null, editorial = productEditorialState(product), error = '') {
    const productId = String(product.id), timestamp = now().toISOString();
    const retryAt = new Date(now().getTime() + 15 * 60_000).toISOString();
    await change('settings', { data: {}, rev: 0, updated_at: null }, (record) => {
      const previous = record && typeof record === 'object' ? record : { data: {}, rev: 0 }, data = { ...(previous.data || {}) };
      const added = Array.isArray(data.artway_produkty_dodane) ? [...data.artway_produkty_dodane] : [], index = added.findIndex((item) => String(item?.id) === productId);
      const patch = {
        contentEditorial: {
          ...(product.contentEditorial || {}), status: 'retry_pending', sourceRole: product.sourceMaterial ? 'facts_only' : 'catalog_facts',
          channels: editorial.target.channels, targets: { store: true, allegro: editorial.target.allegro === true }, layoutPolicy: 'allegro_sections',
          promptVersion: PROMPT_VERSION, inputFingerprint: editorial.fingerprint, attemptedAt: timestamp, retryAt,
          retryCount: Math.min(100, Math.max(0, Number(product.contentEditorial?.retryCount) || 0) + 1),
          runId: clean(draft?.id, 120), model: clean(draft?.model, 80), warnings: [...(draft?.result?.warnings || []), ...(draft?.result?.missingFacts || []), error].map((item) => clean(item, 500)).filter(Boolean).slice(0, 20),
        },
        contentEditorialSource: 'autonomous-agent-retry',
      };
      const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
      if (index >= 0 && !edits[productId]) { added[index] = { ...added[index], ...patch }; data.artway_produkty_dodane = added; }
      else { edits[productId] = { ...(edits[productId] || {}), ...patch }; data.artway_produkty_edytowane = edits; }
      return { ...previous, data, rev: Number(previous.rev || 0) + 1, updated_at: timestamp };
    });
  }

  async function prepareProductProposal(productId = '', actor = {}, raw = {}) {
    const safeId = clean(productId, 120), settingsVersion = await readVersioned('settings', { data: {}, rev: 0 });
    const product = catalogProducts(settingsVersion.value?.data || {}).find((item) => String(item?.id) === safeId);
    if (!product) throw Object.assign(new Error('Nie znaleziono produktu do przygotowania propozycji.'), { code: 'agent_product_not_found', status: 404 });
    const editorial = productEditorialState(product), note = clean(raw.note, 500);
    const draft = await run({
      specialist: 'product_content', source: 'manual',
      instruction: note ? `Przygotuj kompletną, profesjonalną treść produktu. Uwzględnij wskazówkę administratora: ${note}` : `Przygotuj kompletną, profesjonalną treść produktu dla kanałów: ${editorial.target.allegro ? 'sklep i Allegro' : 'sklep'}. Popraw nazwę, opis krótki, opis pełny i SEO, opierając się wyłącznie na faktach.`,
      context: { product: productFacts(product), administratorInstruction: note, editorialTarget: editorial.target, editorialFingerprint: editorial.fingerprint },
      target: { type: 'product', productId: safeId, name: clean(product.nazwa, 180), channels: editorial.target.channels, editorialFingerprint: editorial.fingerprint },
    }, actor);
    const current = await readState(), assessment = automaticEditorialAssessment(draft, current.config);
    if (assessment.eligible) {
      const applied = await applyProductDraft(draft.id, { source: actor?.email || actor?.name || 'admin-product-editor' }, { missingOnly: false, editorialAutomatic: true, editorialPolicyValidated: true, editorialTarget: editorial.target, editorialFingerprint: editorial.fingerprint });
      const completedAt = now().toISOString();
      await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
        const previous = state(value);
        return { ...previous, decisions: previous.decisions.map((item) => item.kind === 'product_content_review' && String(item.target?.productId || '') === safeId && activeDecision(item, now()) ? normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'automatic-editorial-policy', resolutionNote: 'Bezpieczna redakcja została zapisana automatycznie zgodnie z polityką uprawnień.' }, completedAt) : item), updatedAt: completedAt };
      });
      return { run: { ...draft, approvalStatus: applied.applied ? 'auto_applied' : draft.approvalStatus }, decision: null, applied, automatic: true, policyReason: assessment.reason };
    }
    await markProductEditorialRetry(product, draft, editorial, assessment.reason);
    const completedAt = now().toISOString();
    await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
      const previous = state(value);
      return { ...previous, decisions: previous.decisions.map((item) => item.kind === 'product_content_review' && String(item.target?.productId || '') === safeId && activeDecision(item, now()) ? normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'automatic-editorial-retry', resolutionNote: 'Redakcja została przekazana do automatycznej ponownej próby; nie wymaga decyzji administratora.' }, completedAt) : item), updatedAt: completedAt };
    });
    return { run: draft, decision: null, automatic: true, retryScheduled: true, policyReason: assessment.reason };
  }

  async function automaticCycle() {
    const current = await readState();
    if (!current.config.enabled || !current.config.automaticEnabled || current.config.automaticDailyLimit < 1) return { skipped: true, reason: 'disabled', prepared: [], applied: [], decisions: [] };
    const cycleStartedAt = now().toISOString();
    const [settingsVersion, communicationsVersion] = await Promise.all([
      readVersioned('settings', { data: {}, rev: 0 }),
      readVersioned('allegro_communications', { threads: [], issues: [], updated_at: null }),
    ]);
    const data = settingsVersion.value?.data || {}, products = catalogProducts(data), communications = communicationsVersion.value || {};
    const editorialRows = products.map((product) => ({ product, ...productEditorialState(product) }));
    const candidates = products.map((product) => {
      const editorial = productEditorialState(product), short = clean(product.opisKrotki || product.krotkiOpis, 5000), full = clean(product.opis, 30000);
      const missing = (!short ? 3 : 0) + (full.length < 250 ? 4 : 0) + (!product.seoTitle ? 2 : 0) + (!product.seoDescription ? 2 : 0);
      const channelChanged = editorial.editorial.channels && editorial.editorial.channels !== editorial.target.channels;
      const priority = (channelChanged ? 100 : 0) + (editorial.target.allegro ? 30 : 0) + (product.sourceMaterial ? 15 : 0) + missing;
      return { product, missing, priority, editorial };
    }).filter((item) => !item.editorial.current && !item.editorial.reviewedSameInput && item.editorial.retryDue !== false)
      .sort((a, b) => b.priority - a.priority || String(b.product.createdAt || b.product.dataDodania || '').localeCompare(String(a.product.createdAt || a.product.dataDodania || '')));
    const prepared = [], applied = [], decisionResults = [], activeFingerprints = new Set(), autoResolvedDecisionIds = new Set(), handledProductIds = new Set(), autonomy = learningAutonomy(current.learning, current.config);
    let limitReached = false;

    const productsById = new Map(products.map((product) => [String(product.id), product]));
    for (const decision of current.decisions.filter((item) => item.kind === 'product_content_review' && activeDecision(item, now()))) {
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

    const unresolvedCommunication = [
      ...(Array.isArray(communications.threads) ? communications.threads.map((item) => ({ type: 'thread', item })) : []),
      ...(Array.isArray(communications.issues) ? communications.issues.map((item) => ({ type: 'issue', item })) : []),
    ].filter(({ item }) => communicationNeedsReply(item)).sort((a, b) => String(b.item?.latestNewIncoming?.createdAt || b.item?.lastMessage?.createdAt || '').localeCompare(String(a.item?.latestNewIncoming?.createdAt || a.item?.lastMessage?.createdAt || '')));

    let availableRuns = current.config.automaticBatchSize;
    // Komunikacja może zająć najwyżej dwa miejsca. Pozostała przepustowość jest
    // przeznaczona na sukcesywne przygotowanie całego katalogu produktów.
    let communicationRuns = Math.min(2, Math.max(0, availableRuns - Math.min(2, candidates.length)));
    for (const { type, item } of unresolvedCommunication.slice(0, 20)) {
      const target = { type: 'communication', communicationType: type, communicationId: String(item?.id || ''), sourceMessageId: String(item?.latestNewIncomingKey || item?.latestNewIncoming?.id || item?.lastMessage?.id || '') };
      const fp = decisionFingerprint('customer_reply', target); activeFingerprints.add(fp);
      const existing = current.decisions.find((entry) => entry.fingerprint === fp && activeDecision(entry, now()));
      if (existing) continue;
      let draft = null;
      if (availableRuns > 0 && communicationRuns > 0) {
        try {
          draft = await run({ specialist: 'customer_reply', source: 'automatic', instruction: 'Przeanalizuj całą przekazaną rozmowę i przygotuj wyłącznie szkic odpowiedzi. Nie wysyłaj go. Nie obiecuj działań niepotwierdzonych w faktach.', context: { conversation: communicationFacts(item, type) }, target }, { source: 'background-agent' });
          prepared.push({ id: draft.id, type: 'communication', targetId: target.communicationId, status: 'prepared' }); availableRuns -= 1; communicationRuns -= 1;
        } catch (error) {
          if (error?.code === 'agent_specialist_daily_limit') { availableRuns = 0; limitReached = true; }
          else prepared.push({ type: 'communication', targetId: target.communicationId, status: 'error', error: safeError(error?.message || error) });
        }
      }
      const decision = await upsertDecision({ fingerprint: fp, kind: 'customer_reply', specialist: 'customer_reply', icon: type === 'issue' ? '🛟' : '💬', title: type === 'issue' ? 'Nowa dyskusja wymaga decyzji' : 'Nowa wiadomość wymaga odpowiedzi', summary: 'Agent przeanalizował sprawę i przygotował bezpieczny szkic. Żadna wiadomość nie została wysłana automatycznie.', recommendation: 'Sprawdź szkic w odpowiednim module i zatwierdź jego wysłanie dopiero po weryfikacji zamówienia oraz przesyłki.', alternatives: ['Popraw szkic', 'Oznacz jako załatwione wewnętrznie', 'Odłóż decyzję'], risk: 'high', target, href: `#/admin/allegro/${type === 'issue' ? 'dyskusje' : 'wiadomosci'}`, runId: draft?.id || '' });
      decisionResults.push(decision);
    }

    for (const item of candidates.filter((entry) => !handledProductIds.has(String(entry.product.id))).slice(0, Math.max(0, availableRuns))) {
      try {
        const retryAttempt = Math.max(0, Number(item.editorial.editorial?.retryCount) || 0) + 1;
        const draft = await run({ specialist: 'product_content', source: 'automatic', instruction: `Przygotuj kompletną, profesjonalną treść produktu dla wybranych kanałów: ${item.editorial.target.allegro ? 'sklep i Allegro' : 'sklep'}. Popraw również istniejącą słabą nazwę i treść, nie tylko puste pola. Zachowaj potwierdzone fakty, zastosuj czytelne akapity, nagłówki i listy. Nie pytaj o opcjonalne dane — jeżeli ich nie ma, pomiń je i dokończ bezpieczną redakcję. To automatyczna próba ${retryAttempt}; obowiązkowo zwróć wszystkie pola redakcyjne, jeżeli tożsamość produktu jest rozpoznawalna.`, context: { product: productFacts(item.product), editorialTarget: item.editorial.target, editorialFingerprint: item.editorial.fingerprint, editorialRetryAttempt: retryAttempt }, target: { type: 'product', productId: String(item.product.id), name: clean(item.product.nazwa, 180), channels: item.editorial.target.channels, editorialFingerprint: item.editorial.fingerprint } }, { source: 'background-agent' });
        const assessment = automaticEditorialAssessment(draft, current.config);
        if (assessment.eligible) {
          const result = await applyProductDraft(draft.id, { source: 'background-agent' }, { missingOnly: false, editorialAutomatic: true, editorialPolicyValidated: true, editorialTarget: item.editorial.target, editorialFingerprint: item.editorial.fingerprint });
          if (result.applied) applied.push({ id: draft.id, productId: String(item.product.id), name: clean(item.product.nazwa, 180), fields: Object.keys(result.patch || {}) });
          prepared.push({ id: draft.id, productId: String(item.product.id), name: clean(item.product.nazwa, 180), status: result.applied ? 'auto_applied' : 'not_needed' });
        } else {
          await markProductEditorialRetry(item.product, draft, item.editorial, assessment.reason);
          prepared.push({ id: draft.id, productId: String(item.product.id), name: clean(item.product.nazwa, 180), status: 'retry_scheduled', reason: assessment.reason });
        }
      } catch (error) {
        if (error?.code === 'agent_specialist_daily_limit') { limitReached = true; break; }
        prepared.push({ productId: String(item.product.id), name: clean(item.product.nazwa, 180), status: 'error', error: safeError(error?.message || error) });
      }
    }

    let openCatalogDecisionCount = current.decisions.filter((item) => item.kind === 'catalog_identity' && activeDecision(item, now())).length;
    for (const product of products.slice().sort((a, b) => String(b.createdAt || b.dataDodania || '').localeCompare(String(a.createdAt || a.dataDodania || ''))).slice(0, 200)) {
      const missing = [!clean(product.gtin || product.ean, 80) && 'EAN', !clean(product.producent || product.marka, 120) && 'producent', !clean(product.kategoria, 160) && 'kategoria'].filter(Boolean);
      if (!missing.length) continue;
      const target = { type: 'product', productId: String(product.id), name: clean(product.nazwa, 180), missing }, fp = decisionFingerprint('catalog_identity', target); activeFingerprints.add(fp);
      const existing = current.decisions.find((entry) => entry.fingerprint === fp && ['open', 'snoozed'].includes(entry.status));
      if (existing || openCatalogDecisionCount >= 12) continue;
      const decision = await upsertDecision({ fingerprint: fp, kind: 'catalog_identity', specialist: 'catalog_quality', icon: '🛡️', title: `Brak danych identyfikacyjnych: ${clean(product.nazwa, 120) || product.id}`, summary: `Brakuje: ${missing.join(', ')}. Agent nie może bezpiecznie zgadywać tych danych.`, recommendation: 'Uzupełnij brak z linku producenta albo karty produktu przed publikacją na zewnętrznych kanałach.', alternatives: ['Otwórz produkt', 'Odłóż na 1 dzień', 'Odrzuć ostrzeżenie'], risk: 'medium', target, href: '#/admin/asortyment/produkty' });
      decisionResults.push(decision); openCatalogDecisionCount += 1;
    }

    const productById = new Map(products.map((product) => [String(product.id), product]));
    for (const decision of current.decisions.filter((item) => activeDecision(item, now()))) {
      if (autoResolvedDecisionIds.has(decision.id)) continue;
      if (decision.kind === 'product_content_review') {
        const product = productById.get(String(decision.target?.productId || ''));
        const editorial = product ? productEditorialState(product) : null;
        if (product && !editorial.current && decision.target?.editorialFingerprint === editorial.fingerprint) activeFingerprints.add(decision.fingerprint);
      }
      if (decision.kind === 'catalog_identity') {
        const product = productById.get(String(decision.target?.productId || ''));
        if (product && (!clean(product.gtin || product.ean, 80) || !clean(product.producent || product.marka, 120) || !clean(product.kategoria, 160))) activeFingerprints.add(decision.fingerprint);
      }
    }

    const completedAt = now().toISOString(), readyBefore = editorialRows.filter((item) => item.current).length;
    const readyAfter = Math.min(products.length, readyBefore + applied.length), reviewAfter = Math.min(products.length - readyAfter, editorialRows.filter((item) => item.reviewedSameInput).length + prepared.filter((item) => item.status === 'needs_decision').length);
    const lastCycle = { startedAt: cycleStartedAt, completedAt, prepared: prepared.length, autoApplied: applied.length, decisionsCreated: decisionResults.length, communicationChecked: unresolvedCommunication.length, productsChecked: products.length, autonomy, limitReached, limitDay: day(now()), editorialProgress: { total: products.length, ready: readyAfter, pending: Math.max(0, products.length - readyAfter - reviewAfter), review: reviewAfter, selectedThisCycle: candidates.length, processedThisCycle: prepared.filter((item) => item.productId).length }, status: limitReached ? 'limit_reached' : prepared.some((item) => item.status === 'error') ? 'warning' : 'completed' };
    await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], decisions: [], updatedAt: '' }, (value) => {
      const previous = state(value), retentionCutoff = now().getTime() - previous.config.decisionRetentionDays * 24 * 60 * 60_000;
      const decisions = previous.decisions.map((item) => {
        if (autoResolvedDecisionIds.has(item.id)) return normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'automatic-editorial-policy', resolutionNote: 'Bezpieczna redakcja została zapisana automatycznie zgodnie z polityką uprawnień.' }, completedAt);
        if (item.kind === 'product_content_review' && activeDecision(item, now())) return normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'automatic-editorial-policy', resolutionNote: 'Redakcja produktu działa całkowicie automatycznie i nie wymaga już decyzji administratora.' }, completedAt);
        if (!['customer_reply', 'product_content_review', 'catalog_identity'].includes(item.kind) || !activeDecision(item, now()) || activeFingerprints.has(item.fingerprint)) return item;
        return normalizeDecision({ ...item, status: 'resolved', resolvedAt: completedAt, resolvedBy: 'agent-reconciliation', resolutionNote: 'Warunek wymagający decyzji już nie występuje.' }, completedAt);
      }).filter((item) => activeDecision(item, now()) || Date.parse(item.updatedAt || item.createdAt || '') >= retentionCutoff).slice(0, MAX_DECISIONS);
      return { ...previous, decisions, lastCycle, updatedAt: completedAt };
    });
    const meaningful = prepared.length || applied.length || decisionResults.length;
    return { skipped: !meaningful, reason: meaningful ? '' : limitReached ? 'daily_limit' : 'no_candidates', prepared, applied, decisions: decisionResults.map((item) => ({ id: item.id, kind: item.kind, risk: item.risk })), lastCycle };
  }

  return Object.freeze({ status, configure, run, applyProductDraft, updateDecision, prepareProductProposal, automaticCycle, specialists: SPECIALISTS });
}

export { AGENT_ACTION_POLICY, DEFAULT_CONFIG, NEVER_AUTOMATIC, PROMPT_VERSION, RESULT_SCHEMA, SPECIALISTS, activeDecision, automaticEditorialAssessment, communicationNeedsReply, learningAutonomy, normalizeDecision, normalizeLearning, normalizeProductContentEditorialResult, normalizeResult, productEditorialFingerprint, productEditorialQuality, productEditorialState, productEditorialTarget, productEditorialTextQuality, productFacts, productPatch, sanitizeContext };
