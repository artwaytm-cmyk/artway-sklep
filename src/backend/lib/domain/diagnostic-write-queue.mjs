const TRANSIENT_WRITE_CODES = new Set(['55P03', '40P01', '40001', '57P01', '08006', '08003']);

function transientWrite(error) {
  return TRANSIENT_WRITE_CODES.has(String(error?.code || '').toUpperCase())
    || /connection (?:terminated|timeout)|not queryable|lock timeout|przekroczenia czasu blokady/i.test(String(error?.message || ''));
}

const retryPause = (attempt) => new Promise((resolve) => setTimeout(resolve, Math.min(180, 30 * (attempt + 1))));

export function createDiagnosticChangeQueue({ readVersioned, writeIfVersion, safeRecord, recordKey, maxAttempts = 8 }) {
  let queue = Promise.resolve();
  async function perform(mutator) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const version = await readVersioned(recordKey, {}), record = safeRecord(version.value);
        const next = safeRecord(await mutator(record));
        const write = await writeIfVersion(recordKey, next, version);
        if (write?.modified) return next;
      } catch (error) {
        if (!transientWrite(error) || attempt >= 2) throw error;
        await retryPause(attempt);
      }
    }
    throw Object.assign(new Error('Rejestr diagnostyczny jest równolegle aktualizowany. Ponów operację.'), { status: 409, code: 'diagnostics_write_conflict' });
  }
  return (mutator) => {
    // Szeregowanie analizy AI, panelu i telemetrii zapobiega samonapędzającym się blokadom 55P03.
    const operation = queue.then(() => perform(mutator), () => perform(mutator));
    queue = operation.then(() => undefined, () => undefined);
    return operation;
  };
}
