const cleanText = (value, max = 1000) => String(value ?? '')
  .replace(/\u0000/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

export const manufacturerKey = (value = '') => cleanText(value, 500)
  .toLocaleLowerCase('pl-PL')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ł/g, 'l')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const verifiedProfile = (profile) => Object.freeze({
  role: 'manufacturer',
  countryCode: 'PL',
  country: 'Polska',
  source: 'verified-official-company-source',
  ...profile,
  aliases: Object.freeze([...(profile.aliases || [])]),
  brandAliases: Object.freeze([...(profile.brandAliases || [])]),
  exclusiveSourceHosts: Object.freeze([...(profile.exclusiveSourceHosts || [])]),
  trustedSourceHosts: Object.freeze([...(profile.trustedSourceHosts || profile.exclusiveSourceHosts || [])]),
  gtinPrefixes: Object.freeze([...(profile.gtinPrefixes || [])]),
  sources: Object.freeze([...(profile.sources || [])].map((source) => Object.freeze({ ...source }))),
});

/*
 * Rejestr zawiera wyłącznie dane z oficjalnych stron firm albo z kart
 * produktowych producenta. Profil jest jednym źródłem danych kontaktowych
 * dla edytora, GPSR oraz kanałów sprzedaży. Nie zapisujemy osobnych kopii
 * kontaktów w ustawieniach przeglądarki.
 */
