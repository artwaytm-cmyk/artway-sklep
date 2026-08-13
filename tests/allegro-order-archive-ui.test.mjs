import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('panel zamówień rozdziela rejestr 30-dniowy od archiwum ładowanego na żądanie', async () => {
  const [orders, archive] = await Promise.all([
    readFile(new URL('../assets/admin.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/frontend/11-allegro-order-archive-ui.js', import.meta.url), 'utf8'),
  ]);
  assert.match(orders, /Ostatnie 30 dni/);
  assert.match(orders, /Archiwum miesięczne/);
  assert.match(archive, /allegro-orders-archive/);
  assert.match(archive, /limit:100/);
  assert.match(orders, /Tryb tylko do odczytu/);
});
