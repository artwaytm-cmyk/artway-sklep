import { readFile } from 'node:fs/promises';
import { catalogPlainText } from './catalog-quality.mjs';
import { seoProductUnavailable, seoSlug } from './seo-catalog.mjs';
import { loadStorefrontSeoCatalog } from './storefront-seo-catalog.mjs';
export { seoProductUnavailable, seoSlug } from './seo-catalog.mjs';

const ORIGIN = 'https://artwaytm.pl';
const CACHE_TTL_MS = 5 * 60 * 1000;
const templatePromise = readFile(new URL('../../../../index.html', import.meta.url), 'utf8');
let catalogCache = null;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const jsonLd = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const cleanText = (value, max = 5000) => catalogPlainText(value, max).replace(/\s+/g, ' ').trim();
const canonicalStoreContent = (product = {}) => String(product.vonHalskyContentMode || '').toLowerCase() === 'custom' ? {
  ...product,
  nazwa: product.vonHalskyTitle || product.nazwa,
  opisKrotki: product.vonHalskyShortDescription || product.opisKrotki || product.krotkiOpis,
  opis: product.vonHalskyDescription || product.opis,
} : product;
const absoluteUrl = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try { return new URL(raw, ORIGIN).toString(); } catch { return ''; }
};

async function catalogSnapshot() {
  if (catalogCache && Date.now() - catalogCache.loadedAt < CACHE_TTL_MS) return catalogCache;
  const shared = await loadStorefrontSeoCatalog();
  const products = shared.pageProducts, indexableProducts = shared.indexableProducts;
  const productById = new Map(), productsByCategory = new Map();
  for (const product of products) productById.set(String(product.id), product);
  for (const product of indexableProducts) {
    const category = cleanText(product.kategoria, 150);
    if (category) productsByCategory.set(category, [...(productsByCategory.get(category) || []), product]);
  }
  catalogCache = {
    data: shared.data,
    products,
    indexableProducts,
    productById,
    productsByCategory,
    updatedAt: shared.updatedAt,
    loadedAt: Date.now(),
  };
  return catalogCache;
}

function productImages(product = {}) {
  return [...new Set([product.zdjecie, product.image, product.imageUrl, ...(Array.isArray(product.zdjecia) ? product.zdjecia : [])].map(absoluteUrl).filter(Boolean))];
}

function productSeo(product = {}) {
  product = canonicalStoreContent(product);
  const name = cleanText(product.nazwa || product.name, 140) || 'Produkt';
  const brand = cleanText(product.producent || product.marka || product.brand, 80);
  const category = cleanText(product.kategoria || product.productType, 100);
  let title = cleanText(product.seoTitle, 160) || [name, brand && !name.toLowerCase().includes(brand.toLowerCase()) ? brand : ''].filter(Boolean).join(' – ');
  if (title.length < 30 && category) title += ` – ${category}`;
  if (title.length < 30) title += ' | Artway-TM';
  const source = product.seoDescription || product.opisKrotki || product.krotkiOpis || product.opis || product.description;
  let description = cleanText(source, 300) || `${name}${category ? ` z kategorii ${category}` : ''}. Sprawdź aktualną cenę, dostępność i dostawę InPost w Artway-TM.`;
  if (description.length < 80) description += ' Poznaj szczegóły produktu i zrób wygodne zakupy online w Artway-TM.';
  return { name, brand, category, title: title.slice(0, 150), description: description.slice(0, 160) };
}

function productIdentifiers(product = {}) {
  const gtin = cleanText(product.gtin || product.ean || product.GTIN || product.EAN, 20).replace(/\D/g, '');
  const sku = cleanText(product.sku || product.externalId || product.external_id || product.id, 100);
  const mpn = cleanText(product.mpn || product.kodProducenta || product.producentKod, 100);
  return { gtin, sku, mpn };
}

