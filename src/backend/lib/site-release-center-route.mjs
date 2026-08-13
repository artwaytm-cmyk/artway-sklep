import crypto from 'node:crypto';

const STATE_KEY = 'site_release_center_v1';
const SCHEMA = 1;
const MAX_HISTORY = 40;
const MAX_PRODUCT_PATCHES = 5000;
const MAX_SETTINGS_BYTES = 2 * 1024 * 1024;

export const SITE_RELEASE_SETTINGS_FIELDS = Object.freeze([
  'nazwaSklepu', 'pasekInfo', 'pasekInfoKonfiguracja', 'czasWysylki', 'telefon', 'opisSklepu', 'emailSklepu',
  'daneFirmy', 'darmowaDostawaOd', 'kosztPaczkomat', 'kosztKurierInpost',
  'kurierInpostAktywny', 'dostawy', 'platnosci', 'oplataPobranie', 'pobranieWl',
  'paynowWl', 'telefonWl', 'numerPrzelewuTelefon', 'linkPlatnosci', 'kody',
  'kodyRabatoweZaawansowane', 'promocjaGlowna', 'heroTytul', 'heroOpis', 'hero',
  'pasekOkazji', 'tresci', 'uklad', 'logoObraz', 'faviconObraz', 'tekstSzukaj',
  'bannery', 'ofertaGlowna', 'kolejnoscSekcji', 'sekcjeUkryte', 'podstrony',
  'wlasneKategorie', 'rodziceKategorii', 'menuKategorii', 'kategorie',
  'mapaProduktow', 'ukryteKategorie', 'ikonyKategorii', 'kanoniczneDuplikatySklepu',
  'menuPokazNieprzypisane', 'stopkaCopy',
]);

export const SITE_RELEASE_PRODUCT_FIELDS = Object.freeze([
  'nazwa', 'name', 'opisKrotki', 'krotkiOpis', 'opis', 'kategoria', 'category',
  'cena', 'staraCena', 'badge', 'zdjecie', 'zdjecia', 'warianty', 'ikona', 'kolor',
  'aktywny', 'ukryty', 'sprzedazAktywna', 'saleAvailable',
  'seoTitle', 'seoDescription', 'seoKeywords',
]);

const SETTINGS_FIELDS = new Set(SITE_RELEASE_SETTINGS_FIELDS);
const PRODUCT_FIELDS = new Set(SITE_RELEASE_PRODUCT_FIELDS);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const same = (left, right) => stable(left) === stable(right);
const id = (prefix = 'release') => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
const now = () => new Date().toISOString();

function emptyDraft(settingsRev = 0, actor = 'administrator') {
  const createdAt = now();
  return {
    id: id('draft'), name: `Wersja robocza ${new Date().toLocaleDateString('pl-PL')}`,
    status: 'draft', mode: 'active', baseSettingsRev: Math.max(0, Number(settingsRev) || 0),
    settingsPatch: {}, settingsRemove: [], settingsBase: {}, productPatches: {},
    createdAt, updatedAt: createdAt, createdBy: actor, updatedBy: actor,
  };
}

function normalizeState(value, settingsRev = 0, actor = 'administrator') {
  const source = object(value), draft = object(source.draft);
  return {
    schema: SCHEMA,
    active: object(source.active),
    draft: draft.id ? {
      ...emptyDraft(settingsRev, actor), ...draft,
      settingsPatch: object(draft.settingsPatch),
      settingsRemove: [...new Set(Array.isArray(draft.settingsRemove) ? draft.settingsRemove.map(String).filter((key) => SETTINGS_FIELDS.has(key)) : [])],
      settingsBase: object(draft.settingsBase), productPatches: object(draft.productPatches),
    } : emptyDraft(settingsRev, actor),
    history: Array.isArray(source.history) ? source.history.slice(0, MAX_HISTORY) : [],
    updatedAt: source.updatedAt || now(),
  };
}

