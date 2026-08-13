const STATE_KEY = 'allegro_preparation_decision_learning';
const MAX_WRITE_ATTEMPTS = 10;

const clean = (value = '', limit = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);
const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const preparationIssueText = (task = {}) => [
  task.name,
  task.productName,
  task.decision?.reason,
  task.downstream?.code,
  task.result?.error,
  ...asArray(task.missing),
  ...asArray(task.errors).map((item) => item?.message || item?.code),
  task.error,
].map((item) => clean(item, 1000).toLowerCase()).filter(Boolean).join(' ');

const APPLICABILITY_FAMILY_FEATURES = new Set(['bundle', 'fashion_creator', 'official_packaging_age', 'xpress_diy']);

export function allegroPreparationApplicabilityFeatures(task = {}) {
  const value = preparationIssueText(task), features = [];
  if (/\b(?:zestaw|zestawy|kuferek|kuferki|product\s*set|bundle)\b/.test(value)) features.push('bundle');
  if (/\b(?:moda|modelki|fashion|top fashion)\b/.test(value)) features.push('fashion_creator');
  if (/\b(?:x-?press|brelok diy|breloki diy)\b/.test(value)) features.push('xpress_diy');
  if (/\b(?:wiek|minimalny wiek|minimum age|age)\b/.test(value)) features.push('official_packaging_age');
  if (/gpsr|nazwa producenta|adres producenta|e-?mail producenta|responsible producer/.test(value)) features.push('responsible_producer');
  if (/ean|gtin|kod producenta|sku|identyfik|catalog id|product id/.test(value)) features.push('identity');
  if (/kategori/.test(value)) features.push('category');
  if (/parametr|atrybut|kolor|liczba sztuk|\btyp\b/.test(value)) features.push('parameters');
  if (/zdj[eę]ci|image|media/.test(value)) features.push('images');
  if (/opis|nazwa|tytu[łl]|redakc/.test(value)) features.push('editorial');
  return [...new Set(features)].sort();
}

function customSolutionApplies(item = {}, task = {}) {
  const solutionFeatures = asArray(item.contextFeatures).filter(Boolean);
  if (!solutionFeatures.length) return true;
  const taskFeatures = new Set(allegroPreparationApplicabilityFeatures(task));
  const family = solutionFeatures.filter((feature) => APPLICABILITY_FAMILY_FEATURES.has(feature));
  if (family.length) return family.some((feature) => taskFeatures.has(feature));
  return solutionFeatures.some((feature) => taskFeatures.has(feature));
}

export const ALLEGRO_PREPARATION_RESOLUTIONS = Object.freeze({
  official_source: Object.freeze({
    id: 'official_source',
    title: 'Agent: pełna naprawa ze źródeł',
    description: 'Sprawdź kartotekę producenta, katalog Allegro, kategorię, parametry, zdjęcia i GPSR, a następnie zapisz wyłącznie potwierdzone dane.',
    effect: 'Zadanie otrzyma najwyższy priorytet. Agent niczego nie publikuje.',
    action: 'queue',
  }),
  verified_data: Object.freeze({
    id: 'verified_data',
    title: 'Tylko dane pewne — bez redakcji AI',
    description: 'Uzupełnij identyfikatory, kategorię, parametry i dane bezpieczeństwa na podstawie istniejących pewnych źródeł.',
    effect: 'Niepewna treść pozostanie do decyzji; nie powstaną wymyślone dane.',
    action: 'queue',
  }),
  manual_editor: Object.freeze({
    id: 'manual_editor',
    title: 'Otwórz edytor i zdecyduj ręcznie',
    description: 'Przejdź do właściwej kartoteki ze wskazaniem konkretnych braków i wpisz dane samodzielnie.',
    effect: 'Agent zapamięta wybór dla podobnych problemów, ale nie uruchomi naprawy.',
    action: 'editor',
  }),
});

