import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createAllegroImagePublicationService } from '../src/backend/lib/domain/allegro-image-publication.mjs';
import { imageDimensions } from '../src/backend/lib/domain/allegro-image-readiness.mjs';

const png400x300 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAZAAAAEsAQMAAADXeXeBAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURf8AAP///0EdNBEAAAABYktHRAH/Ai3eAAAAB3RJTUUH6gccBAQcpICX5AAAACZJREFUaN7twTEBAAAAwqD1T20JT6AAAAAAAAAAAAAAAAAAAICnATvEAAEnf54JAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI2LTA3LTI4VDA0OjA0OjI4KzAwOjAwK+Q7RwAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNi0wNy0yOFQwNDowNDoyOCswMDowMFq5g/sAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjYtMDctMjhUMDQ6MDQ6MjgrMDA6MDANrKIkAAAAAElFTkSuQmCC', 'base64');
const jpeg500x375 = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAQDAwMDAgQDAwMEBAQFBgoGBgUFBgwICQcKDgwPDg4MDQ0PERYTDxAVEQ0NExoTFRcYGRkZDxIbHRsYHRYYGRj/wAALCAF3AfQBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/ALqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//2Q==', 'base64');

test('poprawne zdjęcie jest najpierw zapisywane na serwerze Allegro', async () => {
  const service = createAllegroImagePublicationService({
    inspect: async () => ({
      valid: [{ url: 'https://producer.test/game.jpg', ok: true, width: 1200, height: 900, format: 'jpeg' }],
      inspected: [{ url: 'https://producer.test/game.jpg', ok: true, width: 1200, height: 900, format: 'jpeg' }],
    }),
    uploadByUrl: async (_req, url) => ({ location: `https://a.allegroimg.com/original/${encodeURIComponent(url)}` }),
    uploadBinary: async () => assert.fail('nie należy przetwarzać poprawnego obrazu'),
  });
  const result = await service({}, ['https://producer.test/game.jpg']);
  assert.equal(result.ready, true);
  assert.equal(result.published[0].adapted, false);
  assert.match(result.images[0], /allegroimg/);
});

test('brak poprawnego obrazu daje jawny błąd zamiast pustego sukcesu', async () => {
  const service = createAllegroImagePublicationService({
    inspect: async () => ({
      valid: [],
      inspected: [{ url: 'https://producer.test/icon.png', ok: true, width: 120, height: 120, format: 'png' }],
    }),
    uploadByUrl: async () => assert.fail('miniatury nie wolno wysłać'),
    uploadBinary: async () => assert.fail('miniatury nie wolno powiększać'),
  });
  const result = await service({}, ['https://producer.test/icon.png']);
  assert.equal(result.ready, false);
  assert.equal(result.images.length, 0);
  assert.match(result.errors[0].error, /małe/i);
});

test('zdjęcie 400 px jest proporcjonalnie dopasowane do minimum 500 px i wysyłane binarnie', async () => {
  let uploadedDimensions = null;
  const service = createAllegroImagePublicationService({
    inspect: async () => ({
      valid: [],
      inspected: [{ url: 'https://producer.test/game.png', ok: true, width: 400, height: 300, format: 'png' }],
    }),
    fetcher: async () => new Response(png400x300, { status: 200, headers: { 'content-type': 'image/png' } }),
    execute: async (args) => {
      assert.ok(args.includes('500x375!'), 'serwis powinien wyliczyć proporcjonalny wymiar docelowy');
      await writeFile(args.at(-1), jpeg500x375);
    },
    uploadByUrl: async () => assert.fail('obraz wymagający dopasowania nie może być wysłany bez obróbki'),
    uploadBinary: async (_req, buffer, contentType) => {
      uploadedDimensions = imageDimensions(buffer);
      assert.equal(contentType, 'image/jpeg');
      return { location: 'https://a.allegroimg.com/original/adapted-image' };
    },
  });
  const result = await service({}, ['https://producer.test/game.png']);
  assert.equal(result.ready, true);
  assert.equal(result.published[0].adapted, true);
  assert.deepEqual(uploadedDimensions, { width: 500, height: 375, format: 'jpeg' });
});
