import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiBannerPrompt, createAiBannerGenerator, normalizeAiBannerRequest } from '../netlify/functions/lib/domain/ai-banner-generator.mjs';

function memoryRepository() {
  const data = new Map();
  return {
    data,
    read: async (key, fallback) => data.has(key) ? data.get(key) : fallback,
    write: async (key, value) => { data.set(key, value); },
    remove: async (key) => { data.delete(key); },
  };
}

test('brief bannera jest normalizowany, a prompt rezerwuje miejsce na tekst HTML', () => {
  const input = normalizeAiBannerRequest({ brief: '  Balony na kolorowe urodziny  ', style: 'imprezowy', discountCode: 'start-10' });
  const prompt = buildAiBannerPrompt(input);
  assert.equal(input.discountCode, 'START-10');
  assert.match(prompt, /przestrzeń po lewej/);
  assert.match(prompt, /Nie dodawaj żadnych liter/);
  assert.match(prompt, /balonami/);
});

test('generator wykonuje prawdziwe wywołanie Images API i zapisuje obraz osobno od ustawień', async () => {
  const repository = memoryRepository(), image = Buffer.alloc(12_000, 7), requests = [];
  const generator = createAiBannerGenerator({
    ...repository,
    apiKey: 'test-key',
    model: 'gpt-image-2',
    fetchImpl: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({ data: [{ b64_json: image.toString('base64') }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const asset = await generator.generate({ brief: 'Rodzinny wieczór z grami planszowymi', style: 'radosny', quality: 'medium' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.openai.com/v1/images/generations');
  assert.equal(requests[0].body.size, '1536x1024');
  assert.equal(requests[0].body.output_format, 'webp');
  assert.equal(requests[0].body.quality, 'medium');
  assert.match(asset.url, /^\/api\/store\?action=ai-banner-image&id=ai_/);
  const stored = await generator.asset(asset.id);
  assert.equal(Buffer.from(stored.base64, 'base64').length, image.length);
  const list = await generator.list();
  assert.equal(list.items[0].id, asset.id);
  assert.equal('base64' in list.items[0], false);
});

test('generator nie udaje sukcesu, gdy OpenAI nie zwraca obrazu', async () => {
  const repository = memoryRepository();
  const generator = createAiBannerGenerator({ ...repository, apiKey: 'test-key', fetchImpl: async () => new Response(JSON.stringify({ data: [] }), { status: 200 }) });
  await assert.rejects(() => generator.generate({ brief: 'Promocja gier edukacyjnych dla dzieci' }), (error) => error.code === 'image_empty');
  assert.equal((await generator.list()).items.length, 0);
});

test('usunięcie grafiki czyści bibliotekę i rekord obrazu', async () => {
  const repository = memoryRepository(), image = Buffer.alloc(12_000, 3);
  const generator = createAiBannerGenerator({ ...repository, apiKey: 'test-key', fetchImpl: async () => new Response(JSON.stringify({ data: [{ b64_json: image.toString('base64') }] }), { status: 200 }) });
  const asset = await generator.generate({ brief: 'Nowości w sklepie z zabawkami' });
  assert.equal(await generator.deleteAsset(asset.id), true);
  assert.equal(await generator.asset(asset.id), null);
  assert.equal((await generator.list()).items.length, 0);
});
