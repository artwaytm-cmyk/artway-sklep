export function createStoreDataRoute(deps = {}) {
  const PUBLIC_CENTRAL_CATALOG_KEYS = ['artway_produkty_edytowane', 'artway_produkty_dodane', 'artway_produkty_katalog', 'artway_produkty_ukryte', 'artway_produkty_definitywne', 'artway_stany', 'artway_dostepnosc', 'artway_magazyn_produkty'];
  const PUBLIC_CENTRAL_ADMIN_KEYS = [
    'artway_ruchy_magazynowe', 'artway_magazyn_lokalizacje', 'artway_magazyn_lokalizacje_usuniete',
    'artway_dokumenty_magazynowe', 'artway_dokumenty_magazynowe_usuniete', 'artway_dokumenty_magazynowe_seq',
    'artway_faktury_szkice', 'artway_producenci', 'artway_agent_ai_zlecenia', 'artway_agent_ai_plan_cykl',
    'artway_agent_ai_pamiec', 'artway_agent_ai_historia', 'artway_agent_ai_linki_producentow',
    'artway_agent_ai_allegro_zadania', 'artway_seo_historia', 'artway_kosz_dodane', 'artway_kosz_meta',
  ];
  const PUBLIC_CENTRAL_EXCLUDED_KEYS = [...PUBLIC_CENTRAL_CATALOG_KEYS, ...PUBLIC_CENTRAL_ADMIN_KEYS];
  const {
    odpowiedz, czyAdmin, czytaj, productLinkImport, ustawieniaPubliczneBezDanychPrywatnych,
    czytajUsunieteZamowienia, filtrujNieusunieteZamowienia, oczyscUstawienia, tekst,
    czytajWersjonowane, preserveSupplierPlanOnGenericSettings, LIMIT_USTAWIEN, zapiszJesliWersja,
    ograniczRuch, bezpieczneZamowienieKlienta, requestSession, mapaUsunietych,
    storeOrderSupplierReconciliation, zwiekszLicznikKoduRabatowego, wyslijEmaileNowegoZamowienia,
    emailKonfiguracja, dopiszHistorieEmaila, createOrderAccess, bezpiecznaOpinia, zapisz,
    normalizujZamowienie, LIMIT_USUNIETYCH_ZAMOWIEN, LIMIT_ZAMOWIEN, normalizujKlienta,
    LIMIT_KLIENTOW, polaczPowiadomienia, obsluzEmailePrzejsciaStatusu, numerZamowienia,
    dopiszUsunieteZamowienie, verifyOrderAccess, normalizeTelegramAccountFields, profilKlienta,
    publicUser, hashPassword, createAccountSession, verifyPassword, bezpiecznePorownanie,
    legacyPasswordHash, czytajUstawieniaBazowe = (fallback) => czytaj('settings', fallback),
    czytajUstawieniaPrzyrostowo = null,
  } = deps;
  return async function storeDataRoute(req, url, action) {
    // ─── POBRANIE USTAWIEŃ (publiczne) + zamówień/klientów (admin) ───
    if (action === 'pull' || action === 'store-data') {
      const admin = czyAdmin(req, url);
      const centralCatalogMode = !admin && url.searchParams.get('catalogMode') === 'central';
      // Samo przechodzenie między kartami nie uruchamia ciężkich zapisów.
      const [baseSettings, importedPayload] = await Promise.all([czytajUstawieniaBazowe({ data: {}, rev: 0, updated_at: null }), productLinkImport.payload({ requestedRev: url.searchParams.get('catalogRev'), admin })]);
      const rev = Number(baseSettings.rev || 0), requestedSettingsRev = Number(url.searchParams.get('settingsRev'));
      const settingsUnchanged = Number.isSafeInteger(requestedSettingsRev) && requestedSettingsRev > 0 && requestedSettingsRev === rev;
      // Nie przesyłamy ponownie ciężkiego katalogu ani niezmienionych ustawień.
      let domainVersions = {}, changedDomainKeys = [];
      let s = baseSettings;
      if (!settingsUnchanged) {
        let requestedDomainVersions = {};
        try {
          const parsed = JSON.parse(String(url.searchParams.get('settingsDomains') || '{}'));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) requestedDomainVersions = Object.fromEntries(Object.entries(parsed).slice(0, 100).map(([key, value]) => [tekst(key, 100), Math.max(0, Number(value) || 0)]));
        } catch (error) { requestedDomainVersions = {}; }
        if (typeof czytajUstawieniaPrzyrostowo === 'function') {
          const delta = await czytajUstawieniaPrzyrostowo({ data: {}, rev: 0, updated_at: null }, { versions: requestedDomainVersions, base: baseSettings, excludeKeys: centralCatalogMode ? PUBLIC_CENTRAL_EXCLUDED_KEYS : [] });
          s = delta.value || baseSettings; domainVersions = delta.domainVersions || {}; changedDomainKeys = delta.changedKeys || [];
        } else s = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
      }
      const sourceSettings = admin ? (s.data || {}) : ustawieniaPubliczneBezDanychPrywatnych(s.data || {});
      const browserSettings = Object.fromEntries(Object.entries(sourceSettings).filter(([key]) => key !== 'artway_produkty_katalog'));
      const visibleDomainVersions = Object.fromEntries(Object.entries(domainVersions).filter(([key]) => Object.prototype.hasOwnProperty.call(sourceSettings, key)));
      const res = { ok: true, admin, catalog_central: centralCatalogMode, ...(settingsUnchanged ? { settings_unchanged: true } : { settings: browserSettings, settings_domain_versions: visibleDomainVersions, settings_changed_keys: changedDomainKeys.filter((key) => Object.prototype.hasOwnProperty.call(sourceSettings, key)) }), rev, updated_at: s.updated_at || null };
      Object.assign(res, importedPayload);
      if (admin && url.searchParams.get('adminData') !== '0') {
        const o = await czytaj('orders', { items: [] });
        const u = await czytaj('users', { items: [] });
        const d = await czytajUsunieteZamowienia();
        res.deleted_orders = d;
        res.orders = filtrujNieusunieteZamowienia(o.items || [], d);
        res.users = u.items || [];
      }
      return odpowiedz(res);
    }

    // Lekka kolejka zamówień dla panelu. Nie pobiera katalogu produktów ani
    // ustawień, dlatego może być sprawdzana przy wejściu na listę i co minutę.
    if (action === 'store-orders-admin') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const [ordersVersioned, deletedVersioned] = await Promise.all([
        czytajWersjonowane('orders', { items: [], updated_at: null }),
        czytajWersjonowane('deleted_orders', { items: [], updated_at: null }),
      ]);
      const version = (record) => String(record?.etag || '').replace(/^W\//, '').replace(/^"|"$/g, '');
      const ordersVersion = version(ordersVersioned), deletedVersion = version(deletedVersioned);
      const deletedOrders = Array.isArray(deletedVersioned.value?.items) ? deletedVersioned.value.items : [];
      const orders = filtrujNieusunieteZamowienia(ordersVersioned.value?.items || [], deletedOrders);
      const sameVersion = String(url.searchParams.get('ordersVersion') || '') === ordersVersion
        && String(url.searchParams.get('deletedVersion') || '') === deletedVersion;
      const sameCount = Number(url.searchParams.get('count')) === orders.length;
      if (sameVersion && sameCount) return odpowiedz({ ok: true, unchanged: true, count: orders.length, ordersVersion, deletedVersion });
      return odpowiedz({ ok: true, orders, deleted_orders: deletedOrders, count: orders.length, ordersVersion, deletedVersion, updated_at: ordersVersioned.value?.updated_at || null });
    }

    // Lekki słownik kont dla podstrony Klienci i uprawnień. Nie jest już
    // dokładany do każdej synchronizacji katalogu oraz ustawień.
    if (action === 'store-users-admin') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const versioned = await czytajWersjonowane('users', { items: [], updated_at: null });
      const usersVersion = String(versioned?.etag || '').replace(/^W\//, '').replace(/^"|"$/g, '');
      const users = (Array.isArray(versioned.value?.items) ? versioned.value.items : []).map(publicUser);
      const sameVersion = String(url.searchParams.get('usersVersion') || '') === usersVersion;
      const sameCount = Number(url.searchParams.get('count')) === users.length;
      if (sameVersion && sameCount) return odpowiedz({ ok: true, unchanged: true, count: users.length, usersVersion });
      return odpowiedz({ ok: true, users, count: users.length, usersVersion, updated_at: versioned.value?.updated_at || null });
    }

    // ─── ZAPIS USTAWIEŃ (tylko admin) ───
    if (action === 'settings') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      if (body.mode === 'patch') {
        const patch = oczyscUstawienia(body.patch), changedKeys = Object.keys(patch), mutationId = tekst(body.mutationId, 120);
        if (!changedKeys.length) return odpowiedz({ ok: true, unchanged: true, changedKeys: [] });
        for (let attempt = 0; attempt < 5; attempt++) {
          const version = await czytajWersjonowane('settings', { data: {}, rev: 0, updated_at: null }), prev = version.value || { data: {}, rev: 0, updated_at: null };
          if (mutationId && prev.last_mutation_id === mutationId) return odpowiedz({ ok: true, duplicatePrevented: true, changedKeys, rev: prev.rev, updated_at: prev.updated_at });
          const dane = preserveSupplierPlanOnGenericSettings({ ...(prev.data || {}), ...patch }, prev.data), updated_at = new Date().toISOString();
          if (JSON.stringify(dane).length > LIMIT_USTAWIEN) return odpowiedz({ ok: false, error: 'Ustawienia są zbyt duże' }, 413);
          const rec = { ...prev, data: dane, rev: Number(prev.rev || 0) + 1, updated_at, last_mutation_id: mutationId || undefined };
          const write = await zapiszJesliWersja('settings', rec, version);
          if (write?.modified) return odpowiedz({ ok: true, changedKeys, rev: rec.rev, updated_at, rebased: Number(body.expectedRev) !== Number(prev.rev || 0) });
        }
        return odpowiedz({ ok: false, error: 'Serwer równolegle zapisuje inne dane. Zmiana nie została utracona — ponów zapis.', code: 'settings_write_conflict' }, 409);
      }
      const incoming = oczyscUstawienia(body.settings);
      const expectedRev = Number(body.expectedRev);
      if (!Number.isSafeInteger(expectedRev) || expectedRev < 0) {
        return odpowiedz({ ok: false, error: 'Brakuje rewizji bazowej. Pobierz aktualne ustawienia przed zapisem.', code: 'settings_write_conflict' }, 409);
      }
      const version = await czytajWersjonowane('settings', { data: {}, rev: 0, updated_at: null });
      const prev = version.value || { data: {}, rev: 0, updated_at: null };
      if (Number(prev.rev || 0) !== expectedRev) {
        return odpowiedz({ ok: false, error: 'Ustawienia zmieniły się na innym urządzeniu. Niczego nie nadpisano.', code: 'settings_write_conflict', rev: Number(prev.rev || 0) }, 409);
      }
      const dane = preserveSupplierPlanOnGenericSettings(incoming, prev.data);
      const rozmiar = JSON.stringify(dane).length;
      if (rozmiar > LIMIT_USTAWIEN) return odpowiedz({ ok: false, error: 'Ustawienia są zbyt duże' }, 413);
      const rec = { data: dane, rev: expectedRev + 1, updated_at: new Date().toISOString() };
      const write = await zapiszJesliWersja('settings', rec, version);
      if (!write?.modified) {
        return odpowiedz({ ok: false, error: 'Ustawienia zmieniły się podczas zapisu. Niczego nie nadpisano.', code: 'settings_write_conflict' }, 409);
      }
      return odpowiedz({ ok: true, rev: rec.rev, updated_at: rec.updated_at });
    }

    // ─── KLIENT SKŁADA ZAMÓWIENIE (publiczne) ───
    if (action === 'store-order-create') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = ograniczRuch(req, 'order-create', 20, 60 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const settingsRec = await czytaj('settings', { data: {} });
      const zam = bezpieczneZamowienieKlienta(body.order, await productLinkImport.mergeSettings(settingsRec.data || {}));
      const session = requestSession(req);
      if (session && session.email !== zam.email) return odpowiedz({ ok: false, error: 'Zamówienie musi należeć do zalogowanego konta.', code: 'auth' }, 403);
      zam.status = 'nowe';
      zam.inventoryMode = 'reserved_until_shipment';
      zam.ts = Date.now();
      zam.data = new Date(zam.ts).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
      zam.inventoryReservedAt = new Date(zam.ts).toISOString();
      const usuniete = mapaUsunietych(await czytajUsunieteZamowienia());
      const stored = await storeOrderSupplierReconciliation.saveOrder({ order: zam, deletedOrderNumbers: new Set(usuniete.keys()) });
      if (stored.deleted) return odpowiedz({ ok: true, stored: false, deleted: true, number: zam.nr });
      if (stored.duplicate) return odpowiedz({ ok: true, stored: false, duplicate: true, number: zam.nr });
      if (zam.rabatKod) await zwiekszLicznikKoduRabatowego(zam.rabatKod).catch(() => false);
      let email = null;
      // Zamówienie jest już bezpiecznie zapisane. Chwilowa awaria katalogu
      // lub konflikt settings nie może cofnąć checkoutu klienta.
      const supplierDrafts = await storeOrderSupplierReconciliation.reconcileDraftsSafely({ summary: true });
      if (zam.platnoscId !== 'paynow') {
        try { email = await wyslijEmaileNowegoZamowienia(zam); }
        catch (e) {
          email = { configured: emailKonfiguracja().configured, sent: false, error: e.message };
          await dopiszHistorieEmaila(zam.nr, { typ: 'potwierdzenie', status: 'błąd wysyłki', blad: e.message, automatyczne: true });
        }
      }
      return odpowiedz({ ok: true, stored: true, number: zam.nr, email, supplierDrafts, orderAccessToken: createOrderAccess(zam) });
    }

    // ─── KLIENT SKŁADA OPINIĘ (publiczne, do moderacji) ───
    if (action === 'store-review-add') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = ograniczRuch(req, 'review-add', 10, 60 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const op = bezpiecznaOpinia(body.review);
      if (!op) return odpowiedz({ ok: false, error: 'Opinia nie zawiera wymaganych danych.' }, 422);
      const rec = await czytaj('settings', { data: {}, rev: 0 });
      const dane = rec.data || {};
      const lista = Array.isArray(dane.artway_opinie) ? dane.artway_opinie : [];
      lista.unshift(op);
      while (lista.length > 5000) lista.pop();
      dane.artway_opinie = lista;
      await zapisz('settings', { ...rec, data: dane, rev: (Number(rec.rev) || 0) + 1, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, stored: true });
    }

    // ─── MOJE ZAMÓWIENIA (po e-mailu) ───
    if (action === 'store-orders-mine') {
      const session = requestSession(req);
      const email = tekst(url.searchParams.get('email') || session?.email, 200).trim().toLowerCase();
      if (!session || (!czyAdmin(req, url) && session.email !== email)) return odpowiedz({ ok: false, error: 'Zaloguj się, aby pobrać swoje zamówienia.', code: 'auth' }, 401);
      if (!email) return odpowiedz({ ok: true, orders: [] });
      const rec = await czytaj('orders', { items: [] });
      const usuniete = await czytajUsunieteZamowienia();
      const moje = filtrujNieusunieteZamowienia(rec.items || [], usuniete).filter((z) => (z.email || '').toLowerCase() === email);
      return odpowiedz({ ok: true, orders: moje });
    }

    // ─── ZGODNOŚĆ ZE STARSZYMI KLIENTAMI ───
    // Serwer jest jedynym źródłem danych. Starsza przeglądarka może nadal
    // wywołać store-sync, ale jej localStorage nie jest już scalany z bazą.
    if (action === 'store-sync') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const [recO, recU, deletedOrders] = await Promise.all([
        czytaj('orders', { items: [], updated_at: null }),
        czytaj('users', { items: [], updated_at: null }),
        czytajUsunieteZamowienia(),
      ]);
      const orders = filtrujNieusunieteZamowienia(recO.items || [], deletedOrders);
      return odpowiedz({
        ok: true, server_authoritative: true, orders,
        users: Array.isArray(recU.items) ? recU.items : [],
        deleted_orders: deletedOrders,
        updated_at: recO.updated_at || recU.updated_at || new Date().toISOString(),
      });
    }

    // ─── ADMIN: zapis / usuwanie zamówienia ───
    if (action === 'store-order-save') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const zam = normalizujZamowienie(body.order);
      if (!zam) return odpowiedz({ ok: false, error: 'Brak danych zamówienia' }, 422);
      const usuniete = mapaUsunietych(await czytajUsunieteZamowienia());
      if (usuniete.has(zam.nr)) return odpowiedz({ ok: true, stored: false, deleted: true, number: zam.nr });
      const rec = await czytaj('orders', { items: [] });
      const items = filtrujNieusunieteZamowienia(rec.items || [], usuniete);
      const i = items.findIndex((x) => x.nr === zam.nr);
      const stary = i >= 0 ? items[i] : null;
      // zachowaj serwerową historię e-maili (klient mógł mieć starszą kopię)
      if (stary) {
        zam.wysylka = zam.wysylka || {};
        zam.wysylka.powiadomienia = polaczPowiadomienia(stary?.wysylka?.powiadomienia, zam.wysylka.powiadomienia);
        zam.inventoryMode = stary.inventoryMode || zam.inventoryMode;
        zam.inventoryReservedAt = stary.inventoryReservedAt || zam.inventoryReservedAt;
        zam.inventoryDeductedAt = stary.inventoryDeductedAt || zam.inventoryDeductedAt;
      }
      if (i >= 0) items[i] = zam; else items.unshift(zam);
      await zapisz('orders', { items, updated_at: new Date().toISOString() });
      const inventory = await storeOrderSupplierReconciliation.finalizeInventoryForOrder(zam);
      if (inventory.inventoryMode) zam.inventoryMode = inventory.inventoryMode;
      const supplierDrafts = await storeOrderSupplierReconciliation.reconcileDraftsSafely();
      let email = null;
      try { email = await obsluzEmailePrzejsciaStatusu(stary, zam); }
      catch (e) { email = { sent: false, error: e.message }; }
      return odpowiedz({ ok: true, stored: true, number: zam.nr, inventory, supplierDrafts, email, powiadomienia: email?.powiadomienia });
    }
    if (action === 'store-order-delete') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const nr = numerZamowienia(body.number || body.nr);
      if (!nr) return odpowiedz({ ok: false, error: 'Brak numeru zamówienia' }, 422);
      await dopiszUsunieteZamowienie({ nr, by: 'admin' });
      const rec = await czytaj('orders', { items: [] });
      const items = (rec.items || []).filter((x) => x.nr !== nr);
      await zapisz('orders', { items, updated_at: new Date().toISOString() });
      const supplierDrafts = await storeOrderSupplierReconciliation.reconcileDraftsSafely({ summary: true });
      return odpowiedz({ ok: true, deleted: true, supplierDrafts });
    }

    // ─── KLIENT: usuwa własne zlecenie/zamówienie ───
    if (action === 'store-order-delete-mine') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const nr = numerZamowienia(body.number || body.nr);
      const email = tekst(body.email, 200).trim().toLowerCase();
      if (!nr || !email) return odpowiedz({ ok: false, error: 'Brak numeru zamówienia albo e-maila klienta' }, 422);
      const rec = await czytaj('orders', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const zam = items.find((x) => x.nr === nr);
      if (!zam) return odpowiedz({ ok: false, error: 'Nie znaleziono zamówienia.' }, 404);
      const session = requestSession(req);
      const sessionOwns = !!session && session.email === email && session.email === String(zam.email || '').toLowerCase();
      const guestOwns = verifyOrderAccess(body.orderAccessToken, zam);
      if (!czyAdmin(req, url) && !sessionOwns && !guestOwns) return odpowiedz({ ok: false, error: 'Brak uprawnień do tego zamówienia.', code: 'auth' }, 403);
      await dopiszUsunieteZamowienie({ nr, email, by: 'customer' });
      await zapisz('orders', { items: items.filter((x) => x.nr !== nr), updated_at: new Date().toISOString() });
      const supplierDrafts = await storeOrderSupplierReconciliation.reconcileDraftsSafely({ summary: true });
      return odpowiedz({ ok: true, deleted: true, supplierDrafts });
    }

    // ─── ADMIN/KLIENT: zapis klienta ───
    if (action === 'store-user-save' || action === 'account-profile-save') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const session = requestSession(req);
      if (action === 'store-user-save' && !czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      if (action === 'account-profile-save' && !session) return odpowiedz({ ok: false, error: 'Zaloguj się ponownie.', code: 'auth' }, 401);
      const telegramFields = action === 'store-user-save' ? normalizeTelegramAccountFields(body.user) : {};
      const u = action === 'store-user-save' ? normalizujKlienta(body.user) : profilKlienta(body.user, session.email);
      if (!u) return odpowiedz({ ok: false, error: 'Brak danych klienta' }, 422);
      if (action === 'store-user-save') {
        delete u.telegramChatId;
        delete u.telegramUserId;
        delete u.telegramAccess;
        delete u.telegramApprover;
        Object.assign(u, telegramFields);
      }
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const i = items.findIndex((x) => (x.email || '').toLowerCase() === u.email);
      if (action === 'account-profile-save' && i < 0) return odpowiedz({ ok: false, error: 'Nie znaleziono konta.', code: 'auth' }, 404);
      if (i >= 0) items[i] = { ...items[i], ...u, email: items[i].email, rola: items[i].rola, passwordHash: items[i].passwordHash, hash: items[i].hash }; else items.push(u);
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, stored: true, email: u.email, user: i >= 0 ? publicUser(items[i]) : publicUser(u) });
    }
    if (action === 'store-user-delete') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const email = tekst(body.email, 200).trim().toLowerCase();
      const rec = await czytaj('users', { items: [] });
      const items = (rec.items || []).filter((x) => (x.email || '').toLowerCase() !== email);
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, deleted: true });
    }

    // ─── REJESTRACJA KLIENTA (publiczna, konto we wspólnej bazie) ───
    if (action === 'account-register') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = ograniczRuch(req, 'account-register', 5, 60 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const password = String(body.password || '');
      const u = profilKlienta(body.user);
      if (!u || password.length < 8 || password.length > 200) return odpowiedz({ ok: false, error: 'Hasło musi mieć co najmniej 8 znaków.' }, 422);
      u.rola = 'klient'; u.account = true; u.passwordHash = await hashPassword(password); u.data = new Date().toISOString();
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      if (items.some((x) => (x.email || '').toLowerCase() === u.email)) {
        return odpowiedz({ ok: false, error: 'Konto z tym adresem już istnieje.', code: 'exists' }, 409);
      }
      items.push(u);
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      const user = publicUser(u);
      return odpowiedz({ ok: true, stored: true, user, sessionToken: createAccountSession(user) });
    }

    // ─── LOGOWANIE KLIENTA (publiczne, sprawdzenie hasła we wspólnej bazie) ───
    if (action === 'account-login') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = ograniczRuch(req, 'account-login', 10, 15 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const email = tekst(body.email, 200).trim().toLowerCase();
      const password = String(body.password || '');
      if (!email || !password) return odpowiedz({ ok: false, error: 'Podaj e-mail i hasło', code: 'auth' }, 401);
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const u = items.find((x) => (x.email || '').toLowerCase() === email);
      const modernOk = u?.passwordHash ? await verifyPassword(password, u.passwordHash).catch(() => false) : false;
      const legacyOk = !u?.passwordHash && !!u?.hash && bezpiecznePorownanie(legacyPasswordHash(password), String(u.hash));
      if (!u || (!modernOk && !legacyOk)) return odpowiedz({ ok: false, error: 'Nieprawidłowy e-mail lub hasło.', code: 'auth' }, 401);
      if (legacyOk) {
        u.passwordHash = await hashPassword(password);
        delete u.hash;
        await zapisz('users', { items, updated_at: new Date().toISOString() });
      }
      const user = publicUser(u);
      return odpowiedz({ ok: true, authenticated: true, user, sessionToken: createAccountSession(user) });
    }

    if (action === 'account-password-change') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = requestSession(req);
      if (!session) return odpowiedz({ ok: false, error: 'Zaloguj się ponownie.', code: 'auth' }, 401);
      const limited = ograniczRuch(req, 'password-change', 5, 60 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const currentPassword = String(body.currentPassword || body.current_password || '');
      const newPassword = String(body.newPassword || body.new_password || '');
      if (newPassword.length < 8 || newPassword.length > 200) return odpowiedz({ ok: false, error: 'Nowe hasło musi mieć co najmniej 8 znaków.' }, 422);
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const u = items.find((x) => (x.email || '').toLowerCase() === session.email);
      const modernOk = u?.passwordHash ? await verifyPassword(currentPassword, u.passwordHash).catch(() => false) : false;
      const legacyOk = !u?.passwordHash && !!u?.hash && bezpiecznePorownanie(legacyPasswordHash(currentPassword), String(u.hash));
      if (!u || (!modernOk && !legacyOk)) return odpowiedz({ ok: false, error: 'Obecne hasło jest nieprawidłowe.', code: 'auth' }, 401);
      u.passwordHash = await hashPassword(newPassword);
      delete u.hash;
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      const user = publicUser(u);
      return odpowiedz({ ok: true, changed: true, user, sessionToken: createAccountSession(user) });
    }

    // ─── logowanie tokenem (sprawdzenie hasła administratora) ───
    if (action === 'login') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const podane = tekst(body.password || body.token, 500);
      const env = process.env.ARTWAY_ADMIN_TOKEN || '';
      if (!env) return odpowiedz({ ok: false, error: 'Serwer nie ma ustawionego hasła (ARTWAY_ADMIN_TOKEN).', code: 'no_token' }, 503);
      if (!bezpiecznePorownanie(podane, env)) return odpowiedz({ ok: false, error: 'Nieprawidłowe hasło administratora', code: 'auth' }, 401);
      const adminUser = { email: tekst(body.email || process.env.ARTWAY_ADMIN_EMAIL || 'artwaytm@gmail.com', 200).trim().toLowerCase(), rola: 'admin' };
      return odpowiedz({ ok: true, authenticated: true, sessionToken: createAccountSession(adminUser) });
    }
    return null;
  };
}