export const VERIFIED_MANUFACTURER_PROFILES = Object.freeze([
  verifiedProfile({
    id: 'alexander',
    manufacturerName: 'Alexander',
    displayName: 'Alexander',
    legalName: 'Zakład Produkcyjny "Alexander" Piotr Pundzis',
    aliases: [
      'Alexander', 'Z.P. Alexander', 'ZP Alexander', 'Zakład Produkcyjny Alexander',
      'Zakład Produkcyjny "Alexander" Piotr Pundzis', 'Alexander Piotr Pundzis',
      'Aleksander', 'Alexader',
    ],
    brandAliases: [
      'MilliWOOD', 'Milliwood', 'Silver', 'iWood', 'Metalcraft', 'Constructor',
      'Pink Frog', 'PinkFrog', 'Pink-Frog',
    ],
    exclusiveSourceHosts: ['alexander.com.pl'],
    trustedSourceHosts: ['alexander.com.pl', 'sklep.alexander.com.pl'],
    gtinPrefixes: ['5906018'],
    address: 'ul. Telewizyjna 19, 80-209 Chwaszczyno, Polska',
    street: 'ul. Telewizyjna 19',
    postalCode: '80-209',
    city: 'Chwaszczyno',
    email: 'alexander@alexander.com.pl',
    phone: '+48 58 552 83 70',
    website: 'https://www.alexander.com.pl/',
    sourceUrl: 'https://www.alexander.com.pl/',
    verifiedAt: '2026-07-29',
    sources: [
      { type: 'official-company', url: 'https://www.alexander.com.pl/' },
      { type: 'official-product', url: 'https://www.sklep.alexander.com.pl/product-pol-80-Poczta.html' },
      { type: 'official-brand-product', url: 'https://www.sklep.alexander.com.pl/product-pol-5058-Puzzle-drewniane-Hi-Im-little-Zolwik-Theo-46-el.html' },
    ],
  }),
  verifiedProfile({
    id: 'multigra',
    manufacturerName: 'Multigra',
    displayName: 'Multigra',
    legalName: 'MultiGra Sp. z o.o.',
    aliases: ['Multigra', 'MultiGra', 'Multi Gra', 'MultiGra Sp. z o.o.', 'Mg'],
    brandAliases: ['Montessori', 'Monstessori'],
    exclusiveSourceHosts: ['multigra.com.pl'],
    trustedSourceHosts: ['multigra.com.pl'],
    gtinPrefixes: ['59063953', '59037966', '590449213'],
    address: 'ul. Telewizyjna 13C, 80-209 Chwaszczyno, Polska',
    street: 'ul. Telewizyjna 13C',
    postalCode: '80-209',
    city: 'Chwaszczyno',
    email: 'sklep@multigra.com.pl',
    phone: '+48 58 552 83 70',
    website: 'https://multigra.com.pl/',
    sourceUrl: 'https://multigra.com.pl/kontakt/',
    verifiedAt: '2026-07-29',
    sources: [
      { type: 'official-company', url: 'https://multigra.com.pl/kontakt/' },
      { type: 'official-product', url: 'https://www.sklep.alexander.com.pl/product-pol-0310-Gra-planszowa-Multigra-Lap-zajaca.html' },
    ],
  }),
  verifiedProfile({
    id: 'grabo',
    manufacturerName: 'Grabo',
    displayName: 'Grabo Balloons',
    legalName: 'Grabo S.r.l.',
    aliases: ['Grabo', 'Grabo Balloons', 'Grabo Srl', 'Grabo S.r.l.', 'Gabo'],
    exclusiveSourceHosts: ['grabo-balloons.com'],
    trustedSourceHosts: ['grabo-balloons.com'],
    countryCode: 'IT',
    country: 'Włochy',
    address: 'Via Vito Nicoletti 2, 47853 Coriano (RN), Włochy',
    street: 'Via Vito Nicoletti 2',
    postalCode: '47853',
    city: 'Coriano (RN)',
    email: 'info@grabo-balloons.com',
    phone: '+39 0541 657435',
    website: 'https://www.grabo-balloons.com/',
    sourceUrl: 'https://www.grabo-balloons.com/en/contacts',
    verifiedAt: '2026-07-29',
    sources: [
      { type: 'official-company', url: 'https://www.grabo-balloons.com/en/contacts' },
    ],
  }),
  verifiedProfile({
    id: 'hasbro-eu',
    manufacturerName: 'Hasbro',
    displayName: 'Hasbro',
    legalName: 'Hasbro European Trading B.V.',
    role: 'eu_responsible_person',
    aliases: ['Hasbro', 'Hasbro European Trading', 'Hasbro European Trading B.V.'],
    exclusiveSourceHosts: ['hasbro.com', 'shop.hasbro.com', 'docs.hasbro.com'],
    trustedSourceHosts: ['hasbro.com', 'shop.hasbro.com', 'docs.hasbro.com'],
    countryCode: 'NL',
    country: 'Holandia',
    address: 'De Entrée 240, 1101 EE Amsterdam, Holandia',
    street: 'De Entrée 240',
    postalCode: '1101 EE',
    city: 'Amsterdam',
    email: 'consumer_affairs@hasbro.co.uk',
    phone: '00800 2242 72 76',
    website: 'https://shop.hasbro.com/pl-pl/',
    sourceUrl: 'https://docs.hasbro.com/upload/mobileapps/MonopolyAppBanking/en-us/long.html',
    verifiedAt: '2026-07-29',
    sources: [
      { type: 'official-eu-representative', url: 'https://docs.hasbro.com/upload/mobileapps/MonopolyAppBanking/en-us/long.html' },
    ],
  }),
]);

