export const config = { schedule: '*/15 * * * *' };

export default async (request) => {
  const token = String(process.env.ARTWAY_ADMIN_TOKEN || '').trim();
  if (!token || !process.env.TELEGRAM_BOT_TOKEN) {
    console.log('cron-telegram-center: brak konfiguracji — pomijam');
    return new Response('ok');
  }
  try {
    const origin = new URL(request.url).origin;
    const result = await fetch(`${origin}/api/store?action=telegram-dispatch`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ source: 'scheduled-telegram-center' }),
    });
    const body = await result.text();
    console.log('cron-telegram-center', result.status, body.slice(0, 900));
  } catch (error) {
    console.log('cron-telegram-center error', error?.message || String(error));
  }
  return new Response('ok');
};
