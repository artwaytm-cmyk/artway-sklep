import { automaticEditorialAssessment, PROMPT_VERSION, productEditorialFingerprint, productPatch } from './agent-specialists.mjs';
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
        instruction: 'Na podstawie materiału źródłowego przygotuj niezależną treść produktu dla sklepu Artway-TM. Źródło służy wyłącznie do ustalenia faktów. Popraw nazwę sprzedażową, krótki opis, długi opis i SEO; nie zmieniaj treści Allegro ani Von Halsky.',
        context: { channel: 'store', sourceMaterial, rule: 'raw_source_is_facts_only' },
        target: { type: 'product_link_draft', sourceUrl: sourceMaterial.sourceUrl },
      }, actor);
    } catch (error) { warnings.push(`Redakcja sklepu: ${clean(error?.message || error, 500)}`); }
  }
  const storePatch = productPatch(storeRun?.result || {}), storeAssessment = storeRun ? automaticEditorialAssessment(storeRun) : { eligible: false, reason: 'agent_unavailable' };
  const title = sharedTitle(storePatch.nazwa || product.nazwa || product.name), storeProduct = {
    ...product,
    nazwa: title,
    opisKrotki: editorialStructuredText(storePatch.opisKrotki || product.opisKrotki || product.krotkiOpis, 500),
    opis: editorialStructuredText(storePatch.opis || product.opis, 20_000),
    ...(storePatch.seoTitle ? { seoTitle: clean(storePatch.seoTitle, 70) } : {}),
    ...(storePatch.seoDescription ? { seoDescription: clean(storePatch.seoDescription, 180) } : {}),
    ...(storePatch.seoKeywords ? { seoKeywords: clean(storePatch.seoKeywords, 500) } : {}),
  };
  const channelTarget = { type: 'product_link_draft', sourceUrl: sourceMaterial.sourceUrl };
  const channelContext = { sourceMaterial, storeFacts: { title: storeProduct.nazwa, shortDescription: storeProduct.opisKrotki, longDescription: storeProduct.opis }, rule: 'independent_channel_content' };
  const runChannel = async (specialist, channel, instruction) => {
    if (typeof runSpecialist !== 'function') return null;
    try {
      return await runSpecialist({ specialist, source: 'manual', instruction, context: { ...channelContext, channel }, target: channelTarget }, actor);
    } catch (error) {
      warnings.push(`${channel}: ${clean(error?.message || error, 500)}`);
      return null;
    }
  };
  const [allegroRun, vonHalskyRun] = await Promise.all([
    runChannel('allegro_offer', 'allegro', 'Przygotuj niezależny tytuł i opis Allegro wyłącznie o tym produkcie. Bez linków, kontaktu, sprzedaży poza Allegro, płatności, dostawy i logistyki.'),
    runChannel('von_halsky_offer', 'vonHalsky', 'Przygotuj niezależną nazwę, opis krótki i opis pełny Von Halsky. Nazwa 7–150 znaków, opis minimum 100 znaków. Bez linków, obrazów w treści, kontaktu, płatności i logistyki.'),
  ]);
  const allegroPatch = productPatch(allegroRun?.result || {}), vonHalskyPatch = productPatch(vonHalskyRun?.result || {});
  const allegroAssessment = allegroRun ? automaticEditorialAssessment(allegroRun) : { eligible: false, reason: 'agent_unavailable' };
  const vonHalskyAssessment = vonHalskyRun ? automaticEditorialAssessment(vonHalskyRun) : { eligible: false, reason: 'agent_unavailable' };
  if (storeRun && !storeAssessment.eligible) warnings.push(`Sklep: ${storeAssessment.reason}`);
  if (allegroRun && !allegroAssessment.eligible) warnings.push(`Allegro: ${allegroAssessment.reason}`);
  if (vonHalskyRun && !vonHalskyAssessment.eligible) warnings.push(`Von Halsky: ${vonHalskyAssessment.reason}`);
  const editorialTarget = { store: true, vonHalsky: true, allegro: true, channels: 'independent_store_allegro_von_halsky' };
  const editorialFingerprint = productEditorialFingerprint({ ...storeProduct, sourceMaterial }, editorialTarget);
  const channelState = (run, assessment) => ({ status: assessment.eligible ? 'ready' : 'needs_review', promptVersion: PROMPT_VERSION, inputFingerprint: editorialFingerprint, preparedAt, ...runMeta(run), reason: assessment.reason || '' });
  const channelStates = { store: channelState(storeRun, storeAssessment), allegro: channelState(allegroRun, allegroAssessment), vonHalsky: channelState(vonHalskyRun, vonHalskyAssessment) };
  const readyCount = Object.values(channelStates).filter((entry) => entry.status === 'ready').length, status = readyCount === 3 ? 'ready' : readyCount ? 'partial_ready' : 'needs_review';
  const channelProduct = {
    ...storeProduct,
    ...(allegroAssessment.eligible ? {
      allegroTitle: clean(allegroPatch.allegroTitle, 75), allegroDescription: clean(allegroPatch.allegroDescription, 30_000),
      allegroDescriptionSections: buildSharedProductDescriptionSections({ ...storeProduct, nazwa: allegroPatch.allegroTitle, opis: allegroPatch.allegroDescription, allegroDescription: allegroPatch.allegroDescription }),
    } : {}),
    ...(vonHalskyAssessment.eligible ? {
      vonHalskyContentMode: 'custom', vonHalskyTitle: clean(vonHalskyPatch.vonHalskyTitle, 150),
      vonHalskyShortDescription: clean(vonHalskyPatch.vonHalskyShortDescription, 2000), vonHalskyDescription: clean(vonHalskyPatch.vonHalskyDescription, 30_000),
      vonHalskyContentSource: 'agent-independent-von-halsky-content', vonHalskyContentUpdatedAt: preparedAt,
    } : { vonHalskyContentMode: 'custom' }),
  };
  return {
    product: {
      ...channelProduct,
      sourceMaterial,
      contentEditorial: { status, sourceRole: 'facts_only', channels: editorialTarget.channels, targets: { store: true, vonHalsky: true, allegro: true }, layoutPolicy: 'independent_channel_versions', promptVersion: PROMPT_VERSION, inputFingerprint: editorialFingerprint, preparedAt, channelStates, warnings },
      contentEditorialPreparedAt: preparedAt,
      contentEditorialSource: 'agent-specialists-independent-channel-content',
    },
    sourceMaterial, status, warnings, storeRun: runMeta(storeRun), allegroRun: runMeta(allegroRun), vonHalskyRun: runMeta(vonHalskyRun),
  };
}
