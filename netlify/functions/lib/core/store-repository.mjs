import { getStore } from '@netlify/blobs';
import { createPostgresStoreRepository } from './postgres-store-repository.mjs';

export function createStoreRepository({ name, consistency = 'strong', driver = process.env.ARTWAY_STORE_DRIVER } = {}) {
  if (!name) throw new Error('Nazwa magazynu danych jest wymagana.');

  if (String(driver || '').trim().toLowerCase() === 'postgres') {
    return createPostgresStoreRepository({ name });
  }

  const store = () => getStore({ name, consistency });

  return Object.freeze({
    async read(key, fallback) {
      try {
        const value = await store().get(key, { type: 'json' });
        return value === null || value === undefined ? fallback : value;
      } catch {
        return fallback;
      }
    },
    async readVersioned(key, fallback) {
      const result = await store().getWithMetadata(key, { type: 'json' });
      if (!result) return { value: fallback, etag: '', exists: false };
      return { value: result.data === null || result.data === undefined ? fallback : result.data, etag: result.etag || '', exists: true };
    },
    async write(key, value) {
      await store().setJSON(key, value);
    },
    async writeIfVersion(key, value, version = {}) {
      const options = version.exists === false ? { onlyIfNew: true } : { onlyIfMatch: String(version.etag || '') };
      if (version.exists !== false && !options.onlyIfMatch) return { modified: false };
      return store().setJSON(key, value, options);
    },
    async listKeys() {
      const result = await store().list();
      return (result?.blobs || []).map((entry) => ({ key: entry.key, etag: entry.etag || '' })).sort((a, b) => a.key.localeCompare(b.key));
    },
  });
}

export function createRevisionSafeWriter(repository, key = 'settings') {
  if (!repository || typeof repository.readVersioned !== 'function' || typeof repository.writeIfVersion !== 'function') {
    throw new Error('Writer rewizji wymaga wersjonowanego repozytorium.');
  }
  return async function writeNextRevision(value) {
    const version = await repository.readVersioned(key, { data: {}, rev: 0, updated_at: null });
    const currentRev = Number(version.value?.rev || 0), nextRev = Number(value?.rev);
    if (!Number.isSafeInteger(nextRev) || nextRev !== currentRev + 1) {
      const error = new Error('Ustawienia zmieniły się podczas operacji. Pobierz aktualne dane i ponów zapis.');
      error.code = 'settings_write_conflict'; error.status = 409; throw error;
    }
    const write = await repository.writeIfVersion(key, value, version);
    if (!write?.modified) {
      const error = new Error('Ustawienia zmieniły się podczas operacji. Pobierz aktualne dane i ponów zapis.');
      error.code = 'settings_write_conflict'; error.status = 409; throw error;
    }
    return write;
  };
}
