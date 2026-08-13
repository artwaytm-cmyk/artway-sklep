import crypto from 'node:crypto';
import { createCustomerPublicationToken, normalizeCustomerPublications } from './domain/customer-publications.mjs';
import {
  contestAccountKey, contestAddressKey, contestEffectiveStatus, contestEntryTotal, contestParticipantAlias, contestPurchasePoints,
  contestPublicationCheck, contestPublicView, contestRulesSections, defaultContestEntries, defaultContestState, normalizeContest,
  normalizeContestEntry, normalizeContestSettings, normalizeContestState,
} from './domain/contest-center.mjs';

const STATE_KEY = 'contest_center_v1';
const ENTRIES_KEY = 'contest_entries_v1';
const ANALYTICS_KEY = 'customer_publication_referrals_v1';
const QUIZ_ATTEMPTS_KEY = 'contest_quiz_attempts_v1';
const ACTIONS = new Set([
  'contest-public-list', 'contest-public-detail', 'contest-my-entry', 'contest-quiz-start', 'contest-quiz-answer', 'contest-submit',
  'contest-admin-state', 'contest-admin-entries', 'contest-admin-save', 'contest-admin-status',
  'contest-admin-score', 'contest-admin-winner', 'contest-admin-settings', 'contest-admin-delete',
]);

const clean = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (value) => Array.isArray(value) ? value : [];
const secret = () => String(process.env.ARTWAY_CONTEST_SECRET || process.env.ARTWAY_REFERRAL_SECRET || process.env.ARTWAY_SESSION_SECRET || process.env.ARTWAY_ADMIN_TOKEN || '').trim();
const origin = () => String(process.env.ARTWAY_PUBLIC_ORIGIN || 'https://artwaytm.pl').replace(/\/+$/, '');
const hash = (value) => crypto.createHmac('sha256', secret() || 'contest').update(String(value || '')).digest('hex');
const phoneKey = (value) => clean(value, 80).replace(/\D/g, '').length >= 9 ? hash(clean(value, 80).replace(/\D/g, '')) : '';

function scoreQuizSubmission(contest = {}, rawAnswers = {}) {
  const supplied = rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {};
  const answers = {}, summary = [];
  let score = 0;
  for (const question of list(contest.quizQuestions)) {
    const selected = clean(supplied[question.id], 30).toLowerCase();
    const option = list(question.options).find((item) => item.id === selected);
    if (!option) return { ok: false, error: `Wybierz jedną odpowiedź A/B/C w pytaniu: ${question.prompt}` };
    answers[question.id] = option.id;
    summary.push(`${question.prompt} — ${option.id.toUpperCase()}: ${option.label}`);
    if (option.id === question.correctOptionId) score += Number(question.points) || 0;
  }
  return { ok: true, answers, score: Number(score.toFixed(2)), summary: summary.join('\n') };
}

function quizTimeBonus(elapsedMs) {
  const value = Math.max(0, Number(elapsedMs) || 0);
  if (value <= 5_000) return 3;
  if (value <= 10_000) return 2;
  if (value <= 20_000) return 1;
  return 0;
}

function publicQuizQuestion(question = {}, index = 0, total = 0) {
  return { index, number: index + 1, total, id: question.id, prompt: question.prompt, points: question.points, options: list(question.options).map((option) => ({ id: option.id, label: option.label })) };
}

function normalizeQuizAttempt(raw = {}) {
  return {
    id: clean(raw.id, 120), contestId: clean(raw.contestId, 100), accountKey: clean(raw.accountKey, 128), status: ['active', 'completed', 'submitted'].includes(raw.status) ? raw.status : 'active',
    index: Math.max(0, Number(raw.index) || 0), answers: raw.answers && typeof raw.answers === 'object' ? Object.fromEntries(Object.entries(raw.answers).slice(0, 30).map(([key, value]) => [clean(key, 100), clean(value, 30)])) : {},
    baseScore: Math.max(0, Number(raw.baseScore) || 0), timeBonus: Math.max(0, Number(raw.timeBonus) || 0), startedAt: Number(raw.startedAt) || Date.now(),
    questionStartedAt: Number(raw.questionStartedAt) || Date.now(), completedAt: Number(raw.completedAt) || 0, submittedAt: Number(raw.submittedAt) || 0,
  };
}