function productAggregateRating(product = {}) {
  const ratingValue = Number(product.rating ?? product.ocena ?? product.sredniaOcen);
  const ratingCount = Math.floor(Number(product.ratingCount ?? product.rating_count ?? product.liczbaOcen));
  if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5 || ratingCount < 1) return null;
  return { '@type': 'AggregateRating', ratingValue: ratingValue.toFixed(1), ratingCount };
}

const merchantReturnPolicy = Object.freeze({
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'PL',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 14,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
});

const shippingDetails = Object.freeze([
  {
    '@type': 'OfferShippingDetails',
    name: 'Paczkomat lub PaczkoPunkt InPost',
    shippingRate: { '@type': 'MonetaryAmount', value: '18.00', currency: 'PLN' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'PL' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 2, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
    },
  },
  {
    '@type': 'OfferShippingDetails',
    name: 'Kurier InPost',
    shippingRate: { '@type': 'MonetaryAmount', value: '24.00', currency: 'PLN' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'PL' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 2, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
    },
  },
]);

function productCard(product) {
  const seo = productSeo(product), image = productImages(product)[0], url = `/produkt/${encodeURIComponent(product.id)}`;
  return `<article class="seo-ssr-card">${image ? `<a href="${url}"><img src="${escapeHtml(image)}" alt="${escapeHtml(seo.name)}" loading="lazy" width="320" height="240"></a>` : ''}<div><small>${escapeHtml(seo.category || 'Produkty')}</small><h2><a href="${url}">${escapeHtml(seo.name)}</a></h2><p>${escapeHtml(seo.description)}</p><b>${Number(product.cena).toFixed(2).replace('.', ',')} zł</b>${product.__saleUnavailable?'<span>Chwilowo niedostępny</span>':''}</div></article>`;
}

function productPage(product, products) {
  product = canonicalStoreContent(product);
  const seo = productSeo(product), images = productImages(product), ids = productIdentifiers(product);
  const aggregateRating = productAggregateRating(product);
  const unavailable = product.__saleUnavailable === true;
  const canonical = `${ORIGIN}/produkt/${encodeURIComponent(product.id)}`;
  const categoryUrl = seo.category ? `${ORIGIN}/kategoria/${seoSlug(seo.category)}` : ORIGIN;
  const schema = {
    '@context': 'https://schema.org', '@graph': [
      {
        '@type': 'Product', '@id': `${canonical}#product`, name: seo.name, description: cleanText(product.opis || product.description || seo.description, 5000),
        image: images, sku: ids.sku, ...(ids.gtin ? { [`gtin${ids.gtin.length}`]: ids.gtin } : {}), ...(ids.mpn ? { mpn: ids.mpn } : {}),
        ...(seo.brand ? { brand: { '@type': 'Brand', name: seo.brand } } : {}),
        ...(aggregateRating ? { aggregateRating } : {}),
        offers: {
          '@type': 'Offer',
          url: canonical,
          priceCurrency: 'PLN',
          price: Number(product.cena).toFixed(2),
          availability: unavailable ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          shippingDetails,
          hasMerchantReturnPolicy: merchantReturnPolicy,
        },
      },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Strona główna', item: `${ORIGIN}/` },
        ...(seo.category ? [{ '@type': 'ListItem', position: 2, name: seo.category, item: categoryUrl }] : []),
        { '@type': 'ListItem', position: seo.category ? 3 : 2, name: seo.name, item: canonical },
      ] },
    ],
  };
  const related = products.filter((entry) => String(entry.id) !== String(product.id) && entry.kategoria === product.kategoria).slice(0, 4);
  const description = cleanText(product.opis || product.description || seo.description, 12000);
  const content = `<div class="seo-ssr-page"><nav class="seo-ssr-breadcrumb" aria-label="Okruszki"><a href="/">Sklep</a>${seo.category ? ` / <a href="/kategoria/${seoSlug(seo.category)}">${escapeHtml(seo.category)}</a>` : ''} / <span>${escapeHtml(seo.name)}</span></nav><article class="seo-ssr-product">${images[0] ? `<div class="seo-ssr-product-image"><img src="${escapeHtml(images[0])}" alt="${escapeHtml(seo.name)}" width="720" height="620"></div>` : ''}<div><small>${escapeHtml(seo.category || 'Oferta Artway-TM')}</small><h1>${escapeHtml(seo.name)}</h1><p>${escapeHtml(seo.description)}</p><strong>${Number(product.cena).toFixed(2).replace('.', ',')} zł</strong><p class="seo-ssr-available">${unavailable?'Chwilowo niedostępny — karta i adres pozostają aktywne':'Dostępny w sprzedaży • dostawa InPost'}</p>${ids.gtin || ids.sku ? `<dl><dt>Kod produktu</dt><dd>${escapeHtml(ids.gtin || ids.sku)}</dd></dl>` : ''}</div></article><section class="seo-ssr-description"><h2>Opis produktu</h2>${description.split(/\n+/).filter(Boolean).slice(0, 12).map((part) => `<p>${escapeHtml(part)}</p>`).join('')}</section>${related.length ? `<section><h2>Podobne produkty</h2><div class="seo-ssr-grid">${related.map(productCard).join('')}</div></section>` : ''}</div>`;
  return { title: seo.title, description: seo.description, canonical, image: images[0] || '', type: 'product', schema, content };
}

