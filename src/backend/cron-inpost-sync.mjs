// Harmonogram: automatyczne sprawdzanie statusów wszystkich przesyłek InPost.
// Uruchamia się automatycznie z harmonogramu systemd na serwerze VPS.
// inpost-sync-all w store.mjs, która pobiera statusy z InPost, aktualizuje zamówienia
// i wysyła automatyczne e-maile (nadanie/dostarczenie/problem).
export const config = { schedule: '0 */6 * * *' }; // 00:00, 06:00, 12:00, 18:00 UTC

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'https://artwaytm.pl';
  const token = process.env.ARTWAY_ADMIN_TOKEN || '';
  if (!token) {
    console.log('cron-inpost-sync: brak ARTWAY_ADMIN_TOKEN — pomijam');
    return new Response('no token');
  }
  try {
    const r = await fetch(`${base}/api/store?action=inpost-sync-all`, {
      method: 'POST',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: '{}',
    });
    const t = await r.text();
    console.log('cron-inpost-sync', r.status, t.slice(0, 500));
  } catch (e) {
    console.log('cron-inpost-sync error', e && e.message ? e.message : String(e));
  }
  return new Response('ok');
};
