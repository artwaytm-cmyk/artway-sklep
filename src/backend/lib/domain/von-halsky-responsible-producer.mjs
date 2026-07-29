const text = (value, max = 1000) => String(value ?? '')
  .replace(/\u0000/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const key = (value = '') => text(value, 500)
  .toLocaleLowerCase('pl-PL')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ł/g, 'l')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const email = (value = '') => {
  const normalized = text(value, 320).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized) ? normalized : '';
};

const phone = (value = '') => {
  const normalized = text(value, 80);
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15 ? normalized : '';
};

function structuredParty(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const legalName = text(value.legalName || value.name || value.producerName || value.manufacturer, 300);
  const address = text(value.address || value.fullAddress, 500)
    || [
      text(value.street, 220),
      [text(value.postalCode, 30), text(value.city, 160)].filter(Boolean).join(' '),
      text(value.country || value.countryName, 100),
    ].filter(Boolean).join(', ');
  const result = {
    legalName,
    displayName: text(value.displayName || value.tradeName || value.brand || legalName, 200),
    address,
    street: text(value.street, 220),
    postalCode: text(value.postalCode, 30),
    city: text(value.city, 160),
    country: text(value.country || value.countryName || 'Polska', 100),
    countryCode: text(value.countryCode || 'PL', 3).toUpperCase(),
    email: email(value.email || value.contactEmail),
    phone: phone(value.phone || value.telephone || value.contactPhone),
    sourceUrl: text(value.sourceUrl || value.url, 2000),
    source: text(value.source, 160),
    verifiedAt: text(value.verifiedAt, 80),
  };
  return result;
}

export function vonHalskyResponsibleProducerMissing(value = {}) {
  const party = structuredParty(value) || {};
  return [
    !party.legalName && 'nazwa producenta / osoby odpowiedzialnej',
    !party.address && 'adres producenta / osoby odpowiedzialnej',
    !party.email && 'adres e-mail producenta / osoby odpowiedzialnej',
    !party.phone && 'numer telefonu producenta / osoby odpowiedzialnej',
  ].filter(Boolean);
}

function labeledValue(value = '', labels = []) {
  const source = text(value, 6000);
  const allLabels = '(?:Producent\\s*\\/\\s*Osoba odpowiedzialna|Producent|Osoba odpowiedzialna|Nazwa|Adres|Kod pocztowy|Miasto|Kraj|Adres e-?mail|E-?mail|Numer telefonu|Telefon)';
  for (const label of labels) {
    const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`${escaped}\\s*:?\\s*(.+?)(?=\\s+${allLabels}\\s*:|$)`, 'i'));
    const result = text(match?.[1], 500).replace(/^[-–—]\s*/, '');
    if (result) return result;
  }
  return '';
}

export function responsibleProducerFromSourceText(value = '', {
  sourceUrl = '',
  source = 'manufacturer-product-page',
  verifiedAt = new Date().toISOString(),
} = {}) {
  const raw = text(value, 6000);
  if (!raw) return null;
  const street = labeledValue(raw, ['Adres']);
  const postalCode = labeledValue(raw, ['Kod pocztowy']);
  const city = labeledValue(raw, ['Miasto']);
  const country = labeledValue(raw, ['Kraj']) || 'Polska';
  const result = structuredParty({
    legalName: labeledValue(raw, ['Producent / Osoba odpowiedzialna', 'Osoba odpowiedzialna', 'Producent', 'Nazwa']),
    street,
    postalCode,
    city,
    country,
    address: [street, [postalCode, city].filter(Boolean).join(' '), country].filter(Boolean).join(', '),
    email: labeledValue(raw, ['Adres email', 'Adres e-mail', 'E-mail', 'Email']),
    phone: labeledValue(raw, ['Numer telefonu', 'Telefon']),
    sourceUrl,
    source,
    verifiedAt,
  });
  return result?.legalName || result?.address || result?.email || result?.phone ? result : null;
}

/*
 * Rejestr zawiera wyłącznie dane potwierdzone w materiale samego producenta.
 * Nie jest słownikiem marketingowym ani wynikiem generowania AI. Kolejnych
 * producentów dodajemy dopiero z kompletnym źródłem i kompletem GPSR.
 */
