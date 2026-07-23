import { readFile } from 'node:fs/promises';
import { createStoreRepository } from '../core/store-repository.mjs';
import { catalogPlainText, mergeCatalogProducts } from './catalog-quality.mjs';
import { seoProductUnavailable, seoSlug } from './seo-catalog.mjs';
export { seoProductUnavailable, seoSlug } from './seo-catalog.mjs';

const ORIGIN = 'https://artwaytm.pl';
const CACHE_TTL_MS = 5 * 60 * 1000;
const repository = createStoreRepository({ name: 'artway-sklep' });
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

function activeCatalog(data = {}) {
  return mergeCatalogProducts(data).activeProducts
    .filter((product) => Number(product.cena) > 0)
    .map((product) => ({ ...product, __saleUnavailable: seoProductUnavailable(data, product) }));
}

async function catalogSnapshot() {
  if (catalogCache && Date.now() - catalogCache.loadedAt < CACHE_TTL_MS) return catalogCache;
  const record = await repository.read('settings', { data: {}, updated_at: null });
  const data = record?.data && typeof record.data === 'object' ? record.data : {};
  const products = activeCatalog(data), productById = new Map(), productsByCategory = new Map();
  for (const product of products) {
    productById.set(String(product.id), product);
    const category = cleanText(product.kategoria, 150);
    if (category) productsByCategory.set(category, [...(productsByCategory.get(category) || []), product]);
  }
  catalogCache = { data, products, productById, productsByCategory, updatedAt: record?.updated_at || null, loadedAt: Date.now() };
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

function productCard(product) {
  const seo = productSeo(product), image = productImages(product)[0], url = `/produkt/${encodeURIComponent(product.id)}`;
  return `<article class="seo-ssr-card">${image ? `<a href="${url}"><img src="${escapeHtml(image)}" alt="${escapeHtml(seo.name)}" loading="lazy" width="320" height="240"></a>` : ''}<div><small>${escapeHtml(seo.category || 'Produkty')}</small><h2><a href="${url}">${escapeHtml(seo.name)}</a></h2><p>${escapeHtml(seo.description)}</p><b>${Number(product.cena).toFixed(2).replace('.', ',')} zł</b>${product.__saleUnavailable?'<span>Chwilowo niedostępny</span>':''}</div></article>`;
}

function productPage(product, products) {
  product = canonicalStoreContent(product);
  const seo = productSeo(product), images = productImages(product), ids = productIdentifiers(product);
  const unavailable = product.__saleUnavailable === true;
  const canonical = `${ORIGIN}/produkt/${encodeURIComponent(product.id)}`;
  const categoryUrl = seo.category ? `${ORIGIN}/kategoria/${seoSlug(seo.category)}` : ORIGIN;
  const schema = {
    '@context': 'https://schema.org', '@graph': [
      {
        '@type': 'Product', '@id': `${canonical}#product`, name: seo.name, description: cleanText(product.opis || product.description || seo.description, 5000),
        image: images, sku: ids.sku, ...(ids.gtin ? { [`gtin${ids.gtin.length}`]: ids.gtin } : {}), ...(ids.mpn ? { mpn: ids.mpn } : {}),
        ...(seo.brand ? { brand: { '@type': 'Brand', name: seo.brand } } : {}),
        offers: { '@type': 'Offer', url: canonical, priceCurrency: 'PLN', price: Number(product.cena).toFixed(2), availability: unavailable ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition' },
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
  const social = `<link rel="canonical" href="${escapeHtml(canonical)}">${image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:alt" content="${escapeHtml(title)}"><meta name="twitter:image" content="${escapeHtml(image)}">` : ''}`;
  output = output.replace('</head>', `${social}</head>`);
  return output;
}

export function seoRouteMatches(pathname = '') {
  return /^\/(?:produkt|kategoria)\/[^/]+\/?$/i.test(pathname) || /^\/(?:promocje|nowosci)\/?$/i.test(pathname);
}

export async function renderStorefrontSeoPage(request) {
  const url = new URL(request.url), pathname = decodeURIComponent(url.pathname.replace(/\/+$/, '') || '/');
  const { products, productById, productsByCategory } = await catalogSnapshot();
  let page = null;
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
    page = collectionPage({ name: 'Promocje', description: 'Aktualne promocje na gry, zabawki kreatywne, balony i artykuły imprezowe w Artway-TM.', canonical: `${ORIGIN}/promocje`, products: products.filter((product) => Number(product.staraCena) > Number(product.cena)) });
  } else if (pathname === '/nowosci') {
    page = collectionPage({ name: 'Nowości', description: 'Nowe gry, zabawki kreatywne, balony i artykuły imprezowe dostępne w Artway-TM.', canonical: `${ORIGIN}/nowosci`, products: products.filter((product) => String(product.badge || '').toLocaleLowerCase('pl-PL') === 'nowość') });
  }
  const template = await templatePromise;
  if (!page) {
    const fallback = { title: 'Nie znaleziono strony | Artway-TM', description: 'Ta karta produktu lub kategoria nie jest obecnie dostępna.', canonical: `${ORIGIN}${url.pathname}`, image: '', type: 'website', schema: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Nie znaleziono strony' }, content: '<div class="seo-ssr-page"><h1>Nie znaleziono strony</h1><p><a href="/">Wróć do sklepu</a></p></div>', noindex: true };
    return new Response(replaceMeta(template, fallback), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });
  }
  return new Response(replaceMeta(template, page), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, stale-while-revalidate=600', 'x-artway-seo-rendered': '1' } });
}
