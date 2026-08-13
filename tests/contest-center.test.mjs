import assert from 'node:assert/strict';
import test from 'node:test';
import { contestCenterRouteInternals, createContestCenterRoute } from '../src/backend/lib/contest-center-route.mjs';
import {
  contestEffectiveStatus, contestEntryTotal, contestPublicationCheck, contestPublicView, contestRulesSections, defaultContestState, normalizeContest, normalizeContestSettings,
} from '../src/backend/lib/domain/contest-center.mjs';
import { contestSeoStateView } from '../src/backend/lib/domain/storefront-contest-seo.mjs';

process.env.ARTWAY_CONTEST_SECRET ||= 'test-contest-secret-long-enough';
process.env.ARTWAY_PUBLIC_ORIGIN ||= 'https://artwaytm.pl';

function repository(seed = {}) {
  const values = new Map(Object.entries(seed).map(([key, value]) => [key, structuredClone(value)]));
  const revisions = new Map([...values.keys()].map((key) => [key, 1]));
  return {
    values,
    read: async (key, fallback) => structuredClone(values.has(key) ? values.get(key) : fallback),
    readVersioned: async (key, fallback) => ({ value: structuredClone(values.has(key) ? values.get(key) : fallback), rev: revisions.get(key) || 0 }),
    writeIfVersion: async (key, value, version) => {
      if ((revisions.get(key) || 0) !== Number(version.rev || 0)) return { modified: false };
      values.set(key, structuredClone(value)); revisions.set(key, Number(version.rev || 0) + 1); return { modified: true };
    },
  };
}

const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const json = (response) => response.json();
const sessionOf = (request) => {
  const email = request.headers.get('x-test-email'); if (!email) return null;
  const address = request.headers.get('x-test-address') || 'Kwiatowa';
  return { email, role: request.headers.get('x-test-admin') === '1' ? 'admin' : 'klient', account: { imie: `Klient ${email[0]}`, email, ulica: address, nrDomu: '1', kod: '00-001', miasto: 'Warszawa', telefon: request.headers.get('x-test-phone') || '500600700' } };
};
const isAdmin = (request) => request.headers.get('x-test-admin') === '1';
const request = (action, { method = 'GET', body, email = '', admin = false, params = {} } = {}) => {
  const url = new URL('https://artwaytm.pl/api/store'); url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const headers = { 'content-type': 'application/json' }; if (email) headers['x-test-email'] = email; if (admin) headers['x-test-admin'] = '1';
  return [new Request(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) }), url, action];
};

test('ustawienia konkursów zachowują twarde zabezpieczenia', () => {
  const settings = normalizeContestSettings({ requireAccount: false, courierPrizeOnly: false, oneAccountPerContest: false, aiDraftOnly: false });
  assert.equal(settings.requireAccount, true);
  assert.equal(settings.courierPrizeOnly, true);
  assert.equal(settings.oneAccountPerContest, true);
  assert.equal(settings.aiDraftOnly, true);
});

test('profil uczestnika zachowuje pełny adres zamówienia, gdy konto ma puste pola', () => {
  const profile = contestCenterRouteInternals.participantProfile(
    { ulica: '', nrDomu: '', nrLokalu: '', kod: '', miasto: '', telefon: '' },
    { adresDostawy: { ulica: 'Kwiatowa', nrDomu: '7', nrLokalu: '2', kod: '80-001', miasto: 'Gdańsk' }, telefon: '500600700' },
  );
  assert.deepEqual(profile, { ulica: 'Kwiatowa', nrDomu: '7', nrLokalu: '2', kod: '80-001', miasto: 'Gdańsk', telefon: '500600700' });
  assert.equal(contestCenterRouteInternals.hasFullAddress(profile), true);
  assert.equal(contestCenterRouteInternals.hasFullAddress({ ulica: 'Kwiatowa', miasto: 'Gdańsk' }), false);
});