export const ALLEGRO_PUBLICATION_RESOLUTIONS = Object.freeze({
  repair_then_review: Object.freeze({
    id: 'repair_then_review',
    title: 'Agent naprawia i przygotowuje kontrolę',
    description: 'Usuń przyczynę błędu w centralnej kartotece, zbuduj szkic od nowa i zatrzymaj się przed publikacją.',
    effect: 'Naprawa otrzyma wysoki priorytet • bez publikacji',
    action: 'queue_repair',
  }),
  verify_remote_state: Object.freeze({
    id: 'verify_remote_state',
    title: 'Agent sprawdza stan i powiązanie',
    description: 'Porównaj kartotekę, zapisane ID oferty i dane kanału, aby wykluczyć duplikat lub niepotwierdzony zapis.',
    effect: 'Bezpieczna kontrola i przygotowanie • bez publikacji',
    action: 'queue_verification',
  }),
  manual_editor: Object.freeze({
    id: 'manual_editor',
    title: 'Otwórz właściwe miejsce w edytorze',
    description: 'Przejdź do centralnej kartoteki i popraw dane samodzielnie, zachowując widoczny komunikat Allegro.',
    effect: 'Bez automatycznej naprawy i bez publikacji',
    action: 'editor',
  }),
  retry_publication: Object.freeze({
    id: 'retry_publication',
    title: 'Ponów operację po potwierdzeniu',
    description: 'Utwórz nowe zadanie publikacji dla tego produktu dopiero po dodatkowym potwierdzeniu administratora.',
    effect: 'Operacja zewnętrzna • wymagane osobne potwierdzenie',
    action: 'confirm_publication',
  }),
});

const ALL_RESOLUTIONS = Object.freeze({
  ...ALLEGRO_PREPARATION_RESOLUTIONS,
  ...ALLEGRO_PUBLICATION_RESOLUTIONS,
});

export function allegroPreparationIssueSignature(task = {}) {
  const value = preparationIssueText(task);
  const keys = [];
  if (/gpsr|bezpiecze|producenta|manufacturer|responsible/.test(value)) keys.push('gpsr');
  if (/ean|gtin|kod producenta|sku|identyfik/.test(value)) keys.push('identity');
  if (/kategori/.test(value)) keys.push('category');
  if (/parametr|atrybut|kolor|wiek|liczba sztuk|typ/.test(value)) keys.push('parameters');
  if (/zdj[eę]ci|image|media/.test(value)) keys.push('images');
  if (/opis|nazwa|tytu[łl]|redakc/.test(value)) keys.push('editorial');
  return keys.length ? [...new Set(keys)].sort().join('+') : 'other';
}

export function allegroPublicationIssueSignature(task = {}) {
  const value = [task.errorCode, task.error, task.result?.error, task.result?.message]
    .map((item) => clean(item, 1000).toLowerCase()).filter(Boolean).join(' ');
  if (/gallerysize|gallery.size|limit zdj[eę][ćc]|maksymalnie.*16|too many image/.test(value)) return 'publication:gallery_limit';
  if (/identity|tożsamo|duplicate|duplikat|catalog.*conflict|product.*conflict/.test(value)) return 'publication:identity_conflict';
  if (/unconfirmed|nie potwierdzi|missing.offer.id|missing_offer_id|status.*ofert/.test(value)) return 'publication:unconfirmed_state';
  if (/gpsr|bezpiecze|responsible|manufacturer/.test(value)) return 'publication:gpsr';
  if (/parametr|parameter|atrybut|constraint/.test(value)) return 'publication:parameters';
  if (/auth|token|permission|uprawn|unauthor/.test(value)) return 'publication:authorization';
  return 'publication:other';
}

export function allegroAutomaticIssuePolicy(task = {}, kind = 'preparation') {
  const signature = kind === 'publication'
    ? allegroPublicationIssueSignature(task)
    : allegroPreparationIssueSignature(task);
  const policies = {
    gpsr: ['catalog_gpsr_first', 'Agent najpierw używa GPSR dokładnie potwierdzonego produktu katalogowego; bez UUID nie wymyśla ostrzeżeń.'],
    'gpsr+parameters': ['catalog_schema_and_gpsr', 'Agent odświeża schemat kategorii i GPSR dokładnego produktu katalogowego, a zatrzymuje wyłącznie brak bez pewnego źródła.'],
    parameters: ['reselect_exact_category_and_schema', 'Agent ponownie dobiera dokładną kategorię produktu i odświeża jej schemat przed uzupełnieniem parametrów; nie wymyśla wartości tylko po to, aby przejść walidację.'],
    'category+parameters': ['reselect_exact_category_and_schema', 'Agent ponownie dobiera dokładną kategorię produktu i odświeża jej schemat przed uzupełnieniem parametrów; nie wymyśla wartości tylko po to, aby przejść walidację.'],
    'publication:gallery_limit': ['shared_gallery_budget', 'Każdy szkic rezerwuje wspólny limit 16 dla zdjęć katalogowych i własnych, zanim trafi do kolejki publikacji.'],
    'publication:unconfirmed_state': ['remote_readback_before_retry', 'Agent odczytuje zapisane ID i stan oferty przed ponowieniem; potwierdzony wynik zamyka zadanie bez drugiej publikacji.'],
    'publication:identity_conflict': ['identity_quarantine', 'Agent porównuje wszystkie kartoteki o tym samym EAN/SKU i zatrzymuje automat, jeśli nie ma jednego zwycięzcy.'],
    'publication:parameters': ['refresh_category_schema', 'Agent odbudowuje szkic z aktualnego schematu kategorii i nie przenosi nieaktualnych wartości zależnych.'],
  };
  const selected = policies[signature] || ['verified_facts_only', 'Agent stosuje wyłącznie potwierdzone dane i zatrzymuje operację zewnętrzną do zatwierdzenia.'];
  return { id: selected[0], signature, description: selected[1], automatic: true, externalPublication: false };
}

