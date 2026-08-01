import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductSourceInspectionService } from '../src/backend/lib/product-source-inspection-service.mjs';

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

test('krótki opis produktu Alexander ma pierwszeństwo przed koszykiem, logowaniem i stopką strony', async () => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Wiatrak B">
    <meta property="og:description" content="Gry planszowe, gry rodzinne i zabawki w sklepie producenta.">
    <meta property="og:image" content="https://www.sklep.alexander.com.pl/data/include/cms/wiatrak.jpg">
  </head><body>
    <h1>Wiatrak B</h1>
    <section id="projector_longdescription">Wiatraczek o średnicy 25 cm (rozmiar główki).</section>
    <div>Dodaj produkty podając kody</div>
    <div>Wgraj pliki z kodami</div>
    <div>Przejdź do koszyka</div>
    <div>Zaloguj się do Twojego konta</div>
    <footer>Newsletter Polityka prywatności Regulamin sklepu</footer>
    ${' '.repeat(1800)}
  </body></html>`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    const service = createProductSourceInspectionService({
      read: async (_key, fallback) => fallback,
      write: async () => {},
      normalizeKey: (value) => String(value || '').toLowerCase().replace(/\W+/g, ''),
      nameSimilarity: () => 0,
    });
    const result = await service.inspectProductUrl('https://www.sklep.alexander.com.pl/product-pol-130-Wiatrak-B.html');
    assert.equal(result.product.opis, 'Wiatraczek o średnicy 25 cm (rozmiar główki).');
    assert.equal(result.product.opisKrotki, 'Wiatraczek o średnicy 25 cm (rozmiar główki).');
    assert.doesNotMatch(result.product.opis, /koszyk|zaloguj|newsletter/i);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('import WordPress pobiera oficjalne zdjęcie produktu z primaryImageOfPage JSON-LD', async () => {
  const html = `<!doctype html><html><head>
    <title>Śrubka po śrubce – Multigra</title>
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': 'https://multigra.com.pl/produkty/srubka-po-srubce/#webpage', name: 'Śrubka po śrubce', thumbnailUrl: 'https://multigra.com.pl/wp-content/uploads/sites/5/2026/05/3002.jpg', primaryImageOfPage: { '@id': 'https://multigra.com.pl/produkty/srubka-po-srubce/#primaryimage' } },
        { '@type': 'ImageObject', '@id': 'https://multigra.com.pl/produkty/srubka-po-srubce/#primaryimage', url: 'https://multigra.com.pl/wp-content/uploads/sites/5/2026/05/3002.jpg', contentUrl: 'https://multigra.com.pl/wp-content/uploads/sites/5/2026/05/3002.jpg' },
        { '@type': 'Organization', logo: { url: 'https://multigra.com.pl/logo.png' } },
      ],
    })}</script>
  </head><body><h1>Śrubka po śrubce</h1><div class="gallery__section"><div class="ref__nr"><span>3002</span></div></div><p>Gra edukacyjna rozwijająca sprawność manualną dzieci.</p>${' '.repeat(1800)}</body></html>`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    const service = createProductSourceInspectionService({
      read: async (_key, fallback) => fallback,
      write: async () => {},
      normalizeKey: (value) => String(value || '').toLowerCase().replace(/\W+/g, ''),
      nameSimilarity: () => 0,
    });
    const result = await service.inspectProductUrl('https://multigra.com.pl/produkty/srubka-po-srubce/');
    assert.equal(result.product.zdjecie, 'https://multigra.com.pl/wp-content/uploads/sites/5/2026/05/3002.jpg');
    assert.equal(result.product.kodProducenta, '3002');
    assert.equal(result.product.mpn, '3002');
    assert.equal(result.product.externalId, '3002');
    assert.equal(result.product.sku, '3002');
    assert.deepEqual(result.product.sourceEvidence.imageUrls, ['https://multigra.com.pl/wp-content/uploads/sites/5/2026/05/3002.jpg']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
