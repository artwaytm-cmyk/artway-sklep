import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { catalogPlainText } from './catalog-quality.mjs';
import { seoProductUnavailable, seoSlug } from './seo-catalog.mjs';
import { loadStoreShippingConfig, shippingTopbarHtml } from './store-shipping-config.mjs';
import { loadStorefrontSeoContest } from './storefront-contest-seo.mjs';
import { loadStorefrontSeoCatalog, loadStorefrontSeoProductsByIds } from './storefront-seo-catalog.mjs';
export { seoProductUnavailable, seoSlug } from './seo-catalog.mjs';

const ORIGIN = 'https://artwaytm.pl';
const CACHE_TTL_MS = 5 * 60 * 1000;
const sourceTemplatePromise = readFile(new URL('../../../../index.html', import.meta.url), 'utf8');
const ACTIVE_RELEASE_DIR = process.env.ARTWAY_CURRENT_RELEASE || '/srv/artway/releases/current';
let catalogCache = null;
const activeTemplateCache = new Map();
const PUBLIC_INFORMATION_FILES = Object.freeze({
  '/kontakt': 'kontakt/index.html',
  '/regulamin': 'regulamin/index.html',
  '/prywatnosc': 'prywatnosc/index.html',
  '/dostawa': 'dostawa/index.html',
  '/zwroty': 'zwroty/index.html',
});

async function activeReleaseTemplate(relativePath = 'index.html') {
  try {
    const manifest = JSON.parse(await readFile(path.join(ACTIVE_RELEASE_DIR, 'release.json'), 'utf8'));
    const releaseId = String(manifest?.releaseId || manifest?.version || '').trim();
    const key = `${releaseId}:${relativePath}`;
    if (releaseId && activeTemplateCache.has(key)) return activeTemplateCache.get(key);
    const html = await readFile(path.join(ACTIVE_RELEASE_DIR, relativePath), 'utf8');
    if (releaseId) activeTemplateCache.set(key, html);
    return html;
  } catch {
    if (relativePath === 'index.html') return sourceTemplatePromise;
    return readFile(new URL(`../../../../${relativePath}`, import.meta.url), 'utf8');
  }
}

