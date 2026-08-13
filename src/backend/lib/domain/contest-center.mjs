import crypto from 'node:crypto';

const STATUSES = new Set(['draft', 'scheduled', 'active', 'paused', 'review', 'completed', 'cancelled']);
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'custom']);
const clean = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanMultiline = (value, max = 12_000) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const slug = (value, fallback = '') => clean(value, 100).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || fallback;
const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
const iso = (value) => Number.isFinite(Date.parse(String(value || ''))) ? new Date(value).toISOString() : '';
const list = (value) => Array.isArray(value) ? value : [];

const DEFAULT_SCORING_CRITERIA = Object.freeze([
  { id: 'jakosc', label: 'Jakość wykonania', description: 'Staranność, kompletność i poziom wykonania pracy.', maxPoints: 40 },
  { id: 'pomyslowosc', label: 'Pomysłowość', description: 'Oryginalność pomysłu i twórcze podejście do zadania.', maxPoints: 30 },
  { id: 'zgodnosc', label: 'Zgodność z zadaniem', description: 'Realizacja wszystkich wymagań opisanych w zadaniu.', maxPoints: 20 },
  { id: 'samodzielnosc', label: 'Samodzielność', description: 'Autorski charakter i samodzielne przygotowanie pracy.', maxPoints: 10 },
]);

export const DEFAULT_QUIZ_QUESTIONS = Object.freeze([
  { id: 'stolica', prompt: 'Które miasto jest stolicą Polski?', options: [{ id: 'a', label: 'Kraków' }, { id: 'b', label: 'Warszawa' }, { id: 'c', label: 'Gdańsk' }], correctOptionId: 'b', points: 8 },
  { id: 'morze', prompt: 'Nad którym morzem leży Polska?', options: [{ id: 'a', label: 'Morzem Bałtyckim' }, { id: 'b', label: 'Morzem Czarnym' }, { id: 'c', label: 'Morzem Północnym' }], correctOptionId: 'a', points: 8 },
  { id: 'barwy', prompt: 'Jakie są barwy narodowe Polski?', options: [{ id: 'a', label: 'Biało-czerwone' }, { id: 'b', label: 'Biało-niebieskie' }, { id: 'c', label: 'Czerwono-zielone' }], correctOptionId: 'a', points: 8 },
  { id: 'rzeka', prompt: 'Która rzeka jest najdłuższa w Polsce?', options: [{ id: 'a', label: 'Odra' }, { id: 'b', label: 'Warta' }, { id: 'c', label: 'Wisła' }], correctOptionId: 'c', points: 8 },
  { id: 'waluta', prompt: 'Jaka jest waluta obowiązująca w Polsce?', options: [{ id: 'a', label: 'Euro' }, { id: 'b', label: 'Złoty' }, { id: 'c', label: 'Korona' }], correctOptionId: 'b', points: 8 },
  { id: 'wawel', prompt: 'W którym mieście znajduje się Zamek Królewski na Wawelu?', options: [{ id: 'a', label: 'W Krakowie' }, { id: 'b', label: 'W Poznaniu' }, { id: 'c', label: 'We Wrocławiu' }], correctOptionId: 'a', points: 8 },
  { id: 'gory', prompt: 'Które pasmo obejmuje najwyższe szczyty Polski?', options: [{ id: 'a', label: 'Bieszczady' }, { id: 'b', label: 'Tatry' }, { id: 'c', label: 'Góry Stołowe' }], correctOptionId: 'b', points: 8 },
  { id: 'konstytucja', prompt: 'Którego dnia obchodzimy Święto Konstytucji 3 Maja?', options: [{ id: 'a', label: '1 maja' }, { id: 'b', label: '2 maja' }, { id: 'c', label: '3 maja' }], correctOptionId: 'c', points: 8 },
  { id: 'godlo', prompt: 'Jakie zwierzę znajduje się w godle Polski?', options: [{ id: 'a', label: 'Biały orzeł' }, { id: 'b', label: 'Złoty lew' }, { id: 'c', label: 'Czarny bocian' }], correctOptionId: 'a', points: 8 },
  { id: 'chopin', prompt: 'Z jaką dziedziną jest przede wszystkim związany Fryderyk Chopin?', options: [{ id: 'a', label: 'Z malarstwem' }, { id: 'b', label: 'Z muzyką' }, { id: 'c', label: 'Z astronomią' }], correctOptionId: 'b', points: 8 },
]);

