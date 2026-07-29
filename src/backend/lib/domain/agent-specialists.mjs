import { createAgentSpecialistAutomation } from './agent-specialists-automation.mjs';
import crypto from 'node:crypto'; import { withAgentSpan, withHandoffSpan, withResponseSpan, withTrace } from '@openai/agents'; import { buildEditorialPersistencePatch, buildEditorialRetryPatch, editorialChannelForSpecialist } from './agent-product-editorial-state.mjs';
import { validManufacturerName } from './product-field-validation.mjs'; import { createPlatformPromptProfile, requestSpecialistResponse } from './agent-specialist-openai.mjs';
import { enforceProductEditorialCompliance } from './agent-specialist-compliance.mjs'; import { specialistPlaybook, specialistPlaybookDetails } from './agent-specialist-playbooks.mjs';
import { buildSpecialistInstructions } from './agent-specialist-instructions.mjs';
import { requestVonHalskyAgentResponse } from './von-halsky-specialist-agent.mjs';
import { STATE_KEY, MAX_HISTORY, MAX_DECISIONS, MAX_DECISION_RECEIPTS, MAX_WRITE_ATTEMPTS, DEFAULT_CONFIG, PROMPT_VERSION, AGENT_ACTION_POLICY, NEVER_AUTOMATIC, PRODUCT_OUTPUT_TO_FIELD, SPECIALISTS, RESULT_SCHEMA, clean, number, config, safeError, sanitizeText, sanitizeContext, normalizeFieldStats, normalizeLearning, learningAutonomy, learningPrompt, state, decisionSubjectKey, decisionFingerprint, normalizeDecisionReceipt, normalizeDecision, activeDecision, outputText, normalizeResult, normalizeProductContentEditorialResult, normalizeChannelEditorialResult, fingerprint, day, responseError, sourceEditorialFacts, productFacts, productPatch, editorialIdentityConflict, SOURCE_PAGE_NOISE, productEditorialTextQuality, productEditorialQuality, automaticEditorialAssessment, valuePresent, productFieldValue, missingOnlyPatch, catalogProducts, productEditorialTarget, productEditorialSourceFingerprint, productEditorialFingerprint, productEditorialState, productEditorialAutomaticEligibility, providerQuotaUnavailable, communicationNeedsReply, communicationFacts } from './agent-specialists-support.mjs';
import { automaticBatchLimit, statusDecisionData } from './agent-specialists-status-support.mjs';
import { estimateModelUsageCost, modelPolicySummary, OPENAI_MODEL_PRICE_SNAPSHOT, specialistModelPolicy } from './agent-model-policy.mjs';
export function createAgentSpecialists({
  readVersioned, writeIfVersion, fetchImpl = globalThis.fetch, apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_AGENT_MODEL_OVERRIDE || '', now = () => new Date(),
  platformAgentsEnabled = process.env.OPENAI_PLATFORM_AGENTS !== 'false' && !String(apiKey || '').startsWith('test-'),
  platformTracingEnabled = process.env.OPENAI_PLATFORM_TRACING !== 'false' && fetchImpl === globalThis.fetch,
  platformStatus = async () => null,
  reportProgress = async () => {},
  saveProductFields = null,
  loadProducts = null,
  localFallback = {
    enabled: process.env.OLLAMA_FALLBACK_ENABLED === 'true',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_FALLBACK_MODEL || 'qwen3.5:4b',
    keepAlive: process.env.OLLAMA_KEEP_ALIVE || '30s',
  },
} = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') throw new Error('Specjaliści GPT wymagają wersjonowanego repozytorium.');
  if (typeof fetchImpl !== 'function') throw new Error('Specjaliści GPT wymagają klienta HTTP.');
  async function progress(work = {}) {
    try { await reportProgress(work); } catch { /* telemetria nie może zatrzymać zapisu produktu */ }
  }
  async function canonicalProducts(fallbackData = {}) {
    if (typeof loadProducts === 'function') {
      const loaded = await loadProducts();
      if (loaded instanceof Map) return [...loaded.values()];
      if (Array.isArray(loaded)) return loaded;
    }
    return catalogProducts(fallbackData);
  }
  async function canonicalProduct(productId = '', fallbackData = {}) {
    const id = String(productId || '');
    return (await canonicalProducts(fallbackData)).find((product) => String(product?.id) === id) || null;
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
      const previous = state(value), existing = previous.decisions.find((item) => item?.subjectKey === proposed.subjectKey || item?.fingerprint === proposed.fingerprint);
      const receipt = previous.decisionReceipts.find((item) => item?.subjectKey === proposed.subjectKey && now().getTime() - Date.parse(item.resolvedAt || '') <= previous.config.decisionRetentionDays * 24 * 60 * 60_000);
      if (!existing && receipt && raw.forceReopen !== true) return previous;
      const keepClosed = existing && ['approved', 'dismissed', 'resolved'].includes(existing.status);
      if (keepClosed && raw.forceReopen !== true) return previous;
      const decision = normalizeDecision({ ...existing, ...proposed, id: existing?.id || proposed.id, createdAt: existing?.createdAt || proposed.createdAt, status: raw.forceReopen === true ? 'open' : existing?.status === 'snoozed' ? 'snoozed' : proposed.status }, timestamp);
      return { ...previous, decisions: [decision, ...previous.decisions.filter((item) => item?.id !== decision.id)].slice(0, MAX_DECISIONS), updatedAt: timestamp };
    });
    const saved = next.decisions.find((item) => item.subjectKey === proposed.subjectKey || item.fingerprint === proposed.fingerprint);
    if (saved) return saved;
    const receipt = next.decisionReceipts.find((item) => item.subjectKey === proposed.subjectKey);
    return receipt ? { ...proposed, status: receipt.status, resolvedAt: receipt.resolvedAt, resolvedBy: receipt.resolvedBy, suppressed: true } : proposed;
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
      const settingsVersion = await readVersioned('settings', { data: {}, rev: 0 }), product = await canonicalProduct(decision.target?.productId, settingsVersion.value?.data || {});
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
      const decisionAfter = normalizeDecision({ ...decision, ...patch }, timestamp), reopening = safeAction === 'reopen';
      const receipts = reopening ? current.decisionReceipts.filter((item) => item.subjectKey !== decisionAfter.subjectKey) : ['approved', 'dismissed', 'resolved'].includes(decisionAfter.status) ? [normalizeDecisionReceipt(decisionAfter, timestamp), ...current.decisionReceipts.filter((item) => item.subjectKey !== decisionAfter.subjectKey)].slice(0, MAX_DECISION_RECEIPTS) : current.decisionReceipts;
      return { ...current, decisions: current.decisions.map((item) => item?.id === safeId ? decisionAfter : item), decisionReceipts: receipts, updatedAt: timestamp };
    });
    const feedbackRun = previous.history.find((item) => item?.id === decision.runId);
    if (feedbackRun && safeAction === 'dismiss') await recordProductFeedback(feedbackRun, 'dismissed', raw, actor);
    return { ...next.decisions.find((item) => item?.id === safeId), executionResult };
  }

  async function status(options = {}) {
    const historyLimit = Math.max(5, Math.min(80, Number(options?.historyLimit) || 30));
    const current = await readState(), today = day(now()), todayRuns = current.history.filter((item) => { const created = new Date(item?.createdAt || ''); return Number.isFinite(created.getTime()) && day(created) === today; });
    const includeInstructions = options?.includeInstructions === true;
    const automaticRuns = todayRuns.filter((item) => item.source === 'automatic');
    const sumUsage = (rows, key) => rows.reduce((sum, item) => sum + Number(item?.usage?.[key] || 0), 0);
    const usageByModel = Object.values(todayRuns.reduce((result, item) => {
      const modelName = clean(item?.model || 'unknown', 100);
      const row = result[modelName] || { model: modelName, runs: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, estimatedUsd: 0 };
      row.runs += 1;
      row.inputTokens += Number(item?.usage?.inputTokens || 0);
      row.outputTokens += Number(item?.usage?.outputTokens || 0);
      row.totalTokens += Number(item?.usage?.totalTokens || 0);
      row.cachedTokens += Number(item?.usage?.cachedTokens || 0);
      row.cacheWriteTokens += Number(item?.usage?.cacheWriteTokens || 0);
      row.estimatedUsd += estimateModelUsageCost(modelName, item?.usage || {});
      result[modelName] = row;
      return result;
    }, {})).map((item) => ({ ...item, estimatedUsd: Number(item.estimatedUsd.toFixed(4)) }));
    const estimatedUsd = Number(usageByModel.reduce((sum, item) => sum + item.estimatedUsd, 0).toFixed(4));
    let openaiPlatform = null;
    try { openaiPlatform = await platformStatus(); } catch { openaiPlatform = null; }
    const decisions = current.decisions.map((item) => item.status === 'snoozed' && activeDecision(item, now()) ? { ...item, status: 'open', snoozedUntil: '' } : item);
    const autonomy = learningAutonomy(current.learning, current.config), productLearning = current.learning.product_content;
    const scenarioStats = Object.values(SPECIALISTS).filter((item) => item.scenario?.id).map((definition) => {
      const runs = current.history.filter((item) => item?.scenario?.id === definition.scenario.id);
      return {
        id: definition.scenario.id, version: definition.scenario.version, specialist: definition.label,
        runs: runs.length, autoApplied: runs.filter((item) => item.approvalStatus === 'auto_applied').length,
        corrected: runs.filter((item) => item.approvalStatus === 'corrected').length,
        lastRunAt: runs[0]?.createdAt || '', lastStatus: runs[0]?.approvalStatus || '',
      };
    });
    const { activeDecisions, statusHistory } = statusDecisionData(current, decisions, historyLimit, now());
    return {
      configured: !!clean(apiKey, 500), model: clean(model, 80) || 'routing automatyczny', modelRouting: modelPolicySummary({ override: model }), config: current.config,
      promptVersion: PROMPT_VERSION,
      policy: {
        mode: 'event_queue_plus_versioned_gpt_scenarios', cycleMinutes: 15, detectorMinutes: 15, maxJobsPerCycle: 2, safeAutoApply: current.config.safeAutoApply,
        progressiveAutonomy: true, editorialAutonomy: current.config.autoApplyProductEditorial !== false,
        linkedAllegroContentAutonomy: current.config.autoUpdateLinkedAllegroContent !== false,
        neverAutomatic: NEVER_AUTOMATIC, actionPolicy: AGENT_ACTION_POLICY,
      },
      learning: { productContent: { ...autonomy, updatedAt: productLearning.updatedAt, fieldStats: productLearning.fieldStats, recentExamples: productLearning.examples.slice(0, 6) } },
      coordinator: { id: 'codex-cli', label: 'Codex', role: 'manager', active: true, scenarioPolicy: 'closed-versioned-registry' },
      platformAgents: {
        enabled: platformAgentsEnabled,
        configured: !!clean(apiKey, 500),
        publishedProfiles: Object.values(SPECIALISTS).filter((item) => !!item.platformPrompt?.id && !!item.platformPrompt?.version).length,
        serverProfiles: Object.values(SPECIALISTS).filter((item) => !item.platformPrompt?.id || !item.platformPrompt?.version).length,
        executionModel: clean(model, 80) || 'routing per specjalista', coordinatorId: 'codex-cli', registry: 'versioned-platform-prompts+agents-sdk',
        legacySupervisorProfileId: SPECIALISTS.operations_supervisor.assistantId,
      },
      openaiPlatform,
      scenarioStats,
      specialists: Object.entries(SPECIALISTS).map(([id, value]) => {
        const fullInstruction = specialistPlaybook(id), details = specialistPlaybookDetails(id);
        return {
          id, ...value, promptVersion: PROMPT_VERSION,
          deployment: id.startsWith('von_halsky')
            ? 'openai-agents-sdk+typed-output+deterministic-tools'
            : 'responses-api+versioned-server-playbook',
          modelPolicy: specialistModelPolicy(id, { override: model }),
          platformAvailable: !!value.platformPrompt?.id, platformName: value.label,
          platformUrl: value.platformPrompt?.id ? `https://platform.openai.com/chat/edit?prompt=${encodeURIComponent(value.platformPrompt.id)}&version=${encodeURIComponent(value.platformPrompt.version || '1')}` : '',
          instructionCharacters: fullInstruction.length,
          instructionSections: details ? Object.keys(details).filter((key) => Array.isArray(details[key]) && details[key].length).length : 0,
          ...(includeInstructions ? { fullInstruction, instructionDetails: details } : {}),
        };
      }),
      usage: {
        today: todayRuns.length,
        automaticToday: automaticRuns.length,
        inputTokens: sumUsage(todayRuns, 'inputTokens'),
        outputTokens: sumUsage(todayRuns, 'outputTokens'),
        cachedTokens: sumUsage(todayRuns, 'cachedTokens'),
        cacheWriteTokens: sumUsage(todayRuns, 'cacheWriteTokens'),
        automaticInputTokens: sumUsage(automaticRuns, 'inputTokens'),
        automaticOutputTokens: sumUsage(automaticRuns, 'outputTokens'),
        automaticInputTokenLimit: current.config.automaticInputTokenLimit,
        automaticOutputTokenLimit: current.config.automaticOutputTokenLimit,
        usageByModel,
        estimatedUsd,
        pricingSnapshot: OPENAI_MODEL_PRICE_SNAPSHOT,
        limitsEnabled: current.config.limitsEnabled === true,
        dailyLimitReached: current.config.limitsEnabled === true && todayRuns.length >= current.config.dailyLimit,
        automaticLimitReached: current.config.limitsEnabled === true && (automaticRuns.length >= current.config.automaticDailyLimit
          || sumUsage(automaticRuns, 'inputTokens') >= current.config.automaticInputTokenLimit
          || sumUsage(automaticRuns, 'outputTokens') >= current.config.automaticOutputTokenLimit),
        limitDay: today,
      },
      decisions: activeDecisions,
      decisionStats: {
        open: decisions.filter((item) => activeDecision(item, now())).length,
        high: decisions.filter((item) => activeDecision(item, now()) && item.risk === 'high').length,
        completed: decisions.filter((item) => ['approved', 'resolved'].includes(item.status)).length,
      },
      recentDecisions: decisions.filter((item) => ['approved', 'dismissed', 'resolved'].includes(item.status)).sort((a, b) => String(b.resolvedAt || b.updatedAt).localeCompare(String(a.resolvedAt || a.updatedAt))).slice(0, 20),
      history: statusHistory, lastCycle: current.lastCycle, updatedAt: current.updatedAt,
    };
  }

  async function configure(raw = {}) {
    const nextConfig = config(raw);
    const next = await change(STATE_KEY, { config: DEFAULT_CONFIG, history: [], updatedAt: '' }, (value) => ({ ...state(value), config: nextConfig, updatedAt: now().toISOString() }));
    return next.config;
  }

  async function run(raw = {}, actor = {}) {
    const specialist = clean(raw.specialist, 80), definition = SPECIALISTS[specialist];
    if (!definition) throw Object.assign(new Error('Wybierz dostępnego specjalistę OpenAI.'), { code: 'agent_specialist_invalid', status: 422 });
    if (!clean(apiKey, 500)) throw Object.assign(new Error('Brakuje konfiguracji OpenAI dla specjalistów.'), { code: 'openai_not_configured', status: 503 });
    const current = await readState(), source = raw.source === 'automatic' ? 'automatic' : 'manual';
    if (!current.config.enabled || (source === 'automatic' && !current.config.automaticEnabled)) throw Object.assign(new Error('Ten tryb specjalistów GPT jest wyłączony w ustawieniach.'), { code: 'agent_specialists_disabled', status: 409 });
    const today = day(now()), todayRuns = current.history.filter((item) => { const created = new Date(item?.createdAt || ''); return Number.isFinite(created.getTime()) && day(created) === today; });
    const automaticRuns = todayRuns.filter((item) => item.source === 'automatic');
    const automaticInputTokens = automaticRuns.reduce((sum, item) => sum + Number(item?.usage?.inputTokens || 0), 0);
    const automaticOutputTokens = automaticRuns.reduce((sum, item) => sum + Number(item?.usage?.outputTokens || 0), 0);
    if (current.config.limitsEnabled === true && (todayRuns.length >= current.config.dailyLimit || (source === 'automatic' && (
      automaticRuns.length >= current.config.automaticDailyLimit
      || automaticInputTokens >= current.config.automaticInputTokenLimit
      || automaticOutputTokens >= current.config.automaticOutputTokenLimit
    )))) {
      throw Object.assign(new Error('Osiągnięto dzienny limit kontrolujący koszt agentów OpenAI.'), { code: 'agent_specialist_daily_limit', status: 429 });
    }
    const scenarioInput = raw.scenario && typeof raw.scenario === 'object' ? raw.scenario : {};
    const scenario = {
      id: clean(scenarioInput.id || definition.scenario?.id || `${specialist}-manual`, 100),
      version: clean(scenarioInput.version || definition.scenario?.version || PROMPT_VERSION, 80),
      assignedBy: clean(scenarioInput.assignedBy || (source === 'automatic' ? 'codex' : 'administrator'), 60),
      coordinatorRunId: clean(scenarioInput.coordinatorRunId || '', 120),
      objective: clean(scenarioInput.objective || definition.description, 500),
      qualityGates: (Array.isArray(scenarioInput.qualityGates) ? scenarioInput.qualityGates : []).slice(0, 12).map((item) => clean(item, 180)).filter(Boolean),
    };
    if (definition.scenario?.id && scenario.id !== definition.scenario.id) throw Object.assign(new Error('Scenariusz nie pasuje do wybranego specjalisty.'), { code: 'agent_scenario_specialist_mismatch', status: 422 });
    const instruction = sanitizeText(raw.instruction || `Przygotuj profesjonalny szkic jako ${definition.label}.`, 3000), context = sanitizeContext(raw.context || {}), learnedGuidance = current.config.learningEnabled ? learningPrompt(current.learning, specialist) : '', hash = fingerprint(specialist, instruction, { context, scenarioId: scenario.id, scenarioVersion: scenario.version, learningUpdatedAt: current.learning?.product_content?.updatedAt || '' });
    const cacheMs = current.config.cacheHours * 60 * 60_000, cached = current.history.find((item) => item.fingerprint === hash && item.status === 'completed' && now().getTime() - Date.parse(item.createdAt || '') <= cacheMs);
    if (cached) return { ...cached, cached: true };
    const runId = `gpt_${Date.now()}_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`, createdAt = now().toISOString(), target = sanitizeContext(raw.target || {});
    const executionPolicy = specialistModelPolicy(specialist, { override: model });
    const qualityFallbackPolicy = specialistModelPolicy(specialist, { override: model, escalation: true });
    const platformProfile = createPlatformPromptProfile(definition, { enabled: platformAgentsEnabled, apiKey, model: executionPolicy.model });
    const instructions = buildSpecialistInstructions({
      specialist,
      definition,
      promptVersion: PROMPT_VERSION,
      platformProfile,
    });
    const dynamicInput = {
      zadanie: instruction,
      scenariusz: {
        id: scenario.id,
        version: scenario.version,
        objective: scenario.objective,
        qualityGates: scenario.qualityGates,
        assignedBy: scenario.assignedBy,
      },
      fakty: context,
      ...(learnedGuidance ? { zatwierdzonePreferencjeAdministratora: learnedGuidance } : {}),
    };
    // W produkcji Von Halsky korzysta z pełnego Agents SDK. Wstrzyknięty
    // transport jest kontraktem testów/integracji offline i pozostaje na
    // przewidywalnym adapterze Responses API, dzięki czemu nie omija atrap
    // sieci ani nie próbuje użyć prawdziwego klucza.
    const dedicatedVonHalskyRuntime = ['von_halsky_offer', 'von_halsky_compliance'].includes(specialist)
      && fetchImpl === globalThis.fetch;
    const semanticValidator = ['product_content', 'allegro_offer', 'von_halsky_offer'].includes(specialist)
      ? (parsed) => {
          try {
            const normalized = normalizeResult(parsed, specialist);
            const title = clean(normalized.title, 300);
            const content = clean(normalized.content, 30_000);
            const fields = Array.isArray(normalized.fields) ? normalized.fields : [];
            // Transport odrzuca wyłącznie ewidentnie uszkodzoną odpowiedź
            // (np. tytuł ":{"). Pełną kompletność i zgodność ocenia później
            // bramka właściwego kanału, dzięki czemu wynik „brakuje faktów”
            // pozostaje prawidłowym, audytowalnym rezultatem pracy.
            return /\p{L}{2}/u.test(title)
              && !/^(?:[:;,.!?'"`~*#_[\]{}()<>/\\|\s-]|null|undefined){1,30}$/i.test(title)
              && (fields.length > 0 || content.length >= 20);
          } catch {
            return false;
          }
        }
      : null;
    const executeRequest = () => dedicatedVonHalskyRuntime
      ? requestVonHalskyAgentResponse({
        model: executionPolicy.model,
        qualityFallbackModel: qualityFallbackPolicy.model,
        reasoning: executionPolicy.reasoning,
        maxOutputTokens: executionPolicy.maxOutputTokens,
        input: JSON.stringify(dynamicInput),
      })
      : requestSpecialistResponse({
        fetchImpl,
        apiKey,
        model: executionPolicy.model,
        qualityFallbackModel: qualityFallbackPolicy.model,
        localFallback,
        reasoning: executionPolicy.reasoning,
        maxOutputTokens: executionPolicy.maxOutputTokens,
        promptCacheKey: `artway:${specialist}:${PROMPT_VERSION}`,
        promptProfile: platformProfile,
        instructions,
        input: JSON.stringify(dynamicInput),
        resultSchema: RESULT_SCHEMA,
        semanticValidator,
      });
    const request = platformAgentsEnabled && platformTracingEnabled ? await withTrace(
      `Artway — ${definition.label}`,
      async () => withHandoffSpan(
        async () => withAgentSpan(
          async () => withResponseSpan(async (span) => {
            const result = await executeRequest();
            span.spanData.response_id = clean(result?.payload?.id, 120) || undefined;
            return result;
          }),
          {
            data: {
              name: definition.label,
              output_type: 'artway_specialist_result',
              tools: [],
              handoffs: [],
            },
          },
        ),
        {
          data: {
            from_agent: scenario.assignedBy === 'codex' ? 'Artway — Koordynator Codex' : 'Artway — Administrator',
            to_agent: definition.label,
          },
        },
      ),
      {
        groupId: clean(target?.productId || scenario.coordinatorRunId || runId, 120),
        metadata: {
          project: 'artway-sklep',
          specialist,
          scenario: scenario.id,
          source,
          product_id: clean(target?.productId, 120),
        },
        tracingApiKey: apiKey,
      },
    ) : await executeRequest();
    const { response, payload } = request;
    if (!response.ok) throw responseError(response, payload);
    let parsed;
    try { parsed = JSON.parse(outputText(payload)); }
    catch (error) {
      if (error?.code) throw error;
      throw Object.assign(new Error('Agent OpenAI zwrócił nieprawidłowy wynik strukturalny.'), { code: 'openai_invalid_json', status: 502 });
    }
    const result = normalizeResult(parsed, specialist), usage = {
      inputTokens: number(payload?.usage?.input_tokens, 0, 0, 10_000_000),
      outputTokens: number(payload?.usage?.output_tokens, 0, 0, 10_000_000),
      totalTokens: number(payload?.usage?.total_tokens, 0, 0, 20_000_000),
      cachedTokens: number(payload?.usage?.input_tokens_details?.cached_tokens, 0, 0, 10_000_000),
      cacheWriteTokens: number(payload?.usage?.input_tokens_details?.cache_write_tokens, 0, 0, 10_000_000),
    };
    const entry = {
      id: runId, specialist, specialistLabel: definition.label, status: 'completed', source, createdAt, model: clean(payload.model || executionPolicy.model, 80), modelTier: request.localFallbackApplied ? 'local-emergency' : request.qualityFallback ? 'quality-fallback' : executionPolicy.tier, reasoningEffort: executionPolicy.reasoning, maxOutputTokens: executionPolicy.maxOutputTokens,
      instruction: clean(instruction, 500), target, fingerprint: hash, result, usage, approvalStatus: 'draft', promptVersion: PROMPT_VERSION, scenario,
      promptCache: {
        enabled: request.promptCacheEnabled === true,
        mode: request.promptCacheMode || 'disabled',
        fallback: request.promptCacheFallback === true,
        key: `artway:${specialist}:${PROMPT_VERSION}`,
      },
      providerFallback: {
        qualityModel: request.qualityFallback === true,
        localModel: request.localFallbackApplied === true,
      },
      platformAgent: platformProfile ? {
        id: platformProfile.id, name: platformProfile.name, version: platformProfile.version,
        available: request.promptApplied, fallback: request.promptFallback, error: request.promptError || '',
      } : null,
      agentRuntime: request.agentRuntime || {
        sdk: 'responses-api',
        workflow: 'artway-versioned-specialist',
        promptVersion: PROMPT_VERSION,
      },
      actor: clean(actor?.email || actor?.name || actor?.source || 'administrator', 120),
    };
    await appendHistory(entry);
    return entry;
  }
  const {
    applyProductDraft, prepareProductProposal, prepareVonHalskyProposal,
    automaticCycleUnlocked,
  } = createAgentSpecialistAutomation({
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
  });

  // Timer i panel mogą zażądać cyklu w tej samej chwili. Tylko jeden
  // wykonawca może wybierać produkty; pozostałe wywołania dostają jawny status
  // zamiast tworzyć drugi szkic dla tego samego odcisku danych.
  let automaticCyclePromise = null;
  async function automaticCycle(options = {}) {
    if (automaticCyclePromise) {
      return { skipped: true, reason: 'already_running', prepared: [], applied: [], decisions: [] };
    }
    automaticCyclePromise = automaticCycleUnlocked(options);
    try {
      return await automaticCyclePromise;
    } finally {
      automaticCyclePromise = null;
    }
  }

  return Object.freeze({ status, configure, run, applyProductDraft, updateDecision, prepareProductProposal, prepareVonHalskyProposal, automaticCycle, specialists: SPECIALISTS });
}

export { AGENT_ACTION_POLICY, DEFAULT_CONFIG, NEVER_AUTOMATIC, PROMPT_VERSION, RESULT_SCHEMA, SPECIALISTS, activeDecision, automaticEditorialAssessment, communicationNeedsReply, learningAutonomy, normalizeDecision, normalizeLearning, normalizeProductContentEditorialResult, normalizeChannelEditorialResult, normalizeResult, productEditorialAutomaticEligibility, productEditorialSourceFingerprint, productEditorialFingerprint, productEditorialQuality, productEditorialState, productEditorialTarget, productEditorialTextQuality, productFacts, productPatch, providerQuotaUnavailable, sanitizeContext };