function normalizeLearning(value = {}) {
  const source = asObject(value);
  const customSolutions = {};
  for (const [signature, rawItems] of Object.entries(asObject(source.customSolutions))) {
    const key = clean(signature, 200);
    if (!key) continue;
    customSolutions[key] = asArray(rawItems).map((item) => ({
      id: clean(item?.id, 80),
      title: clean(item?.title, 120),
      description: clean(item?.description, 1000),
      baseResolutionId: ALLEGRO_PREPARATION_RESOLUTIONS[item?.baseResolutionId] ? item.baseResolutionId : 'official_source',
      enabled: item?.enabled !== false,
      createdBy: clean(item?.createdBy, 200),
      createdAt: clean(item?.createdAt, 50),
      useCount: Math.max(0, Number(item?.useCount) || 0),
      lastUsedAt: clean(item?.lastUsedAt, 50),
      contextFeatures: asArray(item?.contextFeatures).map((feature) => clean(feature, 80)).filter(Boolean).slice(0, 20),
    })).filter((item) => /^solution-[a-z0-9-]+$/i.test(item.id) && item.title && item.description).slice(0, 30);
  }
  const preferences = {};
  for (const [signature, raw] of Object.entries(asObject(source.preferences))) {
    const entry = asObject(raw), counts = {};
    for (const resolutionId of Object.keys(ALL_RESOLUTIONS)) {
      counts[resolutionId] = Math.max(0, Number(asObject(entry.counts)[resolutionId]) || 0);
    }
    preferences[clean(signature, 200)] = {
      counts,
      lastChoice: (ALL_RESOLUTIONS[entry.lastChoice] || /^solution-[a-z0-9-]+$/i.test(clean(entry.lastChoice, 80))) ? clean(entry.lastChoice, 80) : '',
      lastAt: clean(entry.lastAt, 50),
    };
  }
  const policy = asObject(source.priorityPolicy);
  return {
    version: 4,
    preferences,
    customSolutions,
    history: asArray(source.history).map((item) => ({
      productId: clean(item?.productId, 100),
      taskId: clean(item?.taskId, 120),
      signature: clean(item?.signature, 200),
      kind: item?.kind === 'publication' ? 'publication' : 'preparation',
      resolutionId: (ALL_RESOLUTIONS[item?.resolutionId] || /^solution-[a-z0-9-]+$/i.test(clean(item?.resolutionId, 80))) ? clean(item.resolutionId, 80) : '',
      selectedBy: clean(item?.selectedBy, 200),
      selectedAt: clean(item?.selectedAt, 50),
    })).filter((item) => item.productId && item.resolutionId).slice(0, 500),
    priorityPolicy: {
      scope: clean(policy.scope, 40),
      label: clean(policy.label, 120),
      matched: Math.max(0, Number(policy.matched) || 0),
      selectedBy: clean(policy.selectedBy, 200),
      selectedAt: clean(policy.selectedAt, 50),
    },
  };
}