function editDistance(left = '', right = '') {
  const a = manufacturerKey(left), b = manufacturerKey(right);
  if (!a) return b.length;
  if (!b) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_value, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function similarity(left = '', right = '') {
  const a = manufacturerKey(left), b = manufacturerKey(right);
  const longest = Math.max(a.length, b.length);
  return longest ? 1 - editDistance(a, b) / longest : 0;
}

function productHosts(product = {}) {
  return [...new Set([
    product.sourceUrl, product.producentUrl, product.agentImportUrl,
    product.sourceEvidence?.url, product.sourceEvidence?.resolvedUrl,
    product.sourceEvidence?.canonicalUrl, product.sourceMaterial?.url,
  ].flatMap((value) => {
    try {
      const url = new URL(cleanText(value, 2000));
      return ['http:', 'https:'].includes(url.protocol)
        ? [url.hostname.toLowerCase().replace(/^www\./, '')]
        : [];
    } catch {
      return [];
    }
  }))];
}

function productNames(product = {}) {
  return [...new Set([
    product.producent, product.manufacturer, product.marka, product.brand,
    product.manufacturerProfile?.manufacturerName, product.manufacturerProfile?.displayName,
    product.manufacturerProfile?.legalName, product.gpsrResponsibleProducer?.legalName,
    product.allegroResponsibleProducer?.name, product.allegroResponsibleProducer?.tradeName,
  ].map((value) => cleanText(value, 300)).filter(Boolean))];
}

function productGtins(product = {}) {
  return [...new Set([
    product.gtin, product.ean, ...(Array.isArray(product.gtins) ? product.gtins : []),
  ].map((value) => String(value ?? '').replace(/\D/g, '')).filter(Boolean))];
}

function profileCandidate(profile, product = {}) {
  const names = productNames(product), hosts = productHosts(product), gtins = productGtins(product);
  const aliases = [...profile.aliases, profile.legalName, profile.manufacturerName, profile.displayName].filter(Boolean);
  const brands = profile.brandAliases || [];
  let score = 0, method = '', matchedValue = '', matchedBrand = '';
  if (String(product.manufacturerProfileId || product.manufacturerProfile?.id || '') === profile.id) {
    score = 100; method = 'stored-verified-profile'; matchedValue = profile.id;
  }
  for (const name of names) {
    for (const alias of aliases) {
      const left = manufacturerKey(name), right = manufacturerKey(alias);
      if (!left || !right) continue;
      if (left === right && score < 100) {
        score = 100; method = 'verified-manufacturer-alias'; matchedValue = name;
      } else if (Math.min(left.length, right.length) >= 5 && (left.includes(right) || right.includes(left)) && score < 96) {
        score = 96; method = 'verified-manufacturer-alias'; matchedValue = name;
      } else if (Math.min(left.length, right.length) >= 5 && similarity(left, right) >= 0.84 && score < 95) {
        score = 95; method = 'verified-manufacturer-fuzzy'; matchedValue = name;
      }
    }
    for (const brand of brands) {
      const left = manufacturerKey(name), right = manufacturerKey(brand);
      if (!left || !right) continue;
      if (left === right && score < 98) {
        score = 98; method = 'verified-brand-owner'; matchedValue = name; matchedBrand = brand;
      } else if (Math.min(left.length, right.length) >= 5 && similarity(left, right) >= 0.88 && score < 94) {
        score = 94; method = 'verified-brand-owner-fuzzy'; matchedValue = name; matchedBrand = brand;
      }
    }
  }
  for (const gtin of gtins) for (const prefix of profile.gtinPrefixes || []) {
    if (gtin.startsWith(prefix) && score < 99) {
      score = 99; method = 'verified-gtin-prefix'; matchedValue = gtin;
    }
  }
  for (const host of hosts) for (const officialHost of profile.exclusiveSourceHosts || []) {
    // Tylko dokładnie wskazana domena może samodzielnie rozstrzygnąć producenta.
    // Przykład: sklep.alexander.com.pl zawiera również produkty MultiGra, więc
    // dziedziczenie z nadrzędnej domeny dawałoby fałszywe przypisania.
    if (host === officialHost && score < 99) {
      score = 99; method = 'verified-official-domain'; matchedValue = host;
    }
  }
  return { profile, score, confidence: score / 100, method, matchedValue, matchedBrand, names, hosts, gtins };
}

export function manufacturerProfileById(id = '') {
  return VERIFIED_MANUFACTURER_PROFILES.find((profile) => profile.id === String(id || '').trim()) || null;
}

export function searchManufacturerProfiles(query = '', { limit = 20 } = {}) {
  const wanted = manufacturerKey(query);
  const results = VERIFIED_MANUFACTURER_PROFILES.map((profile) => {
    const values = [
      profile.manufacturerName, profile.displayName, profile.legalName,
      ...profile.aliases, ...profile.brandAliases,
    ].filter(Boolean);
    let score = wanted ? 0 : 1;
    for (const value of values) {
      const candidate = manufacturerKey(value);
      if (!wanted || !candidate) continue;
      if (candidate === wanted) score = Math.max(score, 100);
      else if (candidate.startsWith(wanted)) score = Math.max(score, 90);
      else if (candidate.includes(wanted)) score = Math.max(score, 80);
      else if (wanted.length >= 3) score = Math.max(score, Math.round(similarity(wanted, candidate) * 70));
    }
    return { ...profile, searchScore: score };
  }).filter((profile) => profile.searchScore >= (wanted ? 45 : 0))
    .sort((left, right) => right.searchScore - left.searchScore || left.displayName.localeCompare(right.displayName, 'pl'));
  return results.slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));
}

