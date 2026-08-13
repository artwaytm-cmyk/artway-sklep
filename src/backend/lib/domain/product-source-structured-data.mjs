export function sourceParameterRows(source = '', { strip, stripWithLayout, normalize } = {}) {
  const out = {};
  const starts = [...String(source || '').matchAll(/<[^>]+class=["'][^"']*\bdata__row(?!-)[^"']*["'][^>]*>/gi)]
    .map((match) => match.index)
    .filter((index) => index >= 0);
  for (let index = 0; index < starts.length; index++) {
    const start = starts[index];
    const next = starts[index + 1] || Math.min(source.length, start + 6000);
    const segment = source.slice(start, next);
    const label = strip((segment.match(/<[^>]+class=["'][^"']*\bdata__row--label\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|dt|th)>/i) || [])[1] || '').replace(/:+\s*$/, '');
    const value = stripWithLayout((segment.match(/<[^>]+class=["'][^"']*\bdata__row--val\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|dd|td)>/i) || [])[1] || '');
    if (label && value) out[normalize(label)] = value;
  }
  // WooCommerce i część stron WordPress publikuje specyfikację jako zwykłe
  // akapity: <p><b>EAN</b>: 590...</p>. Czytamy wyłącznie pary zaczynające
  // się pogrubioną etykietą, aby nie zamienić zwykłego opisu w parametry.
  for (const match of String(source || '').matchAll(/<p\b[^>]*>\s*<(?:b|strong)\b[^>]*>([\s\S]*?)<\/(?:b|strong)>\s*:?\s*([\s\S]*?)<\/p>/gi)) {
    const label = strip(match[1]).replace(/:+\s*$/, '').trim();
    const value = stripWithLayout(match[2]).replace(/^:\s*/, '').trim();
    if (label && label.length <= 100 && value) out[normalize(label)] = value;
  }
  // Standardowy blok SKU WooCommerce jest osobnym spanem, a nie akapitem.
  for (const match of String(source || '').matchAll(/<[^>]+class=["'][^"']*\bsku_wrapper\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/gi)) {
    const segment = match[1];
    const value = strip((segment.match(/<[^>]+class=["'][^"']*\bsku\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|b|strong)>/i) || [])[1] || segment)
      .replace(/^\s*(?:SKU|kod produktu)\s*:?\s*/i, '')
      .trim();
    if (value) out[normalize('SKU')] = value;
  }
  return out;
}

export function sourceBreadcrumbCategory(html = '', { decode, cleanText } = {}) {
  const lists = [];
  const scripts = [...String(html || '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    const type = Array.isArray(value['@type']) ? value['@type'].join(' ') : String(value['@type'] || '');
    if (/BreadcrumbList/i.test(type)) lists.push(value);
    if (value['@graph']) visit(value['@graph']);
  };
  for (const match of scripts) {
    try { visit(JSON.parse(decode(match[1]).trim())); } catch {}
  }
  lists.sort((left, right) => (right.itemListElement?.length || 0) - (left.itemListElement?.length || 0));
  for (const list of lists) {
    const items = Array.isArray(list.itemListElement) ? list.itemListElement : [];
    const names = items.map((item) => cleanText(decode(decode(item?.item?.name || item?.name || '')))).filter(Boolean);
    if (names.length >= 2) return names[names.length - 2] || names[names.length - 1] || '';
  }
  return '';
}
