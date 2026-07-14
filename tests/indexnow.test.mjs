import test from 'node:test';
import assert from 'node:assert/strict';
import { INDEXNOW_KEY, INDEXNOW_KEY_LOCATION, normalizeIndexNowUrls, submitIndexNow } from '../netlify/functions/lib/domain/indexnow.mjs';

test('IndexNow przyjmuje tylko bezpieczne, unikalne adresy głównej domeny', () => {
  assert.deepEqual(normalizeIndexNowUrls([
    'https://artwaytm.pl/',
    'https://artwaytm.pl/produkt/15#opis',
    'https://artwaytm.pl/produkt/15',
    'http://artwaytm.pl/produkt/16',
    'https://example.com/produkt/17',
  ]), ['https://artwaytm.pl/', 'https://artwaytm.pl/produkt/15']);
});

test('IndexNow wysyła prawidłowe zgłoszenie zbiorcze', async () => {
  let request = null;
  const result = await submitIndexNow(['https://artwaytm.pl/', '/produkt/22'], { fetchImpl: async (url, options) => {
    request = { url, options };
    return { status: 202 };
  } });
  assert.equal(result.accepted, true);
  assert.equal(result.count, 2);
  assert.equal(request.url, 'https://api.indexnow.org/indexnow');
  const body = JSON.parse(request.options.body);
  assert.equal(body.host, 'artwaytm.pl');
  assert.equal(body.key, INDEXNOW_KEY);
  assert.equal(body.keyLocation, INDEXNOW_KEY_LOCATION);
  assert.deepEqual(body.urlList, ['https://artwaytm.pl/', 'https://artwaytm.pl/produkt/22']);
});

test('IndexNow nie wysyła pustego zgłoszenia', async () => {
  const result = await submitIndexNow(['https://inna-domena.pl/produkt/1'], { fetchImpl: async () => { throw new Error('nie powinno zostać wywołane'); } });
  assert.equal(result.status, 'skipped');
  assert.equal(result.count, 0);
});
