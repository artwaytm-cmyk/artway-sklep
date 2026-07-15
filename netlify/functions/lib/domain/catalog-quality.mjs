const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, max = 10000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const CURATED_PRODUCT_FACTS = Object.freeze({
  '5906018003796': {
    sourceUrl: 'https://www.alexander.com.pl/produkty/15-gier/',
    opisKrotki: 'Rodzinny zestaw 15 klasycznych gier: Pchełki, Chińczyk, Domino i Labirynt w wielu wariantach rozgrywki.',
    opis: '<p>Zestaw „15 Gier” łączy proste i znane gry dla dzieci oraz całej rodziny. Pchełki ćwiczą zręczność i precyzję, Chińczyk jest dostępny w trzech wersjach, a Domino można rozegrać na siedem sposobów. Zestaw uzupełnia łatwa gra losowa Labirynt.</p><h3>Zawartość opakowania</h3><ul><li>dwustronna plansza i kostka do gry,</li><li>16 pionków, miska oraz pchełki,</li><li>28 kostek domina,</li><li>instrukcja z wariantami rozgrywki.</li></ul>',
  },
  '5906018002430': {
    sourceUrl: 'https://www.alexander.com.pl/produkty/zlotowki-bilon/',
    opisKrotki: 'Edukacyjny zestaw plastikowych monet pomagający dzieciom poznawać polskie nominały, liczyć i bawić się w zakupy.',
    opis: '<p>„Złotówki Bilon” to edukacyjny zestaw plastikowych kopii polskich monet. Pomaga dzieciom rozpoznawać nominały, ćwiczyć liczenie oraz odgrywać codzienne sytuacje związane z zakupami i wydawaniem reszty.</p><h3>Zawartość opakowania</h3><p>36 plastikowych monet o nominałach: 10 gr, 20 gr, 50 gr, 1 zł, 2 zł i 5 zł.</p><h3>Zastosowanie</h3><p>Zestaw sprawdzi się podczas nauki w domu, zajęć edukacyjnych i zabaw tematycznych.</p>',
  },
  '5906018026542': { sourceUrl: 'https://www.alexander.com.pl/produkty/moje-pierwsze-origami-sukienka/' },
  '5906018028256': { sourceUrl: 'https://www.alexander.com.pl/produkty/zestaw-kreatywny-origami-3d-arbuz/' },
  '5906018025712': { sourceUrl: 'https://www.alexander.com.pl/produkty/origami-3d-kobra/' },
  '5906018025750': { sourceUrl: 'https://alexandertoys.com/products/origami-3d-plesiosaurus/' },
});

export function catalogPlainText(value, max = 30000) {
  return text(value, max)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
    .slice(0, max);
}

export function catalogNormalizeUrl(value) {
  const raw = text(value, 2000);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|query_id$|fbclid$|gclid$|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\?$/, '');
  } catch (error) {
    return '';
  }
}

