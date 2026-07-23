import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductSourceInspectionService } from '../netlify/functions/lib/product-source-inspection-service.mjs';

test('import strony Multigry rozpoznaje EAN, numer referencyjny i komplet parametrów producenta', async () => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Edukarty - Multigra - gry dla każdego">
    <meta property="og:description" content="Edukacyjna gra rodzinna z kartami i żetonami.">
    <meta property="og:image" content="https://multigra.com.pl/media/edukarty.jpg">
  </head><body><h1>Edukarty</h1><div class="product__data">
    <div class="data__row"><div class="data__row--label">EAN:</div><div class="data__row--val">5906395300068</div></div>
    <div class="data__row"><div class="data__row--label">Numer referencyjny:</div><div class="data__row--val">0006</div></div>
    <div class="data__row"><div class="data__row--label">Wiek graczy od:</div><div class="data__row--val">5 lat</div></div>
    <div class="data__row"><div class="data__row--label">Liczba graczy:</div><div class="data__row--val">2+</div></div>
    <div class="data__row"><div class="data__row--label">Liczba elementów:</div><div class="data__row--val">151 szt</div></div>
    <div class="data__row"><div class="data__row--label">Wymiary opakowania:</div><div class="data__row--val">25,5/24,5/6 cm</div></div>
    <div class="data__row"><div class="data__row--label">Waga opakowania:</div><div class="data__row--val">0,47 kg</div></div>
    <div class="data__row"><div class="data__row--label">Wymiary opakowania zbiorczego:</div><div class="data__row--val">51/27/26 cm</div></div>
    <div class="data__row"><div class="data__row--label">Waga opakowania zbiorczego:</div><div class="data__row--val">3,96 kg</div></div>
    <div class="data__row"><div class="data__row--label">Ilość w opakowaniu zbiorczym:</div><div class="data__row--val">8 szt</div></div>
  </div><div id="projector_status_description">Produkt dostępny</div>
  <section class="products-related"><img src="https://multigra.com.pl/media/obcy-produkt.jpg" alt="Inny produkt"></section>
  ${' '.repeat(1800)}</body></html>`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    const service = createProductSourceInspectionService({
      read: async (_key, fallback) => fallback,
      write: async () => {},
      normalizeKey: (value) => String(value || '').toLowerCase().replace(/\W+/g, ''),
      nameSimilarity: () => 0,
    });
    const result = await service.inspectProductUrl('https://multigra.com.pl/produkty/edukarty/');
    const product = result.product;
    assert.equal(product.producent, 'Multigra');
    assert.equal(product.ean, '5906395300068');
    assert.equal(product.numerReferencyjny, '0006');
    assert.equal(product.kodProducenta, '0006');
    assert.equal(product.mpn, '0006');
    assert.equal(product.externalId, '0006');
    assert.equal(product.sku, '0006');
    assert.equal(product.parametryProducenta.liczbaElementow, '151 szt');
    assert.equal(product.parametryProducenta.iloscWOpakowaniuZbiorczym, '8 szt');
    assert.equal(product.parametryZrodla['wymiary opakowania zbiorczego'], '51/27/26 cm');
    assert.equal(product.zdjecie, 'https://multigra.com.pl/media/edukarty.jpg');
    assert.deepEqual(product.zdjecia, []);
    assert.equal(product.sourceEvidence.imagePolicyVersion, 2);
    assert.deepEqual(product.sourceEvidence.imageUrls, ['https://multigra.com.pl/media/edukarty.jpg']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
