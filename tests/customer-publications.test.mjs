import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCustomerPublicationToken,
  customerPublicationIsActive,
  customerPublicationReport,
  emptyCustomerPublicationAnalytics,
  normalizeCustomerPublications,
  recordCustomerPublicationEvent,
  verifyCustomerPublicationToken,
} from '../src/backend/lib/domain/customer-publications.mjs';
import { createCustomerPublicationsRoute } from '../src/backend/lib/customer-publications-route.mjs';

const SECRET = 'test-referral-secret-that-is-long-enough';

test('publikacja ma 4–6 bezpiecznych odpowiedzi i nie przyjmuje obcego adresu', () => {
  const [publication] = normalizeCustomerPublications([{
    id: 'Lato 2026', active: true, landingPath: 'javascript:alert(1)',
    actions: [{ label: 'Pierwsza', target: 'https://evil.example/x' }],
  }]);
  assert.equal(publication.id, 'lato-2026');
  assert.equal(publication.landingPath, '#/');
  assert.equal(publication.actions.length, 4);
  assert.equal(publication.actions[0].target, '');
  assert.equal(normalizeCustomerPublications([{ actions: Array.from({ length: 9 }, (_, i) => ({ label: `A ${i}`, target: '#/' })) }])[0].actions.length, 6);
});

test('podpisany link wiąże publikację z kodem polecającym i wykrywa zmianę tokenu', () => {
  const token = createCustomerPublicationToken({ publicationId: 'wakacje', referralCode: 'anna-2026' }, SECRET, new Date('2026-08-09T10:00:00Z'));
  assert.deepEqual(verifyCustomerPublicationToken(token, SECRET), { publicationId: 'wakacje', referralCode: 'anna-2026', issuedAt: '2026-08-09T10:00:00.000Z' });
  assert.equal(verifyCustomerPublicationToken(`${token}x`, SECRET), null);
  assert.equal(verifyCustomerPublicationToken(token, 'inne-haslo'), null);
});

test('harmonogram przepuszcza wyłącznie aktywną publikację', () => {
  const now = new Date('2026-08-09T12:00:00Z');
  assert.equal(customerPublicationIsActive({ active: true, startAt: '2026-08-09T10:00:00Z', endAt: '2026-08-09T14:00:00Z' }, now), true);
  assert.equal(customerPublicationIsActive({ active: false }, now), false);
  assert.equal(customerPublicationIsActive({ active: true, startAt: '2026-08-10T10:00:00Z' }, now), false);
});

test('jedna przeglądarka potwierdza dany link tylko raz, a zamknięcie jest odpowiedzią', () => {
  const state = emptyCustomerPublicationAnalytics(), base = { publicationId: 'powitanie', referralCode: 'anna', visitorId: 'visitor-1234567890' };
  assert.equal(recordCustomerPublicationEvent(state, { ...base, event: 'landing' }, new Date('2026-08-09T10:00:00Z')).changed, true);
  assert.equal(recordCustomerPublicationEvent(state, { ...base, event: 'landing' }, new Date('2026-08-09T10:01:00Z')).duplicate, true);
  assert.equal(recordCustomerPublicationEvent(state, { ...base, event: 'confirmed', responseId: 'zamkniecie' }, new Date('2026-08-09T10:02:00Z')).changed, true);
  assert.equal(recordCustomerPublicationEvent(state, { ...base, event: 'confirmed', responseId: 'zakupy' }, new Date('2026-08-09T10:03:00Z')).duplicate, true);
  const [item] = customerPublicationReport(state, [{ id: 'powitanie', title: 'Powitanie', actions: [] }]).items;
  assert.equal(item.landings, 1); assert.equal(item.confirmations, 1); assert.equal(item.responses.zamkniecie, 1); assert.equal(item.effectiveness, 100);
});

