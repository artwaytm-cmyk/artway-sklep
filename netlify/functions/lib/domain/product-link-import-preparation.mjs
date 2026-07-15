const asArray = (value) => Array.isArray(value) ? value : [];

export function createProductLinkImportPreparer({
  readSettings, catalog, centralProducts, inspect, offerSettings, recognizeProducer,
  chooseCategory, shortDescription, text, now = () => new Date(),
} = {}) {
  if (typeof readSettings !== 'function' || !catalog || typeof centralProducts !== 'function' || typeof inspect !== 'function') {
    throw new Error('Przygotowanie importu wymaga katalogu i odczytu źródła.');
  }
  return async function prepareProductLinkImport(target = '') {
    const settingsRecord = await readSettings(), data = settingsRecord?.data && typeof settingsRecord.data === 'object' ? settingsRecord.data : {};
    const central = centralProducts(data), deleted = asArray(data.artway_kosz_dodane);
    const extraProducts = [...central.values(), ...deleted].filter((item) => item && typeof item === 'object');
    const known = await catalog.findDuplicate({ sourceUrl: target, producentUrl: target }, { sourceUrl: target, extraProducts });
    if (known) return { product: { sourceUrl: target, producentUrl: target, producent: 'Alexander', nazwa: known.product?.nazwa || 'Istniejący produkt' }, extraProducts };

    const inspected = await inspect(target), alternatives = asArray(inspected.alternatives);
    if (inspected.needsChoice && alternatives.length > 1) return { needsReview: true, reviewReason: `Źródło zwróciło ${alternatives.length} różne warianty. Wybierz właściwy produkt ręcznie.` };
    const sourceProduct = { ...(alternatives[0]?.product || inspected.product || {}) };
    const canonicalUrl = text(alternatives[0]?.url || inspected.canonicalUrl || inspected.resolvedUrl || target, 1000);
    sourceProduct.sourceUrl = canonicalUrl; sourceProduct.producentUrl = canonicalUrl;
    const imported = await catalog.list(), products = new Map(central);
    for (const item of imported) if (item?.id !== undefined) products.set(String(item.id), item);
    const producer = recognizeProducer(sourceProduct, {}, await offerSettings()) || text(sourceProduct.producent || sourceProduct.marka || 'Alexander', 160) || 'Alexander';
    const category = chooseCategory(sourceProduct, products), description = text(sourceProduct.opis, 20000);
    const timestamp = now().toISOString();
    const product = {
      ...sourceProduct, producent: producer, marka: text(sourceProduct.marka || producer, 160),
      kategoria: text(category.name || sourceProduct.kategoria, 180),
      opisKrotki: text(sourceProduct.opisKrotki || shortDescription(description), 500), opis: description,
      ikona: text(sourceProduct.ikona || '🎲', 20), kolor: text(sourceProduct.kolor || '#dbeafe', 30),
      sourceUrl: canonicalUrl, producentUrl: canonicalUrl, agentImportAt: timestamp,
      agentImportSource: inspected.fromCache ? 'pamięć Agenta — import z pliku linków' : 'link producenta — import z pliku linków',
      agentImportConfidence: Number(alternatives[0]?.confidence || inspected.confidence || 0),
      agentImportUrl: canonicalUrl, createdAt: timestamp, createdBy: 'import pliku linków',
    };
    const missing = [];
    if (!text(product.nazwa, 300)) missing.push('nazwy');
    if (!(Number(product.cena) > 0)) missing.push('ceny sprzedaży');
    if (!text(product.kategoria, 180)) missing.push('kategorii sklepu');
    if (!canonicalUrl) missing.push('kanonicznego linku źródłowego');
    if (missing.length) return { needsReview: true, reviewReason: `Nie udało się pewnie ustalić: ${missing.join(', ')}.`, product };
    return { product, extraProducts };
  };
}
