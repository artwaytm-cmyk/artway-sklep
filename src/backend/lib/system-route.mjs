export function createSystemRoute({
  odpowiedz,
  czyAdmin,
  czytaj,
  filtrujNieusunieteZamowienia,
  emailPublicConfig,
  inpostPublicConfig,
  paynowKonfiguracja,
  telegramKonfiguracja,
  allegroStatus,
  infaktPublicConfig,
  requestSession,
  createAccountSession,
  publicUser,
  accountSessionHeaders,
  clearAccountSessionHeaders,
  repository,
  storeName,
  backupKeyPattern,
  czytajUstawieniaBazowe = (fallback) => czytaj('settings', fallback),
}) {
  return async function systemRoute(req, url, action) {
    if (action === 'health') {
      const settings = await czytajUstawieniaBazowe({ updated_at: null });
      const orders = await czytaj('orders', { items: [] });
      const users = await czytaj('users', { items: [] });
      const deletedOrders = await czytaj('deleted_orders', { items: [] });
      const integrationHealth = await czytaj('integration_health', {});
      const activeOrders = filtrujNieusunieteZamowienia(orders.items || [], deletedOrders.items || []);
      const admin = czyAdmin(req, url);
      const emailConfig = emailPublicConfig();
      const emailSavedHealth = integrationHealth?.email && typeof integrationHealth.email === 'object' ? integrationHealth.email : {};
      const inpostConfig = inpostPublicConfig();
      const inpostSavedHealth = integrationHealth?.inpost && typeof integrationHealth.inpost === 'object' ? integrationHealth.inpost : {};
      const healthFresh = (value) => !!value?.checkedAt && Date.now() - Date.parse(value.checkedAt) < 24 * 60 * 60 * 1000;
      const paynowConfig = paynowKonfiguracja(req);
      const telegramConfig = telegramKonfiguracja();
      const storage = admin && typeof repository?.storageStatus === 'function'
        ? await repository.storageStatus().catch(() => ({ engine: 'postgres-normalized-v1', migrated: false, statusUnavailable: true }))
        : null;
      return odpowiedz({
        ok: true,
        configured: !!process.env.ARTWAY_ADMIN_TOKEN,
        admin,
        store: admin ? {
          orders: activeOrders.length,
          users: (users.items || []).length,
          deleted_orders: (deletedOrders.items || []).length,
          settings_updated_at: settings.updated_at || null,
          storage,
        } : { available: true, settings_updated_at: settings.updated_at || null },
        paynow: {
          configured: paynowConfig.configured,
          env: paynowConfig.env,
          continueUrl: paynowConfig.continueUrl,
          notificationUrl: paynowConfig.notificationUrl,
        },
        email: { ...emailConfig, ...(admin && healthFresh(emailSavedHealth) ? { authenticated: emailConfig.configured && emailSavedHealth.authenticated === true, lastCheckedAt: emailSavedHealth.checkedAt, lastError: emailSavedHealth.error || '', lastErrorCode: emailSavedHealth.code || '' } : {}) },
        telegram: { configured: !!(telegramConfig.token && telegramConfig.chatId) },
        inpost: { ...inpostConfig, ...(admin && healthFresh(inpostSavedHealth) ? { authenticated: inpostConfig.configured && inpostSavedHealth.authenticated === true, lastCheckedAt: inpostSavedHealth.checkedAt, serviceAvailability: { locker: inpostSavedHealth.locker === true, courier: inpostSavedHealth.courier === true } } : {}) },
        allegro: await allegroStatus(req),
        infakt: infaktPublicConfig(),
      });
    }

    if (action === 'session-refresh') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = requestSession(req);
      if (!session || session.role !== 'admin') return odpowiedz({ ok: false, error: 'Zaloguj się ponownie jako administrator.', code: 'auth' }, 401);
      const users = await czytaj('users', { items: [] });
      const admin = (Array.isArray(users.items) ? users.items : []).find((entry) => String(entry?.email || '').trim().toLowerCase() === session.email && entry.rola === 'admin');
      if (!admin) return odpowiedz({ ok: false, error: 'Konto administratora nie istnieje.', code: 'auth' }, 401);
      const user = publicUser(admin);
      return odpowiedz({ ok: true, authenticated: true, user, expiresInMinutes: user.adminIdleTimeoutMinutes }, 200, accountSessionHeaders(createAccountSession(admin)));
    }

    if (action === 'session-logout') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      return odpowiedz({ ok: true, authenticated: false }, 200, clearAccountSessionHeaders());
    }

    if (action === 'store-backup-manifest') {
      if (req.method !== 'GET') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const entries = await repository.listKeys();
      return odpowiedz({ ok: true, store: storeName, createdAt: new Date().toISOString(), entries });
    }

    if (action === 'store-backup-entry') {
      if (req.method !== 'GET') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const key = String(url.searchParams.get('key') || '');
      const expectedEtag = String(url.searchParams.get('etag') || '');
      if (!backupKeyPattern.test(key) || !expectedEtag) return odpowiedz({ ok: false, error: 'Nieprawidłowy klucz lub brak wersji kopii.', code: 'invalid_backup_request' }, 400);
      const entry = await repository.readVersioned(key, null);
      if (!entry.exists) return odpowiedz({ ok: false, error: 'Nie znaleziono wpisu kopii.', code: 'backup_entry_missing' }, 404);
      if (String(entry.etag || '') !== expectedEtag) return odpowiedz({ ok: false, error: 'Dane zmieniły się podczas wykonywania kopii. Rozpocznij eksport ponownie.', code: 'backup_changed' }, 409);
      return odpowiedz({ ok: true, key, etag: entry.etag, value: entry.value });
    }

    return null;
  };
}
