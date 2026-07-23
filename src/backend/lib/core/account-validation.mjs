export function normalizeAccountEmail(value = '') {
  return String(value ?? '').trim().toLowerCase().slice(0, 200);
}

export function isValidAccountEmail(value = '') {
  const email = normalizeAccountEmail(value);
  const parts = email.split('@');
  const domain = parts[1] || '';
  return email.length > 2
    && parts.length === 2
    && parts[0].length > 0
    && domain.includes('.')
    && !/\s/.test(email)
    && !domain.startsWith('.')
    && !domain.endsWith('.');
}
