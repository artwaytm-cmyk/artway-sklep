const text = (value = '') => String(value ?? '');

const HARD_SOURCE_PAGE_NOISE = [
  /najniższa cena (?:produktu )?w? ?(?:okresie )?\d+\s*dni[^.!?]{0,180}(?:zł|\/\s*1\s*szt)/i,
  /możesz kupić za pkt/i,
  /możesz kupić także poprzez/i,
  /dodaj do porównania\s*do?daj do listy zakupowej/i,
  /dodaj produkty podając kody/i,
  /wgraj pliki z kodami/i,
  /sprawdź,\s*w którym sklepie obejrzysz/i,
  /rozmiar\s+uniwersalny[^.!?]{0,100}\d[\d\s]*\s*szt\.[^.!?]{0,100}\d+[,.]\d{2}\s*zł brutto/i,
  /cena regularna:\s*\/\s*1\s*szt\.?\s*(?:infinity)?%?/i,
  /\[\s*\.{3}\s*\]\s*read\s+more(?:\s*\.{3})?/i,
  /\bread\s+more(?:\s*\.{3})?(?:\s|$)/i,
  /\b\d(?:[,.]\d{1,2})?\s*\/\s*5(?:[,.]0{1,2})?\s*(?:opinie?|ocen(?:a|y))\b/i,
  /\bopinie?\s*\(\s*\d+\s*\)/i,
];

const SOFT_SOURCE_PAGE_NOISE = [
  /dodaj do koszyka/i,
  /dodaj do listy zakupowej/i,
  /powiadom o dostępności/i,
  /\d+\s*dni na darmowy zwrot/i,
  /bezpieczne zakupy/i,
  /produkt dostępny/i,
  /wysyłka(?:\s+jutro|\s+sprawdź)/i,
  /sprawdź czasy i koszty wysyłki/i,
  /skontaktuj się z obsługą sklepu/i,
  /rozmiar\s+uniwersalny/i,
  /zł brutto\s*\/\s*1\s*szt/i,
  /\bczytaj wi[eę]cej\b/i,
  /\bpoka[żz]\s+pe[łl]ny opis\b/i,
];

const MALFORMED_EDITORIAL_TEXT = /^(?:[:;,.!?'"`~*#_[\]{}()<>/\\|\s-]|null|undefined|n\/a){1,30}$/i;

/**
 * Usuwa wyłącznie kontrolki rozwijania opisu skopiowane ze strony źródłowej.
 * Nie parafrazuje treści i nie usuwa faktów produktu, dlatego może być użyta
 * bezpiecznie również tuż przed atomowym zapisem kartoteki.
 */
export function stripEditorialExpandControls(value = '') {
  return text(value)
    .replace(/\[\s*\.{3}\s*\]\s*read\s+more(?:\s*\.{3})?/gi, ' ')
    .replace(/\bread\s+more(?:\s*\.{3})?(?=\s|<|$)/gi, ' ')
    .replace(/\b(?:czytaj\s+wi[eę]cej|poka[żz]\s+pe[łl]ny\s+opis)(?:\s*\.{3})?/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function editorialTextLooksValid(value = '', minimum = 1) {
  const source = text(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return source.length >= Math.max(1, Number(minimum) || 1)
    && !MALFORMED_EDITORIAL_TEXT.test(source)
    && editorialSourceTextIsSafe(source);
}

/**
 * Wspólna bramka jakości dla danych, które mają dostać trwały status
 * „ready”. Sam poprawny JSON nie jest dowodem, że model przygotował treść.
 */
export function editorialProductContentReport(product = {}, channel = 'store') {
  const source = product && typeof product === 'object' ? product : {};
  const normalizedChannel = String(channel || 'store').trim();
  const title = normalizedChannel === 'allegro'
    ? source.allegroTitle
    : normalizedChannel === 'vonHalsky'
      ? source.vonHalskyTitle
      : source.nazwa || source.name;
  const shortDescription = normalizedChannel === 'vonHalsky'
    ? source.vonHalskyShortDescription
    : normalizedChannel === 'allegro'
      ? source.allegroShortDescription || source.opisKrotki || source.krotkiOpis
      : source.opisKrotki || source.krotkiOpis;
  const longDescription = normalizedChannel === 'allegro'
    ? source.allegroDescription
    : normalizedChannel === 'vonHalsky'
      ? source.vonHalskyDescription
      : source.opis || source.description;
  const minimumLong = 100;
  const titleReady = editorialTextLooksValid(title, 5);
  const shortReady = normalizedChannel === 'allegro' || editorialTextLooksValid(shortDescription, 20);
  const longReady = editorialTextLooksValid(longDescription, minimumLong);
  const report = editorialSourceNoiseReport(`${shortDescription || ''}\n${longDescription || ''}`);
  const issues = [
    ...(titleReady ? [] : ['invalid_title']),
    ...(shortReady ? [] : ['invalid_short_description']),
    ...(longReady ? [] : ['invalid_long_description']),
    ...report.hard.map((pattern) => `source_noise:${pattern}`),
    ...(report.soft.length >= 3 ? report.soft.map((pattern) => `source_noise:${pattern}`) : []),
  ];
  return {
    ready: issues.length === 0,
    channel: normalizedChannel,
    title: text(title),
    shortDescription: text(shortDescription),
    longDescription: text(longDescription),
    issues: [...new Set(issues)],
    sourceNoise: report,
  };
}

export function editorialSourceNoiseReport(value = '') {
  const source = text(value);
  if (!source.trim()) return { noisy: false, hard: [], soft: [] };
  const hard = HARD_SOURCE_PAGE_NOISE.filter((pattern) => pattern.test(source)).map((pattern) => pattern.source);
  const soft = SOFT_SOURCE_PAGE_NOISE.filter((pattern) => pattern.test(source)).map((pattern) => pattern.source);
  return {
    noisy: hard.length > 0 || soft.length >= 3,
    hard,
    soft,
  };
}

export function editorialSourceTextIsSafe(value = '') {
  return !editorialSourceNoiseReport(value).noisy;
}

const EDITORIAL_FIELDS = new Set([
  'opisKrotki',
  'opis',
  'allegroShortDescription',
  'allegroDescription',
  'vonHalskyShortDescription',
  'vonHalskyDescription',
]);

export function assertSafeAgentEditorialFields(fields = {}, area = '') {
  const sourceArea = String(area || '').trim().toLowerCase();
  if (!/(?:agent|preparation|editorial|seo|von-halsky|allegro)/.test(sourceArea)) return;
  const noisy = Object.entries(fields || {})
    .filter(([field, value]) => EDITORIAL_FIELDS.has(field) && typeof value === 'string')
    .map(([field, value]) => ({ field, report: editorialSourceNoiseReport(value) }))
    .filter((entry) => entry.report.noisy);
  if (!noisy.length) return;
  const error = new Error(`Treść źródłowej strony sklepu nie może zastąpić opisu produktu: ${noisy.map((entry) => entry.field).join(', ')}`);
  error.status = 422;
  error.code = 'catalog_product_editorial_source_noise';
  error.fields = noisy.map((entry) => entry.field);
  throw error;
}
