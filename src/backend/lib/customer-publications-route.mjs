import {
  createCustomerPublicationToken,
  customerPublicationEntryId,
  customerPublicationIsActive,
  customerPublicationReport,
  emptyCustomerPublicationAnalytics,
  normalizeCustomerPublications,
  recordCustomerPublicationEvent,
  safePublicationDestination,
  verifyCustomerPublicationToken,
} from './domain/customer-publications.mjs';

const ANALYTICS_KEY = 'customer_publication_referrals_v1';
const requestWindows = new Map();

function allowedOrigin(request) {
  const origin = String(request.headers.get('origin') || ''), referer = String(request.headers.get('referer') || '');
  return !origin || /^https?:\/\/(?:www\.)?(?:artwaytm\.pl|allsklep\.pl)(?::\d+)?$/i.test(origin) || /^https?:\/\/(?:www\.)?(?:artwaytm\.pl|allsklep\.pl)(?:[:/]|$)/i.test(referer);
}

function limited(request) {
  const forwarded = String(request.headers.get('x-forwarded-for') || '').split(',')[0].trim(), key = forwarded || 'unknown', now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt > 60_000) { requestWindows.set(key, { startedAt: now, count: 1 }); return false; }
  current.count += 1;
  if (requestWindows.size > 5000) for (const [entry, value] of requestWindows) if (now - value.startedAt > 120_000) requestWindows.delete(entry);
  return current.count > 80;
}

function publicationSettings(record) {
  const settings = record?.data?.artway_ustawienia;
  const hasOwn = settings && typeof settings === 'object' && Object.prototype.hasOwnProperty.call(settings, 'publikacjeKlienta');
  return normalizeCustomerPublications(hasOwn ? settings.publikacjeKlienta : undefined, { fallback: !hasOwn });
}

function referralSecret() {
  return String(process.env.ARTWAY_REFERRAL_SECRET || process.env.ARTWAY_ADMIN_TOKEN || process.env.ARTWAY_SESSION_SECRET || '').trim();
}

function publicOrigin() {
  const configured = String(process.env.ARTWAY_PUBLIC_ORIGIN || 'https://artwaytm.pl').trim().replace(/\/+$/, '');
  return /^https:\/\/(?:www\.)?(?:artwaytm\.pl|allsklep\.pl)$/i.test(configured) ? configured : 'https://artwaytm.pl';
}

function linkFor(publication, token) {
  const target = safePublicationDestination(publication.landingPath, '#/');
  if (target.startsWith('#/')) return `${publicOrigin()}/?awref=${encodeURIComponent(token)}${target}`;
  if (target.startsWith('/')) {
    const [path, hash = ''] = target.split('#', 2), join = path.includes('?') ? '&' : '?';
    return `${publicOrigin()}${path}${join}awref=${encodeURIComponent(token)}${hash ? `#${hash}` : ''}`;
  }
  const url = new URL(target);
  url.searchParams.set('awref', token); return url.toString();
}

export function createCustomerPublicationsRoute({ read, readVersioned, writeIfVersion, respond, isAdmin } = {}) {
  return async function customerPublicationsRoute(req, url, action) {
    if (!['customer-publication-entry', 'customer-publication-event', 'customer-publication-link', 'customer-publication-report'].includes(action)) return null;
    if (limited(req)) return respond({ ok: false, error: 'Zbyt wiele żądań. Spróbuj ponownie za chwilę.', code: 'rate_limit' }, 429);
    const secret = referralSecret();
    if (!secret) return respond({ ok: false, error: 'Bezpieczne linki promocyjne nie są jeszcze skonfigurowane.', code: 'referral_secret_missing' }, 503);

    const settingsRecord = await read('settings', { data: {}, rev: 0, updated_at: null });
    const publications = publicationSettings(settingsRecord);

    if (action === 'customer-publication-entry') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const entry = verifyCustomerPublicationToken(url.searchParams.get('token'), secret);
      if (!entry) return respond({ ok: false, error: 'Link promocyjny jest nieprawidłowy.', code: 'invalid_referral_link' }, 404);
      const publication = publications.find((item) => item.id === entry.publicationId);
      if (!publication || !customerPublicationIsActive(publication)) return respond({ ok: false, error: 'Ta publikacja nie jest już aktywna.', code: 'publication_inactive' }, 410);
      return respond({ ok: true, publication, entryId: customerPublicationEntryId(entry) });
    }

    if (action === 'customer-publication-link') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const publication = publications.find((item) => item.id === String(body.publicationId || ''));
      if (!publication) return respond({ ok: false, error: 'Nie znaleziono publikacji.' }, 404);
      let token;
      try { token = createCustomerPublicationToken({ publicationId: publication.id, referralCode: body.referralCode }, secret); }
      catch (error) { return respond({ ok: false, error: error.message }, 422); }
      return respond({ ok: true, link: linkFor(publication, token), publicationId: publication.id });
    }

    if (action === 'customer-publication-report') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const state = await read(ANALYTICS_KEY, emptyCustomerPublicationAnalytics());
      return respond({ ok: true, report: customerPublicationReport(state, publications) });
    }

    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!allowedOrigin(req)) return respond({ ok: false, error: 'Niedozwolone źródło żądania.' }, 403);
    const body = await req.json().catch(() => ({})), entry = verifyCustomerPublicationToken(body.token, secret);
    if (!entry) return respond({ ok: false, error: 'Link promocyjny jest nieprawidłowy.', code: 'invalid_referral_link' }, 422);
    const publication = publications.find((item) => item.id === entry.publicationId);
    if (!publication || !customerPublicationIsActive(publication)) return respond({ ok: false, error: 'Ta publikacja nie jest już aktywna.', code: 'publication_inactive' }, 410);
    const validResponses = new Set(['zamkniecie', ...publication.actions.map((item) => item.id)]);
    const responseId = body.event === 'confirmed' && validResponses.has(String(body.responseId || '')) ? String(body.responseId) : body.event === 'confirmed' ? 'zamkniecie' : '';
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const version = await readVersioned(ANALYTICS_KEY, emptyCustomerPublicationAnalytics());
      const state = version.value && typeof version.value === 'object' ? structuredClone(version.value) : emptyCustomerPublicationAnalytics();
      const result = recordCustomerPublicationEvent(state, { ...entry, event: body.event, responseId, visitorId: body.visitorId });
      if (!result.accepted) return respond({ ok: false, error: 'Nieprawidłowe zdarzenie publikacji.' }, 422);
      if (!result.changed) return respond({ ok: true, ...result });
      const write = await writeIfVersion(ANALYTICS_KEY, state, version);
      if (write?.modified) return respond({ ok: true, ...result });
    }
    return respond({ ok: false, error: 'Nie udało się zapisać potwierdzenia. Spróbuj ponownie.', code: 'write_conflict' }, 409);
  };
}

export const customerPublicationsRouteInternals = Object.freeze({ publicationSettings, linkFor, ANALYTICS_KEY });
