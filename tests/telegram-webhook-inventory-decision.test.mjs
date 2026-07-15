import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTelegramAgentInput, parseInventoryDecisionText } from '../netlify/functions/telegram-webhook.mjs';

test('webhook kieruje wzmiankę i awaryjne /agent do Codexa', () => {
  assert.deepEqual(normalizeTelegramAgentInput('@magazyn_artway_bot sprawdź stan ziemniaka'), { text: 'sprawdź stan ziemniaka', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('@Magazyn_Artway_Bot: pokaż nowe zamówienia'), { text: 'pokaż nowe zamówienia', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/agent sprawdź zlecenia'), { text: 'sprawdź zlecenia', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/agent@magazyn_artway_bot sprawdź zlecenia'), { text: 'sprawdź zlecenia', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/agent@magazyn_artway_bot'), { text: 'Pokaż pomoc Agenta', forceCodex: true });
  assert.deepEqual(normalizeTelegramAgentInput('/status'), { text: '/status', forceCodex: false });
  assert.deepEqual(normalizeTelegramAgentInput('@inny_bot sprawdź zlecenia'), { text: '@inny_bot sprawdź zlecenia', forceCodex: false });
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
