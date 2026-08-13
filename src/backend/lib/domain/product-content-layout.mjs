const clean = (value = '', limit = 30_000) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim()
  .slice(0, limit);

const html = (value = '') => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function decode(value = '') {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function structuredLines(value = '') {
  const source = decode(clean(value, 30_000))
    .replace(/<\s*h2[^>]*>/gi, '\n@@heading@@')
    .replace(/<\s*\/\s*h2\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n@@item@@')
    .replace(/<\s*\/\s*li\s*>/gi, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|div|ul|ol|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return source.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 80);
}

const PLACEHOLDER_COPY = /(?:kr[oó]tki wst[eę]p o produkcie|pierwsza potwierdzona cecha|druga potwierdzona cecha|opis produktu do uzupe[łl]nienia|najwa[żz]niejsze informacje o produkcie)/i;

function plainDescription(value = '') {
  return decode(clean(value, 30_000))
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|div|li|h[1-6]|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*(?:#{1,4}|[•·▪◦*-])\s*/gm, '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sentences(value = '') {
  const source = plainDescription(value);
  const parts = source.split(/(?<=[.!?])\s+|\n+/).map((item) => clean(item, 500).trim()).filter((item) => item.length >= 20 && !PLACEHOLDER_COPY.test(item));
  return [...new Set(parts.map((item) => item.replace(/\s+/g, ' ')))].slice(0, 12);
}

const PARAMETER_LABELS = Object.freeze({
  wiek: 'Wiek',
  age: 'Wiek',
  wiekgraczyod: 'Wiek graczy od',
  liczbagraczy: 'Liczba graczy',
  gracze: 'Liczba graczy',
  players: 'Liczba graczy',
  playercount: 'Liczba graczy',
  material: 'Materiał',
  rozmiar: 'Rozmiar',
  size: 'Rozmiar',
  liczbaelementow: 'Liczba elementów',
  elementcount: 'Liczba elementów',
  elements: 'Liczba elementów',
  iloscwopakowaniuzbiorczym: 'Ilość w opakowaniu zbiorczym',
  kodproducenta: 'Kod producenta',
  numerreferencyjny: 'Numer referencyjny',
  ean: 'EAN',
  gtin: 'GTIN',
  wymiaryopakowania: 'Wymiary opakowania',
  wagaopakowania: 'Waga opakowania',
  wymiaryopakowaniazbiorczego: 'Wymiary opakowania zbiorczego',
  wagaopakowaniazbiorczego: 'Waga opakowania zbiorczego',
});

function humanParameterLabel(value = '') {
  const expanded = String(value || '')
    .replace(/([A-ZĄĆĘŁŃÓŚŹŻ])([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż])/g, '$1 $2')
    .replace(/([a-ząćęłńóśźż\d])([A-ZĄĆĘŁŃÓŚŹŻ])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const key = expanded.toLocaleLowerCase('pl-PL')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '');
  return { key, label: PARAMETER_LABELS[key] || (expanded.charAt(0).toLocaleUpperCase('pl-PL') + expanded.slice(1)) };
}

function parameterEntries(product = {}) {
  const output = new Map();
  const add = (label, value) => {
    const normalizedLabel = humanParameterLabel(label);
    const name = clean(normalizedLabel.label, 100);
    const textValue = Array.isArray(value) ? value.map((item) => clean(item, 200)).filter(Boolean).join(', ') : clean(value, 400);
    if (!name || !textValue || /^(?:id|url|link|source|źr[oó]d[łl]o)$/i.test(name)) return;
    const key = normalizedLabel.key || name.toLocaleLowerCase('pl-PL');
    if (!output.has(key)) output.set(key, { label: name, value: textValue });
  };
  for (const source of [product.parametryProducenta, product.parametryZrodla, product.parametry, product.parameters]) {
    if (Array.isArray(source)) {
      for (const item of source) add(item?.name || item?.label, item?.value || item?.valuesLabels || item?.values);
    } else if (source && typeof source === 'object') {
      for (const [label, value] of Object.entries(source)) add(label, value);
    }
  }
  add('Wiek', product.wiek || product.age);
  add('Liczba graczy', product.gracze || product.players);
  add('Materiał', product.material);
  add('Rozmiar', product.rozmiar || product.size);
  add('Liczba elementów', product.liczbaElementow || product.elementCount);
  return [...output.values()].slice(0, 12);
}

export function professionalDescriptionQuality(value = '') {
  const text = clean(value, 30_000);
  const headings = (text.match(/(?:^|\n)\s*##\s+\S+/g) || []).length + (text.match(/<h[2-4][^>]*>/gi) || []).length;
  const bullets = (text.match(/(?:^|\n)\s*[•·▪◦*-]\s+\S+/g) || []).length + (text.match(/<li[^>]*>/gi) || []).length;
  const paragraphs = plainDescription(text).split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/).filter((part) => part.trim().length >= 30).length;
  const parameters = (text.match(/(?:^|\n)\s*[\p{L}\d][^:\n]{1,50}:\s+\S+/gu) || []).length;
  const placeholder = PLACEHOLDER_COPY.test(text);
  const score = Math.max(0, Math.min(100,
    (text.length >= 180 ? 22 : text.length >= 100 ? 12 : 0)
    + Math.min(28, headings * 10)
    + Math.min(24, bullets * 5)
    + Math.min(16, paragraphs * 4)
    + Math.min(10, parameters * 2)
    - (placeholder ? 50 : 0)
  ));
  return { score, headings, bullets, paragraphs, parameters, placeholder, professional: score >= 45 && !placeholder };
}

export function buildProfessionalProductDescription(product = {}, value = '') {
  const original = clean(value, 30_000), quality = professionalDescriptionQuality(original);
  if (quality.professional) return original;
  const parts = sentences(original), parameters = parameterEntries(product);
  if (!parts.length && !parameters.length) return original;
  const introduction = parts.slice(0, parts.length > 1 ? 1 : 2);
  const features = parts.slice(introduction.length, introduction.length + 6);
  const audience = parameters.filter((item) => /wiek|gracz|dziec|os[oó]b/i.test(item.label));
  const contents = parameters.filter((item) => /zawarto|element|liczba sztuk|ilo[śs][ćc]/i.test(item.label));
  const technical = parameters.filter((item) => !audience.includes(item) && !contents.includes(item)).slice(0, 8);
  const blocks = [];
  if (introduction.length) blocks.push(introduction.join(' '));
  if (features.length) blocks.push(`## Najważniejsze cechy\n${features.map((item) => `• ${item}`).join('\n')}`);
  if (audience.length) blocks.push(`## Dla kogo\n${audience.map((item) => `${item.label}: ${item.value}`).join('\n')}`);
  if (contents.length) blocks.push(`## Zawartość zestawu\n${contents.map((item) => `${item.label}: ${item.value}`).join('\n')}`);
  if (technical.length) blocks.push(`## Informacje techniczne\n${technical.map((item) => `${item.label}: ${item.value}`).join('\n')}`);
  return blocks.join('\n\n').trim().slice(0, 30_000) || original;
}

function textItems(longDescription = '') {
  const result = [];
  let heading = '';
  let list = [];
  const flushList = () => {
    if (!list.length) return;
    result.push({ type: 'TEXT', content: `${heading ? `<h2>${html(heading)}</h2>` : ''}<ul>${list.map((item) => `<li>${html(item)}</li>`).join('')}</ul>` });
    heading = '';
    list = [];
  };
  for (const rawLine of structuredLines(longDescription)) {
    if (rawLine.startsWith('@@heading@@')) {
      flushList();
      heading = clean(rawLine.slice('@@heading@@'.length), 180);
      continue;
    }
    if (rawLine.startsWith('@@item@@') || /^[•·▪◦-]\s+/.test(rawLine)) {
      list.push(clean(rawLine.replace(/^@@item@@/, '').replace(/^[•·▪◦-]\s+/, ''), 1000));
      continue;
    }
    flushList();
    result.push({ type: 'TEXT', content: `${heading ? `<h2>${html(heading)}</h2>` : ''}<p>${html(rawLine)}</p>` });
    heading = '';
  }
  flushList();
  return result.filter((item) => item.content && !/<(?:p|li|h2)>\s*<\//i.test(item.content)).slice(0, 16);
}

export function buildSharedProductDescriptionSections(product = {}) {
  const items = [];
  const shortDescription = clean(product.opisKrotki || product.krotkiOpis, 500);
  if (shortDescription) items.push({ type: 'TEXT', content: `<p><strong>${html(shortDescription)}</strong></p>` });
  items.push(...textItems(product.opis || product.allegroDescription || ''));
  if (!items.length) items.push({ type: 'TEXT', content: `<p>${html(product.nazwa || product.name || 'Produkt')}</p>` });

  const images = [...new Set([product.zdjecie, ...(Array.isArray(product.zdjecia) ? product.zdjecia : [])]
    .map((value) => clean(value, 1000))
    .filter((value) => /^https?:\/\//i.test(value)))].slice(0, 8);
  const sections = [];
  for (let index = 0; index < items.length; index += 1) {
    sections.push({ items: [items[index]] });
    const image = images[index + 1];
    if (image && (index === 0 || index === 2 || index === 4)) sections.push({ items: [{ type: 'IMAGE', url: image }] });
  }
  return sections.slice(0, 20);
}
