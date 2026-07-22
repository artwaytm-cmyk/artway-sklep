import { createStoreRepository } from './lib/core/store-repository.mjs';
import { mergeCatalogProducts } from './lib/domain/catalog-quality.mjs';

const origin = 'https://artwaytm.pl';
const repository = createStoreRepository({ name: 'artway-sklep' });
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

function productIsUnavailable(product, availability = {}) {
  const record = availability?.[String(product?.id)] || availability?.[product?.id] || null;
  if (!record) return false;
  const decision = String(record.decision || record.decyzja || '').toLowerCase();
  if (decision === 'manual_available') return false;
  if (decision === 'grace') {
    const expires = Date.parse(record.expiresAt || record.waznaDo || '');
    return Number.isFinite(expires) && expires <= Date.now();
  }
  return String(record.status || '').toLowerCase() === 'niedostepny';
}

export default async () => {
  let settings = { data: {}, updated_at: null };
  try {
    settings = await repository.read('settings', settings);
  } catch (error) { /* pusty feed nadal pozostaje prawidłowym dokumentem XML */ }

  const data = settings.data && typeof settings.data === 'object' ? settings.data : {};
  const availability = data.artway_dostepnosc && typeof data.artway_dostepnosc === 'object' ? data.artway_dostepnosc : {};
  const hidden = new Set([
    ...(Array.isArray(data.artway_produkty_ukryte) ? data.artway_produkty_ukryte : []),
    ...(Array.isArray(data.artway_produkty_definitywne) ? data.artway_produkty_definitywne : []),
    ...(Array.isArray(data.artway_kosz_dodane) ? data.artway_kosz_dodane.map((product) => product?.id) : []),
  ].map(String));

  let excluded = 0;
  const items = mergeCatalogProducts(data).products.flatMap((product) => {
    const seo = automaticSeo(product);
    const id = String(valueFor(product, ['externalId', 'external_id', 'sku', 'id'])).trim().slice(0, 50);
    const title = seo.title;
    const description = seo.description;
    const images = productImages(product), image = images[0];
    const price = Number(valueFor(product, ['cena', 'price']));
    if (hidden.has(String(product.id)) || !id || !title || !description || !image || !(price > 0)) {
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
    return [`    <item>
      <g:id>${xml(id)}</g:id>
      <title>${xml(title)}</title>
      <description>${xml(description)}</description>
      <link>${xml(`${origin}/produkt/${encodeURIComponent(product.id)}`)}</link>
      <g:canonical_link>${xml(`${origin}/produkt/${encodeURIComponent(product.id)}`)}</g:canonical_link>
      <g:image_link>${xml(image)}</g:image_link>
      ${images.slice(1, 11).map((url) => `<g:additional_image_link>${xml(url)}</g:additional_image_link>`).join('\n      ')}
      <g:availability>${productIsUnavailable(product, availability) ? 'out_of_stock' : 'in_stock'}</g:availability>
      <g:price>${price.toFixed(2)} PLN</g:price>
      <g:condition>new</g:condition>
      ${brand ? `<g:brand>${xml(brand)}</g:brand>` : ''}
      ${gtin ? `<g:gtin>${xml(gtin)}</g:gtin>` : ''}
      ${mpn ? `<g:mpn>${xml(mpn)}</g:mpn>` : ''}
      <g:identifier_exists>${identifiers ? 'yes' : 'no'}</g:identifier_exists>
      ${category ? `<g:product_type>${xml(category)}</g:product_type>` : ''}
      ${googleCategory ? `<g:google_product_category>${xml(googleCategory)}</g:google_product_category>` : ''}
      ${weight > 0 ? `<g:shipping_weight>${weight.toFixed(3)} kg</g:shipping_weight>` : ''}
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
      'cache-control': 'public, max-age=1800',
      'x-artway-items': String(items.length),
      'x-artway-excluded': String(excluded),
    },
  });
};
