// Codzienny, bezpłatny plan SEO. Limit i możliwość wyłączenia są zapisane
// w panelu Pozycjonowanie → Ustawienia. Domyślnie opracowuje 5 produktów.
export const config = { schedule: '15 4 * * *' };

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'https://artwaytm.pl';
  const token = process.env.ARTWAY_ADMIN_TOKEN || '';
  if (!token) {
    console.log('cron-seo-daily: brak ARTWAY_ADMIN_TOKEN — pomijam');
    return new Response('no token');
  }
  try {
    const response = await fetch(`${base}/.netlify/functions/store?action=seo-daily-run`, {
      method: 'POST',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'scheduled-seo-daily' }),
    });
    const body = await response.text();
    console.log('cron-seo-daily', response.status, body.slice(0, 900));
  } catch (error) {
    console.log('cron-seo-daily error', error?.message || String(error));
  }
  return new Response('ok');
};
