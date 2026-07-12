// Godzinne sprawdzenie asynchronicznych zadań inFakt.
// Harmonogram nie wystawia dokumentów samodzielnie — wyłącznie aktualizuje status
// faktur utworzonych wcześniej i zatwierdzonych w panelu administratora.
export const config = { schedule: '17 * * * *' };

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'https://artwaytm.pl';
  const token = process.env.ARTWAY_ADMIN_TOKEN || '';
  if (!token || !process.env.INFAKT_API_KEY) {
    console.log('cron-infakt-sync: brak ARTWAY_ADMIN_TOKEN lub INFAKT_API_KEY — pomijam');
    return new Response('not configured');
  }
  try {
    const response = await fetch(`${base}/.netlify/functions/store?action=infakt-sync`, {
      method: 'POST',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: '{}',
    });
    const body = await response.text();
    console.log('cron-infakt-sync', response.status, body.slice(0, 900));
  } catch (error) {
    console.log('cron-infakt-sync error', error?.message || String(error));
  }
  return new Response('ok');
};
