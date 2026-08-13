const CENTRAL_PRODUCT_SNAPSHOT_KEYS = [
  'artway_produkty_edytowane', 'artway_produkty_dodane', 'artway_produkty_katalog',
  'artway_produkty_ukryte', 'artway_produkty_definitywne', 'artway_kosz_dodane',
  'artway_kosz_meta',
];
const PUBLIC_CENTRAL_CATALOG_KEYS = [
  ...CENTRAL_PRODUCT_SNAPSHOT_KEYS,
  'artway_stany', 'artway_dostepnosc', 'artway_magazyn_produkty',
];
const PUBLIC_CENTRAL_ADMIN_KEYS = [
  'artway_ruchy_magazynowe', 'artway_magazyn_niedobory_wydan', 'artway_magazyn_lokalizacje', 'artway_magazyn_lokalizacje_usuniete',
  'artway_dokumenty_magazynowe', 'artway_dokumenty_magazynowe_usuniete', 'artway_dokumenty_magazynowe_seq',
  'artway_faktury_szkice', 'artway_producenci', 'artway_agent_ai_zlecenia', 'artway_agent_ai_plan_cykl',
  'artway_agent_ai_pamiec', 'artway_agent_ai_historia', 'artway_agent_ai_linki_producentow',
  'artway_seo_historia',
];
const PUBLIC_CENTRAL_EXCLUDED_KEYS = [...PUBLIC_CENTRAL_CATALOG_KEYS, ...PUBLIC_CENTRAL_ADMIN_KEYS];

function requestedDomainVersions(url, text) {
  try {
    const parsed = JSON.parse(String(url.searchParams.get('settingsDomains') || '{}'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).slice(0, 100)
        .map(([key, value]) => [text(key, 100), Math.max(0, Number(value) || 0)]));
    }
  } catch {}
  return {};
}

export function createStoreDataPullHandler(deps = {}) {
  const {
    respond, isAdmin, read, productLinkImport, publicSettings, readDeletedOrders,
    filterOrders, text, readBaseSettings, readSettingsDelta, adminUserRecord,
  } = deps;
  return async function storeDataPull(req, url) {
    const admin = isAdmin(req, url), centralCatalogMode = url.searchParams.get('catalogMode') === 'central';
    const [baseSettings, importedPayload] = await Promise.all([
      readBaseSettings({ data: {}, rev: 0, updated_at: null }),
      productLinkImport.payload({ requestedRev: url.searchParams.get('catalogRev'), admin }),
    ]);
    const rev = Number(baseSettings.rev || 0), requestedSettingsRev = Number(url.searchParams.get('settingsRev'));
    const settingsRevisionUnchanged = Number.isSafeInteger(requestedSettingsRev) && requestedSettingsRev > 0 && requestedSettingsRev === rev;
    let domainVersions = {}, changedDomainKeys = [], settings = baseSettings;
    const versions = requestedDomainVersions(url, text);
    // Rewizje domen są niezależne od lekkiego rekordu bazowego. Zawsze
    // porównujemy je, gdy klient przesłał własny wektor wersji.
    const shouldReadDomains = typeof readSettingsDelta === 'function'
      && (!settingsRevisionUnchanged || url.searchParams.has('settingsDomains'));
    if (shouldReadDomains) {
      const delta = await readSettingsDelta({ data: {}, rev: 0, updated_at: null }, {
        versions,
        base: baseSettings,
        excludeKeys: centralCatalogMode ? (admin ? CENTRAL_PRODUCT_SNAPSHOT_KEYS : PUBLIC_CENTRAL_EXCLUDED_KEYS) : [],
      });
      settings = delta.value || baseSettings;
      domainVersions = delta.domainVersions || {};
      changedDomainKeys = delta.changedKeys || [];
    } else if (!settingsRevisionUnchanged) settings = await read('settings', { data: {}, rev: 0, updated_at: null });

    const source = admin ? (settings.data || {}) : publicSettings(settings.data || {});
    // Administrator otrzymuje operacyjne domeny magazynu, ale nie historyczne
    // wielomegabajtowe snapshoty produktów. Klient publiczny nie otrzymuje
    // żadnych prywatnych domen operacyjnych.
    const excluded = admin ? CENTRAL_PRODUCT_SNAPSHOT_KEYS : PUBLIC_CENTRAL_CATALOG_KEYS;
    const browserSettings = Object.fromEntries(Object.entries(source).filter(([key]) => !excluded.includes(key)));
    const visibleVersions = Object.fromEntries(Object.entries(domainVersions)
      .filter(([key]) => Object.prototype.hasOwnProperty.call(browserSettings, key)));
    const visibleChangedKeys = changedDomainKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(browserSettings, key));
    const unchanged = settingsRevisionUnchanged && visibleChangedKeys.length === 0;
    const response = {
      ok: true,
      admin,
      catalog_central: centralCatalogMode,
      ...(unchanged
        ? { settings_unchanged: true }
        : { settings: browserSettings, settings_domain_versions: visibleVersions, settings_changed_keys: visibleChangedKeys }),
      rev,
      updated_at: settings.updated_at || null,
      ...importedPayload,
    };
    if (admin && url.searchParams.get('adminData') !== '0') {
      const [orders, users, deleted] = await Promise.all([
        read('orders', { items: [] }),
        read('users', { items: [] }),
        readDeletedOrders(),
      ]);
      response.deleted_orders = deleted;
      response.orders = filterOrders(orders.items || [], deleted);
      response.users = (Array.isArray(users.items) ? users.items : []).map(adminUserRecord);
    }
    return respond(response);
  };
}
