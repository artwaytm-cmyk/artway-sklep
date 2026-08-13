import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductSourceInspectionService } from '../src/backend/lib/product-source-inspection-service.mjs';
import { SOURCE_IMAGE_POLICY_VERSION } from '../src/backend/lib/domain/source-product-images.mjs';

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
    assert.equal(product.sourceEvidence.imagePolicyVersion, SOURCE_IMAGE_POLICY_VERSION);
    assert.deepEqual(product.sourceEvidence.imageUrls, ['https://multigra.com.pl/media/edukarty.jpg']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('import WooCommerce rozpoznaje parametry w znacznikach span i pełną kategorię z JSON-LD', async () => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Puzzle drewniane - Landscapes - Górska Chata - 580 el.">
    <meta property="og:description" content="Drewniane puzzle krajobrazowe składające się z 580 elementów.">
    <meta property="og:image" content="https://www.milliwood.com/5032.jpg">
    <script type="application/ld+json">${JSON.stringify({
      '@graph': [{ '@type': 'BreadcrumbList', itemListElement: [
        { position: 1, name: 'Strona główna' }, { position: 2, name: 'Sklep' }, { position: 3, name: 'Produkt' },
      ] }],
    })}</script>
    <script type="application/ld+json">${JSON.stringify({
      '@type': 'BreadcrumbList', itemListElement: [
        { position: 1, item: { name: 'Strona główna' } },
        { position: 2, item: { name: 'Sklep' } },
        { position: 3, item: { name: 'Puzzle drewniane' } },
        { position: 4, item: { name: 'Puzzle drewniane - Krajobrazy - Landscapes' } },
        { position: 5, item: { name: 'Górska Chata' } },
      ],
    })}</script>
  </head><body><h1>Górska Chata</h1><div class="product__data">
    <div class="data__row"><span class="data__row--label">Kod EAN:</span><span class="data__row--val">5906018050325</span></div>
    <div class="data__row"><span class="data__row--label">Producent:</span><span class="data__row--val">MilliWOOD</span></div>
    <div class="data__row"><span class="data__row--label">Nr produktu:</span><span class="data__row--val">5032</span></div>
    <div class="data__row"><span class="data__row--label">Wiek:</span><span class="data__row--val">12+</span></div>
    <div class="data__row"><span class="data__row--label">Ilość puzzli:</span><span class="data__row--val">580</span></div>
    <div class="data__row"><span class="data__row--label">Ostrzeżenia::</span><span class="data__row--val">Nieodpowiednie dla dzieci poniżej 3 lat.</span></div>
  </div><div data-stock="7">Produkt dostępny</div>${' '.repeat(1800)}</body></html>`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    const service = createProductSourceInspectionService({
      read: async (_key, fallback) => fallback,
      write: async () => {},
      normalizeKey: (value) => String(value || '').toLowerCase().replace(/\W+/g, ''),
      nameSimilarity: () => 0,
    });
    const result = await service.inspectProductUrl('https://www.milliwood.com/produkt/gorska-chata/');
    assert.equal(result.product.ean, '5906018050325');
    assert.equal(result.product.kodProducenta, '5032');
    assert.equal(result.product.kategoria, 'Puzzle drewniane - Krajobrazy - Landscapes');
    assert.equal(result.product.parametryProducenta.wiek, '12+');
    assert.equal(result.product.parametryProducenta.liczbaElementow, '580');
    assert.match(result.product.parametryProducenta.ostrzezenie, /poniżej 3 lat/);
    assert.equal(result.product.parametryZrodla['nr produktu'], '5032');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('import WooCommerce czyta pogrubione pary parametrów i standardowe pole SKU', async () => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Wielkanocny Kurczaczek - Celebrating">
    <meta property="og:description" content="Drewniane puzzle Wielkanocny Kurczaczek składające się z 50 elementów.">
    <meta property="og:image" content="https://www.milliwood.com/5083.jpg">
  </head><body><h1>Wielkanocny Kurczaczek</h1>
    <span class="sku_wrapper">SKU: <span class="sku">5083</span></span>
    <section id="projector_longdescription">Drewniane puzzle dla dzieci i dorosłych. Zestaw składa się z 50 elementów i przedstawia wielkanocnego kurczaczka.</section>
    <p><b>EAN</b>: 5906018050837</p>
    <p><strong>Ilość elementów</strong>: 50</p>
    <p><b>Wiek</b>: 4+</p>
    <div data-stock="5">Produkt dostępny</div>${' '.repeat(1800)}</body></html>`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    const service = createProductSourceInspectionService({
      read: async (_key, fallback) => fallback,
      write: async () => {},
      normalizeKey: (value) => String(value || '').toLowerCase().replace(/\W+/g, ''),
      nameSimilarity: () => 0,
    });
    const result = await service.inspectProductUrl('https://www.milliwood.com/produkt/wielkanocny-kurczaczek/');
    assert.equal(result.product.ean, '5906018050837');
    assert.equal(result.product.kodProducenta, '5083');
    assert.equal(result.product.parametryProducenta.liczbaElementow, '50');
    assert.equal(result.product.parametryProducenta.wiek, '4+');
    assert.equal(result.product.parametryZrodla.sku, '5083');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('czytnik zapasowy rozpoznaje wartości zapisane po dwukropku w tym samym wierszu', async () => {
  const markdown = `Title: Puzzle drewniane - Landscapes - Górska Chata - 580 el. | Milliwood

Markdown Content:
[Strona główna](https://www.milliwood.com/)/[Sklep](https://www.milliwood.com/sklep/)/[Puzzle drewniane](https://www.milliwood.com/kategoria-produktu/puzzle-drewniane/)/[Puzzle drewniane - Krajobrazy - Landscapes](https://www.milliwood.com/kategoria-produktu/puzzle-drewniane/puzzle-krajobrazy-landscape/)/Górska Chata

![Puzzle](https://www.milliwood.com/5032.jpg)

## 149,99 zł

Produkt dostępny

## Opis

Drewniane puzzle krajobrazowe składające się z 580 elementów i przeznaczone do relaksującego układania.

Kod EAN: 5906018050325

Nr produktu: 5032

Wiek: 12+

Ilość puzzli: 580

Ostrzeżenia:: Nieodpowiednie dla dzieci poniżej 3 lat.
${' '.repeat(1800)}`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(markdown, { status: 200, headers: { 'content-type': 'text/plain' } });
  try {
    const service = createProductSourceInspectionService({
      read: async (_key, fallback) => fallback,
      write: async () => {},
      normalizeKey: (value) => String(value || '').toLowerCase().replace(/\W+/g, ''),
      nameSimilarity: () => 0,
    });
    const result = await service.inspectProductUrlViaReader('https://www.milliwood.com/produkt/gorska-chata/');
    assert.equal(result.product.ean, '5906018050325');
    assert.equal(result.product.kodProducenta, '5032');
    assert.equal(result.product.kategoria, 'Puzzle drewniane - Krajobrazy - Landscapes');
    assert.equal(result.product.parametryProducenta.wiek, '12+');
    assert.equal(result.product.parametryProducenta.liczbaElementow, '580');
    assert.match(result.product.parametryProducenta.ostrzezenie, /poniżej 3 lat/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('czytnik zapasowy zachowuje zdjęcie bez rozszerzenia powiązane z dokładną stroną produktu', async () => {
  const image = 'https://a.allegroimg.com/original/11f20b/Magiczne-Mozaiki-Alexander-700-EL-0663';
  const markdown = `Title: Magiczne Mozaiki 700

Markdown Content:
# Magiczne Mozaiki 700

![Błędnie oznaczony link do strony](https://sklep.alexander.com.pl/product-pol-0663-Magiczne-Mozaiki-700.html)

![Magiczne Mozaiki 700 Kod producenta 0663](${image})

## 89,99 zł

Produkt dostępny

## Opis

Kreatywny zestaw edukacyjny zawiera planszę, walizkę, album oraz siedemset elementów do układania kolorowych wzorów i obrazów.

Kod producenta: 0663

EAN: 5906018006636

Podmiot odpowiedzialny

Producent: Alexander

Adres: ul. Telewizyjna 19

Kod pocztowy: 80-209

Miasto: Chwaszczyno

Kraj: Polska

Adres e-mail: alexander@alexander.com.pl
${' '.repeat(1800)}`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(markdown, { status: 200, headers: { 'content-type': 'text/plain' } });
  try {
    const service = createProductSourceInspectionService({
      read: async (_key, fallback) => fallback,
      write: async () => {},
      normalizeKey: (value) => String(value || '').toLowerCase().replace(/\W+/g, ''),
      nameSimilarity: () => 0,
    });
    const result = await service.inspectProductUrlViaReader('https://sklep.alexander.com.pl/product-pol-0663-Magiczne-Mozaiki-700.html');
    assert.equal(result.product.zdjecie, image);
    assert.deepEqual(result.product.sourceEvidence.imageUrls, [image]);
    assert.equal(result.product.sourceEvidence.imagePolicyVersion, SOURCE_IMAGE_POLICY_VERSION);
    assert.equal(result.product.sourceEvidence.responsibleProducer.legalName, 'Alexander');
    assert.doesNotMatch(result.product.sourceEvidence.responsibleProducer.legalName, /allegroimg|Magiczne Mozaiki/i);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('czytnik zapasowy rozpoznaje oficjalne zdjęcie po charakterystycznej nazwie mimo starego numeru pliku', async () => {
  const image = 'https://www.sklep.alexander.com.pl/hpeciai/5b38a3f72d5aa49c3c50a8244504ce2d/pol_pl_Matgram-1219_1.jpg';
  const markdown = `Title: Matgram - gra matematyczna Alexander

Markdown Content:
# Matgram - gra matematyczna Alexander

![Błędnie oznaczony link do strony](https://www.sklep.alexander.com.pl/product-pol-2443-Matgram.html)

![Matgram](${image})

![Obcy produkt](https://www.sklep.alexander.com.pl/hpeciai/11111111111111111111111111111111/pol_pl_Alexander-Gra-Planszowa-999_1.jpg)

## 69,99 zł

Produkt dostępny

## Opis

Matgram to rozbudowana gra matematyczna, która pomaga dzieciom ćwiczyć działania, logiczne myślenie i rozwiązywanie zadań.

Kod producenta: 2443

EAN: 5906018024432

Podmiot odpowiedzialny

Producent: Alexander

Adres: ul. Telewizyjna 19

Kod pocztowy: 80-209

Miasto: Chwaszczyno

Kraj: Polska

Adres e-mail: alexander@alexander.com.pl
${' '.repeat(1800)}`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(markdown, { status: 200, headers: { 'content-type': 'text/plain' } });
  try {
    const service = createProductSourceInspectionService({
      read: async (_key, fallback) => fallback,
      write: async () => {},
      normalizeKey: (value) => String(value || '').toLowerCase().replace(/\W+/g, ''),
      nameSimilarity: () => 0,
    });
    const result = await service.inspectProductUrlViaReader('https://www.sklep.alexander.com.pl/product-pol-2443-Matgram.html');
    assert.equal(result.product.zdjecie, image);
    assert.deepEqual(result.product.zdjecia, []);
    assert.deepEqual(result.product.sourceEvidence.imageUrls, [image]);
    assert.equal(result.product.sourceEvidence.imagePolicyVersion, SOURCE_IMAGE_POLICY_VERSION);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('czytnik IdoSell używa poprawnego GTIN z pola kod producenta, gdy etykieta EAN jest uszkodzona', async () => {
  const image = 'https://sklep.alexander.com.pl/hpeciai/hash/pol_pm_ECO-FUN-TRYLMA-1164_1.jpg';
  const markdown = `Title: ECO FUN - TRYLMA

Markdown Content:
# ECO FUN - TRYLMA

![Trylma](${image})

## 79,99 zł

Produkt dostępny

## Opis

Trylma to strategiczna gra planszowa na planszy w kształcie gwiazdy, przeznaczona do rodzinnej rozgrywki i ćwiczenia logicznego myślenia.

Symbol

2530

Kod producenta

5906018025309

EAN

590608025309
${' '.repeat(1800)}`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(markdown, { status: 200, headers: { 'content-type': 'text/plain' } });
  try {
    const service = createProductSourceInspectionService({
      read: async (_key, fallback) => fallback,
      write: async () => {},
      normalizeKey: (value) => String(value || '').toLowerCase().replace(/\W+/g, ''),
      nameSimilarity: () => 0,
    });
    const result = await service.inspectProductUrlViaReader('https://sklep.alexander.com.pl/product-pol-2530-ECO-FUN-TRYLMA.html');
    assert.equal(result.product.ean, '5906018025309');
    assert.equal(result.product.gtin, '5906018025309');
    assert.equal(result.product.kodProducenta, '2530');
    assert.equal(result.product.zdjecie, image);
    assert.deepEqual(result.product.sourceEvidence.imageUrls, [image]);
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