export const VON_HALSKY_VERIFIED_RESPONSIBLE_PRODUCERS = Object.freeze([
  Object.freeze({
    sourceHosts: Object.freeze([
      'sklep.alexander.com.pl',
    ]),
    aliases: Object.freeze([
      'Alexander',
      'Z.P. Alexander',
      'Zakład Produkcyjny Alexander',
      'Zakład Produkcyjny "Alexander" Piotr Pundzis',
      'Alexander Piotr Pundzis',
    ]),
    legalName: 'Zakład Produkcyjny "Alexander" Piotr Pundzis',
    displayName: 'Alexander',
    address: 'ul. Telewizyjna 19, 80-209 Chwaszczyno, Polska',
    street: 'ul. Telewizyjna 19',
    postalCode: '80-209',
    city: 'Chwaszczyno',
    country: 'Polska',
    countryCode: 'PL',
    email: 'alexander@alexander.com.pl',
    phone: '+48 58 552 83 70',
    sourceUrl: 'https://www.sklep.alexander.com.pl/',
    sourceProductUrl: 'https://www.sklep.alexander.com.pl/product-pol-2443-Matgram.html',
    source: 'verified-manufacturer-source',
    verifiedAt: '2026-07-29',
  }),
]);

function directCandidates(product = {}) {
  return [
    product.vonHalskyResponsibleProducer,
    product.gpsrResponsibleProducer,
    product.responsibleProducer,
    product.sourceEvidence?.responsibleProducer,
    product.allegroResponsibleProducer,
  ];
}

function targetNames(product = {}) {
  return [...new Set([
    product.producent,
    product.manufacturer,
    product.marka,
    product.brand,
    product.allegroResponsibleProducer?.name,
    product.allegroResponsibleProducer?.tradeName,
  ].map(key).filter(Boolean))];
}

function targetSourceHosts(product = {}) {
  return [...new Set([
    product.sourceUrl,
    product.producentUrl,
    product.agentImportUrl,
    product.sourceEvidence?.url,
    product.sourceEvidence?.resolvedUrl,
    product.sourceEvidence?.canonicalUrl,
    product.sourceMaterial?.url,
  ].flatMap((value) => {
    try {
      const url = new URL(text(value, 2000));
      if (url.protocol !== 'https:') return [];
      return [url.hostname.toLowerCase().replace(/^www\./, '')];
    } catch {
      return [];
    }
  }))];
}

function registryMatch(product = {}) {
  const targets = targetNames(product);
  const sourceHosts = targetSourceHosts(product);
  if (!targets.length && !sourceHosts.length) return null;
  const matches = VON_HALSKY_VERIFIED_RESPONSIBLE_PRODUCERS.map((profile) => {
    const aliases = profile.aliases.map(key);
    const officialHosts = (profile.sourceHosts || []).map((host) => text(host, 300).toLowerCase().replace(/^www\./, ''));
    let score = 0, method = '';
    for (const target of targets) for (const alias of aliases) {
      if (target === alias && score < 100) {
        score = 100;
        method = 'verified-producer-alias';
      } else if (target.length >= 5 && alias.length >= 5 && (target.includes(alias) || alias.includes(target)) && score < 94) {
        score = 94;
        method = 'verified-producer-alias';
      }
    }
    for (const sourceHost of sourceHosts) {
      if (officialHosts.includes(sourceHost) && score < 99) {
        score = 99;
        method = 'verified-manufacturer-product-domain';
      }
    }
    return { profile, score, method };
  }).filter((item) => item.score >= 94).sort((left, right) => right.score - left.score);
  if (!matches.length || (matches[1] && matches[1].score === matches[0].score)) return null;
  return {
    ...matches[0].profile,
    matchConfidence: matches[0].score / 100,
    matchMethod: matches[0].method,
    matchedSourceHost: sourceHosts.find((host) => (matches[0].profile.sourceHosts || []).includes(host)) || '',
  };
}

export function resolveVonHalskyResponsibleProducer(product = {}) {
  for (const candidate of directCandidates(product)) {
    const value = structuredParty(candidate);
    const missing = vonHalskyResponsibleProducerMissing(value);
    if (value && !missing.length) {
      return {
        ready: true,
        value: { ...value, source: value.source || 'central-product-card' },
        missing: [],
        evidence: {
          method: 'structured-product-data',
          producer: value.legalName,
          sourceUrl: value.sourceUrl,
        },
      };
    }
  }
  const registry = registryMatch(product);
  if (registry) {
    const value = structuredParty(registry);
    return {
      ready: true,
      value,
      missing: [],
      evidence: {
        method: registry.matchMethod || 'verified-producer-alias',
        producer: value.legalName,
        matchConfidence: registry.matchConfidence,
        matchedSourceHost: registry.matchedSourceHost || '',
        sourceUrl: registry.sourceUrl,
        sourceProductUrl: registry.sourceProductUrl,
      },
    };
  }
  const names = targetNames(product);
  const partial = directCandidates(product).map(structuredParty).find(Boolean) || null;
  return {
    ready: false,
    value: partial,
    missing: vonHalskyResponsibleProducerMissing(partial),
    evidence: {
      method: names.length ? 'producer-known-but-gpsr-profile-missing' : 'producer-not-identified',
      producerAliases: names,
    },
  };
}