export function allegroPreparationResolutionOptions(task = {}, learning = {}) {
  const signature = allegroPreparationIssueSignature(task);
  const preference = asObject(asObject(learning.preferences)[signature]);
  const counts = asObject(preference.counts);
  const custom = asArray(asObject(learning.customSolutions)[signature])
    .filter((item) => item?.enabled !== false)
    .map((item) => asArray(item?.contextFeatures).length ? item : {
      ...item,
      contextFeatures: allegroPreparationApplicabilityFeatures({ name: item?.title, missing: [item?.description] }),
    })
    .filter((item) => customSolutionApplies(item, task));
  const learned = [
    ...Object.keys(ALLEGRO_PREPARATION_RESOLUTIONS).map((id) => [id, Math.max(0, Number(counts[id]) || 0)]),
    ...custom.map((item) => [item.id, Math.max(0, Number(item.useCount) || 0)]),
  ].sort((left, right) => right[1] - left[1])[0];
  const rememberedCustom = custom.find((item) => item.id === preference.lastChoice && Number(item.useCount) > 0);
  const recommendedId = rememberedCustom?.id || (learned?.[1] > 0 ? learned[0] : 'official_source');
  const recommendedCount = rememberedCustom ? Number(rememberedCustom.useCount) : (learned?.[1] || 0);
  const customOptions = custom.map((item) => {
    const base = ALLEGRO_PREPARATION_RESOLUTIONS[item.baseResolutionId] || ALLEGRO_PREPARATION_RESOLUTIONS.official_source;
    return {
      ...base,
      id: item.id,
      baseResolutionId: base.id,
      title: item.title,
      description: item.description,
      custom: true,
      recommended: item.id === recommendedId,
      learnedCount: Math.max(0, Number(item.useCount) || 0),
    };
  });
  return {
    signature,
    learnedChoice: recommendedCount > 0 ? recommendedId : '',
    learnedCount: recommendedCount,
    options: [...Object.values(ALLEGRO_PREPARATION_RESOLUTIONS)
      .map((option) => ({
        ...option,
        baseResolutionId: option.id,
        recommended: option.id === recommendedId,
        learnedCount: Math.max(0, Number(counts[option.id]) || 0),
      })), ...customOptions]
      .sort((left, right) => Number(right.recommended) - Number(left.recommended)),
  };
}

function publicationOptionCopy(option, signature) {
  const copies = {
    'publication:gallery_limit': {
      repair_then_review: ['Agent porządkuje galerię', 'Uwzględnij limit 16 zdjęć razem ze zdjęciami produktu katalogowego i przygotuj poprawny szkic.'],
      verify_remote_state: ['Sprawdź galerię oferty i katalogu', 'Porównaj zdjęcia własne z katalogowymi oraz zapisanym stanem oferty przed kolejną próbą.'],
      retry_publication: ['Ponów dopiero po naprawie galerii', 'Nowe zadanie zostanie dodane wyłącznie po osobnym potwierdzeniu administratora.'],
    },
    'publication:identity_conflict': {
      repair_then_review: ['Agent naprawia tożsamość produktu', 'Dopasuj wyłącznie po potwierdzonym EAN/GTIN, kodzie producenta i zgodnych cechach katalogowych.'],
      verify_remote_state: ['Porównaj istniejącą ofertę i katalog', 'Sprawdź zapisane ID oferty oraz produktu katalogowego, aby nie utworzyć duplikatu.'],
    },
    'publication:unconfirmed_state': {
      repair_then_review: ['Przygotuj ponowną kontrolę kartoteki', 'Sprawdź dane szkicu i gotowość produktu, lecz nie wysyłaj ponownie oferty.'],
      verify_remote_state: ['Najpierw sprawdź stan w Allegro', 'Zweryfikuj ID i ostatni potwierdzony stan, zanim powstanie jakiekolwiek nowe zadanie publikacji.'],
    },
  };
  const copy = copies[signature]?.[option.id];
  return copy ? { ...option, title: copy[0], description: copy[1] } : { ...option };
}

export function allegroPublicationResolutionOptions(task = {}, learning = {}) {
  const signature = allegroPublicationIssueSignature(task);
  const preference = asObject(asObject(learning.preferences)[signature]);
  const counts = asObject(preference.counts);
  const learned = Object.keys(ALLEGRO_PUBLICATION_RESOLUTIONS)
    .map((id) => [id, Math.max(0, Number(counts[id]) || 0)])
    .sort((left, right) => right[1] - left[1])[0];
  const defaultId = signature === 'publication:unconfirmed_state' ? 'verify_remote_state' : 'repair_then_review';
  const recommendedId = learned?.[1] > 0 ? learned[0] : defaultId;
  return {
    signature,
    learnedChoice: learned?.[1] > 0 ? learned[0] : '',
    learnedCount: learned?.[1] || 0,
    options: Object.values(ALLEGRO_PUBLICATION_RESOLUTIONS)
      .map((option) => publicationOptionCopy({
        ...option,
        recommended: option.id === recommendedId,
        learnedCount: Math.max(0, Number(counts[option.id]) || 0),
      }, signature))
      .sort((left, right) => Number(right.recommended) - Number(left.recommended)),
  };
}