export function catalogNormalizeName(value) {
  return text(value, 500)
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function normalizedKey(value) {
  return catalogPlainText(value, 1000).toLocaleLowerCase('pl-PL').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function valueFor(product, names) {
  for (const name of names) {
    const value = product?.[name];
    if (value !== undefined && value !== null && text(value)) return value;
  }
  return '';
}

function productId(product, fallback = '') {
  return text(product?.id ?? fallback, 100);
}

export function mergeCatalogProducts(data = {}, importedProducts = []) {
  const map = new Map();
  const addBase = (product = {}) => {
    const id = productId(product);
    if (id) map.set(id, { ...(map.get(id) || {}), ...product, id });
  };
  for (const product of asArray(data.artway_produkty_katalog)) addBase(product);
  for (const product of asArray(importedProducts)) addBase(product);
  for (const product of asArray(data.artway_produkty_dodane)) addBase(product);

  const orphanEdits = [];
  for (const [rawId, patch] of Object.entries(asObject(data.artway_produkty_edytowane))) {
    const id = productId(patch, rawId);
    if (!id) continue;
    if (!map.has(id)) {
      orphanEdits.push({ id, patch: { ...asObject(patch), id } });
      continue;
    }
    map.set(id, { ...map.get(id), ...asObject(patch), id });
  }

  const hiddenIds = new Set([
    ...asArray(data.artway_produkty_ukryte),
    ...asArray(data.artway_produkty_definitywne),
    ...asArray(data.artway_kosz_dodane).map((entry) => entry?.id),
  ].map(String));
  const products = [...map.values()];
  return {
    map,
    products,
    activeProducts: products.filter((product) => !hiddenIds.has(String(product.id))),
    hiddenIds,
    orphanEdits,
  };
}

function validGtin(value) {
  const gtin = text(value, 30).replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(gtin.length)) return false;
  const digits = [...gtin].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function validImage(value) {
  const raw = text(value, 3000);
  if (!raw) return false;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(raw)) return true;
  return /^https?:\/\//i.test(raw);
}

function descriptionParagraphs(value) {
  const raw = text(value, 30000);
  if (!raw) return [];
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .split(/\n+/).map((part) => catalogPlainText(part, 5000)).filter(Boolean);
  }
  return raw.split(/\n\s*\n|\r?\n/).map((part) => catalogPlainText(part, 5000)).filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formattedDescription(value) {
  const raw = text(value, 30000);
  if (!raw) return '';
  if (/<(?:img|picture|video|table|ul|ol)\b/i.test(raw)) return '';
  const paragraphs = descriptionParagraphs(value);
  const seen = new Set();
  let changed = false;
  const unique = paragraphs.filter((paragraph) => {
    const key = normalizedKey(paragraph);
    if (!key || seen.has(key)) { changed = true; return false; }
    seen.add(key);
    return true;
  });
  const labels = ['Producent', 'Marka', 'Kod producenta', 'EAN/GTIN', 'Wymiary / rozmiar', 'Rozmiar'];
  const labelPattern = labels.map((label) => label.replace(/[\/]/g, '\\/')).join('|');
  const specs = new Map();
  const content = [];
  const contentSeen = new Set();
  let specsSection = false;
  for (const paragraphRaw of unique) {
    let paragraph = paragraphRaw.replace(/^Domyślny opis krótki\s*/i, '').trim();
    if (paragraph !== paragraphRaw) changed = true;
    if (!paragraph) continue;
    if (/^Najważniejsze informacje\b/i.test(paragraph)) {
      specsSection = true;
      paragraph = paragraph.replace(/^Najważniejsze informacje\s*/i, '').trim();
      changed = true;
    }
    if (!paragraph) continue;
    const regex = new RegExp(`(${labelPattern}):\\s*(.*?)(?=\\s+(?:${labelPattern}):|$)`, 'gi');
    const matches = [...paragraph.matchAll(regex)];
    if (matches.length && (specsSection || matches.length >= 2)) {
      for (const match of matches) {
        const label = labels.find((candidate) => candidate.toLocaleLowerCase('pl-PL') === match[1].toLocaleLowerCase('pl-PL')) || match[1];
        const value = match[2].replace(/^[•·\-\s]+|[•·\-\s]+$/g, '').trim();
        if (value && !specs.has(label)) specs.set(label, value);
      }
      changed = true;
      continue;
    }
    specsSection = false;
    const contentKey = normalizedKey(paragraph);
    if (!contentKey || contentSeen.has(contentKey)) { changed = true; continue; }
    contentSeen.add(contentKey);
    content.push(paragraph);
  }
  if (!changed || !content.length) return '';
  const rendered = content.map((paragraph) => {
    const packageMatch = paragraph.match(/^Zawartość opakowania\s*[:\-]?\s*(.*)$/i);
    if (packageMatch) return `<h3>Zawartość opakowania</h3>${packageMatch[1] ? `<p>${escapeHtml(packageMatch[1])}</p>` : ''}`;
    if (/^(?:Najważniejsze informacje|Opis produktu|Cechy produktu)$/i.test(paragraph)) return `<h3>${escapeHtml(paragraph)}</h3>`;
    return `<p>${escapeHtml(paragraph)}</p>`;
  });
  if (specs.size) rendered.push(`<h3>Najważniejsze informacje</h3><ul>${[...specs].map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join('')}</ul>`);
  return rendered.join('');
}

function inferManufacturer(product) {
  const context = `${valueFor(product, ['sourceUrl', 'producentUrl', 'agentImportUrl'])} ${valueFor(product, ['nazwa', 'name'])}`.toLowerCase();
  if (/alexander/.test(context)) return 'Alexander';
  if (/multigra/.test(context)) return 'Multigra';
  if (/godan|go-dan/.test(context)) return 'GoDan';
  if (/pink\s*frog|pinkfrog/.test(context)) return 'Pink Frog';
  return '';
}

function shortDescription(full) {
  const plain = catalogPlainText(full, 5000);
  if (plain.length < 80) return '';
  const sentences = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
  const result = (sentences.slice(0, 2).join(' ') || plain).slice(0, 420).trim();
  return result.length >= 60 ? result : plain.slice(0, 220).trim();
}

function seoProposal(product) {
  const name = catalogNormalizeName(valueFor(product, ['nazwa', 'name']));
  const category = catalogNormalizeName(valueFor(product, ['kategoria', 'productType']));
  const manufacturer = catalogNormalizeName(valueFor(product, ['producent', 'marka', 'brand']));
  if (!name) return {};
  let title = [name, manufacturer && !name.toLowerCase().includes(manufacturer.toLowerCase()) ? manufacturer : ''].filter(Boolean).join(' – ');
  if (title.length < 30 && category) title += ` – ${category}`;
  if (title.length < 30) title += ' | Artway-TM';
  if (title.length > 60) title = `${title.slice(0, 59).replace(/\s+\S*$/, '')}…`;
  const base = catalogPlainText(valueFor(product, ['opisKrotki', 'krotkiOpis', 'opis', 'description']), 1000);
  let description = base || `${name}${category ? ` z kategorii ${category}` : ''}. Sprawdź szczegóły produktu w sklepie Artway-TM.`;
  if (description.length < 80) description += ' Poznaj opis, aktualną cenę, dostępność i warunki dostawy.';
  if (description.length > 158) description = `${description.slice(0, 157).replace(/\s+\S*$/, '')}…`;
  return { seoTitle: title, seoDescription: description };
}

export function safeCatalogPatch(product = {}) {
  const patch = {};
  const name = catalogNormalizeName(valueFor(product, ['nazwa', 'name']));
  if (name && name !== product.nazwa) patch.nazwa = name;

  const gtin = text(valueFor(product, ['gtin', 'ean']), 30).replace(/\s+/g, '');
  if (gtin) {
    if (!text(product.gtin)) patch.gtin = gtin;
    if (!text(product.ean)) patch.ean = gtin;
  }

  const manufacturer = catalogNormalizeName(valueFor(product, ['producent', 'marka', 'brand'])) || inferManufacturer(product);
  if (manufacturer) {
    if (!text(product.producent)) patch.producent = manufacturer;
    if (!text(product.marka)) patch.marka = manufacturer;
  }

  const source = catalogNormalizeUrl(valueFor(product, ['sourceUrl', 'producentUrl', 'agentImportUrl']) || product?.sourceEvidence?.url);
  if (source) {
    if (source !== text(product.sourceUrl)) patch.sourceUrl = source;
    if (!text(product.producentUrl)) patch.producentUrl = source;
  }

  const full = valueFor(product, ['opis', 'description']);
  const compact = valueFor(product, ['opisKrotki', 'krotkiOpis']);
  const generatedShort = shortDescription(full);
  if (generatedShort && catalogPlainText(compact, 1000).length < 60) patch.opisKrotki = generatedShort;
  const formatted = formattedDescription(full);
  if (formatted) patch.opis = formatted;

  const curated = CURATED_PRODUCT_FACTS[gtin];
  if (curated) {
    if (curated.sourceUrl && catalogNormalizeUrl(curated.sourceUrl) !== catalogNormalizeUrl(product.sourceUrl)) {
      patch.sourceUrl = curated.sourceUrl;
      patch.producentUrl = curated.sourceUrl;
    }
    if (curated.opis && catalogPlainText(full, 30000).length < 250) patch.opis = curated.opis;
    if (curated.opisKrotki && catalogPlainText(compact, 2000).length < 60) patch.opisKrotki = curated.opisKrotki;
    if (product.contentSource !== 'manufacturer-official') patch.contentSource = 'manufacturer-official';
    if (product.contentSourceUrl !== curated.sourceUrl) patch.contentSourceUrl = curated.sourceUrl;
    if (product.contentVerifiedAt !== '2026-07-13') patch.contentVerifiedAt = '2026-07-13';
  }

  const seo = seoProposal({ ...product, ...patch });
  const currentTitle = text(product.seoTitle, 500);
  const currentDescription = text(product.seoDescription, 1000);
  if (seo.seoTitle && (currentTitle.length < 30 || currentTitle.length > 65)) patch.seoTitle = seo.seoTitle;
  if (seo.seoDescription && (currentDescription.length < 80 || currentDescription.length > 165)) patch.seoDescription = seo.seoDescription;
  return patch;
}

const ISSUE_DEFINITIONS = {
  missing_name: ['Brak nazwy', 'critical', 24],
  invalid_price: ['Brak prawidłowej ceny sprzedaży', 'critical', 20],
  missing_category: ['Brak kategorii', 'critical', 12],
  missing_image: ['Brak prawidłowego zdjęcia', 'critical', 14],
  placeholder_content: ['Opis jest technicznym tekstem zastępczym', 'critical', 16],
  missing_brand: ['Brak producenta lub marki', 'warning', 6],
  missing_ean: ['Brak kodu EAN/GTIN', 'warning', 6],
  invalid_ean: ['Kod EAN/GTIN ma nieprawidłową sumę kontrolną', 'warning', 8],
  missing_identifier: ['Brak kodu własnego lub producenta', 'warning', 5],
  missing_short_description: ['Brak użytecznego krótkiego opisu', 'warning', 6],
  short_full_description: ['Pełny opis jest zbyt krótki', 'warning', 8],
  repeated_content: ['Opis zawiera powtórzone akapity', 'warning', 5],
  missing_source: ['Brak linku do źródła/producenta', 'warning', 5],
  invalid_source: ['Link źródłowy jest nieprawidłowy', 'warning', 5],
  missing_seo: ['Brak kompletnego tytułu lub opisu SEO', 'info', 3],
};

function auditProduct(product) {
  const issues = [];
  const add = (code) => { const [label, severity, penalty] = ISSUE_DEFINITIONS[code]; issues.push({ code, label, severity, penalty }); };
  const name = catalogNormalizeName(valueFor(product, ['nazwa', 'name']));
  const price = Number(valueFor(product, ['cena', 'price']));
  const full = catalogPlainText(valueFor(product, ['opis', 'description']), 30000);
  const compact = catalogPlainText(valueFor(product, ['opisKrotki', 'krotkiOpis']), 2000);
  const gtin = text(valueFor(product, ['gtin', 'ean']), 30).replace(/\D/g, '');
  const sourceRaw = text(valueFor(product, ['sourceUrl', 'producentUrl', 'agentImportUrl']) || product?.sourceEvidence?.url, 2000);
  const paragraphs = descriptionParagraphs(valueFor(product, ['opis', 'description']));
  const unique = new Set(paragraphs.map(normalizedKey).filter(Boolean));
  if (!name) add('missing_name');
  if (!(price > 0)) add('invalid_price');
  if (!text(valueFor(product, ['kategoria', 'productType']))) add('missing_category');
  if (!validImage(valueFor(product, ['zdjecie', 'image', 'imageUrl']))) add('missing_image');
  if (!text(valueFor(product, ['producent', 'marka', 'brand']))) add('missing_brand');
  if (!gtin) add('missing_ean'); else if (!validGtin(gtin)) add('invalid_ean');
  if (!text(valueFor(product, ['externalId', 'external_id', 'sku', 'mpn', 'kodProducenta']))) add('missing_identifier');
  if (compact.length < 60) add('missing_short_description');
  if (full.length < 250) add('short_full_description');
  if (/produkt utworzony z oferty|uzupe[lł]nij (?:opis|dane)|lorem ipsum|opis produktu w przygotowaniu/i.test(full)) add('placeholder_content');
  if (paragraphs.length >= 2 && unique.size < paragraphs.length) add('repeated_content');
  if (!sourceRaw) add('missing_source'); else if (!catalogNormalizeUrl(sourceRaw)) add('invalid_source');
  const seoTitle = text(product.seoTitle, 500), seoDescription = text(product.seoDescription, 1000);
  if (seoTitle.length < 30 || seoTitle.length > 65 || seoDescription.length < 80 || seoDescription.length > 165) add('missing_seo');
  const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + issue.penalty, 0));
  const severity = issues.some((issue) => issue.severity === 'critical') ? 'critical' : issues.some((issue) => issue.severity === 'warning') ? 'warning' : 'ready';
  return {
    id: productId(product), name: name || `Produkt ${productId(product)}`, score, severity, issues,
    image: text(valueFor(product, ['zdjecie', 'image', 'imageUrl']), 3000),
    sourceUrl: catalogNormalizeUrl(sourceRaw), category: text(valueFor(product, ['kategoria', 'productType']), 200),
    manufacturer: text(valueFor(product, ['producent', 'marka', 'brand']), 200),
    ean: gtin, externalId: text(valueFor(product, ['externalId', 'external_id', 'sku', 'mpn', 'kodProducenta']), 200),
    allegroOfferId: text(product.allegroOfferId, 100), safePatch: safeCatalogPatch(product),
  };
}