function collectionPage({ name, description, canonical, products }) {
  const title = `${name} | Artway-TM`;
  const schema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name, description, url: canonical, isPartOf: { '@type': 'WebSite', name: 'Artway-TM', url: `${ORIGIN}/` } },
    { '@type': 'ItemList', numberOfItems: products.length, itemListElement: products.slice(0, 48).map((product, index) => ({ '@type': 'ListItem', position: index + 1, url: `${ORIGIN}/produkt/${encodeURIComponent(product.id)}`, name: productSeo(product).name })) },
  ] };
  const content = `<div class="seo-ssr-page"><nav class="seo-ssr-breadcrumb" aria-label="Okruszki"><a href="/">Sklep</a> / <span>${escapeHtml(name)}</span></nav><header class="seo-ssr-collection-head"><h1>${escapeHtml(name)}</h1><p>${escapeHtml(description)}</p><b>${products.length} produktów</b></header><div class="seo-ssr-grid">${products.slice(0, 48).map(productCard).join('')}</div></div>`;
  return { title, description, canonical, image: productImages(products[0] || {})[0] || '', type: 'website', schema, content };
}

const FAQ_ITEMS = Object.freeze([
  ['Jak znaleźć odpowiedni produkt?', 'Użyj wyszukiwarki, katalogów albo sortowania. Produkty możesz także zapisać na liście ulubionych.'],
  ['Czy muszę zakładać konto?', 'Nie. Zamówienie możesz złożyć bez rejestracji. Konto ułatwia dostęp do historii zakupów i ulubionych produktów.'],
  ['Jakie są metody dostawy?', 'Zamówienia dostarcza InPost: do Paczkomatu lub PaczkoPunktu albo Kurierem InPost pod wskazany adres.'],
  ['Kiedy dostawa jest bezpłatna?', 'Warunek darmowej dostawy jest zawsze pokazany w koszyku przed złożeniem zamówienia.'],
  ['Jak mogę zapłacić?', 'Aktualnie dostępne metody płatności i ich ewentualne koszty są widoczne w koszyku przed potwierdzeniem zamówienia.'],
  ['Jak użyć kodu rabatowego?', 'Wpisz kod w koszyku i wybierz „Zastosuj”. Rabat od razu pojawi się w podsumowaniu.'],
  ['Jak zwrócić produkt?', 'Konsument może odstąpić od umowy w ciągu 14 dni od odbioru. Szczegóły i wzór oświadczenia znajdują się na stronie Zwroty i reklamacje.'],
  ['Jak zgłosić reklamację?', 'Wyślij opis problemu i numer zamówienia na sklep.artway@gmail.com. Zdjęcia są pomocne, ale nieobowiązkowe.'],
  ['Gdzie sprawdzić status zamówienia?', 'Status zamówienia przypisanego do konta znajdziesz w sekcji Moje zamówienia. Możesz też skontaktować się z obsługą i podać numer zamówienia.'],
]);

