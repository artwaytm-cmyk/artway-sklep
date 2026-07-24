const safeText = (value, max = 300) => String(value ?? '').trim().slice(0, max);

function list(raw = {}, keys = []) {
  for (const key of keys) if (Array.isArray(raw?.[key])) return raw[key];
  return Array.isArray(raw) ? raw : [];
}

function firstId(items = []) {
  const item = (Array.isArray(items) ? items : []).find((entry) => safeText(entry?.id || entry?.uuid, 120));
  return safeText(item?.id || item?.uuid, 120);
}

function normalize(raw = {}) {
  return {
    shippingRates: list(raw.shippingRates, ['shippingRates', 'items', 'rates']).map((item) => ({ id: safeText(item.id, 120), name: safeText(item.name || item.label, 250) })).filter((item) => item.id),
    returnPolicies: list(raw.returnPolicies, ['returnPolicies', 'items', 'policies']).map((item) => ({ id: safeText(item.id, 120), name: safeText(item.name || item.label, 250) })).filter((item) => item.id),
    impliedWarranties: list(raw.impliedWarranties, ['impliedWarranties', 'items', 'warranties']).map((item) => ({ id: safeText(item.id, 120), name: safeText(item.name || item.label, 250) })).filter((item) => item.id),
    warranties: list(raw.warranties, ['warranties', 'items']).map((item) => ({ id: safeText(item.id, 120), name: safeText(item.name || item.label, 250) })).filter((item) => item.id),
  };
}

export function createAllegroSalesConditionsLoader({ call, cacheMs = 5 * 60_000 } = {}) {
  if (typeof call !== 'function') throw new TypeError('Brak klienta Allegro dla warunków sprzedaży.');
  let cache = { expiresAt: 0, value: null };
  return async function load(req) {
    if (cache.value && cache.expiresAt > Date.now()) return structuredClone(cache.value);
    const errors = [];
    const safe = async (path, key) => {
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await call(req, path, { parameters: { limit: 100, offset: 0 } });
          if (attempt || Object.keys(result || {}).length) return result;
        } catch (error) {
          lastError = error;
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      if (lastError) errors.push({ key, path, status: lastError.status || 0, code: lastError.code || '', message: lastError.message || String(lastError) });
      return {};
    };
    const [shippingRatesRaw, returnPoliciesRaw, impliedWarrantiesRaw, warrantiesRaw] = await Promise.all([
      safe('/sale/shipping-rates', 'shippingRates'),
      safe('/after-sales-service-conditions/return-policies', 'returnPolicies'),
      safe('/after-sales-service-conditions/implied-warranties', 'impliedWarranties'),
      safe('/after-sales-service-conditions/warranties', 'warranties'),
    ]);
    const data = normalize({ shippingRates: shippingRatesRaw, returnPolicies: returnPoliciesRaw, impliedWarranties: impliedWarrantiesRaw, warranties: warrantiesRaw });
    const result = {
      ...data,
      defaults: {
        shippingRateId: firstId(data.shippingRates),
        returnPolicyId: firstId(data.returnPolicies),
        impliedWarrantyId: firstId(data.impliedWarranties),
        warrantyId: firstId(data.warranties),
      },
      errors,
    };
    if (result.defaults.shippingRateId && result.defaults.returnPolicyId && result.defaults.impliedWarrantyId) {
      cache = { expiresAt: Date.now() + Math.max(30_000, Number(cacheMs) || 5 * 60_000), value: structuredClone(result) };
    }
    return result;
  };
}

export function applyRequiredAllegroSalesConditions(missing = [], draft = {}, { existingOffer = false } = {}) {
  if (existingOffer) return [...new Set(Array.isArray(missing) ? missing : [])];
  return [...new Set([
    ...(Array.isArray(missing) ? missing : []),
    !draft?.delivery?.shippingRates?.id ? 'cennik dostawy Allegro' : '',
    !draft?.afterSalesServices?.returnPolicy?.id ? 'warunki zwrotu Allegro' : '',
    !draft?.afterSalesServices?.impliedWarranty?.id ? 'warunki reklamacji Allegro' : '',
  ].filter(Boolean))];
}

export function createAllegroOfferStatusWaiter({ call, maxChecks = 45 } = {}) {
  if (typeof call !== 'function') throw new TypeError('Brak klienta Allegro do potwierdzania publikacji.');
  return async function wait(req, offerId = '', expectedStatus = '') {
    const id = safeText(offerId, 100), expected = safeText(expectedStatus, 30).toUpperCase();
    const checks = Math.max(1, Math.min(60, Number(maxChecks) || 45));
    if (!id || !expected) return { offer: null, completed: false, checks: 0 };
    let offer = null;
    for (let index = 0; index < checks; index++) {
      if (index) await new Promise((resolve) => setTimeout(resolve, 1000));
      offer = await call(req, `/sale/product-offers/${encodeURIComponent(id)}`);
      if (String(offer?.publication?.status || '').toUpperCase() === expected) return { offer, completed: true, checks: index + 1 };
    }
    return { offer, completed: false, checks };
  };
}
