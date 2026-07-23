const REQUIRED_CREDENTIAL_ENV = Object.freeze([
  'INPOST_VON_HALSKY_API_BASE_URL',
  'INPOST_VON_HALSKY_AUTH_URL',
  'INPOST_VON_HALSKY_CLIENT_ID',
  'INPOST_VON_HALSKY_CLIENT_SECRET',
  'INPOST_VON_HALSKY_MERCHANT_ID',
]);

const REQUIRED_CONTRACT_ENV = Object.freeze([
  'INPOST_VON_HALSKY_HEALTH_PATH',
  'INPOST_VON_HALSKY_CATALOG_PATH',
  'INPOST_VON_HALSKY_ORDERS_PATH',
  'INPOST_VON_HALSKY_CONTRACT_VERSION',
]);

function text(value, max = 4000) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function safeUrl(value, label) {
  let parsed;
  try { parsed = new URL(text(value, 2000)); } catch {
    const error = new Error(`${label} nie jest poprawnym adresem URL.`);
    error.code = 'von_halsky_invalid_url';
    error.status = 503;
    throw error;
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !local) {
    const error = new Error(`${label} musi używać HTTPS.`);
    error.code = 'von_halsky_https_required';
    error.status = 503;
    throw error;
  }
  parsed.hash = '';
  return parsed;
}

function endpoint(base, path, label) {
  const value = text(path, 1000);
  if (!value) {
    const error = new Error(`Brak ścieżki ${label} z prywatnej dokumentacji InPost.`);
    error.code = 'von_halsky_contract_missing';
    error.status = 503;
    throw error;
  }
  return new URL(value, base);
}

function publicMissing(env = {}) {
  const missingCredentials = REQUIRED_CREDENTIAL_ENV.filter((key) => !text(env?.[key]));
  const missingContract = REQUIRED_CONTRACT_ENV.filter((key) => !text(env?.[key]));
  return { missingCredentials, missingContract, missingEnv: [...missingCredentials, ...missingContract] };
}

export function vonHalskyPublicApiConfig(env = process.env) {
  const missing = publicMissing(env);
  const configured = missing.missingEnv.length === 0;
  return {
    configured,
    credentialsConfigured: missing.missingCredentials.length === 0,
    contractConfigured: missing.missingContract.length === 0,
    webhookConfigured: Boolean(text(env?.INPOST_VON_HALSKY_WEBHOOK_SECRET)),
    merchantConfigured: Boolean(text(env?.INPOST_VON_HALSKY_MERCHANT_ID)),
    apiBaseConfigured: Boolean(text(env?.INPOST_VON_HALSKY_API_BASE_URL)),
    missingCredentialsEnv: missing.missingCredentials,
    missingContractEnv: missing.missingContract,
    missingEnv: missing.missingEnv,
    contractVersion: text(env?.INPOST_VON_HALSKY_CONTRACT_VERSION, 80),
    environment: text(env?.INPOST_VON_HALSKY_ENVIRONMENT, 30) || 'production',
    documentationPrivate: true,
  };
}

export function vonHalskyPrivateApiConfig(env = process.env) {
  const publicConfig = vonHalskyPublicApiConfig(env);
  if (!publicConfig.configured) {
    const error = new Error('Kontrakt API InPost Von Halsky nie jest kompletny.');
    error.code = 'von_halsky_not_configured';
    error.status = 503;
    error.publicConfig = publicConfig;
    throw error;
  }
  const apiBaseUrl = safeUrl(env.INPOST_VON_HALSKY_API_BASE_URL, 'Adres API Von Halsky');
  const authUrl = safeUrl(env.INPOST_VON_HALSKY_AUTH_URL, 'Adres autoryzacji Von Halsky');
  const authStyle = text(env.INPOST_VON_HALSKY_AUTH_STYLE, 40) || 'client_secret_post';
  if (!['client_secret_post', 'client_secret_basic'].includes(authStyle)) {
    const error = new Error('Nieobsługiwany tryb autoryzacji Von Halsky.');
    error.code = 'von_halsky_auth_style';
    error.status = 503;
    throw error;
  }
  return {
    ...publicConfig,
    apiBaseUrl,
    authUrl,
    authStyle,
    clientId: text(env.INPOST_VON_HALSKY_CLIENT_ID, 1000),
    clientSecret: text(env.INPOST_VON_HALSKY_CLIENT_SECRET, 4000),
    merchantId: text(env.INPOST_VON_HALSKY_MERCHANT_ID, 500),
    scope: text(env.INPOST_VON_HALSKY_SCOPE, 1000),
    merchantHeader: text(env.INPOST_VON_HALSKY_MERCHANT_HEADER, 120) || 'X-Merchant-Id',
    healthUrl: endpoint(apiBaseUrl, env.INPOST_VON_HALSKY_HEALTH_PATH, 'testu połączenia'),
    catalogUrl: endpoint(apiBaseUrl, env.INPOST_VON_HALSKY_CATALOG_PATH, 'katalogu'),
    ordersUrl: endpoint(apiBaseUrl, env.INPOST_VON_HALSKY_ORDERS_PATH, 'zamówień'),
  };
}

