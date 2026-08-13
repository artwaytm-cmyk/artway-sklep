import { canonicalManufacturerName } from './product-field-validation.mjs';

const normalize = (value = '') => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pl-PL')
  .replace(/ł/g, 'l')
  .replace(/[^a-z0-9]+/g, '')
  .trim();

const IDENTITY_GROUPS = Object.freeze([
  // „Alexader” występuje w aktualnym produkcie katalogowym Allegro dla
  // poprawnego EAN Alexandra. Alias naprawia wyłącznie porównanie marki;
  // nadal wymagamy dokładnego GTIN i zgodności pozostałych cech.
  ['Alexander', 'Aleksander', 'Alexader'],
  ['MilliWOOD', 'Milliwood', 'Milli Wood'],
  ['iWood', 'IWood', 'i Wood'],
  // Allegro zapisuje część produktów Multigra pod skróconą marką „Mg”.
  // Skrót jest oficjalnym aliasem profilu producenta, ale samo dopasowanie
  // katalogowe nadal wymaga dokładnego GTIN i pozostałych kontroli tożsamości.
  ['MultiGra', 'Multigra', 'Multi Gra', 'Mg'],
  ['GoDan', 'Godan', 'Go Dan'],
]);

const aliasesByKey = new Map();
for (const group of IDENTITY_GROUPS) {
  const aliases = [...new Set(group.map((value) => canonicalManufacturerName(value)).filter(Boolean))];
  for (const alias of aliases) aliasesByKey.set(normalize(alias), aliases);
}
// Tożsamość właściciela marki jest używana wyłącznie jako bezpieczny fallback
// kanału sprzedaży. Nie zamienia marki handlowej w kartotece produktu.
const BRAND_MANUFACTURERS = new Map([
  [normalize('MilliWOOD'), 'Alexander'],
]);

function sourceObject(product = {}) {
  return product?.parametryZrodla && typeof product.parametryZrodla === 'object' && !Array.isArray(product.parametryZrodla)
    ? product.parametryZrodla
    : {};
}

function firstName(values = []) {
  for (const value of values) {
    const name = canonicalManufacturerName(value);
    if (name) return name;
  }
  return '';
}

function uniqueNames(values = []) {
  const result = [];
  const seen = new Set();
  for (const value of values.flat(Infinity)) {
    const name = canonicalManufacturerName(value);
    const key = normalize(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function allegroCommercialNameAliases(value = '') {
  const name = canonicalManufacturerName(value);
  if (!name) return [];
  return uniqueNames([name, aliasesByKey.get(normalize(name)) || []]);
}

export function allegroCommercialNamesEquivalent(left = '', right = '') {
  const leftKeys = new Set(allegroCommercialNameAliases(left).map(normalize));
  return allegroCommercialNameAliases(right).some((value) => leftKeys.has(normalize(value)));
}

export function allegroProductCommercialIdentity(product = {}) {
  const source = sourceObject(product);
  const brand = firstName([
    product.marka, product.brand, source.marka, source.brand,
  ]);
  const rawManufacturer = firstName([
    product.producent, product.manufacturer, source.producent, source.manufacturer,
  ]);
  const owner = BRAND_MANUFACTURERS.get(normalize(brand)) || '';
  const manufacturer = rawManufacturer && !allegroCommercialNamesEquivalent(rawManufacturer, brand)
    ? rawManufacturer
    : (owner || rawManufacturer || brand);
  const publisher = firstName([
    product.wydawca, product.publisher, source.wydawca, source.publisher, manufacturer,
  ]);
  const canonicalBrand = brand || manufacturer || publisher;
  return {
    brand: canonicalBrand,
    manufacturer: manufacturer || publisher || canonicalBrand,
    publisher: publisher || manufacturer || canonicalBrand,
    brandOwner: owner,
    brandCandidates: uniqueNames([
      allegroCommercialNameAliases(canonicalBrand),
      allegroCommercialNameAliases(manufacturer),
      allegroCommercialNameAliases(publisher),
    ]),
    manufacturerCandidates: uniqueNames([
      allegroCommercialNameAliases(manufacturer),
      allegroCommercialNameAliases(publisher),
      allegroCommercialNameAliases(canonicalBrand),
    ]),
    publisherCandidates: uniqueNames([
      allegroCommercialNameAliases(publisher),
      allegroCommercialNameAliases(manufacturer),
      allegroCommercialNameAliases(canonicalBrand),
    ]),
    identityCandidates: uniqueNames([
      allegroCommercialNameAliases(canonicalBrand),
      allegroCommercialNameAliases(manufacturer),
      allegroCommercialNameAliases(publisher),
    ]),
    manufacturerDerivedFromBrand: !!(owner && (!rawManufacturer || allegroCommercialNamesEquivalent(rawManufacturer, brand))),
  };
}
