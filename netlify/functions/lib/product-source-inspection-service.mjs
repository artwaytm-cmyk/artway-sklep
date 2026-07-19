import { tekst } from './core/http.mjs';

export function createProductSourceInspectionService({ read, write, normalizeKey, nameSimilarity }) {
  const czytaj = read;
  const zapisz = write;
  const allegroNormalizujKlucz = normalizeKey;
  const allegroPodobienstwoIstotne = nameSimilarity;
  function htmlDecode(s = '') {
    const mapa = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
    return String(s || '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => mapa[m] || m).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n) || 32));
  }
  function stripHtml(s = '') {
    return htmlDecode(String(s || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  function stripHtmlZPodzialem(s = '') {
    return htmlDecode(String(s || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<\/(?:li|p|div|section|article|ul|ol|h[1-6])>/gi, '\n')
      .replace(/<(?:p|div|section|article|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '))
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/[\t ]+/g, ' ').trim())
      .filter(Boolean)
      .filter((line, index, lines) => index === 0 || line !== lines[index - 1])
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  function attrHtml(tag = '', name = '') {
    const n = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\s${n}\\s*=\\s*["']([^"']*)["']`, 'i');
    return htmlDecode((String(tag || '').match(re) || [])[1] || '');
  }
  function metaHtml(html, name) {
    const szukane = String(name || '').toLowerCase();
    for (const m of String(html || '').matchAll(/<meta\b[^>]*>/gi)) {
      const tag = m[0];
      const key = (attrHtml(tag, 'property') || attrHtml(tag, 'name') || attrHtml(tag, 'itemprop')).toLowerCase();
      if (key === szukane) return attrHtml(tag, 'content');
    }
    return '';
  }
  function absoluteUrl(base, u) {
    try { return new URL(u, base).toString(); } catch { return ''; }
  }
  function znajdzPoEtykiecie(text, label) {
    const re = new RegExp(`${label}\\s*[:\\n ]+([^\\n]{1,180})`, 'i');
    return tekst((text.match(re) || [])[1] || '', 180).trim();
  }
  function normalizujKluczParametru(s = '') {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function parametrySlownikoweZHtml(html = '') {
    const out = {};
    const source = String(html || '');
    const starts = [...source.matchAll(/<div\b[^>]*class=["'][^"']*\bdictionary__param\b[^"']*["'][^>]*>/gi)].map((m) => m.index).filter((x) => x >= 0);
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i];
      const end = starts[i + 1] || source.indexOf('</section>', start);
      const seg = source.slice(start, end > start ? end : start + 3500);
      const label = stripHtml((seg.match(/<span\b[^>]*class=["'][^"']*\bdictionary__name_txt\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) || [])[1] || '');
      if (!label || /podmiot odpowiedzialny/i.test(label)) continue;
      const values = [...seg.matchAll(/<[^>]*class=["'][^"']*\bdictionary__value_txt\b[^"']*["'][^>]*>([\s\S]*?)(?:<\/a>|<\/span>)/gi)]
        .map((m) => stripHtml(m[1]))
        .filter(Boolean);
      const val = values.join(', ').replace(/\s+\/\s*1\s*szt\.$/i, '').trim();
      if (val) out[normalizujKluczParametru(label)] = val;
    }
    return out;
  }
  function parametr(dict, labels = []) {
    const keys = Object.keys(dict || {});
    for (const label of labels) {
      const n = normalizujKluczParametru(label);
      const exact = keys.find((k) => k === n);
      if (exact) return tekst(dict[exact], 500).trim();
      const loose = keys.find((k) => k.includes(n) || n.includes(k));
      if (loose) return tekst(dict[loose], 500).trim();
    }
    return '';
  }
  function liczbaZTekstu(v) {
    if (v === null || v === undefined || v === '') return 0;
    const m = String(v).replace(/\s+/g, '').match(/(\d{1,6}(?:[,.]\d{1,2})?)/);
    return m ? Number(m[1].replace(',', '.')) || 0 : 0;
  }
  function cenaProduktuZHtml(html = '', text = '') {
    const kandydaci = [];
    const dodaj = (v, weight = 1) => {
      const n = liczbaZTekstu(v);
      if (n > 0) kandydaci.push({ n, weight });
    };
    dodaj(metaHtml(html, 'product:price:amount'), 9);
    dodaj((html.match(/id=["']projector_price_value["'][^>]*data-price=["']([^"']+)/i) || [])[1], 10);
    dodaj((html.match(/\bprice\s*:\s*parseFloat\((\d+(?:\.\d+)?)/i) || [])[1], 9);
    dodaj((html.match(/\bcena_raty\s*=\s*(\d+(?:\.\d+)?)/i) || [])[1], 8);
    dodaj((html.match(/\bvalue["']?\s*:\s*["'](\d+(?:\.\d+)?)["']/i) || [])[1], 7);
    const okolicaCeny = (html.match(/<[^>]+id=["']projector_prices_section["'][\s\S]{0,2500}/i) || [])[0] || '';
    for (const m of okolicaCeny.matchAll(/(\d{1,5}[,.]\d{2})\s*zł/gi)) dodaj(m[1], 6);
    for (const m of String(text || '').matchAll(/(\d{1,5}[,.]\d{2})\s*zł/gi)) dodaj(m[1], 1);
    kandydaci.sort((a, b) => b.weight - a.weight || a.n - b.n);
    return kandydaci[0]?.n || 0;
  }
  function jsonLdProdukty(html = '') {
    const produkty = [];
    const scripts = [...String(html || '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => htmlDecode(m[1]).trim()).filter(Boolean);
    const visit = (x) => {
      if (!x) return;
      if (Array.isArray(x)) return x.forEach(visit);
      if (typeof x !== 'object') return;
      const typ = Array.isArray(x['@type']) ? x['@type'].join(' ') : String(x['@type'] || '');
      if (/Product/i.test(typ)) produkty.push(x);
      if (x['@graph']) visit(x['@graph']);
    };
    for (const raw of scripts) {
      try { visit(JSON.parse(raw)); } catch {}
    }
    return produkty;
  }
  function kategoriaZBreadcrumbJsonLd(html = '') {
    for (const raw of [...String(html || '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => htmlDecode(m[1]).trim())) {
      try {
        const x = JSON.parse(raw);
        const typ = Array.isArray(x?.['@type']) ? x['@type'].join(' ') : String(x?.['@type'] || '');
        if (!/BreadcrumbList/i.test(typ)) continue;
        const items = Array.isArray(x.itemListElement) ? x.itemListElement : [];
        const names = items.map((it) => tekst(it?.item?.name || it?.name, 160).trim()).filter(Boolean);
        if (names.length >= 2) return names[names.length - 2] || names[names.length - 1] || '';
      } catch {}
    }
    return '';
  }
  function opisProduktuZHtml(html = '', title = '') {
    const meta = metaHtml(html, 'og:description') || metaHtml(html, 'description');
    const longDesc = (html.match(/<section\b[^>]*id=["']projector_longdescription["'][^>]*>([\s\S]*?)<\/section>/i) || [])[1] || '';
    const shortDesc = (html.match(/<div\b[^>]*class=["'][^"']*\bproduct_name__block\b[^"']*\b--description\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '';
    const cleanedLong = stripHtmlZPodzialem(longDesc);
    if (cleanedLong && cleanedLong.length > 80) return tekst(cleanedLong, 12000);
    const cleanedShort = stripHtmlZPodzialem(shortDesc);
    if (cleanedShort) return tekst(cleanedShort, 12000);
    if (meta && !/gry planszowe,\s*gry rodzinne/i.test(meta)) return tekst(stripHtml(meta), 12000);
    const text = stripHtml(html);
    const opisStart = text.indexOf(String(title || '').trim());
    return opisStart >= 0 ? tekst(text.slice(opisStart + String(title || '').length, opisStart + 8000), 12000) : '';
  }
  function opisKrotkiProduktuZHtml(html = '', opis = '') {
    const meta = metaHtml(html, 'og:description') || metaHtml(html, 'description');
    const shortDesc = (html.match(/<div\b[^>]*class=["'][^"']*\bproduct_name__block\b[^"']*\b--description\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '';
    const cleanedShort = stripHtml(shortDesc);
    if (cleanedShort && cleanedShort.length > 20) return tekst(cleanedShort, 500);
    if (meta && !/gry planszowe,\s*gry rodzinne/i.test(meta)) return tekst(stripHtml(meta), 500);
    const first = String(opis || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter((x) => x.length > 20).slice(0, 2).join(' ');
    return tekst(first || opis, 500);
  }
  function obrazkiProduktuZHtml(url = '', html = '') {
    const imageSet = new Set();
    const dodaj = (u) => {
      const a = absoluteUrl(url, htmlDecode(String(u || '').trim()));
      if (!a) return;
      if (/loader\.gif|favicon|logo|payment|platnos|bannery|standards|mask|sprite|icon-|\/icons?\//i.test(a)) return;
      if (!/\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(a)) return;
      imageSet.add(a);
    };
    dodaj(metaHtml(html, 'og:image'));
    const gallery = (String(html || '').match(/<section\b[^>]*id=["']projector_photos["'][^>]*>([\s\S]*?)<\/section>/i) || [])[1] || '';
    for (const m of gallery.matchAll(/<img\b[^>]*\bdata-img_high_res=["']([^"']+)["'][^>]*>/gi)) dodaj(m[1]);
    for (const m of gallery.matchAll(/<img\b[^>]*class=["'][^"']*\bphotos__photo\b(?![^"']*\b--nav\b)[^"']*["'][^>]*>/gi)) dodaj(attrHtml(m[0], 'data-img_high_res') || attrHtml(m[0], 'src'));
    for (const m of String(html || '').matchAll(/<link\b[^>]*rel=["']preload["'][^>]*as=["']image["'][^>]*>/gi)) dodaj(attrHtml(m[0], 'href'));
    if (imageSet.size < 2) for (const m of String(html || '').matchAll(/<img\b[^>]*(?:src|data-src|data-lazy|data-original)=["']([^"']+)["'][^>]*>/gi)) dodaj(m[1]);
    if (imageSet.size < 2) for (const m of String(html || '').matchAll(/(?:srcset|data-srcset)=["']([^"']+)["']/gi)) {
      String(m[1]).split(',').map((x) => x.trim().split(/\s+/)[0]).forEach(dodaj);
    }
    return [...imageSet].slice(0, 16);
  }
  function stanProducentaZHtml(html = '', ldProduct = {}) {
    const liczba = (v) => {
      const raw = String(v ?? '').trim();
      if (!raw) return null;
      const n = Number(raw.replace(',', '.'));
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    };
    const inventory = liczba(ldProduct?.offers?.inventoryLevel?.value ?? ldProduct?.offers?.inventoryLevel ?? ldProduct?.inventoryLevel?.value ?? ldProduct?.inventoryLevel);
    if (inventory !== null) return { quantity: inventory, exact: true, source: 'schema.org inventoryLevel' };
    const source = String(html || '');
    const sizesStart = source.search(/\bsizes\s*:\s*\[/i);
    if (sizesStart >= 0) {
      const after = source.slice(sizesStart, sizesStart + 250000);
      const boundary = after.search(/\n\s*subscription\s*:/i);
      const sizesBlock = boundary > 0 ? after.slice(0, boundary) : after.slice(0, 100000);
      const amounts = [...sizesBlock.matchAll(/(?:^|[,\s{])amount\s*:\s*["']?(\d+(?:[.,]\d+)?)/g)].map((m) => liczba(m[1])).filter((n) => n !== null && n <= 10000000);
      if (amounts.length) return { quantity: amounts.reduce((sum, n) => sum + n, 0), exact: true, source: 'IdoSell sizes.amount', variants: amounts.length };
    }
    const patterns = [
      [/\b(?:availableQuantity|stockQuantity|quantityAvailable|inventoryQuantity)\b["']?\s*[:=]\s*["']?(\d+(?:[.,]\d+)?)/i, 'pole ilości w danych strony'],
      [/\bdata-(?:stock|quantity|available)=["'](\d+(?:[.,]\d+)?)["']/i, 'atrybut ilości produktu'],
      [/itemprop=["']inventoryLevel["'][^>]*(?:content|value)=["'](\d+(?:[.,]\d+)?)["']/i, 'microdata inventoryLevel'],
    ];
    for (const [pattern, label] of patterns) {
      const n = liczba((source.match(pattern) || [])[1]);
      if (n !== null) return { quantity: n, exact: true, source: label };
    }
    return { quantity: null, exact: false, source: '' };
  }
  function parsujProduktZHtml(url, html) {
    const text = stripHtml(html);
    const ldProduct = jsonLdProdukty(html)[0] || {};
    const dict = parametrySlownikoweZHtml(html);
    const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();
    const title = metaHtml(html, 'og:title')
      || tekst(ldProduct.name, 300)
      || stripHtml((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '')
      || tekst((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1], 300);
    const cena = cenaProduktuZHtml(html, text) || liczbaZTekstu(ldProduct?.offers?.price);
    const zdjecia = obrazkiProduktuZHtml(url, html);
    const marka = parametr(dict, ['Marka', 'Brand']) || tekst(ldProduct.brand?.name || ldProduct.brand, 160).trim() || (/alexander/i.test(url + text) ? 'Alexander' : '');
    const producent = /(^|\.)sklep\.alexander\.com\.pl$/i.test(host) ? 'Alexander' : (parametr(dict, ['Producent', 'Manufacturer']) || marka);
    const symbol = parametr(dict, ['Symbol', 'Kod', 'SKU']) || tekst(ldProduct.sku, 120).trim();
    const kodProducentaRaw = parametr(dict, ['Kod producenta', 'MPN', 'Kod katalogowy']) || tekst(ldProduct.mpn, 120).trim();
    const eanRaw = parametr(dict, ['EAN', 'GTIN', 'Kod EAN']) || tekst(ldProduct.gtin13 || ldProduct.gtin || ldProduct.gtin12 || ldProduct.gtin14, 80).trim() || kodProducentaRaw;
    const ean = (String(eanRaw).match(/\b\d{8,14}\b/) || [])[0] || '';
    const kodProducenta = symbol || (kodProducentaRaw && normalizujKluczParametru(kodProducentaRaw) !== normalizujKluczParametru(ean) ? kodProducentaRaw : '');
    const statusHtml = stripHtml((html.match(/id=["']projector_status_description["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '');
    const statusDostepny = /produkt dostępny|\bdostępny\b|in stock|instock/i.test(statusHtml + ' ' + String(ldProduct?.offers?.availability || ''));
    const statusNiedostepny = /powiadom o dostępności|niedostępny|brak produktu|chwilowo niedostęp|outofstock/i.test(statusHtml + ' ' + String(ldProduct?.offers?.availability || ''));
    const stanProducenta = stanProducentaZHtml(html, ldProduct);
    const niedostepny = stanProducenta.quantity === 0 || statusNiedostepny || (!statusDostepny && /powiadom o dostępności|niedostępny|brak produktu|chwilowo niedostęp/i.test(text));
    const dostepny = stanProducenta.quantity !== null ? stanProducenta.quantity > 0 : (statusDostepny || (!niedostepny && /produkt dostępny|\bdostępny\b|in stock|instock/i.test(text)));
    const checkedAt = new Date().toISOString();
    const opis = opisProduktuZHtml(html, title);
    const opisKrotki = opisKrotkiProduktuZHtml(html, opis);
    const kategoria = kategoriaZBreadcrumbJsonLd(html);
    const parametry = {
      symbol,
      kodProducenta: kodProducentaRaw,
      ean,
      seria: parametr(dict, ['Seria']),
      wiek: parametr(dict, ['Wiek']),
      liczbaGraczy: parametr(dict, ['Liczba graczy']),
      wymiaryOpakowania: parametr(dict, ['Wymiary opakowania (dł/sz/wys)', 'Wymiary opakowania']),
      wagaOpakowania: parametr(dict, ['Waga opakowania']),
      ostrzezenie: parametr(dict, ['Ostrzeżenie']),
    };
    const missing = [];
    if (!title) missing.push('nazwa');
    if (!cena) missing.push('cena');
    if (!ean) missing.push('EAN');
    if (!zdjecia.length) missing.push('zdjęcia');
    if (!opisKrotki) missing.push('krótki opis');
    if (!opis) missing.push('opis');
    if (!dostepny && !niedostepny) missing.push('dostępność');
    const confidence = Math.max(20, 100 - missing.length * 14);
    return {
      ok: true,
      url,
      confidence,
      missing,
      product: {
        nazwa: stripHtml(title).replace(/\s+\|.*$/, ''),
        opisKrotki,
        opis,
        cena: cena || '',
        kategoria,
        zdjecie: zdjecia[0] || '',
        zdjecia: zdjecia.slice(1, 16),
        producent,
        marka: marka || producent,
        gtin: ean,
        ean,
        mpn: kodProducenta || symbol,
        kodProducenta: kodProducenta || symbol,
        externalId: symbol || '',
        rozmiar: parametry.wymiaryOpakowania || '',
        producentUrl: url,
        sourceUrl: url,
        dostepnoscProducenta: dostepny ? 'dostępny' : (niedostepny ? 'niedostępny' : 'do sprawdzenia'),
        stanProducenta: stanProducenta.quantity === null ? '' : stanProducenta.quantity,
        stanProducentaDokladny: stanProducenta.exact,
        stanProducentaZrodlo: stanProducenta.source,
        producentStatus: niedostepny ? 'brak' : (dostepny ? (stanProducenta.quantity === null ? 'dostepny_nieznany' : 'dostepny') : 'nieznany'),
        producentSprawdzonoAt: checkedAt,
        parametryProducenta: parametry,
        parametryZrodla: dict,
        sourceEvidence: {
          url,
          host: (() => { try { return new URL(url).hostname; } catch { return ''; } })(),
          fetchedAt: checkedAt,
          title: stripHtml(title),
          fields: ['nazwa', 'cena', 'opisKrotki', 'opis', 'zdjecia', 'EAN', 'kodProducenta', 'dostepnosc', ...Object.keys(dict)].slice(0, 80),
        },
      },
      availability: { available: dostepny, text: statusHtml || (dostepny ? 'Produkt dostępny' : (niedostepny ? 'Niedostępny' : 'Do sprawdzenia')), quantity: stanProducenta.quantity, exact: stanProducenta.exact, source: stanProducenta.source, checkedAt },
    };
  }
  function markdownInlineTekst(value = '') {
    return htmlDecode(String(value || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<https?:\/\/[^>]+>/g, ' ')
      .replace(/[*_`~]+/g, '')
      .replace(/\\([\\[\]()*_#])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim());
  }
  function markdownTekstZPodzialem(value = '') {
    return htmlDecode(String(value || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '\n')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '• ')
      .replace(/[*_`~]+/g, '')
      .replace(/\\([\\[\]()*_#])/g, '$1'))
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/[\t ]+/g, ' ').trim())
      .filter(Boolean)
      .filter((line, index, lines) => index === 0 || line !== lines[index - 1])
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  function markdownWartoscPoEtykiecie(markdown = '', labels = []) {
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    const wanted = labels.map(normalizujKluczParametru);
    for (let i = 0; i < lines.length; i++) {
      const current = normalizujKluczParametru(markdownInlineTekst(lines[i]));
      if (!wanted.includes(current)) continue;
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        const raw = lines[j].trim();
        if (!raw || /^!\[/.test(raw)) continue;
        if (/^#{1,6}\s/.test(raw)) break;
        const value = markdownInlineTekst(raw);
        if (value) return tekst(value, 500).trim();
      }
    }
    return '';
  }
  function obrazkiProduktuZMarkdown(url = '', markdown = '') {
    const productId = (String(url).match(/product-pol-(\d+)-/i) || [])[1] || '';
    const all = [...String(markdown || '').matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)(?:\s+[^)]*)?\)/gi)]
      .map((m) => htmlDecode(m[1]).replace(/^http:\/\//i, 'https://'))
      .filter((image) => /\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(image))
      .filter((image) => !productId || new RegExp(`(?:-|_)${productId}(?:_|-|\\.)`, 'i').test(image));
    const preferred = all.some((image) => /\/pol_pm_/i.test(image)) ? all.filter((image) => /\/pol_pm_/i.test(image)) : all;
    const unique = [], keys = new Set();
    for (const image of preferred) {
      const key = image.replace(/\/pol_(?:ps|pm|pl)_/i, '/pol_').replace(/[?#].*$/, '');
      if (keys.has(key)) continue;
      keys.add(key); unique.push(image);
    }
    return unique.slice(0, 16);
  }
  function parsujProduktZMarkdown(url, markdown) {
    const raw = String(markdown || ''), body = raw.includes('Markdown Content:') ? raw.split('Markdown Content:').slice(1).join('Markdown Content:') : raw;
    const titleHeader = markdownInlineTekst((raw.match(/^Title:\s*(.+)$/mi) || [])[1] || '');
    const headings = [...body.matchAll(/^#\s+(.+)$/gm)].map((m) => ({ index: m.index, title: markdownInlineTekst(m[1]) })).filter((x) => x.title);
    const titleHeading = headings.find((x) => titleHeader && normalizujKluczParametru(x.title) === normalizujKluczParametru(titleHeader)) || headings.find((x) => /product-pol-/i.test(url) && !/strona główna|sklep/i.test(x.title)) || headings[0];
    const title = titleHeader || titleHeading?.title || '';
    const productStart = Math.max(0, titleHeading?.index || 0), afterTitle = body.slice(productStart), nextProductBoundary = afterTitle.search(/\n##\s+(?:Produkty podobne|Inni kupili|Opinie|Polecane)/i);
    const segment = nextProductBoundary > 0 ? afterTitle.slice(0, nextProductBoundary) : afterTitle.slice(0, 50000);
    const cena = liczbaZTekstu((segment.match(/^##\s+(\d[\d\s]*[,.]\d{2})\s*zł\s*$/mi) || [])[1] || '');
    const stockMatch = segment.match(/\*\*\s*(\d{1,8})\s*szt\.\s*\*\*/i), quantity = stockMatch ? Math.max(0, Math.floor(Number(stockMatch[1]) || 0)) : null;
    const statusDostepny = /produkt dostępny|towar dostępny|\bdostępny\b/i.test(segment);
    const statusNiedostepny = /powiadom o dostępności|produkt niedostępny|chwilowo niedostępny|brak produktu/i.test(segment);
    const dostepny = quantity !== null ? quantity > 0 : (statusDostepny && !statusNiedostepny);
    const niedostepny = quantity === 0 || statusNiedostepny;
    const descriptionCandidates = [...segment.matchAll(/^##\s+(.+)$/gm)].map((m) => ({ index: m.index, title: markdownInlineTekst(m[1]), end: m.index + m[0].length }))
      .filter((x) => x.title && !/^\d[\d\s]*[,.]\d{2}\s*zł$/i.test(x.title));
    const descriptionHeading = descriptionCandidates.find((x) => x.index > (segment.search(/^##\s+\d[\d\s]*[,.]\d{2}\s*zł/m) || 0));
    let descriptionRaw = descriptionHeading ? segment.slice(descriptionHeading.end) : '';
    const descriptionEnd = descriptionRaw.search(/\n(?:Podmiot odpowiedzialny|Marka|Symbol|Kod producenta|EAN)\s*\n/i);
    if (descriptionEnd > 0) descriptionRaw = descriptionRaw.slice(0, descriptionEnd);
    let opis = tekst(markdownTekstZPodzialem([descriptionHeading?.title || '', descriptionRaw].filter(Boolean).join('\n')), 12000).trim();
    if (opis.length < 80) opis = tekst(markdownTekstZPodzialem(segment.slice(0, 10000)), 12000).trim();
    const opisKrotki = tekst(opis.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter((x) => x.length > 20).slice(0, 2).join(' ') || opis, 500);
    const marka = markdownWartoscPoEtykiecie(segment, ['Marka', 'Brand']);
    const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();
    const producent = /(^|\.)sklep\.alexander\.com\.pl$/i.test(host) ? 'Alexander' : (markdownWartoscPoEtykiecie(segment, ['Producent', 'Manufacturer']) || marka);
    const symbol = markdownWartoscPoEtykiecie(segment, ['Symbol', 'SKU', 'Kod']);
    const kodProducentaRaw = markdownWartoscPoEtykiecie(segment, ['Kod producenta', 'MPN', 'Kod katalogowy']);
    const eanRaw = markdownWartoscPoEtykiecie(segment, ['EAN', 'GTIN', 'Kod EAN']) || kodProducentaRaw;
    const ean = (String(eanRaw).match(/\b\d{8,14}\b/) || [])[0] || '';
    const kodProducenta = symbol || (kodProducentaRaw && normalizujKluczParametru(kodProducentaRaw) !== normalizujKluczParametru(ean) ? kodProducentaRaw : '');
    const zdjecia = obrazkiProduktuZMarkdown(url, body);
    const beforeTitle = body.slice(0, productStart), crumbs = [...beforeTitle.matchAll(/^\s*\d+\.\s+\[([^\]]+)\]/gm)].map((m) => markdownInlineTekst(m[1])).filter((x) => x && !/strona główna/i.test(x));
    const kategoria = crumbs.at(-1) || markdownWartoscPoEtykiecie(segment, ['Seria']) || marka;
    const checkedAt = new Date().toISOString();
    const dict = {
      marka,
      symbol,
      'kod producenta': kodProducentaRaw,
      ean,
      seria: markdownWartoscPoEtykiecie(segment, ['Seria']),
      wiek: markdownWartoscPoEtykiecie(segment, ['Wiek']),
      'liczba graczy': markdownWartoscPoEtykiecie(segment, ['Liczba graczy']),
      'wymiary opakowania': markdownWartoscPoEtykiecie(segment, ['Wymiary opakowania', 'Wymiary opakowania (dł/sz/wys)']),
      'waga opakowania': markdownWartoscPoEtykiecie(segment, ['Waga opakowania']),
      ostrzezenie: markdownWartoscPoEtykiecie(segment, ['Ostrzeżenie']),
    };
    const missing = [];
    if (!title) missing.push('nazwa');
    if (!cena) missing.push('cena');
    if (!ean) missing.push('EAN');
    if (!zdjecia.length) missing.push('zdjęcia');
    if (!opisKrotki) missing.push('krótki opis');
    if (!opis) missing.push('opis');
    if (!dostepny && !niedostepny) missing.push('dostępność');
    const confidence = Math.max(20, 100 - missing.length * 14);
    return {
      ok: true, url, confidence, missing,
      product: {
        nazwa: title.replace(/\s+\|.*$/, '').trim(), opisKrotki, opis, cena: cena || '', kategoria,
        zdjecie: zdjecia[0] || '', zdjecia: zdjecia.slice(1, 16), producent, marka: marka || producent,
        gtin: ean, ean, mpn: kodProducenta || symbol, kodProducenta: kodProducenta || symbol, externalId: symbol || '',
        rozmiar: dict['wymiary opakowania'] || '', producentUrl: url, sourceUrl: url,
        dostepnoscProducenta: dostepny ? 'dostępny' : (niedostepny ? 'niedostępny' : 'do sprawdzenia'),
        stanProducenta: quantity === null ? '' : quantity, stanProducentaDokladny: quantity !== null,
        stanProducentaZrodlo: quantity !== null ? 'ilość pokazana przez producenta' : 'status strony producenta',
        producentStatus: niedostepny ? 'brak' : (dostepny ? (quantity === null ? 'dostepny_nieznany' : 'dostepny') : 'nieznany'),
        producentSprawdzonoAt: checkedAt,
        parametryProducenta: { symbol, kodProducenta: kodProducentaRaw, ean, seria: dict.seria, wiek: dict.wiek, liczbaGraczy: dict['liczba graczy'], wymiaryOpakowania: dict['wymiary opakowania'], wagaOpakowania: dict['waga opakowania'], ostrzezenie: dict.ostrzezenie },
        parametryZrodla: Object.fromEntries(Object.entries(dict).filter(([, value]) => value)),
        sourceEvidence: { url, host, fetchedAt: checkedAt, title, retrieval: 'reader-fallback', fields: ['nazwa', 'cena', 'opisKrotki', 'opis', 'zdjecia', 'EAN', 'kodProducenta', 'dostepnosc', ...Object.keys(dict).filter((key) => dict[key])].slice(0, 80) },
      },
      availability: { available: dostepny, text: dostepny ? 'Produkt dostępny' : (niedostepny ? 'Niedostępny' : 'Do sprawdzenia'), quantity, exact: quantity !== null, source: quantity !== null ? 'ilość pokazana przez producenta' : 'status strony producenta', checkedAt },
    };
  }
  async function pobierzProduktZCzytnika(target = '') {
    const source = new URL(target), readerTarget = `http://${source.host}${source.pathname}${source.search}`;
    const readerUrl = `https://r.jina.ai/${readerTarget}`;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 28000), started = Date.now();
    try {
      const r = await fetch(readerUrl, { signal: controller.signal, redirect: 'follow', headers: { accept: 'text/plain;charset=utf-8', 'accept-language': 'pl-PL,pl;q=0.9', 'cache-control': 'no-cache' } });
      const markdown = await r.text();
      if (!r.ok || markdown.length < 800) throw Object.assign(new Error(`Czytnik źródła: HTTP ${r.status || 502}`), { statusCode: r.status || 502 });
      const parsed = parsujProduktZMarkdown(target, markdown);
      if (!parsed.product?.nazwa || (!parsed.product?.ean && !parsed.product?.kodProducenta)) throw Object.assign(new Error('Czytnik nie rozpoznał jednoznacznie produktu'), { statusCode: 422 });
      const fieldSources = { nazwa: 'nagłówek strony producenta', opis: 'pełny opis producenta', cena: 'cena producenta', ean: parsed.product.ean ? 'parametry produktu' : '', kod: parsed.product.kodProducenta ? 'parametry produktu' : '', zdjecia: parsed.product.zdjecie ? 'galeria produktu' : '', dostepnosc: parsed.availability?.source || 'status produktu' };
      parsed.product.sourceEvidence = { ...(parsed.product.sourceEvidence || {}), requestedUrl: target, resolvedUrl: target, canonicalUrl: target, fieldSources };
      const quality = Math.max(0, Math.min(100, Number(parsed.confidence || 0) + (String(parsed.product.opis || '').length > 300 ? 4 : 0) + (parsed.product.ean ? 3 : 0)));
      return { ...parsed, confidence: quality, requestedCandidate: target, resolvedUrl: target, canonicalUrl: target, fieldSources, readerBytes: markdown.length, readerStatus: r.status, durationMs: Date.now() - started };
    } finally { clearTimeout(timer); }
  }
  async function pobierzProduktProducenta(target = '') {
    const raw = tekst(target, 4000).trim();
    const naprawiony = raw.replace(/https\/\//gi, 'https://').replace(/http\/\//gi, 'http://').replace(/&amp;/gi, '&').trim();
    const bezSledzenia = (value) => { try { const u = new URL(value); ['query_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach((key) => u.searchParams.delete(key)); u.hash = ''; return u.toString(); } catch { return ''; } };
    const publiczny = (value) => { try { const h = new URL(value).hostname.toLowerCase(); if (!h || h === 'localhost' || h === '::1' || h.endsWith('.local') || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false; const m = h.match(/^172\.(\d+)\./); return !(m && Number(m[1]) >= 16 && Number(m[1]) <= 31); } catch { return false; } };
    const urls = [], dodaj = (value, reason = 'podany adres') => { const clean = bezSledzenia(String(value || '').replace(/[),.;]+$/, '')); if (clean && /^https?:\/\//i.test(clean) && publiczny(clean) && !urls.some((x) => x.url === clean)) urls.push({ url: clean, reason }); };
    dodaj(naprawiony, naprawiony === raw ? 'podany adres' : 'naprawiono brakujący dwukropek');
    const starts = [...naprawiony.matchAll(/https?:\/\//gi)].map((m) => m.index);
    for (let i = 0; i < starts.length; i++) dodaj(naprawiony.slice(starts[i], starts[i + 1] ?? naprawiony.length), 'adres odzyskany ze sklejonego linku');
    const origins = [...urls].map((x) => { try { const u = new URL(x.url); return /\.[a-z]{2,}$/i.test(u.hostname) ? u.origin : ''; } catch { return ''; } }).filter(Boolean);
    const paths = [...naprawiony.matchAll(/product-pol-\d+-[^?#\s"'<>]+?\.html/gi)].map((m) => m[0]);
    for (const origin of origins.slice(-2)) for (const path of paths) dodaj(`${origin}/${path.replace(/^\/+/, '')}`, 'odtworzono adres produktu z identyfikatora w linku');
    if (!urls.length) { const e = new Error('Nie udało się rozpoznać poprawnego adresu URL produktu'); e.status = 422; e.code = 'invalid_product_url'; throw e; }
    const candidateScore = (item) => { let score = item.reason.includes('identyfikatora') ? 60 : item.reason.includes('odzyskany') ? 35 : 20; try { const u = new URL(item.url); if (/\.(pl|com|eu|de)$/i.test(u.hostname)) score += 25; if (/\.p(https)?$/i.test(u.hostname)) score -= 80; } catch { score -= 100; } if ((item.url.match(/product-pol-/gi) || []).length > 1) score -= 25; return score; };
    const candidates = urls.sort((a, b) => candidateScore(b) - candidateScore(a)).slice(0, 5), attempts = [];
    const fetchOne = async (candidate) => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 18000), started = Date.now();
      try {
        const r = await fetch(candidate.url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-language': 'pl-PL,pl;q=0.9,en;q=0.6', 'cache-control': 'no-cache' } });
        const html = await r.text(), resolvedUrl = r.url || candidate.url, title = stripHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
        if (!r.ok || !html) throw Object.assign(new Error(`HTTP ${r.status || 502}`), { statusCode: r.status || 502 });
        if (html.length < 1200 || /access denied|captcha|cloudflare|verify you are human|odmowa dostępu/i.test(`${title} ${html.slice(0, 2500)}`)) throw Object.assign(new Error('Strona zwróciła blokadę automatycznego odczytu'), { statusCode: 403 });
        const parsed = parsujProduktZHtml(resolvedUrl, html), canonicalTag = [...html.matchAll(/<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/gi)].map((m) => attrHtml(m[0], 'href')).find(Boolean) || metaHtml(html, 'og:url') || '', canonicalUrl = canonicalTag ? absoluteUrl(resolvedUrl, canonicalTag) : resolvedUrl;
        const fieldSources = { nazwa: metaHtml(html, 'og:title') ? 'Open Graph' : jsonLdProdukty(html)[0]?.name ? 'schema.org' : 'nagłówek H1', opis: /projector_longdescription/i.test(html) ? 'pełny opis producenta' : metaHtml(html, 'og:description') ? 'Open Graph' : 'treść strony', cena: /projector_price_value/i.test(html) ? 'cena producenta' : jsonLdProdukty(html)[0]?.offers?.price ? 'schema.org' : 'treść strony', ean: parsed.product?.ean ? (jsonLdProdukty(html)[0]?.gtin ? 'schema.org' : 'parametry produktu') : '', kod: parsed.product?.kodProducenta ? (jsonLdProdukty(html)[0]?.mpn ? 'schema.org' : 'parametry produktu') : '', zdjecia: parsed.product?.zdjecie ? (metaHtml(html, 'og:image') ? 'Open Graph + galeria' : 'galeria produktu') : '', dostepnosc: parsed.availability?.source || (parsed.availability?.text ? 'status produktu' : '') };
        parsed.product.sourceUrl = canonicalUrl;
        parsed.product.producentUrl = canonicalUrl;
        parsed.product.sourceEvidence = { ...(parsed.product.sourceEvidence || {}), requestedUrl: candidate.url, resolvedUrl, canonicalUrl, fetchedAt: parsed.product.producentSprawdzonoAt || new Date().toISOString(), fieldSources };
        const quality = Math.max(0, Math.min(100, Number(parsed.confidence || 0) + (String(parsed.product?.opis || '').length > 300 ? 4 : 0) + (parsed.product?.ean ? 3 : 0)));
        attempts.push({ url: candidate.url, reason: candidate.reason, status: r.status, ok: true, resolvedUrl, canonicalUrl, bytes: html.length, durationMs: Date.now() - started, confidence: quality, missing: parsed.missing || [] });
        return { ...parsed, confidence: quality, requestedCandidate: candidate.url, resolvedUrl, canonicalUrl, fieldSources };
      } catch (error) {
        attempts.push({ url: candidate.url, reason: candidate.reason, status: Number(error?.statusCode || 0), ok: false, durationMs: Date.now() - started, error: error?.name === 'AbortError' ? 'Przekroczono 18 s oczekiwania' : tekst(error?.message || error, 500) });
        try {
          const fallback = await pobierzProduktZCzytnika(candidate.url);
          attempts.push({ url: candidate.url, reason: 'bezpłatny odczyt zapasowy źródła', status: fallback.readerStatus || 200, ok: true, resolvedUrl: candidate.url, canonicalUrl: candidate.url, bytes: fallback.readerBytes || 0, durationMs: fallback.durationMs || 0, confidence: fallback.confidence, missing: fallback.missing || [] });
          return fallback;
        } catch (fallbackError) {
          attempts.push({ url: candidate.url, reason: 'bezpłatny odczyt zapasowy źródła', status: Number(fallbackError?.statusCode || 0), ok: false, error: fallbackError?.name === 'AbortError' ? 'Przekroczono 28 s oczekiwania' : tekst(fallbackError?.message || fallbackError, 500) });
        }
        return null;
      } finally { clearTimeout(timer); }
    };
    const results = (await Promise.all(candidates.map(fetchOne))).filter(Boolean);
    if (!results.length) { const e = new Error(`Agent sprawdził ${attempts.length} wariantów adresu, ale żaden nie zwrócił danych produktu`); e.status = 502; e.code = 'product_link_unavailable'; e.linkDiagnostics = { requestedUrl: raw, candidates, attempts, retryRecommended: true }; throw e; }
    const fingerprint = (item) => tekst(item.product?.ean || item.product?.kodProducenta || item.product?.nazwa || item.resolvedUrl, 500).toLowerCase().replace(/\s+/g, ' ').trim();
    const usable = results.filter((item) => Number(item.confidence || 0) >= 45 && item.product?.nazwa), ranked = usable.length ? usable : results;
    const unique = [...new Map(ranked.sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0) || (a.missing?.length || 0) - (b.missing?.length || 0)).map((item) => [fingerprint(item), item])).values()];
    const primary = unique[0], alternatives = unique.slice(0, 5).map((item, index) => ({ id: `candidate-${index + 1}`, url: item.canonicalUrl || item.resolvedUrl, confidence: item.confidence, missing: item.missing || [], fieldSources: item.fieldSources || {}, product: item.product, availability: item.availability }));
    return { ...primary, requestedUrl: raw, resolvedUrl: primary.resolvedUrl, canonicalUrl: primary.canonicalUrl, repaired: bezSledzenia(raw) !== primary.resolvedUrl, needsChoice: alternatives.length > 1, alternatives, diagnostics: { candidates, attempts, successful: results.length, distinctProducts: alternatives.length, selectedReason: candidates.find((x) => x.url === primary.requestedCandidate)?.reason || 'najpełniejsze dane', retryRecommended: false } };
  }
  async function inspectProductUrl(target = '') {
    return pobierzProduktProducenta(target);
  }
  async function inspectProductUrlViaReader(target = '') {
    return pobierzProduktZCzytnika(target);
  }
  function kluczCacheLinkuProduktu(value = '') {
    try {
      const raw = String(value || '').trim().replace(/https\/\//gi, 'https://').replace(/http\/\//gi, 'http://');
      const u = new URL(raw);
      ['query_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach((key) => u.searchParams.delete(key));
      u.hash = '';
      return u.toString().replace(/\/$/, '').toLowerCase();
    } catch { return String(value || '').trim().toLowerCase(); }
  }
  function aliasyCacheWynikuLinku(target = '', result = {}) {
    return [...new Set([
      target,
      result.requestedUrl,
      result.resolvedUrl,
      result.canonicalUrl,
      ...(Array.isArray(result.alternatives) ? result.alternatives.flatMap((x) => [x?.url, x?.product?.sourceUrl, x?.product?.producentUrl]) : []),
    ].map(kluczCacheLinkuProduktu).filter(Boolean))].slice(0, 20);
  }
  async function pobierzProduktProducentaZPamiecia(target = '') {
    const cacheRec = await czytaj('product_url_cache', { items: {}, updated_at: null });
    const items = cacheRec.items && typeof cacheRec.items === 'object' ? { ...cacheRec.items } : {};
    const key = kluczCacheLinkuProduktu(target);
    try {
      const result = await pobierzProduktProducenta(target);
      const now = new Date().toISOString();
      items[key] = { key, aliases: aliasyCacheWynikuLinku(target, result), fetchedAt: now, result };
      const trimmed = Object.fromEntries(Object.entries(items).sort((a, b) => String(b[1]?.fetchedAt || '').localeCompare(String(a[1]?.fetchedAt || ''))).slice(0, 250));
      await zapisz('product_url_cache', { items: trimmed, updated_at: now });
      return { ...result, fromCache: false, cacheSavedAt: now };
    } catch (error) {
      const cached = items[key] || Object.values(items).find((x) => Array.isArray(x?.aliases) && x.aliases.includes(key));
      const ageMs = cached?.fetchedAt ? Date.now() - new Date(cached.fetchedAt).getTime() : Infinity;
      if (cached?.result && ageMs <= 30 * 86400000 && ['product_link_unavailable', 'fetch_error'].includes(String(error?.code || 'product_link_unavailable'))) {
        const previous = cached.result;
        return {
          ...previous,
          fromCache: true,
          stale: true,
          cacheSavedAt: cached.fetchedAt,
          cacheAgeHours: Math.max(0, Math.round(ageMs / 360000) / 10),
          diagnostics: {
            ...(previous.diagnostics || {}),
            cacheFallback: true,
            retryRecommended: true,
            liveFailure: { message: tekst(error?.message || error, 500), code: tekst(error?.code || '', 120), attempts: error?.linkDiagnostics?.attempts || [] },
          },
        };
      }
      throw error;
    }
  }
  function produktLinkDuplikaty(product = {}, products = new Map()) {
    const norm = allegroNormalizujKlucz;
    const wanted = {
      ean: norm(product.gtin || product.ean),
      external: norm(product.externalId || product.sku),
      code: norm(product.kodProducenta || product.mpn),
      url: kluczCacheLinkuProduktu(product.sourceUrl || product.producentUrl),
      name: tekst(product.nazwa || product.name, 400).trim(),
    };
    const out = [];
    for (const candidate of products.values()) {
      if (!candidate || String(candidate.id || '') === String(product.id || '')) continue;
      const reasons = [];
      let score = 0, blocking = false;
      const ean = norm(candidate.gtin || candidate.ean), external = norm(candidate.externalId || candidate.sku), code = norm(candidate.kodProducenta || candidate.mpn), candidateUrl = kluczCacheLinkuProduktu(candidate.sourceUrl || candidate.producentUrl);
      if (wanted.ean && ean === wanted.ean) { reasons.push('ten sam EAN/GTIN'); score = 100; blocking = true; }
      if (wanted.url && candidateUrl && candidateUrl === wanted.url) { reasons.push('ten sam link producenta'); score = Math.max(score, 100); blocking = true; }
      if (wanted.external && wanted.external.length >= 3 && external === wanted.external) { reasons.push('ten sam EXTERNAL_ID/SKU'); score = Math.max(score, 98); blocking = true; }
      if (wanted.code && wanted.code.length >= 3 && code === wanted.code) { reasons.push('ten sam kod producenta'); score = Math.max(score, 96); blocking = true; }
      const similarity = allegroPodobienstwoIstotne(wanted.name, candidate.nazwa || candidate.name || '');
      if (wanted.name && norm(wanted.name) === norm(candidate.nazwa || candidate.name || '')) { reasons.push('identyczna nazwa'); score = Math.max(score, 92); }
      else if (similarity >= 0.72) { reasons.push(`bardzo podobna nazwa ${Math.round(similarity * 100)}%`); score = Math.max(score, Math.round(72 + similarity * 18)); }
      if (reasons.length) out.push({ productId: String(candidate.id), productName: tekst(candidate.nazwa || candidate.name, 300), ean: tekst(candidate.gtin || candidate.ean, 80), externalId: tekst(candidate.externalId || candidate.sku, 120), code: tekst(candidate.kodProducenta || candidate.mpn, 120), score, blocking, reasons });
    }
    return out.sort((a, b) => Number(b.blocking) - Number(a.blocking) || b.score - a.score).slice(0, 10);
  }
  function produktLinkKategoriaSklepu(product = {}, products = new Map()) {
    const raw = tekst(product.kategoria, 180).trim(), rawKey = allegroNormalizujKlucz(raw), categories = new Map();
    for (const candidate of products.values()) if (candidate?.kategoria) categories.set(allegroNormalizujKlucz(candidate.kategoria), String(candidate.kategoria));
    if (rawKey && categories.has(rawKey)) return { name: categories.get(rawKey), confidence: 100, reason: 'identyczna kategoria istnieje w sklepie' };
    const near = rawKey ? [...categories].find(([key]) => key && (key.includes(rawKey) || rawKey.includes(key))) : null;
    if (near) return { name: near[1], confidence: 88, reason: 'dopasowano kategorię producenta do katalogu sklepu' };
    const producer = allegroNormalizujKlucz(product.producent || product.marka), scores = new Map();
    for (const candidate of products.values()) {
      if (!candidate?.kategoria) continue;
      let score = allegroPodobienstwoIstotne(product.nazwa || product.name, candidate.nazwa || candidate.name);
      if (producer && producer === allegroNormalizujKlucz(candidate.producent || candidate.marka)) score += 0.08;
      if (score < 0.28) continue;
      const current = scores.get(candidate.kategoria) || { name: candidate.kategoria, score: 0, count: 0, example: candidate.nazwa || candidate.name || '' };
      current.score = Math.max(current.score, score); current.count++; scores.set(candidate.kategoria, current);
    }
    const best = [...scores.values()].sort((a, b) => (b.score + Math.min(0.12, b.count * 0.02)) - (a.score + Math.min(0.12, a.count * 0.02)))[0];
    if (best) return { name: best.name, confidence: Math.min(90, Math.round((best.score + Math.min(0.12, best.count * 0.02)) * 100)), reason: `podobny produkt w sklepie: ${tekst(best.example, 160)}` };
    return { name: raw, confidence: raw ? 50 : 0, reason: raw ? 'kategoria producenta wymaga zatwierdzenia' : 'brak pewnej kategorii sklepu' };
  }

  return {
    pobierzProduktProducenta,
    pobierzProduktProducentaZPamiecia,
    produktLinkDuplikaty,
    produktLinkKategoriaSklepu,
    inspectProductUrl,
    inspectProductUrlViaReader,
  };
}