function apiError(message, { status = 502, code = 'von_halsky_api_error', details = null } = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details !== null) error.details = details;
  return error;
}

async function responsePayload(response) {
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  const raw = (await response.text()).slice(0, 2_000_000);
  if (!raw) return {};
  if (type.includes('json')) {
    try { return JSON.parse(raw); } catch {
      throw apiError('API Von Halsky zwróciło niepoprawny JSON.', { code: 'von_halsky_invalid_json' });
    }
  }
  return { message: raw.slice(0, 1000) };
}

export function createVonHalskyApiClient({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  randomId = () => globalThis.crypto?.randomUUID?.() || `vh-${Date.now()}-${Math.random().toString(16).slice(2)}`,
} = {}) {
  let tokenCache = null;

  async function fetchWithTimeout(url, options = {}, timeoutMs = 15_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetchImpl(url, { ...options, signal: controller.signal }); }
    catch (error) {
      if (error?.name === 'AbortError') throw apiError('API Von Halsky nie odpowiedziało w wymaganym czasie.', { code: 'von_halsky_timeout', status: 504 });
      throw apiError('Nie udało się połączyć z API Von Halsky.', { details: String(error?.message || error) });
    } finally { clearTimeout(timer); }
  }

  async function token(config) {
    if (tokenCache?.value && tokenCache.expiresAt - 30_000 > now()) return tokenCache.value;
    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    if (config.scope) body.set('scope', config.scope);
    const headers = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
    if (config.authStyle === 'client_secret_basic') {
      headers.authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;
    } else {
      body.set('client_id', config.clientId);
      body.set('client_secret', config.clientSecret);
    }
    const response = await fetchWithTimeout(config.authUrl, { method: 'POST', headers, body });
    const payload = await responsePayload(response);
    if (!response.ok || !text(payload?.access_token)) {
      throw apiError('InPost odrzucił autoryzację Von Halsky.', {
        status: response.status === 401 || response.status === 403 ? 502 : response.status,
        code: 'von_halsky_auth_failed',
        details: { httpStatus: response.status, providerCode: text(payload?.code || payload?.error, 120) },
      });
    }
    const expiresIn = Math.max(60, Math.min(86_400, Number(payload.expires_in) || 3600));
    tokenCache = { value: text(payload.access_token, 8000), expiresAt: now() + expiresIn * 1000 };
    return tokenCache.value;
  }

  async function request(url, { method = 'GET', body, idempotent = false } = {}) {
    const config = vonHalskyPrivateApiConfig(env);
    const accessToken = await token(config);
    const headers = {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      [config.merchantHeader]: config.merchantId,
      'user-agent': 'Artway-TM-Von-Halsky/1.0',
    };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (idempotent) headers['idempotency-key'] = randomId();
    const attempts = method === 'GET' ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const response = await fetchWithTimeout(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const payload = await responsePayload(response);
      if (response.ok) return { payload, status: response.status, requestId: text(response.headers.get('x-request-id'), 240) };
      const retryable = method === 'GET' && (response.status === 429 || response.status >= 500);
      if (retryable && attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      throw apiError(text(payload?.message || payload?.error_description || payload?.error, 600) || `API Von Halsky zwróciło HTTP ${response.status}.`, {
        status: response.status === 401 || response.status === 403 ? 502 : response.status,
        code: 'von_halsky_provider_error',
        details: { httpStatus: response.status, providerCode: text(payload?.code || payload?.error, 120) },
      });
    }
    throw apiError('Nie udało się wykonać żądania do API Von Halsky.');
  }

  return {
    publicConfig: () => vonHalskyPublicApiConfig(env),
    async checkConnection() {
      const config = vonHalskyPrivateApiConfig(env);
      const result = await request(config.healthUrl);
      return { connected: true, httpStatus: result.status, requestId: result.requestId, checkedAt: new Date(now()).toISOString() };
    },
    async pushCatalog(payload) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(config.catalogUrl, { method: 'POST', body: payload, idempotent: true });
    },
    async fetchOrders({ cursor = '', updatedSince = '' } = {}) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = new URL(config.ordersUrl);
      if (cursor) url.searchParams.set('cursor', text(cursor, 1000));
      if (updatedSince) url.searchParams.set('updatedSince', text(updatedSince, 100));
      return request(url);
    },
  };
}
