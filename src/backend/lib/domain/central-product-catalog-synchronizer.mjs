import crypto from 'node:crypto';

const PRODUCT_SOURCE_SETTING_KEYS = [
  'artway_stany',
  'artway_dostepnosc',
  'artway_magazyn_produkty',
  'artway_opinie',
];

export function createCentralProductCatalogSynchronizer({
  repository,
  read,
  catalog,
  importedProducts,
  offerItems,
  mappingItems,
} = {}) {
  let synchronizationPromise = null;

  function settingsFingerprint(data = {}) {
    const source = Object.fromEntries(
      PRODUCT_SOURCE_SETTING_KEYS.map((key) => [key, data?.[key] ?? null]),
    );
    return crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex').slice(0, 24);
  }

  async function revisionState() {
    if (typeof repository.revisionToken === 'function') {
      const token = await repository.revisionToken({
        settingsKeys: PRODUCT_SOURCE_SETTING_KEYS,
        keys: ['allegro_offers', 'allegro_mappings'],
      });
      return {
        sourceRevision: crypto.createHash('sha256')
          .update(`canonical-products|${token}`)
          .digest('hex')
          .slice(0, 32),
      };
    }
    const [settings, offers, mappings] = await Promise.all([
      read('settings', { data: {}, rev: 0, updated_at: null }),
      read('allegro_offers', { items: [], updated_at: null }),
      read('allegro_mappings', { items: {}, updated_at: null }),
    ]);
    return {
      sourceRevision: [
        'canonical-products',
        settingsFingerprint(settings.data || {}),
        offers.updated_at || '',
        mappings.updated_at || '',
      ].join(':'),
    };
  }

  async function revisionSnapshot(revision = null) {
    const state = revision || await revisionState();
    const [settings, offers, mappings] = await Promise.all([
      read('settings', { data: {}, rev: 0, updated_at: null }),
      read('allegro_offers', { items: [], updated_at: null }),
      read('allegro_mappings', { items: {}, updated_at: null }),
    ]);
    return { settings, offers, mappings, sourceRevision: state.sourceRevision };
  }

  async function synchronize({ force = false, revision = null } = {}) {
    if (!catalog.available) return { available: false, synchronized: false, count: 0 };
    if (synchronizationPromise) return synchronizationPromise;
    synchronizationPromise = (async () => {
      const state = revision || await revisionState();
      const meta = await catalog.metadata();
      if (!force && meta.count > 0 && !meta.outdated && meta.sourceRevision === state.sourceRevision) {
        return { ...meta, synchronized: false, current: true };
      }
      const snapshot = await revisionSnapshot(state);
      const preferCanonicalCatalog = meta.count > 0;
      const imported = preferCanonicalCatalog ? [] : await importedProducts();
      return catalog.synchronize(snapshot.settings.data || {}, {
        preferCanonicalCatalog,
        importedProducts: imported,
        offers: offerItems(snapshot.offers),
        mappings: mappingItems(snapshot.mappings),
        sourceRevision: snapshot.sourceRevision,
      });
    })();
    try {
      return await synchronizationPromise;
    } finally {
      synchronizationPromise = null;
    }
  }

  return Object.freeze({ revisionState, synchronize });
}