export function resolveManufacturerProfile(product = {}, { profileId = '' } = {}) {
  const selected = manufacturerProfileById(profileId);
  if (selected) {
    return {
      ready: true,
      profile: selected,
      score: 100,
      confidence: 1,
      method: 'administrator-selected-verified-profile',
      matchedValue: selected.id,
      matchedBrand: '',
      ambiguous: false,
      alternatives: [],
    };
  }
  const candidates = VERIFIED_MANUFACTURER_PROFILES.map((profile) => profileCandidate(profile, product))
    .filter((candidate) => candidate.score >= 94)
    .sort((left, right) => right.score - left.score || left.profile.displayName.localeCompare(right.profile.displayName, 'pl'));
  const best = candidates[0];
  const ambiguous = Boolean(best && candidates[1] && candidates[1].score === best.score);
  if (!best || ambiguous) {
    return {
      ready: false,
      profile: null,
      score: best?.score || 0,
      confidence: (best?.score || 0) / 100,
      method: best ? 'ambiguous' : 'not-found',
      matchedValue: best?.matchedValue || '',
      matchedBrand: '',
      ambiguous,
      alternatives: candidates.slice(0, 5).map((candidate) => ({
        id: candidate.profile.id,
        name: candidate.profile.displayName,
        score: candidate.score,
        method: candidate.method,
      })),
    };
  }
  return {
    ready: true,
    profile: best.profile,
    score: best.score,
    confidence: best.confidence,
    method: best.method,
    matchedValue: best.matchedValue,
    matchedBrand: best.matchedBrand,
    ambiguous: false,
    alternatives: candidates.slice(1, 5).map((candidate) => ({
      id: candidate.profile.id,
      name: candidate.profile.displayName,
      score: candidate.score,
      method: candidate.method,
    })),
  };
}

export function manufacturerProfileProductPatch(product = {}, resolution = resolveManufacturerProfile(product), timestamp = new Date().toISOString()) {
  if (!resolution?.ready || !resolution.profile) return {};
  const profile = resolution.profile;
  const currentProducer = cleanText(product.producent || product.manufacturer, 200);
  const currentBrand = cleanText(product.marka || product.brand, 200);
  const brandKeys = new Set((profile.brandAliases || []).map(manufacturerKey));
  const recognizedBrand = resolution.matchedBrand
    || (brandKeys.has(manufacturerKey(currentBrand)) ? currentBrand : '')
    || (brandKeys.has(manufacturerKey(currentProducer)) ? currentProducer : '');
  const compactProfile = {
    id: profile.id,
    manufacturerName: profile.manufacturerName,
    displayName: profile.displayName,
    legalName: profile.legalName,
    role: profile.role,
    address: profile.address,
    street: profile.street,
    postalCode: profile.postalCode,
    city: profile.city,
    country: profile.country,
    countryCode: profile.countryCode,
    email: profile.email,
    phone: profile.phone,
    website: profile.website,
    sourceUrl: profile.sourceUrl,
    source: profile.source,
    verifiedAt: profile.verifiedAt,
  };
  return {
    producent: profile.manufacturerName,
    ...(!currentBrand && recognizedBrand ? { marka: recognizedBrand } : {}),
    manufacturerProfileId: profile.id,
    manufacturerProfile: compactProfile,
    manufacturerProfileResolvedAt: timestamp,
    manufacturerProfileConfidence: resolution.confidence,
    manufacturerProfileMethod: resolution.method,
    manufacturerProfileEvidence: {
      matchedValue: resolution.matchedValue,
      matchedBrand: recognizedBrand,
      sourceUrl: profile.sourceUrl,
      verifiedAt: profile.verifiedAt,
    },
  };
}
