import { loadStorefrontSeoCatalog } from './lib/domain/storefront-seo-catalog.mjs';
import { storeShippingConfig } from './lib/domain/store-shipping-config.mjs';

const origin = 'https://artwaytm.pl';
const xml = (value) => String(value ?? '').replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const plain = (value, max = 5000) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);
const absoluteUrl = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try { return new URL(raw, origin).toString(); } catch (error) { return ''; }
};
const valueFor = (obj, names = []) => {
  for (const name of names) if (obj?.[name] !== undefined && obj?.[name] !== null && String(obj[name]).trim()) return obj[name];
  return '';
};
const productImages = (product = {}) => [...new Set([
  valueFor(product, ['zdjecie', 'image', 'imageUrl']),
  ...(Array.isArray(product.zdjecia) ? product.zdjecia : []),
  ...(Array.isArray(product.images) ? product.images : []),
].map(absoluteUrl).filter(Boolean))];
const automaticSeo = (product = {}) => {
  const name = plain(valueFor(product, ['nazwa', 'name']), 120) || 'Produkt';
  const category = plain(valueFor(product, ['kategoria', 'productType']), 80);
  const brand = plain(valueFor(product, ['producent', 'marka', 'brand']), 70);
  const storedTitle = plain(product.seoTitle, 150);
  const storedDescription = plain(valueFor(product, ['seoDescription', 'opisKrotki', 'krotkiOpis', 'opis', 'description']), 5000);
  let title = storedTitle || [name, brand && !name.toLowerCase().includes(brand.toLowerCase()) ? brand : ''].filter(Boolean).join(' – ');
  if (title.length < 30 && category && !title.toLowerCase().includes(category.toLowerCase())) title += ` – ${category}`;
  if (title.length < 30) title += ' | Artway-TM';
  const description = storedDescription || `${name}${category ? ` z kategorii ${category}` : ''}. Sprawdź opis, aktualną cenę, dostępność i bezpieczne zakupy w Artway-TM.`;
  return { title: title.slice(0, 150), description: description.slice(0, 5000) };
};

export default async () => {
  const catalog = await loadStorefrontSeoCatalog();
  const shippingConfig = storeShippingConfig(catalog.data, { updatedAt: catalog.updatedAt });
  const shipping = shippingConfig.methods;
  let excluded = 0;
  let outOfStock = 0;
  const items = catalog.indexableProducts.flatMap((product) => {
    const seo = automaticSeo(product);
    // ID źródła Merchant Center musi być unikalne i niezmienne. Kody
    // producentów/externalId powtarzają się między dostawcami, dlatego źródłem
    // identyfikatora jest wyłącznie centralny klucz kartoteki.
    const id = String(product.id ?? '').trim().slice(0, 50);
    const title = seo.title;
    const description = seo.description;
    const images = productImages(product), image = images[0];
    const price = Number(valueFor(product, ['cena', 'price']));
    if (!id || !title || !description || !image || !(price > 0)) {
      excluded += 1;
      return [];
    }

    const brand = plain(valueFor(product, ['producent', 'marka', 'brand']), 70);
    const gtin = plain(valueFor(product, ['gtin', 'ean']), 50).replace(/\s+/g, '');
    const mpn = plain(valueFor(product, ['mpn', 'kodProducenta', 'sku']), 70);
    const category = plain(valueFor(product, ['kategoria', 'productType']), 750);
    const googleCategory = plain(valueFor(product, ['googleProductCategory', 'google_product_category']), 250);
    const weight = Number(valueFor(product, ['waga', 'weight']));
    const identifiers = !!(gtin || mpn);
    const unavailable = product.__saleUnavailable === true;
    if (unavailable) outOfStock += 1;
    const regularPrice = Number(valueFor(product, ['staraCena', 'regularPrice']));
    const sale = regularPrice > price;
    return [`    <item>
      <g:id>${xml(id)}</g:id>
      <title>${xml(title)}</title>
      <description>${xml(description)}</description>
      <link>${xml(`${origin}/produkt/${encodeURIComponent(product.id)}`)}</link>
      <g:canonical_link>${xml(`${origin}/produkt/${encodeURIComponent(product.id)}`)}</g:canonical_link>
      <g:image_link>${xml(image)}</g:image_link>
      ${images.slice(1, 11).map((url) => `<g:additional_image_link>${xml(url)}</g:additional_image_link>`).join('\n      ')}
      <g:availability>${unavailable ? 'out_of_stock' : 'in_stock'}</g:availability>
      <g:price>${(sale ? regularPrice : price).toFixed(2)} PLN</g:price>
      ${sale ? `<g:sale_price>${price.toFixed(2)} PLN</g:sale_price>` : ''}
      <g:condition>new</g:condition>
      ${brand ? `<g:brand>${xml(brand)}</g:brand>` : ''}
      ${gtin ? `<g:gtin>${xml(gtin)}</g:gtin>` : ''}
      ${mpn ? `<g:mpn>${xml(mpn)}</g:mpn>` : ''}
      <g:identifier_exists>${identifiers ? 'yes' : 'no'}</g:identifier_exists>
      ${category ? `<g:product_type>${xml(category)}</g:product_type>` : ''}
      ${googleCategory ? `<g:google_product_category>${xml(googleCategory)}</g:google_product_category>` : ''}
      ${weight > 0 ? `<g:shipping_weight>${weight.toFixed(3)} kg</g:shipping_weight>` : ''}
      ${shipping.map((method) => `<g:shipping><g:country>PL</g:country><g:service>${xml(method.name)}</g:service><g:price>${method.price.toFixed(2)} PLN</g:price></g:shipping>`).join('\n      ')}
    </item>`];
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Artway-TM — produkty</title>
    <link>${origin}/</link>
    <description>Automatyczny katalog produktów Artway-TM dla bezpłatnych informacji produktowych Google.</description>
${items.join('\n')}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Feed zawsze przelicza ceny z aktualnych ustawień. Rewalidacja chroni
      // Google i panel przed używaniem starego cennika po jego zapisaniu.
      'cache-control': 'no-cache, max-age=0, must-revalidate',
      'x-artway-items': String(items.length),
      'x-artway-excluded': String(excluded),
      'x-artway-out-of-stock': String(outOfStock),
      'x-artway-canonicalized-duplicate-groups': String(catalog.duplicateGroups || 0),
      'x-artway-shipping-version': shippingConfig.version,
      'x-artway-free-shipping-from': shippingConfig.freeFrom.toFixed(2),
    },
  });
};
