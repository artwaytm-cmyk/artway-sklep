import test from 'node:test';
import assert from 'node:assert/strict';
import { telegramProfessionalAgentHtml } from '../netlify/functions/lib/domain/telegram-communication.mjs';

test('profesjonalny format Telegram zachowuje dokładnie przekazaną treść bez dodatkowych informacji', () => {
  const source = 'Stan produktu:\n- Kod: 1410\n- Ilość: 8 szt.';
  const formatted = telegramProfessionalAgentHtml(source);
  assert.match(formatted, /^<b>Stan produktu<\/b>/);
  assert.match(formatted, /<b>Kod:<\/b> 1410/);
  assert.match(formatted, /<b>Ilość:<\/b> 8 szt\./);
  assert.doesNotMatch(formatted, /panel|priorytet|rekomend|kolejn|raport/i);
  for (const token of ['Stan produktu', 'Kod', '1410', 'Ilość', '8 szt.']) assert.match(formatted, new RegExp(token.replace('.', '\\.')));
});

test('profesjonalny format Telegram zabezpiecza obce znaczniki i zachowuje tabelę', () => {
  const formatted = telegramProfessionalAgentHtml('Kod | Nazwa | Ilość\n1410 | Ziemniak | 8\n<script>nie uruchamiaj</script>');
  assert.match(formatted, /<pre>Kod \| Nazwa \| Ilość/);
  assert.doesNotMatch(formatted, /<script>/);
  assert.match(formatted, /&lt;script&gt;nie uruchamiaj&lt;\/script&gt;/);
});
