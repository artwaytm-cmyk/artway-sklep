export function odpowiedz(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, x-admin-token',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
  });
}

export function odpowiedzHtml(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function bezpiecznePorownanie(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

export function tokenZadania(request, url) {
  return request.headers.get('x-admin-token') || url.searchParams.get('token') || '';
}

export function czyAdmin(request, url) {
  const expected = process.env.ARTWAY_ADMIN_TOKEN || '';
  return !!expected && bezpiecznePorownanie(tokenZadania(request, url), expected);
}

export function tekst(value, max = 200) {
  return String(value == null ? '' : value).slice(0, max);
}
