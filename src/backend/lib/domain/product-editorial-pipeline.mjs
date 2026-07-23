import { PROMPT_VERSION, productEditorialFingerprint, productPatch } from './agent-specialists.mjs';
import { buildSharedProductDescriptionSections } from './product-content-layout.mjs';

const clean = (value = '', limit = 30_000) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, limit);

function decodeEntities(value = '') {
  return String(value).replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

export function editorialStructuredText(value = '', limit = 20_000) {
  return clean(decodeEntities(String(value)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|div|h[1-6]|ul|ol)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ')), limit)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeEditorialTitle(value = '') {
  const title = clean(value, 300)
    .replace(/\s+[|–—]\s+(?:sklep|producent|oficjalny sklep).*$/i, '')
    .replace(/\s+-\s+(?:sklep internetowy|oficjalny sklep).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title || title !== title.toUpperCase() || title.length < 8) return title;
  return title.toLocaleLowerCase('pl-PL').replace(/(^|[\s(\[/-])([a-ząćęłńóśźż])/g, (_, before, letter) => before + letter.toLocaleUpperCase('pl-PL')).replace(/\b3d\b/gi, '3D');
}

export function linkedProductSourceMaterial(product = {}, sourceUrl = '', now = () => new Date()) {
  const previous = product.sourceMaterial && typeof product.sourceMaterial === 'object' ? product.sourceMaterial : {};
  return {
    sourceUrl: clean(sourceUrl || previous.sourceUrl || product.sourceUrl || product.producentUrl, 1000),
    fetchedAt: clean(product.sourceEvidence?.fetchedAt || product.producentSprawdzonoAt || previous.fetchedAt || now().toISOString(), 50),
    title: clean(previous.title || product.nazwa || product.name, 300),
    shortDescription: editorialStructuredText(previous.shortDescription || product.opisKrotki || product.krotkiOpis, 4000),
    longDescription: editorialStructuredText(previous.longDescription || product.opis, 20_000),
    producer: clean(previous.producer || product.producent || product.marka, 160),
    brand: clean(previous.brand || product.marka || product.producent, 160),
    category: clean(previous.category || product.kategoria, 180),
    ean: clean(previous.ean || product.gtin || product.ean, 80),
    producerCode: clean(previous.producerCode || product.kodProducenta || product.mpn, 160),
    parameters: previous.parameters || product.parametryProducenta || product.parametryZrodla || product.parametry || {},
    availability: clean(product.dostepnoscProducenta || product.producentStatus || previous.availability, 120),
  };
}

function runMeta(run = {}) {
  const value = run || {};
  return { id: clean(value.id, 160), model: clean(value.model, 100), confidence: Number(value.result?.confidence || 0), complianceStatus: clean(value.result?.complianceStatus, 80) };
}

function sharedTitle(value = '') {
  const title = normalizeEditorialTitle(value);
  if (title.length <= 75) return title;
  const shortened = title.slice(0, 75), boundary = shortened.lastIndexOf(' ');
  return shortened.slice(0, boundary > 45 ? boundary : 75).trim();
}

export async function prepareLinkedProductEditorial(product = {}, {
  sourceUrl = '', runSpecialist, actor = { source: 'product-link-editorial' }, now = () => new Date(),
} = {}) {
  const preparedAt = now().toISOString(), sourceMaterial = linkedProductSourceMaterial(product, sourceUrl, now), warnings = [];
  let storeRun = null;
  if (typeof runSpecialist === 'function') {
    try {
      storeRun = await runSpecialist({
        specialist: 'product_content', source: 'manual',
        instruction: 'Na podstawie materiału źródłowego przygotuj unikalną treść produktu dla sklepu Artway-TM. Źródło służy wyłącznie do ustalenia faktów. Popraw nazwę sprzedażową, krótki opis, długi opis i SEO; nie kopiuj dopisków sklepu źródłowego, chaotycznego formatowania ani tekstów kontaktowych. Zachowaj tożsamość produktu, wariant, markę, model, EAN i kod producenta. Nie wymyślaj cech.',
        context: { channel: 'store', sourceMaterial, rule: 'raw_source_is_facts_only' },
        target: { type: 'product_link_draft', sourceUrl: sourceMaterial.sourceUrl },
      }, actor);
    } catch (error) { warnings.push(`Redakcja sklepu: ${clean(error?.message || error, 500)}`); }
  }
  const storePatch = productPatch(storeRun?.result || {}), title = sharedTitle(storePatch.nazwa || product.nazwa || product.name), storeProduct = {
    ...product,
    nazwa: title,
    opisKrotki: editorialStructuredText(storePatch.opisKrotki || product.opisKrotki || product.krotkiOpis, 500),
    opis: editorialStructuredText(storePatch.opis || product.opis, 20_000),
    ...(storePatch.seoTitle ? { seoTitle: clean(storePatch.seoTitle, 70) } : {}),
    ...(storePatch.seoDescription ? { seoDescription: clean(storePatch.seoDescription, 180) } : {}),
    ...(storePatch.seoKeywords ? { seoKeywords: clean(storePatch.seoKeywords, 500) } : {}),
  };
  const ready = !!storeRun;
  const sections = buildSharedProductDescriptionSections(storeProduct);
  const editorialTarget = { store: true, vonHalsky: true, allegro: true, channels: 'shared_store_allegro_von_halsky' };
  const editorialFingerprint = productEditorialFingerprint({ ...storeProduct, sourceMaterial }, editorialTarget);
  return {
    product: {
      ...storeProduct,
      allegroTitle: title,
      allegroDescription: storeProduct.opis,
      allegroDescriptionSections: sections,
      vonHalskyContentMode: 'store',
      vonHalskyContentSource: 'store-canonical-content',
      vonHalskyContentUpdatedAt: preparedAt,
      sourceMaterial,
      contentEditorial: { status: ready ? 'ready' : 'needs_review', sourceRole: 'facts_only', channels: 'shared_store_allegro_von_halsky', targets: { store: true, vonHalsky: true, allegro: true }, layoutPolicy: 'allegro_sections', promptVersion: PROMPT_VERSION, inputFingerprint: editorialFingerprint, preparedAt, store: runMeta(storeRun), warnings },
      contentEditorialPreparedAt: preparedAt,
      contentEditorialSource: 'agent-specialists-from-source-facts',
    },
    sourceMaterial, status: ready ? 'ready' : 'needs_review', warnings, storeRun: runMeta(storeRun), allegroRun: runMeta(storeRun),
  };
}