const DEFAULT_RESPONSE_RULES = Object.freeze([
  { id: 'zakupy', label: 'Idę na zakupy', points: 3 },
  { id: 'konkurs', label: 'Biorę udział w konkursie', points: 3 },
  { id: 'promocje', label: 'Sprawdzę promocje', points: 2 },
  { id: 'konto', label: 'Założę konto', points: 2 },
  { id: 'nowosci', label: 'Zobaczę nowości', points: 1 },
  { id: 'mily-dzien', label: 'Miłego dnia', points: 1 },
  { id: 'zamkniecie', label: 'Zamknięcie powitania', points: 0 },
]);

function normalizeScoringCriteria(value) {
  const source = list(value).length ? list(value) : DEFAULT_SCORING_CRITERIA;
  const seen = new Set(), result = [];
  for (const [index, raw] of source.slice(0, 8).entries()) {
    const id = slug(raw?.id || raw?.label, `kryterium-${index + 1}`);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ id, label: clean(raw?.label, 80) || `Kryterium ${index + 1}`, description: cleanMultiline(raw?.description, 500), maxPoints: number(raw?.maxPoints, 0, 1, 1000) });
  }
  return result.length ? result : DEFAULT_SCORING_CRITERIA.map((item) => ({ ...item }));
}

function normalizeResponseRules(value, legacyPoints = 1) {
  let source = list(value);
  if (!source.length && value && typeof value === 'object') source = Object.entries(value).map(([id, points]) => ({ id, label: id, points }));
  if (!source.length) source = DEFAULT_RESPONSE_RULES.map((item) => ({ ...item, points: item.id === 'zamkniecie' ? 0 : legacyPoints }));
  const seen = new Set(), result = [];
  for (const [index, raw] of source.slice(0, 12).entries()) {
    const id = slug(raw?.id || raw?.label, `reakcja-${index + 1}`);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, label: clean(raw?.label, 80) || id, points: number(raw?.points, 0, 0, 100) });
  }
  if (!seen.has('zamkniecie')) result.push({ id: 'zamkniecie', label: 'Zamknięcie powitania', points: 0 });
  return result;
}

function normalizeQuizQuestions(value) {
  const source = list(value).length ? list(value) : DEFAULT_QUIZ_QUESTIONS;
  const seen = new Set(), result = [];
  for (const [index, raw] of source.slice(0, 30).entries()) {
    const id = slug(raw?.id || raw?.prompt, `pytanie-${index + 1}`);
    if (!id || seen.has(id)) continue;
    const optionsSource = list(raw?.options).slice(0, 6), optionSeen = new Set(), options = [];
    for (const [optionIndex, optionRaw] of optionsSource.entries()) {
      const option = typeof optionRaw === 'string' ? { id: String.fromCharCode(97 + optionIndex), label: optionRaw } : optionRaw || {};
      const optionId = slug(option.id || String.fromCharCode(97 + optionIndex), String.fromCharCode(97 + optionIndex)).slice(0, 20);
      if (!optionId || optionSeen.has(optionId)) continue;
      optionSeen.add(optionId); options.push({ id: optionId, label: clean(option.label, 220) });
    }
    if (options.length < 2) continue;
    const correctOptionId = options.some((option) => option.id === String(raw?.correctOptionId || '')) ? String(raw.correctOptionId) : options[0].id;
    seen.add(id); result.push({ id, prompt: cleanMultiline(raw?.prompt, 700), options, correctOptionId, points: number(raw?.points, 8, 1, 100) });
  }
  return result.length ? result : DEFAULT_QUIZ_QUESTIONS.map((item) => ({ ...item, options: item.options.map((option) => ({ ...option })) }));
}

export const DEFAULT_CONTEST_SETTINGS = Object.freeze({
  publicPageEnabled: true,
  requireAccount: true,
  requireAddress: true,
  oneAccountPerContest: true,
  oneAddressPerContest: true,
  onePhonePerContest: true,
  courierPrizeOnly: true,
  rankingVisibility: 'after_end',
  manualModeration: true,
  maxEntryLength: 4000,
  privacyNoticePath: '/prywatnosc',
  rulesPath: '/regulamin',
  sharePublicationId: 'powitanie-z-polecenia',
  aiDraftOnly: true,
});

export const DEFAULT_CONTEST_TEMPLATES = Object.freeze([
  { id: 'daily', label: 'Codzienny • 50 zł', frequency: 'daily', prizeAmount: 50, durationHours: 24, icon: '☀️' },
  { id: 'weekly', label: 'Tygodniowy • 100 zł', frequency: 'weekly', prizeAmount: 100, durationHours: 168, icon: '📅' },
  { id: 'monthly', label: 'Miesięczny • 200 zł', frequency: 'monthly', prizeAmount: 200, durationHours: 720, icon: '🏆' },
]);

