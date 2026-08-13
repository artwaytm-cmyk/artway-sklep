import { synchronizeProductIdentifierAliases } from './product-identifiers.mjs';
import { canonicalManufacturerName } from './product-field-validation.mjs';

const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function createProductLinkImportPreparer({
  readSettings, catalog, centralProducts, inspect, offerSettings, recognizeProducer,
  chooseCategory, shortDescription, editorialize, text, now = () => new Date(),
} = {}) {
  if (typeof readSettings !== 'function' || !catalog || typeof centralProducts !== 'function' || typeof inspect !== 'function') {
    throw new Error('Przygotowanie importu wymaga katalogu i odczytu źródła.');
  }
  return async function prepareProductLinkImport(target = '', options = {}) {
    const settingsRecord = await readSettings(), data = settingsRecord?.data && typeof settingsRecord.data === 'object' ? settingsRecord.data : {};
    const central = await centralProducts(data);
    const extraProducts = [...central.values()].filter((item) => item && typeof item === 'object');
    const known = await catalog.findDuplicate({ sourceUrl: target, producentUrl: target }, { sourceUrl: target, extraProducts });
    if (known && options.updateExisting !== true) return { product: {
      sourceUrl: target,
      producentUrl: target,
      producent: canonicalManufacturerName(known.product?.producent || known.product?.marka),
      marka: canonicalManufacturerName(known.product?.marka || known.product?.producent),
      nazwa: known.product?.nazwa || 'Istniejący produkt',
    }, extraProducts };

    const inspected = await inspect(target), alternatives = asArray(inspected.alternatives);
    if (inspected.needsChoice && alternatives.length > 1) return { needsReview: true, reviewReason: `Źródło zwróciło ${alternatives.length} różne warianty. Wybierz właściwy produkt ręcznie.` };
    const sourceProduct = { ...(alternatives[0]?.product || inspected.product || {}) };
    const fileData = asObject(options.fileData);
    const spreadsheetName = text(fileData.nazwa || options.name, 500);
    const spreadsheetProducer = canonicalManufacturerName(fileData.producent || fileData.marka);
    const spreadsheetBrand = canonicalManufacturerName(fileData.marka || fileData.producent);
    const spreadsheetPrice = Number(fileData.cena) > 0 ? Math.round(Number(fileData.cena) * 100) / 100 : 0;
    const spreadsheetOverrides = {};
    for (const [field, max] of Object.entries({
      nazwa: 500, kategoria: 180, opisKrotki: 500, opis: 6000, zdjecie: 3000,
      ean: 40, gtin: 40, sku: 160, externalId: 160, kodProducenta: 160, mpn: 160,
      material: 300, kolorProduktu: 200, waga: 120, dlugosc: 120, szerokosc: 120, wysokosc: 120,
      minimalnyWiek: 120, liczbaElementow: 120, vonHalskyCategoryId: 100,
      vonHalskySafetyInformation: 100_000,
    })) {
      const value = field === 'nazwa' ? spreadsheetName : text(fileData[field], max);
      if (value) spreadsheetOverrides[field] = value;
    }
    if (spreadsheetPrice > 0) spreadsheetOverrides.cena = spreadsheetPrice;
    for (const field of ['cenaZakupu', 'cenaAllegro', 'cenaVonHalsky']) {
      const value = Number(fileData[field]);
      if (value > 0) spreadsheetOverrides[field] = Math.round(value * 100) / 100;
    }
    if (spreadsheetOverrides.cenaZakupu > 0) spreadsheetOverrides.cenaZakupuPrywatna = true;
    if (spreadsheetProducer) spreadsheetOverrides.producent = spreadsheetProducer;
    if (spreadsheetBrand) spreadsheetOverrides.marka = spreadsheetBrand;
    const spreadsheetParameters = Object.fromEntries([
      ['Minimalny wiek dziecka', fileData.minimalnyWiek],
      ['Liczba elementów', fileData.liczbaElementow],
      ['Materiał', fileData.material],
      ['Kolor produktu', fileData.kolorProduktu],
      ['Waga produktu', fileData.waga],
      ['Długość produktu', fileData.dlugosc],
      ['Szerokość produktu', fileData.szerokosc],
      ['Wysokość produktu', fileData.wysokosc],
    ].map(([name, value]) => [name, text(value, 500)]).filter(([, value]) => value));
    const spreadsheetGpsr = {
      legalName: text(fileData.gpsrNazwa, 300),
      address: text(fileData.gpsrAdres, 500),
      email: text(fileData.gpsrEmail, 320).toLowerCase(),
      phone: text(fileData.gpsrTelefon, 80),
      source: 'spreadsheet-import',
    };
    if (spreadsheetGpsr.legalName || spreadsheetGpsr.address || spreadsheetGpsr.email || spreadsheetGpsr.phone) {
      spreadsheetOverrides.vonHalskyResponsibleProducer = spreadsheetGpsr;
    }
    const canonicalUrl = text(alternatives[0]?.url || inspected.canonicalUrl || inspected.resolvedUrl || target, 1000);
    sourceProduct.sourceUrl = canonicalUrl; sourceProduct.producentUrl = canonicalUrl;
    const imported = await catalog.list(), products = new Map(central);
    for (const item of imported) if (item?.id !== undefined) products.set(String(item.id), item);
    const sourceProducer = canonicalManufacturerName(recognizeProducer(sourceProduct, {}, await offerSettings()) || sourceProduct.producent || sourceProduct.marka);
    const producer = spreadsheetProducer || sourceProducer;
    const category = chooseCategory(sourceProduct, products), description = text(sourceProduct.opis, 20000);
    const timestamp = now().toISOString();
    const existing = known?.product && typeof known.product === 'object' ? known.product : {};
    const baseProduct = synchronizeProductIdentifierAliases({
      ...sourceProduct, ...spreadsheetOverrides, producent: producer, marka: spreadsheetBrand || canonicalManufacturerName(sourceProduct.marka || producer),
      parametryZrodla: { ...asObject(sourceProduct.parametryZrodla), ...spreadsheetParameters },
      kategoria: text(fileData.kategoria || category.name || sourceProduct.kategoria, 180),
      opisKrotki: text(fileData.opisKrotki || sourceProduct.opisKrotki || existing.opisKrotki || shortDescription(text(fileData.opis, 6000) || description || existing.opis), 500),
      opis: text(fileData.opis, 6000) || description || existing.opis || '',
      cena: spreadsheetPrice || (Number(sourceProduct.cena) > 0 ? Number(sourceProduct.cena) : Number(existing.cena) || ''),
      ikona: text(sourceProduct.ikona || '🎲', 20), kolor: text(sourceProduct.kolor || '#dbeafe', 30),
      sourceUrl: canonicalUrl, producentUrl: canonicalUrl, agentImportAt: timestamp,
      agentImportSource: inspected.fromCache ? 'pamięć Agenta — import z pliku linków' : 'link producenta — import z pliku linków',
      agentImportConfidence: Number(alternatives[0]?.confidence || inspected.confidence || 0),
      agentImportUrl: canonicalUrl, createdAt: timestamp, createdBy: 'import pliku linków',
    });
    const editorial = typeof editorialize === 'function' ? await editorialize(baseProduct, canonicalUrl) : null;
    const product = synchronizeProductIdentifierAliases({
      ...(editorial?.product || baseProduct),
      ...spreadsheetOverrides,
      parametryZrodla: { ...asObject(editorial?.product?.parametryZrodla || baseProduct.parametryZrodla), ...spreadsheetParameters },
      ...(spreadsheetProducer ? { producent: spreadsheetProducer } : {}),
      ...(spreadsheetBrand ? { marka: spreadsheetBrand } : {}),
      sourceUrl: canonicalUrl,
      producentUrl: canonicalUrl,
    });
    const missing = [];
    if (!text(product.nazwa, 300)) missing.push('nazwy');
    if (!(Number(product.cena) > 0)) missing.push('ceny sprzedaży');
    if (!canonicalManufacturerName(product.producent || product.marka)) missing.push('producenta lub marki');
    if (!text(product.kategoria, 180)) missing.push('kategorii sklepu');
    if (!canonicalUrl) missing.push('kanonicznego linku źródłowego');
    if (missing.length) return { needsReview: true, reviewReason: `Nie udało się pewnie ustalić: ${missing.join(', ')}.`, product, existingProduct: known?.product || null, updateExisting: !!known && options.updateExisting === true };
    return { product, extraProducts, existingProduct: known?.product || null, updateExisting: !!known && options.updateExisting === true };
  };
}
