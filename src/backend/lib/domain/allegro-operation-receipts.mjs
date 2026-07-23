const STORE_KEY = 'allegro_operation_receipts';
const RUNNING_TTL_MS = 5 * 60_000;

function safeText(value, limit = 1000) {
  return String(value ?? '').slice(0, limit).trim();
}

function operationError(message, code, status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function allegroCredentialLooksMasked(value = '') {
  const credential = String(value || '').trim();
  return !credential
    || /[*•●]{3,}/u.test(credential)
    || /^(?:masked|redacted|ukryty|zamaskowan|hidden|placeholder)(?:[-_: ]|$)/i.test(credential);
}

export function buildAllegroConnectionStatus({ configuration, auth = {}, requiredScope = '', recommendedScope = '', text = safeText, nowMs = Date.now() }) {
  const required = String(requiredScope || '').split(/\s+/).filter(Boolean);
  const authorized = String(auth?.scope || '').split(/\s+/).filter(Boolean);
  const missingAuthorizedScopes = authorized.length ? required.filter((scope) => !authorized.includes(scope)) : [];
  const authError = auth?.last_error && typeof auth.last_error === 'object' ? auth.last_error : null;
  const authErrorCode = text(authError?.code || '', 120);
  const tokenFresh = !!auth?.access_token && Number(auth.expires_at || 0) > nowMs + 30_000;
  const blockingAuthError = ['invalid_client', 'invalid_grant', 'unauthorized_client', 'allegro_not_connected'].includes(authErrorCode);
  const connected = tokenFresh || (!!auth?.refresh_token && !blockingAuthError);
  return {
    configured: configuration.configured,
    credentialsRedacted: configuration.credentialsRedacted === true,
    connected,
    connectionHealthy: connected && !authErrorCode,
    credentialsInvalid: authErrorCode === 'invalid_client',
    authError: authErrorCode ? { code: authErrorCode, message: text(authError?.message || 'Połączenie Allegro wymaga naprawy.', 500), at: authError?.at || null } : null,
    env: configuration.env,
    redirectUri: configuration.redirectUri,
    missingEnv: configuration.missingEnv,
    invalidEnv: Array.isArray(configuration.invalidEnv) ? configuration.invalidEnv : [],
    expires_at: auth?.expires_at || null,
    account: auth?.account || '',
    updated_at: auth?.updated_at || null,
    requiredEnv: ['ALLEGRO_CLIENT_ID', 'ALLEGRO_CLIENT_SECRET'],
    scope: requiredScope,
    authorizedScope: auth?.scope || '',
    missingAuthorizedScopes,
    requiresReauth: missingAuthorizedScopes.length > 0 || blockingAuthError,
    recommendedScope,
    optionalEnv: ['ALLEGRO_REDIRECT_URI', 'ALLEGRO_ENV=production', 'ALLEGRO_SCOPE'],
  };
}

export async function persistAllegroRefreshFailure({ auth = {}, error, write, text = safeText, now = () => new Date() }) {
  const at = now().toISOString();
  const code = text(error?.code || 'allegro_oauth_error', 120);
  await write('allegro_auth', { ...auth, last_error: { code, message: text(error?.message || error, 500), at }, connection_status: 'reauth_required', updated_at: at });
  if (code !== 'invalid_client') return error;
  return operationError('Dane aplikacji Allegro są odrzucone (invalid_client). Zaktualizuj Client ID i Client Secret, a następnie połącz konto ponownie. Żadna oferta nie została zmieniona.', code, 401);
}

export function createAllegroTokenAccess({ configure, read, write, requestToken, text = safeText } = {}) {
  return async function accessToken(req) {
    const configuration = configure(req);
    if (!configuration.configured) {
      const error = operationError('Allegro API nie jest skonfigurowane. Ustaw ALLEGRO_CLIENT_ID i ALLEGRO_CLIENT_SECRET w panelu serwera.', 'allegro_not_configured', 503);
      error.missingEnv = configuration.missingEnv;
      throw error;
    }
    const auth = await read('allegro_auth', {});
    if (auth?.access_token && Number(auth.expires_at || 0) > Date.now() + 90_000) return auth.access_token;
    if (!auth?.refresh_token) throw operationError('Allegro nie jest autoryzowane. Kliknij „Połącz Allegro” w panelu admina.', 'allegro_not_connected', 401);
    let refreshed;
    try {
      refreshed = await requestToken(req, { grant_type: 'refresh_token', refresh_token: auth.refresh_token });
    } catch (error) {
      throw await persistAllegroRefreshFailure({ auth, error, write, text });
    }
    const next = { ...auth, ...refreshed, refresh_token: refreshed.refresh_token || auth.refresh_token, connection_status: 'active' };
    delete next.last_error;
    await write('allegro_auth', next);
    return next.access_token;
  };
}

export function createAllegroTokenRequester({ configure, errorText, fetchImpl = fetch } = {}) {
  return async function requestToken(req, params) {
    const configuration = configure(req);
    if (!configuration.configured) {
      const error = operationError('Allegro API nie jest skonfigurowane. Ustaw ALLEGRO_CLIENT_ID i ALLEGRO_CLIENT_SECRET w panelu serwera.', 'allegro_not_configured', 503);
      error.missingEnv = configuration.missingEnv;
      throw error;
    }
    const response = await fetchImpl(`${configuration.authBaseUrl}/auth/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${configuration.clientId}:${configuration.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'Artway-TM/1.0',
      },
      body: new URLSearchParams(params),
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) {
      const error = operationError(errorText(data, `Allegro OAuth HTTP ${response.status}`), data.error || 'allegro_oauth_error', response.status);
      error.allegro = data;
      throw error;
    }
    return { ...data, env: configuration.env, expires_at: Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000, updated_at: new Date().toISOString() };
  };
}

export function createAllegroOperationReceipts({ read, write, text = safeText, now = () => new Date() } = {}) {
  if (typeof read !== 'function' || typeof write !== 'function') throw new Error('Rejestr operacji Allegro wymaga repozytorium.');
  const timestamp = () => now().toISOString();
  const load = () => read(STORE_KEY, { items: {}, updated_at: null });
  const saveReceipt = async (operationId, transform) => {
    const record = await load();
    const items = { ...(record?.items || {}) };
    items[operationId] = transform(items[operationId] || {});
    const updated_at = timestamp();
    await write(STORE_KEY, { ...record, items, updated_at });
    return items[operationId];
  };

  function validate({ approval, productId }) {
    const operationId = text(approval?.operationId || '', 160);
    const requestProductId = text(productId || '', 100);
    if (!operationId) return null;
    const approvedProductId = text(approval?.productId || '', 100);
    if (approval?.approved !== true || !approvedProductId || approvedProductId !== requestProductId) {
      throw operationError('Zatwierdzenie Allegro nie odpowiada temu produktowi. Odśwież podgląd decyzji i zatwierdź ponownie.', 'allegro_approval_binding_invalid');
    }
    return Object.freeze({ operationId, productId: requestProductId, approval });
  }

  async function begin(handle, { action = 'keep', approvedBy = 'administrator' } = {}) {
    if (!handle) return { kind: 'disabled' };
    const record = await load();
    const existing = record?.items?.[handle.operationId];
    if (existing?.productId && String(existing.productId) !== handle.productId) {
      throw operationError('Identyfikator zatwierdzenia został już przypisany do innego produktu.', 'allegro_approval_reused');
    }
    if (existing?.status === 'completed' && existing.response) {
      return { kind: 'duplicate', response: { ...existing.response, duplicateApproval: true, operationId: handle.operationId }, httpStatus: Number(existing.httpStatus) || 200 };
    }
    const updatedAt = Date.parse(existing?.updatedAt || '');
    if (existing?.status === 'running' && Number.isFinite(updatedAt) && now().getTime() - updatedAt < RUNNING_TTL_MS) {
      throw operationError('Ta zatwierdzona operacja Allegro jest już wykonywana. Poczekaj na wynik zamiast uruchamiać ją ponownie.', 'allegro_approval_in_progress');
    }
    const startedAt = timestamp();
    await saveReceipt(handle.operationId, (current) => ({
      ...current,
      operationId: handle.operationId,
      productId: handle.productId,
      action: text(action, 60),
      status: 'running',
      attempts: Number(current?.attempts || 0) + 1,
      approvedAt: text(handle.approval?.approvedAt || startedAt, 40),
      approvedBy: text(approvedBy, 120) || 'administrator',
      startedAt,
      completedAt: null,
      updatedAt: startedAt,
      lastError: '',
      lastErrorCode: '',
    }));
    return { kind: 'started', operationId: handle.operationId };
  }

  async function fail(handle, error) {
    if (!handle) return null;
    const completedAt = timestamp();
    return saveReceipt(handle.operationId, (current) => ({
      ...current,
      status: 'failed',
      completedAt,
      updatedAt: completedAt,
      lastError: text(error?.message || error, 700),
      lastErrorCode: text(error?.code || 'allegro_operation_failed', 120),
    }));
  }

  async function complete(handle, { offerId = '', httpStatus = 200, response } = {}) {
    if (!handle) return null;
    const completedAt = timestamp();
    return saveReceipt(handle.operationId, (current) => ({
      ...current,
      status: 'completed',
      completedAt,
      updatedAt: completedAt,
      offerId: text(offerId, 100),
      httpStatus: Number(httpStatus) || 200,
      response,
      lastError: '',
      lastErrorCode: '',
    }));
  }

  return Object.freeze({ validate, begin, fail, complete });
}
