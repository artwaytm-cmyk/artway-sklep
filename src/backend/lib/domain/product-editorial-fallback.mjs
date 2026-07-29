import {
  PROMPT_VERSION,
  productEditorialFingerprint,
  productEditorialSourceFingerprint,
} from './agent-specialists-support.mjs';
import { buildProfessionalProductDescription, professionalDescriptionQuality } from './product-content-layout.mjs';
import { editorialProductContentReport, editorialSourceTextIsSafe } from './product-editorial-safety.mjs';

const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const SOURCE_PAGE_NOISE = /(?:dodaj produkty podając kody|wgraj pliki z kodami|przejdź do koszyka|zaloguj się|twoje konto|newsletter|polityka prywatności|regulamin sklepu|menu główne)/i;
const FORBIDDEN_EDITORIAL_LINE = /(?:skontaktuj|kontakt(?:uj|owy| przed)|zadzwoń|napisz do nas|e-?mail|www\.|https?:\/\/|dostaw|wysył|kurier|paczkomat|przesyłk|odbiór osobisty|czas realizacji|koszt transportu|koszt wysyłki|płatno|przelew|stan magazynowy|dostępn(?:y|ość)|powiadom o dostępności|dodaj do koszyka|dodaj do porównania|lista zakupowa|rozmiar uniwersalny\s*\d+\s*szt)/i;

function editorialText(value = '', limit = 30_000) {
  if (!editorialSourceTextIsSafe(value)) return '';
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 3 && !SOURCE_PAGE_NOISE.test(line) && !FORBIDDEN_EDITORIAL_LINE.test(line))
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, limit);
}

export function deterministicProductEditorialFallback(product = {}) {
  const source = asObject(product.sourceMaterial);
  const title = editorialText(product.nazwa || product.name || source.title, 150).replace(/\n+/g, ' ').trim();
  const sourceLongDescription = [
    source.longDescription,
    product.opis,
    product.allegroDescription,
  ].map((value) => editorialText(value)).find((value) => value.length >= 150) || '';
  if (!title || !sourceLongDescription) return null;
  const sourceShort = [
    source.shortDescription,
    product.opisKrotki,
  ].map((value) => editorialText(value, 500)).find((value) => value.length >= 40) || '';
  const shortDescription = (sourceShort || sourceLongDescription.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ') || sourceLongDescription)
    .slice(0, 500)
    .trim();
  if (shortDescription.length < 40) return null;
  const longDescription = buildProfessionalProductDescription({
    ...product,
    parametryProducenta: source.parameters || product.parametryProducenta,
  }, sourceLongDescription);
  if (!professionalDescriptionQuality(longDescription).professional) return null;
  const timestamp = new Date().toISOString();
  const base = {
    ...product,
    nazwa: title,
    opisKrotki: shortDescription,
    opis: longDescription,
    allegroTitle: editorialText(product.allegroTitle || title, 75).replace(/\n+/g, ' ').trim(),
    allegroDescription: longDescription,
    seoTitle: editorialText(product.seoTitle || title, 70).replace(/\n+/g, ' ').trim(),
    seoDescription: editorialText(product.seoDescription || shortDescription, 160).replace(/\n+/g, ' ').trim(),
  };
  if (!editorialProductContentReport(base, 'store').ready
    || !editorialProductContentReport(base, 'allegro').ready) return null;
  const fingerprint = productEditorialFingerprint(base);
  const sourceFingerprint = productEditorialSourceFingerprint(base);
  const previous = asObject(product.contentEditorial);
  const previousChannels = asObject(previous.channelStates);
  const receipt = (channel) => ({
    ...asObject(previousChannels[channel]),
    status: 'ready',
    promptVersion: PROMPT_VERSION,
    inputFingerprint: fingerprint,
    preparedAt: timestamp,
    source: 'deterministic-source-policy',
    qualityConfirmed: true,
  });
  return {
    ...base,
    contentEditorial: {
      ...previous,
      status: 'ready',
      inputFingerprint: fingerprint,
      sourceFingerprint,
      channelStates: {
        ...previousChannels,
        store: receipt('store'),
        allegro: receipt('allegro'),
      },
      preparedAt: timestamp,
      source: 'deterministic-source-policy',
    },
    contentEditorialPreparedAt: timestamp,
    contentEditorialSource: 'deterministic-source-policy',
  };
}
