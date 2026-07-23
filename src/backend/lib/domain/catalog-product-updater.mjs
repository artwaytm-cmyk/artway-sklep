export function createCatalogProductUpdater(data = {}, knownProductIds = []) {
  const added = Array.isArray(data.artway_produkty_dodane) ? data.artway_produkty_dodane.map((product) => ({ ...product })) : [];
  const addedIndex = new Map(added.map((product, index) => [String(product?.id ?? ''), index]));
  const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
  const catalog = Array.isArray(data.artway_produkty_katalog) ? data.artway_produkty_katalog.map((product) => ({ ...product })) : [];
  const catalogIndex = new Map(catalog.map((product, index) => [String(product?.id ?? ''), index]));
  const knownIds = new Set([...addedIndex.keys(), ...catalogIndex.keys(), ...knownProductIds].map(String));
  let changed = false;
  const apply = (rawId, fields = {}, remove = []) => {
    const id = String(rawId ?? '').trim();
    if (!id || !knownIds.has(id)) return false;
    const clean = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    const update = (base = {}) => {
      const next = { ...base, ...clean, id: base.id ?? (/^\d+$/.test(id) ? Number(id) : id) };
      for (const key of remove) delete next[key];
      return next;
    };
    let localChanged = false;
    if (addedIndex.has(id)) {
      const index = addedIndex.get(id), next = update(added[index]);
      if (JSON.stringify(next) !== JSON.stringify(added[index])) { added[index] = next; localChanged = true; }
      if (edits[id] && typeof edits[id] === 'object') {
        const nextEdit = update(edits[id]);
        if (JSON.stringify(nextEdit) !== JSON.stringify(edits[id])) { edits[id] = nextEdit; localChanged = true; }
      }
    } else {
      const next = update(edits[id] || {});
      if (JSON.stringify(next) !== JSON.stringify(edits[id] || {})) { edits[id] = next; localChanged = true; }
    }
    if (catalogIndex.has(id)) {
      const index = catalogIndex.get(id), next = update(catalog[index]);
      if (JSON.stringify(next) !== JSON.stringify(catalog[index])) { catalog[index] = next; localChanged = true; }
    }
    changed ||= localChanged;
    return localChanged;
  };
  const commit = () => {
    data.artway_produkty_dodane = added;
    data.artway_produkty_edytowane = edits;
    if (catalog.length) data.artway_produkty_katalog = catalog;
    return changed;
  };
  return { apply, commit, get changed() { return changed; } };
}