test('SEO pokazuje tylko konkursy, które faktycznie mogą być publiczne', () => {
  const base = { title: 'Publiczny konkurs Artway-TM', description: 'Opis publicznego konkursu spełniający minimalną wymaganą długość tekstu.', taskPrompt: 'Wykonaj własną twórczą pracę zgodnie z opisem zadania konkursowego.', startsAt: '2026-01-01T00:00:00Z', endsAt: '2030-01-01T00:00:00Z', rulesText: 'Regulamin. '.repeat(40), rulesApproved: true, legalReviewConfirmed: true };
  const rows = contestSeoStateView({ contests: [{ ...base, id: 'draft', slug: 'szkic', status: 'draft' }, { ...base, id: 'active', slug: 'aktywny', status: 'active' }] });
  assert.deepEqual(rows.map((item) => item.id), ['active']);
});

test('publikacja konkursu wymaga aktywnego powitania przez cały termin', () => {
  const contest = normalizeContest({ id: 'udostepnienia', title: 'Konkurs z potwierdzonymi udostępnieniami', description: 'Opis konkursu, w którym bezpieczne udostępnienia są częścią warunków uczestnictwa.', taskPrompt: 'Przygotuj samodzielną odpowiedź zgodnie z jasno opisanym zadaniem konkursowym.', startsAt: '2026-08-10T10:00:00Z', endsAt: '2026-08-17T10:00:00Z', shareRequired: true, sharePublicationId: 'powitanie', rulesText: 'Regulamin. '.repeat(40), rulesApproved: true, legalReviewConfirmed: true });
  assert.match(contestCenterRouteInternals.publicationCoverageError(contest, []), /aktywną publikację/);
  assert.match(contestCenterRouteInternals.publicationCoverageError(contest, [{ id: 'powitanie', active: true, startAt: '', endAt: '2026-08-12T10:00:00Z' }]), /kończy się wcześniej/);
  assert.equal(contestCenterRouteInternals.publicationCoverageError(contest, [{ id: 'powitanie', active: true, startAt: '', endAt: '' }]), '');
});

test('bramka publikacji wymaga zadania, terminów i zatwierdzonego regulaminu', () => {
  const incomplete = normalizeContest({ title: 'Za krótki szkic' });
  assert.equal(contestPublicationCheck(incomplete).ready, false);
  const complete = normalizeContest({
    id: 'polska-2026', title: 'Polska w jednym wyjątkowym zdaniu', description: 'Napisz własne, pomysłowe zdanie pokazujące, co najbardziej cenisz w Polsce.',
    taskPrompt: 'Ułóż jedno oryginalne zdanie o Polsce i krótko uzasadnij swój wybór własnymi słowami.',
    startsAt: '2026-08-01T10:00:00Z', endsAt: '2026-08-31T20:00:00Z', prizeAmount: 200,
    organizerName: 'Artway-TM', organizerAddress: 'ul. Testowa 1, 00-001 Warszawa', contactEmail: 'konkurs@artwaytm.pl',
    taxNote: 'Organizator rozliczy podatek zgodnie z przepisami właściwymi dla nagrody.',
    rulesText: 'Dodatkowe postanowienia konkursu zostały sprawdzone przez organizatora.', rulesApproved: true, legalReviewConfirmed: true,
  });
  assert.equal(contestPublicationCheck(complete).ready, true);
  assert.equal(contestEffectiveStatus({ ...complete, status: 'active' }, new Date('2026-08-10T12:00:00Z')), 'active');
});

test('punkty promocyjne zależą od przycisku, nie mają limitu i zachowują jedno źródło dowodu', () => {
  const contest = normalizeContest({
    id: 'reakcje', sharePublicationId: 'powitanie', shareMaxPoints: 10, purchaseBonusPoints: 5,
    shareResponseRules: [{ id: 'zakupy', label: 'Idę na zakupy', points: 3 }, { id: 'promocje', label: 'Zobaczę promocje', points: 2 }, { id: 'zamkniecie', label: 'Zamknięcie', points: 0 }],
  });
  const entry = { referralCode: 'uczestnik-1', taskScore: 70, purchaseVerified: true };
  const analytics = { publications: { powitanie: { referrals: { 'uczestnik-1': { confirmations: 6, responses: { zakupy: 2, promocje: 3, zamkniecie: 1 } } } } } };
  const evidence = contestCenterRouteInternals.shareEvidence(analytics, contest, entry);
  assert.equal(evidence.confirmations, 6);
  assert.equal(evidence.rawPoints, 12);
  assert.equal(evidence.points, 12);
  assert.equal(evidence.capped, false);
  assert.equal(contestEntryTotal(entry, contest, evidence), 87);
});

