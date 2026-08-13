const normalize = (value = '') => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const valueOf = (parameter = {}) => {
  const values = Array.isArray(parameter?.values) && parameter.values.length
    ? parameter.values
    : Array.isArray(parameter?.valuesLabels) ? parameter.valuesLabels : [];
  const value = values.length ? values.join(', ') : (parameter?.value ?? parameter?.rangeValue?.from ?? '');
  return String(value ?? '').trim().slice(0, 300);
};

export function allegroCatalogParameterValue(record = {}, aliases = []) {
  const expected = new Set((Array.isArray(aliases) ? aliases : []).map(normalize).filter(Boolean));
  if (!expected.size) return '';
  for (const parameter of Array.isArray(record?.parameters) ? record.parameters : []) {
    const parameterName = normalize(parameter?.name || parameter?.id || '');
    // Nazwy pól katalogowych muszą być dopasowane semantycznie dokładnie.
    // "Kod producenta" nie jest "Producentem", a taki częściowy match
    // wcześniej odrzucał poprawny produkt znaleziony po dokładnym EAN.
    if (!expected.has(parameterName)) continue;
    const value = valueOf(parameter);
    if (value) return value;
  }
  return '';
}

export function allegroCatalogProductReference({
  catalogProductId = '', categoryId = '', gtin = '', name = '', parameters = [], images = [],
} = {}) {
  const catalogId = String(catalogProductId || '').trim().slice(0, 120);
  const productParameters = Array.isArray(parameters) ? parameters.filter(Boolean) : [];
  if (catalogId) {
    return {
      id: catalogId,
      ...(productParameters.length ? { parameters: productParameters } : {}),
    };
  }
  const canonicalGtin = String(gtin || '').replace(/\D/g, '').slice(0, 18);
  if (!categoryId && canonicalGtin) return { id: canonicalGtin, idType: 'GTIN' };
  return {
    name: String(name || '').trim().slice(0, 75),
    ...(categoryId ? { category: { id: String(categoryId).trim().slice(0, 80) } } : {}),
    parameters: productParameters,
    images: (Array.isArray(images) ? images : []).filter(Boolean).slice(0, 16),
  };
}

export function allegroCatalogProductParameterAssessment(record = {}, categoryParameters = []) {
  const schemas = Array.isArray(categoryParameters) ? categoryParameters : [];
  const allowed = new Set(schemas
    .map((parameter) => String(parameter?.id || '').trim())
    .filter(Boolean));
  const schemaById = new Map(schemas.map((parameter) => [String(parameter?.id || '').trim(), parameter]));
  const payloads = (Array.isArray(record?.parameters) ? record.parameters : [])
    .map((parameter) => {
      const id = String(parameter?.id || '').trim().slice(0, 80);
      if (!id || (allowed.size && !allowed.has(id))) return null;
      const valuesIds = Array.isArray(parameter?.valuesIds)
        ? parameter.valuesIds.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      const values = Array.isArray(parameter?.values)
        ? parameter.values.map((value) => String(value ?? '').trim()).filter(Boolean)
        : [];
      const rangeValue = parameter?.rangeValue && typeof parameter.rangeValue === 'object'
        ? parameter.rangeValue
        : null;
      if (valuesIds.length) return { id, valuesIds };
      if (values.length) return { id, values };
      if (rangeValue) return { id, rangeValue };
      return null;
    })
    .filter(Boolean);

  const selectedValueIds = new Map(payloads.map((payload) => {
    const schema = schemaById.get(payload.id) || {};
    const dictionary = Array.isArray(schema?.dictionary) ? schema.dictionary : [];
    const labels = new Set((Array.isArray(payload.values) ? payload.values : []).map(normalize));
    const valuesIds = [
      ...(Array.isArray(payload.valuesIds) ? payload.valuesIds : []),
      ...dictionary.filter((value) => labels.has(normalize(value?.value))).map((value) => String(value?.id || '').trim()),
    ].filter(Boolean);
    return [payload.id, new Set(valuesIds)];
  }));

  const incompatibleParameterIds = new Set();
  const parameters = payloads.map((payload) => {
    const schema = schemaById.get(payload.id) || {};
    const parentId = String(schema?.options?.dependsOnParameterId || schema?.dependsOnParameterId || '').trim();
    const parentValueIds = selectedValueIds.get(parentId);
    if (!parentId || !parentValueIds?.size) return payload;
    const dictionary = Array.isArray(schema?.dictionary) ? schema.dictionary : [];
    const valueById = new Map(dictionary.map((value) => [String(value?.id || '').trim(), value]));
    const valueByLabel = new Map(dictionary.map((value) => [normalize(value?.value), value]));
    const compatible = (dictionaryValue) => {
      const dependencies = Array.isArray(dictionaryValue?.dependsOnValueIds)
        ? dictionaryValue.dependsOnValueIds.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      return !dependencies.length || dependencies.some((value) => parentValueIds.has(value));
    };
    if (Array.isArray(payload.valuesIds)) {
      const valuesIds = payload.valuesIds.filter((value) => compatible(valueById.get(value)));
      if (valuesIds.length !== payload.valuesIds.length) incompatibleParameterIds.add(payload.id);
      return valuesIds.length ? { ...payload, valuesIds } : null;
    }
    if (Array.isArray(payload.values)) {
      const values = payload.values.filter((value) => compatible(valueByLabel.get(normalize(value))));
      if (values.length !== payload.values.length) incompatibleParameterIds.add(payload.id);
      return values.length ? { ...payload, values } : null;
    }
    return payload;
  }).filter(Boolean);
  return { parameters, incompatibleParameterIds: [...incompatibleParameterIds] };
}

export function allegroCatalogProductParameterPayloads(record = {}, categoryParameters = []) {
  return allegroCatalogProductParameterAssessment(record, categoryParameters).parameters;
}
