// Lekka synchronizacja listy ofert Allegro. Co 15 minut wykrywa nowe, zakończone
// i zmienione oferty bez pobierania kosztownych szczegółów każdej pozycji.
// Pełna konserwacja katalogu, opisów i kategorii pozostaje w osobnym przebiegu co 6 godzin.
export const config = { schedule: '10,25,40,55 * * * *' };

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'https://artwaytm.pl';
  const token = process.env.ARTWAY_ADMIN_TOKEN || '';
  if (!token) {
    console.log('cron-allegro-catalog: brak ARTWAY_ADMIN_TOKEN — pomijam');
    return new Response('no token');
  }
  try {
    const response = await fetch(`${base}/api/store?action=allegro-sync-offers`, {
      method: 'POST',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 10000, details: false, source: 'scheduled-catalog-refresh' }),
    });
    const body = await response.text();
    console.log('cron-allegro-catalog', response.status, body.slice(0, 900));
  } catch (e) {
    console.log('cron-allegro-catalog error', e && e.message ? e.message : String(e));
  }
  return new Response('ok');
};