export function defaultContestState() {
  return { version: 1, settings: { ...DEFAULT_CONTEST_SETTINGS }, templates: DEFAULT_CONTEST_TEMPLATES.map((item) => ({ ...item })), contests: [], updatedAt: null };
}

export function defaultContestEntries() {
  return { version: 1, items: [], updatedAt: null };
}

export function normalizeContestSettings(raw = {}) {
  const visibility = ['after_end', 'never'].includes(raw.rankingVisibility) ? raw.rankingVisibility : 'after_end';
  return {
    publicPageEnabled: raw.publicPageEnabled !== false,
    requireAccount: true,
    requireAddress: raw.requireAddress !== false,
    oneAccountPerContest: true,
    oneAddressPerContest: raw.oneAddressPerContest !== false,
    onePhonePerContest: raw.onePhonePerContest !== false,
    courierPrizeOnly: true,
    rankingVisibility: visibility,
    manualModeration: raw.manualModeration !== false,
    maxEntryLength: number(raw.maxEntryLength, 4000, 300, 12_000),
    privacyNoticePath: safeInternalPath(raw.privacyNoticePath, '/prywatnosc'),
    rulesPath: safeInternalPath(raw.rulesPath, '/regulamin'),
    sharePublicationId: slug(raw.sharePublicationId, 'powitanie-z-polecenia'),
    aiDraftOnly: true,
  };
}

export function normalizeContestTemplate(raw = {}, index = 0) {
  const frequency = FREQUENCIES.has(raw.frequency) ? raw.frequency : 'custom';
  return {
    id: slug(raw.id, `template-${index + 1}`), label: clean(raw.label, 90) || 'Własny konkurs', frequency,
    prizeAmount: number(raw.prizeAmount, 50, 0, 100_000), durationHours: number(raw.durationHours, 168, 1, 8760), icon: clean(raw.icon, 8) || '🏆',
  };
}

export function normalizeContest(raw = {}, index = 0) {
  const id = slug(raw.id, `contest-${Date.now()}-${index + 1}`), contestSlug = slug(raw.slug || raw.title, id);
  const status = STATUSES.has(raw.status) ? raw.status : 'draft';
  const frequency = FREQUENCIES.has(raw.frequency) ? raw.frequency : 'custom';
  const scoringCriteria = normalizeScoringCriteria(raw.scoringCriteria);
  const contestType = raw.contestType === 'creative' ? 'creative' : 'quiz_abc';
  const quizQuestions = normalizeQuizQuestions(raw.quizQuestions);
  const sharePointValue = number(raw.sharePointValue, 1, 0, 100);
  const shareResponseRules = normalizeResponseRules(raw.shareResponseRules || raw.shareResponsePoints, sharePointValue);
  const endsAt = iso(raw.endsAt);
  const quizBaseMaxPoints = quizQuestions.reduce((sum, item) => sum + item.points, 0);
  const purchaseBonusPoints = Number(raw.purchaseBonusPoints) > 0 ? number(raw.purchaseBonusPoints, 3, 1, 1000) : 1 + (Number.parseInt(crypto.createHash('sha256').update(id).digest('hex').slice(0, 8), 16) % 5);
  const taskPrompt = contestType === 'quiz_abc'
    ? cleanMultiline(raw.taskPrompt, 4000).replace(/Odpowiedzi można zmieniać do chwili wysłania całego zgłoszenia\.?/i, 'Po zatwierdzeniu odpowiedzi pojawia się kolejne pytanie; poprzedniej odpowiedzi nie można już zmienić.')
    : cleanMultiline(raw.taskPrompt, 4000);
  return {
    id, slug: contestSlug, status, frequency, icon: clean(raw.icon, 8) || '🏆',
    title: clean(raw.title, 140) || 'Nowy konkurs Artway-TM', eyebrow: clean(raw.eyebrow, 60) || 'KONKURS ARTWAY-TM',
    description: cleanMultiline(raw.description, 1600), contestType, taskTitle: clean(raw.taskTitle, 180) || (contestType === 'quiz_abc' ? 'Quiz wiedzy ABC' : 'Zadanie konkursowe'),
    taskPrompt, prizeAmount: number(raw.prizeAmount, 50, 0, 100_000),
    prizeDescription: clean(raw.prizeDescription, 240) || 'Nagroda wysyłana kurierem', prizeDelivery: 'courier',
    startsAt: iso(raw.startsAt), endsAt, resultsAnnouncementAt: iso(raw.resultsAnnouncementAt) || endsAt,
    winnerConfirmationHours: number(raw.winnerConfirmationHours, 72, 12, 720), prizeDeliveryDays: number(raw.prizeDeliveryDays, 14, 1, 60),
    complaintDeadlineDays: number(raw.complaintDeadlineDays, 14, 1, 90), complaintResponseDays: number(raw.complaintResponseDays, 14, 1, 90),
    territory: clean(raw.territory, 120) || 'Rzeczpospolita Polska', minimumAge: number(raw.minimumAge, 18, 13, 100),
    organizerName: clean(raw.organizerName, 200) || 'Artway-TM', organizerAddress: clean(raw.organizerAddress, 300),
    organizerTaxId: clean(raw.organizerTaxId, 30), contactEmail: clean(raw.contactEmail, 300).toLowerCase(),
    taxNote: cleanMultiline(raw.taxNote, 1200), tieBreakPolicy: 'quiz_then_promo_then_purchase_then_earlier',
    purchaseRequired: false,
    purchaseMinAmount: number(raw.purchaseMinAmount, 0, 0, 100_000), minAnswerLength: number(raw.minAnswerLength, 40, 10, 1000),
    shareRequired: raw.shareRequired !== false, minimumConfirmedShares: number(raw.minimumConfirmedShares, 3, 0, 100),
    sharePointValue, shareResponseRules, shareMaxPoints: null,
    scoringCriteria, quizQuestions, quizMaxPoints: quizBaseMaxPoints,
    quizTimeBonusMaxPoints: contestType === 'quiz_abc' ? quizQuestions.length * 3 : 0,
    taskMaxPoints: contestType === 'quiz_abc' ? quizBaseMaxPoints + quizQuestions.length * 3 : scoringCriteria.reduce((sum, item) => sum + item.maxPoints, 0),
    purchaseBonusPoints,
    scoringInstructions: cleanMultiline(raw.scoringInstructions, 1800) || 'Oceń jakość, pomysłowość i zgodność odpowiedzi z zadaniem.',
    announcementText: cleanMultiline(raw.announcementText, 1200), promotionPlan: cleanMultiline(raw.promotionPlan, 2400),
    rulesText: cleanMultiline(raw.rulesText, 16_000), rulesApproved: raw.rulesApproved === true,
    legalReviewConfirmed: raw.legalReviewConfirmed === true, sharePublicationId: slug(raw.sharePublicationId, 'powitanie-z-polecenia'),
    winnerEntryId: clean(raw.winnerEntryId, 120), winnerSelectedAt: iso(raw.winnerSelectedAt),
    createdAt: iso(raw.createdAt) || new Date().toISOString(), updatedAt: iso(raw.updatedAt) || new Date().toISOString(),
  };
}

