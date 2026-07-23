export function createProductLinkPackagePreparer({
  inspect, readSettings, offerSettings, centralProducts, recognizeProducer, chooseCategory,
  editorialize, prepareOffer, duplicates, shortDescription, text, sessionOf = () => null,
} = {}) {
  if (![inspect, readSettings, offerSettings, centralProducts, recognizeProducer, chooseCategory, editorialize, prepareOffer, duplicates, shortDescription, text].every((fn) => typeof fn === 'function')) throw new Error('Pakiet produktu z linku wymaga kompletu usług domenowych.');
  return async function prepareProductLinkPackage(req, target = '', options = {}) {
    const inspected = await inspect(target), alternatives = Array.isArray(inspected.alternatives) ? inspected.alternatives : [], choice = Number.isInteger(options.choice) ? options.choice : null;
    if (inspected.needsChoice && (choice === null || !alternatives[choice])) return { ...inspected, workflow: { stage: 'needs_choice', readyForStore: false, readyForAllegro: false, blockers: ['wybierz właściwy produkt ze znalezionych wariantów'], nextAction: 'choose_product' } };
    const selected = choice !== null ? alternatives[choice] : null, sourceProduct = { ...(selected?.product || inspected.product || {}) };
    const canonicalUrl = text(selected?.url || inspected.canonicalUrl || inspected.resolvedUrl || target, 1000);
    sourceProduct.sourceUrl = canonicalUrl; sourceProduct.producentUrl = canonicalUrl;
    const [settingsRec, offerConfig] = await Promise.all([readSettings(), offerSettings()]);
    const data = settingsRec.data && typeof settingsRec.data === 'object' ? settingsRec.data : {}, products = centralProducts(data);
    const producer = recognizeProducer(sourceProduct, {}, offerConfig) || text(sourceProduct.producent || sourceProduct.marka, 160), category = chooseCategory(sourceProduct, products);
    const sourceBaseProduct = { ...sourceProduct, ...(producer ? { producent: producer, marka: sourceProduct.marka || producer } : {}), ...(category.name ? { kategoria: category.name } : {}) };
    const editorial = await editorialize(sourceBaseProduct, canonicalUrl, sessionOf(req) || { source: 'product-link-editorial' }), baseProduct = editorial.product;
    let offerPreparation = null, offerError = null;
    try { offerPreparation = await prepareOffer(req, baseProduct, { publicationAction: 'keep' }); }
    catch (error) { offerError = { message: text(error?.message || error, 700), code: text(error?.code || '', 120), status: Number(error?.status || 0) }; }
    const auto = offerPreparation?.autoFilled || {}, improved = offerPreparation?.improvedDescriptions || {};
    const product = {
      ...baseProduct,
      ...(!baseProduct.gtin && !baseProduct.ean && (auto.gtin || auto.ean) ? { gtin: auto.gtin || auto.ean, ean: auto.ean || auto.gtin } : {}),
      ...(!baseProduct.kodProducenta && !baseProduct.mpn && (auto.kodProducenta || auto.mpn) ? { kodProducenta: auto.kodProducenta || auto.mpn, mpn: auto.mpn || auto.kodProducenta } : {}),
      ...(!baseProduct.zdjecie && auto.zdjecie ? { zdjecie: auto.zdjecie } : {}),
      ...((!Array.isArray(baseProduct.zdjecia) || !baseProduct.zdjecia.length) && Array.isArray(auto.zdjecia) && auto.zdjecia.length ? { zdjecia: auto.zdjecia.slice(0, 15) } : {}),
      ...(auto.allegroProductId ? { allegroProductId: auto.allegroProductId } : {}), ...(auto.allegroCategoryId ? { allegroCategoryId: auto.allegroCategoryId } : {}),
      ...(Array.isArray(auto.allegroParameters) && auto.allegroParameters.length ? { allegroParameters: auto.allegroParameters } : {}),
      ...((baseProduct.allegroTitle || auto.allegroTitle) ? { allegroTitle: text(baseProduct.allegroTitle || auto.allegroTitle, 75) } : {}),
      ...(Array.isArray(improved.sections) && improved.sections.length ? { allegroDescriptionSections: improved.sections } : {}),
      opisKrotki: text(baseProduct.opisKrotki || improved.shortDescription || shortDescription(baseProduct.opis), 500), opis: text(baseProduct.opis || improved.fullDescription, 20000),
      agentImportSource: inspected.fromCache ? 'pamięć Agenta + katalog Allegro' : 'link producenta + katalog Allegro',
      agentImportConfidence: Number(selected?.confidence || inspected.confidence || 0), agentImportUrl: canonicalUrl,
    };
    const duplicateItems = duplicates(product, products), blockingDuplicate = duplicateItems.find((item) => item.blocking), blockers = [], warnings = [];
    if (!text(product.nazwa, 300)) blockers.push('brak nazwy');
    if (!(Number(product.cena) > 0)) blockers.push('brak poprawnej ceny');
    if (!text(product.kategoria, 180)) blockers.push('brak kategorii sklepu');
    if (blockingDuplicate) blockers.push(`produkt już istnieje w sklepie: #${blockingDuplicate.productId}`);
    if (!(product.gtin || product.ean || product.kodProducenta || product.mpn)) warnings.push('brak EAN i kodu producenta');
    if (!product.zdjecie) warnings.push('brak zdjęcia głównego');
    if (text(product.opisKrotki, 500).length < 40) warnings.push('krótki opis wymaga uzupełnienia');
    if (text(product.opis, 20000).length < 150) warnings.push('pełny opis wymaga uzupełnienia');
    if (!product.allegroCategoryId) warnings.push('nie dobrano kategorii Allegro');
    if (!product.allegroProductId) warnings.push('nie znaleziono produktu w katalogu Allegro');
    if (offerError) warnings.push(`Allegro: ${offerError.message}`);
    warnings.push(...editorial.warnings);
    const offerMissing = Array.isArray(offerPreparation?.missing) ? offerPreparation.missing : [], readyForStore = !blockers.length, readyForAllegro = readyForStore && !offerError && !offerMissing.length && !!product.allegroCategoryId;
    return {
      ...inspected, needsChoice: false, product, selectedChoice: choice,
      confidence: Math.max(Number(inspected.confidence || 0), Number(selected?.confidence || 0)),
      sourceMissing: Array.isArray(inspected.missing) ? inspected.missing : [],
      editorial: { status: editorial.status, sourceRole: 'facts_only', storeRun: editorial.storeRun, allegroRun: editorial.allegroRun, warnings: editorial.warnings },
      missing: [...new Set([...blockers, ...warnings])], duplicateAudit: { blocking: !!blockingDuplicate, selected: blockingDuplicate || null, items: duplicateItems }, storeCategory: category,
      allegroPreparation: offerPreparation ? { categorySuggestion: offerPreparation.categorySuggestion || null, catalogMatch: offerPreparation.catalogMatch || null, existingOffer: offerPreparation.existingOffer || null, agentDecision: offerPreparation.agentDecision || null, missing: offerMissing, requiredParameters: offerPreparation.requiredParameters || [], supportErrors: offerPreparation.supportErrors || [] } : null,
      workflow: { stage: blockingDuplicate ? 'duplicate' : readyForAllegro ? 'ready' : readyForStore ? 'store_ready' : 'incomplete', readyForStore, readyForAllegro, blockers, warnings, nextAction: blockingDuplicate ? 'open_existing_product' : readyForAllegro ? 'review_and_save' : 'complete_missing_fields' },
    };
  };
}
