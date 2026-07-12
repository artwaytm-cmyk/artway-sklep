// Harmonogram: okresowe pobieranie ofert i odtwarzanie ich powiązań z produktami sklepu.
// Dane produktu zapisane w sklepie są wysyłane do powiązanej oferty już przy zapisie;
// ten przebieg kontrolny co 6 godzin odświeża oferty, katalog, kategorie,
// producentów i opisy sklepu pochodzące z wiarygodnie powiązanych ofert Allegro.
export const config = { schedule: '25 */6 * * *' };

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'https://artwaytm.pl';
  const token = process.env.ARTWAY_ADMIN_TOKEN || '';
  if (!token) {
    console.log('cron-allegro-offers: brak ARTWAY_ADMIN_TOKEN — pomijam');
    return new Response('no token');
  }
  try {
    const response = await fetch(`${base}/.netlify/functions/store?action=allegro-sync-offers`, {
      method: 'POST',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 10000, details: true, detailsLimit: 1000, source: 'scheduled-offers-sync' }),
    });
    const body = await response.text();
    console.log('cron-allegro-offers', response.status, body.slice(0, 900));
  } catch (e) {
    console.log('cron-allegro-offers error', e && e.message ? e.message : String(e));
  }
  return new Response('ok');
};