function duplicateGroups(products) {
  const fields = [
    ['ean', (p) => text(valueFor(p, ['gtin', 'ean']), 30).replace(/\D/g, '')],
    ['kod', (p) => normalizedKey(valueFor(p, ['externalId', 'external_id', 'sku', 'mpn', 'kodProducenta']))],
    ['link', (p) => catalogNormalizeUrl(valueFor(p, ['sourceUrl', 'producentUrl', 'agentImportUrl']) || p?.sourceEvidence?.url).toLowerCase()],
    ['nazwa', (p) => `${normalizedKey(valueFor(p, ['nazwa', 'name']))}|${normalizedKey(valueFor(p, ['producent', 'marka', 'brand']))}`],
  ];
  const groups = [];
  for (const [type, getter] of fields) {
    const map = new Map();
    for (const product of products) {
      const value = getter(product);
      if (!value || value === '|') continue;
      const list = map.get(value) || [];
      list.push({ id: productId(product), name: catalogNormalizeName(valueFor(product, ['nazwa', 'name'])) || `Produkt ${productId(product)}` });
      map.set(value, list);
    }
    for (const [value, items] of map) if (items.length > 1) groups.push({ type, value, items });
  }
  return groups;
}

export function auditCatalog(data = {}) {
  const merged = mergeCatalogProducts(data);
  const rows = merged.activeProducts.map(auditProduct).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'pl'));
  const issueCounts = {};
  for (const row of rows) for (const issue of row.issues) issueCounts[issue.code] = (issueCounts[issue.code] || 0) + 1;
  const duplicates = duplicateGroups(merged.activeProducts);
  const averageScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 100;
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: rows.length,
      ready: rows.filter((row) => row.severity === 'ready').length,
      warning: rows.filter((row) => row.severity === 'warning').length,
      critical: rows.filter((row) => row.severity === 'critical').length,
      averageScore,
      duplicateGroups: duplicates.length,
      orphanEdits: merged.orphanEdits.length,
      safeFixes: rows.filter((row) => Object.keys(row.safePatch).length).length,
    },
    issueCounts,
    rows,
    duplicates,
    orphanEdits: merged.orphanEdits.map(({ id, patch }) => ({ id, allegroOfferId: text(patch.allegroOfferId, 100), name: text(patch.nazwa || patch.name, 300), fields: Object.keys(patch).sort() })),
  };
}

