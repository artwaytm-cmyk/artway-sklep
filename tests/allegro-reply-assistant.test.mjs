import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  allegroMessagePlainText,
  analyzeAllegroConversation,
  buildAllegroReplyStyleProfile,
  buildContextualAllegroReply,
  classifyAllegroMessageAuthor,
  fetchAllegroReplyHistory,
  improvePolishReplyStyle,
  mergeAllegroReplyHistory,
} from '../netlify/functions/lib/domain/allegro-reply-assistant.mjs';

const frontend = await readFile(new URL('../src/frontend/11-allegro-and-orders.js', import.meta.url), 'utf8');
const backend = await readFile(new URL('../netlify/functions/lib/store-app.mjs', import.meta.url), 'utf8');

test('poprawa stylistyczna porządkuje ręczny szkic bez dopisywania faktów', () => {
  const source = 'jeszcze raz przepraszamy za zaistniało sytuacje , zamówienie ORDER-17 ma numer 620999 i wartość 48,50 zł\n\npozdrawiamy serdecznie\nartway tm';
  const improved = improvePolishReplyStyle(source);
  assert.match(improved, /^Jeszcze raz/u);
  assert.match(improved, /ORDER-17/u);
  assert.match(improved, /620999/u);
  assert.match(improved, /48,50 zł/u);
  assert.match(improved, /Pozdrawiamy serdecznie,/u);
  assert.match(improved, /Artway-TM/u);
  assert.doesNotMatch(improved, /gratis|zwrot środków|wysłano|doręczono/iu);
});

test('klasyfikator używa źródłowych pól Allegro i naprawia błędny stary authorType', () => {
  assert.equal(classifyAllegroMessageAuthor({ authorType: 'allegro', author: { login: 'qkrzaku', role: 'BUYER' } }), 'buyer');
  assert.equal(classifyAllegroMessageAuthor({ authorType: 'allegro', author: { login: 'artway-tm', role: 'SELLER' } }), 'seller');
  assert.equal(classifyAllegroMessageAuthor({ author: { login: 'allegro', role: 'ADMIN' } }), 'allegro');
  assert.equal(classifyAllegroMessageAuthor({ authorType: 'allegro', author: { login: 'klient', isInterlocutor: true } }), 'buyer');
  assert.equal(classifyAllegroMessageAuthor({ authorType: 'allegro', author: { id: 'seller-id', isInterlocutor: false } }), 'seller');
});

test('treść wiadomości jest bezpiecznie zamieniana z HTML na czytelny tekst', () => {
  assert.equal(allegroMessagePlainText('Dzień dobry,&nbsp;<br>FV w załączniku &amp; pozdrawiam'), 'Dzień dobry,\nFV w załączniku & pozdrawiam');
  assert.equal(allegroMessagePlainText('<strong>Allegro</strong><br><a href="https://example.test">Sprawdź</a>'), 'Allegro\nSprawdź');
});

test('profil stylu uczy się wyłącznie formy ręcznych odpowiedzi', () => {
  const profile = buildAllegroReplyStyleProfile([
    'Dzień dobry,\n\nPrzesyłka została nadana.\n\nPozdrawiamy serdecznie,\nArtway-TM',
    'Dzień dobry,\n\nDziękujemy za informację.\n\nPozdrawiamy serdecznie,\nArtway-TM',
  ]);
  assert.equal(profile.exampleCount, 2);
  assert.equal(profile.greeting, 'Dzień dobry');
  assert.equal(profile.closing, 'Pozdrawiamy serdecznie,');
  assert.equal(profile.learnedFrom, 'manual-seller-replies');
});

test('analiza uwzględnia pełną sekwencję klient–sprzedawca, a nie tylko ostatnie zdanie', () => {
  const analysis = analyzeAllegroConversation({ messages: [
    { id: '1', authorType: 'buyer', text: 'Paczka do mnie nie dotarła.' },
    { id: '2', authorType: 'seller', text: 'Możemy wysłać paczkę ponownie.' },
    { id: '3', authorType: 'buyer', text: 'Nie chcę kolejnej przesyłki. Proszę o zwrot pieniędzy.' },
  ] });
  assert.equal(analysis.messageCount, 3);
  assert.equal(analysis.buyerMessageCount, 2);
  assert.equal(analysis.sellerMessageCount, 1);
  assert.equal(analysis.intents.wantsRefund, true);
  assert.equal(analysis.intents.rejectsReshipment, true);
  assert.equal(analysis.intents.sellerOfferedReshipment, true);
});