export function normalizeContestState(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const seen = new Set(), contests = [];
  for (const [index, raw] of list(source.contests).slice(0, 250).entries()) {
    const item = normalizeContest(raw, index);
    if (seen.has(item.id) || contests.some((entry) => entry.slug === item.slug)) continue;
    seen.add(item.id); contests.push(item);
  }
  const templates = list(source.templates).length ? list(source.templates).slice(0, 20).map(normalizeContestTemplate) : DEFAULT_CONTEST_TEMPLATES.map((item) => ({ ...item }));
  return { version: 1, settings: normalizeContestSettings(source.settings), templates, contests, updatedAt: iso(source.updatedAt) || null };
}

export function safeInternalPath(value, fallback = '#/') {
  const raw = String(value || '').trim();
  if (/^#\/[a-z0-9_~!$&'()*+,;=:@%./-]*$/i.test(raw)) return raw.slice(0, 240);
  if (/^\/[a-z0-9_~!$&'()*+,;=:@%./?#-]*$/i.test(raw) && !raw.startsWith('//')) return raw.slice(0, 240);
  return fallback;
}

export function contestEffectiveStatus(contest, now = new Date()) {
  if (['paused', 'completed', 'cancelled', 'review'].includes(contest?.status)) return contest.status;
  const time = now.getTime(), start = Date.parse(contest?.startsAt || ''), end = Date.parse(contest?.endsAt || '');
  if (Number.isFinite(end) && end <= time) return 'review';
  if (Number.isFinite(start) && start > time) return 'scheduled';
  return contest?.status === 'active' || contest?.status === 'scheduled' ? 'active' : 'draft';
}

export function contestPublicationCheck(contest) {
  const errors = [];
  if (contest.title.length < 8) errors.push('Tytuł musi mieć co najmniej 8 znaków.');
  if (contest.description.length < 40) errors.push('Opis musi mieć co najmniej 40 znaków.');
  if (contest.taskPrompt.length < 40) errors.push('Opis zadania konkursowego musi mieć co najmniej 40 znaków.');
  if (!contest.startsAt || !contest.endsAt || Date.parse(contest.endsAt) <= Date.parse(contest.startsAt)) errors.push('Ustaw prawidłowy początek i koniec konkursu.');
  if (!contest.organizerName || !contest.organizerAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contest.contactEmail)) errors.push('Uzupełnij nazwę, pełny adres i prawidłowy e-mail organizatora.');
  if (contest.taxNote.length < 20) errors.push('Uzupełnij sprawdzoną informację o rozliczeniu podatkowym nagrody.');
  if (!contest.resultsAnnouncementAt || Date.parse(contest.resultsAnnouncementAt) < Date.parse(contest.endsAt)) errors.push('Termin ogłoszenia wyników nie może być wcześniejszy niż koniec konkursu.');
  if (contest.contestType === 'quiz_abc') {
    if (contest.quizQuestions.length < 3) errors.push('Quiz ABC musi mieć co najmniej 3 kompletne pytania.');
    if (contest.quizQuestions.some((question) => question.prompt.length < 8 || question.options.length < 2 || !question.options.some((option) => option.id === question.correctOptionId))) errors.push('Każde pytanie ABC musi mieć treść, odpowiedzi i wskazaną prawidłową odpowiedź.');
  } else if (!contest.scoringCriteria.length || contest.taskMaxPoints <= 0) errors.push('Dodaj co najmniej jedno kryterium oceny pracy.');
  if (contest.shareRequired && !contest.shareResponseRules.length) errors.push('Ustal punkty dla reakcji z linku promocyjnego.');
  if (contest.rulesText.length > 0 && contest.rulesText.length < 40) errors.push('Dodatkowe postanowienia regulaminu są zbyt krótkie.');
  if (!contest.rulesApproved || !contest.legalReviewConfirmed) errors.push('Regulamin wymaga zatwierdzenia i potwierdzenia przeglądu prawnego.');
  if (contest.prizeAmount <= 0 && !contest.prizeDescription) errors.push('Opisz nagrodę.');
  return { ready: errors.length === 0, errors };
}

const plDate = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Warsaw' }).format(parsed) : 'termin wskazany na stronie konkursu';
};

export function contestRulesSections(raw = {}) {
  const contest = normalizeContest(raw);
  const criteria = contest.scoringCriteria.map((item) => `${item.label}: 0–${item.maxPoints} pkt${item.description ? ` — ${item.description}` : ''}`).join('\n');
  const reactions = contest.shareResponseRules.map((item) => `${item.label}: ${item.points} pkt za pierwsze potwierdzenie danego odbiorcy`).join('\n');
  const mainScoring = contest.contestType === 'quiz_abc'
    ? `Głównym zadaniem jest quiz ABC obejmujący ${contest.quizQuestions.length} pytań. Po naciśnięciu przycisku „Start” pytania są udostępniane pojedynczo. Czas każdego pytania mierzy serwer od jego udostępnienia do zapisania odpowiedzi. Zatwierdzonej odpowiedzi nie można zmienić. Za prawidłową odpowiedź przyznaje się liczbę punktów przypisaną do pytania, za błędną albo brak odpowiedzi — 0 pkt. Dodatkowo prawidłowa odpowiedź zapisana w czasie do 5 sekund otrzymuje 3 pkt, powyżej 5 do 10 sekund — 2 pkt, powyżej 10 do 20 sekund — 1 pkt, a późniejsza — 0 pkt bonusu czasowego. Błędna odpowiedź nie otrzymuje bonusu czasowego. Maksymalny wynik merytoryczny to ${contest.quizMaxPoints} pkt, maksymalny bonus czasowy ${contest.quizTimeBonusMaxPoints} pkt, łącznie ${contest.taskMaxPoints} pkt. Treść kolejnego pytania pojawia się dopiero po zapisaniu poprzedniej odpowiedzi, a prawidłowe warianty nie są ujawniane przed zakończeniem konkursu.`
    : `Praca może otrzymać maksymalnie ${contest.taskMaxPoints} pkt.\n${criteria}\nAdministrator zapisuje wynik każdego kryterium i uzasadnienie.`;
  return [
    { id: 'organizator', title: '1. Organizator i kontakt', text: `Organizatorem konkursu jest ${contest.organizerName}${contest.organizerAddress ? `, ${contest.organizerAddress}` : ''}${contest.organizerTaxId ? `, NIP ${contest.organizerTaxId}` : ''}. Kontakt w sprawach konkursu: ${contest.contactEmail || 'adres wskazany przed publikacją'}.` },
    { id: 'charakter', title: '2. Charakter konkursu i jeden zwycięzca', text: 'Konkurs jest konkursem wiedzy i umiejętności. O wyniku decyduje suma punktów naliczonych według niniejszego regulaminu, a nie losowanie ani przypadek. Wygrywa dokładnie jedna osoba z najwyższym prawidłowym wynikiem. Nie ma minimalnej liczby uczestników: jeżeli istnieje co najmniej jedno prawidłowe zgłoszenie spełniające warunki, może ono wygrać; jeżeli nie ma żadnego, nagroda nie jest przyznawana.' },
    { id: 'czas', title: '3. Czas i terytorium', text: `Konkurs trwa od ${plDate(contest.startsAt)} do ${plDate(contest.endsAt)} na terytorium: ${contest.territory}. Wyniki zostaną opublikowane najpóźniej ${plDate(contest.resultsAnnouncementAt)}.` },
    { id: 'uczestnicy', title: '4. Uczestnicy i jedno zgłoszenie', text: `Uczestnik musi mieć ukończone ${contest.minimumAge} lat, posiadać zweryfikowane konto oraz pełny, prawdziwy adres dostawy w Polsce. W jednym konkursie dozwolone jest jedno zgłoszenie na konto, adres i numer telefonu. Konta lub dane tworzone w celu obejścia zabezpieczeń mogą zostać po weryfikacji zdyskwalifikowane.` },
    { id: 'zadanie', title: '5. Zadanie główne', text: `${contest.taskTitle}. ${contest.taskPrompt}` },
    { id: 'quiz', title: '6. Pytania ABC i punktacja główna', text: mainScoring },
    { id: 'promocja', title: '7. Link promocyjny — potwierdzenie i punkty za przyciski', text: contest.shareRequired ? `Warunkiem jest co najmniej ${contest.minimumConfirmedShares} potwierdzonych reakcji różnych odbiorców. Odbiorca przechodzi z indywidualnego linku uczestnika do powitania Artway-TM i wybiera dokładnie jeden przycisk. Samo otwarcie strony, odświeżenie lub automatyczne wejście nie nalicza punktów. Dla danego odbiorcy i linku uznaje się wyłącznie pierwszą poprawnie zapisaną reakcję; ponowne kliknięcia tej samej osoby nie zwiększają wyniku. Punkty zależą od wybranego przycisku:\n${reactions}\nLiczba prawidłowych reakcji i zdobywanych w ten sposób punktów nie ma górnego limitu. Każda kolejna prawidłowa reakcja innego odbiorcy zwiększa wynik. Reakcje automatyczne, wielokrotne, kupione, pochodzące z farm kliknięć albo uzyskane przez wprowadzanie odbiorców w błąd są odrzucane.` : 'W tym konkursie reakcje z linku promocyjnego nie są wymagane i nie wpływają na wynik.' },
    { id: 'zakup', title: '8. Zakup i zwroty', text: `Zakup nie jest warunkiem udziału. Opłacony i nieanulowany zakup dokonany w czasie konkursu o wartości co najmniej ${contest.purchaseMinAmount.toFixed(2)} zł daje dodatkowy bonus ${contest.purchaseBonusPoints} pkt. Wysokość bonusu została ustalona przed rozpoczęciem przyjmowania zgłoszeń i jest jednakowa dla wszystkich uczestników. Anulowanie lub zwrot zamówienia powodują ponowną weryfikację bonusu, ale nie unieważniają samego zgłoszenia.` },
    { id: 'wynik', title: '9. Wynik łączny i rozstrzyganie remisów', text: `Wynik to suma: punktów za prawidłowe odpowiedzi, serwerowego bonusu czasowego, wszystkich uznanych reakcji z linku bez górnego limitu oraz stałego bonusu za zweryfikowany zakup (${contest.purchaseBonusPoints} pkt). Przy remisie wygrywa kolejno: wyższy wynik zadania głównego wraz z bonusem czasowym, wyższa liczba punktów z linku promocyjnego, zweryfikowany zakup, a następnie wcześniejsze prawidłowe zgłoszenie. Zwycięzca nie jest losowany.` },
    { id: 'weryfikacja', title: '10. Weryfikacja, moderacja i dyskwalifikacja', text: 'System automatycznie zapisuje odpowiedzi, wynik quizu, potwierdzenia linku i zakup. Organizator może przed ogłoszeniem wyników sprawdzić zgodność danych i źródła nietypowych reakcji. Zgłoszenia niepełne, powielone, utworzone przy użyciu wielu kont, cudzych danych, automatyzacji, VPN/proxy użytego do obchodzenia limitów albo innych manipulacji mogą zostać odrzucone po udokumentowanej kontroli. Błąd techniczny po stronie sklepu nie powoduje automatycznej dyskwalifikacji uczestnika.' },
    { id: 'ranking', title: '11. Ranking i ogłoszenie wyniku', text: 'W czasie przyjmowania zgłoszeń oraz kontroli ranking innych uczestników pozostaje ukryty. Po zamknięciu konkursu, weryfikacji i rozstrzygnięciu remisów publikowana jest tabela końcowa z zanonimizowanymi oznaczeniami uczestników. Organizator wskazuje dokładnie jednego zwycięzcę.' },
    { id: 'nagroda', title: '12. Potwierdzenie i dostawa nagrody', text: `Nagrodą jest: ${contest.prizeDescription}${contest.prizeAmount > 0 ? ` (wartość ${contest.prizeAmount.toFixed(2)} zł)` : ''}. Zwycięzca zostanie powiadomiony na zweryfikowany e-mail i ma ${contest.winnerConfirmationHours} godz. od powiadomienia na potwierdzenie danych i spełnienia warunków. Nagroda jest wysyłana wyłącznie kurierem na zweryfikowany adres, w terminie do ${contest.prizeDeliveryDays} dni kalendarzowych od prawidłowego potwierdzenia przez zwycięzcę. Brak potwierdzenia lub podanie nieprawidłowych danych może skutkować wyborem kolejnej uprawnionej osoby. ${contest.taxNote || 'Informacja podatkowa wymaga uzupełnienia przed publikacją.'}` },
    { id: 'reklamacje', title: '13. Reklamacje', text: `Reklamację można przesłać na ${contest.contactEmail || 'adres organizatora'} w ciągu ${contest.complaintDeadlineDays} dni od ogłoszenia wyników, podając nazwę konkursu, dane kontaktowe i opis zastrzeżenia. Organizator odpowie w ciągu ${contest.complaintResponseDays} dni. Postępowanie reklamacyjne nie ogranicza praw wynikających z obowiązujących przepisów.` },
    { id: 'dane', title: '14. Dane osobowe', text: 'Dane są przetwarzane w celu przyjęcia zgłoszenia, naliczenia punktów, zapobiegania nadużyciom, ogłoszenia wyników i wysyłki nagrody. Uczestnik otrzymuje informację o administratorze, podstawie, okresie przetwarzania, odbiorcach i swoich prawach w polityce prywatności. Publicznie prezentowany jest wyłącznie zanonimizowany identyfikator uczestnika.' },
    { id: 'techniczne', title: '15. Zdarzenia techniczne', text: 'W razie potwierdzonej awarii organizator może przedłużyć termin lub przywrócić możliwość prawidłowego zgłoszenia, informując o tym na stronie konkursu. Czasowa niedostępność niezależna od uczestnika nie jest podstawą dyskwalifikacji. Organizator może unieważnić wyłącznie zdarzenia, dla których istnieją konkretne dane wskazujące na nadużycie.' },
    { id: 'postanowienia', title: '16. Postanowienia końcowe', text: `Istotne zmiany zasad nie mogą pogarszać sytuacji uczestników ani działać wstecz. W sprawach nieuregulowanych stosuje się obowiązujące przepisy prawa polskiego. ${contest.rulesText ? `Dodatkowe postanowienia: ${contest.rulesText}` : 'Brak dodatkowych postanowień dla tego konkursu.'}` },
  ];
}

export function contestPublicView(contest, { includeRules = false, ranking = [] } = {}) {
  const status = contestEffectiveStatus(contest);
  return {
    id: contest.id, slug: contest.slug, status, frequency: contest.frequency, icon: contest.icon, title: contest.title, eyebrow: contest.eyebrow,
    description: contest.description, taskTitle: contest.taskTitle, taskPrompt: contest.taskPrompt, prizeAmount: contest.prizeAmount,
    prizeDescription: contest.prizeDescription, prizeDelivery: 'courier', startsAt: contest.startsAt, endsAt: contest.endsAt,
    resultsAnnouncementAt: contest.resultsAnnouncementAt, winnerConfirmationHours: contest.winnerConfirmationHours, prizeDeliveryDays: contest.prizeDeliveryDays,
    purchaseRequired: contest.purchaseRequired, purchaseMinAmount: contest.purchaseMinAmount, minAnswerLength: contest.minAnswerLength,
    shareRequired: contest.shareRequired, minimumConfirmedShares: contest.minimumConfirmedShares, shareMaxPoints: contest.shareMaxPoints,
    contestType: contest.contestType, quizQuestionCount: contest.quizQuestions.length, quizMaxPoints: contest.quizMaxPoints, quizTimeBonusMaxPoints: contest.quizTimeBonusMaxPoints,
    shareResponseRules: contest.shareResponseRules, scoringCriteria: contest.contestType === 'creative' ? contest.scoringCriteria : [], taskMaxPoints: contest.taskMaxPoints,
    purchaseBonusPoints: contest.purchaseBonusPoints,
    ...(includeRules ? { rulesText: contest.rulesText, rulesSections: contestRulesSections(contest) } : {}), ...(ranking.length ? { ranking } : {}),
  };
}

export function contestAccountKey(email, secret = '') {
  return crypto.createHmac('sha256', secret || 'contest-account').update(clean(email, 300).toLowerCase()).digest('hex');
}

export function contestAddressKey(profile = {}, secret = '') {
  const canonical = (value) => clean(value, 160).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '');
  const street = canonical(profile.ulica).replace(/^ul(?:ica)?/, ''), postCode = canonical(profile.kod).replace(/\D/g, '');
  const value = [street, canonical(profile.nrDomu), canonical(profile.nrLokalu), postCode, canonical(profile.miasto)].join('|');
  return value.replace(/\|/g, '') ? crypto.createHmac('sha256', secret || 'contest-address').update(value).digest('hex') : '';
}