export function decorateAllegroPreparationStatus(queue = {}, learning = {}) {
  const decorate = (task) => {
    if (!['decision_required', 'failed'].includes(String(task?.status || '').toLowerCase())) return task;
    return { ...task, resolution: allegroPreparationResolutionOptions(task, learning), automaticPolicy: allegroAutomaticIssuePolicy(task, 'preparation') };
  };
  return {
    ...queue,
    current: asArray(queue.current).map(decorate),
    recent: asArray(queue.recent).map(decorate),
    priorityPolicy: normalizeLearning(learning).priorityPolicy,
  };
}

export function decorateAllegroPublicationStatus(queue = {}, learning = {}) {
  const decorate = (task) => {
    if (!['decision_required', 'failed'].includes(String(task?.status || '').toLowerCase())) return task;
    return { ...task, resolution: allegroPublicationResolutionOptions(task, learning), automaticPolicy: allegroAutomaticIssuePolicy(task, 'publication') };
  };
  return {
    ...queue,
    current: asArray(queue.current).map(decorate),
    recent: asArray(queue.recent).map(decorate),
  };
}

function hasAllegroOffer(product = {}) {
  const channel = asObject(asObject(asObject(product?._catalog).channels).allegro);
  return Boolean(clean(product?.allegroOfferId || product?.offerId || channel.offerId, 120));
}

export function selectAllegroPreparationPriorityProductIds(queue = {}, products = [], scope = 'allegro_repairs') {
  const pendingIds = new Set(asArray(queue.current)
    .filter((task) => String(task?.status || '') === 'pending')
    .map((task) => clean(task?.productId, 100)).filter(Boolean));
  const rows = products instanceof Map ? [...products.values()] : asArray(products);
  return rows.filter((product) => {
    const id = clean(product?.id ?? product?.productId, 100);
    if (!pendingIds.has(id)) return false;
    if (scope === 'new_allegro') return !hasAllegroOffer(product);
    if (scope === 'von_halsky') {
      const channel = asObject(asObject(asObject(product?._catalog).channels).vonHalsky);
      return !['ready', 'published'].includes(clean(product?.vonHalskyAgentStatus || channel.status, 40).toLowerCase());
    }
    if (scope === 'full_review') return true;
    const status = clean(product?.allegroAgentPreparationStatus, 50).toLowerCase();
    return hasAllegroOffer(product)
      || ['attention', 'needs_attention', 'decision_required', 'failed', 'retrying'].includes(status)
      || Boolean(clean(product?.allegroComplianceError || product?.allegroPublicationLastErrorCode, 500));
  }).map((product) => clean(product?.id ?? product?.productId, 100));
}

