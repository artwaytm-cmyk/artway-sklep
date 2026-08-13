import {
  VERIFIED_MANUFACTURER_PROFILES,
  resolveManufacturerProfile,
} from './manufacturer-profile-registry.mjs';

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
  return result.legalName || result.address || result.email || result.phone || result.sourceUrl
    ? result
    : null;
}

export function vonHalskyResponsibleProducerMissing(value = {}) {
  const party = structuredParty(value) || {};
  return [
    !party.legalName && 'nazwa producenta / osoby odpowiedzialnej',
    !party.address && 'adres producenta / osoby odpowiedzialnej',
    !party.email && 'adres e-mail producenta / osoby odpowiedzialnej',
  ].filter(Boolean);
}

function labeledValue(value = '', labels = []) {
  const source = text(value, 6000);
  const allLabels = '(?:Producent\\s*\\/\\s*Osoba odpowiedzialna|Producent|Osoba odpowiedzialna|Nazwa|Adres|Kod pocztowy|Miasto|Kraj|Adres e-?mail|E-?mail|Numer telefonu|Telefon)';
  for (const label of labels) {
    const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // `Producent` nie może dopasować się do końcówki etykiety
    // `Kod producenta`. Granica po pełnej nazwie pola chroni przed zapisaniem
    // kodu, EAN-u lub fragmentu galerii jako nazwy podmiotu GPSR.
    const match = source.match(new RegExp(`(?:^|\\s)${escaped}(?![\\p{L}\\p{N}])\\s*:?\\s*(.+?)(?=\\s+${allLabels}(?![\\p{L}\\p{N}])\\s*:|$)`, 'iu'));
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
  const rawLegalName = labeledValue(raw, ['Producent / Osoba odpowiedzialna', 'Osoba odpowiedzialna', 'Producent', 'Nazwa']);
  const legalName = rawLegalName.length <= 180
    && rawLegalName.split(/\s+/).length <= 18
    && !/(?:https?:|\[[^\]]+\]\(|gwarancja|ostatnio ogl[ąa]dane|dodaj do|koszyk)/i.test(rawLegalName)
    ? rawLegalName
    : '';
  const street = labeledValue(raw, ['Adres']);
  const postalCode = labeledValue(raw, ['Kod pocztowy']);
  const city = labeledValue(raw, ['Miasto']);
  const country = labeledValue(raw, ['Kraj']) || 'Polska';
  const result = structuredParty({
    legalName,
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
export const VON_HALSKY_VERIFIED_RESPONSIBLE_PRODUCERS = VERIFIED_MANUFACTURER_PROFILES;

function directCandidates(product = {}) {
  return [
    product.manufacturerProfile,
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
  const match = resolveManufacturerProfile(product);
  if (!match.ready || !match.profile) return null;
  const matchedSourceHost = targetSourceHosts(product).find((host) => (
    match.profile.trustedSourceHosts || []
  ).some((officialHost) => host === officialHost || host.endsWith(`.${officialHost}`))) || '';
  const method = matchedSourceHost
    ? 'verified-manufacturer-product-domain'
    : ['verified-manufacturer-alias', 'verified-manufacturer-fuzzy', 'verified-brand-owner', 'verified-brand-owner-fuzzy']
        .includes(match.method)
      ? 'verified-producer-alias'
      : match.method;
  return {
    ...match.profile,
    matchConfidence: match.confidence,
    matchMethod: method,
    matchedSourceHost,
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