test('regulamin serwerowy opisuje kryteria, reakcje i dostawę od potwierdzenia', () => {
  const contest = normalizeContest({
    title: 'Kompletny konkurs umiejętnościowy', endsAt: '2026-08-31T20:00:00Z', resultsAnnouncementAt: '2026-09-02T20:00:00Z', prizeDeliveryDays: 12,
    shareResponseRules: [{ id: 'zakupy', label: 'Idę na zakupy', points: 4 }, { id: 'zamkniecie', label: 'Zamknięcie', points: 0 }],
    organizerName: 'Artway-TM', organizerAddress: 'ul. Testowa 1, 00-001 Warszawa', contactEmail: 'konkurs@artwaytm.pl',
    taxNote: 'Organizator rozliczy podatek zgodnie z przepisami właściwymi dla nagrody.',
  });
  const text = contestRulesSections(contest).map((section) => section.text).join('\n');
  assert.match(text, /Idę na zakupy: 4 pkt/);
  assert.match(text, /pierwszą poprawnie zapisaną reakcję/);
  assert.match(text, /Samo otwarcie strony/);
  assert.match(text, /nie ma górnego limitu/);
  assert.match(text, /Zakup nie jest warunkiem udziału/);
  assert.match(text, /do 12 dni kalendarzowych od prawidłowego potwierdzenia/);
  assert.match(text, /Czas każdego pytania mierzy serwer/);
});

test('quiz ABC jest głównym zadaniem, a prawidłowe odpowiedzi nie trafiają do widoku publicznego', () => {
  const contest = normalizeContest({
    title: 'Tygodniowy quiz wiedzy o Polsce', contestType: 'quiz_abc',
    quizQuestions: [
      { id: 'q1', prompt: 'Które miasto jest stolicą Polski?', options: [{ id: 'a', label: 'Kraków' }, { id: 'b', label: 'Warszawa' }, { id: 'c', label: 'Gdańsk' }], correctOptionId: 'b', points: 10 },
      { id: 'q2', prompt: 'Nad którym morzem leży Polska?', options: [{ id: 'a', label: 'Bałtyckim' }, { id: 'b', label: 'Czarnym' }, { id: 'c', label: 'Północnym' }], correctOptionId: 'a', points: 10 },
      { id: 'q3', prompt: 'Jaka waluta obowiązuje w Polsce?', options: [{ id: 'a', label: 'Euro' }, { id: 'b', label: 'Złoty' }, { id: 'c', label: 'Korona' }], correctOptionId: 'b', points: 10 },
    ],
  });
  assert.equal(contest.purchaseRequired, false);
  assert.equal(contest.quizMaxPoints, 30);
  assert.equal(contest.quizTimeBonusMaxPoints, 9);
  assert.equal(contest.taskMaxPoints, 39);
  assert.equal(contestCenterRouteInternals.quizTimeBonus(5_000), 3);
  assert.equal(contestCenterRouteInternals.quizTimeBonus(10_000), 2);
  assert.equal(contestCenterRouteInternals.quizTimeBonus(20_000), 1);
  assert.equal(contestCenterRouteInternals.quizTimeBonus(20_001), 0);
  assert.equal(contestCenterRouteInternals.scoreQuizSubmission(contest, { q1: 'b', q2: 'c', q3: 'b' }).score, 20);
  const publicView = contestPublicView(contest);
  assert.equal(publicView.quizQuestionCount, 3);
  assert.equal('quizQuestions' in publicView, false);
  const rules = contestRulesSections(contest).map((section) => section.text).join('\n');
  assert.match(rules, /Głównym zadaniem jest quiz ABC/);
  assert.match(rules, /za błędną albo brak odpowiedzi — 0 pkt/);
});

