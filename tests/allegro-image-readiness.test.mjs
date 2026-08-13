import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAllegroImageReadiness, imageDimensions } from '../src/backend/lib/domain/allegro-image-readiness.mjs';

function png(width, height) {
  const buffer = Buffer.alloc(24);
  buffer.set([0x89, 0x50, 0x4e, 0x47], 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

test('kontrola obrazu rozpoznaje wymiar PNG bez dekodowania grafiki', () => {
  assert.deepEqual(imageDimensions(png(640, 480)), { width: 640, height: 480, format: 'png' });
});

test('przygotowanie blokuje miniaturę poniżej minimum Allegro', async () => {
  const fetcher = async () => new Response(png(250, 250), { status: 200, headers: { 'content-type': 'image/png' } });
  const result = await checkAllegroImageReadiness(['https://example.test/mini.png'], { fetcher, now: 1 });
  assert.equal(result.ready, false);
  assert.equal(result.adaptable.length, 0);
  assert.match(result.reason, /500/);
  assert.equal(result.inspected[0].width, 250);
});

test('przygotowanie akceptuje obraz spełniający minimum Allegro', async () => {
  const fetcher = async () => new Response(png(800, 500), { status: 200, headers: { 'content-type': 'image/png' } });
  const result = await checkAllegroImageReadiness(['https://example.test/large.png'], { fetcher, now: 2 });
  assert.equal(result.ready, true);
  assert.equal(result.valid.length, 1);
});

test('obraz 400 px jest kwalifikowany do bezpiecznego dopasowania przed wysłaniem', async () => {
  const fetcher = async () => new Response(png(400, 300), { status: 200, headers: { 'content-type': 'image/png' } });
  const result = await checkAllegroImageReadiness(['https://example.test/adapt.png'], { fetcher, now: 3 });
  assert.equal(result.ready, false);
  assert.equal(result.adaptable.length, 1);
  assert.match(result.reason, /dopasowania/i);
});

test('chwilowo nieosiągalny publiczny obraz przechodzi do końcowej walidacji Allegro', async () => {
  const fetcher = async () => { throw new Error('timeout CDN producenta'); };
  const result = await checkAllegroImageReadiness(['https://producer.test/game.jpg'], { fetcher, now: 4 });
  assert.equal(result.ready, false);
  assert.equal(result.remote.length, 1);
  assert.match(result.reason, /Allegro/i);
});
