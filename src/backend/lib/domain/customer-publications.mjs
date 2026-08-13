import crypto from 'node:crypto';

const PUBLICATION_KINDS = new Set(['promocja', 'nowosc', 'komunikat', 'dostawa', 'ankieta', 'konkurs', 'inna']);
const ACTION_STYLES = new Set(['primary', 'secondary', 'soft']);
const TOKEN_VERSION = 1;

const cleanText = (value, max = 160) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanId = (value, fallback = '') => cleanText(value, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
const number = (value, max = 1_000_000_000) => Math.max(0, Math.min(max, Number(value) || 0));

export function safePublicationDestination(value, fallback = '#/') {
  const raw = String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (/^#\/[a-z0-9_~!$&'()*+,;=:@%./-]*$/i.test(raw)) return raw.slice(0, 240);
  if (/^\/[a-z0-9_~!$&'()*+,;=:@%./?#-]*$/i.test(raw) && !raw.startsWith('//')) return raw.slice(0, 240);
  if (/^https:\/\/(?:www\.)?(?:artwaytm\.pl|allsklep\.pl)(?:[/:?#]|$)/i.test(raw)) return raw.slice(0, 400);
  return fallback;
}

const DEFAULT_ACTIONS = Object.freeze([
  { id: 'zakupy', label: 'Idę na zakupy', target: '#/', style: 'primary' },
  { id: 'promocje', label: 'Zobaczę promocje', target: '#/promocje', style: 'secondary' },
  { id: 'nowosci', label: 'Sprawdzę nowości', target: '#/nowosci', style: 'soft' },
  { id: 'mily-dzien', label: 'Miłego dnia', target: '', style: 'soft' },
]);

export const DEFAULT_CUSTOMER_PUBLICATION = Object.freeze({
  id: 'powitanie-z-polecenia',
  kind: 'promocja',
  eyebrow: 'Witamy w Artway-TM',
  title: 'Dzień dobry! Miło Cię widzieć',
  message: 'Trafiasz do nas z polecenia. Wybierz, co chcesz zrobić dalej.',
  landingPath: '#/',
  active: true,
  startAt: '',
  endAt: '',
  actions: DEFAULT_ACTIONS,
});

export function normalizePublicationAction(raw = {}, index = 0) {
  const fallback = DEFAULT_ACTIONS[index] || DEFAULT_ACTIONS.at(-1);
  const label = cleanText(raw.label, 46) || fallback.label;
  const requestedTarget = String(raw.target || '').trim();
  return {
    id: cleanId(raw.id || label, `akcja-${index + 1}`),
    label,
    target: requestedTarget ? safePublicationDestination(requestedTarget, '') : '',
    style: ACTION_STYLES.has(String(raw.style || '')) ? String(raw.style) : fallback.style,
  };
}

export function normalizeCustomerPublication(raw = {}, index = 0) {
  const actions = (Array.isArray(raw.actions) ? raw.actions : []).slice(0, 6).map(normalizePublicationAction);
  for (let i = actions.length; i < 4; i += 1) actions.push(normalizePublicationAction(DEFAULT_ACTIONS[i], i));
  return {
    id: cleanId(raw.id, `publikacja-${index + 1}`),
    kind: PUBLICATION_KINDS.has(String(raw.kind || '')) ? String(raw.kind) : 'inna',
    eyebrow: cleanText(raw.eyebrow, 54) || 'Witamy w Artway-TM',
    title: cleanText(raw.title, 100) || 'Dzień dobry! Miło Cię widzieć',
    message: cleanText(raw.message, 420) || 'Trafiasz do nas z polecenia. Wybierz, co chcesz zrobić dalej.',
    landingPath: safePublicationDestination(raw.landingPath, '#/'),
    active: raw.active === true,
    startAt: Number.isFinite(Date.parse(String(raw.startAt || ''))) ? new Date(raw.startAt).toISOString() : '',
    endAt: Number.isFinite(Date.parse(String(raw.endAt || ''))) ? new Date(raw.endAt).toISOString() : '',
    actions,
    updatedAt: Number.isFinite(Date.parse(String(raw.updatedAt || ''))) ? new Date(raw.updatedAt).toISOString() : '',
  };
}

export function normalizeCustomerPublications(value, { fallback = true } = {}) {
  const source = Array.isArray(value) ? value : (fallback ? [DEFAULT_CUSTOMER_PUBLICATION] : []);
  const seen = new Set(), result = [];
  for (const [index, raw] of source.slice(0, 30).entries()) {
    const item = normalizeCustomerPublication(raw, index);
    if (seen.has(item.id)) item.id = `${item.id}-${index + 1}`;
    seen.add(item.id); result.push(item);
  }
  return result;
}

export function customerPublicationIsActive(publication, now = new Date()) {
  if (!publication?.active) return false;
  const time = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(time)) return false;
  const start = Date.parse(publication.startAt || ''), end = Date.parse(publication.endAt || '');
  return (!Number.isFinite(start) || start <= time) && (!Number.isFinite(end) || end >= time);
}

const encode = (value) => Buffer.from(value).toString('base64url');
const signature = (payload, secret) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');
export function createCustomerPublicationToken({ publicationId, referralCode }, secret, now = new Date()) {
  const publication = cleanId(publicationId), referral = cleanId(referralCode);
  if (!publication || referral.length < 3 || !secret) throw new Error('Nie można utworzyć bezpiecznego linku promocyjnego.');
  const payload = encode(JSON.stringify({ v: TOKEN_VERSION, p: publication, r: referral, iat: Math.floor(new Date(now).getTime() / 1000) }));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyCustomerPublicationToken(token, secret) {
  const [payload, supplied, ...extra] = String(token || '').split('.');
  if (!payload || !supplied || extra.length || !secret) return null;
  const expected = signature(payload, secret), left = Buffer.from(supplied), right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const publicationId = cleanId(value?.p), referralCode = cleanId(value?.r);
    if (value?.v !== TOKEN_VERSION || !publicationId || referralCode.length < 3) return null;
    return { publicationId, referralCode, issuedAt: new Date(number(value.iat, 4_000_000_000) * 1000).toISOString() };
  } catch { return null; }
}

export function customerPublicationEntryId(value = {}) {
  return crypto.createHash('sha256').update(`${cleanId(value.publicationId)}:${cleanId(value.referralCode)}`).digest('hex').slice(0, 24);
}

export function emptyCustomerPublicationAnalytics() {
  return { version: 1, publications: {}, receipts: {}, updatedAt: null };
}

function metric(value = {}) {
  return {
    landings: number(value.landings, 100_000_000),
    confirmations: number(value.confirmations, 100_000_000),
    responses: value.responses && typeof value.responses === 'object' ? { ...value.responses } : {},
    lastAt: cleanText(value.lastAt, 40),
  };
}

function trimReceipts(receipts, limit = 50_000) {
  const entries = Object.entries(receipts || {});
  if (entries.length <= limit) return receipts;
  return Object.fromEntries(entries.sort((a, b) => String(b[1]?.lastAt || '').localeCompare(String(a[1]?.lastAt || ''))).slice(0, limit));
}

export function recordCustomerPublicationEvent(state, input = {}, now = new Date()) {
  const publicationId = cleanId(input.publicationId), referralCode = cleanId(input.referralCode), visitorId = cleanText(input.visitorId, 120);
  const event = input.event === 'confirmed' ? 'confirmed' : input.event === 'landing' ? 'landing' : '';
  if (!publicationId || referralCode.length < 3 || visitorId.length < 12 || !event) return { accepted: false, reason: 'invalid' };
  const at = new Date(now).toISOString(), publication = state.publications[publicationId] ||= metric(), referral = publication.referrals?.[referralCode] || metric();
  publication.referrals ||= {}; referral.responses ||= {}; publication.responses ||= {};
  const receiptKey = crypto.createHash('sha256').update(`${publicationId}:${referralCode}:${visitorId}`).digest('hex');
  const receipt = state.receipts[receiptKey] || { publicationId, referralCode };
  let changed = false;
  const recordLanding = () => {
    if (receipt.landedAt) return;
    receipt.landedAt = at; publication.landings += 1; referral.landings += 1; changed = true;
  };
  if (event === 'landing') recordLanding();
  if (event === 'confirmed') {
    recordLanding();
    if (!receipt.confirmedAt) {
      const responseId = cleanId(input.responseId, 'zamkniecie');
      receipt.confirmedAt = at; receipt.responseId = responseId;
      publication.confirmations += 1; referral.confirmations += 1;
      publication.responses[responseId] = number(publication.responses[responseId], 100_000_000) + 1;
      referral.responses[responseId] = number(referral.responses[responseId], 100_000_000) + 1;
      changed = true;
    }
  }
  receipt.lastAt = at; publication.lastAt = at; referral.lastAt = at;
  publication.referrals[referralCode] = referral; state.receipts[receiptKey] = receipt;
  state.receipts = trimReceipts(state.receipts); state.version = 1; state.updatedAt = at;
  return { accepted: true, changed, duplicate: !changed, entryId: customerPublicationEntryId({ publicationId, referralCode }) };
}

export function customerPublicationReport(state = emptyCustomerPublicationAnalytics(), publications = []) {
  const names = new Map(normalizeCustomerPublications(publications, { fallback: false }).map((item) => [item.id, item.title]));
  const items = Object.entries(state.publications || {}).map(([publicationId, raw]) => {
    const item = metric(raw), referrals = Object.entries(raw?.referrals || {}).map(([referralCode, values]) => {
      const current = metric(values);
      return { referralCode, ...current, effectiveness: current.landings ? current.confirmations * 100 / current.landings : 0 };
    }).sort((a, b) => b.confirmations - a.confirmations || b.landings - a.landings || a.referralCode.localeCompare(b.referralCode));
    return { publicationId, title: names.get(publicationId) || publicationId, ...item, effectiveness: item.landings ? item.confirmations * 100 / item.landings : 0, referrals };
  }).sort((a, b) => b.confirmations - a.confirmations || b.landings - a.landings);
  return { items, updatedAt: state.updatedAt || null };
}

export const customerPublicationInternals = Object.freeze({ cleanId, DEFAULT_ACTIONS, PUBLICATION_KINDS });