const storefrontTemplate = () => activeReleaseTemplate('index.html');

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
  const products = shared.pageProducts;
  const indexableProducts = shared.indexableProducts;
  const sellableProducts = shared.sellableProducts || indexableProducts.filter((product) => product.__saleUnavailable !== true);
  const productById = new Map(), productsByCategory = new Map();
  for (const product of products) productById.set(String(product.id), product);
  for (const product of sellableProducts) {
    const category = cleanText(product.kategoria, 150);
    if (category) productsByCategory.set(category, [...(productsByCategory.get(category) || []), product]);
  }
  catalogCache = {
    data: shared.data,
    products,
    indexableProducts,
    sellableProducts,
    productById,
    productsByCategory,
    duplicateCanonicalById: shared.duplicateCanonicalById || new Map(),
    duplicateGroups: Number(shared.duplicateGroups) || 0,
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

function shippingDetailsFor(shipping) {
  return shipping.methods
    .map((method) => ({
      '@type': 'OfferShippingDetails',
      name: cleanText(method.name || method.id, 100),
      shippingRate: { '@type': 'MonetaryAmount', value: method.price.toFixed(2), currency: 'PLN' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'PL' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 2, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
      },
    }))
    .filter((method) => method.name);
}

function productCard(product) {
  const seo = productSeo(product), image = productImages(product)[0], url = `/produkt/${encodeURIComponent(product.id)}`;
  return `<article class="seo-ssr-card">${image ? `<a href="${url}"><img src="${escapeHtml(image)}" alt="${escapeHtml(seo.name)}" loading="lazy" width="320" height="240"></a>` : ''}<div><small>${escapeHtml(seo.category || 'Produkty')}</small><h2><a href="${url}">${escapeHtml(seo.name)}</a></h2><p>${escapeHtml(seo.description)}</p><b>${Number(product.cena).toFixed(2).replace('.', ',')} zł</b>${product.__saleUnavailable?'<span>Chwilowo niedostępny</span>':''}</div></article>`;
}

function productPage(product, products, shipping) {
  product = canonicalStoreContent(product);
  const seo = productSeo(product), images = productImages(product), ids = productIdentifiers(product);
  const aggregateRating = productAggregateRating(product);
  const unavailable = product.__saleUnavailable === true;
  const shippingDetails = shippingDetailsFor(shipping);
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
          ...(shippingDetails.length ? { shippingDetails } : {}),
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

function homePage({ data = {}, sellableProducts = [] } = {}) {
  const settings = data.artway_ustawienia && typeof data.artway_ustawienia === 'object' ? data.artway_ustawienia : {};
  const seo = settings.seo && typeof settings.seo === 'object' ? settings.seo : {};
  const company = settings.daneFirmy && typeof settings.daneFirmy === 'object' ? settings.daneFirmy : {};
  const title = cleanText(seo.tytul, 150) || 'Gry, zabawki i artykuły imprezowe | Artway-TM';
  const description = cleanText(seo.opis || settings.opisSklepu, 160) || 'Gry, zabawki kreatywne, balony i artykuły imprezowe od sprawdzonych producentów. Wygodne zakupy i dostawa InPost.';
  const email = cleanText(settings.emailSklepu, 120) || 'artwaytm@gmail.com';
  const phone = cleanText(settings.telefon, 40) || '+48 530 038 914';
  const products = sellableProducts.slice(0, 12);
  const schema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: 'Artway-TM', url: `${ORIGIN}/`, inLanguage: 'pl-PL' },
    {
      '@type': ['Organization', 'OnlineStore'],
      '@id': `${ORIGIN}/#store`,
      name: cleanText(settings.nazwaSklepu, 100) || 'Artway-TM',
      legalName: cleanText(company.nazwa, 200) || 'ARTWAY-TM SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      taxID: cleanText(company.nip, 20) || '5882468333',
      url: `${ORIGIN}/`,
      email,
      telephone: phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: cleanText(company.adres, 160) || 'Gryfa Pomorskiego 1/A',
        postalCode: cleanText(company.kodPocztowy, 20) || '84-207',
        addressLocality: cleanText(company.miasto, 100) || 'Bojano',
        addressCountry: 'PL',
      },
      hasMerchantReturnPolicy: merchantReturnPolicy,
    },
    { '@type': 'WebPage', '@id': `${ORIGIN}/#home`, name: title, description, url: `${ORIGIN}/`, isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': `${ORIGIN}/#store` } },
    { '@type': 'ItemList', name: 'Aktualnie dostępne produkty', numberOfItems: products.length, itemListElement: products.map((product, index) => ({ '@type': 'ListItem', position: index + 1, url: `${ORIGIN}/produkt/${encodeURIComponent(product.id)}`, name: productSeo(product).name })) },
  ] };
  const content = `<div class="seo-home-entry"><section><small>ARTWAY-TM • GRY, ZABAWKI I ARTYKUŁY IMPREZOWE</small><h1>Pomysły na wspólną zabawę, naukę i udane przyjęcie</h1><p>${escapeHtml(description)}</p><div><a href="/nowosci">Zobacz nowości</a><a href="/promocje">Sprawdź promocje</a></div></section><aside><b>Dlaczego Artway-TM?</b><ul><li>Gry i zabawki sprawdzonych marek</li><li>Aktualna dostępność produktów</li><li>Dostawa Paczkomatem lub Kurierem InPost</li><li>14 dni na zwrot</li></ul></aside></div>${products.length ? `<div class="seo-ssr-page"><section><h2>Aktualnie dostępne produkty</h2><div class="seo-ssr-grid">${products.map(productCard).join('')}</div></section></div>` : ''}`;
  return { title, description, canonical: `${ORIGIN}/`, image: productImages(products[0] || {})[0] || '', type: 'website', schema, content };
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
  if (pathname === '/konkursy') {
    const canonical = `${ORIGIN}/konkursy`;
    const description = 'Konkursy Artway-TM: wykonaj zadanie, poznaj jasne zasady i sprawdź wyniki dopiero po zakończeniu oceny.';
    const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Konkursy Artway-TM', description, url: canonical };
    const content = '<div class="seo-ssr-page"><nav class="seo-ssr-breadcrumb" aria-label="Okruszki"><a href="/">Sklep</a> / <span>Konkursy</span></nav><article class="seo-ssr-description"><h1>Konkursy Artway-TM</h1><p>Wykonaj zadanie konkursowe, zapoznaj się z warunkami udziału i wyślij jedną własną pracę z zalogowanego konta.</p><h2>Jasne zasady i bezpieczne wyniki</h2><p>Każdy konkurs ma osobny regulamin, kryteria oceny, termin i opis nagrody. Ranking pozostaje ukryty w czasie trwania konkursu i pojawia się dopiero po zakończeniu oceny.</p></article></div>';
    return { title: 'Konkursy – zadania i nagrody | Artway-TM', description, canonical, image: '', type: 'website', schema, content };
  }
  if (pathname === '/o-nas') {
    const canonical = `${ORIGIN}/o-nas`;
    const description = 'Poznaj Artway-TM — polski sklep internetowy z grami, zabawkami kreatywnymi, balonami i artykułami imprezowymi.';
    const schema = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'AboutPage', name: 'O Artway-TM', description, url: canonical, isPartOf: { '@type': 'WebSite', name: 'Artway-TM', url: `${ORIGIN}/` } },
      { '@type': 'Organization', name: 'Artway-TM', url: `${ORIGIN}/`, email: 'artwaytm@gmail.com', telephone: '+48530038914' },
    ] };
    const content = `<div class="seo-ssr-page"><nav class="seo-ssr-breadcrumb" aria-label="Okruszki"><a href="/">Sklep</a> / <span>O nas</span></nav><article class="seo-ssr-description"><h1>O Artway-TM</h1><p>Artway-TM to polski sklep internetowy z grami, zabawkami kreatywnymi, balonami i artykułami imprezowymi. Dbamy o czytelną prezentację produktów, bezpieczne zakupy i sprawną obsługę zamówień.</p><h2>Wygodne zakupy w jednym miejscu</h2><p>Wyszukiwarka, rozbudowane katalogi i filtry pomagają szybko znaleźć odpowiedni produkt. Przed złożeniem zamówienia pokazujemy cenę, dostępne płatności, sposób dostawy oraz całkowitą kwotę.</p><h2>Obsługa klienta</h2><p>Pomagamy w pytaniach dotyczących produktów, dostawy, płatności, zwrotów i reklamacji. Skontaktuj się z nami przez <a href="/kontakt/">stronę kontaktową</a> lub napisz na <a href="mailto:artwaytm@gmail.com">artwaytm@gmail.com</a>.</p></article></div>`;
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