test('API generuje link, pokazuje okno tylko dla aktywnej publikacji i zapisuje raport', async () => {
  const previous = process.env.ARTWAY_REFERRAL_SECRET; process.env.ARTWAY_REFERRAL_SECRET = SECRET;
  const records = new Map([
    ['settings', { data: { artway_ustawienia: { publikacjeKlienta: [{ id: 'wakacje', kind: 'promocja', title: 'Wakacje', message: 'Witaj z polecenia', active: true, landingPath: '#/promocje', actions: [{ id: 'a', label: 'A', target: '#/' }, { id: 'b', label: 'B', target: '#/' }, { id: 'c', label: 'C', target: '#/' }, { id: 'd', label: 'D', target: '' }] }] } }, rev: 1 }],
  ]);
  const versions = new Map();
  const read = async (key, fallback) => structuredClone(records.get(key) ?? fallback);
  const readVersioned = async (key, fallback) => ({ value: await read(key, fallback), etag: String(versions.get(key) || 0), exists: records.has(key) });
  const writeIfVersion = async (key, value, version) => {
    if (String(versions.get(key) || 0) !== String(version.etag)) return { modified: false };
    records.set(key, structuredClone(value)); versions.set(key, (versions.get(key) || 0) + 1); return { modified: true };
  };
  const respond = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  const route = createCustomerPublicationsRoute({ read, readVersioned, writeIfVersion, respond, isAdmin: (req) => req.headers.get('x-test-admin') === '1' });
  try {
    const linkResponse = await route(new Request('https://artwaytm.pl/api/store?action=customer-publication-link', { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-admin': '1' }, body: JSON.stringify({ publicationId: 'wakacje', referralCode: 'anna-2026' }) }), new URL('https://artwaytm.pl/api/store?action=customer-publication-link'), 'customer-publication-link');
    const linkBody = await linkResponse.json(); assert.equal(linkResponse.status, 200); assert.match(linkBody.link, /^https:\/\/artwaytm\.pl\/\?awref=.*#\/promocje$/);
    const token = new URL(linkBody.link).searchParams.get('awref');
    const entryUrl = new URL(`https://artwaytm.pl/api/store?action=customer-publication-entry&token=${encodeURIComponent(token)}`);
    const entryResponse = await route(new Request(entryUrl), entryUrl, 'customer-publication-entry');
    const entryBody = await entryResponse.json(); assert.equal(entryBody.publication.title, 'Wakacje'); assert.equal(entryBody.publication.actions.length, 4);
    const eventUrl = new URL('https://artwaytm.pl/api/store?action=customer-publication-event');
    const event = (eventName, responseId = '') => route(new Request(eventUrl, { method: 'POST', headers: { origin: 'https://artwaytm.pl', 'content-type': 'application/json' }, body: JSON.stringify({ token, event: eventName, responseId, visitorId: 'visitor-route-123456' }) }), eventUrl, 'customer-publication-event');
    assert.equal((await (await event('landing')).json()).changed, true);
    assert.equal((await (await event('confirmed', 'a')).json()).changed, true);
    assert.equal((await (await event('confirmed', 'b')).json()).duplicate, true);
    const reportUrl = new URL('https://artwaytm.pl/api/store?action=customer-publication-report');
    assert.equal((await route(new Request(reportUrl), reportUrl, 'customer-publication-report')).status, 401);
    const reportResponse = await route(new Request(reportUrl, { headers: { 'x-test-admin': '1' } }), reportUrl, 'customer-publication-report');
    const report = await reportResponse.json(); assert.equal(report.report.items[0].confirmations, 1); assert.equal(report.report.items[0].referrals[0].referralCode, 'anna-2026');
  } finally { if (previous === undefined) delete process.env.ARTWAY_REFERRAL_SECRET; else process.env.ARTWAY_REFERRAL_SECRET = previous; }
});

test('źródła budowania zawierają panel, popup i oba arkusze stylów', async () => {
  const { readFile } = await import('node:fs/promises');
  const [build, router, admin] = await Promise.all([readFile(new URL('../scripts/build-assets.mjs', import.meta.url), 'utf8'), readFile(new URL('../src/frontend/06-router-and-storefront.js', import.meta.url), 'utf8'), readFile(new URL('../src/frontend/08-admin-navigation.js', import.meta.url), 'utf8')]);
  for (const marker of ['06e-customer-publications.js', '15f-customer-publications.js', '11-customer-publications.css', '39-customer-publications-admin.css']) assert.match(build, new RegExp(marker.replaceAll('.', '\\.')));
  assert.match(router, /widokAdminPublikacjeKlienta/); assert.match(admin, /🔗 Powitania i linki/);
});
