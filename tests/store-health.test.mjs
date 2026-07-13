import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/lib/store-app.mjs';

test('główny backend uruchamia się po podziale na moduły', async () => {
  const response = await handler(new Request('http://localhost/api/store?action=health'), {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(body.store && typeof body.store === 'object');
  assert.ok(body.inpost && body.allegro && body.infakt);
});
