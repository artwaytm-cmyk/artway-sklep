// Agent AI wyrywkowo sprawdza linki źródłowe producentów co 6 godzin.
// Najpierw wybierane są bestsellery Allegro/sklepu i produkty z aktywnych
// zamówień, a resztę próbki stanowią najdłużej niesprawdzane pozycje.
// Dokładna ilość jest zapisywana tylko wtedy, gdy źródło ją ujawnia.
export const config = { schedule: '40 */6 * * *' };

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'https://artwaytm.pl';
  const token = process.env.ARTWAY_ADMIN_TOKEN || '';
  if (!token) {
    console.log('cron-supplier-availability: brak ARTWAY_ADMIN_TOKEN — pomijam');
    return new Response('no token');
  }
  try {
    const response = await fetch(`${base}/api/store?action=supplier-availability-sample`, {
      method: 'POST',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'scheduled-supplier-availability' }),
    });
    const body = await response.text();
    console.log('cron-supplier-availability', response.status, body.slice(0, 900));
  } catch (e) {
    console.log('cron-supplier-availability error', e && e.message ? e.message : String(e));
  }
  return new Response('ok');
};
