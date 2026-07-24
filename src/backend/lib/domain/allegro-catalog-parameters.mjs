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

