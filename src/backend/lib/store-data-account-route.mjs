import { isValidAccountEmail } from './core/account-validation.mjs';

export function createStoreDataAccountRoute(deps = {}) {
  const {
    odpowiedz, czyAdmin, czytaj, zapisz, czytajWersjonowane, zapiszJesliWersja,
    requestSession, tekst, normalizujKlienta, profilKlienta,
    publicUser, hashPassword, createAccountSession, accountSessionHeaders,
    ograniczRuch, verifyPassword, bezpiecznePorownanie, legacyPasswordHash,
    beginAdminMfa, accessAudit, verifyAdminMfaChallenge, decryptMfaSecret,
    verifyMfaCode, verifyMfaEmailRecoveryChallenge, verifyMfaEmailRecoveryCode,
    wyslijEmailSMTP, createMfaEmailRecovery, clearAccountSessionHeaders,
  } = deps;
  return async function storeDataAccountRoute(req, url, action) {
    // ─── ADMIN/KLIENT: zapis klienta ───
    if (action === 'store-user-save' || action === 'account-profile-save') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const session = requestSession(req);
      if (action === 'store-user-save' && !czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      if (action === 'account-profile-save' && !session) return odpowiedz({ ok: false, error: 'Zaloguj się ponownie.', code: 'auth' }, 401);
      const u = action === 'store-user-save' ? normalizujKlienta(body.user) : profilKlienta(body.user, session.email);
      if (!u) return odpowiedz({ ok: false, error: 'Brak danych klienta' }, 422);
      for (let attempt = 0; attempt < 5; attempt++) {
        const version = await czytajWersjonowane('users', { items: [] });
        const previous = version.value || { items: [] };
        const items = Array.isArray(previous.items) ? previous.items.map((entry) => ({ ...entry })) : [];
        const i = items.findIndex((x) => (x.email || '').toLowerCase() === u.email);
        if (i < 0) return odpowiedz({ ok: false, error: 'Nie znaleziono konta. Nowe konto utwórz przez bezpieczny formularz.', code: action === 'account-profile-save' ? 'auth' : 'not_found' }, 404);
        items[i] = { ...items[i], ...u, email: items[i].email, rola: items[i].rola, passwordHash: items[i].passwordHash, hash: items[i].hash };
        const write = await zapiszJesliWersja('users', { ...previous, items, updated_at: new Date().toISOString() }, version);
        if (!write?.modified) continue;
        return odpowiedz({ ok: true, stored: true, email: u.email, user: publicUser(items[i]) });
      }
      return odpowiedz({ ok: false, error: 'Dane konta zostały równolegle zmienione. Odśwież i ponów zapis.', code: 'users_write_conflict' }, 409);
    }
    if (action === 'store-user-create') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = requestSession(req);
      if (!czyAdmin(req, url) || !session || session.role !== 'admin') {
        return odpowiedz({ ok: false, error: 'Brak uprawnień administratora.', code: 'auth' }, 403);
      }
      const body = await req.json().catch(() => ({}));
      const password = String(body.password || '');
      if (!isValidAccountEmail(body.user?.email)) return odpowiedz({ ok: false, error: 'Podaj poprawny adres e-mail.', code: 'email' }, 422);
      const user = profilKlienta(body.user);
      if (!user?.imie || user.imie.length < 2) return odpowiedz({ ok: false, error: 'Podaj imię i nazwisko.', code: 'name' }, 422);
      if (password.length < 8 || password.length > 200) return odpowiedz({ ok: false, error: 'Hasło musi mieć co najmniej 8 znaków.', code: 'password' }, 422);
      user.rola = 'klient';
      user.account = true;
      user.authVersion = 1;
      user.passwordHash = await hashPassword(password);
      user.data = new Date().toISOString();
      for (let attempt = 0; attempt < 5; attempt++) {
        const version = await czytajWersjonowane('users', { items: [] });
        const previous = version.value || { items: [] };
        const items = Array.isArray(previous.items) ? previous.items.map((entry) => ({ ...entry })) : [];
        if (items.some((entry) => String(entry?.email || '').trim().toLowerCase() === user.email)) {
          return odpowiedz({ ok: false, error: 'Konto z tym adresem już istnieje.', code: 'exists' }, 409);
        }
        items.push(user);
        const now = new Date().toISOString();
        const write = await zapiszJesliWersja('users', { ...previous, items, updated_at: now }, version);
        if (!write?.modified) continue;
        await accessAudit({ action: 'account_created', actor: session.email, target: user.email, before: 'missing', after: 'klient' }).catch(() => {});
        return odpowiedz({ ok: true, stored: true, authenticated: false, user: publicUser(user) }, 201);
      }
      return odpowiedz({ ok: false, error: 'Lista kont została równolegle zmieniona. Ponów tworzenie konta.', code: 'users_write_conflict' }, 409);
    }
    if (action === 'store-user-password-reset') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = requestSession(req);
      if (!czyAdmin(req, url) || !session || session.role !== 'admin') {
        return odpowiedz({ ok: false, error: 'Brak uprawnień administratora.', code: 'auth' }, 403);
      }
      const body = await req.json().catch(() => ({}));
      const email = tekst(body.email, 200).trim().toLowerCase();
      const password = String(body.password || '');
      if (!isValidAccountEmail(email)) return odpowiedz({ ok: false, error: 'Podaj prawidłowe konto.', code: 'invalid_email' }, 422);
      if (email === session.email) return odpowiedz({ ok: false, error: 'Hasło własnego konta zmień w sekcji Moje konto.', code: 'protected_account' }, 409);
      if (password.length < 8 || password.length > 200) return odpowiedz({ ok: false, error: 'Nowe hasło musi mieć co najmniej 8 znaków.', code: 'password' }, 422);
      const passwordHash = await hashPassword(password);
      for (let attempt = 0; attempt < 5; attempt++) {
        const version = await czytajWersjonowane('users', { items: [] });
        const previous = version.value || { items: [] };
        const items = Array.isArray(previous.items) ? previous.items.map((entry) => ({ ...entry })) : [];
        const index = items.findIndex((entry) => String(entry?.email || '').trim().toLowerCase() === email);
        if (index < 0) return odpowiedz({ ok: false, error: 'Nie znaleziono konta użytkownika.', code: 'not_found' }, 404);
        const now = new Date().toISOString();
        items[index].passwordHash = passwordHash;
        delete items[index].hash;
        items[index].authVersion = Math.max(0, Number(items[index].authVersion) || 0) + 1;
        items[index].passwordChangedAt = now;
        items[index].passwordChangedBy = session.email;
        const write = await zapiszJesliWersja('users', { ...previous, items, updated_at: now }, version);
        if (!write?.modified) continue;
        await accessAudit({ action: 'password_reset', actor: session.email, target: email, before: 'active', after: 'sessions_invalidated' }).catch(() => {});
        return odpowiedz({ ok: true, changed: true, sessionInvalidated: true, user: publicUser(items[index]) });
      }
      return odpowiedz({ ok: false, error: 'Lista kont została równolegle zmieniona. Ponów zmianę hasła.', code: 'users_write_conflict' }, 409);
    }
    if (action === 'account-mfa-reset') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = requestSession(req);
      if (!czyAdmin(req, url) || !session || session.role !== 'admin') {
        return odpowiedz({ ok: false, error: 'Zaloguj się ponownie jako administrator.', code: 'auth' }, 403);
      }
      const body = await req.json().catch(() => ({}));
      const targetEmail = tekst(body.email || session.email, 200).trim().toLowerCase();
      const selfReset = targetEmail === session.email;
      if (!isValidAccountEmail(targetEmail)) return odpowiedz({ ok: false, error: 'Podaj prawidłowe konto administratora.', code: 'invalid_email' }, 422);
      const currentPassword = String(body.currentPassword || '');
      for (let attempt = 0; attempt < 5; attempt++) {
        const version = await czytajWersjonowane('users', { items: [] });
        const previous = version.value || { items: [] };
        const items = Array.isArray(previous.items) ? previous.items.map((entry) => ({ ...entry })) : [];
        const index = items.findIndex((entry) => String(entry?.email || '').trim().toLowerCase() === targetEmail);
        if (index < 0) return odpowiedz({ ok: false, error: 'Nie znaleziono konta administratora.', code: 'not_found' }, 404);
        if (items[index].rola !== 'admin') return odpowiedz({ ok: false, error: 'Reset Authenticatora dotyczy wyłącznie kont administratorów.', code: 'admin_required' }, 409);
        if (selfReset) {
          const passwordOk = items[index].passwordHash
            ? await verifyPassword(currentPassword, items[index].passwordHash).catch(() => false)
            : (!items[index].passwordHash && !!items[index].hash && bezpiecznePorownanie(legacyPasswordHash(currentPassword), String(items[index].hash)));
          if (!passwordOk) return odpowiedz({ ok: false, error: 'Aktualne hasło jest nieprawidłowe.', code: 'auth' }, 401);
        }
        const now = new Date().toISOString();
        for (const key of [
          'mfaSecretEncrypted', 'mfaPendingSecretEncrypted', 'mfaPendingCreatedAt', 'mfaEnabledAt',
          'mfaEmailRecoveryCodeHash', 'mfaEmailRecoveryNonce', 'mfaEmailRecoveryExpiresAt',
          'mfaEmailRecoveryRequestedAt', 'mfaEmailRecoveryFailedAttempts', 'mfaEmailRecoveryUsedAt',
          'mfaRecoveryCodeHashes',
        ]) delete items[index][key];
        items[index].authVersion = Math.max(0, Number(items[index].authVersion) || 0) + 1;
        items[index].mfaResetAt = now;
        items[index].mfaResetBy = session.email;
        const write = await zapiszJesliWersja('users', { ...previous, items, updated_at: now }, version);
        if (!write?.modified) continue;
        await accessAudit({ action: 'mfa_reset', actor: session.email, target: targetEmail, before: 'configured', after: 'enrollment_required' }).catch(() => {});
        return odpowiedz({
          ok: true,
          reset: true,
          enrollmentRequired: true,
          sessionInvalidated: true,
          selfReset,
          user: publicUser(items[index]),
        }, 200, selfReset ? clearAccountSessionHeaders() : {});
      }
      return odpowiedz({ ok: false, error: 'Lista kont została równolegle zmieniona. Ponów reset Authenticatora.', code: 'users_write_conflict' }, 409);
    }
    if (action === 'store-user-role') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = requestSession(req);
      if (!czyAdmin(req, url) || !session || session.role !== 'admin') return odpowiedz({ ok: false, error: 'Brak uprawnień administratora.', code: 'auth' }, 403);
      const body = await req.json().catch(() => ({}));
      const email = tekst(body.email, 200).trim().toLowerCase();
      const role = body.role === 'admin' ? 'admin' : body.role === 'klient' ? 'klient' : '';
      if (!isValidAccountEmail(email) || !role) return odpowiedz({ ok: false, error: 'Wybierz istniejące konto i prawidłową rolę.', code: 'invalid_role_change' }, 422);
      if (email === session.email) return odpowiedz({ ok: false, error: 'Nie możesz zmienić roli aktualnie używanego konta.', code: 'protected_account' }, 409);
      for (let attempt = 0; attempt < 5; attempt++) {
        const version = await czytajWersjonowane('users', { items: [] });
        const previous = version.value || { items: [] }, items = Array.isArray(previous.items) ? previous.items.map((entry) => ({ ...entry })) : [];
        const index = items.findIndex((entry) => String(entry?.email || '').trim().toLowerCase() === email);
        if (index < 0) return odpowiedz({ ok: false, error: 'Nie znaleziono konta użytkownika.', code: 'not_found' }, 404);
        const before = items[index].rola === 'admin' ? 'admin' : 'klient';
        if (before === role) return odpowiedz({ ok: true, unchanged: true, user: publicUser(items[index]) });
        if (before === 'admin' && role !== 'admin' && items.filter((entry) => entry?.rola === 'admin').length <= 1) {
          return odpowiedz({ ok: false, error: 'Nie można odebrać roli ostatniemu administratorowi.', code: 'last_admin_protected' }, 409);
        }
        const now = new Date().toISOString();
        items[index].rola = role;
        items[index].authVersion = Math.max(0, Number(items[index].authVersion) || 0) + 1;
        items[index].roleUpdatedAt = now;
        items[index].roleUpdatedBy = session.email;
        const write = await zapiszJesliWersja('users', { ...previous, items, updated_at: now }, version);
        if (!write?.modified) continue;
        await accessAudit({ action: role === 'admin' ? 'role_granted' : 'role_revoked', actor: session.email, target: email, before, after: role }).catch(() => {});
        return odpowiedz({ ok: true, changed: true, user: publicUser(items[index]), sessionInvalidated: true });
      }
      return odpowiedz({ ok: false, error: 'Lista kont została równolegle zmieniona. Ponów operację.', code: 'users_write_conflict' }, 409);
    }
    if (action === 'store-user-delete') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = requestSession(req);
      if (!czyAdmin(req, url) || !session || session.role !== 'admin') return odpowiedz({ ok: false, error: 'Brak uprawnień administratora.', code: 'auth' }, 403);
      const body = await req.json().catch(() => ({}));
      const email = tekst(body.email, 200).trim().toLowerCase();
      if (!isValidAccountEmail(email)) return odpowiedz({ ok: false, error: 'Podaj prawidłowe konto.', code: 'invalid_email' }, 422);
      if (email === session.email) return odpowiedz({ ok: false, error: 'Nie można usunąć aktualnie używanego konta.', code: 'protected_account' }, 409);
      for (let attempt = 0; attempt < 5; attempt++) {
        const version = await czytajWersjonowane('users', { items: [] });
        const previous = version.value || { items: [] }, items = Array.isArray(previous.items) ? previous.items : [];
        const target = items.find((entry) => String(entry?.email || '').trim().toLowerCase() === email);
        if (!target) return odpowiedz({ ok: true, deleted: true, alreadyDeleted: true, email });
        if (target.rola === 'admin') return odpowiedz({ ok: false, error: 'Najpierw odbierz temu kontu rolę administratora.', code: 'admin_role_protected' }, 409);
        const now = new Date().toISOString(), next = items.filter((entry) => String(entry?.email || '').trim().toLowerCase() !== email);
        const write = await zapiszJesliWersja('users', { ...previous, items: next, updated_at: now }, version);
        if (!write?.modified) continue;
        await accessAudit({ action: 'account_deleted', actor: session.email, target: email, before: 'klient', after: 'deleted' }).catch(() => {});
        return odpowiedz({ ok: true, deleted: true, email, sessionInvalidated: true });
      }
      return odpowiedz({ ok: false, error: 'Lista kont została równolegle zmieniona. Ponów usunięcie.', code: 'users_write_conflict' }, 409);
    }

    // ─── REJESTRACJA KLIENTA (publiczna, konto we wspólnej bazie) ───
    if (action === 'account-register') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = ograniczRuch(req, 'account-register', 5, 60 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const password = String(body.password || '');
      if (!isValidAccountEmail(body.user?.email)) return odpowiedz({ ok: false, error: 'Podaj poprawny adres e-mail.', code: 'email' }, 422);
      const u = profilKlienta(body.user);
      if (!u) return odpowiedz({ ok: false, error: 'Podaj poprawny adres e-mail.', code: 'email' }, 422);
      if (!u.imie || u.imie.length < 2) return odpowiedz({ ok: false, error: 'Podaj imię i nazwisko.', code: 'name' }, 422);
      if (password.length < 8 || password.length > 200) return odpowiedz({ ok: false, error: 'Hasło musi mieć co najmniej 8 znaków.', code: 'password' }, 422);
      u.rola = 'klient'; u.account = true; u.authVersion = 1; u.passwordHash = await hashPassword(password); u.data = new Date().toISOString();
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      if (items.some((x) => (x.email || '').toLowerCase() === u.email)) {
        return odpowiedz({ ok: false, error: 'Konto z tym adresem już istnieje.', code: 'exists' }, 409);
      }
      items.push(u);
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      const user = publicUser(u);
      return odpowiedz({ ok: true, stored: true, authenticated: true, user }, 200, accountSessionHeaders(createAccountSession(u)));
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
      if (u.rola === 'admin') return beginAdminMfa(u, items);
      const user = publicUser(u);
      return odpowiedz({ ok: true, authenticated: true, user }, 200, accountSessionHeaders(createAccountSession(u)));
    }

    if (action === 'account-session') {
      if (req.method !== 'GET' && req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = requestSession(req);
      if (!session?.account) return odpowiedz({ ok: false, authenticated: false, error: 'Sesja wygasła lub uprawnienia konta zostały zmienione.', code: 'auth' }, 401);
      return odpowiedz({ ok: true, authenticated: true, user: publicUser(session.account), expiresAt: new Date(session.exp).toISOString() });
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
      u.authVersion = Math.max(0, Number(u.authVersion) || 0) + 1;
      delete u.hash;
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      const user = publicUser(u);
      return odpowiedz({ ok: true, changed: true, authenticated: true, user }, 200, accountSessionHeaders(createAccountSession(u)));
    }

    if (action === 'account-security-settings') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = requestSession(req);
      if (!session || session.role !== 'admin') return odpowiedz({ ok: false, error: 'Zaloguj się ponownie jako administrator.', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const idleTimeoutMinutes = Number(body.idleTimeoutMinutes);
      if (![15, 30, 60, 120, 240, 480].includes(idleTimeoutMinutes)) {
        return odpowiedz({ ok: false, error: 'Wybierz dozwolony czas bezczynności.' }, 422);
      }
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const admin = items.find((entry) => String(entry?.email || '').trim().toLowerCase() === session.email && entry.rola === 'admin');
      if (!admin) return odpowiedz({ ok: false, error: 'Konto administratora nie istnieje.', code: 'auth' }, 401);
      admin.adminIdleTimeoutMinutes = idleTimeoutMinutes;
      admin.securitySettingsUpdatedAt = new Date().toISOString();
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      const user = publicUser(admin);
      return odpowiedz({ ok: true, saved: true, authenticated: true, user }, 200, accountSessionHeaders(createAccountSession(admin)));
    }

    // ─── logowanie tokenem (sprawdzenie hasła administratora) ───
    if (action === 'login') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = ograniczRuch(req, 'admin-login', 6, 15 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const podane = tekst(body.password || body.token, 500);
      const email = tekst(process.env.ARTWAY_ADMIN_EMAIL || 'artwaytm@gmail.com', 200).trim().toLowerCase();
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      let admin = items.find((entry) => String(entry?.email || '').trim().toLowerCase() === email);
      const hashedOk = admin?.passwordHash ? await verifyPassword(podane, admin.passwordHash).catch(() => false) : false;
      const legacySecret = String(process.env.ARTWAY_ADMIN_TOKEN || '');
      const migrationOk = !admin?.passwordHash && !!legacySecret && bezpiecznePorownanie(podane, legacySecret);
      if (!hashedOk && !migrationOk) return odpowiedz({ ok: false, error: 'Nieprawidłowy e-mail lub hasło administratora.', code: 'auth' }, 401);
      if (!admin) {
        admin = { email, imie: 'Administrator', rola: 'admin', account: true };
        items.push(admin);
      }
      if (migrationOk) admin.passwordHash = await hashPassword(podane);
      admin.rola = 'admin'; admin.account = true; admin.authMigratedAt = admin.authMigratedAt || new Date().toISOString();
      if (migrationOk) await zapisz('users', { items, updated_at: new Date().toISOString() });
      return beginAdminMfa(admin, items);
    }

    if (action === 'login-mfa') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = ograniczRuch(req, 'admin-login-mfa', 8, 15 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const challenge = verifyAdminMfaChallenge(tekst(body.challengeToken, 2000));
      if (!challenge) return odpowiedz({ ok: false, error: 'Kod logowania wygasł. Zaloguj się ponownie hasłem.', code: 'mfa_challenge' }, 401);
      const rec = await czytaj('users', { items: [] }), items = Array.isArray(rec.items) ? rec.items : [];
      const admin = items.find((entry) => String(entry?.email || '').trim().toLowerCase() === challenge.email && entry.rola === 'admin');
      if (!admin) return odpowiedz({ ok: false, error: 'Konto administratora nie istnieje.', code: 'auth' }, 401);
      const secret = decryptMfaSecret(challenge.setup ? admin.mfaPendingSecretEncrypted : admin.mfaSecretEncrypted);
      const supplied = tekst(body.code, 100).trim();
      const verified = verifyMfaCode(secret, supplied);
      if (!verified) return odpowiedz({ ok: false, error: 'Kod z Google Authenticator jest nieprawidłowy.', code: 'mfa_code' }, 401);
      if (challenge.setup) {
        admin.mfaSecretEncrypted = admin.mfaPendingSecretEncrypted;
        delete admin.mfaPendingSecretEncrypted; delete admin.mfaPendingCreatedAt;
        admin.mfaEnabledAt = new Date().toISOString();
      }
      delete admin.mfaRecoveryCodeHashes;
      admin.lastLoginAt = new Date().toISOString();
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      const user = publicUser(admin);
      return odpowiedz({ ok: true, authenticated: true, user }, 200, accountSessionHeaders(createAccountSession(admin)));
    }

    if (action === 'login-mfa-email-request') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = ograniczRuch(req, 'admin-login-mfa-email-request', 3, 15 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const challenge = verifyAdminMfaChallenge(tekst(body.challengeToken, 2000));
      if (!challenge || challenge.setup) return odpowiedz({ ok: false, error: 'Zaloguj się ponownie hasłem, aby otrzymać kod e-mail.', code: 'mfa_challenge' }, 401);
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const admin = items.find((entry) => String(entry?.email || '').trim().toLowerCase() === challenge.email && entry.rola === 'admin');
      if (!admin?.mfaSecretEncrypted) return odpowiedz({ ok: false, error: 'Dla tego konta nie skonfigurowano Google Authenticator.', code: 'mfa_not_configured' }, 409);
      if (typeof wyslijEmailSMTP !== 'function') return odpowiedz({ ok: false, error: 'Odzyskiwanie przez e-mail nie jest obecnie dostępne.', code: 'email_unavailable' }, 503);
      const recovery = createMfaEmailRecovery(admin.email);
      admin.mfaEmailRecoveryCodeHash = recovery.codeHash;
      admin.mfaEmailRecoveryNonce = recovery.nonce;
      admin.mfaEmailRecoveryExpiresAt = recovery.expiresAt;
      admin.mfaEmailRecoveryRequestedAt = new Date().toISOString();
      admin.mfaEmailRecoveryFailedAttempts = 0;
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      try {
        await wyslijEmailSMTP({
          to: admin.email,
          subject: 'Kod odzyskania dostępu do panelu Artway-TM',
          text: `Kod odzyskania dostępu do panelu administratora Artway-TM: ${recovery.code}\n\nKod jest ważny przez 10 minut. Jeśli to nie Ty próbujesz się zalogować, nie przekazuj nikomu kodu i zmień hasło do konta.`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><h2 style="margin:0 0 12px">Artway‑TM — odzyskanie dostępu</h2><p>Wpisz poniższy kod na ekranie logowania administratora:</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;padding:18px;text-align:center;background:#f2f5ff;border-radius:14px">${recovery.code}</div><p style="color:#667085">Kod jest ważny przez 10 minut i służy wyłącznie do jednego logowania. Jeśli to nie Ty, nie udostępniaj go nikomu i zmień hasło.</p></div>`,
        });
      } catch (error) {
        delete admin.mfaEmailRecoveryCodeHash; delete admin.mfaEmailRecoveryNonce; delete admin.mfaEmailRecoveryExpiresAt;
        await zapisz('users', { items, updated_at: new Date().toISOString() }).catch(() => {});
        return odpowiedz({ ok: false, error: 'Nie udało się wysłać kodu. Sprawdź połączenie poczty i spróbuj ponownie.', code: 'email_send_failed' }, 503);
      }
      const [local, domain = ''] = String(admin.email).split('@');
      const maskedEmail = `${local.slice(0, 2)}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
      return odpowiedz({ ok: true, sent: true, maskedEmail, recoveryChallengeToken: recovery.challengeToken, expiresInMinutes: 10 });
    }

    if (action === 'login-mfa-email-verify') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const limited = ograniczRuch(req, 'admin-login-mfa-email-verify', 8, 15 * 60 * 1000);
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      const challenge = verifyMfaEmailRecoveryChallenge(tekst(body.recoveryChallengeToken, 2000));
      if (!challenge) return odpowiedz({ ok: false, error: 'Kod e-mail wygasł. Wyślij nowy kod.', code: 'mfa_email_challenge' }, 401);
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const admin = items.find((entry) => String(entry?.email || '').trim().toLowerCase() === challenge.email && entry.rola === 'admin');
      const notExpired = admin?.mfaEmailRecoveryExpiresAt && Date.now() < Date.parse(admin.mfaEmailRecoveryExpiresAt);
      const nonceMatches = !!admin?.mfaEmailRecoveryNonce && admin.mfaEmailRecoveryNonce === challenge.nonce;
      const codeMatches = notExpired && nonceMatches && verifyMfaEmailRecoveryCode(admin.email, tekst(body.code, 20), admin.mfaEmailRecoveryCodeHash);
      if (!codeMatches) {
        if (admin) {
          admin.mfaEmailRecoveryFailedAttempts = Math.max(0, Number(admin.mfaEmailRecoveryFailedAttempts) || 0) + 1;
          if (admin.mfaEmailRecoveryFailedAttempts >= 5) {
            delete admin.mfaEmailRecoveryCodeHash; delete admin.mfaEmailRecoveryNonce; delete admin.mfaEmailRecoveryExpiresAt;
          }
          await zapisz('users', { items, updated_at: new Date().toISOString() });
        }
        return odpowiedz({ ok: false, error: 'Kod e-mail jest nieprawidłowy albo wygasł.', code: 'mfa_email_code' }, 401);
      }
      delete admin.mfaEmailRecoveryCodeHash; delete admin.mfaEmailRecoveryNonce; delete admin.mfaEmailRecoveryExpiresAt; delete admin.mfaEmailRecoveryFailedAttempts;
      delete admin.mfaRecoveryCodeHashes;
      admin.mfaEmailRecoveryUsedAt = new Date().toISOString();
      admin.lastLoginAt = admin.mfaEmailRecoveryUsedAt;
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      const user = publicUser(admin);
      return odpowiedz({ ok: true, authenticated: true, user }, 200, accountSessionHeaders(createAccountSession(admin)));
    }

    return null;
  };
}
