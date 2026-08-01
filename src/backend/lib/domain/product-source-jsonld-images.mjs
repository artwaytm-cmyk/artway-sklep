function decode(value = '') {
  return String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** Zwraca tylko główny obraz strony produktu, bez logo i grafik organizacji. */
export function jsonLdPrimaryImageUrls(html = '') {
  const objects = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== 'object') return;
    objects.push(value);
    if (value['@graph']) visit(value['@graph']);
  };
  const scripts = [...String(html || '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try { visit(JSON.parse(decode(match[1]).trim())); } catch {}
  }
  const byId = new Map(objects.map((item) => [String(item?.['@id'] || ''), item]).filter(([id]) => id));
  const images = [];
  const add = (value) => {
    const url = String(value || '').trim();
    if (url && !images.includes(url)) images.push(url);
  };
  for (const item of objects) {
    const type = Array.isArray(item?.['@type']) ? item['@type'].join(' ') : String(item?.['@type'] || '');
    if (!/(?:WebPage|Product)/i.test(type)) continue;
    add(item.thumbnailUrl);
    const primary = item.primaryImageOfPage;
    if (typeof primary === 'string') add(primary);
    else if (primary && typeof primary === 'object') {
      const referenced = byId.get(String(primary['@id'] || ''));
      add(primary.url || primary.contentUrl);
      add(referenced?.url || referenced?.contentUrl);
    }
  }
  return images;
}
