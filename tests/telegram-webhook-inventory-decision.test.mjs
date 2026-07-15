import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInventoryDecisionText } from '../netlify/functions/telegram-webhook.mjs';

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