function staticContentPage(pathname) {
  if (pathname === '/o-nas') {
    const canonical = `${ORIGIN}/o-nas`;
    const description = 'Poznaj Artway-TM — polski sklep internetowy z grami, zabawkami kreatywnymi, balonami i artykułami imprezowymi.';
    const schema = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'AboutPage', name: 'O Artway-TM', description, url: canonical, isPartOf: { '@type': 'WebSite', name: 'Artway-TM', url: `${ORIGIN}/` } },
      { '@type': 'Organization', name: 'Artway-TM', url: `${ORIGIN}/`, email: 'sklep.artway@gmail.com', telephone: '+48530038914' },
    ] };
    const content = `<div class="seo-ssr-page"><nav class="seo-ssr-breadcrumb" aria-label="Okruszki"><a href="/">Sklep</a> / <span>O nas</span></nav><article class="seo-ssr-description"><h1>O Artway-TM</h1><p>Artway-TM to polski sklep internetowy z grami, zabawkami kreatywnymi, balonami i artykułami imprezowymi. Dbamy o czytelną prezentację produktów, bezpieczne zakupy i sprawną obsługę zamówień.</p><h2>Wygodne zakupy w jednym miejscu</h2><p>Wyszukiwarka, rozbudowane katalogi i filtry pomagają szybko znaleźć odpowiedni produkt. Przed złożeniem zamówienia pokazujemy cenę, dostępne płatności, sposób dostawy oraz całkowitą kwotę.</p><h2>Obsługa klienta</h2><p>Pomagamy w pytaniach dotyczących produktów, dostawy, płatności, zwrotów i reklamacji. Skontaktuj się z nami przez <a href="/kontakt/">stronę kontaktową</a> lub napisz na <a href="mailto:sklep.artway@gmail.com">sklep.artway@gmail.com</a>.</p></article></div>`;
    return { title: 'O nas – poznaj sklep Artway-TM', description, canonical, image: '', type: 'website', schema, content };
  }
  if (pathname === '/faq') {
    const canonical = `${ORIGIN}/faq`;
    const description = 'Odpowiedzi na najczęstsze pytania o zakupy, płatności, dostawę InPost, zwroty i reklamacje w sklepie Artway-TM.';
    const schema = { '@context': 'https://schema.org', '@type': 'FAQPage', name: 'Najczęstsze pytania – Artway-TM', url: canonical, mainEntity: FAQ_ITEMS.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) };
    const content = `<div class="seo-ssr-page"><nav class="seo-ssr-breadcrumb" aria-label="Okruszki"><a href="/">Sklep</a> / <span>FAQ</span></nav><article class="seo-ssr-description"><h1>Najczęstsze pytania</h1><p>${escapeHtml(description)}</p>${FAQ_ITEMS.map(([question, answer]) => `<section><h2>${escapeHtml(question)}</h2><p>${escapeHtml(answer)}</p></section>`).join('')}<p>Nie znalazłeś odpowiedzi? <a href="/kontakt/">Skontaktuj się z obsługą Artway-TM</a>.</p></article></div>`;
    return { title: 'FAQ – dostawa, płatności i zwroty | Artway-TM', description, canonical, image: '', type: 'website', schema, content };
  }
  return null;
}

