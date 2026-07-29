import { preserveManualProductPrices } from './domain/catalog-product-price-merge.mjs';
import { createCatalogProductAdminRoute } from './domain/catalog-product-admin-route.mjs';
import { createSettingsFieldMutationHandler } from './domain/settings-field-mutation.mjs';
import { createStoreDataAccountHelpers } from './domain/store-data-account-helpers.mjs';
import { createSettingsDomainWriter } from './domain/settings-domain-write.mjs';
import { createStoreDataPullHandler } from './domain/store-data-pull.mjs';
import { createStoreDataAccountRoute } from './store-data-account-route.mjs';

export function createStoreDataRoute(deps = {}) {
  const {
    odpowiedz, czyAdmin, czytaj, productLinkImport, ustawieniaPubliczneBezDanychPrywatnych,
    czytajUsunieteZamowienia, filtrujNieusunieteZamowienia, oczyscUstawienia, tekst,
    czytajWersjonowane, preserveSupplierPlanOnGenericSettings, LIMIT_USTAWIEN, zapiszJesliWersja,
    ograniczRuch, bezpieczneZamowienieKlienta, requestSession, mapaUsunietych,
    loadCheckoutProducts = null,
    storeOrderSupplierReconciliation, zwiekszLicznikKoduRabatowego, wyslijEmaileNowegoZamowienia,
    emailKonfiguracja, dopiszHistorieEmaila, createOrderAccess, bezpiecznaOpinia, zapisz,
    normalizujZamowienie, LIMIT_USUNIETYCH_ZAMOWIEN, LIMIT_ZAMOWIEN, normalizujKlienta,
    LIMIT_KLIENTOW, polaczPowiadomienia, obsluzEmailePrzejsciaStatusu, numerZamowienia,
    dopiszUsunieteZamowienie, verifyOrderAccess, profilKlienta,
    publicUser, hashPassword, createAccountSession, verifyPassword, bezpiecznePorownanie,
    legacyPasswordHash, czytajUstawieniaBazowe = (fallback) => czytaj('settings', fallback),
    czytajUstawieniaPrzyrostowo = null, accountSessionHeaders, createAdminMfaChallenge,
    createMfaEmailRecovery, createMfaEnrollment, decryptMfaSecret, mfaProvisioningUri,
    verifyAdminMfaChallenge, verifyMfaCode,
    verifyMfaEmailRecoveryChallenge, verifyMfaEmailRecoveryCode, wyslijEmailSMTP,
    primaryAdminEmail = () => '',
    clearAccountSessionHeaders = () => ({}),
    zapiszOperacjeProduktow = null,
    zapiszPolaProduktuCentralnie = null,
    publikujPolaProduktuCentralnie = null,
    createCatalogProduct = null,
    readCatalogProduct = null,
    setCatalogProductStatus = null,
    purgeCatalogProduct = null,
  } = deps;
  const catalogProductAdminRoute = createCatalogProductAdminRoute({
    respond: odpowiedz,
    isAdmin: czyAdmin,
    text: tekst,
    sessionOf: requestSession,
    saveOperations: zapiszOperacjeProduktow,
    saveFields: zapiszPolaProduktuCentralnie,
    publishFields: publikujPolaProduktuCentralnie,
    createProduct: createCatalogProduct,
    readProduct: readCatalogProduct,
    setProductStatus: setCatalogProductStatus,
    purgeProduct: purgeCatalogProduct,
  });
  const settingsFieldMutationRoute = createSettingsFieldMutationHandler({
    isAdmin: czyAdmin,
    readVersioned: czytajWersjonowane,
    writeIfVersion: zapiszJesliWersja,
    respond: odpowiedz,
    sanitizeSettings: oczyscUstawienia,
    preserveManualProductPrices,
    preserveSupplierPlan: preserveSupplierPlanOnGenericSettings,
    settingsLimit: LIMIT_USTAWIEN,
    text: tekst,
  });
  const settingsDomainWriter = createSettingsDomainWriter({
    readVersioned: czytajWersjonowane,
    writeIfVersion: zapiszJesliWersja,
    sanitizeSettings: oczyscUstawienia,
    respond: odpowiedz,
  });
  const { accessAudit, adminUserRecord, beginAdminMfa } = createStoreDataAccountHelpers({
    read: czytaj, save: zapisz, text: tekst, publicUser, respond: odpowiedz,
    decryptMfaSecret, createMfaEnrollment, createAdminMfaChallenge, mfaProvisioningUri,
  });
  const storeDataPull = createStoreDataPullHandler({
    respond: odpowiedz,
    isAdmin: czyAdmin,
    read: czytaj,
    productLinkImport,
    publicSettings: ustawieniaPubliczneBezDanychPrywatnych,
    readDeletedOrders: czytajUsunieteZamowienia,
    filterOrders: filtrujNieusunieteZamowienia,
    text: tekst,
    readBaseSettings: czytajUstawieniaBazowe,
    readSettingsDelta: czytajUstawieniaPrzyrostowo,
    adminUserRecord,
  });
  const storeDataAccountRoute = createStoreDataAccountRoute({
    odpowiedz, czyAdmin, czytaj, zapisz, czytajWersjonowane, zapiszJesliWersja,
    requestSession, primaryAdminEmail, tekst, normalizujKlienta, profilKlienta,
    publicUser, hashPassword, createAccountSession, accountSessionHeaders,
    ograniczRuch, verifyPassword, bezpiecznePorownanie, legacyPasswordHash,
    beginAdminMfa, accessAudit, verifyAdminMfaChallenge, decryptMfaSecret,
    verifyMfaCode, verifyMfaEmailRecoveryChallenge, verifyMfaEmailRecoveryCode,
    wyslijEmailSMTP, createMfaEmailRecovery, clearAccountSessionHeaders,
  });
  return async function storeDataRoute(req, url, action) {
    // ─── POBRANIE USTAWIEŃ (publiczne) + zamówień/klientów (admin) ───
    if (action === 'pull' || action === 'store-data') {
      return storeDataPull(req, url);
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
      const users = (Array.isArray(versioned.value?.items) ? versioned.value.items : []).map(adminUserRecord);
      const sameVersion = String(url.searchParams.get('usersVersion') || '') === usersVersion;
      const sameCount = Number(url.searchParams.get('count')) === users.length;
      if (sameVersion && sameCount) return odpowiedz({ ok: true, unchanged: true, count: users.length, usersVersion });
      return odpowiedz({ ok: true, users, count: users.length, usersVersion, updated_at: versioned.value?.updated_at || null });
    }

    const catalogResponse = await catalogProductAdminRoute(req, url, action);
    if (catalogResponse) return catalogResponse;

    if (action === 'settings-field-mutation') {
      return settingsFieldMutationRoute(req, url);
    }

    // ─── ZAPIS USTAWIEŃ (tylko admin) ───
    if (action === 'settings') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      if (body.mode === 'domain') {
        return settingsDomainWriter(body);
      }
      if (body.mode === 'patch') {
      const patch = oczyscUstawienia(body.patch), changedKeys = Object.keys(patch), mutationId = tekst(body.mutationId, 120);
      if (!changedKeys.length) return odpowiedz({ ok: true, unchanged: true, changedKeys: [] });
      const patchSize = Buffer.byteLength(JSON.stringify(patch), 'utf8');
      for (let attempt = 0; attempt < 5; attempt++) {
          const version = await czytajWersjonowane('settings', { data: {}, rev: 0, updated_at: null }), prev = version.value || { data: {}, rev: 0, updated_at: null };
          if (mutationId && prev.last_mutation_id === mutationId) return odpowiedz({ ok: true, duplicatePrevented: true, changedKeys, rev: prev.rev, updated_at: prev.updated_at });
          const dane = preserveSupplierPlanOnGenericSettings(preserveManualProductPrices({ ...(prev.data || {}), ...patch }, prev.data), prev.data), updated_at = new Date().toISOString();
          if (Buffer.byteLength(JSON.stringify(dane), 'utf8') > LIMIT_USTAWIEN || patchSize > LIMIT_USTAWIEN) return odpowiedz({ ok: false, error: 'Ustawienia są zbyt duże' }, 413);
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
      const dane = preserveSupplierPlanOnGenericSettings(preserveManualProductPrices(incoming, prev.data), prev.data);
      const rozmiar = Buffer.byteLength(JSON.stringify(dane), 'utf8');
      if (rozmiar > LIMIT_USTAWIEN) return odpowiedz({ ok: false, error: 'Ustawienia są zbyt duże' }, 413);
      const rec = {
        data: dane,
        rev: expectedRev + 1,
        updated_at: new Date().toISOString(),
        last_mutation_id: prev.last_mutation_id,
        mutation_receipts: Array.isArray(prev.mutation_receipts) ? prev.mutation_receipts : [],
      };
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
      const checkoutProducts = typeof loadCheckoutProducts === 'function'
        ? await loadCheckoutProducts()
        : null;
      const checkoutData = checkoutProducts
        ? {
            ...(settingsRec.data || {}),
            artway_produkty_katalog: checkoutProducts,
            artway_produkty_dodane: [],
            artway_produkty_edytowane: {},
            artway_produkty_ukryte: [],
            artway_produkty_definitywne: [],
          }
        : await productLinkImport.mergeSettings(settingsRec.data || {});
      const zam = bezpieczneZamowienieKlienta(body.order, checkoutData);
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

    const accountResponse = await storeDataAccountRoute(req, url, action);
    if (accountResponse) return accountResponse;
    return null;
  };
}