function publicState(state) {
  const draft = state.draft || {};
  const productPatches = Object.values(object(draft.productPatches));
  return {
    schema: SCHEMA, active: state.active || {},
    draft: {
      id: draft.id, name: draft.name, status: draft.status, mode: draft.mode,
      baseSettingsRev: draft.baseSettingsRev, createdAt: draft.createdAt, updatedAt: draft.updatedAt,
      updatedBy: draft.updatedBy,
      settingsPatch: draft.settingsPatch || {}, settingsRemove: draft.settingsRemove || [], settingsBase: draft.settingsBase || {},
      productPatches: draft.productPatches || {},
      summary: {
        settings: Object.keys(draft.settingsPatch || {}).length + (draft.settingsRemove || []).length,
        products: productPatches.length,
        productFields: productPatches.reduce((sum, entry) => sum + Object.keys(entry?.fields || {}).length + (entry?.remove || []).length, 0),
      },
    },
    history: (state.history || []).map((entry) => ({
      id: entry.id, name: entry.name, number: entry.number, status: entry.status,
      publishedAt: entry.publishedAt, publishedBy: entry.publishedBy, summary: entry.summary,
      sourceReleaseId: entry.sourceReleaseId || '',
    })),
    updatedAt: state.updatedAt,
  };
}

function previewSecret() {
  return process.env.ARTWAY_SITE_PREVIEW_SECRET || process.env.ARTWAY_SESSION_SECRET || process.env.ARTWAY_ADMIN_TOKEN || 'artway-site-preview-development';
}