test('quiz pokazuje pytania pojedynczo i zapisuje serwerowy bonus czasu', async () => {
  const now = Date.now(), contest = normalizeContest({
    id: 'quiz-czas', slug: 'quiz-czas', status: 'active', title: 'Quiz czasowy wiedzy o Polsce', description: 'Odpowiedz kolejno na pytania i sprawdź swoją wiedzę w bezpiecznym quizie.', taskPrompt: 'Po uruchomieniu odpowiadaj kolejno na każde pytanie A, B albo C.',
    startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 86_400_000).toISOString(), shareRequired: false,
    quizQuestions: [
      { id: 'q1', prompt: 'Które miasto jest stolicą Polski?', options: [{ id: 'a', label: 'Kraków' }, { id: 'b', label: 'Warszawa' }], correctOptionId: 'b', points: 10 },
      { id: 'q2', prompt: 'Nad którym morzem leży Polska?', options: [{ id: 'a', label: 'Bałtyckim' }, { id: 'b', label: 'Czarnym' }], correctOptionId: 'a', points: 10 },
      { id: 'q3', prompt: 'Jaka waluta obowiązuje w Polsce?', options: [{ id: 'a', label: 'Euro' }, { id: 'b', label: 'Złoty' }], correctOptionId: 'b', points: 10 },
    ],
  });
  const initial = defaultContestState(); initial.contests = [contest];
  const repo = repository({ contest_center_v1: initial, orders: { items: [] }, customer_publication_referrals_v1: { publications: {} } });
  const route = createContestCenterRoute({ ...repo, respond, isAdmin, sessionOf, rateLimit: () => null });
  let response = await route(...request('contest-quiz-start', { method: 'POST', email: 'quiz@example.com', body: { contestId: contest.id, rulesAccepted: true, privacyAccepted: true } }));
  let attempt = (await json(response)).attempt;
  assert.equal(attempt.question.id, 'q1');
  for (const optionId of ['b', 'a', 'b']) {
    response = await route(...request('contest-quiz-answer', { method: 'POST', email: 'quiz@example.com', body: { attemptId: attempt.id, questionId: attempt.question.id, optionId } }));
    attempt = (await json(response)).attempt;
  }
  assert.equal(attempt.status, 'completed');
  assert.equal(attempt.totalScore, 39);
  response = await route(...request('contest-submit', { method: 'POST', email: 'quiz@example.com', body: { contestId: contest.id, quizAttemptId: attempt.id, rulesAccepted: true, privacyAccepted: true } }));
  const saved = await json(response);
  assert.equal(response.status, 201);
  assert.equal(saved.entry.scoreBreakdown.taskPoints, 39);
});

