import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('centrum konkursów ma komplet osobnych podstron administracyjnych', async () => {
  const [adminBase, adminAdvanced, router, build, style] = await Promise.all([
    readFile('src/frontend/15g-contest-center.js', 'utf8'),
    readFile('src/frontend/15g1-contest-center-advanced.js', 'utf8'),
    readFile('src/frontend/06-router-and-storefront.js', 'utf8'),
    readFile('scripts/build-assets.mjs', 'utf8'),
    readFile('src/styles/40-contest-center-admin.css', 'utf8'),
  ]);
  const admin = `${adminBase}\n${adminAdvanced}`;
  for (const route of ['lista', 'nowy', 'zgloszenia', 'ranking', 'zwyciezcy', 'ustawienia']) assert.match(admin, new RegExp(`/admin/konkursy/${route}`));
  assert.match(admin, /agent-specialist-run/);
  assert.match(admin, /specialist:"campaign_copy"/);
  assert.match(admin, /campaign_copy/);
  assert.match(admin, /AI zapisuje tylko szkic/);
  assert.match(router, /admin-contests/);
  assert.match(router, /produkt\|kategoria\|konkurs/);
  assert.match(router, /"\/konkursy"/);
  assert.match(build, /assets\/admin-contests\.js/);
  assert.match(style, /contest-admin-command\.admin-unified-hero/);
  assert.match(style, /background:[^}]+!important/);
  assert.match(admin, /shareResponsePoints/);
  assert.match(admin, /prizeDeliveryDays/);
  assert.match(admin, /resultsAnnouncementAt/);
  assert.match(admin, /criterionMaxPoints/);
  assert.match(admin, /quizQuestionId/);
  assert.match(admin, /quizCorrect/);
  assert.match(admin, /Standard każdego nowego konkursu/);
  assert.match(admin, /name="contestType" value="quiz_abc"/);
  assert.match(admin, /Nie ma limitu punktów/);
  assert.match(admin, /Zakup nigdy nie jest warunkiem udziału/);
});

test('publiczny katalog konkursów jest odroczonym modułem z formularzem i rankingiem końcowym', async () => {
  const [publicBase, publicAdvanced, router, build, style] = await Promise.all([
    readFile('src/frontend/06f-storefront-contests.js', 'utf8'),
    readFile('src/frontend/06g-storefront-contests-advanced.js', 'utf8'),
    readFile('src/frontend/06-router-and-storefront.js', 'utf8'),
    readFile('scripts/build-assets.mjs', 'utf8'),
    readFile('src/styles/12-storefront-contests.css', 'utf8'),
  ]);
  const publicModule = `${publicBase}\n${publicAdvanced}`;
  assert.match(publicModule, /contest-public-list/);
  assert.match(publicModule, /contest-submit/);
  assert.match(publicModule, /Ranking został zamknięty/);
  assert.match(publicModule, /Dostawa wyłącznie kurierem/);
  assert.match(router, /store-contests/);
  assert.match(build, /assets\/store-contests\.js/);
  assert.match(build, /assets\/store-contests\.css/);
  assert.match(style, /@media\(max-width:640px\)/);
  assert.match(publicModule, /scoreBreakdown/);
  assert.match(publicModule, /contest-quiz-start/);
  assert.match(publicModule, /contest-quiz-answer/);
  assert.match(publicModule, /Zapisz odpowiedź i pokaż następne/);
  assert.match(publicModule, /data-contest-quiz-timer/);
  assert.doesNotMatch(publicAdvanced, /\$\{konkursPunktyHTML\(contest\)\}/);
  assert.doesNotMatch(publicAdvanced, /Wynik = .*bonus zakupowy/);
  assert.match(publicModule, /contest-quiz-question/);
});
