// Harmonogram: pobieranie nowych zamówień Allegro i uruchamianie agenta magazynowego.
// Agent rozpoznaje produkt, sprawdza stan/lokalizację oraz dopisuje realny brak
// do właściwego szkicu zamówienia producenta. Oficjalny status pozostaje z Allegro.
export const config = { schedule: '5,20,35,50 * * * *' };

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'https://artwaytm.pl';
  const token = process.env.ARTWAY_ADMIN_TOKEN || '';
  if (!token) {
    console.log('cron-allegro-orders: brak ARTWAY_ADMIN_TOKEN — pomijam');
    return new Response('no token');
  }
  try {
    const response = await fetch(`${base}/api/store?action=allegro-sync-orders`, {
      method: 'POST',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 200, source: 'scheduled-stock-agent' }),
    });
    const body = await response.text();
    console.log('cron-allegro-orders', response.status, body.slice(0, 900));
  } catch (e) {
    console.log('cron-allegro-orders error', e && e.message ? e.message : String(e));
  }
  return new Response('ok');
};
