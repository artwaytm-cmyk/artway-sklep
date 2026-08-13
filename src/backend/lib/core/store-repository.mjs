import { createPostgresStoreRepository } from './postgres-store-repository.mjs';

const memoryStores = new Map();

function createMemoryStoreRepository({ name }) {
  if (!memoryStores.has(name)) memoryStores.set(name, new Map());
  const records = memoryStores.get(name);
  const versionOf = (record) => record ? String(record.version) : '';
  return Object.freeze({
    async read(key, fallback) {
      return records.has(key) ? structuredClone(records.get(key).value) : fallback;
    },
    async readVersioned(key, fallback) {
      const record = records.get(key);
      return record
        ? { value: structuredClone(record.value), etag: versionOf(record), exists: true }
        : { value: fallback, etag: '', exists: false };
    },
    async write(key, value) {
      const current = records.get(key);
      records.set(key, { value: structuredClone(value), version: Number(current?.version || 0) + 1 });
    },
    async writeIfVersion(key, value, version = {}) {
      const current = records.get(key);
      if (version.exists === false ? !!current : !current || versionOf(current) !== String(version.etag || '')) return { modified: false };
      const nextVersion = Number(current?.version || 0) + 1;
      records.set(key, { value: structuredClone(value), version: nextVersion });
      return { modified: true, etag: String(nextVersion) };
    },
    async delete(key) {
      return { deleted: records.delete(key) };
    },
    async listKeys() {
      return [...records.entries()].map(([key, record]) => ({ key, etag: versionOf(record) })).sort((a, b) => a.key.localeCompare(b.key));
    },
  });
}

export function createStoreRepository({ name, driver = process.env.ARTWAY_STORE_DRIVER || (process.env.NODE_ENV === 'production' ? 'postgres' : 'memory') } = {}) {
  if (!name) throw new Error('Nazwa magazynu danych jest wymagana.');

  const selected = String(driver || '').trim().toLowerCase();
  if (selected === 'postgres') return createPostgresStoreRepository({ name });
  if (selected === 'memory') return createMemoryStoreRepository({ name });
  throw new Error(`Nieobsługiwany sterownik danych: ${selected || 'brak'}. Serwer produkcyjny wymaga PostgreSQL.`);
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

export function createRevisionSafeMutator(repository, key = 'settings', { maxAttempts = 5 } = {}) {
  if (!repository || typeof repository.readVersioned !== 'function' || typeof repository.writeIfVersion !== 'function') {
    throw new Error('Mutator rewizji wymaga wersjonowanego repozytorium.');
  }
  const attemptsLimit = Math.max(1, Math.min(20, Number(maxAttempts) || 5));
  return async function mutateLatest(mutator, { updatedAt = null } = {}) {
    if (typeof mutator !== 'function') throw new Error('Mutator ustawień musi być funkcją.');
    for (let attempt = 0; attempt < attemptsLimit; attempt++) {
      const version = await repository.readVersioned(key, { data: {}, rev: 0, updated_at: null });
      const previous = version.value && typeof version.value === 'object'
        ? version.value
        : { data: {}, rev: 0, updated_at: null };
      const data = previous.data && typeof previous.data === 'object' ? { ...previous.data } : {};
      const changed = await mutator(data, previous, { attempt: attempt + 1, maxAttempts: attemptsLimit });
      if (changed === false) return { modified: false, value: previous, attempts: attempt + 1 };
      const currentRev = Number(previous.rev || 0);
      const record = {
        ...previous,
        data,
        rev: Number.isSafeInteger(currentRev) && currentRev >= 0 ? currentRev + 1 : 1,
        updated_at: updatedAt || new Date().toISOString(),
      };
      const write = await repository.writeIfVersion(key, record, version);
      if (write?.modified) return { ...write, value: record, attempts: attempt + 1 };
    }
    const error = new Error('Ustawienia zmieniły się podczas operacji. Automatyczne ponowienie zapisu nie powiodło się.');
    error.code = 'settings_write_conflict'; error.status = 409; error.attempts = attemptsLimit; throw error;
  };
}
