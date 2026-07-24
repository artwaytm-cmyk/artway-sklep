import crypto from 'node:crypto';

const MAX_CHANGES = 200;
const MAX_MUTATION_BYTES = 512 * 1024;
const MAX_RECEIPTS = 250;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validKey(value) {
  const key = String(value || '').trim();
  return key.length > 0 && key.length <= 120 && !FORBIDDEN_KEYS.has(key);
}

function cleanMutation(body, sanitizeSettings) {
  const rawChanges = body?.changes && typeof body.changes === 'object' && !Array.isArray(body.changes) ? body.changes : {};
  const changeEntries = Object.entries(rawChanges).filter(([key, value]) => validKey(key) && value !== undefined).slice(0, MAX_CHANGES);
  const removeKeys = [...new Set((Array.isArray(body?.removeKeys) ? body.removeKeys : []).map(String).filter(validKey))].slice(0, MAX_CHANGES);
  const sanitized = sanitizeSettings({ artway_ustawienia: Object.fromEntries(changeEntries) });
  const changes = sanitized?.artway_ustawienia && typeof sanitized.artway_ustawienia === 'object' && !Array.isArray(sanitized.artway_ustawienia)
    ? sanitized.artway_ustawienia
    : {};
  for (const key of removeKeys) delete changes[key];
  if (Object.keys(changes).length + removeKeys.length > MAX_CHANGES) throw Object.assign(new Error('Jedna operacja zmienia zbyt wiele pól ustawień.'), { status: 413 });
  if (Buffer.byteLength(JSON.stringify({ changes, removeKeys }), 'utf8') > MAX_MUTATION_BYTES) throw Object.assign(new Error('Jedna operacja ustawień jest zbyt duża.'), { status: 413 });
  return { changes, removeKeys };
}

function authoritativeResult(settings, changedKeys) {
  const values = {}, deletedKeys = [];
  for (const key of changedKeys) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) values[key] = clone(settings[key]);
    else deletedKeys.push(key);
  }
  return { values, deletedKeys, settingsHash: hash(settings) };
}

/**
 * Atomowy zapis pojedynczych pól artway_ustawienia.
 *
 * Formularze nie wysyłają już starej kopii całej konfiguracji. Każda operacja
 * jest ponawiana na najnowszej wersji rekordu, ma trwały mutationId i zwraca
 * wartości ponownie odczytane z rekordu, który faktycznie zapisano.
 */
export function createSettingsFieldMutationHandler(deps = {}) {
  const {
    isAdmin, readVersioned, writeIfVersion, respond, sanitizeSettings,
    preserveManualProductPrices = (next) => next,
    preserveSupplierPlan = (next) => next,
    settingsLimit = 4 * 1024 * 1024,
    text = (value, max = 200) => String(value || '').slice(0, max),
  } = deps;

  return async function settingsFieldMutation(req, url) {
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    const body = await req.json().catch(() => ({})), mutationId = text(body.mutationId, 120).trim();
    if (!mutationId) return respond({ ok: false, error: 'Brakuje identyfikatora operacji zapisu.', code: 'settings_mutation_id_required' }, 422);

    let mutation;
    try { mutation = cleanMutation(body, sanitizeSettings); }
    catch (error) { return respond({ ok: false, error: error.message }, error.status || 422); }
    const changedKeys = [...new Set([...Object.keys(mutation.changes), ...mutation.removeKeys])];
    if (!changedKeys.length) return respond({ ok: true, unchanged: true, mutationId, changedKeys: [] });

    for (let attempt = 0; attempt < 8; attempt++) {
      const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
      const previous = version.value || { data: {}, rev: 0, updated_at: null };
      const receipts = Array.isArray(previous.mutation_receipts) ? previous.mutation_receipts : [];
      if (receipts.some((entry) => entry?.id === mutationId)) {
        const current = previous.data?.artway_ustawienia && typeof previous.data.artway_ustawienia === 'object'
          ? previous.data.artway_ustawienia
          : {};
        return respond({
          ok: true, mutationId, duplicatePrevented: true, changedKeys,
          rev: Number(previous.rev || 0), updated_at: previous.updated_at || null,
          authoritative: authoritativeResult(current, changedKeys),
        });
      }

      const current = previous.data?.artway_ustawienia && typeof previous.data.artway_ustawienia === 'object'
        ? clone(previous.data.artway_ustawienia)
        : {};
      for (const [key, value] of Object.entries(mutation.changes)) current[key] = clone(value);
      for (const key of mutation.removeKeys) delete current[key];

      // Rekord settings zawiera również duży katalog centralny. Ten endpoint
      // zmienia wyłącznie artway_ustawienia, dlatego limitujemy tę domenę,
      // a nie historyczną wielkość całego, niezwiązanego katalogu produktów.
      if (Buffer.byteLength(JSON.stringify(current), 'utf8') > settingsLimit) return respond({ ok: false, error: 'Ustawienia sklepu są zbyt duże' }, 413);
      const merged = { ...(previous.data || {}), artway_ustawienia: current };
      const data = preserveSupplierPlan(preserveManualProductPrices(merged, previous.data), previous.data);

      const updatedAt = new Date().toISOString();
      const receipt = { id: mutationId, at: updatedAt, keys: changedKeys, settingsHash: hash(current) };
      const record = {
        ...previous,
        data,
        rev: Number(previous.rev || 0) + 1,
        updated_at: updatedAt,
        last_mutation_id: mutationId,
        mutation_receipts: [receipt, ...receipts.filter((entry) => entry?.id !== mutationId)].slice(0, MAX_RECEIPTS),
      };
      const write = await writeIfVersion('settings', record, version);
      if (write?.modified) {
        return respond({
          ok: true, mutationId, changedKeys, rev: record.rev, updated_at: updatedAt,
          rebased: Number(body.expectedRev) !== Number(previous.rev || 0),
          authoritative: authoritativeResult(current, changedKeys),
        });
      }
    }
    return respond({ ok: false, error: 'Serwer równolegle zapisuje inne dane. Operacja pozostała w kolejce i zostanie ponowiona.', code: 'settings_write_conflict' }, 409);
  };
}
