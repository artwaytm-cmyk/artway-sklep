// Harmonogram: automatyczne pobieranie Centrum wiadomości Allegro oraz Dyskusji/Reklamacji.
// Uruchamia się co 15 minut i woła store?action=allegro-sync-communications.
// Autoresponder wysyła odpowiedź tylko raz na pierwszy kontakt klienta. Backend
// zapisuje trwały klucz {typ}:{id}:first-contact i odrzuca każdą kolejną wiadomość.
export const config = { schedule: '*/15 * * * *' };

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || 'https://artwaytm.pl';
  const token = process.env.ARTWAY_ADMIN_TOKEN || '';
  if (!token) {
    console.log('cron-allegro-communications: brak ARTWAY_ADMIN_TOKEN — pomijam');
    return new Response('no token');
  }
  try {
    const r = await fetch(`${base}/api/store?action=allegro-sync-communications`, {
      method: 'POST',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 20, autoReply: true }),
    });
    const t = await r.text();
    console.log('cron-allegro-communications', r.status, t.slice(0, 700));
  } catch (e) {
    console.log('cron-allegro-communications error', e && e.message ? e.message : String(e));
  }
  return new Response('ok');
};
