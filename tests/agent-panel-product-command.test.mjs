import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAgentProductBacklogCommand } from '../src/backend/lib/domain/agent-panel-product-command.mjs';

test('polecenie administratora zachowuje podaną liczbę produktów', () => {
  assert.deepEqual(parseAgentProductBacklogCommand('popraw 375 produktów'), {
    batchSize: 375,
    explicitCount: true,
  });
});

test('polecenie bez liczby otrzymuje bezpieczny rozmiar partii', () => {
  assert.deepEqual(parseAgentProductBacklogCommand('kontynuuj poprawę katalogu'), {
    batchSize: 40,
    explicitCount: false,
  });
});

test('zwykłe pytanie o status nie uruchamia produktów', () => {
  assert.equal(parseAgentProductBacklogCommand('pokaż status serwera'), null);
});