export function normalizeContestEntry(raw = {}) {
  const criterionScores = raw.criterionScores && typeof raw.criterionScores === 'object' ? Object.fromEntries(Object.entries(raw.criterionScores).slice(0, 12).map(([key, value]) => [slug(key), number(value, 0, 0, 1000)])) : {};
  const quizAnswers = raw.quizAnswers && typeof raw.quizAnswers === 'object' ? Object.fromEntries(Object.entries(raw.quizAnswers).slice(0, 30).map(([key, value]) => [slug(key), slug(value).slice(0, 20)])) : {};
  return {
    id: clean(raw.id, 120), contestId: clean(raw.contestId, 100), accountKey: clean(raw.accountKey, 128), addressKey: clean(raw.addressKey, 128), phoneKey: clean(raw.phoneKey, 128),
    participantName: clean(raw.participantName, 160), email: clean(raw.email, 300).toLowerCase(), answer: cleanMultiline(raw.answer, 12_000),
    status: ['submitted', 'approved', 'rejected', 'disqualified'].includes(raw.status) ? raw.status : 'submitted',
    moderationNote: cleanMultiline(raw.moderationNote, 1200), criterionScores, quizAnswers, quizScore: number(raw.quizScore, raw.taskScore, 0, 10_000), quizTimeBonus: number(raw.quizTimeBonus, 0, 0, 10_000), taskScore: number(raw.taskScore, raw.quizScore, 0, 10_000), purchaseVerified: raw.purchaseVerified === true,
    purchaseBonusPoints: Number.isFinite(Number(raw.purchaseBonusPoints)) ? number(raw.purchaseBonusPoints, 0, 0, 1000) : null,
    purchaseOrderNumber: clean(raw.purchaseOrderNumber, 120), referralCode: slug(raw.referralCode), submittedAt: iso(raw.submittedAt) || new Date().toISOString(),
    updatedAt: iso(raw.updatedAt) || new Date().toISOString(),
  };
}

