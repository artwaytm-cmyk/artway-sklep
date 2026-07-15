import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTelegramAgentInput,
  parseInventoryDecisionText,
  telegramActorRef,
  telegramCommandRoute,
  telegramInboundKind,
  telegramMessageMedia,
  telegramReplyContext,
} from '../netlify/functions/telegram-webhook.mjs';

test('webhook kieruje wzmiankę i awaryjne /agent do Codexa', () => {
  assert.deepEqual(normalizeTelegramAgentInput('@magazyn_artway_bot sprawdź stan ziemniaka'), { text: 'sprawdź stan ziemniaka', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('@Magazyn_Artway_Bot: pokaż nowe zamówienia'), { text: 'pokaż nowe zamówienia', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/agent sprawdź zlecenia'), { text: 'sprawdź zlecenia', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/agent@magazyn_artway_bot sprawdź zlecenia'), { text: 'sprawdź zlecenia', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/agent@magazyn_artway_bot'), { text: 'Pokaż pomoc Agenta', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/status'), { text: '/status', forceCodex: false });
  assert.deepEqual(normalizeTelegramAgentInput('@inny_bot sprawdź zlecenia'), { text: '@inny_bot sprawdź zlecenia', forceCodex: false });
});

test('tylko szybkie komendy serwera zostają lokalne, a operacyjne trafiają do Agenta', () => {
  for (const command of ['/start', '/pomoc', '/settings', '/POMOC@magazyn_artway_bot']) {
    assert.equal(telegramCommandRoute(command), 'local', command);
  }
  for (const command of [
    '/agent sprawdź stan', '/centrum', '/decyzje', '/raport', '/wykonaj', '/produkty', '/producenci',
    '/diagnostyka', '/monitor', '/sprawdz', '/zlecenie', '/nadwyzki', '/linki', '/opisy', '/status',
    '/zamowienia', '/braki', '/wiadomosci', '/wysylki', '/magazyn', '/priorytety', '/dzis', '/dyskusje',
    '/inpost', '/dostawcy', '/integracje', '/telegram', '/dzialaj', '/check', '/zamow', '/przyjecia',
    '/url', '/producent', '/opis', '/help', 'sprawdź sklep',
  ]) assert.equal(telegramCommandRoute(command), 'agent', command);
});

test('webhook sanitizuje kontekst odpowiedzi i opisuje voice/audio bez pobierania pliku', () => {
  const context = telegramReplyContext({ text: ` Poprzednia\u0000 wiadomość\n${'x'.repeat(1800)} ` });
  assert.equal(context.includes('\u0000'), false);
  assert.equal(context.length, 1600);
  assert.deepEqual(telegramMessageMedia({ voice: { file_id: 'voice-1', mime_type: 'audio/ogg' } }), {
    kind: 'voice', fileId: 'voice-1', mimeType: 'audio/ogg', fileName: '',
  });
  assert.deepEqual(telegramMessageMedia({ audio: { file_id: 'audio-1', mime_type: 'audio/mpeg', file_name: 'polecenie.mp3' } }), {
    kind: 'audio', fileId: 'audio-1', mimeType: 'audio/mpeg', fileName: 'polecenie.mp3',
  });
  assert.equal(telegramMessageMedia({ document: { file_id: 'doc-1' } }), null);
  assert.equal(telegramInboundKind({ voice: { file_id: 'voice-1' } }), 'voice');
  assert.equal(telegramInboundKind({ text: '/status' }), 'command');
  assert.equal(telegramInboundKind({ text: 'status' }), 'text');
  assert.equal(telegramInboundKind({}, { id: 'callback' }), 'callback');
  const ref = telegramActorRef('700123', '-100999', 'webhook-secret');
  assert.match(ref, /^[a-f0-9]{24}$/);
  assert.equal(ref.includes('700123'), false);
  assert.equal(ref.includes('100999'), false);
});

test('webhook rozpoznaje wyłącznie ściśle zakotwiczoną decyzję administratora', () => {
  assert.deepEqual(parseInventoryDecisionText('Potwierdzam IVaaaaaaaaaaaaaa'), { action: 'confirm', id: 'IVaaaaaaaaaaaaaa' });
  assert.deepEqual(parseInventoryDecisionText('nie potwierdzam IVbbbbbbbbbbbbbb.'), { action: 'reject', id: 'IVbbbbbbbbbbbbbb' });
  assert.deepEqual(parseInventoryDecisionText('POTWIERDZAM ivABCDEFABCDEFAB'), { action: 'confirm', id: 'IVabcdefabcdefab' });
  for (const input of [
    'proszę potwierdzam IVaaaaaaaaaaaaaa',
    'potwierdzam IVaaaaaaaaaaaaaa później',
    'zatwierdzam IVaaaaaaaaaaaaaa',
    'potwierdzam',
    'nie potwierdzam wszystkich',
    'potwierdzam IVaaaaaaaaaaaaa',
    'potwierdzam IVaaaaaaaaaaaaaaa',
  ]) assert.equal(parseInventoryDecisionText(input), null, input);
});