const defaultQuizAttempts = () => ({ version: 1, items: [], updatedAt: null });

function orderAmount(order = {}) {
  for (const value of [order.suma, order.total, order.kwota, order.amount, order.totalAmount?.amount, order.summary?.totalToPay?.amount]) {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function orderTime(order = {}) {
  const raw = order.ts ?? order.createdAt ?? order.data ?? order.date ?? '';
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 1_000_000_000 ? (numeric < 100_000_000_000 ? numeric * 1000 : numeric) : (Date.parse(raw) || 0);
}

function orderProfile(order = {}) {
  const address = order.adresDostawy || order.address || order.adres || order.shippingAddress || order.delivery?.address || {};
  return {
    ulica: address.ulica || address.street || order.ulica || '', nrDomu: address.nrDomu || address.building || order.nrDomu || '',
    nrLokalu: address.nrLokalu || address.flat || order.nrLokalu || '', kod: address.kod || address.postCode || address.post_code || order.kod || '',
    miasto: address.miasto || address.city || order.miasto || '', telefon: order.telefon || order.phone || address.phone || '',
  };
}

function participantProfile(account = {}, order = {}) {
  const fallback = orderProfile(order), value = (key) => clean(account?.[key], 200) || fallback[key] || '';
  return { ulica: value('ulica'), nrDomu: value('nrDomu'), nrLokalu: value('nrLokalu'), kod: value('kod'), miasto: value('miasto'), telefon: value('telefon') };
}

const hasFullAddress = (profile = {}) => ['ulica', 'nrDomu', 'kod', 'miasto'].every((key) => clean(profile[key], 200));

function shareEvidence(analytics = {}, contest = {}, entry = {}) {
  const publication = analytics?.publications?.[contest.sharePublicationId] || {};
  const referral = publication?.referrals?.[entry.referralCode] || {};
  const confirmations = Math.max(0, Number(referral.confirmations) || 0), counts = referral.responses && typeof referral.responses === 'object' ? referral.responses : {};
  const responses = list(contest.shareResponseRules).map((rule) => {
    const count = Math.max(0, Number(counts[rule.id]) || 0), points = Math.max(0, Number(rule.points) || 0);
    return { id: rule.id, label: rule.label, count, pointsEach: points, points: Number((count * points).toFixed(2)) };
  });
  const rawPoints = responses.reduce((sum, item) => sum + item.points, 0);
  return { confirmations, responses, rawPoints: Number(rawPoints.toFixed(2)), points: Number(rawPoints.toFixed(2)), capped: false };
}

function shareConfirmations(analytics = {}, contest = {}, entry = {}) {
  return shareEvidence(analytics, contest, entry).confirmations;
}

function scoredEntry(entry, contest, analytics) {
  const share = shareEvidence(analytics, contest, entry);
  const taskPoints = Math.max(0, Number(entry.taskScore) || 0), purchasePoints = contestPurchasePoints(entry, contest);
  return { ...entry, shareConfirmations: share.confirmations, shareResponses: share.responses, scoreBreakdown: { taskPoints, sharePoints: share.points, purchasePoints, total: contestEntryTotal(entry, contest, share) }, totalScore: contestEntryTotal(entry, contest, share) };
}

function scoredEntries(entries, contest, analytics) {
  return entries.filter((entry) => entry.contestId === contest.id).map((entry) => scoredEntry(entry, contest, analytics))
    .sort((a, b) => b.totalScore - a.totalScore || b.scoreBreakdown.taskPoints - a.scoreBreakdown.taskPoints || b.scoreBreakdown.sharePoints - a.scoreBreakdown.sharePoints || Number(b.purchaseVerified) - Number(a.purchaseVerified) || String(a.submittedAt).localeCompare(String(b.submittedAt)));
}

function contestStats(contest, entries, analytics) {
  const rows = scoredEntries(entries, contest, analytics);
  return {
    total: rows.length, submitted: rows.filter((item) => item.status === 'submitted').length,
    approved: rows.filter((item) => item.status === 'approved').length, rejected: rows.filter((item) => ['rejected', 'disqualified'].includes(item.status)).length,
    topScore: rows.find((item) => item.status === 'approved')?.totalScore || 0,
  };
}

function contestShareLink(contest, entry) {
  if (!contest.shareRequired || !entry.referralCode || !secret()) return '';
  const token = createCustomerPublicationToken({ publicationId: contest.sharePublicationId, referralCode: entry.referralCode }, secret());
  return `${origin()}/?awref=${encodeURIComponent(token)}#/konkurs/${encodeURIComponent(contest.slug)}`;
}

function contestPublicationsFromSettings(record = {}) {
  const settings = record?.data?.artway_ustawienia;
  const hasOwn = settings && typeof settings === 'object' && Object.prototype.hasOwnProperty.call(settings, 'publikacjeKlienta');
  return normalizeCustomerPublications(hasOwn ? settings.publikacjeKlienta : undefined, { fallback: !hasOwn });
}

function publicationCoverageError(contest, publications = []) {
  if (!contest.shareRequired) return '';
  const publication = publications.find((item) => item.id === contest.sharePublicationId);
  if (!publication?.active) return 'Wybierz aktywną publikację powitalną dla linków uczestników.';
  const contestStart = Date.parse(contest.startsAt || ''), contestEnd = Date.parse(contest.endsAt || '');
  const publicationStart = Date.parse(publication.startAt || ''), publicationEnd = Date.parse(publication.endAt || '');
  if (Number.isFinite(publicationStart) && publicationStart > contestStart) return 'Publikacja powitalna rozpoczyna się później niż konkurs.';
  if (Number.isFinite(publicationEnd) && publicationEnd < contestEnd) return 'Publikacja powitalna kończy się wcześniej niż konkurs.';
  return '';
}

function readinessWithPublication(contest, publications) {
  const readiness = contestPublicationCheck(contest), publicationError = publicationCoverageError(contest, publications);
  return publicationError ? { ready: false, errors: [...readiness.errors, publicationError] } : readiness;
}

export function createContestCenterRoute({ read, readVersioned, writeIfVersion, respond, isAdmin, sessionOf, rateLimit } = {}) {
  if (![read, readVersioned, writeIfVersion, respond, isAdmin, sessionOf].every((item) => typeof item === 'function')) throw new Error('Centrum konkursów wymaga pełnego repozytorium i autoryzacji.');
  const change = async (key, fallback, mutate) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const version = await readVersioned(key, fallback), next = await mutate(structuredClone(version.value || fallback));
      const write = await writeIfVersion(key, next, version); if (write?.modified) return next;
    }
    throw Object.assign(new Error('Dane konkursu zmieniły się równocześnie. Spróbuj ponownie.'), { status: 409, code: 'contest_write_conflict' });
  };
  const state = async () => normalizeContestState(await read(STATE_KEY, defaultContestState()));
  const entries = async () => list((await read(ENTRIES_KEY, defaultContestEntries()))?.items).map(normalizeContestEntry);
  const analytics = async () => await read(ANALYTICS_KEY, { publications: {} });
  const quizAttempts = async () => list((await read(QUIZ_ATTEMPTS_KEY, defaultQuizAttempts()))?.items).map(normalizeQuizAttempt);

  return async function contestCenterRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    const limited = typeof rateLimit === 'function' ? rateLimit(req, action, action.startsWith('contest-admin') ? 180 : 60, 60_000) : null;
    if (limited) return limited;
    const currentState = await state(), settings = currentState.settings;

    if (action === 'contest-public-list') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!settings.publicPageEnabled) return respond({ ok: true, contests: [], settings: { publicPageEnabled: false } });
      const contests = currentState.contests.filter((item) => !['draft', 'paused', 'cancelled'].includes(contestEffectiveStatus(item))).map((item) => contestPublicView(item));
      return respond({ ok: true, contests, settings: { publicPageEnabled: true, rankingVisibility: settings.rankingVisibility, rulesPath: settings.rulesPath, privacyNoticePath: settings.privacyNoticePath } });
    }

    if (action === 'contest-public-detail') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const contest = currentState.contests.find((item) => item.slug === clean(url.searchParams.get('slug'), 100));
      if (!settings.publicPageEnabled || !contest || ['draft', 'paused', 'cancelled'].includes(contestEffectiveStatus(contest))) return respond({ ok: false, error: 'Nie znaleziono dostępnego konkursu.' }, 404);
      let ranking = [];
      if (contestEffectiveStatus(contest) === 'completed' && settings.rankingVisibility === 'after_end') {
        const [allEntries, metrics] = await Promise.all([entries(), analytics()]);
        ranking = scoredEntries(allEntries, contest, metrics).filter((item) => item.status === 'approved').slice(0, 100).map((item, index) => ({ place: index + 1, participant: contestParticipantAlias(item), score: item.totalScore, winner: item.id === contest.winnerEntryId }));
      }
      return respond({ ok: true, contest: contestPublicView(contest, { includeRules: true, ranking }) });
    }

    if (action === 'contest-my-entry') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = sessionOf(req), contest = currentState.contests.find((item) => item.id === clean(url.searchParams.get('contestId'), 100));
      if (!session?.email) return respond({ ok: true, authenticated: false, entry: null });
      if (!contest) return respond({ ok: false, error: 'Nie znaleziono konkursu.' }, 404);
      const accountKey = contestAccountKey(session.email, secret()), entry = (await entries()).find((item) => item.contestId === contest.id && item.accountKey === accountKey) || null;
      const metrics = entry ? await analytics() : null;
      return respond({ ok: true, authenticated: true, entry: entry ? { ...scoredEntry(entry, contest, metrics), email: undefined, addressKey: undefined, accountKey: undefined, phoneKey: undefined, shareLink: contestShareLink(contest, entry) } : null });
    }

    if (action === 'contest-quiz-start') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = sessionOf(req); if (!session?.email || !session?.account) return respond({ ok: false, error: 'Zaloguj się, aby rozpocząć quiz.', code: 'contest_login_required' }, 401);
      const body = await req.json().catch(() => ({})), contest = currentState.contests.find((item) => item.id === clean(body.contestId, 100));
      if (!contest || contest.contestType !== 'quiz_abc' || contestEffectiveStatus(contest) !== 'active') return respond({ ok: false, error: 'Ten quiz nie jest teraz dostępny.' }, 409);
      if (body.rulesAccepted !== true || body.privacyAccepted !== true) return respond({ ok: false, error: 'Przed startem zaakceptuj regulamin i zasady prywatności.' }, 422);
      const accountKey = contestAccountKey(session.email, secret());
      if ((await entries()).some((entry) => entry.contestId === contest.id && entry.accountKey === accountKey)) return respond({ ok: false, error: 'To konto ma już zgłoszenie w tym konkursie.', code: 'contest_duplicate_account' }, 409);
      let attempt;
      await change(QUIZ_ATTEMPTS_KEY, defaultQuizAttempts(), (value) => {
        const items = list(value.items).map(normalizeQuizAttempt), existing = items.find((item) => item.contestId === contest.id && item.accountKey === accountKey);
        attempt = existing || normalizeQuizAttempt({ id: `quiz_${crypto.randomUUID()}`, contestId: contest.id, accountKey, status: 'active', index: 0, answers: {}, baseScore: 0, timeBonus: 0, startedAt: Date.now(), questionStartedAt: Date.now() });
        return existing ? value : { version: 1, items: [...items, attempt].slice(-20_000), updatedAt: new Date().toISOString() };
      });
      const question = contest.quizQuestions[attempt.index];
      return respond({ ok: true, attempt: { id: attempt.id, status: attempt.status, progress: attempt.index, total: contest.quizQuestions.length, questionStartedAt: attempt.questionStartedAt, question: question ? publicQuizQuestion(question, attempt.index, contest.quizQuestions.length) : null } });
    }

    if (action === 'contest-quiz-answer') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = sessionOf(req); if (!session?.email) return respond({ ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.', code: 'contest_login_required' }, 401);
      const body = await req.json().catch(() => ({})), attemptId = clean(body.attemptId, 120), questionId = clean(body.questionId, 100), optionId = clean(body.optionId, 30).toLowerCase(), accountKey = contestAccountKey(session.email, secret());
      let updatedAttempt, contest;
      try {
        await change(QUIZ_ATTEMPTS_KEY, defaultQuizAttempts(), (value) => {
          const items = list(value.items).map(normalizeQuizAttempt), current = items.find((item) => item.id === attemptId && item.accountKey === accountKey);
          if (!current) throw Object.assign(new Error('Nie znaleziono rozpoczętego quizu.'), { status: 404 });
          contest = currentState.contests.find((item) => item.id === current.contestId);
          if (!contest || contestEffectiveStatus(contest) !== 'active' || current.status !== 'active') throw Object.assign(new Error('Ten etap quizu jest już zamknięty.'), { status: 409 });
          const question = contest.quizQuestions[current.index], option = list(question?.options).find((item) => item.id === optionId);
          if (!question || question.id !== questionId) throw Object.assign(new Error('To pytanie zostało już zamknięte. Odśwież widok quizu.'), { status: 409 });
          if (!question || !option) throw Object.assign(new Error('Wybierz jedną z dostępnych odpowiedzi.'), { status: 422 });
          const now = Date.now(), elapsedMs = Math.max(0, now - current.questionStartedAt), correct = option.id === question.correctOptionId, bonus = correct ? quizTimeBonus(elapsedMs) : 0, base = correct ? Number(question.points) || 0 : 0;
          const nextIndex = current.index + 1, completed = nextIndex >= contest.quizQuestions.length;
          updatedAttempt = normalizeQuizAttempt({ ...current, index: nextIndex, answers: { ...current.answers, [question.id]: option.id }, baseScore: current.baseScore + base, timeBonus: current.timeBonus + bonus, status: completed ? 'completed' : 'active', questionStartedAt: completed ? current.questionStartedAt : now, completedAt: completed ? now : 0 });
          return { version: 1, items: items.map((item) => item.id === current.id ? updatedAttempt : item), updatedAt: new Date().toISOString() };
        });
      } catch (error) { return respond({ ok: false, error: error.message || 'Nie zapisano odpowiedzi.' }, error.status || 422); }
      const nextQuestion = contest.quizQuestions[updatedAttempt.index];
      return respond({ ok: true, attempt: { id: updatedAttempt.id, status: updatedAttempt.status, progress: updatedAttempt.index, total: contest.quizQuestions.length, questionStartedAt: updatedAttempt.questionStartedAt, question: nextQuestion ? publicQuizQuestion(nextQuestion, updatedAttempt.index, contest.quizQuestions.length) : null, ...(updatedAttempt.status === 'completed' ? { baseScore: updatedAttempt.baseScore, timeBonus: updatedAttempt.timeBonus, totalScore: updatedAttempt.baseScore + updatedAttempt.timeBonus } : {}) } });
    }

    if (action === 'contest-submit') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const session = sessionOf(req); if (!session?.email || !session?.account) return respond({ ok: false, error: 'Zaloguj się na zweryfikowane konto, aby wziąć udział.', code: 'contest_login_required' }, 401);
      const body = await req.json().catch(() => ({})), contest = currentState.contests.find((item) => item.id === clean(body.contestId, 100));
      if (!contest || contestEffectiveStatus(contest) !== 'active') return respond({ ok: false, error: 'Ten konkurs nie przyjmuje teraz zgłoszeń.' }, 409);
      const accountKey = contestAccountKey(session.email, secret());
      const quizAttempt = contest.contestType === 'quiz_abc' ? (await quizAttempts()).find((item) => item.id === clean(body.quizAttemptId, 120) && item.contestId === contest.id && item.accountKey === accountKey && item.status === 'completed') : null;
      if (contest.contestType === 'quiz_abc' && !quizAttempt) return respond({ ok: false, error: 'Najpierw ukończ wszystkie pytania uruchomione przyciskiem Start.' }, 422);
      const quizResult = quizAttempt ? scoreQuizSubmission(contest, quizAttempt.answers) : null;
      const quiz = quizAttempt ? { ...quizResult, score: quizAttempt.baseScore + quizAttempt.timeBonus, baseScore: quizAttempt.baseScore, timeBonus: quizAttempt.timeBonus } : null;
      const answer = quiz ? quiz.summary : clean(body.answer, settings.maxEntryLength);
      if (!quiz && answer.length < contest.minAnswerLength) return respond({ ok: false, error: `Odpowiedź musi mieć co najmniej ${contest.minAnswerLength} znaków.` }, 422);
      if (body.rulesAccepted !== true || body.privacyAccepted !== true) return respond({ ok: false, error: 'Potwierdź regulamin konkursu i zasady prywatności.' }, 422);
      const ordersRecord = await read('orders', { items: [] }), customerOrders = list(ordersRecord?.items).filter((item) => clean(item?.email, 300).toLowerCase() === String(session.email).toLowerCase() && !['anulowane', 'cancelled'].includes(clean(item?.status, 80).toLowerCase())).sort((a, b) => orderTime(b) - orderTime(a));
      const qualifyingOrder = customerOrders.find((item) => orderTime(item) >= Date.parse(contest.startsAt || 0) && orderAmount(item) >= contest.purchaseMinAmount);
      const profile = participantProfile(session.account, qualifyingOrder || customerOrders[0] || {});
      const addressKey = contestAddressKey(profile, secret()), participantPhoneKey = phoneKey(profile.telefon);
      if (settings.requireAddress && !hasFullAddress(profile)) return respond({ ok: false, error: 'Uzupełnij pełny adres w swoim koncie. Służy tylko do kontroli zasady: jeden adres — jedno konto i do wysyłki nagrody kurierem.' }, 422);
      const allEntries = await entries(), contestEntries = allEntries.filter((item) => item.contestId === contest.id);
      if (contestEntries.some((item) => item.accountKey === accountKey)) return respond({ ok: false, error: 'To konto ma już zgłoszenie w tym konkursie.', code: 'contest_duplicate_account' }, 409);
      if (settings.oneAddressPerContest && addressKey && contestEntries.some((item) => item.addressKey === addressKey)) return respond({ ok: false, error: 'Z tego adresu istnieje już zgłoszenie w tym konkursie.', code: 'contest_duplicate_address' }, 409);
      if (settings.onePhonePerContest && participantPhoneKey && contestEntries.some((item) => item.phoneKey === participantPhoneKey)) return respond({ ok: false, error: 'Ten numer telefonu jest już powiązany ze zgłoszeniem.', code: 'contest_duplicate_phone' }, 409);
      const createdAt = new Date().toISOString(), id = `entry_${crypto.randomUUID()}`, referralCode = `c-${contest.id.slice(0, 24)}-${accountKey.slice(0, 12)}`;
      const entry = normalizeContestEntry({ id, contestId: contest.id, accountKey, addressKey, phoneKey: participantPhoneKey, participantName: session.account.imie || session.name || session.email, email: session.email, answer, quizAnswers: quiz?.answers || {}, quizScore: quiz?.baseScore || 0, quizTimeBonus: quiz?.timeBonus || 0, taskScore: quiz?.score || 0, status: settings.manualModeration ? 'submitted' : 'approved', purchaseVerified: !!qualifyingOrder, purchaseBonusPoints: qualifyingOrder ? contest.purchaseBonusPoints : 0, purchaseOrderNumber: qualifyingOrder?.nr || qualifyingOrder?.id || '', referralCode, submittedAt: createdAt, updatedAt: createdAt });
      await change(ENTRIES_KEY, defaultContestEntries(), (value) => ({ version: 1, items: [...list(value.items).map(normalizeContestEntry), entry].slice(-20_000), updatedAt: createdAt }));
      if (quizAttempt) await change(QUIZ_ATTEMPTS_KEY, defaultQuizAttempts(), (value) => ({ version: 1, items: list(value.items).map(normalizeQuizAttempt).map((item) => item.id === quizAttempt.id ? { ...item, status: 'submitted', submittedAt: Date.now() } : item), updatedAt: createdAt }));
      const initialTaskPoints = Number(entry.taskScore) || 0, initialPurchasePoints = contestPurchasePoints(entry, contest), initialTotal = initialTaskPoints + initialPurchasePoints;
      return respond({ ok: true, entry: { id: entry.id, contestId: entry.contestId, status: entry.status, submittedAt: entry.submittedAt, quizScore: entry.quizScore, shareLink: contestShareLink(contest, entry), shareConfirmations: 0, shareResponses: [], scoreBreakdown: { taskPoints: initialTaskPoints, sharePoints: 0, purchasePoints: initialPurchasePoints, total: initialTotal }, totalScore: initialTotal } }, 201);
    }

    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    const [allEntries, metrics, storeSettings] = await Promise.all([entries(), analytics(), read('settings', { data: {} })]);
    const publications = contestPublicationsFromSettings(storeSettings);

    if (action === 'contest-admin-state') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      return respond({ ok: true, state: { ...currentState, sharePublications: publications.map((item) => ({ id: item.id, title: item.title, active: item.active, actions: item.actions })), contests: currentState.contests.map((item) => ({ ...item, rulesSections: contestRulesSections(item), effectiveStatus: contestEffectiveStatus(item), readiness: readinessWithPublication(item, publications), stats: contestStats(item, allEntries, metrics) })) } });
    }

    if (action === 'contest-admin-entries') {
      if (req.method !== 'GET') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const contestId = clean(url.searchParams.get('contestId'), 100), status = clean(url.searchParams.get('status'), 30), search = clean(url.searchParams.get('search'), 160).toLowerCase();
      const limit = Math.min(250, Math.max(10, Number(url.searchParams.get('limit')) || 100)), offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
      let rows = allEntries.filter((item) => !contestId || item.contestId === contestId);
      if (status) rows = rows.filter((item) => item.status === status);
      if (search) rows = rows.filter((item) => `${item.participantName} ${item.email} ${item.answer}`.toLowerCase().includes(search));
      rows = rows.map((entry) => { const contest = currentState.contests.find((item) => item.id === entry.contestId); return contest ? scoredEntry(entry, contest, metrics) : { ...entry, totalScore: entry.taskScore }; }).sort((a, b) => b.totalScore - a.totalScore || String(a.submittedAt).localeCompare(String(b.submittedAt)));
      return respond({ ok: true, entries: rows.slice(offset, offset + limit), total: rows.length, offset, limit });
    }

    if (action === 'contest-admin-save') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), rawContest = body.contest || {}, existing = currentState.contests.find((item) => item.id === clean(rawContest.id, 100));
      const requested = normalizeContest(existing ? rawContest : { ...rawContest, contestType: 'quiz_abc' });
      const contest = { ...requested, status: existing?.status || 'draft', winnerEntryId: existing?.winnerEntryId || '', winnerSelectedAt: existing?.winnerSelectedAt || '', createdAt: existing?.createdAt || requested.createdAt, updatedAt: new Date().toISOString() };
      const next = await change(STATE_KEY, defaultContestState(), (value) => { const normalized = normalizeContestState(value); return { ...normalized, contests: [contest, ...normalized.contests.filter((item) => item.id !== contest.id)], updatedAt: contest.updatedAt }; });
      return respond({ ok: true, contest: next.contests.find((item) => item.id === contest.id), readiness: readinessWithPublication(contest, publications) });
    }

    if (action === 'contest-admin-status') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), id = clean(body.contestId, 100), operation = clean(body.operation, 30), contest = currentState.contests.find((item) => item.id === id);
      if (!contest) return respond({ ok: false, error: 'Nie znaleziono konkursu.' }, 404);
      const readiness = readinessWithPublication(contest, publications); let status = contest.status;
      if (operation === 'publish') { if (!readiness.ready) return respond({ ok: false, error: 'Konkurs nie jest gotowy do publikacji.', details: readiness.errors }, 422); status = Date.parse(contest.startsAt) > Date.now() ? 'scheduled' : 'active'; }
      else if (operation === 'pause') status = 'paused'; else if (operation === 'resume') status = Date.parse(contest.endsAt) <= Date.now() ? 'review' : 'active';
      else if (operation === 'close') status = 'review'; else if (operation === 'cancel') status = 'cancelled'; else return respond({ ok: false, error: 'Nieprawidłowa zmiana statusu.' }, 422);
      const updatedAt = new Date().toISOString(), nextContest = { ...contest, status, updatedAt };
      await change(STATE_KEY, defaultContestState(), (value) => { const normalized = normalizeContestState(value); return { ...normalized, settings: operation === 'publish' ? { ...normalized.settings, publicPageEnabled: true } : normalized.settings, contests: normalized.contests.map((item) => item.id === id ? nextContest : item), updatedAt }; });
      return respond({ ok: true, contest: nextContest, effectiveStatus: contestEffectiveStatus(nextContest) });
    }

    if (action === 'contest-admin-score') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), id = clean(body.entryId, 120), allowed = new Set(['submitted', 'approved', 'rejected', 'disqualified']);
      const current = allEntries.find((item) => item.id === id); if (!current) return respond({ ok: false, error: 'Nie znaleziono zgłoszenia.' }, 404);
      const contest = currentState.contests.find((item) => item.id === current.contestId); if (!contest) return respond({ ok: false, error: 'Nie znaleziono konkursu dla zgłoszenia.' }, 404);
      const suppliedScores = contest.contestType === 'creative' && body.criterionScores && typeof body.criterionScores === 'object' ? body.criterionScores : null;
      const criterionScores = suppliedScores ? Object.fromEntries(contest.scoringCriteria.map((criterion) => [criterion.id, Math.min(criterion.maxPoints, Math.max(0, Number(suppliedScores[criterion.id]) || 0))])) : current.criterionScores;
      const taskScore = contest.contestType === 'quiz_abc' ? current.taskScore : suppliedScores ? Object.values(criterionScores).reduce((sum, value) => sum + value, 0) : Math.min(contest.taskMaxPoints, Math.max(0, Number(body.taskScore) || 0));
      const updated = normalizeContestEntry({ ...current, criterionScores, taskScore, status: allowed.has(body.status) ? body.status : current.status, moderationNote: body.moderationNote, updatedAt: new Date().toISOString() });
      await change(ENTRIES_KEY, defaultContestEntries(), (value) => ({ version: 1, items: list(value.items).map((item) => item.id === id ? updated : item), updatedAt: updated.updatedAt }));
      return respond({ ok: true, entry: updated });
    }

    if (action === 'contest-admin-winner') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), contest = currentState.contests.find((item) => item.id === clean(body.contestId, 100));
      if (!contest || !['review', 'completed'].includes(contestEffectiveStatus(contest))) return respond({ ok: false, error: 'Najpierw zamknij konkurs i zakończ ocenianie.' }, 409);
      const eligible = scoredEntries(allEntries, contest, metrics).filter((item) => item.status === 'approved' && (!contest.shareRequired || item.shareConfirmations >= contest.minimumConfirmedShares));
      if (!eligible.length) return respond({ ok: false, error: 'Nie ma jeszcze zgłoszenia spełniającego wszystkie warunki.' }, 422);
      const winner = eligible[0], updatedAt = new Date().toISOString(), completed = { ...contest, status: 'completed', winnerEntryId: winner.id, winnerSelectedAt: updatedAt, updatedAt };
      await change(STATE_KEY, defaultContestState(), (value) => { const normalized = normalizeContestState(value); return { ...normalized, contests: normalized.contests.map((item) => item.id === contest.id ? completed : item), updatedAt }; });
      return respond({ ok: true, winner: { ...winner, accountKey: undefined, addressKey: undefined, phoneKey: undefined }, contest: completed });
    }

    if (action === 'contest-admin-settings') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), nextSettings = normalizeContestSettings(body.settings || {}), updatedAt = new Date().toISOString();
      await change(STATE_KEY, defaultContestState(), (value) => ({ ...normalizeContestState(value), settings: nextSettings, updatedAt }));
      return respond({ ok: true, settings: nextSettings });
    }

    if (action === 'contest-admin-delete') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), id = clean(body.contestId, 100), contest = currentState.contests.find((item) => item.id === id);
      if (!contest) return respond({ ok: false, error: 'Nie znaleziono konkursu.' }, 404);
      if (!['draft', 'cancelled'].includes(contest.status) || allEntries.some((item) => item.contestId === id)) return respond({ ok: false, error: 'Można usunąć tylko pusty szkic lub anulowany konkurs bez zgłoszeń.' }, 409);
      const updatedAt = new Date().toISOString(); await change(STATE_KEY, defaultContestState(), (value) => { const normalized = normalizeContestState(value); return { ...normalized, contests: normalized.contests.filter((item) => item.id !== id), updatedAt }; });
      return respond({ ok: true, removed: true, contestId: id });
    }
    return null;
  };
}

export const contestCenterRouteInternals = Object.freeze({ STATE_KEY, ENTRIES_KEY, ANALYTICS_KEY, QUIZ_ATTEMPTS_KEY, orderAmount, orderTime, orderProfile, participantProfile, hasFullAddress, shareEvidence, shareConfirmations, scoredEntry, scoredEntries, contestShareLink, contestPublicationsFromSettings, publicationCoverageError, readinessWithPublication, scoreQuizSubmission, quizTimeBonus });
