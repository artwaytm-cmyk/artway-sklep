// Codzienny, bezpłatny plan SEO i kontrola jakości katalogu. Limit SEO oraz
// możliwość jego wyłączenia są zapisane w panelu Pozycjonowanie → Ustawienia.
export const config = { schedule: '15 4 * * *' };

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'https://artwaytm.pl';
  const token = process.env.ARTWAY_ADMIN_TOKEN || '';
  if (!token) {
    console.log('cron-seo-daily: brak ARTWAY_ADMIN_TOKEN — pomijam');
    return new Response('no token');
  }
  try {
    const headers = { 'x-admin-token': token, 'content-type': 'application/json' };
    // Obie operacje zapisują wspólne ustawienia, dlatego wykonujemy je kolejno,
    // aby kontrola jakości nie nadpisała świeżej rewizji przygotowanej przez SEO.
    const seoResponse = await fetch(`${base}/.netlify/functions/store?action=seo-daily-run`, {
      method: 'POST', headers, body: JSON.stringify({ source: 'scheduled-seo-daily' }),
    });
    const qualityResponse = await fetch(`${base}/.netlify/functions/store?action=catalog-quality-audit`, {
      method: 'POST', headers, body: JSON.stringify({ source: 'scheduled-catalog-quality', fixSafe: true, quarantineOrphans: true }),
    });
    const [seoBody, qualityBody] = await Promise.all([seoResponse.text(), qualityResponse.text()]);
    console.log('cron-seo-daily', seoResponse.status, seoBody.slice(0, 700));
    console.log('cron-catalog-quality', qualityResponse.status, qualityBody.slice(0, 700));
  } catch (error) {
    console.log('cron-seo-daily error', error?.message || String(error));
  }
  return new Response('ok');
};