test('komunikat administratora Allegro nigdy nie staje się wiadomością klienta', () => {
  const analysis = analyzeAllegroConversation({ messages: [
    { id: 'admin-1', author: { login: 'allegro', role: 'ADMIN' }, text: 'Kupujący poprosił nas o pomoc.' },
  ], lastMessage: { authorType: 'allegro', text: 'Komunikat systemowy' } });
  assert.equal(analysis.buyerMessageCount, 0);
  assert.equal(analysis.systemMessageCount, 1);
  assert.equal(analysis.hasBuyerMessage, false);
  assert.equal(analysis.latestBuyerText, '');
});

test('poprawa treści respektuje odmowę kolejnej paczki i korzysta z potwierdzonych danych', () => {
  const item = { buyerLogin: 'qkrzaku', messages: [
    { id: '1', authorType: 'seller', text: 'Możemy wysłać paczkę ponownie.' },
    { id: '2', authorType: 'buyer', text: 'Nie chcę od was żadnych przesyłek. Proszę o zwrot pieniędzy. InPost cofnął paczkę do nadawcy.' },
  ] };
  const result = buildContextualAllegroReply({
    item,
    context: { orderFound: true, orderId: 'ORDER-1', status: 'SENT', statusLabel: 'wysłane', shipment: { sent: true, tracking: '620999' }, shortages: 0 },
    draft: 'Przepraszamy. W ramach rekompensaty wyślemy mały gratis. Zwrot pieniędzy został zlecony.',
  });
  assert.match(result.suggestion, /bez ponownej wysyłki/iu);
  assert.match(result.suggestion, /620999/u);
  assert.doesNotMatch(result.suggestion, /zwrotu? (?:środków|pieniędzy) (?:został|została|jest) (?:zlecon|wykonan)/iu);
  assert.doesNotMatch(result.suggestion, /gratis|upominek|wyślemy.*pacz/iu);
  assert.equal(result.conversation.unverifiedRefundClaimRemoved, true);
  assert.match(result.conversation.warnings.join(' '), /niepotwierdzoną informację/iu);
  assert.equal(result.conversation.contradictoryReshipmentRemoved, true);
});

test('poprzednie sprawy tego samego klienta są oznaczone osobno i nie mieszają zamówień', () => {
  const current = { id: 'current', orderId: 'ORDER-1', messages: [{ id: 'c1', authorType: 'buyer', text: 'Co z zamówieniem?', orderId: 'ORDER-1' }] };
  const related = [
    { id: 'same-order', communicationType: 'thread', orderId: 'ORDER-1', messages: [{ id: 'r1', authorType: 'buyer', text: 'Wcześniejsza sprawa' }] },
    { id: 'other-order', communicationType: 'issue', orderId: 'ORDER-2', messages: [{ id: 'r2', authorType: 'buyer', text: 'Inne zamówienie' }] },
  ];
  const analysis = analyzeAllegroConversation(current, related, 'ORDER-1');
  assert.equal(analysis.relatedConversationCount, 2);
  assert.equal(analysis.sameOrderRelatedCount, 1);
  assert.deepEqual(analysis.relatedConversations.map((entry) => [entry.id, entry.orderId, entry.sameOrder]), [
    ['same-order', 'ORDER-1', true],
    ['other-order', 'ORDER-2', false],
  ]);
});

test('historia wiadomości pobiera wszystkie strony po 20, deduplikuje granicę stron i używa wyłącznie GET', async () => {
  const calls = [];
  const out = await fetchAllegroReplyHistory({
    type: 'thread', id: 'abc', maxMessages: 60,
    call: async (path, options) => {
      calls.push({ path, options });
      const offset = options.parameters.offset;
      if (offset === 0) return { messages: Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, createdAt: `2026-07-15T10:${String(i).padStart(2, '0')}:00Z`, text: `w${i}` })) };
      if (offset === 20) return { messages: [
        { id: 'm19', createdAt: '2026-07-15T10:19:00Z', text: 'w19 — wersja pełna' },
        ...Array.from({ length: 19 }, (_, i) => ({ id: `m${i + 20}`, createdAt: `2026-07-15T11:${String(i).padStart(2, '0')}:00Z`, text: `w${i + 20}` })),
      ] };
      return { messages: Array.from({ length: 6 }, (_, i) => ({ id: `m${i + 39}`, createdAt: `2026-07-15T12:${String(i).padStart(2, '0')}:00Z`, text: `w${i + 39}` })) };
    },
  });
  assert.equal(out.messages.length, 45);
  assert.equal(out.pages, 3);
  assert.equal(out.truncated, false);
  assert.deepEqual(calls.map(({ options }) => options.parameters), [
    { limit: 20, offset: 0 },
    { limit: 20, offset: 20 },
    { limit: 20, offset: 40 },
  ]);
  assert.equal(out.messages.filter((message) => message.id === 'm19').length, 1);
  assert.equal(out.messages.find((message) => message.id === 'm19').text, 'w19 — wersja pełna');
  assert.equal(out.messages.at(0).id, 'm0');
  assert.equal(out.messages.at(-1).id, 'm44');
  assert.ok(calls.every((entry) => entry.options.method === 'GET'));
  assert.ok(calls.every((entry) => !('bodyObj' in entry.options)));
});