function contestPage(contest) {
  const canonical = `${ORIGIN}/konkurs/${encodeURIComponent(contest.slug)}`;
  const description = cleanText(contest.description, 155) || `Konkurs ${contest.title} w Artway-TM.`;
  const prize = Number(contest.prizeAmount) > 0 ? `${Number(contest.prizeAmount).toLocaleString('pl-PL')} zł` : contest.prizeDescription;
  const schema = { '@context': 'https://schema.org', '@type': 'WebPage', name: contest.title, description, url: canonical, datePublished: contest.startsAt, expires: contest.endsAt, isPartOf: { '@type': 'WebSite', name: 'Artway-TM', url: `${ORIGIN}/` } };
  const content = `<div class="seo-ssr-page"><nav class="seo-ssr-breadcrumb" aria-label="Okruszki"><a href="/">Sklep</a> / <a href="/konkursy">Konkursy</a> / <span>${escapeHtml(contest.title)}</span></nav><article class="seo-ssr-description"><h1>${escapeHtml(contest.title)}</h1><p>${escapeHtml(contest.description)}</p><h2>${escapeHtml(contest.taskTitle)}</h2><p>${escapeHtml(contest.taskPrompt)}</p><p><strong>Nagroda:</strong> ${escapeHtml(prize)}. Wysyłka nagrody wyłącznie kurierem.</p><p><strong>Termin:</strong> od ${escapeHtml(contest.startsAt)} do ${escapeHtml(contest.endsAt)}.</p><p><a href="/konkursy">Zobacz wszystkie konkursy</a></p></article></div>`;
  return { title: `${contest.title} | Konkurs Artway-TM`, description, canonical, image: '', type: 'website', schema, content };
}

const moneyPl = (value) => Number(value).toFixed(2).replace('.', ',');

function replaceShippingMarker(html, marker, body) {
  const expression = new RegExp(`<li\\s+data-live-shipping=["']${marker}["'][^>]*>[\\s\\S]*?<\\/li>`, 'i');
  return expression.test(html) ? html.replace(expression, `<li data-live-shipping="${marker}">${body}</li>`) : html;
}