test('pełny przepływ: szkic, publikacja, jedno zgłoszenie, ocena i ranking po zakończeniu', async () => {
  const initialContestState = defaultContestState();
  initialContestState.settings.publicPageEnabled = false;
  const repo = repository({ contest_center_v1: initialContestState, orders: { items: [] }, customer_publication_referrals_v1: { publications: {} } });
  const route = createContestCenterRoute({ ...repo, respond, isAdmin, sessionOf, rateLimit: () => null });
  const now = Date.now(), contest = {
    id: 'test-kreatywny', slug: 'test-kreatywny', contestType: 'creative', title: 'Kreatywny konkurs wiedzy o Polsce', description: 'Pokaż własny pomysł i wykonaj krótką pracę dotyczącą ciekawego miejsca w Polsce.',
    taskTitle: 'Moje niezwykłe miejsce', taskPrompt: 'Opisz własnymi słowami jedno mniej znane miejsce w Polsce i wyjaśnij, dlaczego warto je poznać.',
    quizQuestions: [
      { id: 'q1', prompt: 'Które miasto jest stolicą Polski?', options: [{ id: 'a', label: 'Kraków' }, { id: 'b', label: 'Warszawa' }], correctOptionId: 'b', points: 10 },
      { id: 'q2', prompt: 'Nad którym morzem leży Polska?', options: [{ id: 'a', label: 'Bałtyckim' }, { id: 'b', label: 'Czarnym' }], correctOptionId: 'a', points: 10 },
      { id: 'q3', prompt: 'Jaka waluta obowiązuje w Polsce?', options: [{ id: 'a', label: 'Euro' }, { id: 'b', label: 'Złoty' }], correctOptionId: 'b', points: 10 },
    ],
    startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 86_400_000).toISOString(), prizeAmount: 100, prizeDescription: 'Nagroda 100 zł',
    organizerName: 'Artway-TM', organizerAddress: 'ul. Testowa 1, 00-001 Warszawa', contactEmail: 'konkurs@artwaytm.pl',
    taxNote: 'Organizator rozliczy podatek zgodnie z przepisami właściwymi dla nagrody.',
    shareRequired: false, rulesText: 'Dodatkowe postanowienia testowego konkursu.', rulesApproved: true, legalReviewConfirmed: true,
  };
  let response = await route(...request('contest-admin-save', { method: 'POST', admin: true, email: 'admin@artwaytm.pl', body: { contest } }));
  assert.equal(response.status, 200);
  assert.equal((await json(response)).contest.contestType, 'quiz_abc');
  response = await route(...request('contest-admin-status', { method: 'POST', admin: true, email: 'admin@artwaytm.pl', body: { contestId: contest.id, operation: 'publish' } }));
  assert.equal((await json(response)).contest.status, 'active');
  assert.equal(repo.values.get('contest_center_v1').settings.publicPageEnabled, true);
  response = await route(...request('contest-public-list'));
  assert.equal((await json(response)).contests.length, 1);
  response = await route(...request('contest-quiz-start', { method: 'POST', email: 'anna@example.com', body: { contestId: contest.id, rulesAccepted: true, privacyAccepted: true } }));
  let quizAttempt = (await json(response)).attempt;
  for (const optionId of ['b', 'a', 'b']) {
    response = await route(...request('contest-quiz-answer', { method: 'POST', email: 'anna@example.com', body: { attemptId: quizAttempt.id, questionId: quizAttempt.question.id, optionId } }));
    quizAttempt = (await json(response)).attempt;
  }
  response = await route(...request('contest-submit', { method: 'POST', email: 'anna@example.com', body: { contestId: contest.id, quizAttemptId: quizAttempt.id, rulesAccepted: true, privacyAccepted: true } }));
  assert.equal(response.status, 201);
  const entry = (await json(response)).entry;
  response = await route(...request('contest-quiz-start', { method: 'POST', email: 'anna@example.com', body: { contestId: contest.id, rulesAccepted: true, privacyAccepted: true } }));
  assert.equal(response.status, 409);
  response = await route(...request('contest-admin-score', { method: 'POST', admin: true, email: 'admin@artwaytm.pl', body: { entryId: entry.id, taskScore: 91, status: 'approved', moderationNote: 'Samodzielna i zgodna praca.' } }));
  assert.equal((await json(response)).entry.taskScore, 39);
  await route(...request('contest-admin-status', { method: 'POST', admin: true, email: 'admin@artwaytm.pl', body: { contestId: contest.id, operation: 'close' } }));
  response = await route(...request('contest-admin-winner', { method: 'POST', admin: true, email: 'admin@artwaytm.pl', body: { contestId: contest.id } }));
  assert.equal((await json(response)).winner.id, entry.id);
  response = await route(...request('contest-public-detail', { params: { slug: contest.slug } }));
  const publicResult = await json(response);
  assert.equal(publicResult.contest.status, 'completed');
  assert.equal(publicResult.contest.ranking.length, 1);
  assert.equal(publicResult.contest.ranking[0].winner, true);
  assert.equal(publicResult.contest.ranking[0].participant.includes('anna@example.com'), false);
});
