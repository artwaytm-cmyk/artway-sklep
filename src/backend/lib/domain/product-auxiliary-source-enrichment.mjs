const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];
const clean = (value = '', limit = 500) => String(value ?? '').trim().slice(0, limit);
const usefulText = (value = '', minimum = 20) => clean(value, 50_000).replace(/\s+/g, ' ').length >= minimum;

export async function enrichProductFromAuxiliarySources({
  product: rawProduct = {},
  primaryUrl = '',
  inspectSource,
  limit = 8,
} = {}) {
  let product = { ...asObject(rawProduct) };
  const primaryGtin = clean(product.gtin || product.ean, 80).replace(/\D/g, '');
  const sources = asArray(product.auxiliarySources)
    .map(asObject)
    .filter((source) => /^https?:\/\//i.test(String(source.url || '')))
    .filter((source) => String(source.url) !== String(primaryUrl))
    .slice(0, Math.max(0, Math.min(20, Number(limit) || 8)));
  const evidence = [];
  const changedFields = new Set();

  for (const auxiliary of sources) {
    const inspected = await inspectSource(auxiliary.url).catch(() => null);
    const incoming = asObject(inspected?.product);
    if (!Object.keys(incoming).length) continue;
    const auxiliaryGtin = clean(incoming.gtin || incoming.ean, 80).replace(/\D/g, '');
    if (primaryGtin && auxiliaryGtin && primaryGtin !== auxiliaryGtin) {
      evidence.push({
        url: auxiliary.url,
        accepted: false,
        reason: 'EAN źródła pomocniczego nie odpowiada kartotece',
      });
      continue;
    }
    const sourceCode = clean(
      incoming.kodProducenta || incoming.numerReferencyjny || incoming.mpn || incoming.externalId || incoming.sku,
      160,
    );
    const fill = {
      gtin: incoming.gtin || incoming.ean,
      ean: incoming.ean || incoming.gtin,
      kodProducenta: sourceCode,
      mpn: sourceCode,
      externalId: sourceCode,
      sku: sourceCode,
      producent: incoming.producent || incoming.marka,
      marka: incoming.marka || incoming.producent,
    };
    const fields = [];
    for (const [field, value] of Object.entries(fill)) {
      if ((product[field] === undefined || product[field] === null || String(product[field]).trim() === '')
        && value !== undefined && value !== null && String(value).trim() !== '') {
        product[field] = value;
        fields.push(field);
        changedFields.add(field);
      }
    }
    const currentParameters = asObject(product.parametryZrodla);
    const incomingParameters = asObject(incoming.parametryZrodla || incoming.parametryProducenta);
    const mergedParameters = { ...incomingParameters, ...currentParameters };
    if (Object.keys(mergedParameters).length > Object.keys(currentParameters).length) {
      product.parametryZrodla = mergedParameters;
      fields.push('parametryZrodla');
      changedFields.add('parametryZrodla');
    }
    const currentSource = asObject(product.sourceMaterial);
    if (!usefulText(currentSource.longDescription, 150) && usefulText(incoming.opis, 150)) {
      product.sourceMaterial = {
        ...currentSource,
        longDescription: incoming.opis,
        shortDescription: currentSource.shortDescription || incoming.opisKrotki || '',
      };
      fields.push('sourceMaterial.longDescription');
      changedFields.add('sourceMaterial');
    }
    evidence.push({
      url: auxiliary.url,
      accepted: true,
      fields,
      inspectedAt: inspected?.checkedAt || new Date().toISOString(),
    });
  }

  if (evidence.length) {
    product.sourceMaterial = {
      ...asObject(product.sourceMaterial),
      auxiliaryEvidence: evidence,
    };
    changedFields.add('sourceMaterial');
  }
  return {
    product,
    evidence,
    changedFields: [...changedFields],
  };
}
