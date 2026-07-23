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