function replaceMeta(html, { title, description, canonical, image, type, schema, content, noindex = false }) {
  let output = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta name="robots" content="[^"]*">/i, `<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">`)
    .replace(/<meta property="og:type" content="[^"]*">/i, `<meta property="og:type" content="${escapeHtml(type)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/i, `<meta property="og:url" content="${escapeHtml(canonical)}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/i, `<meta name="twitter:title" content="${escapeHtml(title)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/i, `<meta name="twitter:description" content="${escapeHtml(description)}">`)
    .replace(/<script id="artway-seo-schema" type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script id="artway-seo-schema" type="application/ld+json">${jsonLd(schema)}</script>`)
    .replace(/<main id="widok" tabindex="-1"[^>]*>[\s\S]*?<\/main>/i, `<main id="widok" tabindex="-1" data-server-rendered="true">${content}</main>`);
  const canonicalTag = `<link rel="canonical" href="${escapeHtml(canonical)}">`;
  output = /<link\b[^>]*rel=["']canonical["'][^>]*>/i.test(output)
    ? output.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/i, canonicalTag)
    : output.replace('</head>', `${canonicalTag}</head>`);
  const social = image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:alt" content="${escapeHtml(title)}"><meta name="twitter:image" content="${escapeHtml(image)}">` : '';
  output = output.replace('</head>', `${social}</head>`);
  return output;
}

export function seoRouteMatches(pathname = '') {
  return /^\/(?:produkt|kategoria)\/[^/]+\/?$/i.test(pathname) || /^\/(?:promocje|nowosci|o-nas|faq)\/?$/i.test(pathname);
}

export async function renderStorefrontSeoPage(request) {
  const url = new URL(request.url), pathname = decodeURIComponent(url.pathname.replace(/\/+$/, '') || '/');
  const { products, indexableProducts, productById, productsByCategory } = await catalogSnapshot();
  let page = staticContentPage(pathname);
  if (pathname.startsWith('/produkt/')) {
    const id = pathname.slice('/produkt/'.length);
    const product = productById.get(id);
    if (product) page = productPage(product, productsByCategory.get(cleanText(product.kategoria, 150)) || []);
  } else if (pathname.startsWith('/kategoria/')) {
    const key = pathname.slice('/kategoria/'.length);
    const categories = [...productsByCategory.keys()];
    const category = categories.find((entry) => entry === key || seoSlug(entry) === seoSlug(key));
    if (category) page = collectionPage({ name: category, description: `Produkty z kategorii ${category}. Sprawdź aktualną ofertę, ceny i wygodną dostawę InPost.`, canonical: `${ORIGIN}/kategoria/${seoSlug(category)}`, products: productsByCategory.get(category) || [] });
  } else if (pathname === '/promocje') {
    page = collectionPage({ name: 'Promocje', description: 'Aktualne promocje na gry, zabawki kreatywne, balony i artykuły imprezowe w Artway-TM.', canonical: `${ORIGIN}/promocje`, products: indexableProducts.filter((product) => Number(product.staraCena) > Number(product.cena)) });
  } else if (pathname === '/nowosci') {
    page = collectionPage({ name: 'Nowości', description: 'Nowe gry, zabawki kreatywne, balony i artykuły imprezowe dostępne w Artway-TM.', canonical: `${ORIGIN}/nowosci`, products: indexableProducts.filter((product) => String(product.badge || '').toLocaleLowerCase('pl-PL') === 'nowość') });
  }
  const template = await templatePromise;
  if (!page) {
    const fallback = { title: 'Nie znaleziono strony | Artway-TM', description: 'Ta karta produktu lub kategoria nie jest obecnie dostępna.', canonical: `${ORIGIN}${url.pathname}`, image: '', type: 'website', schema: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Nie znaleziono strony' }, content: '<div class="seo-ssr-page"><h1>Nie znaleziono strony</h1><p><a href="/">Wróć do sklepu</a></p></div>', noindex: true };
    return new Response(replaceMeta(template, fallback), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });
  }
  return new Response(replaceMeta(template, page), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, stale-while-revalidate=600', 'x-artway-seo-rendered': '1' } });
}
