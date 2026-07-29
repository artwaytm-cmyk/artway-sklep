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
];

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
