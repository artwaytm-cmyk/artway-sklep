import { mergeAgentPlanCycle } from '../core/settings-domain-contract.mjs';

function currentVersion(value = {}) {
  return Number(String(value?.etag || '').replace(/^W\//, '').replace(/^"|"$/g, '')) || 0;
}

export function createSettingsDomainWriter({
  readVersioned,
  writeIfVersion,
  sanitizeSettings,
  respond,
} = {}) {
  function sanitizeValue(key, value) {
    const sanitized = sanitizeSettings({ [key]: value });
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) return sanitized[key];
    throw Object.assign(new Error('Nieznana albo niedozwolona domena ustawien.'), { status: 422 });
  }

  return async function writeSettingsDomain(body = {}) {
    if (![readVersioned, writeIfVersion, sanitizeSettings, respond].every((value) => typeof value === 'function')) {
      throw Object.assign(new Error('Zapis domen ustawień wymaga pełnego repozytorium i walidacji.'), { status: 503 });
    }
    const key = String(body.key || '').trim();
    if (!key) return respond({ ok: false, error: 'Brak klucza domeny ustawień.' }, 422);
    const expectedRevision = Number(body.expectedRevision);
    const expectedVersion = Number.isSafeInteger(expectedRevision) ? { etag: `"${expectedRevision}"`, exists: true } : null;
    let value;
    try {
      value = sanitizeValue(key, body.value === undefined ? null : body.value);
    } catch (error) {
      return respond({ ok: false, error: error.message }, error.status || 422);
    }
    let write = await writeIfVersion(key, value, expectedVersion), merged = false;
    if (!write?.modified && key === 'artway_agent_ai_plan_cykl') {
      for (let attempt = 0; attempt < 6 && !write?.modified; attempt += 1) {
        const current = await readVersioned(key, {});
        value = mergeAgentPlanCycle(current.value, value);
        write = await writeIfVersion(key, value, current);
        merged = true;
      }
    }
    if (!write?.modified) {
      const current = await readVersioned(key, null);
      return respond({
        ok: false,
        error: 'Konflikt zapisu domeny. Dane lokalne zachowano.',
        code: 'settings_write_conflict',
        currentVersion: currentVersion(current),
      }, 409);
    }
    const settings = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
    const rev = Number(settings?.value?.rev || 0);
    return respond({ ok: true, key, version: write.version || 0, rev: Number.isFinite(rev) ? rev : 0, merged });
  };
}
