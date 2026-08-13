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
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return new URL(value);
  const normalizedBase = new URL(base);
  if (!normalizedBase.pathname.endsWith('/')) normalizedBase.pathname += '/';
  return new URL(value.replace(/^\/+/, ''), normalizedBase);
}

function relatedEndpoint(url, suffix = '') {
  const result = new URL(url);
  result.pathname = `${result.pathname.replace(/\/batch\/?$/, '').replace(/\/$/, '')}${suffix}`;
  result.search = '';
  return result;
}

function childEndpoint(url, ...segments) {
  const result = new URL(url);
  result.pathname = [
    result.pathname.replace(/\/$/, ''),
    ...segments.map((segment) => encodeURIComponent(text(segment, 240))),
  ].join('/');
  result.search = '';
  return result;
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
    webhookSupported: false,
    webhookConfigured: false,
    eventFeedConfigured: configured,
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
  const catalogUrl = endpoint(apiBaseUrl, env.INPOST_VON_HALSKY_CATALOG_PATH, 'katalogu');
  const organizationUrl = endpoint(
    apiBaseUrl,
    `/v1/organizations/${encodeURIComponent(text(env.INPOST_VON_HALSKY_MERCHANT_ID, 500))}`,
    'organizacji',
  );
  return {
    ...publicConfig,
    apiBaseUrl,
    authUrl,
    authStyle,
    clientId: text(env.INPOST_VON_HALSKY_CLIENT_ID, 1000),
    clientSecret: text(env.INPOST_VON_HALSKY_CLIENT_SECRET, 4000),
    merchantId: text(env.INPOST_VON_HALSKY_MERCHANT_ID, 500),
    scope: text(env.INPOST_VON_HALSKY_SCOPE, 1000),
    merchantHeader: text(env.INPOST_VON_HALSKY_MERCHANT_HEADER, 120),
    healthUrl: endpoint(apiBaseUrl, env.INPOST_VON_HALSKY_HEALTH_PATH, 'testu połączenia'),
    catalogUrl,
    offersUrl: relatedEndpoint(catalogUrl),
    offerPricesUrl: relatedEndpoint(catalogUrl, '/prices'),
    offerStocksUrl: relatedEndpoint(catalogUrl, '/stocks'),
    categoriesUrl: endpoint(apiBaseUrl, '/v1/categories', 'kategorii'),
    ordersUrl: endpoint(apiBaseUrl, env.INPOST_VON_HALSKY_ORDERS_PATH, 'zamówień'),
    organizationUrl,
    returnsUrl: childEndpoint(organizationUrl, 'returns'),
    claimsUrl: childEndpoint(organizationUrl, 'claims'),
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

function retryDelayMs(response, attempt) {
  const raw = text(response.headers.get('retry-after'), 80);
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Math.min(30_000, Math.max(250, Number(raw) * 1000));
  const date = Date.parse(raw);
  if (Number.isFinite(date)) return Math.min(30_000, Math.max(250, date - Date.now()));
  return Math.min(5000, 350 * (2 ** attempt));
}

export function createVonHalskyApiClient({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  randomId = () => globalThis.crypto?.randomUUID?.() || `vh-${Date.now()}-${Math.random().toString(16).slice(2)}`,
} = {}) {
  let tokenCache = null;

  async function fetchWithTimeout(url, options = {}, timeoutMs = 15_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetchImpl(url, { ...options, signal: controller.signal }); }
    catch (error) {
      if (error?.name === 'AbortError') throw apiError('API Von Halsky nie odpowiedziało w wymaganym czasie.', { code: 'von_halsky_timeout', status: 504 });
      throw apiError('Nie udało się połączyć z API Von Halsky.', { details: { reason: text(error?.message || error, 300) } });
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

  async function request(url, {
    method = 'GET',
    body,
    idempotent = false,
    timeoutMs = 15_000,
    contentType = 'application/json',
  } = {}) {
    const config = vonHalskyPrivateApiConfig(env);
    const accessToken = await token(config);
    const headers = {
      accept: 'application/json',
      'accept-language': 'pl',
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'Artway-TM-Von-Halsky/1.5.8',
    };
    if (config.merchantHeader) headers[config.merchantHeader] = config.merchantId;
    if (body !== undefined) headers['content-type'] = contentType;
    if (idempotent) headers['idempotency-key'] = randomId();
    const attempts = method === 'GET' || idempotent ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const response = await fetchWithTimeout(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, timeoutMs);
      const payload = await responsePayload(response);
      const requestId = text(response.headers.get('x-request-id') || response.headers.get('x-correlation-id'), 240);
      const rateLimit = {
        limit: Number(response.headers.get('x-ratelimit-limit')) || null,
        remaining: Number(response.headers.get('x-ratelimit-remaining')) || null,
        reset: text(response.headers.get('x-ratelimit-reset'), 80) || null,
      };
      if (response.ok) return { payload, status: response.status, requestId, rateLimit };
      const retryable = (method === 'GET' || idempotent) && (response.status === 429 || response.status >= 500);
      if (retryable && attempt + 1 < attempts) {
        await wait(retryDelayMs(response, attempt));
        continue;
      }
      throw apiError(text(payload?.message || payload?.errorMessage || payload?.error_description || payload?.error, 600) || `API Von Halsky zwróciło HTTP ${response.status}.`, {
        status: response.status === 401 || response.status === 403 ? 502 : response.status,
        code: 'von_halsky_provider_error',
        details: {
          httpStatus: response.status,
          providerCode: text(payload?.code || payload?.errorCode || payload?.error, 120),
          requestId,
          rateLimit,
        },
      });
    }
    throw apiError('Nie udało się wykonać żądania do API Von Halsky.');
  }

  async function listPaged(url, { limit = 30, offset = 0, maxPages = 200 } = {}) {
    const data = [];
    let page = { limit, offset, total: 0 };
    let requestId = '', rateLimit = null;
    for (let index = 0; index < maxPages; index++) {
      const current = new URL(url);
      current.searchParams.set('limit', String(Math.max(1, Math.min(30, Number(limit) || 30))));
      current.searchParams.set('offset', String(Math.max(0, Number(page.offset) || 0)));
      current.searchParams.append('sort', '-updatedAt');
      const result = await request(current);
      requestId = result.requestId || requestId;
      rateLimit = result.rateLimit || rateLimit;
      const rows = Array.isArray(result.payload?.data) ? result.payload.data : [];
      data.push(...rows);
      page = result.payload?.page || { limit, offset: page.offset, total: data.length };
      const nextOffset = Number(page.offset || 0) + Math.max(1, Number(page.limit) || limit);
      if (!rows.length || nextOffset >= Number(page.total || data.length)) break;
      page = { ...page, offset: nextOffset };
    }
    return { data, page: { ...page, total: Math.max(Number(page.total) || 0, data.length) }, requestId, rateLimit };
  }

  return {
    publicConfig: () => vonHalskyPublicApiConfig(env),
    async checkConnection() {
      const config = vonHalskyPrivateApiConfig(env);
      const result = await request(config.healthUrl);
      return { connected: true, httpStatus: result.status, requestId: result.requestId, rateLimit: result.rateLimit, checkedAt: new Date(now()).toISOString() };
    },
    async fetchCategories({ categoryId = '', depth = 0 } = {}) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = categoryId ? new URL(`${config.categoriesUrl.pathname.replace(/\/$/, '')}/${encodeURIComponent(text(categoryId, 80))}`, config.categoriesUrl) : new URL(config.categoriesUrl);
      if (!categoryId) url.searchParams.set('depth', String(Math.max(0, Math.min(10, Number(depth) || 0))));
      return request(url);
    },
    async fetchCategoryAttributes(categoryId) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(new URL(`${config.categoriesUrl.pathname.replace(/\/$/, '')}/${encodeURIComponent(text(categoryId, 80))}/attributes`, config.categoriesUrl));
    },
    async listOffers(options = {}) {
      const config = vonHalskyPrivateApiConfig(env);
      return listPaged(config.offersUrl, options);
    },
    async createOffers(items = []) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(config.catalogUrl, { method: 'POST', body: items, idempotent: true, timeoutMs: 30_000 });
    },
    async updateOffer(offerId, patch) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = new URL(`${config.offersUrl.pathname.replace(/\/$/, '')}/${encodeURIComponent(text(offerId, 80))}`, config.offersUrl);
      // Kontrakt 1.5.8 deklaruje dla pojedynczej oferty:
      // Accept-Patch: application/merge-patch+json. Zwykłe application/json
      // kończy się HTTP 415, mimo że endpointy zbiorczych cen i stanów
      // akceptują JSON.
      return request(url, {
        method: 'PATCH',
        body: patch,
        contentType: 'application/merge-patch+json',
        idempotent: true,
        timeoutMs: 30_000,
      });
    },
    async getOffer(offerId) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.offersUrl, offerId));
    },
    async updateOfferAttributes(offerId, attributes = {}) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.offersUrl, offerId, 'attributes'), {
        method: 'PATCH', body: attributes, idempotent: true, timeoutMs: 30_000,
      });
    },
    async updatePrices(items = []) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(config.offerPricesUrl, { method: 'PATCH', body: items, idempotent: true });
    },
    async updateStocks(items = []) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(config.offerStocksUrl, { method: 'PATCH', body: items, idempotent: true });
    },
    async setOfferOpen(offerId, open) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = new URL(`${config.offersUrl.pathname.replace(/\/$/, '')}/${encodeURIComponent(text(offerId, 80))}/${open ? 'reopen' : 'close'}`, config.offersUrl);
      return request(url, { method: 'POST', idempotent: true });
    },
    async getOfferCommand(commandId) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.offersUrl, 'commands', commandId));
    },
    async fetchOfferEvents({ offset = 0, limit = 30, occurredAtGte = '' } = {}) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = childEndpoint(config.offersUrl, 'events');
      url.searchParams.set('limit', String(Math.max(1, Math.min(30, Number(limit) || 30))));
      url.searchParams.set('offset', String(Math.max(0, Number(offset) || 0)));
      if (occurredAtGte) url.searchParams.set('occurredAtGte', text(occurredAtGte, 100));
      return request(url);
    },
    async getOfferHint(query = {}) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = childEndpoint(config.offersUrl, 'hint');
      for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined && value !== null && text(value, 1000)) url.searchParams.set(text(key, 80), text(value, 1000));
      }
      return request(url);
    },
    async listOfferAttachments(offerId) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.offersUrl, offerId, 'attachments'));
    },
    async deleteOfferAttachment(offerId, attachmentId) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.offersUrl, offerId, 'attachments', attachmentId), {
        method: 'DELETE', idempotent: true,
      });
    },
    async fetchOrders({ offset = 0, limit = 30, updatedSince = '', orderStatus = [], paymentStatus = [] } = {}) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = new URL(config.ordersUrl);
      url.searchParams.set('limit', String(Math.max(1, Math.min(30, Number(limit) || 30))));
      url.searchParams.set('offset', String(Math.max(0, Number(offset) || 0)));
      url.searchParams.append('sort', '-updatedAt');
      if (updatedSince) url.searchParams.set('updatedAtGte', text(updatedSince, 100));
      for (const status of Array.isArray(orderStatus) ? orderStatus : []) url.searchParams.append('orderStatus', text(status, 30));
      for (const status of Array.isArray(paymentStatus) ? paymentStatus : []) url.searchParams.append('paymentStatus', text(status, 30));
      return request(url);
    },
    async getOrder(orderId) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.ordersUrl, orderId));
    },
    async setOrderAccepted(orderId, accepted) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = new URL(`${config.ordersUrl.pathname.replace(/\/$/, '')}/${encodeURIComponent(text(orderId, 160))}/${accepted ? 'accept' : 'refuse'}`, config.ordersUrl);
      return request(url, { method: 'POST', idempotent: true });
    },
    async getOrderCommand(commandId) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.ordersUrl, 'commands', commandId));
    },
    async fetchOrderEvents({ offset = 0, limit = 30, occurredAtGte = '' } = {}) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = childEndpoint(config.ordersUrl, 'events');
      url.searchParams.set('limit', String(Math.max(1, Math.min(30, Number(limit) || 30))));
      url.searchParams.set('offset', String(Math.max(0, Number(offset) || 0)));
      if (occurredAtGte) url.searchParams.set('occurredAtGte', text(occurredAtGte, 100));
      return request(url);
    },
    async fetchReturns({ offset = 0, limit = 30 } = {}) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = new URL(config.returnsUrl);
      url.searchParams.set('limit', String(Math.max(1, Math.min(30, Number(limit) || 30))));
      url.searchParams.set('offset', String(Math.max(0, Number(offset) || 0)));
      return request(url);
    },
    async getReturn(returnId) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.returnsUrl, returnId));
    },
    async decideReturn(returnId, accepted) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.returnsUrl, returnId, accepted ? 'accept' : 'reject'), {
        method: 'POST', idempotent: true,
      });
    },
    async fetchOrderReturns(orderId) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.ordersUrl, orderId, 'returns'));
    },
    async refundOrder(orderId, amount) {
      const config = vonHalskyPrivateApiConfig(env);
      const numeric = Number(amount);
      if (!Number.isFinite(numeric) || numeric <= 0) throw apiError('Kwota refundacji musi być większa od zera.', {
        status: 422, code: 'von_halsky_invalid_refund_amount',
      });
      return request(childEndpoint(config.ordersUrl, orderId, 'refund'), {
        method: 'POST',
        body: { amount: { amount: Math.round(numeric * 100) / 100, currency: 'PLN' } },
        idempotent: true,
      });
    },
    async fetchClaims({ offset = 0, limit = 30, state = [] } = {}) {
      const config = vonHalskyPrivateApiConfig(env);
      const url = new URL(config.claimsUrl);
      url.searchParams.set('limit', String(Math.max(1, Math.min(30, Number(limit) || 30))));
      url.searchParams.set('offset', String(Math.max(0, Number(offset) || 0)));
      for (const value of Array.isArray(state) ? state : []) url.searchParams.append('state', text(value, 60));
      return request(url);
    },
    async getClaim(orderId, claimId) {
      const config = vonHalskyPrivateApiConfig(env);
      return request(childEndpoint(config.ordersUrl, orderId, 'claims', claimId));
    },
    async resolveClaim(orderId, claimId, resolution, description = '') {
      const config = vonHalskyPrivateApiConfig(env);
      const allowed = new Map([
        ['reject', 'reject'],
        ['partial-refund', 'partial-refund'],
        ['refund', 'refund'],
      ]);
      const action = allowed.get(text(resolution, 40));
      if (!action) throw apiError('Nieobsługiwany sposób rozstrzygnięcia reklamacji.', {
        status: 422, code: 'von_halsky_invalid_claim_resolution',
      });
      return request(childEndpoint(config.ordersUrl, orderId, 'claims', claimId, action), {
        method: 'POST',
        body: { description: text(description, 1000) },
        idempotent: true,
      });
    },
  };
}