function applyLiveShippingToInformationPage(html, pathname, shipping) {
  let output = html.replace(
    /(<div class="topbar"[^>]*>)[\s\S]*?(<\/div>)/i,
    `$1${shippingTopbarHtml(shipping)}$2`,
  );
  if (pathname !== '/dostawa') return output;
  output = replaceShippingMarker(output, 'paczkomat', `<strong>Paczkomat® / PaczkoPunkt InPost:</strong> ${moneyPl(shipping.locker.price)} zł; klient wybiera punkt na mapie lub liście.`);
  output = replaceShippingMarker(output, 'kurier', `<strong>Kurier InPost:</strong> ${moneyPl(shipping.courier.price)} zł pod wskazany adres.`);
  output = replaceShippingMarker(output, 'weekend', `<strong>Paczka w Weekend:</strong> opcjonalna usługa dodatkowa +${moneyPl(shipping.weekendPrice)} zł, gdy jest dostępna dla wybranej przesyłki.`);
  output = replaceShippingMarker(output, 'darmowa', `<strong>Darmowa dostawa:</strong> od ${moneyPl(shipping.freeFrom)} zł wartości produktów, zgodnie z aktualnym progiem używanym przez koszyk.`);
  output = replaceShippingMarker(output, 'pobranie', `<strong>Płatność przy odbiorze:</strong> opłata ${moneyPl(shipping.cashOnDeliveryPrice)} zł, jeśli metoda jest dostępna w formularzu.`);
  output = output.replace(/(<p\s+data-live-shipping=["']czas["'][^>]*>)[\s\S]*?(<\/p>)/i, `$1Deklarowany czas przygotowania przesyłki wynosi ${escapeHtml(shipping.dispatchTime)} w dni robocze. Do tego należy doliczyć czas przewozu InPost. Przy płatności online przygotowanie rozpoczyna się po pozytywnej autoryzacji. Status i numer nadania przekazujemy e-mailem.$2`);
  // Zgodność z wersją strony sprzed wprowadzenia znaczników dynamicznych.
  output = output
    .replace(/(<strong>Paczkomat®?\s*\/\s*PaczkoPunkt InPost:<\/strong>)\s*[\d,.]+\s*zł/i, `$1 ${moneyPl(shipping.locker.price)} zł`)
    .replace(/(<strong>Kurier InPost:<\/strong>)\s*[\d,.]+\s*zł/i, `$1 ${moneyPl(shipping.courier.price)} zł`)
    .replace(/(<strong>Paczka w Weekend:<\/strong>[\s\S]{0,120}?\+)[\d,.]+\s*zł/i, `$1${moneyPl(shipping.weekendPrice)} zł`)
    .replace(/(<strong>Darmowa dostawa:<\/strong>)\s*od\s*[\d,.]+\s*zł/i, `$1 od ${moneyPl(shipping.freeFrom)} zł`)
    .replace(/(<strong>Płatność przy odbiorze:<\/strong>\s*opłata)\s*[\d,.]+\s*zł/i, `$1 ${moneyPl(shipping.cashOnDeliveryPrice)} zł`)
    .replace(/<p>(?:Standardowy|Deklarowany) czas przygotowania przesyłki wynosi[\s\S]*?Status i numer nadania przekazujemy e-mailem\.<\/p>/i, `<p>Deklarowany czas przygotowania przesyłki wynosi ${escapeHtml(shipping.dispatchTime)} w dni robocze. Do tego należy doliczyć czas przewozu InPost. Przy płatności online przygotowanie rozpoczyna się po pozytywnej autoryzacji. Status i numer nadania przekazujemy e-mailem.</p>`);
  return output;
}

async function renderPublicInformationPage(pathname, shipping) {
  const relativePath = PUBLIC_INFORMATION_FILES[pathname];
  if (!relativePath) return null;
  const html = applyLiveShippingToInformationPage(await activeReleaseTemplate(relativePath), pathname, shipping);
  return new Response(html, { headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache, max-age=0, must-revalidate',
    'x-artway-live-settings': 'shipping',
    'x-artway-shipping-version': shipping.version,
  } });
}

function replaceMeta(html, { title, description, canonical, image, type, schema, content, noindex = false }, shipping) {
  let output = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta name="robots" content="[^"]*">/i, `<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">`)
    .replace(/<meta property="og:type" content="[^"]*">/i, `<meta property="og:type" content="${escapeHtml(type)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/i, `<meta property="og:url" content="${escapeHtml(canonical)}">`)
    .replace(/<meta name="twitter:card" content="[^"]*">/i, `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/i, `<meta name="twitter:title" content="${escapeHtml(title)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/i, `<meta name="twitter:description" content="${escapeHtml(description)}">`)
    .replace(/<script id="artway-seo-schema" type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script id="artway-seo-schema" type="application/ld+json">${jsonLd(schema)}</script>`)
    .replace(/<main id="widok" tabindex="-1"[^>]*>[\s\S]*?<\/main>/i, `<main id="widok" tabindex="-1" data-server-rendered="true">${content}</main>`)
    .replace(/(<div class="topbar"[^>]*>)[\s\S]*?(<\/div>)/i, `$1${shippingTopbarHtml(shipping)}$2`);
  const canonicalTag = `<link rel="canonical" href="${escapeHtml(canonical)}">`;
  output = /<link\b[^>]*rel=["']canonical["'][^>]*>/i.test(output)
    ? output.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/i, canonicalTag)
    : output.replace('</head>', `${canonicalTag}</head>`);
  const social = image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:alt" content="${escapeHtml(title)}"><meta name="twitter:image" content="${escapeHtml(image)}">` : '';
  const rss = /type=["']application\/rss\+xml["']/i.test(output) ? '' : `<link rel="alternate" type="application/rss+xml" title="Nowości Artway-TM" href="${ORIGIN}/produkty.rss">`;
  output = output.replace('</head>', `${social}${rss}</head>`);
  return output;
}

export function seoRouteMatches(pathname = '') {
  return pathname === '/' || /^\/(?:produkt|kategoria|konkurs)\/[^/]+\/?$/i.test(pathname) || /^\/(?:promocje|nowosci|konkursy|o-nas|faq|kontakt|regulamin|prywatnosc|dostawa|zwroty)\/?$/i.test(pathname);
}

export async function renderStorefrontSeoPage(request, { shippingConfig = null } = {}) {
  const url = new URL(request.url), pathname = decodeURIComponent(url.pathname.replace(/\/+$/, '') || '/');
  const shipping = shippingConfig || await loadStoreShippingConfig();
  const informationPage = await renderPublicInformationPage(pathname, shipping);
  if (informationPage) return informationPage;
  let page = staticContentPage(pathname);
  if (pathname === '/') {
    page = homePage(await catalogSnapshot());
  } else if (pathname.startsWith('/konkurs/')) {
    const contest = await loadStorefrontSeoContest(pathname.slice('/konkurs/'.length));
    if (contest) page = contestPage(contest);
  } else if (pathname.startsWith('/produkt/')) {
    const id = pathname.slice('/produkt/'.length);
    const snapshot = await catalogSnapshot();
    const canonicalId = snapshot.duplicateCanonicalById.get(String(id));
    if (canonicalId) return new Response(null, { status: 301, headers: { location: `${ORIGIN}/produkt/${encodeURIComponent(canonicalId)}`, 'cache-control': 'public, max-age=86400' } });
    const product = snapshot.productById.get(String(id)) || (await loadStorefrontSeoProductsByIds([id]))[0];
    if (product) page = productPage(product, snapshot.sellableProducts, shipping);
  } else if (pathname.startsWith('/kategoria/') || pathname === '/promocje' || pathname === '/nowosci') {
    const { sellableProducts, productsByCategory } = await catalogSnapshot();
    if (pathname.startsWith('/kategoria/')) {
      const key = pathname.slice('/kategoria/'.length);
      const categories = [...productsByCategory.keys()];
      const category = categories.find((entry) => entry === key || seoSlug(entry) === seoSlug(key));
      if (category) page = collectionPage({ name: category, description: `Produkty z kategorii ${category}. Sprawdź aktualną ofertę, ceny i wygodną dostawę InPost.`, canonical: `${ORIGIN}/kategoria/${seoSlug(category)}`, products: productsByCategory.get(category) || [] });
    } else if (pathname === '/promocje') {
      page = collectionPage({ name: 'Promocje', description: 'Aktualne promocje na gry, zabawki kreatywne, balony i artykuły imprezowe w Artway-TM.', canonical: `${ORIGIN}/promocje`, products: sellableProducts.filter((product) => Number(product.staraCena) > Number(product.cena)) });
    } else {
      page = collectionPage({ name: 'Nowości', description: 'Nowe gry, zabawki kreatywne, balony i artykuły imprezowe dostępne w Artway-TM.', canonical: `${ORIGIN}/nowosci`, products: sellableProducts.filter((product) => String(product.badge || '').toLocaleLowerCase('pl-PL') === 'nowość') });
    }
  }
  const template = await storefrontTemplate();
  if (!page) {
    const fallback = { title: 'Nie znaleziono strony | Artway-TM', description: 'Ta karta produktu lub kategoria nie jest obecnie dostępna.', canonical: `${ORIGIN}${url.pathname}`, image: '', type: 'website', schema: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Nie znaleziono strony' }, content: '<div class="seo-ssr-page"><h1>Nie znaleziono strony</h1><p><a href="/">Wróć do sklepu</a></p></div>', noindex: true };
    return new Response(replaceMeta(template, fallback, shipping), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache, max-age=0, must-revalidate' } });
  }
  return new Response(replaceMeta(template, page, shipping), { headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache, max-age=0, must-revalidate',
    'x-artway-seo-rendered': '1',
    'x-artway-shipping-version': shipping.version,
  } });
}
