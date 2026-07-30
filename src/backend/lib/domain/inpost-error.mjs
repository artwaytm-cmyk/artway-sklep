export function inpostErrorDetails(value, prefix = '') {
  const result = [];
  const visit = (item, path) => {
    if (item == null) return;
    if (['string', 'number', 'boolean'].includes(typeof item)) {
      result.push({ field: path, message: String(item) });
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((entry) => visit(entry, path));
      return;
    }
    if (typeof item === 'object') {
      if (typeof item.message === 'string') {
        result.push({ field: String(item.field || path), message: item.message });
        return;
      }
      Object.entries(item).forEach(([key, entry]) => visit(entry, path ? `${path}.${key}` : key));
    }
  };
  visit(value, prefix);
  return result;
}

export function inpostErrorText(data, fallback = 'Błąd InPost') {
  if (!data) return fallback;
  const message = typeof data.message === 'string'
    ? data.message
    : typeof data.description === 'string'
      ? data.description
      : data.error
        ? `${data.error}${data.error_description ? `: ${data.error_description}` : ''}`
        : fallback;
  const details = inpostErrorDetails(data.details);
  const unique = [...new Set(details.map((item) => `${item.field ? `${item.field}: ` : ''}${item.message}`).filter(Boolean))];
  return unique.length ? `${message} (${unique.join('; ')})` : message;
}