test('historia dyskusji pobiera ponad 100 wpisów, zachowuje nagłówek API i kończy na krótkiej stronie', async () => {
  const calls = [];
  const out = await fetchAllegroReplyHistory({
    type: 'issue', id: 'issue/17', maxMessages: 250, issueAccept: 'application/vnd.allegro.beta.v1+json',
    call: async (path, options) => {
      calls.push({ path, options });
      const offset = options.parameters.offset;
      const count = offset < 200 ? 100 : 5;
      return { chat: { messages: Array.from({ length: count }, (_, i) => ({
        id: `i${offset + i}`,
        createdAt: new Date(Date.UTC(2026, 6, 15, 8, 0, offset + i)).toISOString(),
        text: `wiadomość ${offset + i}`,
      })) } };
    },
  });
  assert.equal(out.messages.length, 205);
  assert.equal(out.pages, 3);
  assert.equal(out.truncated, false);
  assert.deepEqual(calls.map(({ options }) => options.parameters), [
    { limit: 100, offset: 0 },
    { limit: 100, offset: 100 },
    { limit: 50, offset: 200 },
  ]);
  assert.ok(calls.every(({ path }) => path === '/sale/issues/issue%2F17/chat'));
  assert.ok(calls.every(({ options }) => options.accept === 'application/vnd.allegro.beta.v1+json'));
});

test('scalanie historii usuwa duplikaty, zachowuje nowsze pełniejsze dane i porządkuje chronologicznie', () => {
  const merged = mergeAllegroReplyHistory(
    [
      { id: 'b', createdAt: '2026-07-15T10:02:00Z', authorType: 'buyer', text: 'druga' },
      { id: 'a', createdAt: '2026-07-15T10:01:00Z', authorType: 'buyer', text: 'wersja skrócona' },
    ],
    [
      { id: 'a', createdAt: '2026-07-15T10:01:00Z', authorType: 'buyer', text: 'wersja pełna', attachments: [{ id: 'att-1' }] },
      { id: 'c', createdAt: '2026-07-15T10:03:00Z', authorType: 'seller', text: 'trzecia' },
    ],
  );
  assert.deepEqual(merged.map((message) => message.id), ['a', 'b', 'c']);
  assert.equal(merged[0].text, 'wersja pełna');
  assert.deepEqual(merged[0].attachments, [{ id: 'att-1' }]);
});

test('edytor ma dwa rozdzielone działania, cofnięcie i osobny przycisk wysyłki', () => {
  assert.match(frontend, />✨ Popraw język i układ</u);
  assert.match(frontend, />🧠 Przygotuj profesjonalną odpowiedź</u);
  assert.match(frontend, /data-reply-undo hidden/u);
  assert.match(frontend, /field\.dataset\.previousDraft=before/u);
  assert.match(frontend, /buttons\.forEach\(button=>\{button\.disabled=true/u);
  assert.match(frontend, /if\(field\.dataset\.sending==="1"\)return/u);
  assert.match(frontend, /data-reply-send/u);
  assert.match(frontend, /sendButton\.disabled=true/u);
  assert.doesNotMatch(frontend, /function allegroHistoriaRozmowyHTML[\s\S]{0,350}\.slice\(-20\)/u);
  assert.match(frontend, /Przygotowanie i poprawa tworzą tylko szkic/u);
  assert.match(frontend, />✉️ Wyślij przez Allegro</u);
  assert.match(frontend, /Komunikaty i działania Allegro/u);
  assert.match(frontend, /Ostatnia wiadomość klienta/u);
});

test('endpoint poprawy zwraca wyłącznie szkic i jawnie nie wysyła niczego zewnętrznie', () => {
  const action = backend.slice(backend.indexOf("if (action === 'allegro-reply-suggestion')"), backend.indexOf("if (action === 'allegro-send-reply')"));
  assert.match(action, /mode === 'style'/u);
  assert.match(action, /buildContextualAllegroReply/u);
  assert.match(action, /allegroPelnaSprawaDoOdpowiedzi/u);
  assert.match(action, /sentExternally: false/u);
  assert.doesNotMatch(action, /method:\s*'POST'.*\/messaging\/threads|\/sale\/issues\/.*\/message/su);
  assert.match(action, /no_customer_message/u);
});

test('backend nie przypisuje zamówienia wyłącznie po loginie kupującego', () => {
  const matcher = backend.slice(backend.indexOf('function allegroZnajdzZamowienieKomunikacji'), backend.indexOf('function allegroStatusZamowieniaOpis'));
  assert.doesNotMatch(matcher, /unique_buyer_order/u);
  assert.match(matcher, /order:\s*null/u);
});