export function createAllegroPreparationDecisionLearning({ readVersioned, writeIfVersion, now = () => new Date() } = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') {
    throw new Error('Uczenie decyzji wymaga trwałego repozytorium.');
  }
  const read = async () => normalizeLearning((await readVersioned(STATE_KEY, normalizeLearning())).value);
  const mutate = async (callback) => {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const version = await readVersioned(STATE_KEY, normalizeLearning());
      const next = normalizeLearning(callback(normalizeLearning(version.value)));
      const result = await writeIfVersion(STATE_KEY, next, version);
      if (result?.modified) return next;
    }
    throw Object.assign(new Error('Nie udało się zapisać decyzji administratora.'), { code: 'allegro_decision_learning_conflict' });
  };
  const recordResolution = async ({ task = {}, kind = 'preparation', resolutionId = '', selectedBy = 'administrator', remember = true } = {}) => {
    const resolutions = kind === 'publication' ? ALLEGRO_PUBLICATION_RESOLUTIONS : ALLEGRO_PREPARATION_RESOLUTIONS;
    const signature = kind === 'publication' ? allegroPublicationIssueSignature(task) : allegroPreparationIssueSignature(task);
    const before = await read();
    const custom = kind === 'preparation'
      ? asArray(asObject(before.customSolutions)[signature]).find((item) => item.id === resolutionId && item.enabled !== false)
      : null;
    if (!resolutions[resolutionId] && !custom) {
      throw Object.assign(new Error('Nieznany wariant rozwiązania.'), { status: 422, code: 'invalid_allegro_resolution' });
    }
    if (!remember) return { ...before, signature, remembered: false };
    const selectedAt = now().toISOString();
    const state = await mutate((previous) => {
      const current = asObject(previous.preferences[signature]);
      const baseResolutionId = custom?.baseResolutionId || resolutionId;
      const counts = { ...asObject(current.counts), [baseResolutionId]: Math.max(0, Number(asObject(current.counts)[baseResolutionId]) || 0) + 1 };
      const customSolutions = custom ? {
        ...previous.customSolutions,
        [signature]: asArray(previous.customSolutions[signature]).map((item) => item.id === resolutionId ? {
          ...item,
          useCount: Math.max(0, Number(item.useCount) || 0) + 1,
          lastUsedAt: selectedAt,
        } : item),
      } : previous.customSolutions;
      return {
        ...previous,
        customSolutions,
        preferences: { ...previous.preferences, [signature]: { counts, lastChoice: resolutionId, lastAt: selectedAt } },
        history: [{ productId: task.productId, taskId: task.id, kind, signature, resolutionId, selectedBy, selectedAt }, ...previous.history],
      };
    });
    return { ...state, signature, remembered: true };
  };
  const addSolution = async ({ task = {}, title = '', description = '', baseResolutionId = 'official_source', createdBy = 'administrator' } = {}) => {
    if (!ALLEGRO_PREPARATION_RESOLUTIONS[baseResolutionId]) {
      throw Object.assign(new Error('Nieznany bezpieczny tryb wykonania rozwiązania.'), { status: 422, code: 'invalid_allegro_solution_base' });
    }
    const safeTitle = clean(title, 120), safeDescription = clean(description, 1000);
    if (safeTitle.length < 3 || safeDescription.length < 10) {
      throw Object.assign(new Error('Podaj nazwę i konkretny opis rozwiązania.'), { status: 422, code: 'invalid_allegro_solution' });
    }
    const signature = allegroPreparationIssueSignature(task), createdAt = now().toISOString();
    let added = null;
    const state = await mutate((previous) => {
      const current = asArray(previous.customSolutions[signature]);
      const duplicate = current.find((item) => item.title.toLowerCase() === safeTitle.toLowerCase() && item.description.toLowerCase() === safeDescription.toLowerCase());
      if (duplicate) {
        added = duplicate;
        return previous;
      }
      added = {
        id: `solution-${Date.parse(createdAt).toString(36)}-${(current.length + 1).toString(36)}`,
        title: safeTitle,
        description: safeDescription,
        baseResolutionId,
        enabled: true,
        createdBy: clean(createdBy, 200),
        createdAt,
        useCount: 0,
        lastUsedAt: '',
        contextFeatures: allegroPreparationApplicabilityFeatures(task),
      };
      return {
        ...previous,
        customSolutions: { ...previous.customSolutions, [signature]: [added, ...current].slice(0, 30) },
      };
    });
    return { ...state, signature, solution: added };
  };
  const recordPriorityPolicy = async ({ scope, label, matched, selectedBy = 'administrator' } = {}) => mutate((previous) => ({
    ...previous,
    priorityPolicy: { scope, label, matched, selectedBy, selectedAt: now().toISOString() },
  }));
  const recordAutomaticSuccess = async ({ task = {}, resolutionId = 'official_source' } = {}) => {
    const taskId = clean(task?.id, 120);
    const productId = clean(task?.productId, 100);
    if (!taskId || !productId || !asArray(task?.missing).length) {
      return { ...(await read()), remembered: false, reason: 'no_resolved_issue' };
    }
    const current = await read();
    const alreadyRecorded = current.history.some((item) => (
      item.taskId === taskId
      && item.productId === productId
      && item.resolutionId === resolutionId
      && item.selectedBy === 'agent-verified-success'
    ));
    if (alreadyRecorded) return { ...current, remembered: true, duplicate: true };
    return recordResolution({
      task,
      resolutionId,
      selectedBy: 'agent-verified-success',
      remember: true,
    });
  };
  return Object.freeze({ read, recordResolution, recordAutomaticSuccess, addSolution, recordPriorityPolicy });
}
