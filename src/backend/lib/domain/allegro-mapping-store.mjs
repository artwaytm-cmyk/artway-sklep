const stable = (value) => Array.isArray(value) ? value.map(stable)
  : (value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value);
export const allegroMappingRecordsEqual = (left, right) => JSON.stringify(stable(left ?? null)) === JSON.stringify(stable(right ?? null));

/** Wersjonowany zapis różnic mapowań. Zmiana Agenta nie może nadpisać decyzji
 * administratora zapisanej w międzyczasie. */
export function createAllegroMappingStore({ readVersioned, writeIfVersion, getItems } = {}) {
  if (typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function' || typeof getItems !== 'function') throw new Error('Magazyn mapowań wymaga wersjonowanego repozytorium.');
  return Object.freeze({
    async writeSafely(baseItems = {}, nextItems = {}, updatedAt = new Date().toISOString(), options = {}) {
      const changedKeys = [...new Set([...Object.keys(baseItems || {}), ...Object.keys(nextItems || {})])].filter((key) => !allegroMappingRecordsEqual(baseItems?.[key], nextItems?.[key]));
      if (!changedKeys.length) return { modified: false, items: { ...(baseItems || {}) }, conflicts: [] };
      const forceKeys = new Set((Array.isArray(options.forceKeys) ? options.forceKeys : []).map(String));
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const version = await readVersioned('allegro_mappings', { items: {}, updated_at: null });
        const latestRecord = version.value || { items: {}, updated_at: null }, latest = getItems(latestRecord), merged = { ...latest }, conflicts = [];
        for (const key of changedKeys) {
          if (!allegroMappingRecordsEqual(latest?.[key], baseItems?.[key]) && !forceKeys.has(String(key))) { conflicts.push(String(key)); continue; }
          if (nextItems?.[key] === undefined) delete merged[key]; else merged[key] = nextItems[key];
        }
        if (changedKeys.length === conflicts.length) return { modified: false, items: latest, conflicts };
        const write = await writeIfVersion('allegro_mappings', { ...latestRecord, items: merged, updated_at: updatedAt }, version);
        if (write?.modified) return { modified: true, items: merged, conflicts };
      }
      const error = new Error('Mapowania zmieniły się równocześnie w innym procesie. Dane nie zostały nadpisane; operacja zostanie ponowiona przez Agenta.');
      error.code = 'allegro_mapping_write_conflict'; error.status = 409; throw error;
    },
  });
}