export function contestPurchasePoints(entry = {}, contest = {}) {
  if (!entry.purchaseVerified) return 0;
  return entry.purchaseBonusPoints === null || entry.purchaseBonusPoints === undefined ? number(contest.purchaseBonusPoints, 0, 0, 1000) : number(entry.purchaseBonusPoints, 0, 0, 1000);
}

export function contestEntryTotal(entry, contest, shareConfirmations = 0) {
  const sharePoints = shareConfirmations && typeof shareConfirmations === 'object'
    ? number(shareConfirmations.points, 0, 0, 10_000_000)
    : number(shareConfirmations, 0, 0, 1_000_000) * number(contest.sharePointValue, 0, 0, 100);
  return Number((number(entry.taskScore, 0, 0, contest.taskMaxPoints || 10_000) + sharePoints + contestPurchasePoints(entry, contest)).toFixed(2));
}

export function contestParticipantAlias(entry) {
  const name = clean(entry?.participantName, 160).split(/\s+/).filter(Boolean);
  const initials = name.slice(0, 2).map((part) => `${part[0]?.toUpperCase() || ''}.`).join(' ') || 'Uczestnik';
  return `${initials} • ${clean(entry?.id, 120).slice(-4).toUpperCase()}`;
}

export const contestCenterInternals = Object.freeze({ STATUSES, FREQUENCIES, clean, cleanMultiline, slug, iso, normalizeScoringCriteria, normalizeResponseRules, normalizeQuizQuestions });
