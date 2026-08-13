// Wersjonowana bramka publicznych wymagań karty InPost Von Halsky.
// Dane kontaktowe sklepu są konfigurowane w Portalu Merchanta, a nie w opisie
// produktu. Oficjalny poradnik wprost zabrania linków i zdjęć w opisie.

export const VON_HALSKY_CONTENT_POLICY = Object.freeze({
  id: 'inpost-von-halsky-product-content-2026-07-23-v2',
  name: 'Bezpieczna karta produktu Von Halsky',
  contractStatus: 'official_public_requirements_plus_conservative_product_only_gate',
  source: 'https://inpost.pl/aktualnosci-inpost-von-halsky-jak-stworzyc-dobra-oferte',
  merchantContactSource: 'https://inpost.pl/aktualnosci-inpost-von-halsky-onboarding',
  contactPlacement: 'merchant_store_settings_only',
  productDescriptionLinksAllowed: false,
});

function plainText(value = '') {
  return String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|h[1-6]|li|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

const PROHIBITED = Object.freeze([
  { id: 'external_link', label: 'zewnętrzny adres lub link', pattern: /(?:https?:\/\/|www\.|<a\b)/i },
  { id: 'embedded_image', label: 'osadzone zdjęcie w treści', pattern: /<img\b/i },
  { id: 'contact_data', label: 'dane lub zachęta do kontaktu', pattern: /\b(?:kontakt|telefon|e-?mail|napisz\s+do\s+nas|zadzwoń|wiadomość\s+prywatna)\b/i },
  { id: 'payment_data', label: 'informacja o płatności', pattern: /\b(?:płatno[śs][ćc]|przelew|rachunek\s+bankowy|blik)\b/i },
  { id: 'delivery_data', label: 'informacja logistyczna', pattern: /\b(?:dostaw|wysy[łl]|kurier|paczkomat|in\s*post|nadani|dor[eę]czeni|odbiór|przesy[łl]k)\w*/i },
  { id: 'sales_claim', label: 'hasło promocyjne niezwiązane z cechą produktu', pattern: /\b(?:gratis|promocja|wyprzedaż|najtańszy|hit\s+sprzedażowy|kup\s+teraz)\b/i },
]);

export function vonHalskyCheckEditorial(patch = {}) {
  const title = plainText(patch.vonHalskyTitle || patch.nazwa || patch.title);
  const shortDescription = String(patch.vonHalskyShortDescription || patch.opisKrotki || patch.shortDescription || '');
  const longDescription = String(patch.vonHalskyDescription || patch.opis || patch.longDescription || '');
  const combined = `${shortDescription}\n${longDescription}`;
  const description = plainText(combined);
  const violations = [];
  if (title.length < 7 || title.length > 150) violations.push({ id: 'title_length', label: 'nazwa musi mieć 7–150 znaków' });
  if (description.length < 100) violations.push({ id: 'description_length', label: 'opis musi mieć co najmniej 100 znaków' });
  const unsupportedTags = unique([...combined.matchAll(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi)]
    .map((match) => String(match[1] || '').toLowerCase())
    .filter((tag) => !['p', 'h2', 'ul', 'ol', 'li', 'strong', 'br'].includes(tag)));
  if (unsupportedTags.length) violations.push({ id: 'unsupported_markup', label: 'niedozwolony znacznik HTML', matches: unsupportedTags });
  for (const rule of PROHIBITED) {
    const match = combined.match(rule.pattern);
    if (match) violations.push({ id: rule.id, label: rule.label, matches: [String(match[0]).trim()] });
  }
  return {
    ok: violations.length === 0,
    violations,
    policyId: VON_HALSKY_CONTENT_POLICY.id,
    titleLength: title.length,
    descriptionLength: description.length,
  };
}