export function applySafeCatalogFixes(data = {}, { quarantineOrphans = true } = {}) {
  const next = { ...data };
  const added = asArray(data.artway_produkty_dodane).map((product) => ({ ...product }));
  const catalog = asArray(data.artway_produkty_katalog).map((product) => ({ ...product }));
  const edits = { ...asObject(data.artway_produkty_edytowane) };
  const addedIndex = new Map(added.map((product, index) => [productId(product), index]));
  const catalogIndex = new Map(catalog.map((product, index) => [productId(product), index]));
  const before = mergeCatalogProducts(data);
  const changes = [];
  for (const product of before.products) {
    const id = productId(product), patch = safeCatalogPatch(product);
    const fields = Object.keys(patch);
    if (!id || !fields.length) continue;
    if (addedIndex.has(id)) added[addedIndex.get(id)] = { ...added[addedIndex.get(id)], ...patch };
    if (catalogIndex.has(id)) catalog[catalogIndex.get(id)] = { ...catalog[catalogIndex.get(id)], ...patch };
    if (!addedIndex.has(id) && catalogIndex.has(id)) edits[id] = { ...asObject(edits[id]), ...patch };
    else if (edits[id]) edits[id] = { ...asObject(edits[id]), ...patch };
    changes.push({ id, name: catalogNormalizeName(product.nazwa) || `Produkt ${id}`, fields });
  }
  const orphanArchive = [];
  if (quarantineOrphans) {
    for (const orphan of before.orphanEdits) {
      orphanArchive.push({ id: orphan.id, patch: orphan.patch, quarantinedAt: new Date().toISOString(), reason: 'Brak produktu bazowego w katalogu i produktach dodanych' });
      delete edits[orphan.id];
    }
  }
  next.artway_produkty_dodane = added;
  next.artway_produkty_katalog = catalog;
  next.artway_produkty_edytowane = edits;
  return { data: next, changes, orphanArchive };
}