function previewToken(draft) {
  const payload = Buffer.from(JSON.stringify({ draftId: draft.id, updatedAt: draft.updatedAt, exp: Date.now() + 6 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', previewSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyPreviewToken(token, draft) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return false;
  const expected = crypto.createHmac('sha256', previewSecret()).update(payload).digest('base64url');
  const left = Buffer.from(signature), right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return decoded.draftId === draft.id && decoded.updatedAt === draft.updatedAt && Number(decoded.exp) > Date.now();
  } catch { return false; }
}

function snapshotField(source, key) {
  return own(source, key) ? { present: true, value: clone(source[key]) } : { present: false };
}

function restorePatch(snapshot = {}) {
  const fields = {}, remove = [];
  for (const [key, entry] of Object.entries(snapshot)) {
    if (entry?.present === true) fields[key] = clone(entry.value);
    else remove.push(key);
  }
  return { fields, remove };
}

export function createSiteReleaseCenterRoute({
  read, readVersioned, writeIfVersion, catalog, respond, isAdmin, sessionOf,
} = {}) {
  if (!read || !readVersioned || !writeIfVersion || !catalog) throw new Error('Centrum wersji strony wymaga repozytorium i katalogu.');

  const actor = (request) => String(sessionOf?.(request)?.email || 'administrator').slice(0, 200);
  const readSettings = () => readVersioned('settings', { data: {}, rev: 0, updated_at: null });
  const readState = async (settingsRev = 0, who = 'administrator') => normalizeState(await read(STATE_KEY, null), settingsRev, who);
  const mutateState = async (mutator, who = 'administrator') => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const [record, settings] = await Promise.all([readVersioned(STATE_KEY, null), readSettings()]);
      const state = normalizeState(record.value, settings.value?.rev, who), changed = await mutator(state, settings.value || {});
      if (changed === false) return state;
      state.updatedAt = now();
      const write = await writeIfVersion(STATE_KEY, state, record);
      if (write?.modified) return state;
    }
    const error = new Error('Wersja robocza zmieniła się na innym urządzeniu. Odśwież panel i ponów operację.');
    error.code = 'site_release_conflict'; error.status = 409; throw error;
  };
  const ensureState = async (settingsRev = 0, who = 'administrator') => {
    const record = await readVersioned(STATE_KEY, null);
    if (record.exists && record.value?.draft?.id) return normalizeState(record.value, settingsRev, who);
    return mutateState(() => undefined, who);
  };

  const stageSettings = async (request, body) => {
    const changes = Object.fromEntries(Object.entries(object(body.changes)).filter(([key, value]) => SETTINGS_FIELDS.has(key) && value !== undefined));
    const remove = [...new Set((Array.isArray(body.remove) ? body.remove : []).map(String).filter((key) => SETTINGS_FIELDS.has(key)))];
    if (Buffer.byteLength(JSON.stringify({ changes, remove }), 'utf8') > MAX_SETTINGS_BYTES) throw Object.assign(new Error('Zmiana wersji roboczej jest zbyt duża.'), { status: 413 });
    const state = await mutateState(async (current, settingsRecord) => {
      const draft = current.draft;
      if (draft.status === 'publishing') throw Object.assign(new Error('Publikacja trwa. Poczekaj na jej zakończenie.'), { status: 409 });
      const live = object(settingsRecord.data?.artway_ustawienia);
      for (const [key, value] of Object.entries(changes)) {
        if (!own(draft.settingsBase, key)) draft.settingsBase[key] = snapshotField(live, key);
        draft.settingsPatch[key] = clone(value); draft.settingsRemove = draft.settingsRemove.filter((item) => item !== key);
      }
      for (const key of remove) {
        if (!own(draft.settingsBase, key)) draft.settingsBase[key] = snapshotField(live, key);
        delete draft.settingsPatch[key]; if (!draft.settingsRemove.includes(key)) draft.settingsRemove.push(key);
      }
      draft.status = 'draft'; delete draft.lastError; draft.updatedAt = now(); draft.updatedBy = actor(request);
    }, actor(request));
    return respond({ ok: true, state: publicState(state), staged: Object.keys(changes).length + remove.length });
  };

  const stageProducts = async (request, body) => {
    const operations = (Array.isArray(body.operations) ? body.operations : []).slice(0, 500);
    if (!operations.length) return respond({ ok: true, staged: 0 });
    const state = await mutateState(async (current) => {
      const draft = current.draft;
      if (draft.status === 'publishing') throw Object.assign(new Error('Publikacja trwa. Poczekaj na jej zakończenie.'), { status: 409 });
      if (Object.keys(draft.productPatches).length + operations.length > MAX_PRODUCT_PATCHES) throw Object.assign(new Error('Wersja robocza zawiera zbyt wiele produktów.'), { status: 413 });
      for (const operation of operations) {
        const productId = String(operation?.productId || operation?.id || '').trim().slice(0, 120);
        if (!productId) continue;
        const fields = Object.fromEntries(Object.entries(object(operation.fields)).filter(([key, value]) => PRODUCT_FIELDS.has(key) && value !== undefined));
        const remove = [...new Set((Array.isArray(operation.remove) ? operation.remove : []).map(String).filter((key) => PRODUCT_FIELDS.has(key)))];
        if (!Object.keys(fields).length && !remove.length) continue;
        const live = await catalog.get(productId, { admin: true });
        if (!live) throw Object.assign(new Error(`Nie znaleziono produktu ${productId}.`), { status: 404 });
        const entry = object(draft.productPatches[productId]);
        entry.productId = productId; entry.name = String(live.nazwa || live.name || `Produkt ${productId}`).slice(0, 300);
        entry.fields = object(entry.fields); entry.remove = Array.isArray(entry.remove) ? entry.remove : []; entry.base = object(entry.base);
        for (const [key, value] of Object.entries(fields)) {
          if (!own(entry.base, key)) entry.base[key] = snapshotField(live, key);
          entry.fields[key] = clone(value); entry.remove = entry.remove.filter((item) => item !== key);
        }
        for (const key of remove) {
          if (!own(entry.base, key)) entry.base[key] = snapshotField(live, key);
          delete entry.fields[key]; if (!entry.remove.includes(key)) entry.remove.push(key);
        }
        entry.updatedAt = now(); entry.updatedBy = actor(request); draft.productPatches[productId] = entry;
      }
      draft.status = 'draft'; delete draft.lastError; draft.updatedAt = now(); draft.updatedBy = actor(request);
    }, actor(request));
    return respond({ ok: true, state: publicState(state), staged: operations.length });
  };

  const publish = async (request, body) => {
    const who = actor(request), releaseName = String(body.name || '').trim().slice(0, 160);
    if (body.confirm !== true || releaseName.length < 3) return respond({ ok: false, error: 'Podaj nazwę wydania i potwierdź publikację.', code: 'site_release_confirmation_required' }, 422);
    let locked;
    locked = await mutateState(async (state) => {
      const draft = state.draft, summary = publicState(state).draft.summary;
      if (!summary.settings && !summary.products) throw Object.assign(new Error('Wersja robocza nie zawiera zmian do publikacji.'), { status: 422 });
      if (draft.status === 'publishing') throw Object.assign(new Error('Ta wersja jest już publikowana.'), { status: 409 });
      draft.status = 'publishing'; draft.name = releaseName; draft.updatedAt = now(); draft.updatedBy = who;
    }, who);
    const draft = clone(locked.draft), settingsVersion = await readSettings(), settingsRecord = settingsVersion.value || { data: {}, rev: 0 };
    const liveSettings = object(settingsRecord.data?.artway_ustawienia), settingConflicts = [];
    for (const key of new Set([...Object.keys(draft.settingsPatch), ...draft.settingsRemove])) {
      const current = snapshotField(liveSettings, key), base = draft.settingsBase[key], staged = own(draft.settingsPatch, key) ? { present: true, value: draft.settingsPatch[key] } : { present: false };
      if (!same(current, base) && !same(current, staged)) settingConflicts.push(key);
    }
    const productConflicts = [], productsBefore = {};
    for (const entry of Object.values(draft.productPatches)) {
      const live = await catalog.get(entry.productId, { admin: true });
      if (!live) { productConflicts.push(`${entry.productId}: brak produktu`); continue; }
      productsBefore[entry.productId] = {};
      for (const key of new Set([...Object.keys(entry.fields || {}), ...(entry.remove || [])])) {
        const current = snapshotField(live, key), base = entry.base[key], staged = own(entry.fields, key) ? { present: true, value: entry.fields[key] } : { present: false };
        productsBefore[entry.productId][key] = current;
        if (!same(current, base) && !same(current, staged)) productConflicts.push(`${entry.productId}.${key}`);
      }
    }
    if (settingConflicts.length || productConflicts.length) {
      await mutateState((state) => { state.draft.status = 'conflict'; state.draft.lastError = 'Dane publiczne zmieniły się poza wersją roboczą.'; state.draft.updatedAt = now(); }, who);
      return respond({ ok: false, error: 'Wykryto nowsze zmiany poza wersją roboczą. Niczego nie opublikowano.', code: 'site_release_live_conflict', conflicts: { settings: settingConflicts, products: productConflicts } }, 409);
    }

    const appliedProducts = [], attemptId = id('publish'); let settingsApplied = false, publishedPublic = null;
    try {
      for (const entry of Object.values(draft.productPatches)) {
        const result = await catalog.patchProductFields(entry.productId, entry.fields || {}, entry.remove || [], {
          mutationId: `${attemptId}:${entry.productId}`, actor: who, area: 'site-release', expectedFields: productsBefore[entry.productId],
        });
        if (!result?.updated) throw Object.assign(new Error(`Nie zapisano produktu ${entry.productId}: ${result?.reason || 'brak potwierdzenia'}`), { code: 'site_release_product_write_failed' });
        appliedProducts.push(entry.productId);
      }
      const nextSettings = clone(settingsRecord), nextData = object(nextSettings.data), nextPublic = { ...liveSettings };
      for (const [key, value] of Object.entries(draft.settingsPatch)) nextPublic[key] = clone(value);
      for (const key of draft.settingsRemove) delete nextPublic[key];
      publishedPublic = nextPublic;
      nextData.artway_ustawienia = nextPublic; nextSettings.data = nextData;
      nextSettings.rev = Number(settingsRecord.rev || 0) + 1; nextSettings.updated_at = now();
      nextSettings.last_mutation_id = `site-release:${draft.id}`;
      const settingsWrite = await writeIfVersion('settings', nextSettings, settingsVersion);
      if (!settingsWrite?.modified) throw Object.assign(new Error('Ustawienia zmieniły się podczas publikacji.'), { code: 'site_release_settings_write_conflict' });
      settingsApplied = true;

      const publishedAt = now(), releaseId = id('release'), number = Math.max(0, ...locked.history.map((entry) => Number(entry.number) || 0)) + 1;
      const summary = publicState(locked).draft.summary;
      const publishedState = await mutateState((state) => {
        state.active = { id: releaseId, draftId: draft.id, name: releaseName, number, publishedAt, publishedBy: who, summary };
        state.history = [{
          id: releaseId, draftId: draft.id, name: releaseName, number, status: 'published', publishedAt, publishedBy: who, summary,
          before: { settings: clone(draft.settingsBase), products: clone(Object.fromEntries(Object.entries(draft.productPatches).map(([productId, entry]) => [productId, { productId, name: entry.name, snapshot: productsBefore[productId] || entry.base }])) ) },
          after: { settings: clone(draft.settingsPatch), settingsRemove: clone(draft.settingsRemove), products: clone(draft.productPatches) },
        }, ...state.history].slice(0, MAX_HISTORY);
        state.draft = emptyDraft(nextSettings.rev, who);
      }, who);
      return respond({ ok: true, published: true, release: publishedState.active, state: publicState(publishedState) });
    } catch (error) {
      if (settingsApplied && publishedPublic) {
        const currentVersion = await readSettings().catch(() => null), currentRecord = currentVersion?.value;
        if (currentVersion && same(object(currentRecord?.data?.artway_ustawienia), publishedPublic)) {
          const restored = clone(currentRecord), restoredData = object(restored.data);
          restoredData.artway_ustawienia = clone(liveSettings); restored.data = restoredData;
          restored.rev = Number(currentRecord.rev || 0) + 1; restored.updated_at = now(); restored.last_mutation_id = `site-release-recovery:${draft.id}`;
          await writeIfVersion('settings', restored, currentVersion).catch(() => null);
        }
      }
      for (const productId of appliedProducts.reverse()) {
        const restore = restorePatch(productsBefore[productId]);
        await catalog.patchProductFields(productId, restore.fields, restore.remove, {
          mutationId: `site-release-rollback:${draft.id}:${productId}:${Date.now()}`, actor: 'site-release-recovery', area: 'site-release-recovery',
        }).catch(() => null);
      }
      await mutateState((state) => { state.draft.status = 'failed'; state.draft.lastError = String(error.message || error).slice(0, 800); state.draft.updatedAt = now(); }, who);
      throw error;
    }
  };

  return async function siteReleaseCenterRoute(request, url, action) {
    if (!String(action || '').startsWith('site-release-')) return null;
    if (action === 'site-release-preview') {
      if (request.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (url.searchParams.get('editor') === '1' && !isAdmin(request, url)) return respond({ ok: false, error: 'Edytor strony jest dostępny wyłącznie dla administratora.', code: 'auth' }, 401);
      const settings = await readSettings(), state = await readState(settings.value?.rev);
      if (!verifyPreviewToken(url.searchParams.get('token') || url.searchParams.get('site_preview'), state.draft)) return respond({ ok: false, error: 'Podgląd wygasł albo wersja robocza została zmieniona.', code: 'site_preview_invalid' }, 401);
      const visible = publicState(state);
      return respond({ ok: true, preview: true, active: visible.active, draft: { id: state.draft.id, name: state.draft.name, updatedAt: state.draft.updatedAt, settingsPatch: state.draft.settingsPatch, settingsRemove: state.draft.settingsRemove, productPatches: state.draft.productPatches, summary: visible.draft.summary } }, 200, { 'cache-control': 'private, no-store' });
    }
    if (!isAdmin(request, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    const who = actor(request), settings = await readSettings();
    if (action === 'site-release-state' && request.method === 'GET') return respond({ ok: true, state: publicState(await ensureState(settings.value?.rev, who)), fields: { settings: SITE_RELEASE_SETTINGS_FIELDS, products: SITE_RELEASE_PRODUCT_FIELDS } });
    const body = await request.json().catch(() => ({}));
    if (action === 'site-release-draft-settings' && request.method === 'POST') return stageSettings(request, body);
    if (action === 'site-release-draft-products' && request.method === 'POST') return stageProducts(request, body);
    if (action === 'site-release-preview-token' && request.method === 'POST') {
      const state = await ensureState(settings.value?.rev, who), token = previewToken(state.draft);
      return respond({ ok: true, token, path: `/?site_preview=${encodeURIComponent(token)}#/`, expiresInSeconds: 21600 });
    }
    if (action === 'site-release-draft-mode' && request.method === 'POST') {
      const state = await mutateState((current) => { current.draft.mode = body.active === false ? 'paused' : 'active'; current.draft.updatedAt = now(); current.draft.updatedBy = who; }, who);
      return respond({ ok: true, state: publicState(state) });
    }
    if (action === 'site-release-draft-reset' && request.method === 'POST') {
      if (body.confirm !== true) return respond({ ok: false, error: 'Potwierdź usunięcie zmian wersji roboczej.' }, 422);
      const state = await mutateState((current, currentSettings) => { current.draft = emptyDraft(currentSettings.rev, who); }, who);
      return respond({ ok: true, state: publicState(state) });
    }
    if (action === 'site-release-draft-name' && request.method === 'POST') {
      const name = String(body.name || '').trim().slice(0, 160); if (name.length < 3) return respond({ ok: false, error: 'Nazwa musi mieć co najmniej 3 znaki.' }, 422);
      const state = await mutateState((current) => { current.draft.name = name; current.draft.updatedAt = now(); current.draft.updatedBy = who; }, who);
      return respond({ ok: true, state: publicState(state) });
    }
    if (action === 'site-release-rollback-draft' && request.method === 'POST') {
      const state = await mutateState(async (current, currentSettings) => {
        const source = current.history.find((entry) => entry.id === String(body.releaseId || ''));
        if (!source) throw Object.assign(new Error('Nie znaleziono wydania w historii.'), { status: 404 });
        const draft = emptyDraft(currentSettings.rev, who); draft.name = `Cofnięcie do stanu sprzed: ${source.name}`; draft.sourceReleaseId = source.id;
        const liveSettings = object(currentSettings.data?.artway_ustawienia);
        for (const [key, snapshot] of Object.entries(object(source.before?.settings))) {
          draft.settingsBase[key] = snapshotField(liveSettings, key);
          if (snapshot?.present) draft.settingsPatch[key] = clone(snapshot.value); else draft.settingsRemove.push(key);
        }
        for (const [productId, record] of Object.entries(object(source.before?.products))) {
          const live = await catalog.get(productId, { admin: true }); if (!live) continue;
          const entry = { productId, name: record.name || live.nazwa || `Produkt ${productId}`, fields: {}, remove: [], base: {}, updatedAt: now(), updatedBy: who };
          for (const [key, snapshot] of Object.entries(object(record.snapshot))) {
            entry.base[key] = snapshotField(live, key);
            if (snapshot?.present) entry.fields[key] = clone(snapshot.value); else entry.remove.push(key);
          }
          draft.productPatches[productId] = entry;
        }
        current.draft = draft;
      }, who);
      return respond({ ok: true, state: publicState(state) });
    }
    if (action === 'site-release-publish' && request.method === 'POST') return publish(request, body);
    return respond({ ok: false, error: 'Nieznana operacja wersji strony.' }, 404);
  };
}

export const siteReleaseCenterInternals = Object.freeze({ STATE_KEY, emptyDraft, normalizeState, publicState, previewToken, verifyPreviewToken, restorePatch });
