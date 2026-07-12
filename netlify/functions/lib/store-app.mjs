// Artway-TM — wspólna baza sklepu na Netlify Blobs
// Funkcja serwerowa: ustawienia, zamówienia, klienci — widoczne na każdym urządzeniu.
// Endpoint: /.netlify/functions/store  (alias /api/store)
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

const STORE_NAME = 'artway-sklep';

// Klucze wspólne (konfiguracja + katalog + ceny + stany + opinie + kosz) — zapisywane przez administratora,
// czytane przez wszystkich (żeby sklep wyglądał tak samo na każdym urządzeniu).
const KLUCZE_WSPOLNE = [
  'artway_ustawienia',
  'artway_produkty_dodane',
  'artway_produkty_edytowane',
  'artway_produkty_katalog',
  'artway_produkty_ukryte',
  'artway_produkty_definitywne',
  'artway_stany',
  'artway_dostepnosc',
  'artway_ruchy_magazynowe',
  'artway_magazyn_ustawienia',
  'artway_magazyn_produkty',
  'artway_magazyn_lokalizacje',
  'artway_faktury_szkice',
  'artway_agent_ai_historia',
  'artway_agent_ai_pamiec',
  'artway_agent_ai_zlecenia',
  'artway_producenci',
  'artway_agent_ai_linki_producentow',
  'artway_agent_ai_allegro_zadania',
  'artway_opinie',
  'artway_kosz_dodane',
  'artway_kosz_meta',
];

const LIMIT_USTAWIEN = 4 * 1024 * 1024; // 4 MB na komplet ustawień
const LIMIT_ZAMOWIEN = 20000;
const LIMIT_KLIENTOW = 20000;
const LIMIT_USUNIETYCH_ZAMOWIEN = 50000;
const PAYNOW_ENVY = new Set(['production', 'sandbox']);
const PAYNOW_STATUSY_KONCOWE = new Set(['CONFIRMED', 'ERROR', 'EXPIRED', 'REJECTED', 'ABANDONED']);

function baza() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}
async function czytaj(klucz, domyslne) {
  try {
    const v = await baza().get(klucz, { type: 'json' });
    return (v === null || v === undefined) ? domyslne : v;
  } catch (e) {
    return domyslne;
  }
}
async function zapisz(klucz, wartosc) {
  await baza().setJSON(klucz, wartosc);
}

function odpowiedz(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, x-admin-token',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
  });
}
function odpowiedzHtml(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function bezpiecznePorownanie(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function tokenZadania(req, url) {
  return req.headers.get('x-admin-token') || url.searchParams.get('token') || '';
}
function czyAdmin(req, url) {
  const env = process.env.ARTWAY_ADMIN_TOKEN || '';
  if (!env) return false;
  return bezpiecznePorownanie(tokenZadania(req, url), env);
}

function tekst(v, max = 200) {
  return String(v == null ? '' : v).slice(0, max);
}
function telegramKonfiguracja() {
  return {
    token: tekst(process.env.TELEGRAM_BOT_TOKEN || '', 300).trim(),
    chatId: tekst(process.env.TELEGRAM_NOTIFY_CHAT_ID || process.env.TELEGRAM_GROUP_ID || process.env.TELEGRAM_CHAT_ID || '', 100).trim(),
  };
}
function telegramHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function telegramKomorka(v, width) {
  const s = String(v ?? '—').replace(/\s+/g, ' ').trim() || '—';
  return s.length > width ? `${s.slice(0, Math.max(1, width - 1))}…` : s.padEnd(width, ' ');
}
function telegramTabeleZlecenia(order = {}, tylkoDostawca = '') {
  const pozycje = (Array.isArray(order?.pozycje) ? order.pozycje : []).slice(0, 500).map((p) => ({
    kod: tekst(p?.kod || p?.produktId || '—', 80).trim(),
    nazwa: tekst(p?.nazwa || 'Produkt', 180).trim(),
    potrzeba: Math.max(0, Number(p?.iloscPotrzebna ?? p?.ilosc) || 0),
    dostawca: tekst(p?.dostawca || 'Bez przypisanego dostawcy', 120).trim() || 'Bez przypisanego dostawcy',
  })).filter((p) => !tylkoDostawca || p.dostawca === tylkoDostawca);
  const grupy = new Map();
  for (const p of pozycje) { if (!grupy.has(p.dostawca)) grupy.set(p.dostawca, []); grupy.get(p.dostawca).push(p); }
  const wiadomosci = [];
  for (const [dostawca, items] of grupy.entries()) {
    for (let offset = 0; offset < items.length; offset += 18) {
      const part = items.slice(offset, offset + 18);
      const tabela = [
        `${telegramKomorka('KOD', 15)} ${telegramKomorka('NAZWA', 30)} ${telegramKomorka('POTRZEBNA ILOŚĆ', 16)}`,
        `${'-'.repeat(15)} ${'-'.repeat(30)} ${'-'.repeat(16)}`,
        ...part.map((p) => `${telegramKomorka(p.kod, 15)} ${telegramKomorka(p.nazwa, 30)} ${telegramKomorka(p.potrzeba, 16)}`),
      ].join('\n');
      wiadomosci.push({
        supplier: dostawca,
        text: `<b>🧾 ${telegramHtml(order?.numer || order?.id || 'Zlecenie producenta')} — ${telegramHtml(dostawca)}</b>${items.length > 18 ? `\nCzęść ${Math.floor(offset / 18) + 1}/${Math.ceil(items.length / 18)}` : ''}\n\n<pre>${telegramHtml(tabela)}</pre>`,
      });
    }
  }
  return wiadomosci;
}
function producentEmailZlecenia(order = {}, supplier = {}) {
  const name = tekst(supplier.name || supplier.nazwa || '', 120).trim();
  const to = tekst(supplier.orderEmail || supplier.email || '', 300).trim().toLowerCase();
  const producerKey = (value = '') => tekst(value, 160).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const rows = (Array.isArray(order?.pozycje) ? order.pozycje : []).filter((p) => !name || producerKey(p?.dostawca) === producerKey(name)).map((p) => ({
    kod: tekst(p?.kod || p?.produktId || '—', 80).trim() || '—',
    ean: tekst(p?.ean || '—', 80).trim() || '—',
    nazwa: tekst(p?.nazwa || 'Produkt', 300).trim(),
    ilosc: Math.max(0, Number(p?.ilosc) || 0),
  })).filter((p) => p.ilosc > 0).slice(0, 500);
  const number = tekst(order?.numer || order?.id || 'zamówienie', 120).trim();
  const replace = (v = '') => tekst(v, 10000).replace(/\{numer\}/gi, number).replace(/\{producent\}/gi, name || 'Producent');
  const subject = replace(supplier.emailSubject || `Zamówienie ${number} — Artway-TM`);
  const intro = replace(supplier.emailIntro || `Dzień dobry,\nprzesyłamy zatwierdzone zamówienie ${number}. Prosimy o potwierdzenie dostępności, terminu realizacji i warunków dostawy.`);
  const textRows = rows.map((p, index) => `${index + 1}. ${p.kod} | ${p.ean} | ${p.nazwa} | ${p.ilosc} szt.`).join('\n');
  const text = `${intro}\n\nKOD | EAN | NAZWA | ILOŚĆ\n${textRows}\n\nProsimy o odpowiedź z potwierdzeniem przyjęcia zamówienia.\n\nPozdrawiamy\nArtway-TM`;
  const table = rows.map((p) => `<tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:700">${htmlEscape(p.kod)}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb">${htmlEscape(p.ean)}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb">${htmlEscape(p.nazwa)}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:800">${p.ilosc}</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#172033"><div style="max-width:760px;margin:0 auto;padding:28px 14px"><div style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;padding:24px;border-radius:18px 18px 0 0"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:700">Artway-TM • zamówienie do producenta</div><h1 style="margin:8px 0 0;font-size:26px">${htmlEscape(number)}</h1></div><div style="background:#fff;padding:24px;border-radius:0 0 18px 18px"><p style="white-space:pre-line;line-height:1.65;margin-top:0">${htmlEscape(intro)}</p><table style="width:100%;border-collapse:collapse;margin:20px 0"><thead><tr style="background:#eef2ff;text-align:left"><th style="padding:10px">Kod</th><th style="padding:10px">EAN</th><th style="padding:10px">Nazwa</th><th style="padding:10px;text-align:center">Ilość</th></tr></thead><tbody>${table}</tbody></table><div style="background:#f8fafc;border-left:4px solid #2563eb;padding:14px 16px;line-height:1.55">Prosimy o potwierdzenie przyjęcia zamówienia, dostępności produktów i przewidywanego terminu wysyłki.</div><p style="margin:24px 0 0">Pozdrawiamy serdecznie,<br><b>Artway-TM</b><br><a href="https://artwaytm.pl" style="color:#2563eb">artwaytm.pl</a></p></div></div></body></html>`;
  return { name, to, rows, subject, text, html };
}
async function wyslijTelegramHtml(text, options = {}) {
  const c = telegramKonfiguracja();
  if (!c.token || !c.chatId) {
    const e = new Error('Telegram nie jest skonfigurowany na serwerze. Ustaw TELEGRAM_BOT_TOKEN oraz TELEGRAM_GROUP_ID lub TELEGRAM_CHAT_ID.');
    e.code = 'telegram_not_configured'; e.status = 503; throw e;
  }
  const r = await fetch(`https://api.telegram.org/bot${c.token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: options.chatId || c.chatId, text: String(text || '').slice(0, 4090), parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: options.silent === true, ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}) }) });
  const dane = await r.json().catch(() => ({}));
  if (!r.ok || !dane.ok) { const e = new Error(tekst(dane?.description || `Telegram HTTP ${r.status}`, 500)); e.code = 'telegram_error'; e.status = r.status || 502; throw e; }
  return dane.result || {};
}
function agentZamowienieAktywne(z = {}) {
  return !['anulowane', 'dostarczone', 'zakończone', 'zwrot', 'zwrot pieniędzy'].includes(String(z.status || '').toLowerCase());
}
function agentPriorytetWykonawczy(priority = {}) {
  const area = tekst(priority.area, 80), title = tekst(priority.title, 260).toLowerCase();
  const definitions = {
    orders_start: { actionId: 'orders_start', execution: 'approval', requiresApproval: true, deadlineMinutes: 30, owner: 'obsługa zamówień', doneWhen: 'Każde nowe zamówienie ma rozpoczętą obsługę i sprawdzoną dostępność.' },
    allegro_reply: { actionId: 'allegro_reply', execution: 'approval', requiresApproval: true, deadlineMinutes: 60, owner: 'obsługa klienta', doneWhen: 'Klient otrzymał zatwierdzoną odpowiedź albo sprawa została zamknięta wewnętrznie.' },
    supplier_availability: { actionId: 'supplier_availability', execution: 'safe_check', requiresApproval: false, deadlineMinutes: 120, owner: 'Agent AI', doneWhen: 'Dostępność producenta została ponownie sprawdzona, a aktywne zamówienia mają decyzję.' },
    inpost_prepare: { actionId: 'inpost_prepare', execution: 'approval', requiresApproval: true, deadlineMinutes: 120, owner: 'centrum wysyłek', doneWhen: 'Przesyłka ma etykietę, numer nadania i zapisany status InPost.' },
    allegro_warehouse: { actionId: 'allegro_warehouse', execution: 'draft', requiresApproval: false, deadlineMinutes: 60, owner: 'Agent AI', doneWhen: 'Pozycje zlecenia są sprawdzone, a realne braki dopisane do szkicu producenta.' },
    allegro_offer_fix: { actionId: 'allegro_offer_fix', execution: 'approval', requiresApproval: true, deadlineMinutes: 240, owner: 'katalog Allegro', doneWhen: 'Oferta ma komplet danych i ostatnia operacja API zakończyła się sukcesem.' },
    supplier_order_draft: { actionId: 'supplier_order_draft', execution: 'draft', requiresApproval: false, deadlineMinutes: 240, owner: 'Agent AI', doneWhen: 'Bieżący dokument producenta zawiera wszystkie niepokryte braki i czeka na zatwierdzenie.' },
    invoice_draft: { actionId: 'invoice_draft', execution: 'draft', requiresApproval: false, deadlineMinutes: 240, owner: 'Agent AI / inFakt', doneWhen: 'Zamówienie firmowe ma szkic lub powiązaną fakturę inFakt.' },
    producer_link_check: { actionId: 'producer_link_check', execution: 'safe_check', requiresApproval: false, deadlineMinutes: 360, owner: 'Agent AI', doneWhen: 'Link został sprawdzony, a wynik i brakujące pola zapisane przy produkcie.' },
    site_function_check: { actionId: 'site_function_check', execution: 'safe_check', requiresApproval: false, deadlineMinutes: 15, owner: 'Agent AI', doneWhen: 'Baza oraz wszystkie wymagane integracje odpowiadają poprawnie.' },
    data_sync: { actionId: 'data_sync', execution: 'safe_check', requiresApproval: false, deadlineMinutes: 15, owner: 'Agent AI', doneWhen: 'Dane sklepu, Allegro, InPost i inFakt mają świeży znacznik synchronizacji.' },
  };
  let key = 'orders_start';
  if (area === 'system') key = 'site_function_check';
  else if (area === 'synchronizacja') key = 'data_sync';
  else if (title.includes('wiadomości') || title.includes('dyskusje')) key = 'allegro_reply';
  else if (title.includes('niedostępne u producenta') || title.includes('niski stan')) key = 'supplier_availability';
  else if (area === 'wysylki') key = 'inpost_prepare';
  else if (title.includes('zamówienia allegro')) key = 'allegro_warehouse';
  else if (title.includes('oferty allegro') || title.includes('operacja oferty')) key = 'allegro_offer_fix';
  else if (area === 'producenci') key = 'supplier_order_draft';
  else if (area === 'faktury') key = 'invoice_draft';
  else if (title.includes('linki producentów')) key = 'producer_link_check';
  return definitions[key];
}
async function agentCentrumOperacyjne() {
  const [settingsRec, ordersRec, allegroOrdersRec, communicationRec, offerErrorRec, infaktLinksRec] = await Promise.all([
    czytaj('settings', { data: {}, updated_at: null }), czytaj('orders', { items: [] }), czytaj('allegro_orders', { items: [] }),
    czytaj('allegro_communications', { threads: [], issues: [], updated_at: null }), czytaj('allegro_offer_last_error', null), czytaj('infakt_invoice_links', { items: {} }),
  ]);
  const data = settingsRec.data && typeof settingsRec.data === 'object' ? settingsRec.data : {};
  const orders = Array.isArray(ordersRec.items) ? ordersRec.items : [], activeOrders = orders.filter(agentZamowienieAktywne), newOrders = activeOrders.filter((x) => String(x.status || '').toLowerCase() === 'nowe');
  const shipmentsWithoutTracking = activeOrders.filter((x) => !tekst(x?.wysylka?.numer || x?.trackingNumber || '', 100).trim());
  const allegroOrders = Array.isArray(allegroOrdersRec.items) ? allegroOrdersRec.items : [], activeAllegro = allegroOrders.filter(allegroAgentZlecenieAktywne);
  const communications = [...(Array.isArray(communicationRec.threads) ? communicationRec.threads.map((x) => ({ ...x, type: 'thread' })) : []), ...(Array.isArray(communicationRec.issues) ? communicationRec.issues.map((x) => ({ ...x, type: 'issue' })) : [])];
  const communicationWaiting = communications.filter((x) => !x.internalResolved && (x.needsReply || x.humanReplyNeeded || Number(x.newIncomingCount || 0) > 0));
  const productMap = new Map(), addProduct = (p = {}) => { const id = tekst(p.id, 100).trim(); if (id) productMap.set(id, { ...(productMap.get(id) || {}), ...p, id }); };
  for (const p of Array.isArray(data.artway_produkty_katalog) ? data.artway_produkty_katalog : []) addProduct(p);
  for (const p of Array.isArray(data.artway_produkty_dodane) ? data.artway_produkty_dodane : []) addProduct(p);
  for (const [id, p] of Object.entries(data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? data.artway_produkty_edytowane : {})) addProduct({ ...(p || {}), id });
  const products = [...productMap.values()], supplierUnavailable = products.filter((p) => String(p.producentStatus || '').toLowerCase() === 'brak'), supplierLow = products.filter((p) => String(p.producentStatus || '').toLowerCase() === 'niski');
  const producerLinks = (Array.isArray(data.artway_agent_ai_linki_producentow) ? data.artway_agent_ai_linki_producentow : []).filter((x) => !['pobrano', 'zamkniete', 'zamknięte', 'usunieto', 'usunięto'].includes(String(x?.status || '').toLowerCase()));
  const offerTasks = (Array.isArray(data.artway_agent_ai_allegro_zadania) ? data.artway_agent_ai_allegro_zadania : []).filter((x) => !['zrealizowane', 'zamkniete', 'zamknięte', 'anulowane'].includes(String(x?.status || '').toLowerCase()));
  const supplierOrders = (Array.isArray(data.artway_agent_ai_zlecenia) ? data.artway_agent_ai_zlecenia : []).filter((x) => !['zrealizowane', 'anulowane', 'wysłane do producenta', 'wysłane do dostawcy'].includes(String(x?.status || '').toLowerCase()));
  const invoiceLinks = infaktLinksRec?.items && typeof infaktLinksRec.items === 'object' ? infaktLinksRec.items : {}, invoiceDrafts = Array.isArray(data.artway_faktury_szkice) ? data.artway_faktury_szkice : [];
  const companyOrdersWithoutInvoice = activeOrders.filter((x) => (x?.klient?.nip || x?.klient?.firma) && !invoiceLinks[numerZamowienia(x.nr)] && !invoiceDrafts.some((d) => numerZamowienia(d?.nrZamowienia) === numerZamowienia(x.nr)));
  const integrations = { email: !!emailPublicConfig().configured, telegram: !!(telegramKonfiguracja().token && telegramKonfiguracja().chatId), inpost: !!inpostPublicConfig().configured, allegro: !!(process.env.ALLEGRO_CLIENT_ID && process.env.ALLEGRO_CLIENT_SECRET), infakt: !!infaktPublicConfig().configured };
  const missingIntegrations = Object.entries(integrations).filter(([, ready]) => !ready).map(([name]) => name);
  const ageMinutes = (value) => { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? Math.max(0, Math.round((Date.now() - parsed) / 60000)) : null; };
  const freshness = { settings: ageMinutes(settingsRec.updated_at), orders: ageMinutes(ordersRec.updated_at), allegroOrders: ageMinutes(allegroOrdersRec.updated_at), communications: ageMinutes(communicationRec.updated_at) };
  const staleSources = Object.entries(freshness).filter(([, age]) => age !== null && age > 180).map(([name, age]) => `${name}: ${age} min`);
  const priorities = [], addPriority = (severity, area, count, title, href, action) => { if (Number(count) > 0) priorities.push({ id: `${area}-${priorities.length + 1}`, severity, area, count: Number(count), title, href, action }); };
  addPriority('critical', 'system', missingIntegrations.length, 'Funkcje krytyczne strony wymagają kontroli', '#/diagnostyka', `Sprawdź brakujące integracje: ${missingIntegrations.join(', ')}.`);
  addPriority('critical', 'synchronizacja', staleSources.length, 'Dane operacyjne są nieaktualne', '#/admin/agent-ai/plan', `Uruchom bezpieczne odświeżenie: ${staleSources.join(' • ')}.`);
  addPriority('critical', 'zamowienia', newOrders.length, 'Nowe zamówienia czekają na rozpoczęcie obsługi', '#/admin/zamowienia', 'Otwórz zamówienia i rozpocznij realizację.');
  addPriority('critical', 'allegro', communicationWaiting.length, 'Nowe wiadomości lub dyskusje Allegro wymagają odpowiedzi', '#/admin/allegro/wiadomosci', 'Przygotuj odpowiedź i oznacz sprawę wewnętrznie po zakończeniu.');
  addPriority('critical', 'producent', supplierUnavailable.length, 'Produkty priorytetowe niedostępne u producenta', '#/admin/magazyn/dostawcy', 'Sprawdź aktywne zamówienia i alternatywne źródło dostawy.');
  addPriority('warning', 'wysylki', shipmentsWithoutTracking.length, 'Aktywne zamówienia bez numeru nadania', '#/admin/wysylki', 'Uzupełnij dane InPost i wygeneruj etykiety.');
  addPriority('warning', 'allegro', activeAllegro.length, 'Aktywne zamówienia Allegro do kontroli magazynowej', '#/admin/allegro/zamowienia', 'Sprawdź kompletację, braki i lokalizacje produktów.');
  addPriority('warning', 'producent', supplierLow.length, 'Niski stan produktów u producentów', '#/admin/magazyn/dostawcy', 'Kontroluj najpierw najlepiej sprzedające się produkty.');
  addPriority('warning', 'produkty', offerTasks.length, 'Otwarte zadania wystawiania produktów na Allegro', '#/admin/allegro/wystawianie', 'Uzupełnij wymagane dane i ponów wystawienie.');
  addPriority('warning', 'producenci', supplierOrders.length, 'Otwarte dokumenty zamówień do producentów', '#/admin/agent-ai/zlecenia', 'Sprawdź aktualną rewizję przed zatwierdzeniem i wysyłką.');
  addPriority('warning', 'faktury', companyOrdersWithoutInvoice.length, 'Zamówienia firmowe nie mają jeszcze szkicu ani faktury', '#/admin/infakt/zamowienia', 'Sprawdź dane nabywcy i utwórz dokument w inFakt.');
  addPriority('info', 'produkty', producerLinks.length, 'Linki producentów czekają na pobranie danych', '#/admin/agent-ai/plan', 'Ponów analizę linków i uzupełnij kartoteki.');
  if (offerErrorRec?.message || offerErrorRec?.error) addPriority('warning', 'allegro', 1, 'Ostatnia operacja oferty Allegro zakończyła się błędem', '#/admin/allegro/wystawianie', 'Otwórz diagnostykę oferty i przekaż braki Agentowi.');
  const severityRank = { critical: 0, warning: 1, info: 2 };
  priorities.forEach((priority) => Object.assign(priority, agentPriorytetWykonawczy(priority)));
  priorities.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || b.count - a.count || a.title.localeCompare(b.title, 'pl'));
  const critical = priorities.filter((x) => x.severity === 'critical').length, warnings = priorities.filter((x) => x.severity === 'warning').length;
  const score = Math.max(0, Math.min(100, 100 - critical * 14 - warnings * 5));
  return {
    ok: true, generatedAt: new Date().toISOString(), score, priorities,
    summary: { orders: orders.length, activeOrders: activeOrders.length, newOrders: newOrders.length, shipmentsWithoutTracking: shipmentsWithoutTracking.length, allegroOrders: allegroOrders.length, activeAllegro: activeAllegro.length, communicationWaiting: communicationWaiting.length, supplierUnavailable: supplierUnavailable.length, supplierLow: supplierLow.length, producerLinks: producerLinks.length, offerTasks: offerTasks.length, supplierOrders: supplierOrders.length, companyOrdersWithoutInvoice: companyOrdersWithoutInvoice.length },
    integrations, freshness,
    links: { agent: 'https://artwaytm.pl/#/admin/agent-ai', orders: 'https://artwaytm.pl/#/admin/zamowienia', warehouse: 'https://artwaytm.pl/#/admin/magazyn/stany', allegro: 'https://artwaytm.pl/#/admin/allegro', shipping: 'https://artwaytm.pl/#/admin/wysylki', invoices: 'https://artwaytm.pl/#/admin/infakt' },
  };
}
function agentRaportTelegramHTML(center = {}) {
  const s = center.summary || {}, items = (Array.isArray(center.priorities) ? center.priorities : []).slice(0, 8);
  const icons = { critical: '🔴', warning: '🟡', info: '🔵' };
  const rows = items.length ? items.map((x, i) => `${i + 1}. ${icons[x.severity] || '•'} <b>${telegramHtml(x.title)}</b> — ${x.count}\n   ${x.execution === 'approval' ? '🔐 decyzja administratora' : x.execution === 'draft' ? '📝 agent przygotuje szkic' : '⚙️ agent może sprawdzić'} • termin ${x.deadlineMinutes || 240} min\n   ${telegramHtml(x.action || '')}\n   Gotowe, gdy: ${telegramHtml(x.doneWhen || 'temat zostanie zweryfikowany')}`).join('\n') : '✅ Brak aktywnych tematów wymagających reakcji.';
  return `<b>🤖 Centrum operacyjne Artway-TM — ${center.score ?? 0}%</b>\n${telegramHtml(new Date(center.generatedAt || Date.now()).toLocaleString('pl-PL'))}\n\n<b>Sprzedaż i obsługa</b>\nSklep: ${s.newOrders || 0} nowych / ${s.activeOrders || 0} aktywnych\nAllegro: ${s.activeAllegro || 0} aktywnych • ${s.communicationWaiting || 0} spraw do odpowiedzi\nWysyłki bez numeru: ${s.shipmentsWithoutTracking || 0}\nFaktury: ${s.companyOrdersWithoutInvoice || 0} firmowych bez dokumentu\nProducent: ${s.supplierUnavailable || 0} braków • ${s.supplierLow || 0} niskich stanów\n\n<b>Najważniejsze działania</b>\n${rows}\n\n<i>Agent nie wysyła odpowiedzi klientom ani zamówień producentom bez zatwierdzenia administratora.</i>`;
}
function numerZamowienia(v) {
  return tekst(v, 80).trim();
}

// zostaw tylko dozwolone klucze wspólne i pilnuj rozmiaru
function oczyscUstawienia(obj) {
  const wynik = {};
  if (!obj || typeof obj !== 'object') return wynik;
  for (const k of KLUCZE_WSPOLNE) {
    if (k in obj && obj[k] !== undefined) wynik[k] = obj[k];
  }
  return wynik;
}

function normalizujZamowienie(z) {
  if (!z || typeof z !== 'object') return null;
  const nr = numerZamowienia(z.nr);
  if (!nr) return null;
  z.nr = nr;
  z.ts = Number(z.ts) || Date.now();
  z.email = tekst(z.email, 200).trim().toLowerCase();
  return z;
}
function normalizujKlienta(u) {
  if (!u || typeof u !== 'object') return null;
  const email = tekst(u.email, 200).trim().toLowerCase();
  if (!email) return null;
  u.email = email;
  return u;
}

function normalizujUsunieteZamowienie(raw) {
  const nr = numerZamowienia(raw?.nr || raw?.number || raw);
  if (!nr) return null;
  return {
    nr,
    email: tekst(raw?.email, 200).trim().toLowerCase(),
    by: tekst(raw?.by || raw?.kto || 'unknown', 40),
    deleted_at: tekst(raw?.deleted_at || raw?.usunietoAt || new Date().toISOString(), 80),
  };
}
function mapaUsunietych(lista = []) {
  const mapa = new Map();
  for (const raw of Array.isArray(lista) ? lista : []) {
    const rec = normalizujUsunieteZamowienie(raw);
    if (rec) mapa.set(rec.nr, { ...mapa.get(rec.nr), ...rec });
  }
  return mapa;
}
async function czytajUsunieteZamowienia() {
  const rec = await czytaj('deleted_orders', { items: [] });
  return Array.isArray(rec.items) ? rec.items : [];
}
function filtrujNieusunieteZamowienia(items, usuniete) {
  const mapa = usuniete instanceof Map ? usuniete : mapaUsunietych(usuniete);
  return (Array.isArray(items) ? items : []).filter((z) => z && z.nr && !mapa.has(z.nr));
}
async function dopiszUsunieteZamowienie(raw) {
  const rec = normalizujUsunieteZamowienie(raw);
  if (!rec) return null;
  const stare = await czytajUsunieteZamowienia();
  const mapa = mapaUsunietych(stare);
  mapa.set(rec.nr, { ...mapa.get(rec.nr), ...rec });
  const items = [...mapa.values()]
    .sort((a, b) => String(b.deleted_at || '').localeCompare(String(a.deleted_at || '')))
    .slice(0, LIMIT_USUNIETYCH_ZAMOWIEN);
  await zapisz('deleted_orders', { items, updated_at: new Date().toISOString() });
  return rec;
}

// zdejmij ze stanu magazynowego sprzedane sztuki (po złożeniu zamówienia przez klienta)
async function odejmijStany(zamowienie) {
  try {
    const pozycje = Array.isArray(zamowienie?.pozycjeDane) ? zamowienie.pozycjeDane : [];
    if (!pozycje.length) return;
    const ust = await czytaj('settings', { data: {}, rev: 0 });
    const dane = ust.data || {};
    const stany = (dane.artway_stany && typeof dane.artway_stany === 'object') ? { ...dane.artway_stany } : {};
    const ruchy = Array.isArray(dane.artway_ruchy_magazynowe) ? [...dane.artway_ruchy_magazynowe] : [];
    let zmiana = false;
    for (const p of pozycje) {
      const id = p && (p.id != null ? String(p.id) : '');
      const ile = Number(p && p.ilosc) || 0;
      if (!id || ile <= 0) continue;
      if (id in stany && stany[id] !== '' && stany[id] != null && !Number.isNaN(Number(stany[id]))) {
        const przed = Math.max(0, Number(stany[id]) || 0);
        const po = Math.max(0, przed - ile);
        stany[id] = po;
        ruchy.unshift({
          id: `MAG-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          data: new Date().toISOString(),
          dataTxt: new Date().toLocaleString('pl-PL'),
          produktId: id,
          produktNazwa: tekst(p.nazwa || p.produkt || id, 200),
          sku: tekst(p.sku || '', 80),
          typ: 'sprzedaż',
          ilosc: -ile,
          stanPrzed: przed,
          stanPo: po,
          dokument: numerZamowienia(zamowienie?.nr),
          powod: 'Zamówienie klienta',
          operator: 'system',
        });
        zmiana = true;
      }
    }
    if (zmiana) {
      dane.artway_stany = stany;
      dane.artway_ruchy_magazynowe = ruchy.slice(0, 3000);
      await zapisz('settings', { ...ust, data: dane, rev: (Number(ust.rev) || 0) + 1, updated_at: new Date().toISOString() });
    }
  } catch (e) { /* stany są pomocnicze — nie blokują zamówienia */ }
}

function sortujObiekt(obj = {}) {
  return Object.keys(obj || {})
    .sort()
    .reduce((wynik, k) => {
      if (obj[k] !== undefined && obj[k] !== null) wynik[k] = obj[k];
      return wynik;
    }, {});
}
function paynowEnv() {
  const env = String(process.env.PAYNOW_ENV || 'production').trim().toLowerCase();
  return PAYNOW_ENVY.has(env) ? env : 'production';
}
function paynowBaseUrl() {
  return paynowEnv() === 'sandbox' ? 'https://api.sandbox.paynow.pl' : 'https://api.paynow.pl';
}
function publicznyOrigin(req) {
  const u = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || u.host;
  const proto = req.headers.get('x-forwarded-proto') || u.protocol.replace(':', '') || 'https';
  return `${proto}://${host}`;
}
function paynowUrlPowrotu(req) {
  return tekst(process.env.PAYNOW_CONTINUE_URL, 1000).trim() || `${publicznyOrigin(req)}/#/zamowienia`;
}
function paynowUrlPowrotuZamowienia(req, nr) {
  const skonfigurowany = tekst(process.env.PAYNOW_CONTINUE_URL, 1000).trim();
  if (skonfigurowany) return skonfigurowany.replaceAll('{nr}', encodeURIComponent(nr || ''));
  return `${publicznyOrigin(req)}/#/dziekujemy/${encodeURIComponent(nr || '')}`;
}
function paynowUrlPowiadomien(req) {
  return tekst(process.env.PAYNOW_NOTIFICATION_URL, 1000).trim() || `${publicznyOrigin(req)}/api/store?action=paynow-notification`;
}
function paynowKonfiguracja(req) {
  const apiKey = tekst(process.env.PAYNOW_API_KEY, 200).trim();
  const signatureKey = tekst(process.env.PAYNOW_SIGNATURE_KEY, 300).trim();
  return {
    apiKey,
    signatureKey,
    configured: !!(apiKey && signatureKey),
    env: paynowEnv(),
    apiBaseUrl: paynowBaseUrl(),
    continueUrl: paynowUrlPowrotu(req),
    notificationUrl: paynowUrlPowiadomien(req),
  };
}
function podpisPaynowV3({ apiKey, signatureKey, idempotencyKey = '', body = '', parameters = {} }) {
  const headers = { 'Api-Key': apiKey };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const payload = JSON.stringify({
    headers: sortujObiekt(headers),
    parameters: sortujObiekt(parameters),
    body: body || '',
  });
  return crypto.createHmac('sha256', signatureKey).update(payload).digest('base64');
}
function podpisPaynowPowiadomienia(rawBody, signatureKey) {
  return crypto.createHmac('sha256', signatureKey).update(rawBody || '').digest('base64');
}
function porownajPodpis(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
function kluczIdempotencji(prefix, value) {
  const safe = String(value || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 35);
  return `${prefix}_${safe}`.slice(0, 45);
}
function grosze(kwota) {
  return Math.round((Number(kwota) || 0) * 100);
}
function statusPlatnosciPaynow(status) {
  switch (String(status || '').toUpperCase()) {
    case 'CONFIRMED': return 'opłacone';
    case 'PENDING':
    case 'NEW': return 'oczekuje';
    case 'EXPIRED': return 'wygasła';
    case 'REJECTED':
    case 'ABANDONED':
    case 'ERROR': return 'nieopłacone';
    default: return 'nieznany';
  }
}
function bledyPaynowTekst(dane, fallback) {
  const err = Array.isArray(dane?.errors) ? dane.errors : [];
  const msg = err.map((e) => [e.errorType, e.message, e.value].filter(Boolean).join(': ')).filter(Boolean).join('; ');
  return msg || fallback || 'Błąd Paynow';
}
async function paynowWywolaj(req, path, { method = 'GET', bodyObj = null, parameters = {}, idempotencyKey = '' } = {}) {
  const cfg = paynowKonfiguracja(req);
  if (!cfg.configured) {
    const blad = new Error('Paynow nie jest skonfigurowany po stronie serwera. Ustaw PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY w Netlify.');
    blad.code = 'paynow_not_configured';
    throw blad;
  }
  const body = bodyObj === null ? '' : JSON.stringify(bodyObj);
  const signature = podpisPaynowV3({
    apiKey: cfg.apiKey,
    signatureKey: cfg.signatureKey,
    idempotencyKey,
    body,
    parameters,
  });
  const headers = {
    'Api-Key': cfg.apiKey,
    'Signature': signature,
    'Accept': 'application/json',
    'User-Agent': 'Artway-TM/1.0 Netlify Function',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (body) headers['Content-Type'] = 'application/json';
  const url = new URL(path, cfg.apiBaseUrl);
  for (const [k, v] of Object.entries(parameters || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const r = await fetch(url.toString(), { method, headers, body: body || undefined });
  const textBody = await r.text();
  let dane = null;
  if (textBody) {
    try { dane = JSON.parse(textBody); } catch (e) { dane = { raw: textBody }; }
  }
  if (!r.ok) {
    const blad = new Error(bledyPaynowTekst(dane, `Paynow HTTP ${r.status}`));
    blad.status = r.status;
    blad.paynow = dane;
    throw blad;
  }
  return dane || {};
}
function daneKupujacegoPaynow(z) {
  const k = z?.klient || {};
  const email = tekst(z?.email || k.email, 50).trim().toLowerCase();
  const buyer = { email };
  if (k.imie) buyer.firstName = tekst(k.imie, 50).trim();
  if (k.nazwisko) buyer.lastName = tekst(k.nazwisko, 50).trim();
  const cyfryTel = String(k.telefon || z?.telefon || '').replace(/[^0-9]/g, '');
  if (cyfryTel.length === 9) buyer.phone = { prefix: '+48', number: Number(cyfryTel) };
  if (cyfryTel.length === 11 && cyfryTel.startsWith('48')) buyer.phone = { prefix: '+48', number: Number(cyfryTel.slice(2)) };
  return buyer;
}
function payloadPlatnosciPaynow(z, req) {
  const nr = numerZamowienia(z?.nr);
  const amount = grosze(z?.razem);
  if (!nr) throw new Error('Brak numeru zamówienia');
  if (amount < 100) throw new Error('Paynow wymaga kwoty minimum 1,00 PLN');
  const buyer = daneKupujacegoPaynow(z);
  if (!buyer.email) throw new Error('Paynow wymaga e-maila kupującego');
  return {
    amount,
    currency: 'PLN',
    externalId: nr,
    description: tekst(`Zamówienie ${nr} Artway-TM`, 255),
    continueUrl: paynowUrlPowrotuZamowienia(req, nr),
    buyer,
    orderItems: [{
      name: tekst(`Zamówienie ${nr}`, 120),
      category: 'Zamówienie',
      quantity: 1,
      price: amount,
    }],
  };
}
async function aktualizujZamowieniePaynow({ externalId = '', paymentId = '', status = '', modifiedAt = '', redirectUrl = '', env = '' } = {}) {
  const nr = numerZamowienia(externalId);
  const rec = await czytaj('orders', { items: [] });
  const items = Array.isArray(rec.items) ? rec.items : [];
  const i = items.findIndex((z) => (nr && z.nr === nr) || (paymentId && z?.paynow?.paymentId === paymentId));
  if (i < 0) return null;
  const z = { ...items[i] };
  const stary = z.paynow || {};
  if (modifiedAt && stary.modifiedAt) {
    const nowyCzas = Date.parse(modifiedAt);
    const staryCzas = Date.parse(stary.modifiedAt);
    if (!Number.isNaN(nowyCzas) && !Number.isNaN(staryCzas) && nowyCzas < staryCzas) return z;
  }
  z.paynow = {
    ...stary,
    paymentId: paymentId || stary.paymentId || '',
    status: status || stary.status || '',
    modifiedAt: modifiedAt || stary.modifiedAt || '',
    redirectUrl: redirectUrl || stary.redirectUrl || '',
    env: env || stary.env || paynowEnv(),
    updatedAt: new Date().toISOString(),
  };
  z.platnoscId = z.platnoscId || 'paynow';
  z.platnoscStatus = statusPlatnosciPaynow(z.paynow.status);
  if (z.paynow.status === 'CONFIRMED' && (!z.status || z.status === 'nowe')) {
    z.status = 'potwierdzone';
    const w = z.wysylka || {};
    w.historia = [...(Array.isArray(w.historia) ? w.historia : []), {
      czas: new Date().toLocaleString('pl-PL'),
      status: 'Płatność Paynow potwierdzona',
      opis: `Paynow ${z.paynow.paymentId || ''}`,
    }];
    z.wysylka = w;
  }
  items[i] = z;
  await zapisz('orders', { items, updated_at: new Date().toISOString() });
  return z;
}

const INFAKT_ENVY = new Set(['production', 'sandbox']);
function infaktKonfiguracja() {
  const env = INFAKT_ENVY.has(String(process.env.INFAKT_ENV || '').toLowerCase()) ? String(process.env.INFAKT_ENV).toLowerCase() : 'production';
  const apiKey = tekst(process.env.INFAKT_API_KEY || '', 500).trim();
  return { apiKey, configured: !!apiKey, env, baseUrl: env === 'sandbox' ? 'https://api.sandbox-infakt.pl' : 'https://api.infakt.pl', paymentDays: Math.max(0, Math.min(365, Number(process.env.INFAKT_PAYMENT_DAYS || 7) || 7)) };
}
function infaktPublicConfig() {
  const c = infaktKonfiguracja();
  return {
    configured: c.configured,
    env: c.env,
    paymentDays: c.paymentDays,
    missingEnv: c.configured ? [] : ['INFAKT_API_KEY'],
    requiredScopes: ['api:costs:read', 'api:invoices:read', 'api:invoices:write'],
    blockedOperations: ['costs:write', 'accounting', 'bank_accounts:write', 'ksef:integration:write'],
    policy: 'supplier-costs-read-and-customer-invoices-create-only',
  };
}
function infaktNazwaDostawcy(v = '') {
  return tekst(v, 240).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();
}
function infaktDostawcyDozwoleni(raw = []) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const name = tekst(item?.name || item?.sellerName || item, 200).trim();
    const sellerName = tekst(item?.sellerName || item?.apiSellerName || name, 240).trim();
    const match = infaktNazwaDostawcy(sellerName);
    if (!name || !match || item?.active === false) continue;
    if (!out.some((x) => x.match === match)) out.push({ id: tekst(item?.id || match, 120), name, sellerName, match });
  }
  return out.slice(0, 100);
}
async function infaktDostawcyUstawienia() {
  const rec = await czytaj('infakt_supplier_access', { items: [], updated_at: null });
  return { items: infaktDostawcyDozwoleni(rec?.items), updated_at: rec?.updated_at || null };
}
function infaktKosztDoZwrotu(koszt = {}, dostawca = null) {
  return {
    uuid: tekst(koszt.uuid, 200),
    number: tekst(koszt.number, 160),
    seller_name: tekst(koszt.seller_name, 240),
    description: tekst(koszt.description, 600),
    net_price: Number(koszt.net_price) || 0,
    gross_price: Number(koszt.gross_price) || 0,
    tax_price: Number(koszt.tax_price) || 0,
    currency: tekst(koszt.currency || 'PLN', 12),
    issue_date: tekst(koszt.issue_date, 30),
    received_date: tekst(koszt.received_date, 30),
    due_date: tekst(koszt.due_date, 30),
    created_at: tekst(koszt.created_at, 80),
    category: tekst(koszt.category, 160),
    kind: tekst(koszt.kind, 80),
    statuses: (Array.isArray(koszt.statuses) ? koszt.statuses : []).slice(0, 20).map((s) => ({ symbol: tekst(s?.symbol, 80), name: tekst(s?.name, 120), group: tekst(s?.group, 80) })),
    supplier: dostawca ? { id: dostawca.id, name: dostawca.name } : null,
  };
}
function infaktXmlOdkoduj(value = '') {
  return String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code) || 32)).trim();
}
function infaktXmlPole(xml = '', name = '') {
  const safe = String(name).replace(/[^A-Za-z0-9_]/g, ''), match = String(xml).match(new RegExp(`<(?:(?:[A-Za-z0-9_]+):)?${safe}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_]+):)?${safe}>`, 'i'));
  return infaktXmlOdkoduj(match?.[1]?.replace(/<[^>]+>/g, ' ') || '');
}
function infaktXmlLiczba(value) {
  const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function infaktKsefPozycje(xml = '') {
  const rows = [...String(xml).matchAll(/<(?:(?:[A-Za-z0-9_]+):)?FaWiersz(?:\s[^>]*)?>([\s\S]*?)<\/(?:(?:[A-Za-z0-9_]+):)?FaWiersz>/gi)];
  const currency = infaktXmlPole(xml, 'KodWaluty') || 'PLN';
  return rows.map((match, index) => {
    const row = match[1], quantity = Math.max(0, infaktXmlLiczba(infaktXmlPole(row, 'P_8B'))), taxRaw = infaktXmlPole(row, 'P_12'), taxRate = /^\d+(?:[.,]\d+)?$/.test(taxRaw) ? infaktXmlLiczba(taxRaw) : 0;
    const unitNet = infaktXmlLiczba(infaktXmlPole(row, 'P_9A')), unitGrossRaw = infaktXmlLiczba(infaktXmlPole(row, 'P_9B')), lineNet = infaktXmlLiczba(infaktXmlPole(row, 'P_11')), lineGrossRaw = infaktXmlLiczba(infaktXmlPole(row, 'P_11A'));
    const net = unitNet || (quantity > 0 ? lineNet / quantity : 0), gross = unitGrossRaw || (quantity > 0 && lineGrossRaw ? lineGrossRaw / quantity : 0) || (net > 0 ? net * (1 + taxRate / 100) : 0);
    return {
      row: index + 1,
      name: tekst(infaktXmlPole(row, 'P_7') || infaktXmlPole(row, 'NazwaTowaru') || `Pozycja ${index + 1}`, 300),
      ean: tekst(infaktXmlPole(row, 'GTIN') || infaktXmlPole(row, 'EAN'), 80).replace(/\s+/g, ''),
      code: tekst(infaktXmlPole(row, 'Indeks') || infaktXmlPole(row, 'KodTowaru') || infaktXmlPole(row, 'SKU') || infaktXmlPole(row, 'NrKatalogowy'), 120).trim(),
      quantity: +quantity.toFixed(4), unitNet: +net.toFixed(4), unitGross: +gross.toFixed(4), taxRate, currency,
    };
  }).filter((row) => row.name || row.ean || row.code);
}
function infaktKodKlucz(value = '') { return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function infaktEanKlucz(value = '') { const digits = String(value || '').replace(/\D/g, ''); return digits.length >= 8 && digits.length <= 14 ? digits : ''; }
function infaktTokenyNazwy(value = '') {
  const stop = new Set(['gra', 'gry', 'zestaw', 'szt', 'sztuka', 'produkt', 'dla', 'oraz', 'mini', 'duzy', 'maly', 'the', 'and']);
  return [...new Set(infaktNazwaDostawcy(value).split(' ').filter((x) => x.length >= 3 && !stop.has(x)))];
}
function infaktIndeksProduktow(products = new Map()) {
  const ean = new Map(), code = new Map(), name = new Map(), add = (map, key, product) => { if (!key) return; const list = map.get(key) || []; if (!list.some((p) => String(p.id) === String(product.id))) list.push(product); map.set(key, list); };
  for (const product of products.values()) {
    [product.gtin, product.ean, product.kodEan].forEach((value) => add(ean, infaktEanKlucz(value), product));
    [product.kodProducenta, product.mpn, product.sku, product.externalId, product.kod].forEach((value) => add(code, infaktKodKlucz(value), product));
    add(name, infaktNazwaDostawcy(product.nazwa), product);
  }
  return { ean, code, name };
}
function infaktSugestieNazwy(line = {}, products = new Map(), supplier = null) {
  const wanted = infaktTokenyNazwy(line.name), supplierKey = infaktNazwaDostawcy(supplier?.name || '');
  if (!wanted.length) return [];
  return [...products.values()].map((product) => {
    const current = infaktTokenyNazwy(product.nazwa), common = wanted.filter((x) => current.includes(x)).length, producer = infaktNazwaDostawcy(product.producent || product.marka || ''), supplierBoost = supplierKey && (producer.includes(supplierKey) || supplierKey.includes(producer)) ? 0.12 : 0;
    return { product, score: current.length ? common / Math.max(wanted.length, current.length) + supplierBoost : 0 };
  }).filter((x) => x.score >= 0.45).sort((a, b) => b.score - a.score).slice(0, 3).map(({ product, score }) => ({ id: String(product.id), name: tekst(product.nazwa, 200), sku: tekst(product.sku || product.externalId || product.kodProducenta, 100), ean: tekst(product.gtin || product.ean, 80), score: +Math.min(0.99, score).toFixed(2) }));
}
function infaktDopasujPozycje(line = {}, products = new Map(), index = {}, supplier = null) {
  const eanKey = infaktEanKlucz(line.ean), codeKey = infaktKodKlucz(line.code);
  if (eanKey) { const list = index.ean.get(eanKey) || []; if (list.length === 1) return { product: list[0], method: 'EAN/GTIN', confidence: 100 }; if (list.length > 1) return { conflict: true, reason: 'EAN występuje przy kilku produktach' }; }
  if (codeKey) {
    const list = index.code.get(codeKey) || [];
    if (list.length === 1) return { product: list[0], method: 'kod produktu', confidence: 96 };
    if (list.length > 1) {
      const supplierKey = infaktNazwaDostawcy(supplier?.name || ''), sameSupplier = list.filter((p) => { const producer = infaktNazwaDostawcy(p.producent || p.marka || ''); return supplierKey && producer && (producer.includes(supplierKey) || supplierKey.includes(producer)); });
      if (sameSupplier.length === 1) return { product: sameSupplier[0], method: 'kod + dostawca', confidence: 94 };
      return { conflict: true, reason: 'Kod występuje przy kilku produktach' };
    }
  }
  const nameKey = infaktNazwaDostawcy(line.name), nameList = index.name.get(nameKey) || [];
  if (nameKey && nameList.length === 1) return { product: nameList[0], method: 'identyczna nazwa', confidence: 90 };
  return { product: null, reason: eanKey || codeKey ? 'Brak produktu z takim kodem' : 'Faktura nie zawiera EAN ani kodu produktu' };
}
function infaktCenaZakupuFields(product = {}, line = {}, invoice = {}, supplier = {}, method = '') {
  const now = new Date().toISOString(), price = +Number(line.unitGross || 0).toFixed(2), history = Array.isArray(product.cenaZakupuHistoria) ? product.cenaZakupuHistoria.slice(0, 29) : [];
  const entry = { price, net: +Number(line.unitNet || 0).toFixed(2), quantity: Number(line.quantity || 0), document: tekst(invoice.invoice_number, 120), ksefNumber: tekst(invoice.ksef_number, 180), supplier: tekst(supplier.name || invoice.seller_name, 200), date: tekst(invoice.invoice_date, 20), method, updatedAt: now };
  return { cenaZakupu: price, cenaZakupuZrodlo: 'inFakt / KSeF', cenaZakupuDokument: entry.document, cenaZakupuKsef: entry.ksefNumber, cenaZakupuDostawca: entry.supplier, cenaZakupuDataDokumentu: entry.date, cenaZakupuDopasowanie: method, cenaZakupuZaktualizowanoAt: now, cenaZakupuHistoria: [entry, ...history.filter((x) => x?.ksefNumber !== entry.ksefNumber || Number(x?.price) !== price)].slice(0, 30) };
}
async function infaktSynchronizujCenyZakupu({ days = 180, limit = 25, force = false } = {}) {
  const suppliers = await infaktDostawcyUstawienia(), previous = await czytaj('infakt_purchase_price_sync', { documents: {}, pendingItems: [], recentMatches: [], updated_at: null }), now = new Date().toISOString();
  const report = { source: 'inFakt KSeF XML', available: true, startedAt: now, updated_at: now, lastListAttemptAt: now, days, scannedDocuments: 0, allowedDocuments: 0, processedDocuments: 0, lineCount: 0, matchedCount: 0, priceUpdatedCount: 0, unchangedCount: 0, pendingCount: 0, errors: [], documents: { ...(previous.documents || {}) }, pendingItems: [], recentMatches: Array.isArray(previous.recentMatches) ? previous.recentMatches.slice(0, 200) : [] };
  if (!suppliers.items.length) { report.available = false; report.errors.push('Biała lista dostawców jest pusta.'); await zapisz('infakt_purchase_price_sync', report); return report; }
  const lastAttempt = Date.parse(previous.lastListAttemptAt || ''), cooldownMs = 11 * 60 * 1000;
  if (!force && Number.isFinite(lastAttempt) && Date.now() - lastAttempt < cooldownMs) return { ...previous, cooldown: true, nextListAt: new Date(lastAttempt + cooldownMs).toISOString(), message: 'Użyto ostatniego wyniku, aby nie przekroczyć limitu 6 listowań KSeF na godzinę.' };
  const since = new Date(Date.now() - Math.max(1, Math.min(730, Number(days) || 180)) * 86400000).toISOString().slice(0, 10);
  let listData;
  try { listData = await infaktWywolaj('/api/v3/ksef2/import/costs.json', { parameters: { offset: 0, limit: 100, order: 'Desc', 'q[invoice_date_gteq]': since } }); }
  catch (error) {
    report.available = false;
    report.setupRequired = null;
    report.pendingItems = Array.isArray(previous.pendingItems) ? previous.pendingItems : [];
    report.pendingCount = report.pendingItems.length;
    report.errors.push(Number(error.status) === 422
      ? `inFakt chwilowo odrzucił listowanie KSeF (HTTP 422). Połączenie KSeF na koncie jest aktywne; najczęstszą przyczyną jest wspólny limit 6 listowań kosztów i przychodów na godzinę. System zachował dotychczasowe dane i ponowi próbę automatycznie. Szczegóły API: ${tekst(error.message, 240)}`
      : `Odczyt faktur kosztowych KSeF: ${tekst(error.message, 500)}`);
    await zapisz('infakt_purchase_price_sync', report); return report;
  }
  const invoices = (Array.isArray(listData?.entities) ? listData.entities : []).filter((invoice) => { const seller = infaktNazwaDostawcy(invoice?.seller_name); return suppliers.items.some((x) => x.match === seller); });
  report.scannedDocuments = Array.isArray(listData?.entities) ? listData.entities.length : 0; report.allowedDocuments = invoices.length;
  const settingsRec = await czytaj('settings', { data: {}, rev: 0, updated_at: null }), data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {}, products = allegroAgentProduktyCentralne(data), index = infaktIndeksProduktow(products), updater = allegroAktualizatorProduktowCentralnych(data);
  const processedKeys = new Set(), batchLimit = Math.max(1, Math.min(50, Number(limit) || 25)), selectedInvoices = (force ? invoices : invoices.filter((invoice) => report.documents[tekst(invoice?.ksef_number, 200)]?.status !== 'processed')).slice(0, batchLimit).reverse();
  for (const invoice of selectedInvoices) {
    const documentKey = tekst(invoice.ksef_number, 200); if (!documentKey) continue;
    const supplier = suppliers.items.find((x) => x.match === infaktNazwaDostawcy(invoice.seller_name));
    try {
      const response = await infaktWywolaj(`/api/v3/ksef2/import/${encodeURIComponent(documentKey)}.json`, { parameters: { file_format: 'xml' }, raw: true, accept: 'application/xml, text/xml, application/json' }); let xml = await response.text();
      if (/^\s*\{/.test(xml)) { try { const parsed = JSON.parse(xml); xml = parsed.xml || parsed.content || parsed.file || ''; } catch { /* odpowiedź pozostanie tekstem */ } }
      const lines = infaktKsefPozycje(xml); if (!lines.length) throw new Error('Dokument XML nie zawiera rozpoznawalnych pozycji FaWiersz'); processedKeys.add(documentKey); report.lineCount += lines.length; report.processedDocuments++;
      for (const line of lines) {
        const itemKey = crypto.createHash('sha256').update(`${documentKey}|${line.row}|${line.ean}|${line.code}|${line.name}`).digest('hex').slice(0, 24), match = infaktDopasujPozycje(line, products, index, supplier), validPrice = line.currency === 'PLN' && line.quantity > 0 && line.unitGross > 0;
        if (match.product && validPrice) {
          const product = products.get(String(match.product.id)) || match.product, oldDate = String(product.cenaZakupuDataDokumentu || ''), shouldUpdate = force || !oldDate || String(invoice.invoice_date || '') >= oldDate;
          if (shouldUpdate) { const fields = infaktCenaZakupuFields(product, line, invoice, supplier, match.method); if (Number(product.cenaZakupu || 0) !== Number(fields.cenaZakupu)) report.priceUpdatedCount++; else report.unchangedCount++; updater.apply(product.id, fields); products.set(String(product.id), { ...product, ...fields }); }
          else report.unchangedCount++;
          report.matchedCount++; report.recentMatches.unshift({ itemKey, productId: String(product.id), productName: tekst(product.nazwa, 200), price: +line.unitGross.toFixed(2), quantity: line.quantity, method: match.method, confidence: match.confidence, invoiceNumber: tekst(invoice.invoice_number, 120), invoiceDate: tekst(invoice.invoice_date, 20), supplier: supplier?.name || invoice.seller_name, updatedAt: now });
        } else {
          report.pendingItems.push({ itemKey, invoiceNumber: tekst(invoice.invoice_number, 120), ksefNumber: documentKey, invoiceDate: tekst(invoice.invoice_date, 20), supplier: supplier?.name || tekst(invoice.seller_name, 200), row: line.row, name: line.name, ean: line.ean, code: line.code, quantity: line.quantity, unitNet: line.unitNet, unitGross: line.unitGross, currency: line.currency, reason: !validPrice ? 'Brak poprawnej ceny brutto, ilości lub waluta inna niż PLN' : (match.reason || 'Brak jednoznacznego dopasowania'), suggestions: infaktSugestieNazwy(line, products, supplier) });
        }
      }
      report.documents[documentKey] = { status: 'processed', invoiceNumber: tekst(invoice.invoice_number, 120), invoiceDate: tekst(invoice.invoice_date, 20), supplier: supplier?.name || tekst(invoice.seller_name, 200), lines: lines.length, processedAt: now };
    } catch (error) { report.errors.push(`${tekst(invoice.invoice_number || documentKey, 160)}: ${tekst(error.message, 400)}`); report.documents[documentKey] = { status: 'error', error: tekst(error.message, 400), processedAt: now }; }
  }
  updater.commit(); if (updater.changed) await zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now });
  const oldPending = Array.isArray(previous.pendingItems) ? previous.pendingItems : [], newKeys = new Set(report.pendingItems.map((x) => x.itemKey)); report.pendingItems = [...report.pendingItems, ...oldPending.filter((x) => !newKeys.has(x.itemKey) && !processedKeys.has(x.ksefNumber))].slice(0, 1000); report.pendingCount = report.pendingItems.length; report.recentMatches = report.recentMatches.slice(0, 500); report.updated_at = new Date().toISOString();
  await zapisz('infakt_purchase_price_sync', report); return report;
}
async function infaktPrzypiszCeneZakupu(itemKey = '', productId = '') {
  const [sync, settingsRec] = await Promise.all([czytaj('infakt_purchase_price_sync', { pendingItems: [], recentMatches: [] }), czytaj('settings', { data: {}, rev: 0 })]), item = (Array.isArray(sync.pendingItems) ? sync.pendingItems : []).find((x) => x.itemKey === itemKey), data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {}, products = allegroAgentProduktyCentralne(data), product = products.get(String(productId));
  if (!item) { const error = new Error('Nie znaleziono oczekującej pozycji faktury'); error.status = 404; throw error; } if (!product) { const error = new Error('Nie znaleziono produktu'); error.status = 404; throw error; } if (!(Number(item.unitGross) > 0) || item.currency !== 'PLN') { const error = new Error('Pozycja nie ma poprawnej ceny brutto w PLN'); error.status = 422; throw error; }
  const updater = allegroAktualizatorProduktowCentralnych(data), invoice = { invoice_number: item.invoiceNumber, ksef_number: item.ksefNumber, invoice_date: item.invoiceDate, seller_name: item.supplier }, fields = infaktCenaZakupuFields(product, item, invoice, { name: item.supplier }, 'ręczne zatwierdzenie'); updater.apply(product.id, fields); updater.commit();
  const now = new Date().toISOString(); sync.pendingItems = sync.pendingItems.filter((x) => x.itemKey !== itemKey); sync.pendingCount = sync.pendingItems.length; sync.matchedCount = (Number(sync.matchedCount) || 0) + 1; sync.priceUpdatedCount = (Number(sync.priceUpdatedCount) || 0) + 1; sync.recentMatches = [{ itemKey, productId: String(product.id), productName: tekst(product.nazwa, 200), price: Number(item.unitGross), quantity: Number(item.quantity), method: 'ręczne zatwierdzenie', confidence: 100, invoiceNumber: item.invoiceNumber, invoiceDate: item.invoiceDate, supplier: item.supplier, updatedAt: now }, ...(Array.isArray(sync.recentMatches) ? sync.recentMatches : [])].slice(0, 500); sync.updated_at = now;
  await Promise.all([zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now }), zapisz('infakt_purchase_price_sync', sync)]); return { item, product: { id: String(product.id), name: product.nazwa, cenaZakupu: fields.cenaZakupu }, sync };
}
function infaktErrorText(data, fallback = 'Błąd inFakt') {
  const errors = data?.errors || data?.error || data?.message;
  if (typeof errors === 'string') return tekst(errors, 1000);
  if (Array.isArray(errors)) return tekst(errors.map((x) => typeof x === 'string' ? x : x?.message || JSON.stringify(x)).join('; '), 1000);
  if (errors && typeof errors === 'object') return tekst(Object.entries(errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; '), 1000);
  return fallback;
}
async function infaktWywolaj(path, { method = 'GET', bodyObj = null, parameters = {}, raw = false, accept = '' } = {}) {
  const c = infaktKonfiguracja();
  if (!c.configured) { const e = new Error('inFakt nie jest skonfigurowany. Dodaj INFAKT_API_KEY po stronie serwera.'); e.code = 'infakt_not_configured'; e.status = 503; throw e; }
  const url = new URL(path, c.baseUrl); for (const [k, v] of Object.entries(parameters || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  const body = bodyObj === null ? undefined : JSON.stringify(bodyObj);
  const response = await fetch(url, { method, headers: { 'X-inFakt-ApiKey': c.apiKey, Accept: accept || (raw ? 'application/pdf, application/json' : 'application/json'), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body });
  if (raw && response.ok) return response;
  const txt = await response.text(); let data = {}; try { data = txt ? JSON.parse(txt) : {}; } catch { data = { raw: tekst(txt, 2000) }; }
  if (!response.ok) { const e = new Error(infaktErrorText(data, `inFakt HTTP ${response.status}`)); e.status = response.status; e.code = response.status === 401 ? 'infakt_auth' : response.status === 422 ? 'infakt_validation' : 'infakt_error'; e.infakt = data; throw e; }
  return data;
}
function infaktDataISO(value = '') { const d = value ? new Date(value) : new Date(); return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10); }
function infaktMetodaPlatnosci(z = {}) { const p = String(z.platnoscId || z.platnosc || '').toLowerCase(); if (p.includes('pobran')) return 'delivery'; if (p.includes('kart')) return 'card'; if (p.includes('gotow')) return 'cash'; return 'transfer'; }
function infaktPayloadZamowienia(z = {}, options = {}) {
  const client = z.klient || {}, address = z.adresDostawy || {}, company = tekst(client.firma || z.firma || '', 250).trim(), nip = String(client.nip || z.nip || '').replace(/\D/g, ''), fullName = tekst(`${client.imie || ''} ${client.nazwisko || ''}`, 200).trim(), nameParts = fullName.split(/\s+/).filter(Boolean);
  const lines = (Array.isArray(z.pozycjeDane) ? z.pozycjeDane : []).map((p) => { const quantity = Math.max(0.001, Number(p.ilosc) || 1), unitGross = Number(p.cena) || Number(p.wartosc) / quantity || 0; return { name: tekst(p.nazwa || p.produkt || 'Produkt', 300), quantity, gross_price: grosze(unitGross), tax_symbol: String(p.vatRate || p.vat || 23).replace('%', '') || '23', unit: 'szt.', ...(p.gtin || p.ean ? { gtin: tekst(p.gtin || p.ean, 80) } : {}) }; }).filter((p) => p.gross_price > 0);
  const deliveryGross = grosze(Number(z.kosztDostawy || 0) + Number(z.kosztPaczkaWeekend || 0) + Number(z.kosztPlatnosci || 0));
  if (deliveryGross > 0) lines.push({ name: 'Dostawa i usługi dodatkowe', quantity: 1, gross_price: deliveryGross, tax_symbol: '23', unit: 'szt.' });
  if (!lines.length) { const total = grosze(z.razem); if (total > 0) lines.push({ name: `Zamówienie ${tekst(z.nr, 100)}`, quantity: 1, gross_price: total, tax_symbol: '23', unit: 'szt.' }); }
  if (!lines.length) { const e = new Error('Zamówienie nie ma pozycji o dodatniej wartości'); e.code = 'infakt_empty_invoice'; throw e; }
  const invoiceDate = infaktDataISO(options.invoiceDate), due = new Date(`${invoiceDate}T12:00:00Z`); due.setUTCDate(due.getUTCDate() + infaktKonfiguracja().paymentDays);
  const invoice = { status: options.status === 'paid' ? 'paid' : 'draft', currency: 'PLN', payment_method: infaktMetodaPlatnosci(z), invoice_date: invoiceDate, sale_date: infaktDataISO(z.ts || z.createdAt || invoiceDate), payment_date: due.toISOString().slice(0, 10), sale_type: 'merchandise', notes: tekst(`Zamówienie Artway-TM: ${z.nr}`, 500), client_business_activity_kind: company || nip ? 'other_business' : 'private_person', client_company_name: company || (nip ? fullName || 'Klient firmowy' : undefined), client_first_name: company ? undefined : (nameParts[0] || 'Klient'), client_last_name: company ? undefined : (nameParts.slice(1).join(' ') || 'Artway-TM'), client_tax_code: nip || undefined, client_street: tekst(address.ulica || client.ulica || '', 160) || undefined, client_street_number: tekst(address.nrDomu || client.nrDomu || '', 40) || undefined, client_flat_number: tekst(address.nrLokalu || client.nrLokalu || '', 40) || undefined, client_city: tekst(address.miasto || client.miasto || '', 120) || undefined, client_post_code: tekst(address.kod || address.kodPocztowy || client.kod || client.kodPocztowy || '', 30) || undefined, services: lines };
  if (invoice.status === 'paid') invoice.paid_date = invoiceDate;
  Object.keys(invoice).forEach((key) => invoice[key] === undefined && delete invoice[key]);
  // Integracja sklepu ma celowo wąski zakres: wystawienie FV klienta, bez operacji KSeF.
  return { invoice, send_to_ksef: false };
}
function infaktRef(data = {}) { return tekst(data.invoice_task_reference_number || data.task_reference_number || data.reference_number || '', 200).trim(); }
function infaktInvoiceFromTask(data = {}) { return data.invoice || data.entity || data.result?.invoice || data.result || {}; }

function emailKonfiguracja() {
  const providerRaw = tekst(process.env.EMAIL_PROVIDER, 40).trim().toLowerCase();
  const host = tekst(process.env.SMTP_HOST || (providerRaw === 'gmail' ? 'smtp.gmail.com' : ''), 120).trim();
  const port = Number(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));
  const secureRaw = tekst(process.env.SMTP_SECURE, 20).trim().toLowerCase();
  const secure = secureRaw ? ['1', 'true', 'yes', 'tak'].includes(secureRaw) : port === 465;
  const user = tekst(process.env.SMTP_USER || process.env.GMAIL_USER || '', 200).trim();
  const pass = tekst(process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '', 500).trim();
  const provider = providerRaw || (host || user || pass ? (host === 'smtp.gmail.com' || user.endsWith('@gmail.com') ? 'gmail-smtp' : 'smtp') : '');
  const from = tekst(process.env.EMAIL_FROM || user || 'sklepartway@gmail.com', 200).trim();
  const fromName = tekst(process.env.EMAIL_FROM_NAME || 'Artway-TM', 120).trim();
  const replyTo = tekst(process.env.EMAIL_REPLY_TO || from, 200).trim();
  const adminTo = tekst(process.env.EMAIL_ADMIN_TO || process.env.EMAIL_TO || from, 200).trim();
  return {
    provider,
    configured: !!(provider && host && user && pass && from),
    host,
    port,
    secure,
    user,
    from,
    fromName,
    replyTo,
    adminTo,
  };
}
function emailPublicConfig() {
  const c = emailKonfiguracja();
  return {
    configured: c.configured,
    provider: c.provider || 'gmail-smtp',
    from: c.from,
    fromName: c.fromName,
    adminTo: c.adminTo,
    requiredEnv: ['EMAIL_PROVIDER=gmail', 'EMAIL_FROM', 'SMTP_USER', 'SMTP_PASS'],
    optionalEnv: ['EMAIL_FROM_NAME', 'EMAIL_REPLY_TO', 'EMAIL_ADMIN_TO', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE'],
  };
}
function adresNadawcyEmail(c = emailKonfiguracja()) {
  const nazwa = String(c.fromName || '').replace(/"/g, '').trim();
  return nazwa ? `"${nazwa}" <${c.from}>` : c.from;
}
async function wyslijEmailSMTP({ to, subject, text, html, replyTo }) {
  const c = emailKonfiguracja();
  if (!c.configured) {
    const blad = new Error('E-mail nie jest skonfigurowany po stronie serwera. Ustaw SMTP_USER i SMTP_PASS w Netlify.');
    blad.code = 'email_not_configured';
    throw blad;
  }
  const transporter = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '' },
  });
  const info = await transporter.sendMail({
    from: adresNadawcyEmail(c),
    to,
    replyTo: replyTo || c.replyTo,
    subject,
    text,
    html,
  });
  return { provider: c.provider || 'smtp', message_id: info.messageId || '', accepted: info.accepted || [] };
}
const OPLATA_PACZKA_WEEKEND = 5;
function kwotaSerwer(v) {
  const n = Number(String(v ?? 0).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? +n.toFixed(2) : 0;
}
function zlSerwer(v) {
  return `${kwotaSerwer(v).toFixed(2).replace('.', ',')} zł`;
}
function htmlEscape(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function linkSklepuEmail(path = '/') {
  const base = tekst(process.env.EMAIL_SITE_URL || 'https://artwaytm.pl', 400).trim().replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
function nazwaKlientaEmail(z) {
  const k = z?.klient || {};
  return [k.imie, k.nazwisko].map((x) => tekst(x, 80).trim()).filter(Boolean).join(' ') || tekst(z?.email, 160).trim() || 'Klient';
}
function adresDostawyEmail(z) {
  const a = z?.adresDostawy || {};
  if (a && (a.ulica || a.kod || a.miasto)) {
    const ulica = [a.ulica, a.nrDomu].map((x) => tekst(x, 120).trim()).filter(Boolean).join(' ');
    const lokal = a.nrLokalu ? `/${tekst(a.nrLokalu, 30).trim()}` : '';
    const miasto = [a.kod, a.miasto].map((x) => tekst(x, 120).trim()).filter(Boolean).join(' ');
    return [ulica ? `${ulica}${lokal}` : '', miasto].filter(Boolean).join(', ') || '—';
  }
  return tekst(z?.adres || '—', 500).trim() || '—';
}
function produktWariantEmail(p) {
  const wariant = p?.wariant;
  if (!wariant) return '';
  if (typeof wariant === 'string') return tekst(wariant, 120).trim();
  if (typeof wariant === 'object') return [wariant.nazwa, wariant.wartosc, wariant.label].map((x) => tekst(x, 80).trim()).filter(Boolean).join(': ');
  return '';
}
function produktyEmail(z) {
  if (Array.isArray(z?.pozycjeDane) && z.pozycjeDane.length) {
    return z.pozycjeDane.map((p) => {
      const ilosc = Number(p.ilosc) || 1;
      const cena = Number(p.cena) || 0;
      const wartosc = Number(p.wartosc) || (cena * ilosc);
      return {
        nazwa: tekst(p.nazwa || p.name || 'Produkt', 240).trim(),
        ilosc,
        cena,
        wartosc,
        sku: tekst(p.sku || p.SKU || '', 120).trim(),
        wariant: produktWariantEmail(p),
      };
    });
  }
  if (Array.isArray(z?.pozycje) && z.pozycje.length) {
    return z.pozycje.map((p) => ({ nazwa: tekst(p, 500).trim(), ilosc: 1, cena: 0, wartosc: 0, sku: '', wariant: '' }));
  }
  return [{ nazwa: 'Pozycje zamówienia zapisane w panelu sklepu', ilosc: 1, cena: 0, wartosc: 0, sku: '', wariant: '' }];
}
function linieProduktow(z) {
  return produktyEmail(z).map((p) => {
    const meta = [p.sku ? `SKU: ${p.sku}` : '', p.wariant].filter(Boolean).join(', ');
    const kwota = p.wartosc ? ` — ${zlSerwer(p.wartosc)}` : '';
    return `• ${p.nazwa}${meta ? ` (${meta})` : ''} × ${p.ilosc}${kwota}`;
  }).join('\n');
}
function htmlProduktyEmail(z) {
  const rows = produktyEmail(z).map((p) => {
    const meta = [p.sku ? `SKU: ${p.sku}` : '', p.wariant].filter(Boolean).join(' • ');
    return `<tr>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb">
        <div style="font-weight:800;color:#111827">${htmlEscape(p.nazwa)}</div>
        ${meta ? `<div style="font-size:12px;color:#6b7280;margin-top:3px">${htmlEscape(meta)}</div>` : ''}
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151">${htmlEscape(p.ilosc)}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:800;color:#111827">${p.wartosc ? htmlEscape(zlSerwer(p.wartosc)) : '—'}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#ffffff">
    <thead>
      <tr style="background:#f8fafc;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">
        <th align="left" style="padding:10px">Produkt</th>
        <th align="center" style="padding:10px;width:70px">Ilość</th>
        <th align="right" style="padding:10px;width:120px">Wartość</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}
function kosztyEmail(z) {
  const k = z?.koszty || {};
  const ma = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key) && obj[key] != null;
  const produktyZPozycji = produktyEmail(z).reduce((s, p) => s + kwotaSerwer(p.wartosc), 0);
  const weekendAktywny = !!(z?.paczkaWeekend || z?.wysylka?.paczkaWeekend);
  const weekend = kwotaSerwer(ma(z, 'oplataPaczkaWeekend') ? z.oplataPaczkaWeekend : (ma(k, 'paczkaWeekend') ? k.paczkaWeekend : (weekendAktywny ? OPLATA_PACZKA_WEEKEND : 0)));
  const platnosc = kwotaSerwer(ma(z, 'oplataPlatnosci') ? z.oplataPlatnosci : (ma(k, 'platnosc') ? k.platnosc : (z?.platnoscId === 'pobranie' ? 5 : 0)));
  const metoda = tekst(z?.dostawaId || '', 40).trim().toLowerCase();
  const poRabacieZapisane = ma(k, 'poRabacie') ? kwotaSerwer(k.poRabacie) : 0;
  const kosztDomyslny = metoda === 'kurier' || metoda === 'kurier_inpost' ? 20 : 12;
  const dostawa = ma(z, 'dostawaKoszt') || ma(k, 'dostawa')
    ? kwotaSerwer(ma(z, 'dostawaKoszt') ? z.dostawaKoszt : k.dostawa)
    : ((poRabacieZapisane || produktyZPozycji) >= 200 ? 0 : kosztDomyslny);
  const razemZapisane = kwotaSerwer(z?.razem);
  let poRabacie = poRabacieZapisane || (razemZapisane ? Math.max(0, kwotaSerwer(razemZapisane - dostawa - weekend - platnosc)) : 0);
  const produkty = ma(k, 'produkty') ? kwotaSerwer(k.produkty) : (produktyZPozycji || poRabacie);
  const rabat = ma(k, 'rabat') ? kwotaSerwer(k.rabat) : Math.max(0, kwotaSerwer(produkty - poRabacie));
  if (!poRabacie) poRabacie = Math.max(0, kwotaSerwer(produkty - rabat));
  const razem = razemZapisane || kwotaSerwer(poRabacie + dostawa + weekend + platnosc);
  return { produkty, rabat, poRabacie, dostawa, paczkaWeekend: weekend, platnosc, razem };
}
function podsumowanieKosztowEmailText(z) {
  const c = kosztyEmail(z);
  return [
    `Produkty: ${zlSerwer(c.produkty || c.poRabacie)}`,
    c.rabat ? `Rabat: -${zlSerwer(c.rabat)}` : '',
    `Dostawa: ${c.dostawa ? zlSerwer(c.dostawa) : 'GRATIS'} (${z?.dostawa || '—'})`,
    c.paczkaWeekend ? `Paczka w Weekend: ${zlSerwer(c.paczkaWeekend)}` : '',
    c.platnosc ? `Opłata płatności / pobrania: ${zlSerwer(c.platnosc)}` : '',
    `Razem do zapłaty: ${zlSerwer(c.razem)}`,
  ].filter(Boolean).join('\n');
}
function podsumowanieKosztowEmailHtml(z) {
  const c = kosztyEmail(z);
  const row = (a, b, strong = false) => `<div style="display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid #eef2f7${strong ? ';font-weight:900;font-size:17px;color:#111827' : ''}"><span>${htmlEscape(a)}</span><span>${htmlEscape(b)}</span></div>`;
  return [
    c.produkty ? row('Produkty', zlSerwer(c.produkty)) : '',
    c.rabat ? row('Rabat', `-${zlSerwer(c.rabat)}`) : '',
    c.rabat ? row('Po rabacie', zlSerwer(c.poRabacie)) : '',
    row('Dostawa', c.dostawa ? zlSerwer(c.dostawa) : 'GRATIS'),
    c.paczkaWeekend ? row('Paczka w Weekend', zlSerwer(c.paczkaWeekend)) : '',
    c.platnosc ? row('Opłata płatności / pobrania', zlSerwer(c.platnosc)) : '',
    row('Razem do zapłaty', zlSerwer(c.razem), true),
  ].filter(Boolean).join('');
}
function instrukcjaPlatnosciEmail(z) {
  const metoda = tekst(z?.platnosc || '—', 180).trim();
  const kwota = zlSerwer(z?.razem);
  if (z?.platnoscId === 'paynow') {
    const url = tekst(z?.paynow?.redirectUrl || '', 1000).trim();
    return {
      tytul: 'Dokończ bezpieczną płatność online',
      opis: url
        ? `Kliknij przycisk i opłać zamówienie przez mBank Paynow. Po potwierdzeniu płatności od razu przejdziemy do realizacji.`
        : `Wybrano mBank Paynow. Jeśli link płatności nie jest jeszcze widoczny, status sprawdzisz w sekcji „Moje zamówienia”.`,
      akcja: url ? 'Zapłać przez mBank Paynow' : 'Sprawdź zamówienie',
      url: url || linkSklepuEmail('/#/zamowienia'),
      meta: `Kwota do zapłaty: ${kwota}`,
    };
  }
  if (z?.platnoscId === 'telefon') {
    return {
      tytul: 'Przelew na telefon',
      opis: z?.platnoscInstrukcja || `Wyślij ${kwota} na numer 530 038 914. W tytule lub wiadomości wpisz: Zamówienie ${z.nr}.`,
      akcja: 'Zobacz szczegóły zamówienia',
      url: linkSklepuEmail('/#/zamowienia'),
      meta: `Kwota do zapłaty: ${kwota}`,
    };
  }
  if (z?.platnoscId === 'pobranie') {
    return {
      tytul: 'Płatność przy odbiorze',
      opis: 'Zapłacisz przy odbiorze przesyłki InPost. Przygotujemy paczkę i wyślemy kolejne informacje po nadaniu przesyłki.',
      akcja: 'Zobacz szczegóły zamówienia',
      url: linkSklepuEmail('/#/zamowienia'),
      meta: `Kwota do zapłaty: ${kwota}`,
    };
  }
  return {
    tytul: 'Płatność',
    opis: z?.platnoscInstrukcja || `Wybrana metoda płatności: ${metoda}.`,
    akcja: 'Zobacz szczegóły zamówienia',
    url: linkSklepuEmail('/#/zamowienia'),
    meta: `Kwota do zapłaty: ${kwota}`,
  };
}
function emailButton(label, url, kolor = '#2563eb') {
  return `<a href="${htmlEscape(url)}" style="display:inline-block;background:${kolor};color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 20px;margin:4px 8px 4px 0">${htmlEscape(label)}</a>`;
}
function htmlKartaEmail(tytul, body, accent = '#2563eb') {
  return `<div style="border:1px solid #e5e7eb;border-left:5px solid ${accent};border-radius:16px;background:#ffffff;padding:16px;margin:14px 0">
    <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-bottom:6px">${htmlEscape(tytul)}</div>
    <div style="color:#111827;font-size:15px">${body}</div>
  </div>`;
}
function htmlLayoutEmail({ preheader, badge, title, intro, z, mainCta, extraCta = [], admin = false, topCard = '', platnoscKartaHtml = '', coDalejTytul = '', coDalejTekst = '', stopkaTekst = '' }) {
  const payment = instrukcjaPlatnosciEmail(z);
  const sklepUrl = linkSklepuEmail('/#/');
  const kontoUrl = linkSklepuEmail('/#/zamowienia');
  const adminUrl = linkSklepuEmail(`/#/admin/zamowienie/${encodeURIComponent(z?.nr || '')}`);
  const k = z?.klient || {};
  const telefon = tekst(k.telefon || '', 80).trim();
  const email = tekst(z?.email || '', 200).trim();
  const koszty = kosztyEmail(z);
  const shippingBody = `${htmlEscape(z?.dostawa || '—')}<br><span style="color:#6b7280">${htmlEscape(adresDostawyEmail(z))}</span>${z?.paczkomat ? `<br><span style="color:#6b7280">Punkt odbioru: ${htmlEscape(z.paczkomat)}</span>` : ''}<br><span style="display:inline-block;margin-top:8px;font-weight:800">Koszt dostawy: ${htmlEscape(koszty.dostawa ? zlSerwer(koszty.dostawa) : 'GRATIS')}</span>${koszty.paczkaWeekend ? `<br><span style="color:#92400e;font-weight:800">Paczka w Weekend: +${htmlEscape(zlSerwer(koszty.paczkaWeekend))}</span>` : ''}`;
  const paymentBody = platnoscKartaHtml || `<b>${htmlEscape(payment.tytul)}</b><br><span style="color:#374151">${htmlEscape(payment.opis)}</span><br><span style="display:inline-block;margin-top:8px;color:#111827;font-weight:800">${htmlEscape(payment.meta)}</span>`;
  const cta = mainCta || { label: payment.akcja, url: payment.url };
  const ctaHtml = [cta, ...extraCta].filter(Boolean).map((x, i) => emailButton(x.label, x.url, i === 0 ? '#2563eb' : '#111827')).join('');
  return `<!doctype html>
  <html lang="pl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${htmlEscape(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${htmlEscape(preheader || title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:26px 10px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 55px rgba(37,99,235,.14)">
            <tr>
              <td style="background:linear-gradient(135deg,#2563eb,#6d28d9);padding:28px 28px 24px;color:#ffffff">
                <div style="font-size:13px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;opacity:.9">${htmlEscape(badge || 'Artway-TM')}</div>
                <h1 style="margin:10px 0 8px;font-size:28px;line-height:1.18">${htmlEscape(title)}</h1>
                <p style="margin:0;font-size:16px;line-height:1.55;opacity:.96">${htmlEscape(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px">
                <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:18px;padding:14px 16px;margin-bottom:16px;color:#78350f">
                  <b>Numer zamówienia:</b> ${htmlEscape(z?.nr || '—')} &nbsp; • &nbsp; <b>Razem:</b> ${htmlEscape(zlSerwer(z?.razem))}
                </div>
                ${topCard}
                ${admin ? htmlKartaEmail('Klient', `<b>${htmlEscape(nazwaKlientaEmail(z))}</b>${email ? `<br>${htmlEscape(email)}` : ''}${telefon ? `<br>${htmlEscape(telefon)}` : ''}`, '#7c3aed') : ''}
                ${htmlKartaEmail('Płatność', paymentBody, '#f59e0b')}
                ${htmlKartaEmail('Dostawa', shippingBody, '#10b981')}
                <h2 style="font-size:18px;margin:22px 0 10px;color:#111827">Produkty w zamówieniu</h2>
                ${htmlProduktyEmail(z)}
                ${htmlKartaEmail('Podsumowanie kosztów', podsumowanieKosztowEmailHtml(z), '#2563eb')}
                <div style="text-align:right;margin:14px 0 22px;font-size:20px;font-weight:900;color:#111827">Do zapłaty: ${htmlEscape(zlSerwer(koszty.razem))}</div>
                ${z?.uwagi ? htmlKartaEmail('Uwagi do zamówienia', htmlEscape(z.uwagi), '#64748b') : ''}
                <div style="background:#f8fafc;border-radius:18px;padding:18px;margin:20px 0">
                  <h3 style="margin:0 0 8px;font-size:17px;color:#111827">${htmlEscape(coDalejTytul || (admin ? 'Co dalej w obsłudze?' : 'Co dalej?'))}</h3>
                  <p style="margin:0;color:#374151;line-height:1.6">${coDalejTekst ? htmlEscape(coDalejTekst) : (admin
                    ? 'Sprawdź płatność, przygotuj paczkę, wygeneruj etykietę i aktualizuj status zamówienia. Klient dostanie kolejne informacje automatycznie.'
                    : 'Przyjęliśmy zamówienie. Będziemy informować o kolejnych etapach realizacji. W każdej chwili możesz wrócić do sklepu, sprawdzić szczegóły lub dobrać kolejne produkty do zestawu.')}</p>
                </div>
                <div style="margin:22px 0 8px">${ctaHtml}${admin ? emailButton('Otwórz zamówienie w panelu', adminUrl, '#111827') : emailButton('Wróć do sklepu', sklepUrl, '#111827')}</div>
                ${!admin ? `<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:18px 0 0">${htmlEscape(stopkaTekst || 'Dziękujemy za zaufanie. Życzymy dobrego dnia i udanych zakupów w Artway-TM.')}</p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="background:#111827;color:#d1d5db;padding:20px 28px;font-size:13px;line-height:1.55">
                <b style="color:#ffffff">Artway-TM</b><br>
                Sklep internetowy • ${htmlEscape(linkSklepuEmail('/#/'))}<br>
                ${admin ? 'To powiadomienie dla administratora sklepu.' : `Status zamówienia: ${htmlEscape(kontoUrl)}`}<br>
                Wiadomość wysłana automatycznie — odpowiedź trafi do obsługi sklepu.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}
function wiadomoscKlientaZamowienie(z) {
  const imie = tekst(z?.klient?.imie, 80).trim();
  const paynow = z?.paynow?.redirectUrl ? `\n\nLink do płatności Paynow:\n${z.paynow.redirectUrl}` : '';
  const telefon = z?.platnoscId === 'telefon' ? '\n\nPrzy przelewie na telefon wpisz w tytule/wiadomości numer zamówienia.' : '';
  const body = `Dzień dobry${imie ? `, ${imie}` : ''},

dziękujemy za złożenie zamówienia ${z.nr}.

Produkty:
${linieProduktow(z)}

${podsumowanieKosztowEmailText(z)}
Płatność: ${z.platnosc || '—'}${paynow}${telefon}

Status i szczegóły zamówienia sprawdzisz na stronie sklepu w sekcji „Moje zamówienia”.
Jeśli chcesz coś domówić, wróć do sklepu — chętnie pomożemy skompletować kolejne produkty.

Pozdrawiamy
Artway-TM`;
  return {
    subject: `Dziękujemy za zamówienie ${z.nr} — Artway-TM`,
    text: body,
    html: htmlLayoutEmail({
      preheader: `Przyjęliśmy zamówienie ${z.nr}. Sprawdź podsumowanie, płatność i dostawę.`,
      badge: 'Dziękujemy za zakupy',
      title: `Zamówienie ${z.nr} przyjęte`,
      intro: `Dziękujemy${imie ? `, ${imie}` : ''}! Twoje zamówienie jest już zapisane. Poniżej znajdziesz najważniejsze informacje i następny krok.`,
      z,
      extraCta: [{ label: 'Moje zamówienia', url: linkSklepuEmail('/#/zamowienia') }],
    }),
  };
}
function wiadomoscAdminZamowienie(z) {
  const k = z?.klient || {};
  const body = `Nowe zamówienie ${z.nr}

Klient: ${[k.imie, k.nazwisko].filter(Boolean).join(' ') || z.email || 'gość'}
E-mail: ${z.email || 'brak'}
Telefon: ${k.telefon || 'brak'}
Adres: ${z.adres || '—'}

Produkty:
${linieProduktow(z)}

${podsumowanieKosztowEmailText(z)}
Płatność: ${z.platnosc || '—'}
Status płatności: ${z.platnoscStatus || z?.paynow?.status || '—'}

Uwagi: ${z.uwagi || 'brak'}`;
  return {
    subject: `Nowe zamówienie ${z.nr} — ${zlSerwer(z.razem)}`,
    text: body,
    html: htmlLayoutEmail({
      preheader: `Nowe zamówienie ${z.nr} na kwotę ${zlSerwer(z.razem)} czeka na obsługę.`,
      badge: 'Panel administratora',
      title: `Nowe zamówienie ${z.nr}`,
      intro: `W sklepie pojawiło się nowe zamówienie. Sprawdź płatność, przygotuj wysyłkę i prowadź klienta przez kolejne etapy.`,
      z,
      admin: true,
      mainCta: { label: 'Otwórz panel zamówień', url: linkSklepuEmail('/#/admin/zamowienia') },
    }),
  };
}
async function dopiszHistorieEmaila(nr, wpis) {
  const rec = await czytaj('orders', { items: [] });
  const items = Array.isArray(rec.items) ? rec.items : [];
  const i = items.findIndex((z) => z.nr === nr);
  if (i < 0) return;
  const z = { ...items[i] };
  const w = z.wysylka || {};
  w.powiadomienia = [...(Array.isArray(w.powiadomienia) ? w.powiadomienia : []), {
    czas: new Date().toLocaleString('pl-PL'),
    ...wpis,
  }];
  z.wysylka = w;
  items[i] = z;
  await zapisz('orders', { items, updated_at: new Date().toISOString() });
}
function emailJuzWyslany(z, typ) {
  const historia = Array.isArray(z?.wysylka?.powiadomienia) ? z.wysylka.powiadomienia : [];
  return historia.some((p) => p && p.typ === typ && p.status === 'wysłano');
}
async function wyslijEmaileNowegoZamowienia(z, { includeAdmin = true } = {}) {
  const c = emailKonfiguracja();
  if (!c.configured) return { configured: false, sent: false, error: 'email_not_configured' };
  const wyniki = [], errors = [];
  if (z.email && !emailJuzWyslany(z, 'potwierdzenie')) {
    const msg = wiadomoscKlientaZamowienie(z);
    try {
      const r = await wyslijEmailSMTP({ to: z.email, ...msg });
      wyniki.push({ to: 'customer', ...r });
      await dopiszHistorieEmaila(z.nr, { typ: 'potwierdzenie', status: 'wysłano', provider: r.provider, id: r.message_id, automatyczne: true });
    } catch (e) {
      errors.push({ to: 'customer', error: e.message });
      await dopiszHistorieEmaila(z.nr, { typ: 'potwierdzenie', status: 'błąd wysyłki', blad: e.message, automatyczne: true });
    }
  }
  if (includeAdmin && c.adminTo && !emailJuzWyslany(z, 'admin_nowe')) {
    const msg = wiadomoscAdminZamowienie(z);
    try {
      const r = await wyslijEmailSMTP({ to: c.adminTo, ...msg });
      wyniki.push({ to: 'admin', ...r });
      await dopiszHistorieEmaila(z.nr, { typ: 'admin_nowe', status: 'wysłano', provider: r.provider, id: r.message_id, automatyczne: true });
    } catch (e) {
      errors.push({ to: 'admin', error: e.message });
      await dopiszHistorieEmaila(z.nr, { typ: 'admin_nowe', status: 'błąd wysyłki', blad: e.message, automatyczne: true });
    }
  }
  return { configured: true, sent: wyniki.length > 0, results: wyniki, errors };
}

// ─── E-MAILE STATUSOWE (automatyczne, po stronie serwera) ───
const MAPA_STATUS_EMAIL = {
  'w realizacji': 'przygotowanie',
  'gotowe do wysyłki': 'przygotowanie',
  'nadane': 'nadanie',
  'wysłane': 'nadanie',
  'dostarczone': 'dostarczenie',
  'zakończone': 'dostarczenie',
  'zwrot': 'zwrot',
  'zwrot pieniędzy': 'zwrot_pieniedzy',
  'anulowane': 'anulowanie',
};
const STATUS_EMAIL_META = {
  przygotowanie: { badge: 'Realizacja zamówienia', title: 'Zamówienie jest przygotowywane', accent: '#7c3aed', opis: 'Kompletujemy produkty i przygotowujemy paczkę do wysyłki. Wkrótce przekażemy przesyłkę przewoźnikowi.', subject: (nr) => `Zamówienie ${nr} jest przygotowywane — Artway-TM` },
  nadanie: { badge: 'Przesyłka w drodze', title: 'Twoja paczka została nadana', accent: '#059669', opis: 'Przesyłka jest już w InPost. Poniżej znajdziesz numer i link do śledzenia.', subject: (nr) => `Zamówienie ${nr} zostało nadane — Artway-TM` },
  dostarczenie: { badge: 'Dostarczono', title: 'Przesyłka została dostarczona', accent: '#16a34a', opis: 'Mamy nadzieję, że zakupy sprawią dużo satysfakcji. Zapraszamy ponownie do Artway-TM.', subject: (nr) => `Zamówienie ${nr} zostało dostarczone — Artway-TM` },
  anulowanie: { badge: 'Aktualizacja zamówienia', title: 'Zamówienie zostało anulowane', accent: '#dc2626', opis: 'Zamówienie zostało anulowane. Jeśli to pomyłka lub masz pytania, po prostu odpowiedz na tę wiadomość.', subject: (nr) => `Zamówienie ${nr} zostało anulowane — Artway-TM` },
  zwrot: { badge: 'Zwrot przesyłki', title: 'Przesyłka wraca do nadawcy', accent: '#ea580c', opis: 'Przesyłka została oznaczona jako zwrot do nadawcy. Skontaktujemy się w sprawie dalszych kroków.', subject: (nr) => `Zwrot przesyłki dla zamówienia ${nr} — Artway-TM` },
  zwrot_pieniedzy: { badge: 'Zwrot pieniędzy', title: 'Zwróciliśmy Ci pieniądze', accent: '#0ea5e9', opis: 'Zwrot środków został zainicjowany. Pieniądze wrócą na Twoje konto w ciągu kilku dni roboczych.', subject: (nr) => `Zwrot pieniędzy za zamówienie ${nr} — Artway-TM` },
  problem: { badge: 'Ważna informacja', title: 'Problem z przesyłką', accent: '#dc2626', opis: 'Przewoźnik zgłosił problem dotyczący przesyłki. Monitorujemy sytuację i przekażemy kolejną informację po jej wyjaśnieniu.', subject: (nr) => `Ważna informacja o przesyłce ${nr} — Artway-TM` },
};
function nazwaPrzewoznikaEmail(id) {
  return ({ inpost: 'InPost', dpd: 'DPD', dhl: 'DHL', orlen: 'ORLEN Paczka', gls: 'GLS', ups: 'UPS', pocztex: 'Pocztex', inny: 'przewoźnika' })[id] || 'przewoźnika';
}
function linkSledzeniaEmail(z) {
  const w = z?.wysylka || {};
  const wlasny = String(w.trackingUrl || '').trim();
  if (/^https?:\/\//i.test(wlasny)) return wlasny;
  const numer = String(w.numer || '').trim();
  if (!numer) return '';
  const mapa = {
    inpost: `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(numer)}`,
    dpd: `https://tracktrace.dpd.com.pl/parcelDetails?p1=${encodeURIComponent(numer)}`,
    dhl: `https://www.dhl.com/pl-pl/home/tracking.html?tracking-id=${encodeURIComponent(numer)}`,
    gls: `https://gls-group.com/PL/pl/sledzenie-paczek/?match=${encodeURIComponent(numer)}`,
    ups: `https://www.ups.com/track?loc=pl_PL&tracknum=${encodeURIComponent(numer)}`,
  };
  return mapa[w.przewoznik] || '';
}
// Wszystkie e-maile statusowe korzystają z TEGO SAMEGO szablonu co potwierdzenie zakupu (htmlLayoutEmail).
const STATUS_EMAIL_CODALEJ = {
  przygotowanie: ['Co dalej?', 'Kompletujemy Twoje produkty. Gdy paczka trafi do przewoźnika, dostaniesz e-mail z numerem do śledzenia.'],
  nadanie: ['Śledź swoją paczkę', 'Paczka jest już w drodze. Kliknij „Śledź przesyłkę”, aby zobaczyć jej status. Damy też znać, gdy zostanie dostarczona.'],
  dostarczenie: ['Dziękujemy za zakupy', 'Mamy nadzieję, że wszystko się podoba. Jeśli coś będzie nie tak, po prostu odpowiedz na tę wiadomość. Zapraszamy ponownie!'],
  anulowanie: ['Masz pytania?', 'Jeśli anulowanie to pomyłka albo chcesz coś zmienić, odpowiedz na tę wiadomość — pomożemy.'],
  zwrot: ['Co dalej?', 'Skontaktujemy się w sprawie dalszych kroków dotyczących zwracanej przesyłki.'],
  zwrot_pieniedzy: ['Zwrot środków', 'Pieniądze wrócą na Twoje konto w ciągu kilku dni roboczych, zależnie od banku. W razie pytań odpowiedz na tę wiadomość.'],
  problem: ['Czuwamy nad przesyłką', 'Monitorujemy sytuację w InPost i przekażemy kolejną informację zaraz po jej wyjaśnieniu.'],
};
function htmlStatusEmail(z, typ, opcje = {}) {
  const meta = STATUS_EMAIL_META[typ] || STATUS_EMAIL_META.przygotowanie;
  const imie = tekst(z?.klient?.imie, 80).trim();
  const w = z?.wysylka || {};
  const numer = tekst(w.numer, 120).trim();
  const sledzenie = linkSledzeniaEmail(z);
  const zamUrl = linkSklepuEmail('/#/zamowienia');
  const platnoscStatus = tekst(z?.platnoscStatus, 80).trim();
  // Karta statusu (kolor zależny od etapu) — na górze, tuż pod numerem zamówienia
  const statusCard = htmlKartaEmail(meta.badge, `<b>${htmlEscape(meta.title)}</b><br><span style="color:#374151">${htmlEscape(meta.opis)}</span>`, meta.accent);
  const kartaZwrot = typ === 'zwrot_pieniedzy'
    ? htmlKartaEmail('Zwrot środków', `Kwota zwrotu: <b>${htmlEscape(opcje.kwota != null ? zlSerwer(opcje.kwota) : zlSerwer(z?.razem))}</b><br><span style="color:#374151">Zwrot realizujemy tą samą metodą, którą opłacono zamówienie.</span>`, '#0ea5e9')
    : '';
  const kartaTracking = (typ === 'nadanie' || typ === 'problem') && (numer || sledzenie)
    ? htmlKartaEmail('Śledzenie przesyłki', `${w.przewoznik ? `Przewoźnik: <b>${htmlEscape(nazwaPrzewoznikaEmail(w.przewoznik))}</b><br>` : ''}${numer ? `Numer przesyłki: <b>${htmlEscape(numer)}</b><br>` : ''}${sledzenie ? `Link: <a href="${htmlEscape(sledzenie)}" style="color:#2563eb;font-weight:800">${htmlEscape(sledzenie)}</a>` : ''}`, '#059669')
    : '';
  const topCard = `${statusCard}${kartaZwrot}${kartaTracking}`;
  // Neutralna karta płatności (bez „dokończ płatność”) — metoda, status i kwota
  const platnoscKartaHtml = `<b>${htmlEscape(z?.platnosc || '—')}</b>${platnoscStatus ? `<br><span style="color:#374151">Status płatności: ${htmlEscape(platnoscStatus)}</span>` : ''}<br><span style="display:inline-block;margin-top:8px;color:#111827;font-weight:800">Kwota: ${htmlEscape(zlSerwer(kosztyEmail(z).razem))}</span>`;
  const mainCta = typ === 'nadanie' && sledzenie ? { label: 'Śledź przesyłkę', url: sledzenie } : { label: 'Moje zamówienia', url: zamUrl };
  const extraCta = typ === 'nadanie' && sledzenie ? [{ label: 'Moje zamówienia', url: zamUrl }] : [];
  const [cdT, cdX] = STATUS_EMAIL_CODALEJ[typ] || STATUS_EMAIL_CODALEJ.przygotowanie;
  return htmlLayoutEmail({
    preheader: meta.opis,
    badge: meta.badge,
    title: meta.title,
    intro: `Dzień dobry${imie ? `, ${imie}` : ''}! Poniżej najważniejsze informacje o Twoim zamówieniu ${z?.nr || ''}.`,
    z,
    mainCta,
    extraCta,
    topCard,
    platnoscKartaHtml,
    coDalejTytul: cdT,
    coDalejTekst: cdX,
    stopkaTekst: 'Dziękujemy za zaufanie. Zapraszamy ponownie — w sklepie czekają kolejne produkty i okazje.',
  });
}
function wiadomoscStatusowa(z, typ, opcje = {}) {
  const meta = STATUS_EMAIL_META[typ] || STATUS_EMAIL_META.przygotowanie;
  const imie = tekst(z?.klient?.imie, 80).trim();
  const w = z?.wysylka || {};
  const numer = tekst(w.numer, 120).trim();
  const sledzenie = linkSledzeniaEmail(z);
  const powitanie = `Dzień dobry${imie ? `, ${imie}` : ''},`;
  let tresc = '';
  if (typ === 'nadanie') tresc = `przesyłka dla zamówienia ${z.nr} została nadana przez ${nazwaPrzewoznikaEmail(w.przewoznik)}.${numer ? `\nNumer przesyłki: ${numer}` : ''}${sledzenie ? `\nŚledzenie: ${sledzenie}` : ''}`;
  else if (typ === 'przygotowanie') tresc = `Twoje zamówienie ${z.nr} jest obecnie przygotowywane do wysyłki. Damy znać, gdy paczka trafi do przewoźnika.`;
  else if (typ === 'dostarczenie') tresc = `przesyłka dla zamówienia ${z.nr} została oznaczona jako dostarczona. Dziękujemy za zakupy!`;
  else if (typ === 'anulowanie') tresc = `zamówienie ${z.nr} zostało anulowane. Jeśli to pomyłka lub masz pytania, odpowiedz na tę wiadomość.`;
  else if (typ === 'zwrot') tresc = `przesyłka dla zamówienia ${z.nr} została oznaczona jako zwrot do nadawcy. Skontaktujemy się w sprawie dalszych kroków.`;
  else if (typ === 'zwrot_pieniedzy') tresc = `zwróciliśmy pieniądze za zamówienie ${z.nr}.\nKwota zwrotu: ${opcje.kwota != null ? zlSerwer(opcje.kwota) : zlSerwer(z.razem)}\nŚrodki wrócą na Twoje konto w ciągu kilku dni roboczych, zależnie od banku.`;
  else if (typ === 'problem') tresc = `przewoźnik zgłosił problem dotyczący przesyłki dla zamówienia ${z.nr}. Monitorujemy sytuację i przekażemy kolejną informację po jej wyjaśnieniu.${numer ? `\nNumer przesyłki: ${numer}` : ''}${sledzenie ? `\nŚledzenie: ${sledzenie}` : ''}`;
  const body = `${powitanie}\n\n${tresc}\n\n${podsumowanieKosztowEmailText(z)}\n\nSzczegóły sprawdzisz w sekcji „Moje zamówienia”.\n\nPozdrawiamy\nArtway-TM\n${linkSklepuEmail('/#/')}`;
  return { subject: meta.subject(z.nr), text: body, html: htmlStatusEmail(z, typ, opcje) };
}
async function wyslijEmailStatusowy(z, typ, opcje = {}) {
  const c = emailKonfiguracja();
  if (!c.configured) return { configured: false, sent: false, error: 'email_not_configured' };
  if (!z?.email) return { configured: true, sent: false, error: 'no_email' };
  const msg = wiadomoscStatusowa(z, typ, opcje);
  try {
    const r = await wyslijEmailSMTP({ to: z.email, ...msg });
    await dopiszHistorieEmaila(z.nr, { typ, status: 'wysłano', provider: r.provider, id: r.message_id, automatyczne: true });
    return { configured: true, sent: true, provider: r.provider, id: r.message_id };
  } catch (e) {
    await dopiszHistorieEmaila(z.nr, { typ, status: 'błąd wysyłki', blad: e.message, automatyczne: true });
    return { configured: true, sent: false, error: e.message };
  }
}
function polaczPowiadomienia(serwerowe, przychodzace) {
  const a = Array.isArray(serwerowe) ? serwerowe : [];
  const b = Array.isArray(przychodzace) ? przychodzace : [];
  const klucz = (p) => `${p?.typ || ''}|${p?.status || ''}|${p?.czas || ''}|${p?.id || ''}`;
  const widziane = new Set(b.map(klucz));
  const dodatkowe = a.filter((p) => !widziane.has(klucz(p)));
  return [...b, ...dodatkowe];
}
async function obsluzEmailePrzejsciaStatusu(stary, nowy) {
  if (!nowy?.nr) return { sent: false };
  const typy = [];
  const numerNowy = tekst(nowy?.wysylka?.numer, 120).trim();
  const numerStary = tekst(stary?.wysylka?.numer, 120).trim();
  if (numerNowy && numerNowy !== numerStary) typy.push('nadanie');
  const bladNowy = tekst(nowy?.wysylka?.bladIntegracji, 300).trim();
  const bladStary = tekst(stary?.wysylka?.bladIntegracji, 300).trim();
  if (bladNowy && bladNowy !== bladStary) typy.push('problem');
  if ((stary?.status || '') !== (nowy?.status || '')) {
    const t = MAPA_STATUS_EMAIL[nowy.status];
    if (t && !typy.includes(t) && !(t === 'przygotowanie' && typy.includes('nadanie'))) typy.push(t);
  }
  if (!typy.length) return { sent: false };
  const c = emailKonfiguracja();
  if (!c.configured) return { sent: false, configured: false, typy };
  // aktualny stan zamówienia z bazy (autorytatywna historia do deduplikacji)
  const rec = await czytaj('orders', { items: [] });
  let zapisany = (rec.items || []).find((x) => x.nr === nowy.nr) || nowy;
  const wyniki = [];
  for (const typ of typy) {
    if (emailJuzWyslany(zapisany, typ)) continue;
    const r = await wyslijEmailStatusowy(zapisany, typ);
    wyniki.push({ typ, ...r });
    const rec2 = await czytaj('orders', { items: [] });
    zapisany = (rec2.items || []).find((x) => x.nr === nowy.nr) || zapisany;
  }
  return { sent: wyniki.some((x) => x.sent), configured: true, wyniki, powiadomienia: zapisany?.wysylka?.powiadomienia || [] };
}

// ─── ALLEGRO API (OAuth, zamówienia, oferty, mapowania) ───
function allegroEnv() {
  return String(process.env.ALLEGRO_ENV || 'production').trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production';
}
const ALLEGRO_DEFAULT_SCOPE = [
  'allegro:api:sale:offers:read',
  'allegro:api:sale:offers:write',
  'allegro:api:sale:settings:read',
  'allegro:api:orders:read',
  'allegro:api:orders:write',
  'allegro:api:shipments:read',
  'allegro:api:shipments:write',
  'allegro:api:messaging',
  'allegro:api:disputes',
].join(' ');
function allegroKonfiguracja(req) {
  const env = allegroEnv();
  const clientId = tekst(process.env.ALLEGRO_CLIENT_ID || '', 300).trim();
  const clientSecret = tekst(process.env.ALLEGRO_CLIENT_SECRET || '', 500).trim();
  const redirectUri = tekst(process.env.ALLEGRO_REDIRECT_URI || '', 1000).trim() || `${publicznyOrigin(req)}/api/store?action=allegro-callback`;
  const envScope = tekst(process.env.ALLEGRO_SCOPE || '', 1000).trim();
  const scope = [...new Set(`${envScope} ${ALLEGRO_DEFAULT_SCOPE}`.split(/\s+/).map((x) => x.trim()).filter(Boolean))].join(' ');
  const authBaseUrl = env === 'sandbox' ? 'https://allegro.pl.allegrosandbox.pl' : 'https://allegro.pl';
  const apiBaseUrl = env === 'sandbox' ? 'https://api.allegro.pl.allegrosandbox.pl' : 'https://api.allegro.pl';
  const missingEnv = [];
  if (!clientId) missingEnv.push('ALLEGRO_CLIENT_ID');
  if (!clientSecret) missingEnv.push('ALLEGRO_CLIENT_SECRET');
  return { env, clientId, clientSecret, redirectUri, scope, authBaseUrl, apiBaseUrl, configured: missingEnv.length === 0, missingEnv };
}
function allegroBasicAuth(c) {
  return `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}`;
}
async function allegroStatus(req) {
  const c = allegroKonfiguracja(req);
  const auth = await czytaj('allegro_auth', {});
  const wymagane = c.scope.split(/\s+/).filter(Boolean);
  const autoryzowane = String(auth?.scope || '').split(/\s+/).filter(Boolean);
  const brakujaceScope = autoryzowane.length ? wymagane.filter((x) => !autoryzowane.includes(x)) : [];
  return {
    configured: c.configured,
    connected: !!(auth && (auth.refresh_token || auth.access_token)),
    env: c.env,
    redirectUri: c.redirectUri,
    missingEnv: c.missingEnv,
    expires_at: auth?.expires_at || null,
    account: auth?.account || '',
    updated_at: auth?.updated_at || null,
    requiredEnv: ['ALLEGRO_CLIENT_ID', 'ALLEGRO_CLIENT_SECRET'],
    scope: c.scope,
    authorizedScope: auth?.scope || '',
    missingAuthorizedScopes: brakujaceScope,
    requiresReauth: brakujaceScope.length > 0,
    recommendedScope: ALLEGRO_DEFAULT_SCOPE,
    optionalEnv: ['ALLEGRO_REDIRECT_URI', 'ALLEGRO_ENV=production', 'ALLEGRO_SCOPE'],
  };
}
function bledyAllegroTekst(dane, fallback) {
  const errors = Array.isArray(dane?.errors) ? dane.errors : [];
  const msg = errors.map((e) => [e.code || e.error, e.message, e.userMessage].filter(Boolean).join(': ')).filter(Boolean).join('; ');
  return msg || dane?.error_description || dane?.message || fallback || 'Błąd Allegro';
}
async function allegroTokenRequest(req, params) {
  const c = allegroKonfiguracja(req);
  if (!c.configured) {
    const blad = new Error('Allegro API nie jest skonfigurowane. Ustaw ALLEGRO_CLIENT_ID i ALLEGRO_CLIENT_SECRET w Netlify.');
    blad.code = 'allegro_not_configured';
    blad.status = 503;
    blad.missingEnv = c.missingEnv;
    throw blad;
  }
  const r = await fetch(`${c.authBaseUrl}/auth/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': allegroBasicAuth(c),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'Artway-TM/1.0 Netlify Function',
    },
    body: new URLSearchParams(params),
  });
  const textBody = await r.text();
  let dane = {};
  try { dane = textBody ? JSON.parse(textBody) : {}; } catch (e) { dane = { raw: textBody }; }
  if (!r.ok) {
    const blad = new Error(bledyAllegroTekst(dane, `Allegro OAuth HTTP ${r.status}`));
    blad.status = r.status;
    blad.code = dane.error || 'allegro_oauth_error';
    blad.allegro = dane;
    throw blad;
  }
  return {
    ...dane,
    env: c.env,
    expires_at: Date.now() + (Math.max(60, Number(dane.expires_in) || 3600) * 1000),
    updated_at: new Date().toISOString(),
  };
}
async function allegroAccessToken(req) {
  const c = allegroKonfiguracja(req);
  if (!c.configured) {
    const blad = new Error('Allegro API nie jest skonfigurowane. Ustaw ALLEGRO_CLIENT_ID i ALLEGRO_CLIENT_SECRET w Netlify.');
    blad.code = 'allegro_not_configured';
    blad.status = 503;
    blad.missingEnv = c.missingEnv;
    throw blad;
  }
  const auth = await czytaj('allegro_auth', {});
  if (auth?.access_token && Number(auth.expires_at || 0) > Date.now() + 90000) return auth.access_token;
  if (!auth?.refresh_token) {
    const blad = new Error('Allegro nie jest autoryzowane. Kliknij „Połącz Allegro” w panelu admina.');
    blad.code = 'allegro_not_connected';
    blad.status = 401;
    throw blad;
  }
  const odswiezony = await allegroTokenRequest(req, { grant_type: 'refresh_token', refresh_token: auth.refresh_token });
  const zapis = { ...auth, ...odswiezony, refresh_token: odswiezony.refresh_token || auth.refresh_token };
  await zapisz('allegro_auth', zapis);
  return zapis.access_token;
}
const ALLEGRO_PUBLIC_JSON = 'application/vnd.allegro.public.v1+json';
const ALLEGRO_BETA_JSON = 'application/vnd.allegro.beta.v1+json';
async function allegroWywolaj(req, path, { method = 'GET', parameters = {}, bodyObj = null, accept = ALLEGRO_PUBLIC_JSON, contentType = null, withMeta = false } = {}) {
  const c = allegroKonfiguracja(req);
  const token = await allegroAccessToken(req);
  const apiUrl = new URL(path, c.apiBaseUrl);
  for (const [k, v] of Object.entries(parameters || {})) if (v !== undefined && v !== null && v !== '') apiUrl.searchParams.set(k, String(v));
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': accept,
    'Accept-Language': 'pl-PL',
    'User-Agent': 'Artway-TM/1.0 Netlify Function',
  };
  const body = bodyObj === null ? undefined : JSON.stringify(bodyObj);
  if (body) headers['Content-Type'] = contentType || accept || ALLEGRO_PUBLIC_JSON;
  const r = await fetch(apiUrl.toString(), { method, headers, body });
  const textBody = await r.text();
  let dane = {};
  try { dane = textBody ? JSON.parse(textBody) : {}; } catch (e) { dane = { raw: textBody }; }
  if (!r.ok) {
    const blad = new Error(bledyAllegroTekst(dane, `Allegro API HTTP ${r.status}`));
    blad.status = r.status;
    blad.code = dane.error || 'allegro_http_error';
    blad.allegro = dane;
    throw blad;
  }
  if (withMeta) return { data: dane, status: r.status, location: r.headers.get('location') || '', url: r.url || apiUrl.toString() };
  return dane;
}
async function allegroCzekajNaOperacjeOferty(req, location = '') {
  if (!location || !/\/operations\//.test(location)) return { completed: true, result: null, checks: 0 };
  let path = location;
  try { const u = new URL(location); path = `${u.pathname}${u.search}`; } catch (e) {}
  for (let i = 0; i < 18; i++) {
    if (i) await new Promise((resolve) => setTimeout(resolve, Math.min(1000, 650 + i * 25)));
    const meta = await allegroWywolaj(req, path, { withMeta: true });
    if (meta?.data?.id || (meta.status !== 202 && Object.keys(meta?.data || {}).length)) return { completed: true, result: meta.data || {}, checks: i + 1, status: meta.status };
  }
  return { completed: false, result: null, checks: 18, status: 202 };
}
function allegroLista(raw = {}, keys = []) {
  for (const key of keys) if (Array.isArray(raw?.[key])) return raw[key];
  if (Array.isArray(raw)) return raw;
  return [];
}
function allegroKwotaText(raw) {
  if (!raw) return '';
  const amount = raw.amount ?? raw.value ?? raw;
  const currency = raw.currency || 'PLN';
  if (amount === '' || amount === null || amount === undefined) return '';
  return `${String(amount).replace('.', ',')} ${currency}`;
}
function allegroParametry(o) {
  const params = [];
  if (Array.isArray(o?.parameters)) params.push(...o.parameters);
  const ps = Array.isArray(o?.productSet) ? o.productSet : [];
  for (const item of ps) {
    if (Array.isArray(item?.product?.parameters)) params.push(...item.product.parameters);
    if (Array.isArray(item?.parameters)) params.push(...item.parameters);
  }
  return params.filter(Boolean);
}
function allegroWartoscParametru(o, nazwy = []) {
  const szukane = nazwy.map((n) => String(n || '').toLowerCase());
  for (const p of allegroParametry(o)) {
    const name = String(p?.name || p?.id || '').toLowerCase();
    if (!szukane.some((n) => name === n || name.includes(n))) continue;
    const vals = Array.isArray(p.values) ? p.values : (Array.isArray(p.valuesLabels) ? p.valuesLabels : []);
    const v = vals.length ? vals.join(', ') : (p.value || p.rangeValue?.from || '');
    if (v !== undefined && v !== null && String(v).trim()) return tekst(v, 300).trim();
  }
  return '';
}
function allegroOpisTekst(desc) {
  const sections = Array.isArray(desc?.sections) ? desc.sections : [];
  const parts = [];
  for (const s of sections) {
    for (const item of (Array.isArray(s?.items) ? s.items : [])) {
      if (item?.type === 'TEXT' && item.content) parts.push(String(item.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
  }
  return tekst(parts.join('\n\n'), 20000);
}
function allegroZdjecia(o) {
  const imgs = [];
  if (Array.isArray(o?.images)) imgs.push(...o.images);
  if (Array.isArray(o?.productSet)) {
    for (const item of o.productSet) {
      if (Array.isArray(item?.product?.images)) imgs.push(...item.product.images);
    }
  }
  return [...new Set(imgs.map((x) => tekst(x?.url || x, 1000).trim()).filter(Boolean))].slice(0, 16);
}
function allegroStatusKolejkiZamowienia(z, poprzednie = {}) {
  const status = String(z?.status || '').trim().toUpperCase();
  const fulfillment = String(z?.fulfillmentStatus || z?.fulfillment?.status || '').trim().toUpperCase();
  if (status === 'CANCELLED' || fulfillment === 'CANCELLED') return 'CANCELLED';
  return fulfillment || 'NEW';
}
function allegroEtapMagazynu(z = {}, poprzednie = {}) {
  const terminal = ['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(allegroStatusKolejkiZamowienia(z, poprzednie));
  if (terminal) return 'zamkniete';
  const zapisany = String(z?.warehouseStage || poprzednie?.warehouseStage || '').toLowerCase();
  return ['do_sprawdzenia', 'braki', 'kompletacja', 'spakowane', 'zrealizowane'].includes(zapisany) ? zapisany : 'do_sprawdzenia';
}
function allegroZamowienieJestNoweLubDoWyslania(z) {
  const status = String(z?.status || '').trim().toUpperCase();
  const fulfillment = String(z?.fulfillmentStatus || z?.fulfillment?.status || '').trim().toUpperCase();
  return status === 'READY_FOR_PROCESSING' && ['NEW', 'PROCESSING', 'READY_FOR_SHIPMENT', 'READY_FOR_PICKUP', 'SUSPENDED'].includes(fulfillment || 'NEW');
}
function allegroNormalizujZamowienie(z) {
  const buyer = z?.buyer || {};
  const delivery = z?.delivery || {};
  const address = delivery.address || {};
  const pickup = delivery.pickupPoint || {};
  const payment = z?.payment || {};
  const invoice = z?.invoice || {};
  const lineItems = Array.isArray(z?.lineItems) ? z.lineItems.map((it) => ({
    id: tekst(it.id, 80),
    offerId: tekst(it.offer?.id || it.offerId, 80),
    externalId: tekst(it.offer?.external?.id || it.externalId || '', 160),
    offerName: tekst(it.offer?.name || it.name, 300),
    quantity: Number(it.quantity) || 0,
    price: allegroKwotaText(it.price),
    originalPrice: allegroKwotaText(it.originalPrice),
    boughtAt: tekst(it.boughtAt, 80),
  })) : [];
  return {
    id: tekst(z.id, 100),
    nr: tekst(z.id, 100),
    status: tekst(z.status || z.fulfillment?.status || '', 80),
    fulfillmentStatus: tekst(z.fulfillment?.status || '', 80),
    createdAt: tekst(z.createdAt || lineItems[0]?.boughtAt || '', 80),
    updatedAt: tekst(z.updatedAt || '', 80),
    buyerLogin: tekst(buyer.login, 200),
    buyerName: tekst([buyer.firstName, buyer.lastName].filter(Boolean).join(' '), 250),
    email: tekst(buyer.email, 300).trim().toLowerCase(),
    phone: tekst(buyer.phoneNumber || address.phoneNumber, 80),
    company: tekst(address.companyName || invoice.company?.name || '', 250),
    deliveryMethod: tekst(delivery.method?.name || delivery.method || '', 250),
    deliveryCost: allegroKwotaText(delivery.cost),
    deliveryPoint: tekst(pickup.id || pickup.name || '', 160),
    deliveryAddress: tekst([address.street, address.zipCode, address.city].filter(Boolean).join(', '), 500),
    paymentStatus: tekst(payment.type || payment.provider || payment.finishedAt || '', 160),
    deliveryStatus: tekst(delivery.status || z.deliveryStatus || '', 80),
    shipmentStatus: tekst(z.shipmentSummary?.status || z.shipmentStatus || '', 80),
    revision: tekst(z.revision || z.checkoutForm?.revision || '', 160),
    total: allegroKwotaText(z.summary?.totalToPay || z.summary?.totalPrice || z.totalToPay),
    invoiceRequired: !!invoice.required,
    lineItems,
    rawUpdatedAt: new Date().toISOString(),
  };
}
function allegroScalZamowienie(z, poprzednie = {}) {
  const teraz = new Date().toISOString();
  const surowe = !!(z?.buyer || z?.delivery || z?.summary || z?.fulfillment || z?.invoice);
  const nowe = surowe ? allegroNormalizujZamowienie(z) : z;
  const allegroStatus = allegroStatusKolejkiZamowienia(nowe, poprzednie);
  const warehouseStage = allegroEtapMagazynu(nowe, poprzednie);
  return {
    ...poprzednie,
    ...nowe,
    allegroStatus,
    warehouseStage,
    firstFetchedAt: poprzednie.firstFetchedAt || nowe.createdAt || teraz,
    lastSeenAt: teraz,
    checkedAt: warehouseStage !== 'do_sprawdzenia' ? (poprzednie.checkedAt || teraz) : null,
  };
}
function allegroAgentProduktyCentralne(dane = {}) {
  const mapa = new Map();
  for (const p of Array.isArray(dane.artway_produkty_katalog) ? dane.artway_produkty_katalog : []) {
    const id = String(p?.id ?? '').trim();
    if (id) mapa.set(id, { ...p, id });
  }
  for (const p of Array.isArray(dane.artway_produkty_dodane) ? dane.artway_produkty_dodane : []) {
    const id = String(p?.id ?? '').trim();
    if (id) mapa.set(id, { ...p, id });
  }
  const edits = dane.artway_produkty_edytowane && typeof dane.artway_produkty_edytowane === 'object' ? dane.artway_produkty_edytowane : {};
  for (const [idRaw, p] of Object.entries(edits)) {
    const id = String(p?.id ?? idRaw).trim();
    if (id) mapa.set(id, { ...(mapa.get(id) || {}), ...(p || {}), id });
  }
  return mapa;
}
function allegroOpisKrotkiZTekstu(v = '') {
  const clean = tekst(v, 5000).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  return tekst(sentences.slice(0, 2).join(' ') || clean, 420).trim();
}
function allegroAktualizatorProduktowCentralnych(data = {}) {
  const added = Array.isArray(data.artway_produkty_dodane) ? data.artway_produkty_dodane.map((p) => ({ ...p })) : [];
  const addedIndex = new Map(added.map((p, index) => [String(p?.id ?? ''), index]));
  const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
  const catalog = Array.isArray(data.artway_produkty_katalog) ? data.artway_produkty_katalog.map((p) => ({ ...p })) : [];
  const catalogIndex = new Map(catalog.map((p, index) => [String(p?.id ?? ''), index]));
  let changed = false;
  const apply = (idRaw, fields = {}, remove = []) => {
    const id = String(idRaw ?? '').trim();
    if (!id) return false;
    const clean = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    const update = (base = {}) => {
      const next = { ...base, ...clean, id: base.id ?? (/^\d+$/.test(id) ? Number(id) : id) };
      for (const key of remove) delete next[key];
      return next;
    };
    let localChanged = false;
    if (addedIndex.has(id)) {
      const index = addedIndex.get(id), next = update(added[index]);
      if (JSON.stringify(next) !== JSON.stringify(added[index])) { added[index] = next; localChanged = true; }
      if (edits[id] && typeof edits[id] === 'object') {
        const nextEdit = update(edits[id]);
        if (JSON.stringify(nextEdit) !== JSON.stringify(edits[id])) { edits[id] = nextEdit; localChanged = true; }
      }
    } else {
      const next = update(edits[id] || {});
      if (JSON.stringify(next) !== JSON.stringify(edits[id] || {})) { edits[id] = next; localChanged = true; }
    }
    if (catalogIndex.has(id)) {
      const index = catalogIndex.get(id), next = update(catalog[index]);
      if (JSON.stringify(next) !== JSON.stringify(catalog[index])) { catalog[index] = next; localChanged = true; }
    }
    changed ||= localChanged;
    return localChanged;
  };
  const commit = () => {
    data.artway_produkty_dodane = added;
    data.artway_produkty_edytowane = edits;
    if (catalog.length) data.artway_produkty_katalog = catalog;
    return changed;
  };
  return { apply, commit, get changed() { return changed; } };
}
async function allegroAutoMapujOfertyZKartoteka(offers = []) {
  const [settingsRec, mappingsRec, offerSettings] = await Promise.all([
    czytaj('settings', { data: {}, rev: 0, updated_at: null }),
    czytaj('allegro_mappings', { items: {}, updated_at: null }),
    allegroPobierzUstawieniaOfert(),
  ]);
  const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
  let products = allegroAgentProduktyCentralne(data);
  const mappings = { ...allegroMapowaniaItems(mappingsRec) }, updater = allegroAktualizatorProduktowCentralnych(data);
  const offersById = new Map(allegroOfertyItems(offers).map((offer) => [String(offer?.id || ''), offer]));
  const now = new Date().toISOString();
  let quarantined = 0;
  if (offerSettings.autoCorrections !== false) for (const [offerId, current] of Object.entries(mappings)) {
    const productId = String(current?.productId || current?.previousProductId || '').trim(), product = products.get(productId), offer = offersById.get(String(offerId));
    if (current?.blocked === true) {
      if (product && (String(product.allegroOfferId || '') === String(offerId) || product.allegroMappingStatus === 'wymaga_sprawdzenia')) updater.apply(productId, { allegroMappingStatus: 'wymaga_sprawdzenia', ...(current.conflict ? { allegroMappingConflict: current.conflict } : {}) }, ['allegroOfferId', 'allegroProductId', 'allegroCategoryId']);
      continue;
    }
    if (!product || !offer || allegroPowiazanieWiarygodne(product, offer)) continue;
    mappings[offerId] = {
      ...current, offerId, previousProductId: productId, productId: '', blocked: true,
      operator: 'auto-quarantine:name-conflict', quarantined_at: now,
      conflict: { productName: tekst(product.nazwa || product.name, 300), offerName: tekst(offer.name, 300) },
    };
    updater.apply(productId, { allegroMappingStatus: 'wymaga_sprawdzenia', allegroMappingConflict: mappings[offerId].conflict }, ['allegroOfferId', 'allegroProductId', 'allegroCategoryId']);
    quarantined++;
  }
  updater.commit();
  products = allegroAgentProduktyCentralne(data);
  const used = new Map(Object.values(mappings).map((m) => [String(m?.offerId || ''), String(m?.productId || '')]).filter(([o, p]) => o && p && products.has(p)));
  let autoMapped = 0, refreshed = 0, descriptionsUpdated = 0, producersUpdated = 0, productsUpdated = 0;
  for (const product of products.values()) {
    const match = allegroDopasowanieOferty(product, offers, mappings);
    const offer = match?.offer;
    if (!offer?.id || (used.has(String(offer.id)) && used.get(String(offer.id)) !== String(product.id))) continue;
    const current = mappings[String(offer.id)] || {};
    if (current.blocked === true) continue;
    const record = {
      ...current, offerId: String(offer.id), productId: String(product.id), allegroProductId: tekst(offer.productId || product.allegroProductId, 120), categoryId: tekst(offer.categoryId || product.allegroCategoryId, 80),
      productName: tekst(product.nazwa || product.name, 300), linked_at: current.linked_at || new Date().toISOString(), synced_at: new Date().toISOString(), operator: current.operator || `auto:${match.reason}`,
    };
    if (!current.offerId) autoMapped++; else refreshed++;
    mappings[String(offer.id)] = record; used.set(String(offer.id), String(product.id));
    const producer = allegroRozpoznajProducenta(product, offer, offerSettings);
    const fields = {
      allegroOfferId: String(offer.id),
      ...(record.allegroProductId ? { allegroProductId: record.allegroProductId } : {}),
      ...(record.categoryId ? { allegroCategoryId: record.categoryId } : {}),
      ...(producer ? { producent: producer, marka: producer } : {}),
      allegroSyncedAt: record.synced_at, allegroSyncSource: 'offer-sync',
    };
    if (offerSettings.syncDescriptions !== false && tekst(offer.descriptionText, 20000).trim()) {
      fields.opis = tekst(offer.descriptionText, 20000).trim();
      fields.opisKrotki = allegroOpisKrotkiZTekstu(fields.opis);
      if (fields.opis !== tekst(product.opis, 20000).trim() || fields.opisKrotki !== tekst(product.opisKrotki, 420).trim()) descriptionsUpdated++;
    }
    if (producer && (producer !== product.producent || producer !== product.marka)) producersUpdated++;
    if (!product.zdjecie && offer.mainImage) fields.zdjecie = offer.mainImage;
    if ((!Array.isArray(product.zdjecia) || !product.zdjecia.length) && Array.isArray(offer.images) && offer.images.length > 1) fields.zdjecia = offer.images.slice(1, 16);
    if (updater.apply(product.id, fields, ['allegroMappingStatus', 'allegroMappingConflict'])) productsUpdated++;
  }
  const productDataChanged = updater.commit();
  if (autoMapped || refreshed || quarantined || productDataChanged) {
    await Promise.all([
      zapisz('allegro_mappings', { items: mappings, updated_at: now }),
      ...(productDataChanged ? [zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now })] : []),
    ]);
  }
  return { mappings, autoMapped, refreshed, quarantined, descriptionsUpdated, producersUpdated, productsUpdated };
}
function allegroAgentProduktDlaPozycji(line = {}, offer = {}, mappings = {}, products = new Map()) {
  const offerId = String(line.offerId || '').trim();
  const mapped = mappings[offerId];
  if (mapped?.blocked === true) return null;
  const mappedId = String(mapped?.productId ?? mapped?.produktId ?? mapped?.id ?? mapped ?? '').trim();
  if (mappedId && products.has(mappedId) && allegroPowiazanieWiarygodne(products.get(mappedId), { ...offer, name: offer.name || line.offerName, externalId: offer.externalId || line.externalId })) return { id: mappedId, product: products.get(mappedId), match: 'ręczne mapowanie oferty', confidence: 100 };
  const ext = allegroNormalizujKlucz(line.externalId || offer.externalId || '');
  const ean = allegroNormalizujKlucz(offer.ean || offer.gtin || '');
  const code = allegroNormalizujKlucz(offer.manufacturerCode || offer.producerCode || '');
  const name = allegroNormalizujKlucz(line.offerName || offer.name || '');
  const candidates = [...products.values()].map((p) => {
    const pe = allegroNormalizujKlucz(p.gtin || p.ean || '');
    const px = allegroNormalizujKlucz(p.externalId || p.sku || '');
    const pc = allegroNormalizujKlucz(p.kodProducenta || p.mpn || '');
    const pn = allegroNormalizujKlucz(p.nazwa || p.name || '');
    let score = 0, match = '';
    if (ean && pe === ean) { score = 99; match = 'EAN/GTIN'; }
    else if (ext && px === ext) { score = 96; match = 'SKU/external.id'; }
    else if (code && pc === code) { score = 93; match = 'kod producenta'; }
    else if (name && pn === name) { score = 90; match = 'identyczna nazwa'; }
    else {
      const similarity = allegroPodobienstwoNazw(line.offerName || offer.name || '', p.nazwa || p.name || '');
      if (similarity >= 0.9) { score = 82 + Math.round(similarity * 6); match = 'bardzo podobna nazwa'; }
    }
    return score ? { product: p, score, match } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  const best = candidates[0], second = candidates[1];
  if (!best || best.score < 88 || (second && best.score - second.score < 5)) return null;
  return { id: String(best.product.id), product: best.product, match: best.match, confidence: best.score };
}
function allegroAgentZlecenieAktywne(z = {}) {
  const official = allegroStatusKolejkiZamowienia(z, {});
  const local = [z.warehouseStage, z.agentStage, z.localStage, z.magazynStatus, z.localStatus]
    .map((value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l'));
  const completedLocally = local.some((value) => ['zrealizowane', 'zamkniete', 'wyslane', 'anulowane'].includes(value))
    || z.agentHandled === true || z.localCompleted === true;
  return !['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(official) && !completedLocally;
}
function allegroAgentPodsumujDokument(z = {}) {
  const pozycje = Array.isArray(z.pozycje) ? z.pozycje : [];
  return {
    ...z,
    pozycje,
    sztuk: pozycje.reduce((s, p) => s + Math.max(0, Number(p.ilosc) || 0), 0),
    wartoscSzacowana: Number(pozycje.reduce((s, p) => s + Math.max(0, Number(p.ilosc) || 0) * Math.max(0, Number(p.cenaBrutto) || 0), 0).toFixed(2)),
    dostawcy: [...new Set(pozycje.map((p) => tekst(p.dostawca || 'Bez przypisanego dostawcy', 120)))],
    aktualizacja: new Date().toISOString(),
  };
}
async function allegroAgentPrzetworzZamowienia(items = [], options = {}) {
  const [settingsRec, offersRec, mappingsRec] = await Promise.all([
    czytaj('settings', { data: {}, rev: 0, updated_at: null }),
    czytaj('allegro_offers', { items: [] }),
    czytaj('allegro_mappings', { items: {} }),
  ]);
  const dane = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
  const stany = dane.artway_stany && typeof dane.artway_stany === 'object' ? dane.artway_stany : {};
  const kartoteki = dane.artway_magazyn_produkty && typeof dane.artway_magazyn_produkty === 'object' ? dane.artway_magazyn_produkty : {};
  const products = allegroAgentProduktyCentralne(dane);
  const offers = new Map(allegroOfertyItems(offersRec).map((o) => [String(o.id || ''), o]));
  const mappings = allegroMapowaniaItems(mappingsRec);
  const aktywne = (Array.isArray(items) ? items : []).filter(allegroAgentZlecenieAktywne);
  const noweIds = new Set((Array.isArray(options.newOrderIds) ? options.newOrderIds : []).map((id) => String(id)));
  const swiezyLimit = Date.now() - 48 * 60 * 60 * 1000;
  const automatyczneIds = new Set(aktywne.filter((z) => {
    if (noweIds.has(String(z.id || z.nr || ''))) return true;
    if (z.agentReviewedAt) return false;
    const data = Date.parse(z.createdAt || z.firstFetchedAt || '');
    return Number.isFinite(data) && data >= swiezyLimit;
  }).map((z) => String(z.id || z.nr || '')));
  const lineMatches = new Map(), reservations = new Map(), refs = new Map(), autoReservations = new Map(), autoRefs = new Map(), productDetails = new Map();
  let autoMapped = 0;
  for (const z of aktywne) {
    const orderId = String(z.id || z.nr || '').trim();
    const matched = [];
    for (const line of Array.isArray(z.lineItems) ? z.lineItems : []) {
      const offerId = String(line.offerId || '').trim();
      const offer = offers.get(offerId) || {};
      const match = allegroAgentProduktDlaPozycji(line, offer, mappings, products);
      const quantity = Math.max(1, Number(line.quantity) || 1);
      const rec = { line, offer, match, quantity };
      matched.push(rec);
      if (match?.id) {
        const currentMapping = mappings[offerId];
        const currentMappedId = String(currentMapping?.productId ?? currentMapping?.produktId ?? currentMapping?.id ?? currentMapping ?? '').trim();
        if (offerId && (!mappings[offerId] || (currentMappedId && !products.has(currentMappedId)))) {
          mappings[offerId] = { offerId, productId: String(match.id), allegroProductId: tekst(offer.productId || '', 120), categoryId: tekst(offer.categoryId || '', 80), productName: tekst(match.product?.nazwa || match.product?.name || line.offerName || '', 300), linked_at: new Date().toISOString(), synced_at: new Date().toISOString(), operator: `auto-order:${match.match}`, confidence: Number(match.confidence || 0) };
          autoMapped++;
        }
        reservations.set(match.id, (reservations.get(match.id) || 0) + quantity);
        if (!refs.has(match.id)) refs.set(match.id, new Map());
        refs.get(match.id).set(orderId, (refs.get(match.id).get(orderId) || 0) + quantity);
        if (!productDetails.has(match.id)) productDetails.set(match.id, { line, offer, match });
        if (automatyczneIds.has(orderId)) {
          autoReservations.set(match.id, (autoReservations.get(match.id) || 0) + quantity);
          if (!autoRefs.has(match.id)) autoRefs.set(match.id, new Map());
          autoRefs.get(match.id).set(orderId, (autoRefs.get(match.id).get(orderId) || 0) + quantity);
        }
      }
    }
    lineMatches.set(orderId, matched);
  }
  let supplierOrders = Array.isArray(dane.artway_agent_ai_zlecenia) ? dane.artway_agent_ai_zlecenia.map((z) => ({ ...z, pozycje: Array.isArray(z.pozycje) ? z.pozycje.map((p) => ({ ...p })) : [] })) : [];
  const aktywneDokumenty = supplierOrders.filter((z) => !['zrealizowane', 'anulowane'].includes(String(z.status || '').toLowerCase()));
  const covered = new Map();
  for (const z of aktywneDokumenty) for (const p of z.pozycje) {
    const id = String(p.produktId || '').trim();
    if (id) covered.set(id, (covered.get(id) || 0) + Math.max(0, (Number(p.ilosc) || 0) - (Number(p.przyjeto) || 0)));
  }
  const shortages = [];
  for (const [productId, reserved] of autoReservations.entries()) {
    const known = Object.prototype.hasOwnProperty.call(stany, productId) && stany[productId] !== '' && stany[productId] != null && Number.isFinite(Number(stany[productId]));
    if (!known) continue;
    const stock = Math.max(0, Number(stany[productId]) || 0), shortage = Math.max(0, reserved - stock), remaining = Math.max(0, shortage - (covered.get(productId) || 0));
    if (!remaining) continue;
    const product = products.get(productId) || { id: productId };
    const meta = kartoteki[productId] && typeof kartoteki[productId] === 'object' ? kartoteki[productId] : {};
    const detail = productDetails.get(productId) || {}, offer = detail.offer || {}, line = detail.line || {};
    const orderRefs = [...(autoRefs.get(productId) || new Map()).entries()].map(([nr, qty]) => `Allegro ${nr} × ${qty}`).slice(0, 30);
    shortages.push({
      produktId: productId,
      kod: tekst(product.sku || product.externalId || line.externalId || offer.externalId || offer.manufacturerCode || meta.kod || productId, 120),
      ean: tekst(product.gtin || product.ean || offer.ean || offer.gtin || '', 80),
      nazwa: tekst(product.nazwa || product.name || line.offerName || offer.name || `Produkt ${productId}`, 300),
      kategoria: tekst(product.kategoria || '', 160),
      ilosc: remaining,
      iloscPotrzebna: remaining,
      brakCalkowity: shortage,
      juzZamowiono: covered.get(productId) || 0,
      stan: stock,
      rezerwacje: reserved,
      dostepne: stock - reserved,
      przyjeto: 0,
      nadwyzka: 0,
      lokalizacja: tekst(meta.lokalizacja || '', 120),
      dostawca: tekst(meta.dostawca || 'Bez przypisanego dostawcy', 120) || 'Bez przypisanego dostawcy',
      powod: `Zlecenia Allegro rezerwują ${reserved} szt.; stan ${stock}; brak ${shortage} szt.`,
      zamowienia: orderRefs,
      cenaBrutto: Math.max(0, Number(product.cenaZakupu || product.cena || product.price) || 0),
      wartoscSzacowana: Number((remaining * Math.max(0, Number(product.cenaZakupu || product.cena || product.price) || 0)).toFixed(2)),
    });
  }
  let dokumentyZmienione = 0;
  const editable = new Set(['szkic', 'do sprawdzenia', 'zaakceptowane', 'wysłane na telegram']);
  for (const shortage of shortages) {
    let target = supplierOrders.find((z) => editable.has(String(z.status || 'szkic').toLowerCase()) && String(z.supplier || z.dostawcy?.[0] || z.pozycje?.[0]?.dostawca || 'Bez przypisanego dostawcy') === shortage.dostawca);
    const partialBlocker = supplierOrders.find((z) => String(z.status || '').toLowerCase() === 'częściowo wysłane e-mailem' && String(z.supplier || z.dostawcy?.[0] || z.pozycje?.[0]?.dostawca || '') === shortage.dostawca);
    if (!target && partialBlocker) continue;
    if (!target) {
      const now = new Date();
      target = {
        id: `AZ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        numer: `AZ/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(supplierOrders.length + 1).padStart(4, '0')}`,
        typ: 'zlecenie-producent', tryb: 'braki', status: 'szkic', data: now.toISOString(), dataTxt: now.toLocaleString('pl-PL'), operator: 'Agent Allegro', pozycje: [],
        supplier: shortage.dostawca, dostawcy: [shortage.dostawca], revision: 1,
        uwagi: `Automatyczny dokument roboczy braków dla producenta: ${shortage.dostawca}. Kolejne braki są dopisywane do tej wersji aż do zatwierdzenia i wysłania e-mailem.`,
      };
      supplierOrders.unshift(target);
    }
    const previousStatus = String(target.status || 'szkic').toLowerCase();
    const existing = target.pozycje.find((p) => String(p.produktId) === shortage.produktId);
    if (existing) {
      existing.ilosc = (Number(existing.ilosc) || 0) + shortage.ilosc;
      existing.iloscPotrzebna = (Number(existing.iloscPotrzebna) || 0) + shortage.iloscPotrzebna;
      existing.zamowienia = [...new Set([...(existing.zamowienia || []), ...shortage.zamowienia])].slice(0, 50);
      existing.powod = shortage.powod;
    } else target.pozycje.push(shortage);
    target.revision = Math.max(1, Number(target.revision) || 1) + (existing || target.pozycje.length > 1 ? 1 : 0);
    target.lastAutoUpdateAt = new Date().toISOString();
    target.updateSource = 'agent-allegro-live';
    if (target.telegramSentAt) { target.telegramLastSentAt = target.telegramSentAt; target.telegramSentAt = null; }
    if (['zaakceptowane', 'wysłane na telegram'].includes(previousStatus)) {
      target.status = 'do sprawdzenia';
      target.approvedAt = null;
      target.approvedBy = null;
      target.approvalRevision = null;
    }
    target.historia = [...(Array.isArray(target.historia) ? target.historia : []), { at: target.lastAutoUpdateAt, type: 'auto-update', text: `Dopisano aktualny brak: ${shortage.nazwa} × ${shortage.ilosc}` }].slice(-100);
    Object.assign(target, allegroAgentPodsumujDokument(target));
    dokumentyZmienione++;
  }
  let refsZmienione = 0;
  for (const z of supplierOrders) for (const p of z.pozycje || []) {
    const orderRefs = [...(autoRefs.get(String(p.produktId)) || new Map()).entries()].map(([nr, qty]) => `Allegro ${nr} × ${qty}`);
    if (orderRefs.length) {
      const before = (p.zamowienia || []).length;
      p.zamowienia = [...new Set([...(p.zamowienia || []), ...orderRefs])].slice(0, 50);
      if (p.zamowienia.length !== before) refsZmienione++;
    }
  }
  const supplierDocsByProduct = new Map();
  for (const z of supplierOrders.filter((x) => !['zrealizowane', 'anulowane'].includes(String(x.status || '').toLowerCase()))) for (const p of z.pozycje || []) {
    const id = String(p.produktId || '');
    if (!id) continue;
    if (!supplierDocsByProduct.has(id)) supplierDocsByProduct.set(id, []);
    supplierDocsByProduct.get(id).push({ id: z.id, numer: z.numer, status: z.status, dostawca: p.dostawca, ilosc: p.ilosc });
  }
  const now = new Date().toISOString();
  const updatedItems = (Array.isArray(items) ? items : []).map((z) => {
    if (!allegroAgentZlecenieAktywne(z)) return z;
    const orderId = String(z.id || z.nr || '');
    const positions = (lineMatches.get(orderId) || []).map(({ line, offer, match, quantity }) => {
      if (!match?.id) return { offerId: line.offerId, nazwa: line.offerName || offer.name || 'Produkt Allegro', ilosc: quantity, decision: 'nierozpoznany', reason: 'Brak jednoznacznego EAN/SKU lub mapowania oferty' };
      const productId = match.id, meta = kartoteki[productId] && typeof kartoteki[productId] === 'object' ? kartoteki[productId] : {};
      const known = Object.prototype.hasOwnProperty.call(stany, productId) && stany[productId] !== '' && stany[productId] != null && Number.isFinite(Number(stany[productId]));
      const stock = known ? Math.max(0, Number(stany[productId]) || 0) : null, reserved = reservations.get(productId) || 0, available = stock === null ? null : stock - reserved, shortage = stock === null ? null : Math.max(0, -available);
      const docs = supplierDocsByProduct.get(productId) || [];
      const decision = !known ? 'sprawdz_stan' : shortage > 0 ? 'zamow_u_producenta' : !meta.lokalizacja ? 'uzupelnij_lokalizacje' : 'kompletuj';
      return { offerId: line.offerId, productId, nazwa: line.offerName || match.product?.nazwa || offer.name || `Produkt ${productId}`, ilosc: quantity, match: match.match, confidence: Number(match.confidence || 0), stock, reserved, available, shortage, location: tekst(meta.lokalizacja || '', 120), supplier: tekst(meta.dostawca || '', 120), supplierOrders: docs, decision };
    });
    const nierozpoznane = positions.filter((p) => p.decision === 'nierozpoznany').length;
    const bezStanu = positions.filter((p) => p.decision === 'sprawdz_stan').length;
    const bezLokalizacji = positions.filter((p) => p.decision === 'uzupelnij_lokalizacje').length;
    const braki = positions.reduce((sum, p) => sum + Math.max(0, Number(p.shortage) || 0), 0);
    let warehouseStage = String(z.warehouseStage || 'do_sprawdzenia').toLowerCase();
    if (!['spakowane', 'zrealizowane'].includes(warehouseStage)) warehouseStage = braki > 0 ? 'braki' : (nierozpoznane || bezStanu || bezLokalizacji) ? 'do_sprawdzenia' : 'kompletacja';
    return { ...z, warehouseStage, warehouseStageUpdatedAt: now, agentReviewedAt: now, agentVersion: 'allegro-stock-agent-v1', agentAnalysis: { positions, nierozpoznane, bezStanu, bezLokalizacji, braki, gotowe: !nierozpoznane && !bezStanu && !bezLokalizacji && !braki } };
  });
  if (autoMapped) await zapisz('allegro_mappings', { items: mappings, updated_at: now });
  if (dokumentyZmienione || shortages.length || refsZmienione) {
    dane.artway_agent_ai_zlecenia = supplierOrders.slice(0, 1000);
    const historia = Array.isArray(dane.artway_agent_ai_historia) ? dane.artway_agent_ai_historia : [];
    historia.unshift({ id: `AI-${Date.now().toString(36)}`, typ: 'allegro-magazyn', opis: `Agent sprawdził ${aktywne.length} zleceń Allegro i dopisał ${shortages.length} braków z nowych zleceń do dokumentów producentów.`, data: now, dataTxt: new Date().toLocaleString('pl-PL'), operator: 'Agent Allegro', dane: { zlecenia: aktywne.length, noweDoAutomatyzacji: automatyczneIds.size, braki: shortages.length, dokumentyZmienione } });
    dane.artway_agent_ai_historia = historia.slice(0, 500);
    await zapisz('settings', { ...settingsRec, data: dane, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now });
  }
  const activeIds = new Set(aktywne.map((z) => String(z.id || z.nr || '')));
  return { items: updatedItems, mappings, report: { reviewed: aktywne.length, autoEligible: automatyczneIds.size, autoMapped, shortagesAdded: shortages.length, supplierDocumentsChanged: dokumentyZmienione, supplierReferencesChanged: refsZmienione, unresolved: updatedItems.filter((z) => activeIds.has(String(z.id || z.nr || ''))).reduce((s, z) => s + Number(z.agentAnalysis?.nierozpoznane || 0) + Number(z.agentAnalysis?.bezStanu || 0), 0), ready: updatedItems.filter((z) => activeIds.has(String(z.id || z.nr || '')) && z.agentAnalysis?.gotowe).length, at: now } };
}
async function allegroPrzeliczZamowieniaPoMapowaniu() {
  const rec = await czytaj('allegro_orders', { items: [], updated_at: null });
  const source = Array.isArray(rec.items) ? rec.items : [];
  const result = await allegroAgentPrzetworzZamowienia(source, { newOrderIds: [] });
  const updated_at = new Date().toISOString();
  const zapis = { ...rec, items: result.items, updated_at, agent: result.report };
  await zapisz('allegro_orders', zapis);
  return { orders: result.items, agent: result.report, updated_at };
}
function allegroNormalizujOferte(o) {
  const price = o?.sellingMode?.price || o?.price || {};
  const stock = o?.stock || {};
  const images = allegroZdjecia(o);
  const ean = allegroWartoscParametru(o, ['ean', 'gtin', 'kod ean']);
  const kodProducenta = allegroWartoscParametru(o, ['kod producenta', 'mpn', 'symbol']);
  const marka = allegroWartoscParametru(o, ['marka', 'producent', 'brand']);
  return {
    id: tekst(o.id, 100),
    name: tekst(o.name, 400),
    externalId: tekst(o.external?.id || o.externalId || '', 160),
    status: tekst(o.publication?.status || o.status || '', 80),
    price: price?.amount || '',
    priceText: allegroKwotaText(price),
    stockAvailable: stock.available ?? '',
    stockSold: stock.sold ?? '',
    categoryId: tekst(o.category?.id || o.categoryId || '', 80),
    productId: tekst(o.product?.id || o.productSet?.[0]?.product?.id || '', 120),
    ean: tekst(ean, 80),
    gtin: tekst(ean, 80),
    manufacturerCode: tekst(kodProducenta, 120),
    producerCode: tekst(kodProducenta, 120),
    brand: tekst(marka, 160),
    images,
    mainImage: images[0] || '',
    parameters: allegroParametry(o).map((p) => ({
      id: tekst(p.id, 80),
      name: tekst(p.name, 160),
      values: Array.isArray(p.values) ? p.values.map((v) => tekst(v, 300)) : [],
      valuesIds: Array.isArray(p.valuesIds) ? p.valuesIds.map((v) => tekst(v, 120)) : [],
    })).slice(0, 120),
    descriptionText: allegroOpisTekst(o.description),
    productSet: Array.isArray(o.productSet) ? o.productSet.slice(0, 5) : [],
    delivery: o.delivery || null,
    payments: o.payments || null,
    afterSalesServices: o.afterSalesServices || null,
    publication: o.publication || null,
    location: o.location || null,
    updatedAt: tekst(o.updatedAt || o.createdAt || '', 80),
    rawUpdatedAt: new Date().toISOString(),
  };
}
function allegroScalSzczegolyOferty(previous = {}, next = {}, detailed = false) {
  if (detailed || !previous?.id) return next;
  const merged = { ...previous, ...next };
  const richFields = ['productId', 'ean', 'gtin', 'manufacturerCode', 'producerCode', 'brand', 'images', 'mainImage', 'parameters', 'descriptionText', 'productSet', 'delivery', 'payments', 'afterSalesServices', 'publication', 'location'];
  for (const field of richFields) {
    const value = next[field];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) merged[field] = previous[field];
  }
  return merged;
}
function allegroMapowaniaItems(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return raw.items && typeof raw.items === 'object' ? raw.items : raw;
}

function allegroNormalizujKlucz(v = '') {
  return tekst(v, 500).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function allegroTokeny(v = '') {
  return new Set(allegroNormalizujKlucz(v).split(/\s+/).filter((x) => x.length > 2));
}
function allegroPodobienstwoNazw(a = '', b = '') {
  const aa = allegroTokeny(a), bb = allegroTokeny(b);
  if (!aa.size || !bb.size) return 0;
  let wspolne = 0;
  for (const x of aa) if (bb.has(x)) wspolne++;
  return wspolne / Math.max(aa.size, bb.size);
}
function allegroPowiazanieWiarygodne(product = {}, offer = {}) {
  const offerName = tekst(offer.name || offer.offerName, 400).trim();
  const hasOfferEvidence = !!(offerName || offer.productId || offer.ean || offer.gtin || offer.externalId || offer.manufacturerCode || offer.producerCode);
  if (!hasOfferEvidence) return true;
  const exactIdentity = [
    [product.gtin || product.ean, offer.ean || offer.gtin],
    [product.externalId || product.sku, offer.externalId],
    [product.kodProducenta || product.mpn, offer.manufacturerCode || offer.producerCode],
  ].some(([left, right]) => left && right && allegroNormalizujKlucz(left) === allegroNormalizujKlucz(right));
  if (exactIdentity) return true;
  const productName = tekst(product.nazwa || product.name, 400).trim();
  const similarity = productName && offerName ? allegroPodobienstwoNazw(productName, offerName) : 0;
  const sameCatalog = product.allegroProductId && offer.productId && String(product.allegroProductId) === String(offer.productId);
  if (sameCatalog) return !productName || !offerName || similarity >= 0.3;
  if (!productName || !offerName) return false;
  if (allegroNormalizujKlucz(productName) === allegroNormalizujKlucz(offerName)) return true;
  return similarity >= 0.5;
}
function allegroOfertyItems(raw) {
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw?.items) ? raw.items : [];
}
function allegroDopasowanieOferty(product = {}, offersRaw = [], mappingsRaw = {}) {
  const offers = allegroOfertyItems(offersRaw);
  const mappings = allegroMapowaniaItems(mappingsRaw);
  const pid = String(product.id ?? '').trim();
  const offerId = tekst(product.allegroOfferId, 100).trim();
  const catalogProductId = tekst(product.allegroProductId, 120).trim();
  const external = allegroNormalizujKlucz(product.externalId || product.sku || product.kodProducenta || product.mpn || '');
  const ean = allegroNormalizujKlucz(product.gtin || product.ean || '');
  const code = allegroNormalizujKlucz(product.kodProducenta || product.mpn || '');
  const name = allegroNormalizujKlucz(product.nazwa || product.name || '');
  const mappedOfferId = Object.values(mappings).find((m) => String(m?.productId ?? '') === pid)?.offerId || '';
  let best = null;
  for (const o of offers) {
    let score = 0, reason = '';
    if (offerId && String(o.id) === offerId && allegroPowiazanieWiarygodne(product, o)) { score = 100; reason = 'zapisane ID oferty'; }
    else if (mappedOfferId && String(o.id) === String(mappedOfferId) && allegroPowiazanieWiarygodne(product, o)) { score = 98; reason = 'mapowanie produktu'; }
    else if (catalogProductId && String(o.productId || '') === catalogProductId && allegroPowiazanieWiarygodne(product, o)) { score = 97; reason = 'identyczne ID produktu katalogowego Allegro'; }
    else if (external && allegroNormalizujKlucz(o.externalId) === external) { score = 95; reason = 'identyczny external.id / SKU'; }
    else if (ean && allegroNormalizujKlucz(o.ean || o.gtin) === ean) { score = 92; reason = 'identyczny EAN/GTIN'; }
    else if (code && allegroNormalizujKlucz(o.manufacturerCode || o.producerCode) === code) { score = 88; reason = 'identyczny kod producenta'; }
    else if (name && allegroNormalizujKlucz(o.name) === name) { score = 86; reason = 'identyczna nazwa oferty'; }
    else {
      const similarity = allegroPodobienstwoNazw(product.nazwa || product.name, o.name);
      const sameCategory = product.allegroCategoryId && String(product.allegroCategoryId) === String(o.categoryId || '');
      if (similarity >= 0.82) { score = 70 + Math.round(similarity * 10) + (sameCategory ? 5 : 0); reason = 'bardzo podobna nazwa'; }
    }
    if (!best || score > best.score) best = score ? { offer: o, score, reason } : best;
  }
  return best && best.score >= 85 ? best : null;
}
function allegroPodobneOferty(product = {}, offersRaw = [], limit = 5) {
  return allegroOfertyItems(offersRaw).map((o) => {
    const similarity = allegroPodobienstwoNazw(product.nazwa || product.name, o.name);
    const sameCategory = product.allegroCategoryId && String(product.allegroCategoryId) === String(o.categoryId || '');
    return { offer: o, score: similarity + (sameCategory ? 0.25 : 0) };
  }).filter((x) => x.score >= 0.18).sort((a, b) => b.score - a.score).slice(0, limit);
}
function allegroZdania(v = '') {
  return tekst(v, 20000).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 18);
}
function allegroOpisKrotki(product = {}, podobne = []) {
  const wlasny = tekst(product.opisKrotki || product.krotkiOpis || product.shortDescription, 500).trim();
  if (wlasny) return tekst(allegroZdania(wlasny).slice(0, 2).join(' ') || wlasny, 420).trim();
  const opis = allegroZdania(product.opis || '').filter((x) => !/^(zawartość|w zestawie|wymiary|ostrzeżenie)/i.test(x));
  if (opis.length) return tekst(opis.slice(0, 2).join(' '), 420).trim();
  const nazwy = podobne.map((x) => x.offer?.name).filter(Boolean);
  const kat = tekst(product.kategoria || 'gry i zabawki', 120).toLowerCase();
  const inspiracja = nazwy.length ? ` Pasuje do produktów wyszukiwanych także jako: ${nazwy.slice(0, 2).map((x) => tekst(x, 70)).join(' oraz ')}.` : '';
  return tekst(`${product.nazwa || 'Produkt'} to starannie wybrana propozycja z kategorii ${kat}, odpowiednia na prezent i do wspólnej zabawy.${inspiracja}`, 420);
}
function allegroOpisPelny(product = {}, shortDescription = '') {
  const blocks = [];
  if (shortDescription) blocks.push({ type: 'lead', text: shortDescription });
  const raw = tekst(product.opis || '', 20000)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s*[•·▪◦]\s*/g, '\n• ')
    .replace(/\b(Opis produktu|Najważniejsze cechy|Cechy produktu|Zawartość opakowania|W zestawie|Skład zestawu|Zasady gry|Jak grać|Wymiary|Dane techniczne|Informacje dodatkowe|Ostrzeżenie|Bezpieczeństwo)\s*:/gi, '\n\n$1\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const heading = /^(opis produktu|najważniejsze cechy|cechy produktu|zawartość opakowania|w zestawie|skład zestawu|zasady gry|jak grać|wymiary|dane techniczne|informacje dodatkowe|ostrzeżenie|bezpieczeństwo)$/i;
  const sourceBlocks = raw.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  let currentTitle = '';
  for (const source of sourceBlocks) {
    const lines = source.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    for (const line of lines) {
      if (heading.test(line)) { currentTitle = line; continue; }
      if (/^•\s+/.test(line)) {
        const last = blocks[blocks.length - 1];
        if (last?.type === 'list' && (!currentTitle || last.title === currentTitle)) last.items.push(line.replace(/^•\s+/, ''));
        else blocks.push({ type: 'list', title: currentTitle, items: [line.replace(/^•\s+/, '')] });
        currentTitle = '';
        continue;
      }
      const sentences = allegroZdania(line);
      const parts = sentences.length > 3 ? Array.from({ length: Math.ceil(sentences.length / 2) }, (_, i) => sentences.slice(i * 2, i * 2 + 2).join(' ')) : [line];
      for (const text of parts.filter(Boolean)) {
        blocks.push({ type: 'body', title: currentTitle, text });
        currentTitle = '';
      }
    }
  }
  if (!blocks.some((x) => x.type === 'body' || x.type === 'list') && shortDescription) blocks.push({ type: 'body', title: 'Opis produktu', text: shortDescription });
  const rawKey = allegroNormalizujKlucz(raw), facts = [
    product.marka || product.producent ? `Marka: ${product.marka || product.producent}` : '',
    product.kodProducenta || product.mpn ? `Kod producenta: ${product.kodProducenta || product.mpn}` : '',
    product.gtin || product.ean ? `EAN/GTIN: ${product.gtin || product.ean}` : '',
    product.rozmiar ? `Rozmiar: ${product.rozmiar}` : '',
    product.material ? `Materiał: ${product.material}` : '',
  ].filter(Boolean).filter((fact) => !rawKey.includes(allegroNormalizujKlucz(fact)));
  if (facts.length) blocks.push({ type: 'facts', items: facts });
  return blocks.slice(0, 12);
}
function allegroOpisPelnyTekst(product = {}, shortDescription = '') {
  return allegroOpisPelny(product, shortDescription).filter((x) => x.type !== 'lead').map((x) => {
    if (x.type === 'body') return [x.title, x.text].filter(Boolean).join('\n\n');
    if (x.type === 'list') return [x.title, ...(x.items || []).map((item) => `• ${item}`)].filter(Boolean).join('\n\n');
    if (x.type === 'facts') return ['Najważniejsze informacje', ...(x.items || []).map((item) => `• ${item}`)].join('\n\n');
    return '';
  }).filter(Boolean).join('\n\n');
}
function allegroSekcjeOpisu(product = {}, shortDescription = '') {
  const blocks = allegroOpisPelny(product, shortDescription);
  const items = [];
  for (const block of blocks) {
    if (block.type === 'lead') items.push({ type: 'TEXT', content: `<p><b>${htmlEscape(block.text)}</b></p>` });
    if (block.type === 'body' && block.text !== shortDescription) items.push({ type: 'TEXT', content: `${block.title ? `<h2>${htmlEscape(block.title)}</h2>` : ''}<p>${htmlEscape(block.text)}</p>` });
    if (block.type === 'list') items.push({ type: 'TEXT', content: `${block.title ? `<h2>${htmlEscape(block.title)}</h2>` : ''}<ul>${block.items.map((x) => `<li>${htmlEscape(x)}</li>`).join('')}</ul>` });
    if (block.type === 'facts') items.push({ type: 'TEXT', content: `<h2>Najważniejsze informacje</h2><ul>${block.items.map((x) => `<li>${htmlEscape(x)}</li>`).join('')}</ul>` });
  }
  const images = [product.zdjecie, ...(Array.isArray(product.zdjecia) ? product.zdjecia : [])].filter(Boolean);
  const sections = [];
  for (let i = 0; i < items.length; i++) {
    sections.push({ items: [items[i]] });
    if (images[i + 1] && (i === 0 || i === 2 || i === 4)) sections.push({ items: [{ type: 'IMAGE', url: tekst(images[i + 1], 1000) }] });
  }
  return sections.length ? sections : [{ items: [{ type: 'TEXT', content: `<p>${htmlEscape(product.nazwa || 'Produkt')}</p>` }] }];
}
function allegroPatchZDraftu(draft = {}, options = {}) {
  const out = {};
  if (draft.name) out.name = draft.name;
  if (Number(draft.sellingMode?.price?.amount) > 0) out.sellingMode = draft.sellingMode;
  if (draft.stock?.available !== undefined) out.stock = draft.stock;
  if (draft.external?.id) out.external = draft.external;
  if (Array.isArray(draft.images) && draft.images.length) out.images = draft.images;
  if (Array.isArray(draft.description?.sections) && draft.description.sections.length) out.description = draft.description;
  if (draft.delivery) out.delivery = draft.delivery;
  if (draft.afterSalesServices) out.afterSalesServices = draft.afterSalesServices;
  if (Array.isArray(draft.parameters) && draft.parameters.length) out.parameters = draft.parameters;
  if (Array.isArray(draft.productSet) && draft.productSet[0]?.product?.id) out.productSet = draft.productSet;
  if (options.publicationAction === 'activate') out.publication = { status: 'ACTIVE', republish: true };
  else if (options.publicationAction === 'deactivate') out.publication = { status: 'INACTIVE', republish: true };
  else out.publication = { republish: true };
  return out;
}
async function allegroPobierzSzczegolyOfert(req, source, limit) {
  const out = [];
  const base = source.slice(0, limit);
  const batchSize = 25;
  for (let i = 0; i < base.length; i += batchSize) {
    const batch = base.slice(i, i + batchSize);
    const details = await Promise.all(batch.map(async (o) => {
      const id = tekst(o.id, 100);
      if (!id) return o;
      try {
        return await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(id)}`);
      } catch (productOfferError) {
        try { return await allegroWywolaj(req, `/sale/offers/${encodeURIComponent(id)}`); }
        catch (e) { return { ...o, detailError: tekst(e.message || productOfferError.message, 500) }; }
      }
    }));
    out.push(...details);
  }
  return out;
}
function htmlDecode(s = '') {
  const mapa = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
  return String(s || '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => mapa[m] || m).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n) || 32));
}
function stripHtml(s = '') {
  return htmlDecode(String(s || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
function attrHtml(tag = '', name = '') {
  const n = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\s${n}\\s*=\\s*["']([^"']*)["']`, 'i');
  return htmlDecode((String(tag || '').match(re) || [])[1] || '');
}
function metaHtml(html, name) {
  const szukane = String(name || '').toLowerCase();
  for (const m of String(html || '').matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = (attrHtml(tag, 'property') || attrHtml(tag, 'name') || attrHtml(tag, 'itemprop')).toLowerCase();
    if (key === szukane) return attrHtml(tag, 'content');
  }
  return '';
}
function absoluteUrl(base, u) {
  try { return new URL(u, base).toString(); } catch { return ''; }
}
function znajdzPoEtykiecie(text, label) {
  const re = new RegExp(`${label}\\s*[:\\n ]+([^\\n]{1,180})`, 'i');
  return tekst((text.match(re) || [])[1] || '', 180).trim();
}
function normalizujKluczParametru(s = '') {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function parametrySlownikoweZHtml(html = '') {
  const out = {};
  const source = String(html || '');
  const starts = [...source.matchAll(/<div\b[^>]*class=["'][^"']*\bdictionary__param\b[^"']*["'][^>]*>/gi)].map((m) => m.index).filter((x) => x >= 0);
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = starts[i + 1] || source.indexOf('</section>', start);
    const seg = source.slice(start, end > start ? end : start + 3500);
    const label = stripHtml((seg.match(/<span\b[^>]*class=["'][^"']*\bdictionary__name_txt\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) || [])[1] || '');
    if (!label || /podmiot odpowiedzialny/i.test(label)) continue;
    const values = [...seg.matchAll(/<[^>]*class=["'][^"']*\bdictionary__value_txt\b[^"']*["'][^>]*>([\s\S]*?)(?:<\/a>|<\/span>)/gi)]
      .map((m) => stripHtml(m[1]))
      .filter(Boolean);
    const val = values.join(', ').replace(/\s+\/\s*1\s*szt\.$/i, '').trim();
    if (val) out[normalizujKluczParametru(label)] = val;
  }
  return out;
}
function parametr(dict, labels = []) {
  const keys = Object.keys(dict || {});
  for (const label of labels) {
    const n = normalizujKluczParametru(label);
    const exact = keys.find((k) => k === n);
    if (exact) return tekst(dict[exact], 500).trim();
    const loose = keys.find((k) => k.includes(n) || n.includes(k));
    if (loose) return tekst(dict[loose], 500).trim();
  }
  return '';
}
function liczbaZTekstu(v) {
  if (v === null || v === undefined || v === '') return 0;
  const m = String(v).replace(/\s+/g, '').match(/(\d{1,6}(?:[,.]\d{1,2})?)/);
  return m ? Number(m[1].replace(',', '.')) || 0 : 0;
}
function cenaProduktuZHtml(html = '', text = '') {
  const kandydaci = [];
  const dodaj = (v, weight = 1) => {
    const n = liczbaZTekstu(v);
    if (n > 0) kandydaci.push({ n, weight });
  };
  dodaj(metaHtml(html, 'product:price:amount'), 9);
  dodaj((html.match(/id=["']projector_price_value["'][^>]*data-price=["']([^"']+)/i) || [])[1], 10);
  dodaj((html.match(/\bprice\s*:\s*parseFloat\((\d+(?:\.\d+)?)/i) || [])[1], 9);
  dodaj((html.match(/\bcena_raty\s*=\s*(\d+(?:\.\d+)?)/i) || [])[1], 8);
  dodaj((html.match(/\bvalue["']?\s*:\s*["'](\d+(?:\.\d+)?)["']/i) || [])[1], 7);
  const okolicaCeny = (html.match(/<[^>]+id=["']projector_prices_section["'][\s\S]{0,2500}/i) || [])[0] || '';
  for (const m of okolicaCeny.matchAll(/(\d{1,5}[,.]\d{2})\s*zł/gi)) dodaj(m[1], 6);
  for (const m of String(text || '').matchAll(/(\d{1,5}[,.]\d{2})\s*zł/gi)) dodaj(m[1], 1);
  kandydaci.sort((a, b) => b.weight - a.weight || a.n - b.n);
  return kandydaci[0]?.n || 0;
}
function jsonLdProdukty(html = '') {
  const produkty = [];
  const scripts = [...String(html || '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => htmlDecode(m[1]).trim()).filter(Boolean);
  const visit = (x) => {
    if (!x) return;
    if (Array.isArray(x)) return x.forEach(visit);
    if (typeof x !== 'object') return;
    const typ = Array.isArray(x['@type']) ? x['@type'].join(' ') : String(x['@type'] || '');
    if (/Product/i.test(typ)) produkty.push(x);
    if (x['@graph']) visit(x['@graph']);
  };
  for (const raw of scripts) {
    try { visit(JSON.parse(raw)); } catch {}
  }
  return produkty;
}
function kategoriaZBreadcrumbJsonLd(html = '') {
  for (const raw of [...String(html || '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => htmlDecode(m[1]).trim())) {
    try {
      const x = JSON.parse(raw);
      const typ = Array.isArray(x?.['@type']) ? x['@type'].join(' ') : String(x?.['@type'] || '');
      if (!/BreadcrumbList/i.test(typ)) continue;
      const items = Array.isArray(x.itemListElement) ? x.itemListElement : [];
      const names = items.map((it) => tekst(it?.item?.name || it?.name, 160).trim()).filter(Boolean);
      if (names.length >= 2) return names[names.length - 2] || names[names.length - 1] || '';
    } catch {}
  }
  return '';
}
function opisProduktuZHtml(html = '', title = '') {
  const meta = metaHtml(html, 'og:description') || metaHtml(html, 'description');
  const longDesc = (html.match(/<section\b[^>]*id=["']projector_longdescription["'][^>]*>([\s\S]*?)<\/section>/i) || [])[1] || '';
  const shortDesc = (html.match(/<div\b[^>]*class=["'][^"']*\bproduct_name__block\b[^"']*\b--description\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '';
  const cleanedLong = stripHtml(longDesc);
  if (cleanedLong && cleanedLong.length > 80) return tekst(cleanedLong, 12000);
  const cleanedShort = stripHtml(shortDesc);
  if (cleanedShort) return tekst(cleanedShort, 12000);
  if (meta && !/gry planszowe,\s*gry rodzinne/i.test(meta)) return tekst(stripHtml(meta), 12000);
  const text = stripHtml(html);
  const opisStart = text.indexOf(String(title || '').trim());
  return opisStart >= 0 ? tekst(text.slice(opisStart + String(title || '').length, opisStart + 8000), 12000) : '';
}
function opisKrotkiProduktuZHtml(html = '', opis = '') {
  const meta = metaHtml(html, 'og:description') || metaHtml(html, 'description');
  const shortDesc = (html.match(/<div\b[^>]*class=["'][^"']*\bproduct_name__block\b[^"']*\b--description\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '';
  const cleanedShort = stripHtml(shortDesc);
  if (cleanedShort && cleanedShort.length > 20) return tekst(cleanedShort, 500);
  if (meta && !/gry planszowe,\s*gry rodzinne/i.test(meta)) return tekst(stripHtml(meta), 500);
  const first = String(opis || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter((x) => x.length > 20).slice(0, 2).join(' ');
  return tekst(first || opis, 500);
}
function obrazkiProduktuZHtml(url = '', html = '') {
  const imageSet = new Set();
  const dodaj = (u) => {
    const a = absoluteUrl(url, htmlDecode(String(u || '').trim()));
    if (!a) return;
    if (/loader\.gif|favicon|logo|payment|platnos|bannery|standards|mask|sprite|icon-|\/icons?\//i.test(a)) return;
    if (!/\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(a)) return;
    imageSet.add(a);
  };
  dodaj(metaHtml(html, 'og:image'));
  for (const m of String(html || '').matchAll(/<link\b[^>]*rel=["']preload["'][^>]*as=["']image["'][^>]*>/gi)) dodaj(attrHtml(m[0], 'href'));
  for (const m of String(html || '').matchAll(/<img\b[^>]*(?:src|data-src|data-lazy|data-original)=["']([^"']+)["'][^>]*>/gi)) dodaj(m[1]);
  for (const m of String(html || '').matchAll(/(?:srcset|data-srcset)=["']([^"']+)["']/gi)) {
    String(m[1]).split(',').map((x) => x.trim().split(/\s+/)[0]).forEach(dodaj);
  }
  return [...imageSet].slice(0, 16);
}
function stanProducentaZHtml(html = '', ldProduct = {}) {
  const liczba = (v) => {
    const raw = String(v ?? '').trim();
    if (!raw) return null;
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };
  const inventory = liczba(ldProduct?.offers?.inventoryLevel?.value ?? ldProduct?.offers?.inventoryLevel ?? ldProduct?.inventoryLevel?.value ?? ldProduct?.inventoryLevel);
  if (inventory !== null) return { quantity: inventory, exact: true, source: 'schema.org inventoryLevel' };
  const source = String(html || '');
  const sizesStart = source.search(/\bsizes\s*:\s*\[/i);
  if (sizesStart >= 0) {
    const after = source.slice(sizesStart, sizesStart + 250000);
    const boundary = after.search(/\n\s*subscription\s*:/i);
    const sizesBlock = boundary > 0 ? after.slice(0, boundary) : after.slice(0, 100000);
    const amounts = [...sizesBlock.matchAll(/(?:^|[,\s{])amount\s*:\s*["']?(\d+(?:[.,]\d+)?)/g)].map((m) => liczba(m[1])).filter((n) => n !== null && n <= 10000000);
    if (amounts.length) return { quantity: amounts.reduce((sum, n) => sum + n, 0), exact: true, source: 'IdoSell sizes.amount', variants: amounts.length };
  }
  const patterns = [
    [/\b(?:availableQuantity|stockQuantity|quantityAvailable|inventoryQuantity)\b["']?\s*[:=]\s*["']?(\d+(?:[.,]\d+)?)/i, 'pole ilości w danych strony'],
    [/\bdata-(?:stock|quantity|available)=["'](\d+(?:[.,]\d+)?)["']/i, 'atrybut ilości produktu'],
    [/itemprop=["']inventoryLevel["'][^>]*(?:content|value)=["'](\d+(?:[.,]\d+)?)["']/i, 'microdata inventoryLevel'],
  ];
  for (const [pattern, label] of patterns) {
    const n = liczba((source.match(pattern) || [])[1]);
    if (n !== null) return { quantity: n, exact: true, source: label };
  }
  return { quantity: null, exact: false, source: '' };
}
function parsujProduktZHtml(url, html) {
  const text = stripHtml(html);
  const ldProduct = jsonLdProdukty(html)[0] || {};
  const dict = parametrySlownikoweZHtml(html);
  const title = metaHtml(html, 'og:title')
    || tekst(ldProduct.name, 300)
    || stripHtml((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '')
    || tekst((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1], 300);
  const cena = cenaProduktuZHtml(html, text) || liczbaZTekstu(ldProduct?.offers?.price);
  const zdjecia = obrazkiProduktuZHtml(url, html);
  const marka = parametr(dict, ['Marka', 'Producent', 'Brand']) || tekst(ldProduct.brand?.name || ldProduct.brand, 160).trim() || (/alexander/i.test(url + text) ? 'Alexander' : '');
  const symbol = parametr(dict, ['Symbol', 'Kod', 'SKU']) || tekst(ldProduct.sku, 120).trim();
  const kodProducentaRaw = parametr(dict, ['Kod producenta', 'MPN', 'Kod katalogowy']) || tekst(ldProduct.mpn, 120).trim();
  const eanRaw = parametr(dict, ['EAN', 'GTIN', 'Kod EAN']) || tekst(ldProduct.gtin13 || ldProduct.gtin || ldProduct.gtin12 || ldProduct.gtin14, 80).trim() || kodProducentaRaw;
  const ean = (String(eanRaw).match(/\b\d{8,14}\b/) || [])[0] || '';
  const statusHtml = stripHtml((html.match(/id=["']projector_status_description["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '');
  const statusDostepny = /produkt dostępny|\bdostępny\b|in stock|instock/i.test(statusHtml + ' ' + String(ldProduct?.offers?.availability || ''));
  const statusNiedostepny = /powiadom o dostępności|niedostępny|brak produktu|chwilowo niedostęp|outofstock/i.test(statusHtml + ' ' + String(ldProduct?.offers?.availability || ''));
  const stanProducenta = stanProducentaZHtml(html, ldProduct);
  const niedostepny = stanProducenta.quantity === 0 || statusNiedostepny || (!statusDostepny && /powiadom o dostępności|niedostępny|brak produktu|chwilowo niedostęp/i.test(text));
  const dostepny = stanProducenta.quantity !== null ? stanProducenta.quantity > 0 : (statusDostepny || (!niedostepny && /produkt dostępny|\bdostępny\b|in stock|instock/i.test(text)));
  const checkedAt = new Date().toISOString();
  const opis = opisProduktuZHtml(html, title);
  const opisKrotki = opisKrotkiProduktuZHtml(html, opis);
  const kategoria = kategoriaZBreadcrumbJsonLd(html);
  const parametry = {
    symbol,
    kodProducenta: kodProducentaRaw,
    ean,
    seria: parametr(dict, ['Seria']),
    wiek: parametr(dict, ['Wiek']),
    liczbaGraczy: parametr(dict, ['Liczba graczy']),
    wymiaryOpakowania: parametr(dict, ['Wymiary opakowania (dł/sz/wys)', 'Wymiary opakowania']),
    wagaOpakowania: parametr(dict, ['Waga opakowania']),
    ostrzezenie: parametr(dict, ['Ostrzeżenie']),
  };
  const missing = [];
  if (!title) missing.push('nazwa');
  if (!cena) missing.push('cena');
  if (!ean) missing.push('EAN');
  if (!zdjecia.length) missing.push('zdjęcia');
  if (!opisKrotki) missing.push('krótki opis');
  if (!opis) missing.push('opis');
  if (!dostepny && !niedostepny) missing.push('dostępność');
  const confidence = Math.max(20, 100 - missing.length * 14);
  return {
    ok: true,
    url,
    confidence,
    missing,
    product: {
      nazwa: stripHtml(title).replace(/\s+\|.*$/, ''),
      opisKrotki,
      opis,
      cena: cena || '',
      kategoria,
      zdjecie: zdjecia[0] || '',
      zdjecia: zdjecia.slice(1, 16),
      producent: marka,
      marka,
      gtin: ean,
      ean,
      mpn: symbol || kodProducentaRaw,
      kodProducenta: kodProducentaRaw || symbol,
      externalId: symbol || '',
      rozmiar: parametry.wymiaryOpakowania || '',
      producentUrl: url,
      sourceUrl: url,
      dostepnoscProducenta: dostepny ? 'dostępny' : (niedostepny ? 'niedostępny' : 'do sprawdzenia'),
      stanProducenta: stanProducenta.quantity === null ? '' : stanProducenta.quantity,
      stanProducentaDokladny: stanProducenta.exact,
      stanProducentaZrodlo: stanProducenta.source,
      producentStatus: niedostepny ? 'brak' : (dostepny ? (stanProducenta.quantity === null ? 'dostepny_nieznany' : 'dostepny') : 'nieznany'),
      producentSprawdzonoAt: checkedAt,
      parametryProducenta: parametry,
    },
    availability: { available: dostepny, text: statusHtml || (dostepny ? 'Produkt dostępny' : (niedostepny ? 'Niedostępny' : 'Do sprawdzenia')), quantity: stanProducenta.quantity, exact: stanProducenta.exact, source: stanProducenta.source, checkedAt },
  };
}
async function pobierzProduktProducenta(target = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(target, {
      redirect: 'follow', signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'pl-PL,pl;q=0.9,en;q=0.6',
      },
    });
    const html = await r.text();
    if (!r.ok || !html) { const e = new Error(`Nie udało się pobrać strony producenta (${r.status})`); e.status = 502; throw e; }
    return parsujProduktZHtml(r.url || target, html);
  } finally { clearTimeout(timer); }
}
function allegroNormTekst(s = '') {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function allegroFrazyKategorii(product = {}, opt = {}) {
  const p = product || {};
  const base = [
    opt.phrase,
    p.allegroCategoryPhrase,
    [p.marka, p.nazwa || p.name].filter(Boolean).join(' '),
    [p.nazwa || p.name, p.kategoria, p.kategoriaPelna].filter(Boolean).join(' '),
    p.nazwa || p.name,
    p.kategoriaPelna,
    p.kategoria,
    p.grupaKategorii,
  ].map((x) => tekst(x, 180).trim()).filter(Boolean);
  const allText = allegroNormTekst(base.join(' ') + ' ' + [p.opis, p.badge, p.producentUrl, p.sourceUrl].filter(Boolean).join(' '));
  if (/\b(gra|gry|plansz|planszowa|planszowe|karcian|edukacyjn|rodzinn)\b/.test(allText)) base.push('gry planszowe', 'gry edukacyjne', 'zabawki gry');
  if (/\b(zabaw|kreatywn|malowank|piaskow|ukladank|puzzle)\b/.test(allText)) base.push('zabawki kreatywne', 'zabawki edukacyjne');
  return [...new Set(base.map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length >= 2))].slice(0, 8);
}
function allegroSciezkaKategorii(rawPath) {
  const arr = Array.isArray(rawPath) ? rawPath : [];
  return arr.map((x) => {
    if (typeof x === 'string') return x;
    return tekst(x?.name || x?.id || '', 160).trim();
  }).filter(Boolean);
}
function allegroNormalizujKategorie(raw = {}, phrase = '') {
  const source = Array.isArray(raw?.matchingCategories) ? raw.matchingCategories
    : Array.isArray(raw?.matching_categories) ? raw.matching_categories
      : Array.isArray(raw?.categories) ? raw.categories
        : Array.isArray(raw?.items) ? raw.items
          : Array.isArray(raw) ? raw
            : [];
  return source.map((item) => {
    const c = item?.category || item || {};
    const path = allegroSciezkaKategorii(c.path || item.path || c.categoryPath || item.categoryPath);
    const name = tekst(c.name || item.name || '', 180).trim();
    if (!path.length && name) path.push(name);
    const id = tekst(c.id || item.id || '', 80).trim();
    return {
      id,
      name,
      parentId: tekst(c.parent?.id || item.parent?.id || c.parentId || item.parentId || '', 80).trim(),
      leaf: c.leaf ?? item.leaf ?? c.isLeaf ?? item.isLeaf ?? undefined,
      path,
      pathText: path.join(' › '),
      phrase,
      score: Number(item.score ?? item.matchScore ?? item.relevance ?? 0) || 0,
      raw: item,
    };
  }).filter((x) => x.id && x.name);
}
function allegroOcenKategorie(product = {}, cat = {}) {
  const p = product || {};
  const productText = allegroNormTekst([p.nazwa || p.name, p.kategoria, p.kategoriaPelna, p.grupaKategorii, p.opis, p.marka, p.badge].join(' '));
  const catText = allegroNormTekst([cat.name, cat.pathText].join(' '));
  let score = Number(cat.score || 0);
  if (cat.leaf === true) score += 45;
  if (cat.leaf === false) score -= 35;
  const words = [...new Set(productText.split(/\s+/).filter((w) => w.length >= 4 && !/^(oraz|ktore|ktore|jest|dla|przez|produkt|zestaw)$/.test(w)))].slice(0, 30);
  for (const w of words) if (catText.includes(w)) score += 4;
  if (/\b(gra|gry|plansz|karcian|edukacyjn|rodzinn)\b/.test(productText) && /\b(gra|gry|plansz|karcian|edukacyjn|zabaw)\b/.test(catText)) score += 55;
  if (/\b(zabaw|kreatywn|malowank|puzzle|ukladank)\b/.test(productText) && /\b(zabaw|dziec|kreatywn|edukacyjn|puzzle)\b/.test(catText)) score += 35;
  if (/\b(ksiaz|liter|slown)\b/.test(productText) && /\b(ksiaz|liter|edukacyjn|gry)\b/.test(catText)) score += 20;
  return score;
}
async function allegroSugerujKategorie(req, product = {}, opt = {}) {
  const phrases = allegroFrazyKategorii(product, opt);
  const byId = new Map();
  const errors = [];
  for (const phrase of phrases) {
    try {
      const raw = await allegroWywolaj(req, '/sale/matching-categories', { parameters: { name: phrase } });
      for (const cat of allegroNormalizujKategorie(raw, phrase)) {
        const score = allegroOcenKategorie(product, cat);
        const prev = byId.get(cat.id);
        if (!prev || score > prev.score) byId.set(cat.id, { ...cat, score });
      }
    } catch (e) {
      errors.push({ phrase, message: e.message || String(e), status: e.status || 0, code: e.code || '' });
    }
  }
  const limit = Math.max(1, Math.min(20, Number(opt.limit) || 8));
  const suggestions = [...byId.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  const selected = suggestions.find((x) => x.leaf === true) || suggestions[0] || null;
  return { selected, suggestions, phrases, errors };
}
function allegroMaKategorie(product = {}, opt = {}) {
  return !!tekst(opt.categoryId || product.allegroCategoryId || product.categoryId || '', 80).trim();
}
async function allegroZnajdzProduktKatalogu(req, product = {}) {
  const gtin = tekst(product.gtin || product.ean || '', 80).trim();
  const mpn = tekst(product.kodProducenta || product.mpn || '', 160).trim();
  const name = tekst(product.nazwa || product.name || '', 180).trim();
  const phrase = gtin || mpn || name;
  if (!phrase) return { selected: null, products: [], searchedBy: '' };
  try {
    const searchedBy = gtin ? 'GTIN' : (mpn ? 'MPN' : 'name');
    const parameters = searchedBy === 'name' ? { phrase, language: 'pl-PL' } : { phrase, mode: searchedBy, language: 'pl-PL' };
    const raw = await allegroWywolaj(req, '/sale/products', { parameters });
    const source = Array.isArray(raw.products) ? raw.products : (Array.isArray(raw.items) ? raw.items : []);
    const products = source.map((p) => ({
      id: tekst(p.id, 120),
      name: tekst(p.name, 300),
      categoryId: tekst(p.category?.id || '', 80),
      eans: Array.isArray(p.eans) ? p.eans.map((x) => tekst(x, 80)) : [],
      images: allegroZdjecia(p),
      parameters: Array.isArray(p.parameters) ? p.parameters.slice(0, 120) : [],
      descriptionText: allegroOpisTekst(p.description),
      brand: allegroWartoscParametru(p, ['producent', 'marka', 'brand']),
      trustedContent: p.trustedContent || null,
      matchScore: Number(allegroPodobienstwoNazw(name, p.name).toFixed(3)),
    })).filter((p) => p.id);
    let selected = searchedBy === 'GTIN'
      ? (products.find((p) => p.eans.includes(gtin)) || products[0] || null)
      : searchedBy === 'MPN'
        ? (products[0] || null)
        : (products.find((p) => p.matchScore >= 0.82) || null);
    if (selected?.id) {
      try {
        const details = await allegroWywolaj(req, `/sale/products/${encodeURIComponent(selected.id)}`);
        selected = {
          ...selected,
          name: tekst(details.name || selected.name, 300),
          categoryId: tekst(details.category?.id || selected.categoryId, 80),
          eans: Array.isArray(details.eans) ? details.eans.map((x) => tekst(x, 80)) : selected.eans,
          images: allegroZdjecia(details).length ? allegroZdjecia(details) : selected.images,
          parameters: Array.isArray(details.parameters) ? details.parameters.slice(0, 120) : selected.parameters,
          descriptionText: allegroOpisTekst(details.description) || selected.descriptionText,
          brand: allegroWartoscParametru(details, ['producent', 'marka', 'brand']) || selected.brand,
          trustedContent: details.trustedContent || selected.trustedContent || null,
        };
      } catch {}
    }
    return { selected, products: products.slice(0, 10), searchedBy };
  } catch (e) {
    return { selected: null, products: [], searchedBy: gtin ? 'GTIN' : (mpn ? 'MPN' : 'name'), error: { status: e.status || 0, code: e.code || '', message: e.message || String(e) } };
  }
}
function allegroBrakujaceParametryWymagane(product = {}, categoryParameters = []) {
  const auto = allegroParametryAutomatyczne(product, categoryParameters);
  const custom = Array.isArray(product.allegroParameters) ? product.allegroParameters : [];
  const present = new Set([...auto, ...custom].map((x) => String(x?.id || '')).filter(Boolean));
  return (Array.isArray(categoryParameters) ? categoryParameters : []).filter((p) => p?.required === true && p?.options?.describesProduct === true && !present.has(String(p.id))).map((p) => ({
    id: tekst(p.id, 80), name: tekst(p.name, 180), type: tekst(p.type, 40), unit: tekst(p.unit, 40), dictionary: Array.isArray(p.dictionary) ? p.dictionary.slice(0, 200) : [], restrictions: p.restrictions || {},
  }));
}
function allegroPierwszyId(lista = []) {
  const x = (Array.isArray(lista) ? lista : []).find((item) => tekst(item?.id || item?.uuid || '', 120).trim());
  return tekst(x?.id || x?.uuid || '', 120).trim();
}
function allegroNormalizujWarunki(raw = {}) {
  return {
    shippingRates: allegroLista(raw.shippingRates, ['shippingRates', 'items', 'rates']).map((x) => ({ id: tekst(x.id, 120), name: tekst(x.name || x.label, 250) })).filter((x) => x.id),
    returnPolicies: allegroLista(raw.returnPolicies, ['returnPolicies', 'items', 'policies']).map((x) => ({ id: tekst(x.id, 120), name: tekst(x.name || x.label, 250) })).filter((x) => x.id),
    impliedWarranties: allegroLista(raw.impliedWarranties, ['impliedWarranties', 'items', 'warranties']).map((x) => ({ id: tekst(x.id, 120), name: tekst(x.name || x.label, 250) })).filter((x) => x.id),
    warranties: allegroLista(raw.warranties, ['warranties', 'items']).map((x) => ({ id: tekst(x.id, 120), name: tekst(x.name || x.label, 250) })).filter((x) => x.id),
  };
}
async function allegroWarunkiSprzedazy(req) {
  const errors = [];
  const safe = async (path, key) => {
    try { return await allegroWywolaj(req, path, { parameters: { limit: 100, offset: 0 } }); }
    catch (e) { errors.push({ key, path, status: e.status || 0, code: e.code || '', message: e.message || String(e) }); return {}; }
  };
  const [shippingRatesRaw, returnPoliciesRaw, impliedWarrantiesRaw, warrantiesRaw] = await Promise.all([
    safe('/sale/shipping-rates', 'shippingRates'),
    safe('/after-sales-service-conditions/return-policies', 'returnPolicies'),
    safe('/after-sales-service-conditions/implied-warranties', 'impliedWarranties'),
    safe('/after-sales-service-conditions/warranties', 'warranties'),
  ]);
  const data = allegroNormalizujWarunki({ shippingRates: shippingRatesRaw, returnPolicies: returnPoliciesRaw, impliedWarranties: impliedWarrantiesRaw, warranties: warrantiesRaw });
  return { ...data, defaults: {
    shippingRateId: allegroPierwszyId(data.shippingRates),
    returnPolicyId: allegroPierwszyId(data.returnPolicies),
    impliedWarrantyId: allegroPierwszyId(data.impliedWarranties),
    warrantyId: allegroPierwszyId(data.warranties),
  }, errors };
}
async function allegroParametryKategorii(req, categoryId = '') {
  const id = tekst(categoryId, 80).trim();
  if (!id) return { parameters: [], errors: [] };
  try {
    const raw = await allegroWywolaj(req, `/sale/categories/${encodeURIComponent(id)}/parameters`);
    return { parameters: Array.isArray(raw.parameters) ? raw.parameters : [], errors: [] };
  } catch (e) {
    return { parameters: [], errors: [{ key: 'categoryParameters', status: e.status || 0, code: e.code || '', message: e.message || String(e) }] };
  }
}
function allegroParamNazwa(p = {}) {
  return allegroNormTekst(p.name || p.id || '');
}
function allegroSlownikValueId(p = {}, regex) {
  const vals = Array.isArray(p.dictionary) ? p.dictionary
    : Array.isArray(p.values) ? p.values
      : Array.isArray(p.restrictions?.allowedValues) ? p.restrictions.allowedValues
        : [];
  for (const v of vals) {
    const label = tekst(v.value || v.name || v.label || '', 200);
    if (regex.test(label)) return tekst(v.id || v.valueId || v.value || '', 120).trim();
  }
  return '';
}
function allegroDodajParam(out, p, value, valueId = false) {
  const id = tekst(p?.id, 80).trim();
  if (!id || value === undefined || value === null || value === '') return;
  const v = String(value).trim();
  if (!v) return;
  if (valueId) out.push({ id, valuesIds: [v] });
  else if (/^[a-z0-9]+_[a-z0-9-]+$/i.test(v)) out.push({ id, valuesIds: [v] });
  else out.push({ id, values: [tekst(v, 500)] });
}
function allegroParametryAutomatyczne(product = {}, categoryParameters = []) {
  const p = product || {};
  const out = [];
  const gtin = tekst(p.gtin || p.ean, 80).trim();
  const kod = tekst(p.kodProducenta || p.mpn || p.externalId || p.sku, 160).trim();
  const marka = tekst(p.producent || p.marka || '', 160).trim();
  const material = tekst(p.material || '', 160).trim();
  const kolor = tekst(p.kolorProduktu || p.color || '', 160).trim();
  const rozmiar = tekst(p.rozmiar || p.size || '', 160).trim();
  for (const param of Array.isArray(categoryParameters) ? categoryParameters : []) {
    const n = allegroParamNazwa(param);
    if (/\bean\b|gtin|kod kreskowy/.test(n) && gtin) allegroDodajParam(out, param, gtin);
    else if (/kod producenta|mpn|symbol producenta/.test(n) && kod) allegroDodajParam(out, param, kod);
    else if (/marka|producent/.test(n) && marka) {
      const dict = allegroSlownikValueId(param, new RegExp(`^${marka.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
      allegroDodajParam(out, param, dict || marka, !!dict);
    } else if (/^stan$|stan produktu|condition/.test(n)) {
      const nowy = allegroSlownikValueId(param, /nowy|new/i);
      allegroDodajParam(out, param, nowy || 'Nowy', !!nowy);
    } else if (/materiał|material/.test(n) && material) {
      const dict = allegroSlownikValueId(param, new RegExp(`^${material.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
      allegroDodajParam(out, param, dict || material, !!dict);
    } else if (/kolor|color/.test(n) && kolor) {
      const dict = allegroSlownikValueId(param, new RegExp(`^${kolor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
      allegroDodajParam(out, param, dict || kolor, !!dict);
    } else if (/rozmiar|size/.test(n) && rozmiar) {
      const dict = allegroSlownikValueId(param, new RegExp(`^${rozmiar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
      allegroDodajParam(out, param, dict || rozmiar, !!dict);
    } else if (param?.required === true && Array.isArray(param.dictionary) && param.dictionary.length === 1) {
      const only = param.dictionary[0];
      const value = tekst(only?.id || only?.valueId || only?.value || '', 120).trim();
      allegroDodajParam(out, param, value, !!(only?.id || only?.valueId));
    }
  }
  const seen = new Set();
  return out.filter((x) => {
    const key = `${x.id}:${(x.valuesIds || x.values || []).join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function allegroScalParametryBezDuplikatow(...groups) {
  const byId = new Map();
  for (const list of groups) for (const param of Array.isArray(list) ? list : []) {
    const id = tekst(param?.id, 80).trim();
    if (!id) continue;
    byId.set(id, param);
  }
  return [...byId.values()];
}
const ALLEGRO_DEFAULT_OFFER_STOCK = 5;
const ALLEGRO_DEFAULT_PRODUCERS = ['Alexander', 'Multigra', 'GoDan'];
function allegroUstawieniaOfert(raw = {}) {
  const requested = Number(raw?.defaultStock ?? raw?.stock ?? ALLEGRO_DEFAULT_OFFER_STOCK);
  const defaultStock = Number.isFinite(requested) ? Math.min(99999, Math.max(1, Math.floor(requested))) : ALLEGRO_DEFAULT_OFFER_STOCK;
  const producers = [...new Set((Array.isArray(raw?.producers) ? raw.producers : ALLEGRO_DEFAULT_PRODUCERS).map((x) => tekst(x, 100).trim()).filter(Boolean))].slice(0, 50);
  return { defaultStock, republish: true, producers: producers.length ? producers : ALLEGRO_DEFAULT_PRODUCERS, autoCatalog: raw?.autoCatalog !== false, syncDescriptions: raw?.syncDescriptions !== false, autoUpdateOffers: raw?.autoUpdateOffers !== false, autoFees: raw?.autoFees !== false, autoCorrections: raw?.autoCorrections !== false, updated_at: raw?.updated_at || null };
}
async function allegroPobierzUstawieniaOfert() {
  return allegroUstawieniaOfert(await czytaj('allegro_offer_settings', { defaultStock: ALLEGRO_DEFAULT_OFFER_STOCK, republish: true, producers: ALLEGRO_DEFAULT_PRODUCERS, updated_at: null }));
}
async function synchronizujSprzedazZDostepnosciaProducenta(req, results = [], data = {}) {
  const checked = (Array.isArray(results) ? results : []).filter((x) => x?.ok && x?.productId);
  const report = { siteHidden: 0, siteRestored: 0, allegroHidden: 0, allegroRestored: 0, unchanged: 0, errors: [] };
  if (!checked.length) return report;
  const availability = data.artway_dostepnosc && typeof data.artway_dostepnosc === 'object' ? { ...data.artway_dostepnosc } : {};
  const productMap = allegroAgentProduktyCentralne(data);
  const [mappingsRec, offersRec, auditRec, offerSettings] = await Promise.all([
    czytaj('allegro_mappings', { items: {} }),
    czytaj('allegro_offers', { items: [], updated_at: null }),
    czytaj('allegro_availability_automation', { items: {}, updated_at: null }),
    allegroPobierzUstawieniaOfert(),
  ]);
  const mappings = allegroMapowaniaItems(mappingsRec);
  const offers = allegroOfertyItems(offersRec);
  const offersById = new Map(offers.map((offer) => [String(offer?.id || ''), offer]));
  const offerIdsByProduct = new Map();
  const addOffer = (productId, offerId) => {
    const pid = tekst(productId, 100).trim(), oid = tekst(offerId, 100).trim();
    if (!pid || !oid) return;
    if (!offerIdsByProduct.has(pid)) offerIdsByProduct.set(pid, new Set());
    offerIdsByProduct.get(pid).add(oid);
  };
  for (const [offerId, mapping] of Object.entries(mappings)) {
    if (mapping?.blocked === true || mapping?.quarantined === true) continue;
    addOffer(mapping?.productId ?? mapping?.produktId ?? mapping?.id ?? mapping, offerId);
  }
  for (const product of productMap.values()) addOffer(product.id, product.allegroOfferId);
  const auditItems = auditRec.items && typeof auditRec.items === 'object' ? { ...auditRec.items } : {};
  const cachePatches = new Map();
  const now = new Date().toISOString();
  for (const result of checked) {
    const productId = String(result.productId);
    const unavailable = result.status === 'brak';
    const available = !unavailable && (result.available === true || Number(result.quantity) > 0 || ['dostepny', 'dostepny_nieznany', 'niski'].includes(String(result.status || '')));
    if (!unavailable && !available) { report.unchanged++; continue; }
    const previousAvailability = availability[productId];
    const automaticAvailability = previousAvailability?.automatic === true || previousAvailability?.source === 'producent-agent';
    const legacyTemporaryAvailability = !!previousAvailability && !previousAvailability?.source
      && /chwilowo niedost[eę]pn|brak u producent/i.test(String(previousAvailability?.powod || ''));
    if (unavailable) {
      if (!previousAvailability || automaticAvailability || legacyTemporaryAvailability) {
        availability[productId] = { status: 'niedostepny', powod: 'Automatycznie: produkt niedostępny u producenta', data: now, operator: 'agent-dostepnosci', source: 'producent-agent', automatic: true, producerStatus: result.status, producerCheckedAt: result.checkedAt || now };
        if (!previousAvailability) report.siteHidden++;
      }
    } else if (automaticAvailability) {
      delete availability[productId];
      report.siteRestored++;
    }
    for (const offerId of offerIdsByProduct.get(productId) || []) {
      const offer = offersById.get(String(offerId)) || {};
      const previousAudit = auditItems[offerId] && typeof auditItems[offerId] === 'object' ? auditItems[offerId] : {};
      const cachedStatus = String(offer.publication?.status || offer.status || '').toUpperCase();
      const cachedStock = Math.max(0, Number(offer.stock?.available ?? offer.stock ?? 0) || 0);
      if (unavailable && previousAudit.automaticallyHidden !== true) {
        if (cachedStatus && cachedStatus !== 'ACTIVE') {
          auditItems[offerId] = { ...previousAudit, offerId, productId, automaticallyHidden: false, alreadyInactive: true, checkedAt: now, producerStatus: result.status };
          report.unchanged++;
          continue;
        }
        try {
          await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', bodyObj: { stock: { available: 0 }, publication: { republish: true } }, withMeta: true });
          auditItems[offerId] = { ...previousAudit, offerId, productId, automaticallyHidden: true, previousStock: cachedStock > 0 ? cachedStock : offerSettings.defaultStock, previousStatus: cachedStatus || 'ACTIVE', hiddenAt: now, restoredAt: null, producerStatus: result.status, error: '' };
          cachePatches.set(String(offerId), { stock: { ...(offer.stock || {}), available: 0 }, saleAvailabilityBlocked: true, saleAvailabilityUpdatedAt: now });
          report.allegroHidden++;
        } catch (error) {
          const item = { offerId, productId, action: 'hide', error: tekst(error?.message || error, 700), code: tekst(error?.code || '', 120) };
          auditItems[offerId] = { ...previousAudit, ...item, automaticallyHidden: false, failedAt: now, producerStatus: result.status };
          report.errors.push(item);
        }
      } else if (available && previousAudit.automaticallyHidden === true) {
        const targetStock = Math.max(1, Number(previousAudit.previousStock) || offerSettings.defaultStock);
        try {
          await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', bodyObj: { stock: { available: targetStock }, publication: { status: 'ACTIVE', republish: true } }, withMeta: true });
          auditItems[offerId] = { ...previousAudit, automaticallyHidden: false, restoredAt: now, producerStatus: result.status, restoredStock: targetStock, error: '' };
          cachePatches.set(String(offerId), { stock: { ...(offer.stock || {}), available: targetStock }, saleAvailabilityBlocked: false, saleAvailabilityUpdatedAt: now });
          report.allegroRestored++;
        } catch (error) {
          const item = { offerId, productId, action: 'restore', error: tekst(error?.message || error, 700), code: tekst(error?.code || '', 120) };
          auditItems[offerId] = { ...previousAudit, ...item, failedAt: now, producerStatus: result.status };
          report.errors.push(item);
        }
      } else report.unchanged++;
    }
  }
  data.artway_dostepnosc = availability;
  await zapisz('allegro_availability_automation', { items: auditItems, updated_at: now });
  if (cachePatches.size) {
    const updatedOffers = offers.map((offer) => cachePatches.has(String(offer.id)) ? { ...offer, ...cachePatches.get(String(offer.id)) } : offer);
    await zapisz('allegro_offers', { ...offersRec, items: updatedOffers, updated_at: now });
  }
  return report;
}
function allegroRozpoznajProducenta(product = {}, evidence = {}, settings = {}) {
  const allowed = (Array.isArray(settings.producers) && settings.producers.length ? settings.producers : ALLEGRO_DEFAULT_PRODUCERS).map((name) => ({ name, key: allegroNormalizujKlucz(name) }));
  const text = allegroNormalizujKlucz([
    product.producent, product.marka, product.nazwa, product.name, product.sourceUrl, product.producentUrl,
    evidence.brand, evidence.producent, evidence.name, evidence.sourceUrl,
  ].filter(Boolean).join(' '));
  for (const item of allowed) if (item.key && text.includes(item.key)) return item.name;
  const pick = (pattern, fallback) => pattern.test(text) ? (allowed.find((x) => x.key === allegroNormalizujKlucz(fallback))?.name || '') : '';
  return pick(/alexander|sklep alexander|origami 3d|maly konstruktor|constructor junior|zlotowki/, 'Alexander')
    || pick(/multigra/, 'Multigra')
    || pick(/go dan|godan|godanparty/, 'GoDan')
    || '';
}
async function allegroAutoUzupelnijKatalogProduktow(req, options = {}) {
  const [settingsRec, offerSettings, previousAudit] = await Promise.all([
    czytaj('settings', { data: {}, rev: 0, updated_at: null }),
    allegroPobierzUstawieniaOfert(),
    czytaj('allegro_catalog_maintenance', { cursor: 0, lastRun: null }),
  ]);
  if (offerSettings.autoCatalog === false && offerSettings.syncDescriptions === false && offerSettings.autoUpdateOffers === false && offerSettings.autoFees === false) return { enabled: false, lastRun: previousAudit.lastRun || null };
  const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
  const products = [...allegroAgentProduktyCentralne(data).values()].filter((p) => p && p.id !== undefined);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 10));
  const start = products.length ? Math.max(0, Number(previousAudit.cursor) || 0) % products.length : 0;
  const selected = products.length <= limit ? products : Array.from({ length: limit }, (_, index) => products[(start + index) % products.length]);
  const updater = allegroAktualizatorProduktowCentralnych(data);
  const report = { enabled: true, lastRun: new Date().toISOString(), scanned: selected.length, updated: 0, matched: 0, categories: 0, producers: 0, descriptions: 0, offersUpdated: 0, feesUpdated: 0, unresolved: 0, errors: [] };
  for (const product of selected) {
    try {
      const fields = {};
      const producer = allegroRozpoznajProducenta(product, {}, offerSettings);
      if (producer && (product.producent !== producer || product.marka !== producer)) {
        fields.producent = producer; fields.marka = producer; report.producers++;
      }
      let catalog = null;
      if (offerSettings.autoCatalog !== false && (!product.allegroProductId || !product.allegroCategoryId || (offerSettings.syncDescriptions !== false && !tekst(product.opis, 20000).trim()))) {
        const found = await allegroZnajdzProduktKatalogu(req, { ...product, ...fields });
        catalog = found?.selected || null;
        if (catalog?.id) {
          fields.allegroProductId = catalog.id;
          if (catalog.categoryId) fields.allegroCategoryId = catalog.categoryId;
          report.matched++;
          const catalogProducer = allegroRozpoznajProducenta({ ...product, ...fields }, catalog, offerSettings);
          if (catalogProducer) { fields.producent = catalogProducer; fields.marka = catalogProducer; }
          if (offerSettings.syncDescriptions !== false && !tekst(product.opis, 20000).trim() && catalog.descriptionText) {
            fields.opis = tekst(catalog.descriptionText, 20000).trim();
            fields.opisKrotki = allegroOpisKrotkiZTekstu(fields.opis);
            report.descriptions++;
          }
          if (!product.zdjecie && catalog.images?.[0]) fields.zdjecie = catalog.images[0];
          if ((!Array.isArray(product.zdjecia) || !product.zdjecia.length) && catalog.images?.length > 1) fields.zdjecia = catalog.images.slice(1, 16);
        }
      }
      if (offerSettings.autoCatalog !== false && !fields.allegroCategoryId && !product.allegroCategoryId) {
        const category = await allegroSugerujKategorie(req, { ...product, ...fields }, { limit: 5 });
        if (category?.selected?.id) { fields.allegroCategoryId = category.selected.id; report.categories++; }
      }
      const styledProduct = { ...product, ...fields };
      if (offerSettings.syncDescriptions !== false) {
        const shortDescription = allegroOpisKrotki(styledProduct, []), fullDescription = allegroOpisPelnyTekst(styledProduct, shortDescription), sections = allegroSekcjeOpisu(styledProduct, shortDescription);
        if (shortDescription) fields.opisKrotki = shortDescription;
        if (fullDescription) fields.opis = fullDescription;
        fields.allegroDescriptionSections = sections;
        report.descriptions++;
      }
      if (product.allegroShippingSubsidy === undefined) fields.allegroShippingSubsidy = 3;
      if (!catalog?.id && !product.allegroProductId) report.unresolved++;
      const finalProduct = { ...product, ...fields };
      if (Object.keys(fields).length && updater.apply(product.id, { ...fields, allegroCatalogCheckedAt: report.lastRun, allegroCatalogSource: 'automatic-maintenance' })) report.updated++;
      if (offerSettings.autoUpdateOffers !== false) {
        const prepared = await allegroDraftZAutoKategoria(req, finalProduct, { publicationAction: 'keep' });
        const offerId = tekst(prepared?.existingOffer?.offer?.id || finalProduct.allegroOfferId, 100).trim();
        if (offerId) {
          const patch = allegroPatchZDraftu(prepared.payload, { publicationAction: 'keep' });
          const meta = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', bodyObj: patch, withMeta: true });
          await allegroCzekajNaOperacjeOferty(req, meta.location);
          report.offersUpdated++;
          if (offerSettings.autoFees !== false) {
            const actual = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`), price = Math.max(0, Number(finalProduct.cenaAllegro || finalProduct.cena) || 0);
            actual.sellingMode = actual.sellingMode || { format: 'BUY_NOW' };actual.sellingMode.price = { amount: price.toFixed(2), currency: 'PLN' };
            const preview = await allegroWywolaj(req, '/pricing/offer-fee-preview', { method: 'POST', bodyObj: { offer: actual, marketplaceId: 'allegro-pl' } }), fee = allegroPodsumujKalkulacjeOplat(preview, price);
            updater.apply(product.id, { allegroCommissionAmount: fee.commissionAmount, allegroCommissionRate: fee.commissionRate, allegroRecurringFees: fee.recurringFees, allegroFeeTotal: fee.totalPreviewFees, allegroFeePrice: fee.salePrice, allegroFeeCurrency: fee.currency, allegroFeeDetails: { commissions: fee.commissions, quotes: fee.quotes }, allegroFeeCalculatedAt: fee.calculatedAt, allegroFeeSource: fee.source });
            report.feesUpdated++;
          }
        }
      }
    } catch (error) {
      report.errors.push({ productId: String(product.id), name: tekst(product.nazwa || product.name, 180), error: tekst(error?.message || error, 500) });
    }
  }
  const changed = updater.commit();
  if (changed) await zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: report.lastRun });
  const audit = { ...report, cursor: products.length ? (start + selected.length) % products.length : 0, totalProducts: products.length, errors: report.errors.slice(0, 20) };
  await zapisz('allegro_catalog_maintenance', audit);
  return audit;
}
async function allegroDraftZAutoKategoria(req, product = {}, opt = {}) {
  const options = { ...(opt || {}) };
  const [offersRec, mappingsRec, offerSettings] = await Promise.all([
    czytaj('allegro_offers', { items: [] }),
    czytaj('allegro_mappings', { items: {} }),
    allegroPobierzUstawieniaOfert(),
  ]);
  options.offerStock = offerSettings.defaultStock;
  const similarOffers = allegroPodobneOferty(product, offersRec, 5);
  const existingOffer = allegroDopasowanieOferty(product, offersRec, mappingsRec);
  if (!options.categoryId && !product.allegroCategoryId && existingOffer?.offer?.categoryId) options.categoryId = existingOffer.offer.categoryId;
  options.shortDescription = allegroOpisKrotki(product, similarOffers);
  options.descriptionSections = allegroSekcjeOpisu(product, options.shortDescription);
  let categorySuggestion = null;
  if (!allegroMaKategorie(product, options)) {
    categorySuggestion = await allegroSugerujKategorie(req, product, { limit: 8 });
    if (categorySuggestion?.selected?.id) options.categoryId = categorySuggestion.selected.id;
  }
  const categoryId = tekst(options.categoryId || product.allegroCategoryId || product.categoryId || '', 80).trim();
  const [salesConditions, catalogMatch] = await Promise.all([
    allegroWarunkiSprzedazy(req),
    allegroZnajdzProduktKatalogu(req, product),
  ]);
  const effectiveCategoryId = tekst(catalogMatch?.selected?.categoryId || categoryId, 80).trim();
  if (effectiveCategoryId) options.categoryId = effectiveCategoryId;
  const categoryParameters = await allegroParametryKategorii(req, effectiveCategoryId);
  options.salesConditions = salesConditions;
  options.categoryParameters = categoryParameters.parameters;
  if (catalogMatch?.selected?.id) options.catalogProductId = catalogMatch.selected.id;
  const catalog = catalogMatch?.selected || {};
  const safeOffer = existingOffer?.offer || {};
  const catalogProducer = allegroRozpoznajProducenta(product, { ...catalog, producent: allegroWartoscParametru(catalog, ['producent', 'marka', 'brand']) || catalog.brand || safeOffer.brand }, offerSettings);
  const catalogCode = allegroWartoscParametru(catalog, ['kod producenta', 'mpn', 'symbol producenta']) || tekst(safeOffer.manufacturerCode || safeOffer.producerCode || '', 160).trim();
  const catalogGtin = tekst((catalog.eans || [])[0] || safeOffer.ean || safeOffer.gtin || '', 80).trim();
  const sourceImages = [...new Set([
    ...(Array.isArray(catalog.images) ? catalog.images : []),
    safeOffer.mainImage,
    ...(Array.isArray(safeOffer.images) ? safeOffer.images : []),
  ].map((x) => tekst(x, 1000).trim()).filter(Boolean))].slice(0, 16);
  const preparedProduct = {
    ...product,
    ...(!catalogProducer ? {} : { producent: catalogProducer, marka: catalogProducer }),
    ...(product.gtin || product.ean || !catalogGtin ? {} : { gtin: catalogGtin, ean: catalogGtin }),
    ...(product.kodProducenta || product.mpn || !catalogCode ? {} : { kodProducenta: catalogCode, mpn: catalogCode }),
    ...(!sourceImages.length ? {} : { zdjecie: sourceImages[0], zdjecia: sourceImages.slice(1, 16) }),
  };
  options.descriptionSections = allegroSekcjeOpisu(preparedProduct, options.shortDescription);
  const requiredParameters = options.catalogProductId ? [] : allegroBrakujaceParametryWymagane(preparedProduct, categoryParameters.parameters);
  options.requiredParameters = requiredParameters;
  const draft = allegroDraftZProduktu(preparedProduct, options);
  const autoParameters = allegroParametryAutomatyczne(preparedProduct, categoryParameters.parameters);
  return {
    ...draft,
    categorySuggestion,
    salesConditions,
    categoryParameters: categoryParameters.parameters,
    requiredParameters,
    catalogMatch,
    supportErrors: [...(salesConditions.errors || []), ...(categoryParameters.errors || [])],
    existingOffer,
    similarOffers: similarOffers.map((x) => ({ id: x.offer?.id, name: x.offer?.name, score: Number(x.score.toFixed(2)) })),
    improvedDescriptions: {
      shortDescription: options.shortDescription,
      fullDescription: allegroOpisPelnyTekst(preparedProduct, options.shortDescription) || options.shortDescription,
      sections: options.descriptionSections,
    },
    autoFilled: {
      producent: preparedProduct.producent || preparedProduct.marka || '',
      marka: preparedProduct.marka || preparedProduct.producent || '',
      gtin: preparedProduct.gtin || preparedProduct.ean || '',
      ean: preparedProduct.ean || preparedProduct.gtin || '',
      kodProducenta: preparedProduct.kodProducenta || preparedProduct.mpn || '',
      mpn: preparedProduct.mpn || preparedProduct.kodProducenta || '',
      zdjecie: product.zdjecie || preparedProduct.zdjecie || '',
      zdjecia: Array.isArray(product.zdjecia) && product.zdjecia.length ? product.zdjecia.slice(0, 15) : (Array.isArray(preparedProduct.zdjecia) ? preparedProduct.zdjecia.slice(0, 15) : []),
      allegroParameters: autoParameters,
      allegroProductId: options.catalogProductId || '',
      allegroCategoryId: effectiveCategoryId || '',
    },
    agentDecision: {
      action: existingOffer ? 'update_existing' : (draft.missing.length ? 'complete_data' : 'create_inactive'),
      existingOfferId: tekst(existingOffer?.offer?.id || '', 100),
      duplicatePrevented: !!existingOffer,
      reason: tekst(existingOffer?.reason || (catalogMatch?.selected?.id ? `katalog ${catalogMatch.searchedBy}` : 'brak pewnego dopasowania'), 300),
    },
  };
}
function allegroDraftZProduktu(product = {}, opt = {}) {
  const p = product || {};
  const categoryId = tekst(opt.categoryId || p.allegroCategoryId || p.categoryId || '', 80).trim();
  const images = [p.zdjecie, ...(Array.isArray(p.zdjecia) ? p.zdjecia : [])].filter(Boolean).slice(0, 16);
  const externalId = tekst(p.externalId || p.sku || p.kodProducenta || p.mpn || p.id || '', 120).trim();
  const allegroProductId = tekst(opt.catalogProductId || p.allegroProductId || '', 120).trim();
  const gtin = tekst(p.gtin || p.ean, 80).trim();
  const parameters = [];
  if (gtin) parameters.push({ name: 'EAN', values: [gtin] });
  if (p.kodProducenta || p.mpn) parameters.push({ name: 'Kod producenta', values: [tekst(p.kodProducenta || p.mpn, 120)] });
  if (p.marka) parameters.push({ name: 'Marka', values: [tekst(p.marka, 120)] });
  const autoParameters = allegroParametryAutomatyczne(p, opt.categoryParameters);
  const categoryParameterTypes = new Map((Array.isArray(opt.categoryParameters) ? opt.categoryParameters : []).map((param) => [
    String(param?.id || ''),
    param?.options?.describesProduct,
  ]));
  const customParameters = Array.isArray(p.allegroParameters) ? p.allegroParameters : [];
  const mergedParameters = allegroScalParametryBezDuplikatow(autoParameters, customParameters);
  const offerParameters = mergedParameters.filter((param) => categoryParameterTypes.get(String(param?.id || '')) === false);
  const productParameters = mergedParameters.filter((param) => categoryParameterTypes.get(String(param?.id || '')) !== false);
  const productObj = allegroProductId
    ? { id: allegroProductId }
    : (!categoryId && gtin)
      ? { id: gtin, idType: 'GTIN' }
      : {
          name: tekst(p.nazwa || p.name, 75).trim(),
          category: categoryId ? { id: categoryId } : undefined,
          parameters: [...parameters.filter((x) => x.id), ...productParameters],
          images,
        };
  const stockRaw = Number(opt.offerStock ?? ALLEGRO_DEFAULT_OFFER_STOCK);
  const payload = {
    name: tekst(p.nazwa || p.name, 75).trim(),
    productSet: [{
      product: productObj,
    }],
    parameters: offerParameters,
    sellingMode: {
      format: 'BUY_NOW',
      price: { amount: String(Number(p.cenaAllegro || p.allegroPrice || p.cena || p.price || 0).toFixed(2)), currency: 'PLN' },
    },
    stock: { available: Number.isFinite(stockRaw) ? Math.max(0, Math.floor(stockRaw)) : 0 },
    publication: { status: opt.publishNow ? 'ACTIVE' : 'INACTIVE', republish: true },
    external: externalId ? { id: externalId } : undefined,
    images: images.map((url) => tekst(url, 1000)),
    description: { sections: Array.isArray(opt.descriptionSections) && opt.descriptionSections.length ? opt.descriptionSections : allegroSekcjeOpisu(p, opt.shortDescription || allegroOpisKrotki(p, [])) },
  };
  const sc = opt.salesConditions || {};
  const defaults = sc.defaults || {};
  if (defaults.shippingRateId) payload.delivery = { shippingRates: { id: defaults.shippingRateId } };
  const afterSalesServices = {};
  if (defaults.returnPolicyId) afterSalesServices.returnPolicy = { id: defaults.returnPolicyId };
  if (defaults.impliedWarrantyId) afterSalesServices.impliedWarranty = { id: defaults.impliedWarrantyId };
  if (defaults.warrantyId) afterSalesServices.warranty = { id: defaults.warrantyId };
  if (Object.keys(afterSalesServices).length) payload.afterSalesServices = afterSalesServices;
  const missing = [];
  if (!payload.name) missing.push('nazwa');
  if (!categoryId && !allegroProductId && !gtin) missing.push('allegroCategoryId albo EAN/GTIN');
  if (!Number(p.cenaAllegro || p.allegroPrice || p.cena || p.price || 0)) missing.push('cena');
  if (!images.length) missing.push('zdjęcia');
  if (!(p.producent || p.marka)) missing.push('producent');
  if (!gtin && !allegroProductId) missing.push('EAN/GTIN albo ID produktu Allegro');
  for (const param of Array.isArray(opt.requiredParameters) ? opt.requiredParameters : []) missing.push(`parametr Allegro: ${param.name}`);
  return { payload: JSON.parse(JSON.stringify(payload)), missing };
}

function allegroPodsumujKalkulacjeOplat(raw = {}, price = 0) {
  const normalize = (item = {}, group = '') => ({ name: tekst(item.name || item.type || 'Opłata', 200), type: tekst(item.type || '', 120), group, amount: Math.max(0, Number(item.fee?.amount) || 0), currency: tekst(item.fee?.currency || 'PLN', 12), cycleDuration: tekst(item.cycleDuration || '', 80) });
  const commissions = (Array.isArray(raw.commissions) ? raw.commissions : []).map((x) => normalize(x, 'commission'));
  const quotes = (Array.isArray(raw.quotes) ? raw.quotes : []).map((x) => normalize(x, 'quote'));
  const commissionAmount = Number(commissions.reduce((sum, x) => sum + x.amount, 0).toFixed(2));
  const recurringFees = Number(quotes.reduce((sum, x) => sum + x.amount, 0).toFixed(2));
  const salePrice = Math.max(0, Number(price) || 0);
  return {
    commissionAmount,
    commissionRate: salePrice > 0 ? Number((commissionAmount / salePrice * 100).toFixed(4)) : 0,
    recurringFees,
    totalPreviewFees: Number((commissionAmount + recurringFees).toFixed(2)),
    salePrice,
    currency: commissions[0]?.currency || quotes[0]?.currency || 'PLN',
    commissions,
    quotes,
    calculatedAt: new Date().toISOString(),
    source: 'allegro-offer-fee-preview',
  };
}

function allegroDanePowiazaniaZPrzygotowania(product = {}, prepared = {}, draft = {}) {
  const katalog = prepared?.catalogMatch?.selected || {};
  const draftProduct = draft?.productSet?.[0]?.product || {};
  const catalogProductId = tekst(katalog.id || (draftProduct.idType ? '' : draftProduct.id) || product.allegroProductId || '', 120).trim();
  const categoryId = tekst(katalog.categoryId || prepared?.autoFilled?.allegroCategoryId || prepared?.categorySuggestion?.selected?.id || product.allegroCategoryId || draftProduct.category?.id || '', 80).trim();
  const producent = tekst(product.producent || product.marka || allegroWartoscParametru(katalog, ['producent', 'marka', 'brand']) || '', 160).trim();
  return { catalogProductId, categoryId, producent };
}
const ALLEGRO_AGENT_OFFER_PROCEDURE = [
  'Sprawdź ID oferty i mapowanie, następnie UUID katalogu, external.id/SKU, EAN, kod producenta i identyczną nazwę.',
  'Jeżeli oferta istnieje, połącz ją z produktem i aktualizuj zamiast tworzyć duplikat.',
  'Dobierz katalog najpierw po EAN, potem po MPN; nazwę uznaj tylko przy wysokiej zgodności.',
  'Uzupełnij producenta, markę, EAN, MPN, kategorię, UUID, parametry i sprawdzone zdjęcia katalogowe.',
  'Nową ofertę zapisz jako INACTIVE; brak stanu magazynowego oznacza 0.',
  'Po sukcesie zapisz powiązanie produkt sklepu–produkt katalogowy–oferta i zamknij zadanie.',
  'Jeżeli brakuje danych, nie zgaduj: zapisz dokładne braki i błąd API do jednej kolejki ponowienia.',
];
async function allegroZapiszZadanieAgentaOferty(product = {}, details = {}) {
  const productId = tekst(product.id, 100).trim();
  if (!productId) return null;
  const settingsRec = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
  const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
  const tasks = Array.isArray(data.artway_agent_ai_allegro_zadania) ? [...data.artway_agent_ai_allegro_zadania] : [];
  const missing = [...new Set((Array.isArray(details.missing) ? details.missing : []).map((x) => tekst(x, 250)).filter(Boolean))];
  const errors = (Array.isArray(details.errors) ? details.errors : []).map((x) => ({
    code: tekst(x?.code || '', 120), message: tekst(x?.userMessage || x?.message || x || '', 700), path: tekst(x?.path || '', 300),
  })).filter((x) => x.message || x.code).slice(0, 20);
  const now = new Date().toISOString();
  const index = tasks.findIndex((x) => String(x.productId) === productId && !['wykonane', 'anulowane'].includes(String(x.status || '').toLowerCase()));
  const previous = index >= 0 ? tasks[index] : {};
  const link = allegroDanePowiazaniaZPrzygotowania(product, details.prepared || {}, details.draft || {});
  const auto = details.prepared?.autoFilled || {};
  const task = {
    ...previous,
    id: previous.id || `AA-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    typ: 'allegro-oferta', status: errors.length ? 'błąd API' : 'oczekuje', productId,
    productName: tekst(product.nazwa || product.name || `Produkt ${productId}`, 300),
    producent: link.producent, missing, errors,
    suggestions: {
      allegroCategoryId: auto.allegroCategoryId || link.categoryId,
      allegroProductId: auto.allegroProductId || link.catalogProductId,
      producent: auto.producent || link.producent,
      marka: auto.marka || '', gtin: auto.gtin || auto.ean || '', ean: auto.ean || auto.gtin || '',
      kodProducenta: auto.kodProducenta || auto.mpn || '', mpn: auto.mpn || auto.kodProducenta || '',
      zdjecie: auto.zdjecie || '', zdjecia: Array.isArray(auto.zdjecia) ? auto.zdjecia.slice(0, 15) : [],
      allegroParameters: Array.isArray(auto.allegroParameters) ? auto.allegroParameters : [],
    },
    procedure: ALLEGRO_AGENT_OFFER_PROCEDURE,
    decision: details.prepared?.agentDecision || null,
    sourceUrl: tekst(product.sourceUrl || product.producentUrl || '', 800),
    attempts: (Number(previous.attempts) || 0) + 1, createdAt: previous.createdAt || now, updatedAt: now,
  };
  if (index >= 0) tasks[index] = task; else tasks.unshift(task);
  data.artway_agent_ai_allegro_zadania = tasks.slice(0, 500);
  const history = Array.isArray(data.artway_agent_ai_historia) ? data.artway_agent_ai_historia : [];
  history.unshift({ id: `AI-${Date.now().toString(36)}`, typ: 'allegro-oferta', opis: `Oferta produktu ${task.productName} wymaga pracy agenta: ${[...missing, ...errors.map((x) => x.message)].join(', ') || 'weryfikacja danych'}.`, data: now, dataTxt: new Date().toLocaleString('pl-PL'), operator: 'Agent Allegro', dane: { productId, taskId: task.id } });
  data.artway_agent_ai_historia = history.slice(0, 500);
  await zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now });
  return task;
}
async function allegroZapiszPowiazanieProduktu(product = {}, details = {}) {
  const productId = tekst(product.id, 100).trim(), offerId = tekst(details.offerId, 100).trim();
  if (!productId || !offerId) return null;
  const settingsRec = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
  const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
  const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
  const link = allegroDanePowiazaniaZPrzygotowania(product, details.prepared || {}, details.draft || {});
  const auto = details.prepared?.autoFilled || {};
  const previousEdit = edits[productId] || {};
  const autoPatch = {};
  for (const key of ['producent', 'marka', 'gtin', 'ean', 'kodProducenta', 'mpn', 'zdjecie']) {
    const value = auto[key];
    if (value && !product[key] && !previousEdit[key]) autoPatch[key] = value;
  }
  if (Array.isArray(auto.zdjecia) && auto.zdjecia.length && !(product.zdjecia || []).length && !(previousEdit.zdjecia || []).length) autoPatch.zdjecia = auto.zdjecia.slice(0, 15);
  if (Array.isArray(auto.allegroParameters) && auto.allegroParameters.length && !Array.isArray(product.allegroParameters) && !Array.isArray(previousEdit.allegroParameters)) autoPatch.allegroParameters = auto.allegroParameters;
  const improved = details.prepared?.improvedDescriptions || {};
  if (improved.shortDescription) autoPatch.opisKrotki = tekst(improved.shortDescription, 500);
  if (improved.fullDescription) autoPatch.opis = tekst(improved.fullDescription, 20000);
  if (Array.isArray(improved.sections) && improved.sections.length) autoPatch.allegroDescriptionSections = improved.sections;
  if (product.allegroShippingSubsidy === undefined && previousEdit.allegroShippingSubsidy === undefined) autoPatch.allegroShippingSubsidy = 3;
  edits[productId] = {
    ...previousEdit, ...autoPatch, allegroOfferId: offerId,
    ...(Number.isFinite(Number(details.draft?.stock?.available)) ? { allegroStock: Math.max(0, Math.floor(Number(details.draft.stock.available))) } : {}),
    ...(link.catalogProductId ? { allegroProductId: link.catalogProductId } : {}),
    ...(link.categoryId ? { allegroCategoryId: link.categoryId } : {}),
    ...(link.producent ? { producent: link.producent } : {}),
    allegroSyncedAt: new Date().toISOString(), allegroSyncSource: 'artway-store',
  };
  data.artway_produkty_edytowane = edits;
  const tasks = Array.isArray(data.artway_agent_ai_allegro_zadania) ? [...data.artway_agent_ai_allegro_zadania] : [];
  const now = new Date().toISOString();
  for (let i = 0; details.resolveTasks !== false && i < tasks.length; i++) if (String(tasks[i]?.productId) === productId && !['wykonane', 'anulowane'].includes(String(tasks[i]?.status || '').toLowerCase())) {
    const remaining = Array.isArray(details.prepared?.missing) ? details.prepared.missing : [];
    tasks[i] = remaining.length
      ? { ...tasks[i], status: 'oczekuje', offerId, missing: remaining, errors: [], updatedAt: now }
      : { ...tasks[i], status: 'wykonane', offerId, missing: [], errors: [], resolvedAt: now, updatedAt: now };
  }
  data.artway_agent_ai_allegro_zadania = tasks.slice(0, 500);
  await zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now });
  return edits[productId];
}

const ALLEGRO_AUTO_REPLY_DEFAULT = `Dzień dobry,

dziękujemy za wiadomość. Potwierdzamy, że zgłoszenie trafiło do obsługi Artway-TM. Odpowiemy możliwie jak najszybciej.

Pozdrawiamy
Artway-TM`;
function allegroUstawieniaKomunikacji(raw = {}) {
  return {
    enabled: raw.enabled !== false,
    messageCenter: raw.messageCenter !== false,
    issues: raw.issues !== false,
    telegramReminders: raw.telegramReminders !== false,
    freshHours: Math.max(1, Math.min(168, Number(raw.freshHours || 48))),
    template: tekst(raw.template || ALLEGRO_AUTO_REPLY_DEFAULT, 2000).trim() || ALLEGRO_AUTO_REPLY_DEFAULT,
  };
}
function allegroNormalizujWiadomosc(m = {}, fallbackThreadId = '') {
  return {
    id: tekst(m.id, 120),
    threadId: tekst(m.thread?.id || fallbackThreadId, 120),
    text: tekst(m.text || m.body || '', 3000),
    subject: tekst(m.subject || '', 300),
    createdAt: tekst(m.createdAt || m.created_at || '', 80),
    authorLogin: tekst(m.author?.login || m.author?.id || '', 200),
    incoming: m.author?.isInterlocutor === true,
    status: tekst(m.status || '', 80),
    offerId: tekst(m.relatesTo?.offer?.id || '', 100),
    orderId: tekst(m.relatesTo?.order?.id || '', 120),
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
  };
}
function allegroNormalizujWatek(t = {}, messages = []) {
  const msgs = (Array.isArray(messages) ? messages : []).map((m) => allegroNormalizujWiadomosc(m, t.id));
  const last = msgs.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
  return {
    id: tekst(t.id, 120),
    read: !!t.read,
    lastMessageDateTime: tekst(t.lastMessageDateTime || t.updatedAt || last?.createdAt || '', 80),
    buyerLogin: tekst(t.interlocutor?.login || last?.authorLogin || '', 200),
    subject: tekst(t.subject || last?.subject || '', 300),
    messages: msgs,
    lastMessage: last,
    incomingCount: msgs.filter((m) => m.incoming).length,
    sellerCount: msgs.filter((m) => !m.incoming).length,
  };
}
function allegroNormalizujIssueChatMessage(m = {}, fallbackIssueId = '') {
  const role = String(m.author?.role || '').toUpperCase();
  return {
    id: tekst(m.id, 120),
    issueId: tekst(fallbackIssueId, 120),
    text: tekst(m.text || '', 3000),
    createdAt: tekst(m.createdAt || '', 80),
    authorLogin: tekst(m.author?.login || '', 200),
    role,
    incoming: role === 'BUYER',
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
  };
}
function allegroNormalizujIssue(i = {}, chat = []) {
  const msgs = (Array.isArray(chat) ? chat : []).map((m) => allegroNormalizujIssueChatMessage(m, i.id));
  const last = msgs.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
  return {
    id: tekst(i.id, 120),
    type: tekst(i.type || '', 60),
    status: tekst(i.currentState?.status || i.status || '', 120),
    openedDate: tekst(i.openedDate || '', 80),
    dueDate: tekst(i.currentState?.dueDate || i.currentState?.statusDueDate || i.decisionDueDate || '', 80),
    subject: tekst(i.subject || i.reason?.type || '', 240),
    buyerLogin: tekst(i.buyer?.login || i.chat?.initialMessage?.author?.login || '', 200),
    orderId: tekst(i.checkoutForm?.id || '', 120),
    offerId: tekst(i.offer?.id || '', 120),
    chatActive: i.currentState?.chatActive !== false,
    messagesCount: Number(i.chat?.messagesCount || msgs.length) || msgs.length,
    initialMessage: i.chat?.initialMessage || null,
    messages: msgs,
    lastMessage: last || allegroNormalizujIssueChatMessage(i.chat?.initialMessage || {}, i.id),
  };
}
function allegroJestSwieze(dateText = '', hours = 48) {
  const t = new Date(dateText).getTime();
  if (!Number.isFinite(t) || !t) return false;
  return Date.now() - t <= Math.max(1, Number(hours) || 48) * 3600 * 1000;
}
function allegroPierwszaWiadomoscKlienta(messages = []) {
  const sorted = (Array.isArray(messages) ? messages : []).slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  return sorted.find((m) => m.incoming) || null;
}
function allegroKluczWiadomosci(m = {}) {
  m = m || {};
  return tekst(m.id || `${m.createdAt || ''}:${m.authorLogin || ''}:${m.text || ''}`, 500).trim();
}
function allegroNoweWiadomosciKlienta(messages = [], previousMessages = [], hasBaseline = true) {
  if (!hasBaseline) return [];
  const previousKeys = new Set((Array.isArray(previousMessages) ? previousMessages : []).map(allegroKluczWiadomosci).filter(Boolean));
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m?.incoming && allegroKluczWiadomosci(m) && !previousKeys.has(allegroKluczWiadomosci(m)))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}
function allegroOznaczNowaKomunikacje(data = {}, previous = {}) {
  const hasBaseline = !!previous?.updated_at;
  const previousThreads = new Map((Array.isArray(previous?.threads) ? previous.threads : []).map((t) => [String(t.id), t]));
  const previousIssues = new Map((Array.isArray(previous?.issues) ? previous.issues : []).map((i) => [String(i.id), i]));
  let threads = (Array.isArray(data?.threads) ? data.threads : []).map((thread) => {
    const previousThread = previousThreads.get(String(thread.id)) || {};
    const nowe = allegroNoweWiadomosciKlienta(thread.messages, previousThread.messages, hasBaseline);
    const latestNewIncoming = nowe[0] || null;
    const humanReplyNeeded = !!latestNewIncoming || (!!previousThread.humanReplyNeeded && !previousThread.manualReplyAt);
    return { ...thread, newIncomingCount: nowe.length, latestNewIncoming, latestNewIncomingKey: allegroKluczWiadomosci(latestNewIncoming), needsReply: !!latestNewIncoming && !allegroMaOdpowiedzSprzedawcyPo(thread.messages, latestNewIncoming), humanReplyNeeded, humanReplySource: latestNewIncoming || previousThread.humanReplySource || null, manualReplyAt: latestNewIncoming ? null : (previousThread.manualReplyAt || null) };
  });
  let issues = (Array.isArray(data?.issues) ? data.issues : []).map((issue) => {
    const wiadomosci = issue.messages?.length ? issue.messages : [issue.lastMessage].filter(Boolean);
    const previousIssue = previousIssues.get(String(issue.id));
    const poprzednie = previousIssue?.messages?.length ? previousIssue.messages : [previousIssue?.lastMessage].filter(Boolean);
    const nowe = allegroNoweWiadomosciKlienta(wiadomosci, poprzednie, hasBaseline);
    const latestNewIncoming = nowe[0] || null;
    const humanReplyNeeded = !!latestNewIncoming || (!!previousIssue?.humanReplyNeeded && !previousIssue?.manualReplyAt);
    return { ...issue, newIncomingCount: nowe.length, latestNewIncoming, latestNewIncomingKey: allegroKluczWiadomosci(latestNewIncoming), needsReply: !!latestNewIncoming && !!issue.chatActive && !allegroMaOdpowiedzSprzedawcyPo(wiadomosci, latestNewIncoming), humanReplyNeeded, humanReplySource: latestNewIncoming || previousIssue?.humanReplySource || null, manualReplyAt: latestNewIncoming ? null : (previousIssue?.manualReplyAt || null) };
  });
  const freshThreadIds = new Set(threads.map((x) => String(x.id))), freshIssueIds = new Set(issues.map((x) => String(x.id)));
  threads = [...threads, ...[...previousThreads.values()].filter((x) => !freshThreadIds.has(String(x.id))).map((x) => ({ ...x, cachedOlder: true }))].slice(0, 500);
  issues = [...issues, ...[...previousIssues.values()].filter((x) => !freshIssueIds.has(String(x.id))).map((x) => ({ ...x, cachedOlder: true }))].slice(0, 500);
  return { ...data, threads, issues, baselineCreated: !hasBaseline };
}
function allegroMaOdpowiedzSprzedawcyPo(messages = [], msg = null) {
  if (!msg) return false;
  const t = new Date(msg.createdAt || 0).getTime() || 0;
  return (Array.isArray(messages) ? messages : []).some((m) => !m.incoming && ((new Date(m.createdAt || 0).getTime() || 0) >= t));
}
function allegroNajnowszaWiadomoscKlienta(item = {}) {
  const messages = item.messages?.length ? item.messages : [item.lastMessage].filter(Boolean);
  return (Array.isArray(messages) ? messages : []).filter((m) => m?.incoming).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
}
function allegroKluczSprawyWewnetrznej(type = 'thread', id = '') {
  return `${type === 'issue' ? 'issue' : 'thread'}:${tekst(id, 120).trim()}`;
}
function allegroZastosujStatusyWewnetrzne(data = {}, internalRec = {}) {
  const items = internalRec.items && typeof internalRec.items === 'object' ? { ...internalRec.items } : {};
  let changed = false;
  const apply = (type, item = {}) => {
    const key = allegroKluczSprawyWewnetrznej(type, item.id);
    let state = items[key] && typeof items[key] === 'object' ? { ...items[key] } : null;
    const latestIncoming = allegroNajnowszaWiadomoscKlienta(item);
    const sourceMessageKey = allegroKluczWiadomosci(latestIncoming);
    if (state?.resolved && sourceMessageKey && state.sourceMessageKey !== sourceMessageKey) {
      state = { ...state, resolved: false, reopenedAt: new Date().toISOString(), reopenReason: 'new_customer_message', currentSourceMessageKey: sourceMessageKey };
      items[key] = state; changed = true;
    }
    if (state?.resolved) return { ...item, internalResolved: true, internalResolution: state, needsReply: false, humanReplyNeeded: false, newIncomingCount: 0 };
    return { ...item, internalResolved: false, internalResolution: state || null };
  };
  return {
    data: { ...data, threads: (data.threads || []).map((x) => apply('thread', x)), issues: (data.issues || []).map((x) => apply('issue', x)) },
    items,
    changed,
  };
}
function allegroAutoReplyText(settings = {}, item = {}, kind = 'message') {
  const buyer = item.buyerLogin || 'Kliencie';
  return String(settings.template || ALLEGRO_AUTO_REPLY_DEFAULT)
    .replace(/\{login\}/g, buyer)
    .replace(/\{typ\}/g, kind === 'issue' ? 'dyskusję/reklamację' : 'wiadomość')
    .slice(0, 2000);
}
async function allegroPobierzKomunikacje(req, { limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const errors = [];
  let threadsSource = [];
  try {
    for (let offset = 0; offset < safeLimit; offset += 20) {
      const pageLimit = Math.min(20, safeLimit - offset);
      const threadsRaw = await allegroWywolaj(req, '/messaging/threads', { parameters: { limit: pageLimit, offset } });
      const page = allegroLista(threadsRaw, ['threads', 'items']);
      threadsSource.push(...page);
      if (page.length < pageLimit) break;
    }
  } catch (e) {
    errors.push({ key: 'threads', status: e.status || 0, code: e.code || '', message: e.message || String(e) });
  }
  const threads = (await Promise.all(threadsSource.slice(0, safeLimit).map(async (t) => {
    const id = tekst(t.id, 120);
    if (!id) return null;
    let messages = [];
    try {
      const raw = await allegroWywolaj(req, `/messaging/threads/${encodeURIComponent(id)}/messages`, { parameters: { limit: 20, offset: 0 } });
      messages = allegroLista(raw, ['messages', 'items']);
    } catch {}
    return allegroNormalizujWatek(t, messages);
  }))).filter(Boolean);
  let issuesSource = [];
  try {
    const issuesRaw = await allegroWywolaj(req, '/sale/issues', { parameters: { limit: Math.min(100, safeLimit), offset: 0 }, accept: ALLEGRO_BETA_JSON });
    issuesSource = allegroLista(issuesRaw, ['issues', 'items']);
  } catch (e) {
    errors.push({ key: 'issues', status: e.status || 0, code: e.code || '', message: e.message || String(e) });
  }
  const issues = (await Promise.all(issuesSource.slice(0, safeLimit).map(async (i) => {
    const id = tekst(i.id, 120);
    if (!id) return null;
    let chat = [];
    try {
      const raw = await allegroWywolaj(req, `/sale/issues/${encodeURIComponent(id)}/chat`, { accept: ALLEGRO_BETA_JSON });
      chat = allegroLista(raw, ['chat', 'messages', 'items']);
    } catch {}
    return allegroNormalizujIssue(i, chat);
  }))).filter(Boolean);
  return { threads, issues, errors, requiresReauth: errors.some((e) => Number(e.status) === 403) };
}
async function allegroWyslijAutoOdpowiedzi(req, data, settings) {
  const rec = await czytaj('allegro_auto_replies', { items: {}, updated_at: null });
  const items = rec.items && typeof rec.items === 'object' ? rec.items : {};
  const sent = [];
  const skipped = [];
  const s = allegroUstawieniaKomunikacji(settings);
  const markSkip = (key, reason) => skipped.push({ key, reason });
  if (s.enabled && s.messageCenter) {
    for (const thread of data.threads || []) {
      const first = thread.latestNewIncoming || null;
      const sourceKey = allegroKluczWiadomosci(first);
      const key = `thread:${thread.id}:${sourceKey}`;
      if (thread.cachedOlder) { markSkip(key, 'starszy wpis zachowany wyłącznie do wyszukiwania'); continue; }
      if (thread.internalResolved) { markSkip(key, 'sprawa zamknięta wewnętrznie'); continue; }
      if (!first || !thread.needsReply) { markSkip(key, 'brak nowej wiadomości klienta'); continue; }
      if (items[key]) { markSkip(key, 'już wysłano'); continue; }
      if (!allegroJestSwieze(first.createdAt, s.freshHours)) { markSkip(key, 'wiadomość poza oknem czasowym'); continue; }
      if (allegroMaOdpowiedzSprzedawcyPo(thread.messages, first)) { markSkip(key, 'sprzedawca już odpowiedział'); continue; }
      const text = allegroAutoReplyText(s, thread, 'thread');
      const res = await allegroWywolaj(req, `/messaging/threads/${encodeURIComponent(thread.id)}/messages`, { method: 'POST', bodyObj: { text, attachments: [] } });
      items[key] = { key, type: 'thread', id: thread.id, sourceMessageId: first.id, responseId: res.id || '', sent_at: new Date().toISOString(), buyerLogin: thread.buyerLogin };
      sent.push(items[key]);
    }
  }
  if (s.enabled && s.issues) {
    for (const issue of data.issues || []) {
      const first = issue.latestNewIncoming || null;
      const sourceKey = allegroKluczWiadomosci(first);
      const key = `issue:${issue.id}:${sourceKey}`;
      if (issue.cachedOlder) { markSkip(key, 'starszy wpis zachowany wyłącznie do wyszukiwania'); continue; }
      if (issue.internalResolved) { markSkip(key, 'sprawa zamknięta wewnętrznie'); continue; }
      if (!first || !issue.needsReply) { markSkip(key, 'brak nowej wiadomości klienta'); continue; }
      if (items[key]) { markSkip(key, 'już wysłano'); continue; }
      if (!issue.chatActive) { markSkip(key, 'czat nieaktywny'); continue; }
      if (!allegroJestSwieze(first.createdAt, s.freshHours)) { markSkip(key, 'wiadomość poza oknem czasowym'); continue; }
      if (allegroMaOdpowiedzSprzedawcyPo(issue.messages, first)) { markSkip(key, 'sprzedawca już odpowiedział'); continue; }
      const text = allegroAutoReplyText(s, issue, 'issue');
      const res = await allegroWywolaj(req, `/sale/issues/${encodeURIComponent(issue.id)}/message`, { method: 'POST', accept: ALLEGRO_BETA_JSON, contentType: ALLEGRO_BETA_JSON, bodyObj: { text, attachments: [], type: 'REGULAR' } });
      items[key] = { key, type: 'issue', id: issue.id, sourceMessageId: first.id, responseId: res.id || '', sent_at: new Date().toISOString(), buyerLogin: issue.buyerLogin };
      sent.push(items[key]);
    }
  }
  await zapisz('allegro_auto_replies', { items, updated_at: new Date().toISOString() });
  return { sent, skipped, items };
}
function allegroOrderIdKomunikacji(item = {}) {
  const messages = Array.isArray(item.messages) ? item.messages : [];
  return tekst(item.orderId || item.lastMessage?.orderId || messages.find((m) => m?.orderId)?.orderId || '', 120).trim();
}
function allegroKontekstOdpowiedzi(item = {}, order = null) {
  const analysis = order?.agentAnalysis || {};
  const positions = Array.isArray(analysis.positions) ? analysis.positions : [];
  const products = (Array.isArray(order?.lineItems) ? order.lineItems : []).map((x) => `${tekst(x.offerName || 'produkt', 120)} × ${Math.max(1, Number(x.quantity) || 1)}`).slice(0, 8);
  const stock = positions.map((p) => ({ name: tekst(p.nazwa || p.productName || 'produkt', 120), stock: p.stock, available: p.available, shortage: Math.max(0, Number(p.shortage) || 0), location: tekst(p.location || '', 80) }));
  return {
    orderId: tekst(order?.id || order?.nr || allegroOrderIdKomunikacji(item), 120),
    status: allegroStatusKolejkiZamowienia(order || {}, {}),
    warehouseStage: tekst(order?.warehouseStage || '', 40),
    products,
    stock,
    ready: !!analysis.gotowe,
    shortages: stock.reduce((sum, p) => sum + p.shortage, 0),
  };
}
function allegroPropozycjaOdpowiedzi(type = 'thread', item = {}, order = null) {
  const buyer = tekst(item.buyerLogin || 'Kliencie', 120);
  const context = allegroKontekstOdpowiedzi(item, order);
  const last = item.humanReplySource || item.latestNewIncoming || item.lastMessage || {};
  const incoming = String(last.text || item.subject || '').toLowerCase();
  const shippingQuestion = /kiedy|wysył|pacz|dostaw|status|gdzie/.test(incoming);
  const stockQuestion = /dostępn|stan|iloś|sztuk/.test(incoming);
  let body = 'Dziękujemy za wiadomość. Sprawdziliśmy przekazane informacje.';
  if (context.orderId) {
    if (context.status === 'SENT' || context.status === 'PICKED_UP') body = `Zamówienie ${context.orderId} zostało już przekazane do wysyłki. Sprawdzimy bieżący status doręczenia i w razie potrzeby wrócimy z dodatkowymi informacjami.`;
    else if (context.shortages > 0) body = `Sprawdziliśmy zamówienie ${context.orderId}. Część produktów wymaga jeszcze potwierdzenia dostępności, dlatego weryfikujemy termin przygotowania. Przekażemy dokładną informację, gdy tylko kontrola zostanie zakończona.`;
    else if (context.ready) body = `Sprawdziliśmy zamówienie ${context.orderId}. Produkty są dostępne do skompletowania i zamówienie jest przygotowywane do dalszej realizacji.`;
    else body = `Sprawdziliśmy zamówienie ${context.orderId}. Jest ono obecnie w obsłudze, a agent magazynowy weryfikuje produkty i etap kompletacji.`;
  } else if (stockQuestion) body = 'Dziękujemy za pytanie o dostępność. Sprawdzamy aktualny stan produktu i potwierdzimy możliwą ilość oraz termin realizacji.';
  else if (shippingQuestion) body = 'Dziękujemy za wiadomość dotyczącą wysyłki. Sprawdzamy bieżący etap realizacji i przekażemy dokładną informację o terminie nadania.';
  if (type === 'issue') body += ' Zapoznaliśmy się również z treścią zgłoszenia i będziemy prowadzić dalszą obsługę w tej dyskusji.';
  return `Dzień dobry ${buyer},\n\n${body}\n\nPozdrawiamy serdecznie\nArtway-TM`;
}
async function allegroWyslijPrzypomnieniaTelegram(data = {}, settings = {}) {
  const s = allegroUstawieniaKomunikacji(settings);
  if (!s.telegramReminders) return { sent: [], skipped: [], disabled: true };
  const rec = await czytaj('allegro_communication_telegram_alerts', { items: {}, updated_at: null });
  const items = rec.items && typeof rec.items === 'object' ? rec.items : {};
  const sent = [], skipped = [];
  const candidates = [
    ...(data.threads || []).map((item) => ({ type: 'thread', item })),
    ...(data.issues || []).map((item) => ({ type: 'issue', item })),
  ];
  for (const { type, item } of candidates) {
    const incoming = item.latestNewIncoming || null;
    const sourceKey = allegroKluczWiadomosci(incoming);
    const key = `${type}:${item.id}:${sourceKey}`;
    if (item.cachedOlder) { skipped.push({ key, reason: 'starszy wpis zachowany wyłącznie do wyszukiwania' }); continue; }
    if (item.internalResolved) { skipped.push({ key, reason: 'sprawa zamknięta wewnętrznie' }); continue; }
    if (!incoming || !item.humanReplyNeeded) { skipped.push({ key, reason: 'brak nowej nieobsłużonej wiadomości' }); continue; }
    if (items[key]) { skipped.push({ key, reason: 'przypomnienie już wysłane' }); continue; }
    const kind = type === 'issue' ? (item.type === 'CLAIM' ? 'reklamacja' : 'dyskusja') : 'wiadomość';
    const orderId = allegroOrderIdKomunikacji(item);
    const target = type === 'issue' ? 'dyskusje' : 'wiadomosci';
    const text = `<b>💬 Nowa ${telegramHtml(kind)} Allegro wymaga odpowiedzi</b>\n<b>Klient:</b> ${telegramHtml(item.buyerLogin || '—')}${orderId ? `\n<b>Zamówienie:</b> ${telegramHtml(orderId)}` : ''}\n<b>Treść:</b> ${telegramHtml(tekst(incoming.text || item.subject || 'Brak treści', 500))}\n\nOtwórz: https://artwaytm.pl/#/admin/allegro/${target}`;
    try {
      const response = await wyslijTelegramHtml(text);
      items[key] = { key, type, id: item.id, sourceMessageId: incoming.id || '', sent_at: new Date().toISOString(), telegramMessageId: response?.message_id || '' };
      sent.push(items[key]);
    } catch (e) { skipped.push({ key, reason: tekst(e.message || String(e), 300) }); }
  }
  await zapisz('allegro_communication_telegram_alerts', { items, updated_at: new Date().toISOString() });
  return { sent, skipped, items };
}

// ─── INPOST ShipX (przesyłki, etykiety, tracking) + Geowidget ───
const INPOST_ENVY = new Set(['production', 'sandbox']);
const INPOST_SENDING_METHODS = new Set(['parcel_locker', 'pok', 'pop', 'courier_pok', 'branch', 'dispatch_order']);
const INPOST_DROPOFF_METHODS = new Set(['parcel_locker', 'pok', 'pop', 'courier_pok']);
function inpostEnv() {
  const env = String(process.env.INPOST_ENV || 'production').trim().toLowerCase();
  return INPOST_ENVY.has(env) ? env : 'production';
}
function inpostBaseUrl() {
  return inpostEnv() === 'sandbox' ? 'https://sandbox-api-shipx-pl.easypack24.net' : 'https://api-shipx-pl.easypack24.net';
}
function inpostPointsBaseUrl() {
  return inpostEnv() === 'sandbox' ? 'https://sandbox-api-shipx-pl.easypack24.net' : 'https://api-shipx-pl.easypack24.net';
}
function inpostKonfiguracja() {
  const token = tekst(process.env.INPOST_TOKEN || process.env.INPOST_API_TOKEN || '', 4000).trim();
  const orgId = tekst(process.env.INPOST_ORG_ID || process.env.INPOST_ORGANIZATION_ID || '', 40).trim();
  const geowidgetToken = tekst(process.env.INPOST_GEOWIDGET_TOKEN || '', 4000).trim();
  const missingEnv = [];
  if (!token) missingEnv.push('INPOST_TOKEN');
  if (!orgId) missingEnv.push('INPOST_ORG_ID');
  return {
    token,
    orgId,
    geowidgetToken,
    configured: missingEnv.length === 0,
    missingEnv,
    env: inpostEnv(),
    baseUrl: inpostBaseUrl(),
    sendingMethod: tekst(process.env.INPOST_SENDING_METHOD || 'parcel_locker', 40).trim() || 'parcel_locker',
    lockerService: tekst(process.env.INPOST_LOCKER_SERVICE || 'inpost_locker_standard', 80).trim() || 'inpost_locker_standard',
    courierService: tekst(process.env.INPOST_COURIER_SERVICE || 'inpost_courier_standard', 80).trim() || 'inpost_courier_standard',
  };
}
function inpostPublicConfig() {
  const c = inpostKonfiguracja();
  return {
    configured: c.configured,
    env: c.env,
    geowidgetToken: c.geowidgetToken,
    geowidgetConfigured: !!c.geowidgetToken,
    missingEnv: c.missingEnv,
    requiredEnv: ['INPOST_TOKEN', 'INPOST_ORG_ID'],
    services: { locker: c.lockerService, courier: c.courierService },
    webhookConfigured: !!tekst(process.env.INPOST_WEBHOOK_SECRET || '', 300).trim(),
    optionalEnv: ['INPOST_GEOWIDGET_TOKEN', 'INPOST_WEBHOOK_SECRET', 'INPOST_ENV=production', 'INPOST_SENDING_METHOD=parcel_locker', 'INPOST_LOCKER_SERVICE', 'INPOST_COURIER_SERVICE'],
  };
}
async function inpostWywolaj(path, { method = 'GET', bodyObj = null, accept = 'application/json' } = {}) {
  const c = inpostKonfiguracja();
  if (!c.configured) {
    const blad = new Error('InPost nie jest skonfigurowany po stronie serwera. Ustaw INPOST_TOKEN i INPOST_ORG_ID w Netlify.');
    blad.code = 'inpost_not_configured';
    blad.status = 503;
    blad.missingEnv = c.missingEnv;
    throw blad;
  }
  const headers = {
    'Authorization': `Bearer ${c.token}`,
    'Accept': accept,
    'Accept-Language': 'pl_PL',
    'X-User-Agent': 'Artway-TM',
    'X-User-Agent-Version': '1.0',
    'X-Request-ID': `artway-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  };
  const body = bodyObj === null ? undefined : JSON.stringify(bodyObj);
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(new URL(path, c.baseUrl).toString(), { method, headers, body });
  const ct = r.headers.get('content-type') || '';
  if (accept === 'application/pdf' || ct.includes('application/pdf') || ct.includes('octet-stream')) {
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      const dane = bezpiecznyJson(t);
      const blad = new Error(bledyInpostTekst(dane, `InPost HTTP ${r.status}`));
      blad.status = r.status; blad.code = dane?.error || dane?.code || 'inpost_http_error'; blad.inpost = dane; throw blad;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return { binary: true, contentType: ct || 'application/pdf', base64: buf.toString('base64') };
  }
  const t = await r.text();
  const dane = bezpiecznyJson(t);
  if (!r.ok) {
    const blad = new Error(bledyInpostTekst(dane, `InPost HTTP ${r.status}`));
    blad.status = r.status; blad.code = dane?.error || dane?.code || 'inpost_http_error'; blad.inpost = dane; throw blad;
  }
  return dane || {};
}
function inpostPointDto(p) {
  const ad = p?.address_details || {};
  const addr = p?.address || {};
  const loc = p?.location || {};
  return {
    name: tekst(p?.name, 40).trim(),
    status: tekst(p?.status, 40).trim(),
    type: Array.isArray(p?.type) ? p.type.map((x) => tekst(x, 40).trim()).filter(Boolean) : [],
    functions: Array.isArray(p?.functions) ? p.functions.map((x) => tekst(x, 60).trim()).filter(Boolean) : [],
    address: [tekst(addr.line1, 120).trim(), tekst(addr.line2, 120).trim()].filter(Boolean).join(', '),
    city: tekst(ad.city, 80).trim(),
    postCode: tekst(ad.post_code, 12).trim(),
    street: tekst(ad.street, 120).trim(),
    buildingNumber: tekst(ad.building_number, 30).trim(),
    description: [tekst(p?.location_description, 140).trim(), tekst(p?.location_description_1, 140).trim(), tekst(p?.location_description_2, 140).trim()].filter(Boolean).join(' • '),
    openingHours: tekst(p?.opening_hours, 80).trim(),
    location247: !!p?.location_247,
    easyAccessZone: !!p?.easy_access_zone,
    distance: Number.isFinite(Number(p?.distance)) ? Number(p.distance) : null,
    latitude: Number.isFinite(Number(loc.latitude)) ? Number(loc.latitude) : null,
    longitude: Number.isFinite(Number(loc.longitude)) ? Number(loc.longitude) : null,
  };
}
async function inpostSzukajPunktow(url) {
  const q = tekst(url.searchParams.get('q') || '', 100).trim();
  const postCode = kodPocztowyInpost(url.searchParams.get('post_code') || url.searchParams.get('kod') || '');
  const city = tekst(url.searchParams.get('city') || url.searchParams.get('miasto') || '', 80).trim();
  const latRaw = url.searchParams.get('lat');
  const lngRaw = url.searchParams.get('lng');
  const lat = latRaw !== null && latRaw !== '' ? Number(latRaw) : NaN;
  const lng = lngRaw !== null && lngRaw !== '' ? Number(lngRaw) : NaN;
  const limitRaw = Number(url.searchParams.get('limit') || 12);
  const limit = Math.min(25, Math.max(1, Number.isFinite(limitRaw) ? Math.round(limitRaw) : 12));
  const api = new URL('/v1/points', inpostPointsBaseUrl());
  api.searchParams.set('type', 'parcel_locker');
  api.searchParams.set('functions', 'parcel_collect');
  api.searchParams.set('per_page', String(limit));
  api.searchParams.set('fields', 'name,type,status,functions,address,address_details,location_description,location_description_1,location_description_2,opening_hours,location_247,easy_access_zone,distance,location');
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    api.searchParams.set('relative_point', `${lat},${lng}`);
    api.searchParams.set('sort_by', 'distance_to_relative_point');
    api.searchParams.set('limit', String(limit));
    api.searchParams.set('max_distance', '50000');
  } else if (/^\d{2}-\d{3}$/.test(postCode)) {
    api.searchParams.set('relative_post_code', postCode);
    api.searchParams.set('sort_by', 'distance_to_relative_point');
    api.searchParams.set('limit', String(limit));
    api.searchParams.set('max_distance', '50000');
  } else if (/^[A-Za-z]{2,5}\d[A-Za-z0-9]*$/i.test(q)) {
    api.searchParams.set('name', q.toUpperCase());
    api.searchParams.set('sort_by', 'name');
  } else if (q) {
    api.searchParams.set('city', q);
    api.searchParams.set('sort_by', 'name');
  } else if (city) {
    api.searchParams.set('city', city);
    api.searchParams.set('sort_by', 'name');
  } else {
    return { ok: false, error: 'Podaj nazwę miasta, kod pocztowy, nazwę paczkomatu albo współrzędne.', code: 'missing_query' };
  }
  const r = await fetch(api.toString(), {
    headers: { 'Accept': 'application/json', 'Accept-Language': 'pl_PL', 'X-User-Agent': 'Artway-TM' },
  });
  const t = await r.text();
  const dane = bezpiecznyJson(t) || {};
  if (!r.ok) {
    const blad = new Error(bledyInpostTekst(dane, `InPost Points HTTP ${r.status}`));
    blad.status = r.status;
    blad.code = 'inpost_points_error';
    throw blad;
  }
  return {
    ok: true,
    count: Number(dane.count || 0),
    page: Number(dane.page || 1),
    perPage: Number(dane.per_page || limit),
    points: Array.isArray(dane.items) ? dane.items.map(inpostPointDto).filter((p) => p.name && (!p.status || p.status === 'Operating')) : [],
  };
}
function bezpiecznyJson(t) {
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) { return { raw: t }; }
}
function bledyInpostTekst(dane, fallback) {
  if (!dane) return fallback;
  if (dane.message && typeof dane.message === 'string') {
    const det = dane.details && typeof dane.details === 'object'
      ? Object.entries(dane.details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
      : '';
    return det ? `${dane.message} (${det})` : dane.message;
  }
  if (dane.description && typeof dane.description === 'string') return dane.description;
  if (dane.error) return `${dane.error}${dane.error_description ? ': ' + dane.error_description : ''}`;
  return fallback;
}
function telefonInpost(v) {
  const cyfry = String(v || '').replace(/[^0-9]/g, '');
  if (cyfry.length === 11 && cyfry.startsWith('48')) return cyfry.slice(2);
  return cyfry.slice(-9);
}
function emailInpostOk(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}
function kodPocztowyInpost(v) {
  const raw = String(v || '').replace(/\s/g, '');
  const m = raw.match(/^(\d{2})-?(\d{3})$/);
  return m ? `${m[1]}-${m[2]}` : raw;
}
function adresInpostZamowienia(z) {
  const a = z?.adresDostawy || {};
  let street = tekst(a.ulica, 120).trim();
  let building_number = tekst(a.nrDomu, 30).trim();
  const flat_number = tekst(a.nrLokalu, 30).trim();
  let post_code = kodPocztowyInpost(a.kod);
  let city = tekst(a.miasto, 80).trim();

  if ((!street || !building_number || !post_code || !city) && z?.adres) {
    const [liniaAdresu = '', liniaMiasta = ''] = String(z.adres).split(',').map((x) => x.trim());
    const mMiasto = liniaMiasta.match(/(\d{2}-?\d{3})\s+(.+)/);
    if (!post_code && mMiasto) post_code = kodPocztowyInpost(mMiasto[1]);
    if (!city && mMiasto) city = mMiasto[2].trim();
    const mUlica = liniaAdresu.match(/^(.+?)\s+([0-9][0-9A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż/.-]*)$/);
    if (!street && mUlica) street = mUlica[1].trim();
    if (!building_number && mUlica) building_number = mUlica[2].trim();
    if (!street && liniaAdresu) street = liniaAdresu;
  }

  return { street, building_number, flat_number, city, post_code, country_code: 'PL' };
}
function czyDostawaPaczkomatInPost(z) {
  const id = tekst(z?.dostawaId, 40).trim().toLowerCase();
  if (id === 'kurier' || id === 'kurier_inpost') return false;
  if (id === 'paczkomat') return true;
  return !!(z?.paczkomat || z?.wysylka?.punktKod);
}
function walidujPrzesylkeInPost(z) {
  const k = z?.klient || {};
  const w = z?.wysylka || {};
  const doPaczkomatu = czyDostawaPaczkomatInPost(z);
  const punkt = tekst(z?.paczkomat || w?.punktKod, 40).trim().toUpperCase();
  const email = tekst(z?.email || k.email, 200).trim().toLowerCase();
  const phone = telefonInpost(k.telefon || z?.telefon);
  const errors = [];

  if (!emailInpostOk(email)) errors.push({ field: 'receiver.email', message: 'Brak poprawnego adresu e-mail odbiorcy.' });
  if (!/^\d{9}$/.test(phone)) errors.push({ field: 'receiver.phone', message: 'Brak poprawnego polskiego numeru telefonu odbiorcy (9 cyfr).' });
  if (doPaczkomatu && !punkt) errors.push({ field: 'custom_attributes.target_point', message: 'Brak kodu paczkomatu / punktu odbioru.' });

  const address = adresInpostZamowienia(z);
  if (!doPaczkomatu) {
    if (!address.street) errors.push({ field: 'receiver.address.street', message: 'Brak ulicy odbiorcy.' });
    if (!address.building_number) errors.push({ field: 'receiver.address.building_number', message: 'Brak numeru budynku odbiorcy.' });
    if (!/^\d{2}-\d{3}$/.test(address.post_code)) errors.push({ field: 'receiver.address.post_code', message: 'Brak poprawnego kodu pocztowego odbiorcy.' });
    if (!address.city) errors.push({ field: 'receiver.address.city', message: 'Brak miasta odbiorcy.' });
  }

  const gab = tekst(w.gabaryt, 20).trim().toLowerCase();
  if (!['', 'small', 'medium', 'large'].includes(gab)) errors.push({ field: 'parcel.template', message: 'Gabaryt InPost może być small, medium albo large.' });
  if (!gab) {
    for (const [field, label, fallback] of [['dlugosc', 'długość', 30], ['szerokosc', 'szerokość', 20], ['wysokosc', 'wysokość', 15], ['waga', 'waga', 1]]) {
      const n = Number(w[field] || fallback);
      if (!Number.isFinite(n) || n <= 0) errors.push({ field: `parcel.${field}`, message: `Niepoprawna ${label} paczki.` });
    }
  }

  return { ok: errors.length === 0, errors, doPaczkomatu, punkt, email, phone, address };
}
function inpostListaUslug(org) {
  return Array.isArray(org?.services) ? org.services.map((x) => tekst(x, 80).trim()).filter(Boolean) : [];
}
const INPOST_LOCKER_SERVICE_FALLBACKS = [
  'inpost_locker_standard',
  'inpost_locker_standard_smart',
  'inpost_locker_pass_thru',
  'inpost_locker_allegro',
];
const INPOST_COURIER_SERVICE_FALLBACKS = [
  'inpost_courier_standard',
  'inpost_courier_c2c',
  'inpost_courier_local_standard',
  'inpost_courier_local_express',
  'inpost_courier_allegro',
];
function inpostWybierzAktywnaUsluge(services, preferowana, fallbacks) {
  if (!services.length) return preferowana;
  if (services.includes(preferowana)) return preferowana;
  return fallbacks.find((x) => services.includes(x)) || preferowana;
}
function inpostDostepnoscUslug(c, org) {
  const services = inpostListaUslug(org);
  const sprawdzaj = services.length > 0;
  const lockerService = sprawdzaj ? inpostWybierzAktywnaUsluge(services, c.lockerService, INPOST_LOCKER_SERVICE_FALLBACKS) : c.lockerService;
  const courierService = sprawdzaj ? inpostWybierzAktywnaUsluge(services, c.courierService, INPOST_COURIER_SERVICE_FALLBACKS) : c.courierService;
  return {
    services,
    requestedLockerService: c.lockerService,
    requestedCourierService: c.courierService,
    lockerService,
    courierService,
    locker: !sprawdzaj || services.includes(lockerService),
    courier: !sprawdzaj || services.includes(courierService),
  };
}
async function inpostOrganizacja(c) {
  return inpostWywolaj(`/v1/organizations/${encodeURIComponent(c.orgId)}`, { method: 'GET' });
}
function boolInpostSerwer(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return v === true || s === 'tak' || s === 'true' || s === '1' || s === 'yes';
}
function inpostPobranieAktywne(z, w) {
  if (w && Object.prototype.hasOwnProperty.call(w, 'pobranieAktywne')) return boolInpostSerwer(w.pobranieAktywne);
  return z?.platnoscId === 'pobranie';
}
function inpostSposobNadaniaZamowienia(w, c) {
  const raw = tekst(w?.sposobNadania || '', 40).trim();
  if (INPOST_SENDING_METHODS.has(raw)) return raw;
  const env = tekst(c?.sendingMethod || '', 40).trim();
  return INPOST_SENDING_METHODS.has(env) ? env : 'parcel_locker';
}
function przesylkaShipXPayload(z, c, walidacja = null) {
  const v = walidacja || walidujPrzesylkeInPost(z);
  const k = z?.klient || {};
  const w = z?.wysylka || {};
  const receiver = {
    first_name: tekst(k.imie, 80).trim() || 'Klient',
    last_name: tekst(k.nazwisko, 80).trim() || z?.nr || '—',
    email: v.email,
    phone: v.phone,
  };
  if (tekst(k.firma, 160).trim()) receiver.company_name = tekst(k.firma, 160).trim();
  if (!v.doPaczkomatu) {
    receiver.address = Object.fromEntries(Object.entries(v.address).filter(([, val]) => val));
  }
  // parcele: szablon (small/medium/large) albo wymiary
  const gab = tekst(w.gabaryt, 20).trim().toLowerCase();
  let parcel;
  if (['small', 'medium', 'large'].includes(gab)) parcel = { template: gab };
  else parcel = {
    dimensions: {
      length: String(Math.round((Number(w.dlugosc) || 30) * 10)),
      width: String(Math.round((Number(w.szerokosc) || 20) * 10)),
      height: String(Math.round((Number(w.wysokosc) || 15) * 10)),
      unit: 'mm',
    },
    weight: { amount: String(Number(w.waga) || 1), unit: 'kg' },
  };
  const sendingMethod = inpostSposobNadaniaZamowienia(w, c);
  const dropoffPoint = tekst(w?.punktNadania || w?.dropoffPoint || '', 40).trim().toUpperCase();
  const payload = {
    receiver,
    parcels: [parcel],
    service: v.doPaczkomatu ? c.lockerService : c.courierService,
    only_choice_of_offer: false,
    reference: tekst(z?.nr, 80),
    comments: tekst(`Artway-TM ${z?.nr || ''}`.trim(), 100),
    custom_attributes: {
      sending_method: sendingMethod,
    },
  };
  if (v.doPaczkomatu && v.punkt) payload.custom_attributes.target_point = v.punkt;
  if (dropoffPoint && INPOST_DROPOFF_METHODS.has(sendingMethod)) payload.custom_attributes.dropoff_point = dropoffPoint;
  if (z?.paczkaWeekend || w.paczkaWeekend || kwotaSerwer(z?.oplataPaczkaWeekend || z?.koszty?.paczkaWeekend) > 0) {
    payload.end_of_week_collection = true;
  }
  const codAktywny = inpostPobranieAktywne(z, w);
  const codKwota = codAktywny ? (kwotaSerwer(w.pobranie) || kwotaSerwer(z?.razem)) : 0;
  if (codAktywny && codKwota > 0) {
    payload.cod = { amount: codKwota, currency: 'PLN' };
  }
  const ochronaKwota = Math.max(kwotaSerwer(w.ochrona), codAktywny ? codKwota : 0);
  if (ochronaKwota > 0) {
    payload.insurance = { amount: ochronaKwota, currency: 'PLN' };
  }
  return payload;
}
function numerZShipX(s) {
  const direct = tekst(s?.tracking_number || s?.trackingNumber || '', 120).trim();
  if (direct) return direct;
  const parcels = Array.isArray(s?.parcels) ? s.parcels : (s?.parcels ? [s.parcels] : []);
  for (const p of parcels) {
    const n = tekst(p?.tracking_number || p?.trackingNumber || '', 120).trim();
    if (n) return n;
  }
  return '';
}
const INPOST_STATUSY_ETYKIETA_GOTOWA = new Set([
  'confirmed',
  'dispatched_by_sender',
  'collected_from_sender',
  'taken_by_courier',
  'adopted_at_source_branch',
  'sent_from_source_branch',
  'ready_to_pickup',
  'out_for_delivery',
  'delivered',
  'returned_to_sender',
  'return_redirected_to_sender',
]);
function inpostStatusZShipX(s) {
  return tekst(s?.status, 80).trim();
}
function inpostEtykietaGotowa(src) {
  if (numerZShipX(src)) return true;
  const s = inpostStatusZShipX(src).toLowerCase();
  if (!s) return false;
  if (INPOST_STATUSY_ETYKIETA_GOTOWA.has(s) || s.includes('confirmed')) return true;
  if (s.includes('created') || s.includes('offer') || s.includes('prepared') || s.includes('cancel')) return false;
  const etap = etapZInpostStatus(s).etap || '';
  return ['transport', 'doreczenie', 'dostarczona', 'zwrot'].includes(etap);
}
function inpostOfertaId(src) {
  const selected = src?.selected_offer || (Array.isArray(src?.offers) ? src.offers.find((o) => ['selected', 'available'].includes(String(o?.status || '').toLowerCase())) : null);
  return tekst(selected?.id || '', 80).trim();
}
async function inpostCzekaj(ms) {
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(3000, Number(ms) || 0))));
}
async function inpostPobierzPrzesylke(inpostId) {
  return inpostWywolaj(`/v1/shipments/${encodeURIComponent(inpostId)}`, { method: 'GET' });
}
async function inpostCzekajNaEtykiete(inpostId, { proby = 8, opoznienieMs = 1000 } = {}) {
  let ostatnie = null;
  const ile = Math.max(1, Math.min(12, Number(proby) || 8));
  for (let i = 0; i < ile; i++) {
    ostatnie = await inpostPobierzPrzesylke(inpostId);
    if (inpostEtykietaGotowa(ostatnie)) return ostatnie;
    if (i < ile - 1) await inpostCzekaj(opoznienieMs);
  }
  return ostatnie || {};
}
function inpostWebhookSecret() {
  return tekst(process.env.INPOST_WEBHOOK_SECRET || '', 300).trim();
}
function inpostWebhookAutoryzowany(req, url) {
  const secret = inpostWebhookSecret();
  if (!secret) return false;
  const podane = tekst(
    req.headers.get('x-inpost-webhook-secret')
    || req.headers.get('x-webhook-secret')
    || req.headers.get('x-artway-webhook-token')
    || url.searchParams.get('token')
    || url.searchParams.get('secret')
    || '',
    500,
  ).trim();
  return !!podane && bezpiecznePorownanie(podane, secret);
}
function pierwszePole(obj, klucze, maxDepth = 6) {
  if (!obj || maxDepth < 0) return '';
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const v = pierwszePole(x, klucze, maxDepth - 1);
      if (v) return v;
    }
    return '';
  }
  if (typeof obj !== 'object') return '';
  for (const k of klucze) {
    if (obj[k] != null && typeof obj[k] !== 'object') return tekst(obj[k], 500).trim();
  }
  for (const v of Object.values(obj)) {
    const r = pierwszePole(v, klucze, maxDepth - 1);
    if (r) return r;
  }
  return '';
}
function inpostZdarzeniaZWebhooka(payload) {
  const zrodla = [];
  const dodaj = (x) => { if (x && typeof x === 'object') zrodla.push(x); };
  dodaj(payload);
  if (Array.isArray(payload)) payload.forEach(dodaj);
  if (Array.isArray(payload?.shipments)) payload.shipments.forEach(dodaj);
  if (Array.isArray(payload?.data)) payload.data.forEach(dodaj);
  dodaj(payload?.shipment);
  dodaj(payload?.parcel);
  dodaj(payload?.data);
  const seen = new Set();
  return zrodla.filter((x) => {
    const key = JSON.stringify(x).slice(0, 1000);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}
function inpostDaneZWebhooka(obj, shipment = null) {
  const src = shipment || obj || {};
  const id = tekst(
    src?.id || src?.shipment_id || src?.shipmentId || pierwszePole(obj, ['shipment_id', 'shipmentId', 'shipmentID']),
    80,
  ).trim();
  const tracking = numerZShipX(src) || pierwszePole(obj, ['tracking_number', 'trackingNumber', 'tracking', 'number', 'trackingNo']);
  const status = tekst(src?.status || pierwszePole(obj, ['status', 'shipment_status', 'shipmentStatus', 'event', 'event_type', 'eventType']), 120).trim();
  const reference = tekst(
    src?.reference
    || src?.external_customer_id
    || src?.externalCustomerId
    || src?.custom_attributes?.reference
    || pierwszePole(obj, ['reference', 'external_customer_id', 'externalCustomerId', 'order_number', 'orderNumber', 'order_id', 'orderId']),
    200,
  ).trim();
  const occurredAt = tekst(
    src?.updated_at || src?.created_at || src?.timestamp || src?.event_time || src?.eventTime
    || pierwszePole(obj, ['updated_at', 'created_at', 'timestamp', 'event_time', 'eventTime', 'datetime']),
    120,
  ).trim();
  return { id, tracking, status, reference, occurredAt };
}
function numerZReferencji(reference, items = []) {
  const ref = tekst(reference, 500).trim();
  if (!ref) return '';
  const m = ref.match(/ATM-\d{4,}/i);
  if (m) return m[0].toUpperCase();
  const lower = ref.toLowerCase();
  const znalezione = items.find((z) => z?.nr && lower.includes(String(z.nr).toLowerCase()));
  return znalezione?.nr || '';
}
function etapZInpostStatus(status) {
  const s = String(status || '').toLowerCase();
  if (!s) return {};
  if (s.includes('delivered')) return { etap: 'dostarczona', statusZamowienia: 'dostarczone' };
  if (s.includes('ready_to_pickup') || s.includes('out_for_delivery')) return { etap: 'doreczenie', statusZamowienia: 'w doręczeniu' };
  if (s.includes('returned') || s.includes('return_to') || s.includes('return to') || s.includes('rejected_by_receiver')) return { etap: 'zwrot', statusZamowienia: 'zwrot' };
  if (s.includes('canceled') || s.includes('cancelled')) return { etap: 'anulowana', statusZamowienia: 'anulowane' };
  if (s.includes('undelivered') || s.includes('avizo') || s.includes('delay') || s.includes('missing') || s.includes('damaged')) return { etap: 'problem', blad: status };
  if (s.includes('adopted') || s.includes('sent_from') || s.includes('collected') || s.includes('dispatched') || s.includes('confirmed')) return { etap: 'transport', statusZamowienia: 'nadane' };
  if (s.includes('created') || s.includes('offer') || s.includes('prepared')) return { etap: 'przygotowanie' };
  return {};
}
function znajdzZamowienieInpost(items, dane) {
  const nr = numerZReferencji(dane.reference, items);
  if (nr) return items.find((z) => z.nr === nr) || null;
  const id = tekst(dane.id, 80).trim();
  const tracking = tekst(dane.tracking, 120).trim();
  if (id) {
    const poId = items.find((z) => tekst(z?.wysylka?.inpostId, 80).trim() === id);
    if (poId) return poId;
  }
  if (tracking) {
    const poNumerze = items.find((z) => tekst(z?.wysylka?.numer, 120).trim() === tracking);
    if (poNumerze) return poNumerze;
  }
  return null;
}
async function zapiszLogInpostWebhook(wpis) {
  const rec = await czytaj('inpost_webhooks', { items: [] });
  const items = Array.isArray(rec.items) ? rec.items : [];
  items.push({ czas: new Date().toISOString(), ...wpis });
  await zapisz('inpost_webhooks', { items: items.slice(-200), updated_at: new Date().toISOString() });
}
async function zastosujWebhookInpost(dane) {
  const rec = await czytaj('orders', { items: [] });
  const items = Array.isArray(rec.items) ? rec.items : [];
  const znalezione = znajdzZamowienieInpost(items, dane);
  if (!znalezione) {
    await zapiszLogInpostWebhook({ matched: false, id: dane.id, tracking: dane.tracking, status: dane.status, reference: dane.reference });
    return { matched: false, id: !!dane.id, tracking: !!dane.tracking, reference: !!dane.reference, status: dane.status || '' };
  }
  const idx = items.findIndex((x) => x.nr === znalezione.nr);
  const stary = items[idx];
  const nowy = { ...stary };
  const w = { ...(nowy.wysylka || {}) };
  const statusInfo = etapZInpostStatus(dane.status);
  const teraz = new Date().toLocaleString('pl-PL');
  const czas = dane.occurredAt ? new Date(dane.occurredAt).toLocaleString('pl-PL') : teraz;
  const opis = `${dane.id ? `ID ${dane.id}` : ''}${dane.tracking ? `${dane.id ? ' • ' : ''}${dane.tracking}` : ''}${dane.reference ? ` • ref: ${dane.reference}` : ''}`;
  const historia = Array.isArray(w.historia) ? w.historia.slice() : [];
  const istnieje = historia.some((h) => h.status === `InPost: ${dane.status || 'aktualizacja'}` && String(h.opis || '').includes(dane.tracking || dane.id || dane.reference || ''));
  if (!istnieje) historia.push({ czas, status: `InPost: ${dane.status || 'aktualizacja'}`, opis: opis || 'Zdarzenie z webhooka InPost', zrodlo: 'inpost-webhook' });
  w.przewoznik = 'inpost';
  if (dane.id) w.inpostId = dane.id;
  if (dane.status) w.inpostStatus = dane.status;
  if (dane.tracking) w.numer = dane.tracking;
  if (statusInfo.etap) w.etap = statusInfo.etap;
  if (statusInfo.blad) w.bladIntegracji = statusInfo.blad;
  else if (w.bladIntegracji && statusInfo.etap && statusInfo.etap !== 'problem') w.bladIntegracji = '';
  const etykietaGotowa = inpostEtykietaGotowa({ status: w.inpostStatus, tracking_number: w.numer });
  w.etykietaGotowa = etykietaGotowa;
  w.ostatniaSynchronizacja = new Date().toISOString();
  w.zaktualizowano = new Date().toISOString();
  w.historia = historia;
  w.zadania = {
    ...(w.zadania || {}),
    dane: true,
    etykieta: etykietaGotowa,
    przekazanie: ['transport', 'doreczenie', 'dostarczona'].includes(w.etap) || !!w.zadania?.przekazanie,
  };
  nowy.wysylka = w;
  if (statusInfo.statusZamowienia) nowy.status = statusInfo.statusZamowienia;
  else if (dane.tracking && ['nowe', 'potwierdzone', 'w realizacji'].includes(nowy.status)) nowy.status = 'gotowe do wysyłki';
  items[idx] = nowy;
  await zapisz('orders', { items, updated_at: new Date().toISOString() });
  let email = null;
  try { email = await obsluzEmailePrzejsciaStatusu(stary, nowy); } catch (e) { email = { sent: false, error: e.message }; }
  await zapiszLogInpostWebhook({ matched: true, nr: nowy.nr, id: dane.id, tracking: dane.tracking, status: dane.status, reference: dane.reference });
  return { matched: true, nr: nowy.nr, tracking: w.numer || '', status: w.inpostStatus || '', etap: w.etap || '', email };
}
async function zapiszPrzesylkeNaZamowieniu(nr, patch) {
  const rec = await czytaj('orders', { items: [] });
  const items = Array.isArray(rec.items) ? rec.items : [];
  const i = items.findIndex((x) => x.nr === nr);
  if (i < 0) return { stary: null, nowy: null };
  const stary = items[i];
  const z = { ...stary };
  const w = { ...(z.wysylka || {}), ...patch };
  z.wysylka = w;
  items[i] = z;
  await zapisz('orders', { items, updated_at: new Date().toISOString() });
  return { stary, nowy: z };
}

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'health';

  if (req.method === 'OPTIONS') return odpowiedz({ ok: true });

  try {
    // ─── ZDROWIE / STATUS ───
    if (action === 'health') {
      const s = await czytaj('settings', { updated_at: null });
      const o = await czytaj('orders', { items: [] });
      const u = await czytaj('users', { items: [] });
      const d = await czytaj('deleted_orders', { items: [] });
      const aktywne = filtrujNieusunieteZamowienia(o.items || [], d.items || []);
      return odpowiedz({
        ok: true,
        configured: !!process.env.ARTWAY_ADMIN_TOKEN,
        admin: czyAdmin(req, url),
        store: {
          orders: aktywne.length,
          users: (u.items || []).length,
          deleted_orders: (d.items || []).length,
          settings_updated_at: s.updated_at || null,
        },
        paynow: {
          configured: paynowKonfiguracja(req).configured,
          env: paynowKonfiguracja(req).env,
          continueUrl: paynowKonfiguracja(req).continueUrl,
          notificationUrl: paynowKonfiguracja(req).notificationUrl,
        },
        email: emailPublicConfig(),
        telegram: { configured: !!(telegramKonfiguracja().token && telegramKonfiguracja().chatId) },
        inpost: inpostPublicConfig(),
        allegro: await allegroStatus(req),
        infakt: infaktPublicConfig(),
      });
    }

    // ─── INFAKT: faktury, statusy asynchroniczne i dokumenty ───
    if (action === 'infakt-status') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const config = infaktPublicConfig(); let connection = null;
      if (config.configured && url.searchParams.get('verify') === '1') {
        try { const data = await infaktWywolaj('/api/v3/invoices.json', { parameters: { limit: 1, offset: 0, fields: 'id,uuid,number,status,invoice_date,gross_price' } }); connection = { ok: true, count: Number(data?.metainfo?.total_count ?? data?.entities?.length ?? 0) }; }
        catch (e) { connection = { ok: false, error: tekst(e.message, 700), code: e.code || 'infakt_error' }; }
      }
      const [links, suppliers, purchaseSync] = await Promise.all([czytaj('infakt_invoice_links', { items: {}, updated_at: null }), infaktDostawcyUstawienia(), czytaj('infakt_purchase_price_sync', { pendingItems: [], recentMatches: [], updated_at: null })]);
      return odpowiedz({ ok: true, config, connection, links: links.items || {}, suppliers, purchaseSync, updated_at: links.updated_at || null });
    }

    if (action === 'infakt-supplier-access') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      if (req.method === 'GET') return odpowiedz({ ok: true, suppliers: await infaktDostawcyUstawienia() });
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), items = infaktDostawcyDozwoleni(body.items), updated_at = new Date().toISOString();
      await zapisz('infakt_supplier_access', { items, updated_at });
      return odpowiedz({ ok: true, suppliers: { items, updated_at } });
    }

    if (action === 'infakt-costs') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const suppliers = await infaktDostawcyUstawienia();
      if (!suppliers.items.length) return odpowiedz({ ok: true, costs: [], suppliers, scanned: 0, message: 'Biała lista dostawców jest pusta — żaden dokument kosztowy nie został ujawniony.' });
      const wanted = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 100) || 100));
      const collected = []; let scanned = 0;
      for (let offset = 0; offset < 500 && collected.length < wanted; offset += 100) {
        const data = await infaktWywolaj('/api/v3/documents/costs.json', { parameters: { limit: 100, offset, order: 'created_at desc' } });
        const entities = Array.isArray(data?.entities) ? data.entities : [];
        scanned += entities.length;
        for (const koszt of entities) {
          const seller = infaktNazwaDostawcy(koszt?.seller_name), match = suppliers.items.find((x) => seller === x.match);
          if (seller && match) collected.push(infaktKosztDoZwrotu(koszt, match));
          if (collected.length >= wanted) break;
        }
        if (entities.length < 100 || !data?.metainfo?.next) break;
      }
      const purchaseSync = await czytaj('infakt_purchase_price_sync', { pendingItems: [], recentMatches: [], updated_at: null });
      return odpowiedz({ ok: true, costs: collected, suppliers, purchaseSync, scanned, returned: collected.length });
    }

    if (action === 'infakt-purchase-sync') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({})), purchaseSync = await infaktSynchronizujCenyZakupu({ days: body.days, limit: body.limit, force: body.force === true });
      return odpowiedz({ ok: true, purchaseSync });
    }

    if (action === 'infakt-purchase-match') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({})), result = await infaktPrzypiszCeneZakupu(tekst(body.itemKey, 100), tekst(body.productId, 100));
      return odpowiedz({ ok: true, ...result });
    }

    if (action === 'infakt-invoices') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const linksRec = await czytaj('infakt_invoice_links', { items: {} }), ownUuids = new Set(Object.values(linksRec?.items || {}).map((x) => tekst(x?.invoiceUuid, 200)).filter(Boolean));
      if (!ownUuids.size) return odpowiedz({ ok: true, invoices: [], metainfo: { count: 0, total_count: 0 }, config: infaktPublicConfig() });
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 50) || 50)), offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);
      const data = await infaktWywolaj('/api/v3/invoices.json', { parameters: { limit: 100, offset, order: 'invoice_date desc', fields: 'id,uuid,number,status,invoice_date,sale_date,payment_date,paid_date,gross_price,left_to_pay,currency,client_company_name,client_first_name,client_last_name,client_tax_code' } });
      const invoices = (Array.isArray(data.entities) ? data.entities : []).filter((x) => ownUuids.has(tekst(x?.uuid, 200))).slice(0, limit);
      return odpowiedz({ ok: true, invoices, metainfo: { count: invoices.length, total_count: ownUuids.size }, config: infaktPublicConfig() });
    }

    if (action === 'infakt-create-invoice') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({})), orderNumber = numerZamowienia(body.orderNumber || body.nrZamowienia);
      if (!orderNumber) return odpowiedz({ ok: false, error: 'Brak numeru zamówienia', code: 'validation' }, 422);
      const [ordersRec, linksRec] = await Promise.all([czytaj('orders', { items: [] }), czytaj('infakt_invoice_links', { items: {}, updated_at: null })]);
      const order = (Array.isArray(ordersRec.items) ? ordersRec.items : []).find((x) => numerZamowienia(x?.nr) === orderNumber);
      if (!order) return odpowiedz({ ok: false, error: 'Nie znaleziono zamówienia', code: 'not_found' }, 404);
      const links = linksRec.items && typeof linksRec.items === 'object' ? { ...linksRec.items } : {}, existing = links[orderNumber];
      if (existing && !['error', 'cancelled'].includes(String(existing.status || '').toLowerCase()) && body.force !== true) return odpowiedz({ ok: true, duplicatePrevented: true, link: existing, message: 'Faktura lub zadanie inFakt już istnieje dla tego zamówienia.' });
      const payload = infaktPayloadZamowienia(order, { status: 'draft', invoiceDate: body.invoiceDate, sendToKsef: false });
      const data = await infaktWywolaj('/api/v3/async/invoices.json', { method: 'POST', bodyObj: payload });
      const reference = infaktRef(data), now = new Date().toISOString();
      if (!reference) { const e = new Error('inFakt nie zwrócił numeru referencyjnego zadania'); e.code = 'infakt_missing_reference'; throw e; }
      links[orderNumber] = { orderNumber, taskReference: reference, status: 'processing', processingCode: data.processing_code || 100, processingDescription: tekst(data.processing_description || 'Zlecenie przyjęte', 500), createdAt: now, updatedAt: now, sendToKsef: payload.send_to_ksef, payloadHash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
      await zapisz('infakt_invoice_links', { items: links, updated_at: now });
      return odpowiedz({ ok: true, duplicatePrevented: false, link: links[orderNumber], task: data }, 201);
    }

    if (action === 'infakt-task-status') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const reference = tekst(url.searchParams.get('reference'), 200).trim(), orderNumber = numerZamowienia(url.searchParams.get('orderNumber'));
      if (!reference && !orderNumber) return odpowiedz({ ok: false, error: 'Brak referencji zadania', code: 'validation' }, 422);
      const linksRec = await czytaj('infakt_invoice_links', { items: {}, updated_at: null }), links = linksRec.items && typeof linksRec.items === 'object' ? { ...linksRec.items } : {};
      const current = orderNumber ? links[orderNumber] : Object.values(links).find((x) => x.taskReference === reference), ref = reference || current?.taskReference;
      if (!ref) return odpowiedz({ ok: false, error: 'Nie znaleziono referencji zadania', code: 'not_found' }, 404);
      const data = await infaktWywolaj(`/api/v3/async/invoices/status/${encodeURIComponent(ref)}.json`), invoice = infaktInvoiceFromTask(data), code = Number(data.processing_code || data.code || 0), now = new Date().toISOString();
      const status = code === 201 || invoice?.uuid ? 'created' : code === 422 ? 'error' : 'processing', key = orderNumber || current?.orderNumber;
      const link = { ...(current || {}), orderNumber: key || '', taskReference: ref, status, processingCode: code, processingDescription: tekst(data.processing_description || data.description || '', 700), invoiceId: invoice?.id || current?.invoiceId || null, invoiceUuid: tekst(invoice?.uuid || current?.invoiceUuid || '', 200), invoiceNumber: tekst(invoice?.number || current?.invoiceNumber || '', 120), error: status === 'error' ? infaktErrorText(data, 'Nie udało się utworzyć faktury') : '', updatedAt: now };
      if (key) { links[key] = link; await zapisz('infakt_invoice_links', { items: links, updated_at: now }); }
      return odpowiedz({ ok: true, status, link, task: data });
    }

    if (action === 'infakt-sync') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const linksRec = await czytaj('infakt_invoice_links', { items: {}, updated_at: null }), links = linksRec.items && typeof linksRec.items === 'object' ? { ...linksRec.items } : {}, results = [];
      for (const [orderNumber, current] of Object.entries(links).filter(([, x]) => x?.taskReference && x.status === 'processing').slice(0, 25)) {
        try { const data = await infaktWywolaj(`/api/v3/async/invoices/status/${encodeURIComponent(current.taskReference)}.json`), invoice = infaktInvoiceFromTask(data), code = Number(data.processing_code || data.code || 0), status = code === 201 || invoice?.uuid ? 'created' : code === 422 ? 'error' : 'processing'; links[orderNumber] = { ...current, status, processingCode: code, processingDescription: tekst(data.processing_description || '', 700), invoiceId: invoice?.id || current.invoiceId || null, invoiceUuid: tekst(invoice?.uuid || current.invoiceUuid || '', 200), invoiceNumber: tekst(invoice?.number || current.invoiceNumber || '', 120), error: status === 'error' ? infaktErrorText(data, 'Błąd tworzenia') : '', updatedAt: new Date().toISOString() }; results.push({ orderNumber, status }); }
        catch (e) { results.push({ orderNumber, status: 'error', error: tekst(e.message, 500) }); }
      }
      await zapisz('infakt_invoice_links', { items: links, updated_at: new Date().toISOString() });
      let purchaseSync = null; try { purchaseSync = await infaktSynchronizujCenyZakupu({ days: 180, limit: 25, force: false }); } catch (error) { purchaseSync = { available: false, errors: [tekst(error.message, 500)] }; }
      return odpowiedz({ ok: true, links, results, purchaseSync });
    }

    // ─── E-MAIL: konfiguracja bez sekretów ───
    if (action === 'email-config') {
      return odpowiedz({ ok: true, email: emailPublicConfig() });
    }

    // ─── AGENT AI: jeden kontekst operacyjny całej strony ───
    if (action === 'agent-operations-summary') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      return odpowiedz(await agentCentrumOperacyjne());
    }

    if (action === 'agent-action-runs') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const history = await czytaj('agent_action_runs', { items: [], updated_at: null });
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 30) || 30));
      return odpowiedz({ ok: true, items: (Array.isArray(history.items) ? history.items : []).slice(0, limit), updated_at: history.updated_at || null });
    }

    if (action === 'agent-run-safe-checks') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({})), requested = Array.isArray(body.areas) ? body.areas.map((x) => tekst(x, 80)) : [];
      const allowed = new Map([
        ['site-health', { action: '', label: 'Funkcjonalność strony i integracje', local: true }],
        ['allegro-orders', { action: 'allegro-sync-orders', label: 'Zamówienia Allegro' }],
        ['inpost', { action: 'inpost-sync-all', label: 'Statusy i numery InPost' }],
        ['infakt', { action: 'infakt-sync', label: 'Zadania inFakt i ceny zakupu' }],
      ]), selected = (requested.length ? requested : [...allowed.keys()]).filter((x) => allowed.has(x));
      const adminToken = tokenZadania(req, url), origin = publicznyOrigin(req), startedAt = new Date().toISOString();
      const results = await Promise.all(selected.map(async (area) => {
        const definition = allowed.get(area), started = Date.now();
        try {
          if (definition.local) {
            const center = await agentCentrumOperacyjne(), integrations = center.integrations || {}, missing = Object.entries(integrations).filter(([, ready]) => !ready).map(([name]) => name);
            return { area, label: definition.label, status: missing.length ? 'error' : 'completed', detail: missing.length ? `Wymagają konfiguracji: ${missing.join(', ')}` : `Integracje: ${Object.keys(integrations).join(', ')} • baza i API odpowiadają`, error: missing.length ? `Wymagają konfiguracji: ${missing.join(', ')}` : '', durationMs: Date.now() - started };
          }
          const response = await fetch(`${origin}/api/store?action=${encodeURIComponent(definition.action)}`, { method: 'POST', headers: { 'x-admin-token': adminToken, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ source: 'agent-safe-plan' }) });
          const text = await response.text(); let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
          if (!response.ok || data?.ok === false) throw new Error(tekst(data?.error || data?.message || `HTTP ${response.status}`, 500));
          const count = area === 'allegro-orders'
            ? (Number(data?.imported_new || 0) + Number(data?.refreshed || 0))
            : area === 'inpost'
              ? Number(data?.sprawdzone ?? data?.zmienione ?? 0) || 0
              : Number(data?.results?.length ?? data?.purchaseSync?.processedDocuments ?? data?.processed ?? 0) || 0;
          return { area, label: definition.label, status: 'completed', count, scanned: area === 'allegro-orders' ? Number(data?.fetched || 0) : count, newItems: area === 'allegro-orders' ? Number(data?.imported_new || 0) : 0, refreshed: area === 'allegro-orders' ? Number(data?.refreshed || 0) : 0, durationMs: Date.now() - started };
        } catch (error) {
          return { area, label: definition.label, status: 'error', error: tekst(error?.message || error, 500), durationMs: Date.now() - started };
        }
      }));
      const center = await agentCentrumOperacyjne(); results.forEach((result) => { if (result.area === 'allegro-orders') result.active = Number(center.summary?.activeAllegro || 0); });
      const run = { id: crypto.randomUUID(), source: tekst(body.source || 'admin-panel', 80), profile: tekst(body.profile || 'custom', 40), startedAt, completedAt: new Date().toISOString(), durationMs: Math.max(0, Date.now() - Date.parse(startedAt)), results, completed: results.filter((x) => x.status === 'completed').length, errors: results.filter((x) => x.status === 'error').length, scoreAfter: center.score };
      const history = await czytaj('agent_action_runs', { items: [] }); history.items = [run, ...(Array.isArray(history.items) ? history.items : [])].slice(0, 100); history.updated_at = run.completedAt; await zapisz('agent_action_runs', history);
      return odpowiedz({ ok: true, allCompleted: results.every((x) => x.status === 'completed'), run, center });
    }

    if (action === 'telegram-send-agent-report') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const center = await agentCentrumOperacyjne();
      const sent = await wyslijTelegramHtml(agentRaportTelegramHTML(center), {
        replyMarkup: { inline_keyboard: [[{ text: '🤖 Agent', url: center.links.agent }, { text: '📦 Zamówienia', url: center.links.orders }], [{ text: '🏬 Magazyn', url: center.links.warehouse }, { text: '🟠 Allegro', url: center.links.allegro }], [{ text: '🚚 Wysyłki', url: center.links.shipping }]] },
      });
      return odpowiedz({ ok: true, sentAt: new Date().toISOString(), messageId: sent?.message_id || null, center });
    }

    // ─── TELEGRAM: profesjonalne tabele zamówień do producentów ───
    if (action === 'telegram-send-supplier-order') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const supplier = tekst(body.supplier || '', 120).trim();
      const order = body.order && typeof body.order === 'object' ? body.order : {};
      const tables = telegramTabeleZlecenia(order, supplier);
      if (!tables.length) return odpowiedz({ ok: false, error: 'Zlecenie nie ma pozycji dla wybranego dostawcy', code: 'empty_order' }, 422);
      const messageIds = [];
      for (const table of tables) {
        const sent = await wyslijTelegramHtml(table.text);
        if (sent?.message_id != null) messageIds.push(sent.message_id);
      }
      const sentAt = new Date().toISOString();
      return odpowiedz({ ok: true, sentAt, tables: tables.length, suppliers: [...new Set(tables.map((x) => x.supplier))], messageIds });
    }

    // ─── PRODUCENCI: zatwierdzone zamówienie e-mailem, z ochroną przed duplikatem ───
    if (action === 'email-send-supplier-order') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const order = body.order && typeof body.order === 'object' ? body.order : {};
      const status = tekst(order.status || '', 80).trim().toLowerCase();
      const approvedAt = tekst(order.approvedAt || '', 80).trim();
      const revision = Math.max(1, Number(order.revision) || 1);
      const approvalRevision = Math.max(0, Number(order.approvalRevision) || 0);
      if (!order.id || !approvedAt || approvalRevision !== revision || !['zaakceptowane', 'częściowo wysłane e-mailem'].includes(status)) return odpowiedz({ ok: false, error: 'Najpierw zatwierdź dokładnie aktualną wersję zamówienia producenta', code: 'approval_required' }, 422);
      const suppliers = (Array.isArray(body.suppliers) ? body.suppliers : [body.supplier]).filter((x) => x && typeof x === 'object').slice(0, 30);
      if (!suppliers.length) return odpowiedz({ ok: false, error: 'Brak kartoteki producenta do wysyłki', code: 'supplier_missing' }, 422);
      const prepared = suppliers.map((supplier) => producentEmailZlecenia(order, supplier));
      const invalid = prepared.filter((item) => !item.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.to) || !item.rows.length);
      if (invalid.length) return odpowiedz({ ok: false, error: `Uzupełnij e-mail zamówień i pozycje producenta: ${invalid.map((x) => x.name || 'bez nazwy').join(', ')}`, code: 'supplier_validation' }, 422);
      const auditRec = await czytaj('supplier_order_email_audit', { items: {}, updated_at: null });
      const auditItems = auditRec.items && typeof auditRec.items === 'object' ? { ...auditRec.items } : {};
      const results = [];
      for (const item of prepared) {
        const fingerprint = crypto.createHash('sha256').update(`${order.id}|${revision}|${item.name.toLowerCase()}|${item.to}|${item.rows.map((p) => `${p.kod}:${p.ilosc}`).join('|')}`).digest('hex').slice(0, 32);
        if (auditItems[fingerprint]?.sent === true) {
          results.push({ supplier: item.name, to: item.to, sent: true, skippedDuplicate: true, sentAt: auditItems[fingerprint].sentAt, messageId: auditItems[fingerprint].messageId || '' });
          continue;
        }
        try {
          const sent = await wyslijEmailSMTP({ to: item.to, subject: item.subject, text: item.text, html: item.html });
          const result = { supplier: item.name, to: item.to, sent: true, skippedDuplicate: false, sentAt: new Date().toISOString(), messageId: sent.message_id || '', provider: sent.provider || 'smtp' };
          auditItems[fingerprint] = { ...result, orderId: tekst(order.id, 120), orderNumber: tekst(order.numer || order.id, 120), revision, fingerprint };
          await zapisz('supplier_order_email_audit', { items: auditItems, updated_at: result.sentAt });
          results.push(result);
        } catch (error) {
          results.push({ supplier: item.name, to: item.to, sent: false, error: tekst(error?.message || error, 700), code: tekst(error?.code || 'email_error', 120) });
        }
      }
      const sentAt = results.filter((x) => x.sent).map((x) => x.sentAt).filter(Boolean).sort().pop() || null;
      return odpowiedz({ ok: true, allSent: results.length > 0 && results.every((x) => x.sent), sentAt, results, revision });
    }

    // ─── E-MAIL: wysyłka administracyjna przez Netlify SMTP ───
    if (action === 'send-email') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const to = tekst(body.to, 300).trim();
      const subject = tekst(body.subject, 300).trim();
      const text = tekst(body.text, 20000);
      const html = tekst(body.html, 30000);
      if (!to || !subject || (!text && !html)) return odpowiedz({ ok: false, error: 'Brak adresu, tematu albo treści e-maila' }, 422);
      let r;
      try { r = await wyslijEmailSMTP({ to, subject, text, html: html || undefined }); }
      catch (e) {
        return odpowiedz({ ok: false, error: e.message, code: e.code || 'email_error' }, e.code === 'email_not_configured' ? 503 : 502);
      }
      return odpowiedz({ ok: true, provider: r.provider, message_id: r.message_id, accepted: r.accepted || [] });
    }

    // ─── E-MAIL: ręczna wysyłka wiadomości statusowej z JEDNOLITEGO szablonu (admin) ───
    if (action === 'send-status-email') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const nr = numerZamowienia(body.nr || body.number);
      const typ = tekst(body.typ || body.type, 40).trim();
      if (!nr || !typ) return odpowiedz({ ok: false, error: 'Brak numeru zamówienia albo typu wiadomości' }, 422);
      const rec = await czytaj('orders', { items: [] });
      const z = (Array.isArray(rec.items) ? rec.items : []).find((x) => x.nr === nr);
      if (!z) return odpowiedz({ ok: false, error: 'Nie znaleziono zamówienia', code: 'not_found' }, 404);
      if (!z.email) return odpowiedz({ ok: false, error: 'Zamówienie nie ma adresu e-mail klienta', code: 'no_email' }, 422);
      const c = emailKonfiguracja();
      if (!c.configured) return odpowiedz({ ok: false, error: 'E-mail nie jest skonfigurowany po stronie serwera.', code: 'email_not_configured' }, 503);
      try {
        let r;
        if (typ === 'potwierdzenie') {
          const msg = wiadomoscKlientaZamowienie(z);
          r = await wyslijEmailSMTP({ to: z.email, ...msg });
          await dopiszHistorieEmaila(z.nr, { typ: 'potwierdzenie', status: 'wysłano', provider: r.provider, id: r.message_id, automatyczne: false });
          r = { configured: true, sent: true, provider: r.provider, id: r.message_id };
        } else {
          const kwota = (body.kwota != null && body.kwota !== '') ? Number(body.kwota) : null;
          r = await wyslijEmailStatusowy(z, typ, kwota != null ? { kwota } : {});
          if (r && r.sent === false && r.error) return odpowiedz({ ok: false, error: r.error, code: r.error }, r.error === 'email_not_configured' ? 503 : 502);
        }
        const recPo = await czytaj('orders', { items: [] });
        const zPo = (recPo.items || []).find((x) => x.nr === nr) || z;
        return odpowiedz({ ok: true, provider: r.provider, message_id: r.id, sent: r.sent !== false, powiadomienia: zPo?.wysylka?.powiadomienia || [] });
      } catch (e) {
        return odpowiedz({ ok: false, error: e.message, code: e.code || 'email_error' }, e.code === 'email_not_configured' ? 503 : 502);
      }
    }

    // ─── PAYNOW: konfiguracja publiczna bez sekretów ───
    if (action === 'paynow-config') {
      const cfg = paynowKonfiguracja(req);
      return odpowiedz({
        ok: true,
        configured: cfg.configured,
        env: cfg.env,
        apiBaseUrl: cfg.apiBaseUrl,
        continueUrl: cfg.continueUrl,
        notificationUrl: cfg.notificationUrl,
        requiredEnv: ['PAYNOW_API_KEY', 'PAYNOW_SIGNATURE_KEY', 'PAYNOW_ENV'],
        optionalEnv: ['PAYNOW_CONTINUE_URL', 'PAYNOW_NOTIFICATION_URL'],
      });
    }

    // ─── PAYNOW: utworzenie płatności i linku przekierowania ───
    if (action === 'paynow-create') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const cfg = paynowKonfiguracja(req);
      if (!cfg.configured) return odpowiedz({ ok: false, configured: false, error: 'Paynow nie jest skonfigurowany po stronie serwera. Ustaw PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY w Netlify.', code: 'paynow_not_configured' }, 503);
      const body = await req.json().catch(() => ({}));
      const zam = normalizujZamowienie(body.order);
      if (!zam) return odpowiedz({ ok: false, error: 'Brak danych zamówienia' }, 422);
      const usuniete = mapaUsunietych(await czytajUsunieteZamowienia());
      if (usuniete.has(zam.nr)) return odpowiedz({ ok: false, error: 'Zamówienie jest usunięte i nie może dostać nowej płatności', code: 'deleted' }, 409);

      const rec = await czytaj('orders', { items: [] });
      const items = filtrujNieusunieteZamowienia(rec.items || [], usuniete);
      const istniejeIdx = items.findIndex((x) => x.nr === zam.nr);
      const zapisaneZamowienie = istniejeIdx >= 0 ? items[istniejeIdx] : zam;
      const staraPlatnosc = zapisaneZamowienie.paynow || {};
      if (staraPlatnosc.redirectUrl && !PAYNOW_STATUSY_KONCOWE.has(String(staraPlatnosc.status || '').toUpperCase())) {
        return odpowiedz({
          ok: true,
          configured: true,
          reused: true,
          redirectUrl: staraPlatnosc.redirectUrl,
          paymentId: staraPlatnosc.paymentId || '',
          status: staraPlatnosc.status || '',
          paymentStatus: statusPlatnosciPaynow(staraPlatnosc.status),
          paynow: staraPlatnosc,
        });
      }
      if (istniejeIdx < 0) {
        items.unshift(zapisaneZamowienie);
        while (items.length > LIMIT_ZAMOWIEN) items.pop();
        await zapisz('orders', { items, updated_at: new Date().toISOString() });
      }

      const payload = payloadPlatnosciPaynow(zapisaneZamowienie, req);
      const idempotencyKey = kluczIdempotencji('ord', zapisaneZamowienie.nr);
      const dane = await paynowWywolaj(req, '/v3/payments', { method: 'POST', bodyObj: payload, idempotencyKey });
      const status = tekst(dane.status, 40).toUpperCase();
      const paymentId = tekst(dane.paymentId, 40);
      const redirectUrl = tekst(dane.redirectUrl, 1000);
      const zaktualizowane = await aktualizujZamowieniePaynow({
        externalId: zapisaneZamowienie.nr,
        paymentId,
        status,
        redirectUrl,
        env: cfg.env,
      });
      let email = null;
      try { email = await wyslijEmaileNowegoZamowienia(zaktualizowane || { ...zapisaneZamowienie, paynow: { paymentId, status, redirectUrl, env: cfg.env } }); }
      catch (e) {
        email = { configured: emailKonfiguracja().configured, sent: false, error: e.message };
        await dopiszHistorieEmaila(zapisaneZamowienie.nr, { typ: 'potwierdzenie', status: 'błąd wysyłki', blad: e.message, automatyczne: true });
      }
      return odpowiedz({
        ok: true,
        configured: true,
        env: cfg.env,
        redirectUrl,
        paymentId,
        status,
        paymentStatus: statusPlatnosciPaynow(status),
        paynow: zaktualizowane?.paynow || { paymentId, status, redirectUrl, env: cfg.env },
        email,
      }, 201);
    }

    // ─── PAYNOW: ręczne odświeżenie statusu z API ───
    if (action === 'paynow-status') {
      const cfg = paynowKonfiguracja(req);
      if (!cfg.configured) return odpowiedz({ ok: false, configured: false, error: 'Paynow nie jest skonfigurowany po stronie serwera.', code: 'paynow_not_configured' }, 503);
      let paymentId = tekst(url.searchParams.get('paymentId'), 40).trim();
      const nr = numerZamowienia(url.searchParams.get('nr'));
      if (!paymentId && nr) {
        const rec = await czytaj('orders', { items: [] });
        const z = (rec.items || []).find((x) => x.nr === nr);
        paymentId = tekst(z?.paynow?.paymentId, 40).trim();
      }
      if (!paymentId) return odpowiedz({ ok: false, error: 'Brak paymentId Paynow' }, 422);
      const dane = await paynowWywolaj(req, `/v3/payments/${encodeURIComponent(paymentId)}/status`, {
        method: 'GET',
        idempotencyKey: kluczIdempotencji('stat', paymentId),
      });
      const status = tekst(dane.status, 40).toUpperCase();
      const zaktualizowane = await aktualizujZamowieniePaynow({
        externalId: nr,
        paymentId: dane.paymentId || paymentId,
        status,
        env: cfg.env,
      });
      return odpowiedz({
        ok: true,
        configured: true,
        paymentId: dane.paymentId || paymentId,
        status,
        paymentStatus: statusPlatnosciPaynow(status),
        order: zaktualizowane ? { nr: zaktualizowane.nr, status: zaktualizowane.status, platnoscStatus: zaktualizowane.platnoscStatus, paynow: zaktualizowane.paynow } : null,
      });
    }

    // ─── PAYNOW: webhook statusów płatności ───
    if (action === 'paynow-notification') {
      if (req.method !== 'POST') return new Response('', { status: 405 });
      const cfg = paynowKonfiguracja(req);
      const rawBody = await req.text();
      if (!cfg.configured) return new Response('', { status: 503 });
      const podpis = req.headers.get('signature') || req.headers.get('Signature') || '';
      const wyliczony = podpisPaynowPowiadomienia(rawBody, cfg.signatureKey);
      if (!porownajPodpis(podpis, wyliczony)) return new Response('', { status: 401 });
      let dane = {};
      try { dane = JSON.parse(rawBody || '{}'); } catch (e) { return new Response('', { status: 400 }); }
      await aktualizujZamowieniePaynow({
        externalId: dane.externalId,
        paymentId: dane.paymentId,
        status: tekst(dane.status, 40).toUpperCase(),
        modifiedAt: tekst(dane.modifiedAt, 80),
        env: cfg.env,
      });
      return new Response('', { status: 202, headers: { 'cache-control': 'no-store' } });
    }

    // ─── PAYNOW: ustawienie URL-i sklepu w panelu Paynow (admin) ───
    if (action === 'paynow-configure-urls') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const cfg = paynowKonfiguracja(req);
      if (!cfg.configured) return odpowiedz({ ok: false, configured: false, error: 'Najpierw ustaw PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY w Netlify.', code: 'paynow_not_configured' }, 503);
      const body = await req.json().catch(() => ({}));
      const payload = {
        notificationUrl: tekst(body.notificationUrl || cfg.notificationUrl, 1000),
        continueUrl: tekst(body.continueUrl || cfg.continueUrl, 1000),
      };
      await paynowWywolaj(req, '/v3/configuration/shop/urls', {
        method: 'PATCH',
        bodyObj: payload,
        idempotencyKey: kluczIdempotencji('cfg', Date.now()),
      });
      return odpowiedz({ ok: true, configured: true, env: cfg.env, ...payload });
    }

    // ─── PAYNOW: zwrot pieniędzy (refund) + automatyczny e-mail (admin) ───
    if (action === 'paynow-refund') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const cfg = paynowKonfiguracja(req);
      if (!cfg.configured) return odpowiedz({ ok: false, configured: false, error: 'Paynow nie jest skonfigurowany po stronie serwera. Ustaw PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY w Netlify.', code: 'paynow_not_configured' }, 503);
      const body = await req.json().catch(() => ({}));
      const nr = numerZamowienia(body.nr || body.number);
      if (!nr) return odpowiedz({ ok: false, error: 'Brak numeru zamówienia' }, 422);
      const rec = await czytaj('orders', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const i = items.findIndex((x) => x.nr === nr);
      if (i < 0) return odpowiedz({ ok: false, error: 'Nie znaleziono zamówienia', code: 'not_found' }, 404);
      const z = { ...items[i] };
      const paymentId = tekst(z?.paynow?.paymentId, 40).trim();
      if (!paymentId) return odpowiedz({ ok: false, error: 'To zamówienie nie ma płatności Paynow — zwrot pieniędzy zrób w banku, a zamówienie oznacz jako „zwrot pieniędzy”.', code: 'no_payment' }, 409);
      const statusPlat = String(z?.paynow?.status || '').toUpperCase();
      if (statusPlat !== 'CONFIRMED') return odpowiedz({ ok: false, error: `Zwrot możliwy tylko dla opłaconej płatności (CONFIRMED). Obecny status Paynow: ${statusPlat || 'brak'}.`, code: 'not_confirmed' }, 409);
      const pelna = grosze(z.razem);
      const juz = (Array.isArray(z?.paynow?.refunds) ? z.paynow.refunds : []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const amount = (body.amount != null && body.amount !== '') ? grosze(body.amount) : (pelna - juz);
      if (amount <= 0) return odpowiedz({ ok: false, error: 'Kwota zwrotu musi być większa od zera' }, 422);
      if (amount + juz > pelna) return odpowiedz({ ok: false, error: `Kwota zwrotu przekracza pozostałą kwotę płatności (pozostało ${zlSerwer((pelna - juz) / 100)}).`, code: 'amount_too_large' }, 409);
      const reasonRaw = String(body.reason || '').toUpperCase();
      const reason = ['RMA', 'REFUND_BEFORE_14', 'REFUND_AFTER_14', 'OTHER'].includes(reasonRaw) ? reasonRaw : '';
      const bodyObj = reason ? { amount, reason } : { amount };
      const idempotencyKey = kluczIdempotencji('ref', `${paymentId}${Date.now()}`);
      const dane = await paynowWywolaj(req, `/v3/payments/${encodeURIComponent(paymentId)}/refunds`, { method: 'POST', bodyObj, idempotencyKey });
      const refundId = tekst(dane.refundId, 60);
      const refundStatus = tekst(dane.status, 40).toUpperCase();
      const refunds = (Array.isArray(z?.paynow?.refunds) ? z.paynow.refunds.slice() : []);
      refunds.push({ refundId, status: refundStatus, amount, reason, ts: new Date().toISOString() });
      const pelnyZwrot = (amount + juz) >= pelna;
      z.paynow = { ...z.paynow, refunds, updatedAt: new Date().toISOString() };
      z.status = 'zwrot pieniędzy';
      z.platnoscStatus = pelnyZwrot ? 'zwrócone' : 'częściowy zwrot';
      const w = z.wysylka || {};
      w.historia = [...(Array.isArray(w.historia) ? w.historia : []), { czas: new Date().toLocaleString('pl-PL'), status: 'Zwrot pieniędzy Paynow', opis: `${zlSerwer(amount / 100)} • ${refundId || '—'} • ${refundStatus || '—'}` }];
      z.wysylka = w;
      items[i] = z;
      await zapisz('orders', { items, updated_at: new Date().toISOString() });
      let email = null;
      try { email = await wyslijEmailStatusowy(z, 'zwrot_pieniedzy', { kwota: amount / 100 }); }
      catch (e) { email = { sent: false, error: e.message }; }
      const recPo = await czytaj('orders', { items: [] });
      const zPo = (recPo.items || []).find((x) => x.nr === nr) || z;
      return odpowiedz({
        ok: true,
        configured: true,
        refundId,
        status: refundStatus,
        amount,
        fullRefund: pelnyZwrot,
        email,
        order: { nr: zPo.nr, status: zPo.status, platnoscStatus: zPo.platnoscStatus, paynow: zPo.paynow },
        powiadomienia: zPo?.wysylka?.powiadomienia || [],
      }, 201);
    }

    // ─── ALLEGRO: stan integracji i dane zapisane w backendzie (admin) ───
    if (action === 'allegro-data') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const orders = await czytaj('allegro_orders', { items: [], updated_at: null });
      const offers = await czytaj('allegro_offers', { items: [], updated_at: null });
      const mappings = await czytaj('allegro_mappings', { items: {}, updated_at: null });
      const offerLastError = await czytaj('allegro_offer_last_error', null);
      const offerDefaultsAudit = await czytaj('allegro_offer_defaults_audit', { items: {}, updated_at: null });
      const catalogMaintenance = await czytaj('allegro_catalog_maintenance', { cursor: 0, lastRun: null });
      const offerSettings = await allegroPobierzUstawieniaOfert();
      const status = await allegroStatus(req);
      return odpowiedz({
        ok: true,
        allegro: { ...status, updated_at: orders.updated_at || offers.updated_at || status.updated_at || null },
        orders: Array.isArray(orders.items) ? orders.items : [],
        offers: Array.isArray(offers.items) ? offers.items : [],
        mappings: allegroMapowaniaItems(mappings),
        offerLastError,
        offerDefaultsAudit,
        offerSettings,
        catalogMaintenance,
      });
    }

    if (action === 'allegro-offer-settings') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const requested = Number(body.defaultStock);
      if (!Number.isInteger(requested) || requested < 1 || requested > 99999) return odpowiedz({ ok: false, error: 'Domyślny stan ofert musi być liczbą całkowitą od 1 do 99999', code: 'validation' }, 422);
      const previous = await allegroPobierzUstawieniaOfert();
      const settings = allegroUstawieniaOfert({ ...previous, ...body, defaultStock: requested, republish: true, updated_at: new Date().toISOString() });
      await zapisz('allegro_offer_settings', settings);
      return odpowiedz({ ok: true, settings });
    }

    // ─── ALLEGRO: utworzenie linku OAuth (admin) ───
    if (action === 'allegro-auth-url') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = allegroKonfiguracja(req);
      if (!c.configured) return odpowiedz({ ok: false, configured: false, error: 'Allegro API nie jest skonfigurowane. Ustaw ALLEGRO_CLIENT_ID i ALLEGRO_CLIENT_SECRET w Netlify.', code: 'allegro_not_configured', missingEnv: c.missingEnv }, 503);
      const state = crypto.randomBytes(20).toString('hex');
      await zapisz('allegro_oauth_state', { state, created_at: new Date().toISOString() });
      const authUrl = new URL('/auth/oauth/authorize', c.authBaseUrl);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', c.clientId);
      authUrl.searchParams.set('redirect_uri', c.redirectUri);
      authUrl.searchParams.set('state', state);
      if (c.scope) authUrl.searchParams.set('scope', c.scope);
      return odpowiedz({ ok: true, configured: true, env: c.env, redirectUri: c.redirectUri, url: authUrl.toString() });
    }

    // ─── ALLEGRO: callback OAuth po zgodzie w Allegro ───
    if (action === 'allegro-callback') {
      const code = tekst(url.searchParams.get('code'), 2000).trim();
      const state = tekst(url.searchParams.get('state'), 200).trim();
      const err = tekst(url.searchParams.get('error') || url.searchParams.get('error_description'), 1000).trim();
      if (err) return odpowiedzHtml(`<h1>Allegro — autoryzacja przerwana</h1><p>${err}</p><p><a href="/#/admin/allegro">Wróć do panelu Allegro</a></p>`, 400);
      const zapisany = await czytaj('allegro_oauth_state', {});
      if (!code || !state || state !== zapisany.state) return odpowiedzHtml('<h1>Allegro — nieprawidłowy callback</h1><p>Brakuje kodu albo stan autoryzacji jest niezgodny.</p><p><a href="/#/admin/allegro">Wróć do panelu Allegro</a></p>', 400);
      const c = allegroKonfiguracja(req);
      const token = await allegroTokenRequest(req, { grant_type: 'authorization_code', code, redirect_uri: c.redirectUri });
      await zapisz('allegro_auth', token);
      return odpowiedzHtml('<h1>Allegro połączone</h1><p>Konto Allegro zostało ponownie autoryzowane dla panelu Artway-TM. Możesz teraz sprawdzić oferty, wiadomości oraz dyskusje.</p><p><a href="/#/admin/allegro/wiadomosci">Przejdź do wiadomości</a> · <a href="/#/admin/allegro/dyskusje">Przejdź do dyskusji</a></p>');
    }

    // ─── ALLEGRO: synchronizacja zamówień (admin) ───
    if (action === 'allegro-sync-orders') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const limit = Math.min(1000, Math.max(1, Number(body.limit || url.searchParams.get('limit') || 1000)));
      const pobrane = [];
      for (let offset = 0; offset < limit; offset += 100) {
        const pageLimit = Math.min(100, limit - pobrane.length);
        if (pageLimit <= 0) break;
        const dane = await allegroWywolaj(req, '/order/checkout-forms', { parameters: { limit: pageLimit, offset, status: 'READY_FOR_PROCESSING' } });
        const source = Array.isArray(dane.checkoutForms) ? dane.checkoutForms : (Array.isArray(dane.items) ? dane.items : []);
        pobrane.push(...source);
        if (source.length < pageLimit) break;
      }
      const poprzedniRec = await czytaj('allegro_orders', { items: [], updated_at: null });
      const poprzednie = Array.isArray(poprzedniRec.items) ? poprzedniRec.items : [];
      const baselineRec = await czytaj('allegro_orders_baseline_v2', { baseline_at: null });
      const baselineCreated = !baselineRec?.baseline_at;
      const baselineAt = baselineRec?.baseline_at || new Date().toISOString();
      if (baselineCreated) await zapisz('allegro_orders_baseline_v2', { baseline_at: baselineAt, reason: 'existing_orders_confirmed_handled', created_at: baselineAt });
      const mapa = new Map(poprzednie.filter((x) => x?.id).map((x) => [String(x.id), x]));
      const seen = new Set();
      const noweIds = [];
      const aktywne = pobrane
        .map(allegroNormalizujZamowienie)
        .filter((x) => x.id && !seen.has(x.id) && seen.add(x.id))
        .filter(allegroZamowienieJestNoweLubDoWyslania)
        .slice(0, limit);
      let dodane = 0;
      for (const z of aktywne) {
        const stare = mapa.get(String(z.id)) || {};
        if (!stare.id) { dodane++; noweIds.push(String(z.id)); }
        mapa.set(String(z.id), allegroScalZamowienie(z, stare));
      }
      const doAktualizacji = poprzednie.filter((z) => z?.id && !seen.has(String(z.id)) && !['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(allegroStatusKolejkiZamowienia(z, {}))).slice(0, limit);
      let odswiezone = 0;
      const batchSize = 8;
      for (let i = 0; i < doAktualizacji.length; i += batchSize) {
        const batch = doAktualizacji.slice(i, i + batchSize);
        const wyniki = await Promise.all(batch.map(async (stare) => {
          try {
            const pelne = await allegroWywolaj(req, `/order/checkout-forms/${encodeURIComponent(stare.id)}`);
            return allegroScalZamowienie(pelne, stare);
          } catch (e) {
            return { ...stare, syncError: tekst(e.message, 500), lastSyncErrorAt: new Date().toISOString() };
          }
        }));
        for (const z of wyniki) {
          mapa.set(String(z.id), z);
          if (!z.syncError) odswiezone++;
        }
      }
      let items = [...mapa.values()]
        .map((z) => allegroScalZamowienie(z, z))
        .sort((a, b) => String(b.firstFetchedAt || '').localeCompare(String(a.firstFetchedAt || '')))
        .slice(0, 5000);
      let baselineArchived = 0;
      if (baselineCreated) {
        items = items.map((z) => {
          if (['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(allegroStatusKolejkiZamowienia(z, {}))) return z;
          baselineArchived++;
          return { ...z, warehouseStage: 'zrealizowane', checkedAt: z.checkedAt || baselineAt, baselineArchivedAt: baselineAt, workflowUpdatedAt: baselineAt };
        });
        noweIds.length = 0;
      }
      let agent = { reviewed: 0, shortagesAdded: 0, supplierDocumentsChanged: 0, unresolved: 0, ready: 0 }, orderMappings = null;
      try {
        const wynikAgenta = await allegroAgentPrzetworzZamowienia(items, { newOrderIds: noweIds });
        items = wynikAgenta.items;
        agent = wynikAgenta.report;
        orderMappings = wynikAgenta.mappings;
      } catch (e) {
        agent = { ...agent, error: tekst(e.message || String(e), 500) };
      }
      const rec = { items, updated_at: new Date().toISOString(), count: items.length, fetched: pobrane.length, imported_new: baselineCreated ? 0 : dodane, refreshed: odswiezone, filtered: pobrane.length - aktywne.length, mode: 'allegro_status_authoritative_warehouse_stage_separate', baseline_at: baselineAt, baseline_created: baselineCreated, baseline_archived: baselineArchived, agent };
      await zapisz('allegro_orders', rec);
      return odpowiedz({ ok: true, allegro: await allegroStatus(req), orders: items, mappings: orderMappings || undefined, updated_at: rec.updated_at, fetched: rec.fetched, imported_new: rec.imported_new, refreshed: rec.refreshed, filtered: rec.filtered, mode: rec.mode, baseline_at: rec.baseline_at, baseline_created: rec.baseline_created, baseline_archived: rec.baseline_archived, agent });
    }

    // ─── ALLEGRO: lokalny etap obsługi zamówienia (admin) ───
    if (action === 'allegro-order-checked') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const orderIds = [...new Set((Array.isArray(body.orderIds) ? body.orderIds : [body.orderId]).map((id) => tekst(id, 100).trim()).filter(Boolean))].slice(0, 1000);
      const checked = body.checked !== false;
      const rec = await czytaj('allegro_orders', { items: [], updated_at: null });
      const items = Array.isArray(rec.items) ? rec.items : [];
      if (!orderIds.length) return odpowiedz({ ok: false, error: 'Nie wybrano zamówień Allegro', code: 'validation' }, 400);
      const wanted = new Set(orderIds);
      let changed = 0;
      const skipped = [];
      for (let index = 0; index < items.length; index++) {
        const stare = items[index];
        if (!wanted.has(String(stare?.id || ''))) continue;
        const terminal = ['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(allegroStatusKolejkiZamowienia(stare, {}));
        if (terminal) { skipped.push({ id: stare.id, reason: 'terminal_order' }); continue; }
        const warehouseStage = checked ? 'kompletacja' : 'do_sprawdzenia';
        items[index] = { ...stare, warehouseStage, checkedAt: checked ? new Date().toISOString() : null, workflowUpdatedAt: new Date().toISOString() };
        changed++;
      }
      if (!changed && skipped.length === 0) return odpowiedz({ ok: false, error: 'Nie znaleziono wybranych zamówień Allegro', code: 'not_found' }, 404);
      const zapis = { ...rec, items, updated_at: new Date().toISOString() };
      await zapisz('allegro_orders', zapis);
      return odpowiedz({ ok: true, order: orderIds.length === 1 ? items.find((z) => String(z.id) === orderIds[0]) : null, orders: items, changed, skipped, updated_at: zapis.updated_at });
    }

    if (action === 'allegro-order-warehouse-stage') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const orderIds = [...new Set((Array.isArray(body.orderIds) ? body.orderIds : [body.orderId]).map((id) => tekst(id, 100).trim()).filter(Boolean))].slice(0, 1000);
      const stage = tekst(body.stage, 40).trim().toLowerCase();
      const allowed = new Set(['do_sprawdzenia', 'braki', 'kompletacja', 'spakowane', 'zrealizowane']);
      if (!orderIds.length || !allowed.has(stage)) return odpowiedz({ ok: false, error: 'Nieprawidłowe zlecenie albo etap magazynu' }, 422);
      const rec = await czytaj('allegro_orders', { items: [], updated_at: null });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const wanted = new Set(orderIds), skipped = [];
      let changed = 0;
      for (let index = 0; index < items.length; index++) {
        const current = items[index];
        if (!wanted.has(String(current?.id || ''))) continue;
        const terminal = ['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(allegroStatusKolejkiZamowienia(current, {}));
        if (terminal) { skipped.push({ id: current.id, reason: 'terminal_order' }); continue; }
        items[index] = { ...current, warehouseStage: stage, warehouseStageUpdatedAt: new Date().toISOString(), workflowUpdatedAt: new Date().toISOString(), checkedAt: stage === 'do_sprawdzenia' ? null : (current.checkedAt || new Date().toISOString()) };
        changed++;
      }
      if (!changed && !skipped.length) return odpowiedz({ ok: false, error: 'Nie znaleziono wybranych zleceń Allegro' }, 404);
      const zapis = { ...rec, items, updated_at: new Date().toISOString() };
      await zapisz('allegro_orders', zapis);
      return odpowiedz({ ok: true, order: orderIds.length === 1 ? items.find((z) => String(z.id) === orderIds[0]) : null, orders: items, changed, skipped, stage, updated_at: zapis.updated_at });
    }

    // ─── ALLEGRO: zmiana statusu realizacji po stronie Allegro (admin) ───
    if (action === 'allegro-order-fulfillment') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const orderId = tekst(body.orderId, 100).trim();
      const status = tekst(body.status, 80).trim().toUpperCase();
      const dozwolone = new Set(['NEW', 'PROCESSING', 'READY_FOR_SHIPMENT', 'SENT', 'CANCELLED']);
      if (!orderId || !dozwolone.has(status)) return odpowiedz({ ok: false, error: 'Nieprawidłowy numer zamówienia lub status Allegro', code: 'validation' }, 400);
      const rec = await czytaj('allegro_orders', { items: [], updated_at: null });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const index = items.findIndex((z) => String(z.id) === orderId);
      if (index < 0) return odpowiedz({ ok: false, error: 'Nie znaleziono zamówienia Allegro', code: 'not_found' }, 404);
      const stare = items[index];
      await allegroWywolaj(req, `/order/checkout-forms/${encodeURIComponent(orderId)}/fulfillment`, {
        method: 'PUT',
        parameters: stare.revision ? { 'checkoutForm.revision': stare.revision } : {},
        bodyObj: { status },
      });
      const zmienione = allegroScalZamowienie({ ...stare, fulfillmentStatus: status, rawUpdatedAt: new Date().toISOString() }, {});
      items[index] = { ...zmienione, workflowUpdatedAt: new Date().toISOString() };
      const zapis = { ...rec, items, updated_at: new Date().toISOString() };
      await zapisz('allegro_orders', zapis);
      return odpowiedz({ ok: true, order: items[index], orders: items, updated_at: zapis.updated_at });
    }

    // ─── ALLEGRO: synchronizacja ofert (admin) ───
    if (action === 'allegro-sync-offers') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const limit = Math.min(20000, Math.max(1, Number(body.limit || url.searchParams.get('limit') || 10000)));
      const details = body.details !== false && url.searchParams.get('details') !== '0';
      const detailsLimit = details ? Math.min(limit, 1000, Math.max(1, Number(body.detailsLimit || 500))) : 0;
      const previousOffersRec = await czytaj('allegro_offers', { items: [] });
      const previousById = new Map(allegroOfertyItems(previousOffersRec).map((offer) => [String(offer?.id || ''), offer]));
      const source = [];
      let pages = 0;
      let totalCount = null;
      for (let offset = 0; offset < limit; offset += 1000) {
        const pageLimit = Math.min(1000, limit - offset);
        const dane = await allegroWywolaj(req, '/sale/offers', { parameters: { limit: pageLimit, offset } });
        const page = Array.isArray(dane.offers) ? dane.offers : (Array.isArray(dane.items) ? dane.items : []);
        if (Number.isFinite(Number(dane.totalCount))) totalCount = Number(dane.totalCount);
        source.push(...page);
        pages++;
        if (page.length < pageLimit || (totalCount !== null && source.length >= totalCount)) break;
      }
      const pelne = details ? await allegroPobierzSzczegolyOfert(req, source, detailsLimit) : [];
      const pelnePoId = new Map(pelne.filter((x) => x?.id).map((x) => [String(x.id), x]));
      const items = source.map((summary) => {
        const id = String(summary?.id || ''), detailedOffer = pelnePoId.get(id);
        const normalized = allegroNormalizujOferte(detailedOffer || summary);
        return allegroScalSzczegolyOferty(previousById.get(id), normalized, !!detailedOffer);
      }).filter((x) => x.id);
      const rec = { items, updated_at: new Date().toISOString(), count: items.length, totalCount: totalCount ?? items.length, pages, details, detailedCount: pelne.length, requestedLimit: limit };
      await zapisz('allegro_offers', rec);
      const mappingResult = await allegroAutoMapujOfertyZKartoteka(items);
      let maintenance = null;
      if (body.maintenance === true || body.source === 'scheduled-offers-sync') maintenance = await allegroAutoUzupelnijKatalogProduktow(req, { limit: body.maintenanceLimit || 10 });
      return odpowiedz({ ok: true, allegro: await allegroStatus(req), offers: items, mappings: mappingResult.mappings, autoMapped: mappingResult.autoMapped, mappingsRefreshed: mappingResult.refreshed, mappingsQuarantined: mappingResult.quarantined, descriptionsUpdated: mappingResult.descriptionsUpdated, producersUpdated: mappingResult.producersUpdated, productsUpdated: mappingResult.productsUpdated, maintenance, updated_at: rec.updated_at, detailedCount: rec.detailedCount, requestedLimit: rec.requestedLimit, pages: rec.pages, totalCount: rec.totalCount });
    }

    if (action === 'allegro-auto-maintenance') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const offersRec = await czytaj('allegro_offers', { items: [] });
      const mapping = await allegroAutoMapujOfertyZKartoteka(allegroOfertyItems(offersRec));
      const maintenance = await allegroAutoUzupelnijKatalogProduktow(req, { limit: Math.min(50, Math.max(1, Number(body.limit) || 20)) });
      return odpowiedz({ ok: true, mapping, maintenance });
    }

    if (action === 'allegro-apply-offer-defaults') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const offerSettings = await allegroPobierzUstawieniaOfert();
      const targetStock = offerSettings.defaultStock;
      const offerIds = [...new Set((Array.isArray(body.offerIds) ? body.offerIds : []).map((x) => tekst(x, 100).trim()).filter(Boolean))].slice(0, 50);
      if (!offerIds.length) return odpowiedz({ ok: false, error: 'Podaj identyfikatory ofert Allegro' }, 422);
      const results = [];
      for (let i = 0; i < offerIds.length; i += 10) {
        const batch = offerIds.slice(i, i + 10);
        const settled = await Promise.allSettled(batch.map(async (offerId) => {
          const stockMeta = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, {
            method: 'PATCH', bodyObj: { stock: { available: targetStock } }, withMeta: true,
          });
          try {
            const republishMeta = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, {
              method: 'PATCH', bodyObj: { publication: { republish: true } }, withMeta: true,
            });
            return { offerId, stockUpdated: true, republishUpdated: true, status: republishMeta.status, location: republishMeta.location || stockMeta.location || '' };
          } catch (e) {
            return { offerId, stockUpdated: true, republishUpdated: false, status: e.status || 422, code: tekst(e.code || '', 120), republishError: tekst(e.message || e, 700) };
          }
        }));
        settled.forEach((item, index) => results.push(item.status === 'fulfilled' ? { ok: true, ...item.value } : { ok: false, stockUpdated: false, republishUpdated: false, offerId: batch[index], error: tekst(item.reason?.message || item.reason, 700), code: tekst(item.reason?.code || '', 120), status: item.reason?.status || 500 }));
      }
      const now = new Date().toISOString();
      const auditRec = await czytaj('allegro_offer_defaults_audit', { items: {}, updated_at: null });
      const auditItems = auditRec.items && typeof auditRec.items === 'object' ? { ...auditRec.items } : {};
      for (const result of results) auditItems[result.offerId] = { offerId: result.offerId, stock: targetStock, stockUpdated: !!result.stockUpdated, republishUpdated: !!result.republishUpdated, error: tekst(result.republishError || result.error || '', 700), code: tekst(result.code || '', 120), status: result.status || 0, updatedAt: now };
      await zapisz('allegro_offer_defaults_audit', { items: auditItems, updated_at: now });
      return odpowiedz({ ok: true, stock: targetStock, republish: true, requested: offerIds.length, stockUpdated: results.filter((x) => x.stockUpdated).length, stockFailed: results.filter((x) => !x.stockUpdated).length, republishUpdated: results.filter((x) => x.republishUpdated).length, republishFailed: results.filter((x) => !x.republishUpdated).length, auditOpen: Object.values(auditItems).filter((x) => !x.stockUpdated || !x.republishUpdated).length, results });
    }

    // ─── ALLEGRO: komunikacja z klientami i autoresponder (admin) ───
    if (action === 'allegro-communications-data') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const comm = await czytaj('allegro_communications', { threads: [], issues: [], updated_at: null, errors: [] });
      const internalRec = await czytaj('allegro_communication_internal', { items: {}, updated_at: null });
      const applied = allegroZastosujStatusyWewnetrzne(comm, internalRec);
      const settings = allegroUstawieniaKomunikacji(await czytaj('allegro_communication_settings', {}));
      const replies = await czytaj('allegro_auto_replies', { items: {}, updated_at: null });
      return odpowiedz({
        ok: true,
        allegro: await allegroStatus(req),
        threads: Array.isArray(applied.data.threads) ? applied.data.threads : [],
        issues: Array.isArray(applied.data.issues) ? applied.data.issues : [],
        errors: Array.isArray(comm.errors) ? comm.errors : [],
        updated_at: comm.updated_at || null,
        settings,
        autoReplies: replies.items && typeof replies.items === 'object' ? replies.items : {},
        autoRepliesUpdatedAt: replies.updated_at || null,
        requiresReauth: Array.isArray(comm.errors) && comm.errors.some((e) => Number(e?.status) === 403),
      });
    }

    // Status wyłącznie wewnętrzny: nie wywołuje żadnego endpointu Allegro i niczego nie wysyła klientowi.
    if (action === 'allegro-communication-resolve') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const requests = (Array.isArray(body.items) ? body.items : [body]).slice(0, 200).map((x) => ({ type: x?.type === 'issue' ? 'issue' : 'thread', id: tekst(x?.id, 120).trim(), resolved: x?.resolved !== false, note: tekst(x?.note || body.note || '', 1000).trim() })).filter((x) => x.id);
      if (!requests.length) return odpowiedz({ ok: false, error: 'Wybierz co najmniej jedną sprawę', code: 'validation' }, 422);
      const [comm, internalRec, historyRec] = await Promise.all([
        czytaj('allegro_communications', { threads: [], issues: [], updated_at: null, errors: [] }),
        czytaj('allegro_communication_internal', { items: {}, updated_at: null }),
        czytaj('allegro_communication_internal_history', { items: [], updated_at: null }),
      ]);
      const internalItems = internalRec.items && typeof internalRec.items === 'object' ? { ...internalRec.items } : {};
      const history = Array.isArray(historyRec.items) ? [...historyRec.items] : [];
      const now = new Date().toISOString(), results = [];
      for (const request of requests) {
        const listKey = request.type === 'issue' ? 'issues' : 'threads';
        const list = Array.isArray(comm[listKey]) ? comm[listKey] : [];
        const index = list.findIndex((x) => String(x?.id) === request.id);
        if (index < 0) { results.push({ ...request, ok: false, error: 'Nie znaleziono sprawy' }); continue; }
        const item = list[index], sourceMessageKey = allegroKluczWiadomosci(allegroNajnowszaWiadomoscKlienta(item));
        const key = allegroKluczSprawyWewnetrznej(request.type, request.id);
        const state = { ...(internalItems[key] || {}), type: request.type, id: request.id, resolved: request.resolved, note: request.note, sourceMessageKey, updatedAt: now, updatedBy: 'administrator', ...(request.resolved ? { resolvedAt: now, reopenedAt: null, reopenReason: '' } : { resolvedAt: null, reopenedAt: now, reopenReason: 'manual' }) };
        internalItems[key] = state;
        list[index] = request.resolved
          ? { ...item, internalResolved: true, internalResolution: state, needsReply: false, humanReplyNeeded: false, newIncomingCount: 0 }
          : { ...item, internalResolved: false, internalResolution: state, humanReplyNeeded: true, needsReply: !!allegroNajnowszaWiadomoscKlienta(item) };
        comm[listKey] = list;
        history.unshift({ id: crypto.randomUUID(), at: now, ...request, sourceMessageKey, action: request.resolved ? 'resolved_internal' : 'reopened_internal', sentExternally: false });
        results.push({ ...request, ok: true, state });
      }
      comm.updated_at = now;
      await Promise.all([
        zapisz('allegro_communications', comm),
        zapisz('allegro_communication_internal', { items: internalItems, updated_at: now }),
        zapisz('allegro_communication_internal_history', { items: history.slice(0, 5000), updated_at: now }),
      ]);
      return odpowiedz({ ok: true, results, threads: comm.threads || [], issues: comm.issues || [], updated_at: now, sentExternally: false });
    }

    if (action === 'allegro-communications-settings') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const settings = allegroUstawieniaKomunikacji(body.settings || body);
      await zapisz('allegro_communication_settings', { ...settings, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, settings });
    }

    if (action === 'allegro-reply-suggestion') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const type = body.type === 'issue' ? 'issue' : 'thread';
      const id = tekst(body.id, 120).trim();
      const [comm, ordersRec] = await Promise.all([czytaj('allegro_communications', { threads: [], issues: [] }), czytaj('allegro_orders', { items: [] })]);
      const list = type === 'issue' ? comm.issues : comm.threads;
      const item = (Array.isArray(list) ? list : []).find((x) => String(x?.id) === id);
      if (!item) return odpowiedz({ ok: false, error: 'Nie znaleziono rozmowy Allegro', code: 'not_found' }, 404);
      const orderId = allegroOrderIdKomunikacji(item);
      const order = (Array.isArray(ordersRec.items) ? ordersRec.items : []).find((x) => String(x?.id || x?.nr) === orderId) || null;
      const context = allegroKontekstOdpowiedzi(item, order);
      return odpowiedz({ ok: true, type, id, suggestion: allegroPropozycjaOdpowiedzi(type, item, order), context, basedOn: { order: !!order, warehouse: !!order?.agentAnalysis, latestMessage: !!(item.latestNewIncoming || item.lastMessage) } });
    }

    if (action === 'allegro-send-reply') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const type = body.type === 'issue' ? 'issue' : 'thread';
      const id = tekst(body.id, 120).trim();
      const text = tekst(body.text, 20000).trim();
      if (!id || !text) return odpowiedz({ ok: false, error: 'Wybierz rozmowę i wpisz treść odpowiedzi', code: 'validation' }, 422);
      let raw;
      if (type === 'issue') raw = await allegroWywolaj(req, `/sale/issues/${encodeURIComponent(id)}/message`, { method: 'POST', accept: ALLEGRO_BETA_JSON, contentType: ALLEGRO_BETA_JSON, bodyObj: { text, attachments: [], type: 'REGULAR' } });
      else {
        raw = await allegroWywolaj(req, `/messaging/threads/${encodeURIComponent(id)}/messages`, { method: 'POST', bodyObj: { text, attachments: [] } });
        try { await allegroWywolaj(req, `/messaging/threads/${encodeURIComponent(id)}/read`, { method: 'PUT', bodyObj: { read: true } }); } catch {}
      }
      const comm = await czytaj('allegro_communications', { threads: [], issues: [], updated_at: null, errors: [] });
      const key = type === 'issue' ? 'issues' : 'threads';
      const list = Array.isArray(comm[key]) ? [...comm[key]] : [];
      const index = list.findIndex((x) => String(x?.id) === id);
      const normalized = type === 'issue' ? allegroNormalizujIssueChatMessage(raw, id) : allegroNormalizujWiadomosc(raw, id);
      if (index >= 0) {
        const current = list[index], messages = [...(Array.isArray(current.messages) ? current.messages : []), normalized].filter((m, pos, all) => !m.id || all.findIndex((x) => x.id === m.id) === pos);
        list[index] = { ...current, messages, lastMessage: normalized, read: true, needsReply: false, humanReplyNeeded: false, humanReplySource: null, newIncomingCount: 0, latestNewIncoming: null, latestNewIncomingKey: '', manualReplyAt: new Date().toISOString() };
      }
      const saved = { ...comm, [key]: list, updated_at: new Date().toISOString(), lastManualReply: { type, id, messageId: normalized.id || '', sent_at: new Date().toISOString() } };
      await zapisz('allegro_communications', saved);
      return odpowiedz({ ok: true, type, id, message: normalized, threads: saved.threads || [], issues: saved.issues || [], updated_at: saved.updated_at });
    }

    if (action === 'allegro-sync-communications') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const settings = allegroUstawieniaKomunikacji(await czytaj('allegro_communication_settings', {}));
      const previous = await czytaj('allegro_communications', { threads: [], issues: [], updated_at: null, errors: [] });
      const rawData = await allegroPobierzKomunikacje(req, { limit: body.limit || 20 });
      const marked = allegroOznaczNowaKomunikacje(rawData, previous);
      const internalRec = await czytaj('allegro_communication_internal', { items: {}, updated_at: null });
      const internalApplied = allegroZastosujStatusyWewnetrzne(marked, internalRec);
      const data = internalApplied.data;
      if (internalApplied.changed) await zapisz('allegro_communication_internal', { items: internalApplied.items, updated_at: new Date().toISOString() });
      const telegramReminders = await allegroWyslijPrzypomnieniaTelegram(data, settings);
      let autoReply = { sent: [], skipped: [], items: {} };
      if (body.autoReply !== false && settings.enabled) autoReply = await allegroWyslijAutoOdpowiedzi(req, data, settings);
      const rec = { threads: data.threads, issues: data.issues, errors: data.errors || [], requiresReauth: !!data.requiresReauth, updated_at: new Date().toISOString(), autoReplyLastRun: autoReply.sent?.length || 0 };
      await zapisz('allegro_communications', rec);
      return odpowiedz({ ok: true, allegro: await allegroStatus(req), ...rec, settings, autoReply, telegramReminders });
    }

    // ─── ALLEGRO: szkic i wystawienie produktu sklepu jako oferty ───
    if (action === 'allegro-offer-support') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const categoryId = tekst(url.searchParams.get('categoryId') || '', 80).trim();
      const [salesConditions, categoryParameters] = await Promise.all([
        allegroWarunkiSprzedazy(req),
        allegroParametryKategorii(req, categoryId),
      ]);
      return odpowiedz({ ok: true, salesConditions, categoryParameters: categoryParameters.parameters, errors: [...(salesConditions.errors || []), ...(categoryParameters.errors || [])] });
    }

    if (action === 'allegro-categories') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const phrase = tekst(url.searchParams.get('name') || url.searchParams.get('phrase') || url.searchParams.get('q') || '', 180).trim();
      const parentId = tekst(url.searchParams.get('parentId') || url.searchParams.get('parent.id') || '', 80).trim();
      const raw = phrase
        ? await allegroWywolaj(req, '/sale/matching-categories', { parameters: { name: phrase } })
        : await allegroWywolaj(req, '/sale/categories', { parameters: parentId ? { 'parent.id': parentId } : {} });
      return odpowiedz({ ok: true, categories: allegroNormalizujKategorie(raw, phrase), raw });
    }

    if (action === 'allegro-category-suggest') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const result = await allegroSugerujKategorie(req, body.product || {}, { phrase: body.phrase, limit: body.limit || 10 });
      return odpowiedz({ ok: true, ...result });
    }

    if (action === 'allegro-category-parameters') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const categoryId = tekst(url.searchParams.get('categoryId') || url.searchParams.get('id') || '', 80).trim();
      if (!categoryId) return odpowiedz({ ok: false, error: 'Podaj categoryId' }, 422);
      const raw = await allegroWywolaj(req, `/sale/categories/${encodeURIComponent(categoryId)}/parameters`);
      return odpowiedz({ ok: true, categoryId, parameters: raw.parameters || [], raw });
    }

    if (action === 'allegro-offer-draft') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const draft = await allegroDraftZAutoKategoria(req, body.product || {}, body.options || {});
      const agentTask = draft.missing.length ? await allegroZapiszZadanieAgentaOferty(body.product || {}, { missing: draft.missing, prepared: draft, draft: draft.payload }) : null;
      return odpowiedz({ ok: true, draft: draft.payload, missing: draft.missing, ready: !!draft.existingOffer || draft.missing.length === 0, categorySuggestion: draft.categorySuggestion, salesConditions: draft.salesConditions, categoryParameters: draft.categoryParameters, requiredParameters: draft.requiredParameters, catalogMatch: draft.catalogMatch, supportErrors: draft.supportErrors, existingOffer: draft.existingOffer, similarOffers: draft.similarOffers, improvedDescriptions: draft.improvedDescriptions, autoFilled: draft.autoFilled, agentDecision: draft.agentDecision, agentProcedure: ALLEGRO_AGENT_OFFER_PROCEDURE, operation: draft.existingOffer ? 'update' : 'create', agentTask });
    }

    if (action === 'allegro-description-improve') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const product = body.product || {};
      const offersRec = await czytaj('allegro_offers', { items: [] });
      const similarOffers = allegroPodobneOferty(product, offersRec, 5);
      const shortDescription = allegroOpisKrotki(product, similarOffers);
      const sections = allegroSekcjeOpisu(product, shortDescription);
      const fullDescription = allegroOpisPelnyTekst(product, shortDescription);
      return odpowiedz({
        ok: true,
        shortDescription,
        fullDescription: fullDescription || shortDescription,
        sections,
        similarOffers: similarOffers.map((x) => ({ id: x.offer?.id, name: x.offer?.name, score: Number(x.score.toFixed(2)) })),
      });
    }

    if (action === 'allegro-create-product-offer') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const offerSettings = await allegroPobierzUstawieniaOfert();
      let categorySuggestion = null;
      let prepared = null;
      let draft = body.draft && typeof body.draft === 'object' ? body.draft : null;
      if (draft) draft = { ...draft, stock: { available: offerSettings.defaultStock }, publication: { ...(draft.publication || {}), republish: true } };
      if (!draft) {
        prepared = await allegroDraftZAutoKategoria(req, body.product || {}, body.options || {});
        categorySuggestion = prepared.categorySuggestion;
        const agentTask = prepared.missing.length ? await allegroZapiszZadanieAgentaOferty(body.product || {}, { missing: prepared.missing, prepared, draft: prepared.payload }) : null;
        if (prepared.missing.length && !prepared.existingOffer) {
          return odpowiedz({ ok: false, error: `Szkic wymaga uzupełnienia: ${prepared.missing.join(', ')}`, missing: prepared.missing, draft: prepared.payload, categorySuggestion, salesConditions: prepared.salesConditions, categoryParameters: prepared.categoryParameters, requiredParameters: prepared.requiredParameters, catalogMatch: prepared.catalogMatch, autoFilled: prepared.autoFilled, supportErrors: prepared.supportErrors, agentDecision: prepared.agentDecision, agentProcedure: ALLEGRO_AGENT_OFFER_PROCEDURE, agentTask }, 422);
        }
        draft = prepared.payload;
      }
      if (!prepared) {
        const offersRec = await czytaj('allegro_offers', { items: [] });
        const mappingsRec = await czytaj('allegro_mappings', { items: {} });
        prepared = { existingOffer: allegroDopasowanieOferty(body.product || {}, offersRec, mappingsRec) };
      }
      const existing = prepared.existingOffer;
      let result, responseMeta = null, operationCheck = { completed: true, checks: 0 };
      try {
        if (existing?.offer?.id) {
          const patch = allegroPatchZDraftu(draft, body.options || {});
          responseMeta = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(existing.offer.id)}`, { method: 'PATCH', bodyObj: patch, withMeta: true });
        } else {
          responseMeta = await allegroWywolaj(req, '/sale/product-offers', { method: 'POST', bodyObj: draft, withMeta: true });
        }
        result = responseMeta?.data || {};
        operationCheck = await allegroCzekajNaOperacjeOferty(req, responseMeta?.location || '');
        if (operationCheck.result?.id) result = operationCheck.result;
      } catch (e) {
        e.draft = draft;
        e.categorySuggestion = categorySuggestion;
        e.requiredParameters = prepared?.requiredParameters || [];
        e.catalogMatch = prepared?.catalogMatch || null;
        e.agentTask = await allegroZapiszZadanieAgentaOferty(body.product || {}, { missing: prepared?.missing || [], errors: e.allegro?.errors || [{ code: e.code, message: e.message }], prepared, draft });
        await zapisz('allegro_offer_last_error', { at: new Date().toISOString(), productId: tekst(body.product?.id, 100), productName: tekst(body.product?.nazwa || body.product?.name, 300), message: tekst(e.message, 1000), status: e.status || 500, code: e.code || '', errors: Array.isArray(e.allegro?.errors) ? e.allegro.errors.slice(0, 20) : [], missing: prepared?.missing || [], requiredParameters: prepared?.requiredParameters || [], catalogMatch: prepared?.catalogMatch || null });
        throw e;
      }
      const locationOfferId = String(responseMeta?.location || '').match(/\/sale\/product-offers\/([^/?]+)/)?.[1] || '';
      const offerId = tekst(result?.id || existing?.offer?.id || locationOfferId, 100);
      if (!offerId) {
        const e = new Error('Allegro przyjęło operację, ale nie zwróciło identyfikatora oferty. Zadanie zapisano dla Agenta AI.');
        e.status = 502; e.code = 'allegro_missing_offer_id'; e.draft = draft; e.categorySuggestion = categorySuggestion; e.catalogMatch = prepared?.catalogMatch || null;
        e.agentTask = await allegroZapiszZadanieAgentaOferty(body.product || {}, { errors: [{ code: e.code, message: e.message }], prepared, draft });
        throw e;
      }
      await zapisz('allegro_offer_last_error', null);
      if (offerId) {
        const offersRec = await czytaj('allegro_offers', { items: [] });
        const normalized = allegroNormalizujOferte({ ...(existing?.offer || {}), ...draft, ...(result || {}), id: offerId });
        const items = allegroOfertyItems(offersRec).filter((x) => String(x.id) !== offerId);
        items.unshift(normalized);
        await zapisz('allegro_offers', { ...offersRec, items: items.slice(0, 20000), updated_at: new Date().toISOString(), count: Math.min(20000, items.length), totalCount: Math.max(Number(offersRec.totalCount || 0), items.length) });
        const productId = tekst(body.product?.id, 100).trim();
        if (productId) {
          const mappingRec = await czytaj('allegro_mappings', { items: {} });
          const mappings = allegroMapowaniaItems(mappingRec);
          const link = allegroDanePowiazaniaZPrzygotowania(body.product || {}, prepared, draft);
          mappings[offerId] = { offerId, productId, allegroProductId: link.catalogProductId, categoryId: link.categoryId, productName: tekst(body.product?.nazwa || body.product?.name, 300), linked_at: new Date().toISOString(), synced_at: new Date().toISOString(), operator: 'auto-offer-save' };
          await zapisz('allegro_mappings', { items: mappings, updated_at: new Date().toISOString() });
          await allegroZapiszPowiazanieProduktu(body.product || {}, { offerId, prepared, draft });
        }
      }
      return odpowiedz({ ok: true, offer: { ...(existing?.offer || {}), ...(result || {}), id: offerId }, mode: existing ? 'updated' : 'created', duplicatePrevented: !!existing, match: existing ? { score: existing.score, reason: existing.reason } : null, catalogMatch: prepared.catalogMatch || null, autoFilled: prepared.autoFilled || null, improvedDescriptions: prepared.improvedDescriptions || null, agentDecision: prepared.agentDecision || null, agentProcedure: ALLEGRO_AGENT_OFFER_PROCEDURE, warnings: Array.isArray(result?.warnings) ? result.warnings : [], operation: { status: responseMeta?.status || 200, location: responseMeta?.location || '', completed: operationCheck.completed, checks: operationCheck.checks || 0 }, allegro: await allegroStatus(req), categorySuggestion }, existing ? 200 : 201);
    }

    // ─── ALLEGRO: kontrolowane rozstrzygnięcie duplikatów ofert ───
    if (action === 'allegro-resolve-duplicate') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const productId = tekst(body.productId, 100).trim();
      const keepOfferId = tekst(body.keepOfferId, 100).trim();
      const withdrawOfferIds = [...new Set((Array.isArray(body.withdrawOfferIds) ? body.withdrawOfferIds : []).map((x) => tekst(x, 100).trim()).filter((x) => x && x !== keepOfferId))].slice(0, 50);
      if (!productId || !keepOfferId || !withdrawOfferIds.length) return odpowiedz({ ok: false, error: 'Wskaż produkt, jedną ofertę pozostawianą i co najmniej jedną ofertę do wycofania', code: 'validation' }, 422);
      const [offersRec, mappingsRec, settingsRec, auditRec] = await Promise.all([
        czytaj('allegro_offers', { items: [], updated_at: null }),
        czytaj('allegro_mappings', { items: {}, updated_at: null }),
        czytaj('settings', { data: {}, rev: 0, updated_at: null }),
        czytaj('allegro_duplicate_resolution_audit', { items: [], updated_at: null }),
      ]);
      const offers = allegroOfertyItems(offersRec), byId = new Map(offers.map((x) => [String(x?.id || ''), x]));
      if (!byId.has(keepOfferId)) return odpowiedz({ ok: false, error: 'Nie znaleziono oferty wybranej do pozostawienia', code: 'keep_not_found' }, 404);
      const missing = withdrawOfferIds.filter((id) => !byId.has(id));
      if (missing.length) return odpowiedz({ ok: false, error: `Nie znaleziono ofert: ${missing.join(', ')}`, code: 'withdraw_not_found' }, 404);
      const settled = await Promise.allSettled(withdrawOfferIds.map(async (offerId) => {
        const offer = byId.get(offerId) || {};
        if (String(offer.status || offer.publication?.status || '').toUpperCase() === 'ENDED') return { offerId, ended: true, alreadyEnded: true };
        await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', bodyObj: { publication: { status: 'ENDED', republish: false } } });
        return { offerId, ended: true, alreadyEnded: false };
      }));
      const results = settled.map((result, index) => result.status === 'fulfilled' ? result.value : { offerId: withdrawOfferIds[index], ended: false, error: tekst(result.reason?.message || result.reason, 700), code: tekst(result.reason?.code || '', 120), status: result.reason?.status || 500 });
      const failed = results.filter((x) => !x.ended);
      if (failed.length) return odpowiedz({ ok: false, error: `Nie udało się wycofać ${failed.length} ofert. Powiązania nie zostały zmienione.`, code: 'partial_withdrawal', results }, 422);
      const now = new Date().toISOString(), mappings = allegroMapowaniaItems(mappingsRec);
      const keepOffer = byId.get(keepOfferId) || {};
      mappings[keepOfferId] = { ...(mappings[keepOfferId] || {}), offerId: keepOfferId, productId, allegroProductId: tekst(keepOffer.productId, 120), categoryId: tekst(keepOffer.categoryId, 80), productName: tekst(keepOffer.name, 300), linked_at: mappings[keepOfferId]?.linked_at || now, synced_at: now, operator: 'admin-duplicate-keep', duplicateResolvedAt: now };
      for (const offerId of withdrawOfferIds) mappings[offerId] = { ...(mappings[offerId] || {}), offerId, productId: '', blocked: true, duplicateOf: keepOfferId, operator: 'admin-duplicate-withdrawn', synced_at: now, duplicateResolvedAt: now };
      const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
      const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
      edits[productId] = { ...(edits[productId] || {}), allegroOfferId: keepOfferId, allegroProductId: tekst(keepOffer.productId || edits[productId]?.allegroProductId, 120), allegroCategoryId: tekst(keepOffer.categoryId || edits[productId]?.allegroCategoryId, 80), allegroDuplicateResolvedAt: now };
      data.artway_produkty_edytowane = edits;
      const updatedOffers = offers.map((offer) => withdrawOfferIds.includes(String(offer.id)) ? { ...offer, status: 'ENDED', publication: { ...(offer.publication || {}), status: 'ENDED', republish: false }, duplicateOf: keepOfferId, duplicateResolvedAt: now } : offer);
      const audit = Array.isArray(auditRec.items) ? [...auditRec.items] : [];
      audit.unshift({ id: crypto.randomUUID(), productId, keepOfferId, withdrawOfferIds, results, at: now, operator: 'administrator' });
      await Promise.all([
        zapisz('allegro_mappings', { items: mappings, updated_at: now }),
        zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now }),
        zapisz('allegro_offers', { ...offersRec, items: updatedOffers, updated_at: now }),
        zapisz('allegro_duplicate_resolution_audit', { items: audit.slice(0, 2000), updated_at: now }),
      ]);
      return odpowiedz({ ok: true, productId, keepOfferId, withdrawOfferIds, results, mappings, offers: updatedOffers, updated_at: now });
    }

    // ─── ALLEGRO: kalkulator prowizji i opłat dla konkretnej oferty / produktu ───
    if (action === 'allegro-fee-preview') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const product = body.product && typeof body.product === 'object' ? body.product : {};
      const productId = tekst(body.productId || product.id, 100).trim();
      const offerId = tekst(body.offerId || product.allegroOfferId, 100).trim();
      const price = Math.max(0, Number(body.price ?? product.cenaAllegro ?? product.allegroPrice ?? product.cena ?? product.price) || 0);
      if (!price) return odpowiedz({ ok: false, error: 'Podaj cenę Allegro większą od zera', code: 'price_required' }, 422);
      let offer, prepared = null;
      if (offerId) offer = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`);
      else {
        prepared = await allegroDraftZAutoKategoria(req, { ...product, cenaAllegro: price }, { publishNow: false });
        if (!prepared?.payload || prepared.missing?.length) return odpowiedz({ ok: false, error: `Nie można policzyć opłat — uzupełnij: ${(prepared?.missing || ['pełne dane oferty']).join(', ')}`, code: 'incomplete_offer', missing: prepared?.missing || [] }, 422);
        offer = prepared.payload;
      }
      offer = JSON.parse(JSON.stringify(offer || {}));
      offer.sellingMode = offer.sellingMode || { format: 'BUY_NOW' };
      offer.sellingMode.price = { amount: price.toFixed(2), currency: 'PLN' };
      const preview = await allegroWywolaj(req, '/pricing/offer-fee-preview', { method: 'POST', bodyObj: { offer, marketplaceId: 'allegro-pl' } });
      const summary = allegroPodsumujKalkulacjeOplat(preview, price);
      let saved = false;
      if (body.save !== false && productId) {
        const settingsRec = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
        const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
        const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
        edits[productId] = { ...(edits[productId] || {}), allegroCommissionAmount: summary.commissionAmount, allegroCommissionRate: summary.commissionRate, allegroRecurringFees: summary.recurringFees, allegroFeeTotal: summary.totalPreviewFees, allegroFeePrice: summary.salePrice, allegroFeeCurrency: summary.currency, allegroFeeDetails: { commissions: summary.commissions, quotes: summary.quotes }, allegroFeeCalculatedAt: summary.calculatedAt, allegroFeeSource: summary.source, ...(offerId ? { allegroOfferId: offerId } : {}) };
        data.artway_produkty_edytowane = edits;
        await zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: summary.calculatedAt });
        const auditRec = await czytaj('allegro_fee_preview_audit', { items: [], updated_at: null });
        const audit = Array.isArray(auditRec.items) ? [...auditRec.items] : [];
        audit.unshift({ id: crypto.randomUUID(), productId, offerId, ...summary });
        await zapisz('allegro_fee_preview_audit', { items: audit.slice(0, 5000), updated_at: summary.calculatedAt });
        saved = true;
      }
      return odpowiedz({ ok: true, productId, offerId, summary, raw: preview, saved, prepared: prepared ? { missing: prepared.missing || [], categoryId: prepared.autoFilled?.allegroCategoryId || '', catalogProductId: prepared.autoFilled?.allegroProductId || '' } : null });
    }

    if (action === 'allegro-offer-price-change') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const offerIds = [...new Set((Array.isArray(body.offerIds) ? body.offerIds : []).map((x) => tekst(x, 100).trim()).filter(Boolean))].slice(0, 1000);
      const mode = String(body.mode || 'percent').toLowerCase();
      const value = Number(String(body.value ?? '').replace(',', '.'));
      if (!offerIds.length) return odpowiedz({ ok: false, error: 'Zaznacz co najmniej jedną ofertę Allegro' }, 422);
      if (!Number.isFinite(value) || value === 0) return odpowiedz({ ok: false, error: 'Podaj prawidłową wartość zmiany ceny' }, 422);
      let modification;
      if (mode === 'percent') modification = { type: value > 0 ? 'INCREASE_PERCENTAGE' : 'DECREASE_PERCENTAGE', marketplaceId: 'allegro-pl', percentage: Math.abs(value) };
      else if (mode === 'fixed') {
        if (value <= 0) return odpowiedz({ ok: false, error: 'Cena docelowa musi być większa od zera' }, 422);
        modification = { type: 'FIXED_PRICE', marketplaceId: 'allegro-pl', price: { amount: value.toFixed(2), currency: 'PLN' } };
      } else modification = { type: value > 0 ? 'INCREASE_PRICE' : 'DECREASE_PRICE', marketplaceId: 'allegro-pl', value: { amount: Math.abs(value).toFixed(2), currency: 'PLN' } };
      const commandId = crypto.randomUUID();
      const command = await allegroWywolaj(req, `/sale/offer-price-change-commands/${commandId}`, {
        method: 'PUT',
        bodyObj: { modification, offerCriteria: [{ type: 'CONTAINS_OFFERS', offers: offerIds.map((id) => ({ id })) }] },
      });
      return odpowiedz({ ok: true, commandId, command, modification, offerCount: offerIds.length }, 202);
    }

    // ─── PRODUCENT: pobranie danych z URL produktu (admin) ───
    if (action === 'product-url-inspect') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const target = tekst(body.url, 1000).trim();
      if (!/^https?:\/\//i.test(target)) return odpowiedz({ ok: false, error: 'Podaj pełny adres URL produktu' }, 422);
      return odpowiedz(await pobierzProduktProducenta(target));
    }

    // ─── PRODUKT: ręczna dostępność spójna ze sklepem i Allegro ───
    if (action === 'product-sale-availability') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const productId = tekst(body.productId, 100).trim();
      const available = body.available === true;
      if (!productId) return odpowiedz({ ok: false, error: 'Brak identyfikatora produktu', code: 'validation' }, 422);
      const settingsRec = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
      const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
      const availability = data.artway_dostepnosc && typeof data.artway_dostepnosc === 'object' ? { ...data.artway_dostepnosc } : {};
      const now = new Date().toISOString();
      if (available) delete availability[productId];
      else availability[productId] = { status: 'niedostepny', powod: tekst(body.reason || 'Ręcznie wyłączony ze sprzedaży', 500), data: now, operator: 'administrator', source: 'manual', automatic: false };
      data.artway_dostepnosc = availability;
      const saleAutomation = await synchronizujSprzedazZDostepnosciaProducenta(req, [{ ok: true, productId, status: available ? 'dostepny' : 'brak', available, quantity: available ? 1 : 0, checkedAt: now }], data);
      await zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: now });
      return odpowiedz({ ok: true, productId, available, saleAutomation, updated_at: now });
    }

    // ─── PRODUCENT: wyrywkowy monitoring stanów przez Agenta AI ───
    if (action === 'supplier-availability-sample') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const settingsRec = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
      const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
      const warehouse = data.artway_magazyn_ustawienia && typeof data.artway_magazyn_ustawienia === 'object' ? data.artway_magazyn_ustawienia : {};
      const threshold = Math.max(1, Math.min(1000000, Number(body.threshold ?? warehouse.progNiskiProducenta ?? 50) || 50));
      const limit = Math.max(1, Math.min(25, Number(body.limit ?? warehouse.producentProbka ?? 8) || 8));
      const requestedIds = new Set((Array.isArray(body.productIds) ? body.productIds : []).map((x) => tekst(x, 100).trim()).filter(Boolean));
      const baseMap = new Map();
      const add = (item = {}) => { const id = tekst(item.id, 100).trim(); if (id) baseMap.set(id, { ...(baseMap.get(id) || {}), ...item, id }); };
      for (const item of Array.isArray(data.artway_produkty_katalog) ? data.artway_produkty_katalog : []) add(item);
      for (const item of Array.isArray(data.artway_produkty_dodane) ? data.artway_produkty_dodane : []) add(item);
      const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
      for (const [id, item] of Object.entries(edits)) add({ ...(item || {}), id });
      const [storeOrdersRec, allegroOrdersRec, mappingsRec] = await Promise.all([
        czytaj('orders', { items: [] }), czytaj('allegro_orders', { items: [] }), czytaj('allegro_mappings', { items: {} }),
      ]);
      const sales = new Map(), nowMs = Date.now(), day = 86400000, cutoff30 = nowMs - 30 * day, cutoff90 = nowMs - 90 * day;
      const sale = (id, channel, qty, at, active = false) => {
        const key = tekst(id, 100).trim(), n = Math.max(0, Number(qty) || 0), time = Number(at) || 0;
        if (!key || !n) return;
        const rec = sales.get(key) || { sklep30: 0, allegro30: 0, sklep90: 0, allegro90: 0, activeDemand: 0, score: 0 };
        if (time >= cutoff90) rec[`${channel}90`] += n;
        if (time >= cutoff30) rec[`${channel}30`] += n;
        if (active) rec.activeDemand += n;
        sales.set(key, rec);
      };
      const orderTime = (o = {}) => { const raw = o.ts ?? o.createdAt ?? o.firstFetchedAt ?? o.data ?? o.date ?? ''; const n = Number(raw); return Number.isFinite(n) && n > 1000000000 ? (n < 100000000000 ? n * 1000 : n) : (Date.parse(raw) || 0); };
      for (const order of Array.isArray(storeOrdersRec.items) ? storeOrdersRec.items : []) {
        const status = String(order?.status || '').toLowerCase(), active = !['anulowane', 'dostarczone', 'zakończone', 'zwrot', 'zwrot pieniędzy'].includes(status);
        if (status === 'anulowane') continue;
        for (const line of Array.isArray(order?.pozycjeDane) ? order.pozycjeDane : []) sale(line.id, 'sklep', line.ilosc || 1, orderTime(order), active);
      }
      const mappings = allegroMapowaniaItems(mappingsRec), offerToProduct = new Map();
      for (const [offerId, mapping] of Object.entries(mappings)) { const id = tekst(mapping?.productId ?? mapping?.produktId ?? mapping?.id ?? mapping, 100).trim(); if (id) offerToProduct.set(String(offerId), id); }
      for (const p of baseMap.values()) if (p.allegroOfferId) offerToProduct.set(String(p.allegroOfferId), String(p.id));
      for (const order of Array.isArray(allegroOrdersRec.items) ? allegroOrdersRec.items : []) {
        const active = allegroAgentZlecenieAktywne(order), status = String(order?.status || '').toUpperCase(); if (status === 'CANCELLED') continue;
        for (const line of Array.isArray(order?.lineItems) ? order.lineItems : []) { const id = offerToProduct.get(String(line.offerId || line.offer?.id || '')); if (id) sale(id, 'allegro', line.quantity || 1, orderTime(order), active); }
      }
      for (const rec of sales.values()) rec.score = rec.sklep30 * 4 + rec.allegro30 * 5 + rec.sklep90 + rec.allegro90 + rec.activeDemand * 8;
      let candidates = [...baseMap.values()].filter((p) => /^https?:\/\//i.test(tekst(p.producentUrl || p.sourceUrl, 1000).trim())).map((p) => ({ ...p, _sales: sales.get(String(p.id)) || { sklep30: 0, allegro30: 0, sklep90: 0, allegro90: 0, activeDemand: 0, score: 0 } }));
      if (requestedIds.size) candidates = candidates.filter((p) => requestedIds.has(String(p.id)));
      else {
        const bestsellers = candidates.filter((p) => p._sales.score > 0).sort((a, b) => b._sales.score - a._sales.score || (Date.parse(a.producentSprawdzonoAt || '') || 0) - (Date.parse(b.producentSprawdzonoAt || '') || 0));
        const priorityCount = Math.min(bestsellers.length, Math.max(1, Math.ceil(limit * 0.75))), priority = bestsellers.slice(0, priorityCount), priorityIds = new Set(priority.map((p) => String(p.id)));
        const stale = candidates.filter((p) => !priorityIds.has(String(p.id))).sort((a, b) => (Date.parse(a.producentSprawdzonoAt || '') || 0) - (Date.parse(b.producentSprawdzonoAt || '') || 0));
        const pool = stale.slice(0, Math.max(limit, Math.min(stale.length, limit * 4)));
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        candidates = [...priority, ...pool.slice(0, Math.max(0, limit - priority.length))];
      }
      candidates = candidates.slice(0, limit);
      const checkedAt = new Date().toISOString();
      const results = [];
      for (let offset = 0; offset < candidates.length; offset += 4) {
        const batch = candidates.slice(offset, offset + 4);
        const checked = await Promise.all(batch.map(async (p) => {
          const productId = String(p.id), sourceUrl = tekst(p.producentUrl || p.sourceUrl, 1000).trim();
          try {
            const parsed = await pobierzProduktProducenta(sourceUrl);
            const quantityRaw = parsed.availability?.quantity;
            const quantity = quantityRaw === null || quantityRaw === undefined || quantityRaw === '' ? null : Math.max(0, Math.floor(Number(quantityRaw) || 0));
            const available = parsed.availability?.available === true;
            const status = quantity === 0 ? 'brak' : (quantity !== null && quantity <= threshold ? 'niski' : (available ? (quantity === null ? 'dostepny_nieznany' : 'dostepny') : 'nieznany'));
            return { ok: true, productId, name: tekst(p.nazwa || parsed.product?.nazwa || 'Produkt', 300), sourceUrl, quantity, exact: quantity !== null && parsed.availability?.exact === true, status, available, source: tekst(parsed.availability?.source || '', 120), checkedAt, sales: p._sales || {} };
          } catch (e) {
            return { ok: false, productId, name: tekst(p.nazwa || 'Produkt', 300), sourceUrl, status: 'blad', error: tekst(e.message || e, 500), checkedAt, sales: p._sales || {} };
          }
        }));
        results.push(...checked);
      }
      const changedAlerts = [];
      for (const result of results) {
        const previous = edits[result.productId] && typeof edits[result.productId] === 'object' ? edits[result.productId] : {};
        if (!result.ok) {
          edits[result.productId] = { ...previous, producentOstatniaProbaAt: checkedAt, producentOstatniBlad: result.error };
          continue;
        }
        const history = Array.isArray(previous.producentStanHistoria) ? [...previous.producentStanHistoria] : [];
        history.unshift({ at: checkedAt, status: result.status, quantity: result.quantity, exact: result.exact });
        const alertActive = ['niski', 'brak'].includes(result.status);
        const alertHash = alertActive ? result.status : '';
        if (alertActive && alertHash !== previous.producentAlertHash) changedAlerts.push(result);
        edits[result.productId] = {
          ...previous,
          producentUrl: result.sourceUrl,
          sourceUrl: result.sourceUrl,
          dostepnoscProducenta: result.status === 'brak' ? 'niedostępny' : (result.available ? 'dostępny' : 'do sprawdzenia'),
          stanProducenta: result.quantity === null ? '' : result.quantity,
          stanProducentaDokladny: result.exact,
          stanProducentaZrodlo: result.source,
          producentStatus: result.status,
          producentSprawdzonoAt: checkedAt,
          producentOstatniaProbaAt: checkedAt,
          producentOstatniBlad: '',
          producentAlertAktywny: alertActive,
          producentAlertHash: alertHash,
          producentPriorytetWynik: Number(result.sales?.score || 0),
          sprzedazSklep30: Number(result.sales?.sklep30 || 0),
          sprzedazAllegro30: Number(result.sales?.allegro30 || 0),
          sprzedazRazem30: Number(result.sales?.sklep30 || 0) + Number(result.sales?.allegro30 || 0),
          aktywneZapotrzebowanie: Number(result.sales?.activeDemand || 0),
          producentStanHistoria: history.slice(0, 5),
        };
      }
      data.artway_produkty_edytowane = edits;
      let saleAutomation = { siteHidden: 0, siteRestored: 0, allegroHidden: 0, allegroRestored: 0, unchanged: 0, errors: [] };
      try {
        saleAutomation = await synchronizujSprzedazZDostepnosciaProducenta(req, results, data);
      } catch (error) {
        saleAutomation.errors = [{ action: 'availability-automation', error: tekst(error?.message || error, 700), code: tekst(error?.code || '', 120) }];
      }
      const agentHistory = Array.isArray(data.artway_agent_ai_historia) ? [...data.artway_agent_ai_historia] : [];
      const summary = { checked: results.length, priorityChecked: results.filter((x) => Number(x.sales?.score || 0) > 0).length, available: results.filter((x) => ['dostepny', 'dostepny_nieznany'].includes(x.status)).length, low: results.filter((x) => x.status === 'niski').length, unavailable: results.filter((x) => x.status === 'brak').length, unknown: results.filter((x) => ['nieznany', 'blad'].includes(x.status)).length, alerts: changedAlerts.length, threshold, saleAutomation };
      agentHistory.unshift({ id: `AI-SUP-${Date.now().toString(36)}`, typ: 'dostepnosc-producentow', opis: `Agent wyrywkowo sprawdził ${summary.checked} produktów u producentów`, data: checkedAt, dataTxt: new Date().toLocaleString('pl-PL'), operator: tekst(body.source || 'agent-serwerowy', 100), dane: summary });
      data.artway_agent_ai_historia = agentHistory.slice(0, 500);
      await zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: checkedAt });
      const auditRec = await czytaj('supplier_availability_audit', { items: [], updated_at: null });
      const audit = Array.isArray(auditRec.items) ? [...auditRec.items] : [];
      audit.unshift(...results.map((x) => ({ id: crypto.randomUUID(), ...x, threshold, runSource: tekst(body.source || 'manual', 100) })));
      await zapisz('supplier_availability_audit', { items: audit.slice(0, 5000), updated_at: checkedAt });
      let telegram = { sent: false };
      if (changedAlerts.length) {
        const rows = changedAlerts.slice(0, 20).map((x) => `• <b>${telegramHtml(x.name)}</b> — ${x.status === 'brak' ? 'BRAK' : `${x.quantity} szt. (próg ${threshold})`}`).join('\n');
        const automationText = `Sklep: ukryto ${saleAutomation.siteHidden || 0}, przywrócono ${saleAutomation.siteRestored || 0}\nAllegro: wstrzymano ${saleAutomation.allegroHidden || 0}, wznowiono ${saleAutomation.allegroRestored || 0}${saleAutomation.errors?.length ? `\nBłędy automatyki: ${saleAutomation.errors.length}` : ''}`;
        try { await wyslijTelegramHtml(`<b>⚠️ Agent AI: dostępność u producentów</b>\nNowe ostrzeżenia: ${changedAlerts.length}\n\n${rows}\n\n<b>Automatyka sprzedaży</b>\n${automationText}\n\nPanel: https://artwaytm.pl/#/admin/magazyn/dostawcy`); telegram = { sent: true }; }
        catch (e) { telegram = { sent: false, error: tekst(e.message || e, 300) }; }
      }
      return odpowiedz({ ok: true, summary, results, checkedAt, saleAutomation, telegram });
    }

    // ─── ALLEGRO: mapowanie oferty do produktu sklepu (admin) ───
    if (action === 'allegro-map-offer') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const offerId = tekst(body.offerId, 100).trim();
      const productId = tekst(body.productId, 100).trim();
      if (!offerId || !productId) return odpowiedz({ ok: false, error: 'Brak offerId albo productId' }, 422);
      const rec = await czytaj('allegro_mappings', { items: {} });
      const items = allegroMapowaniaItems(rec);
      const offersRec = await czytaj('allegro_offers', { items: [] });
      const offer = allegroOfertyItems(offersRec).find((x) => String(x.id) === offerId) || {};
      items[offerId] = { offerId, productId, allegroProductId: tekst(offer.productId, 120), categoryId: tekst(offer.categoryId, 80), productName: tekst(offer.name, 300), linked_at: new Date().toISOString(), synced_at: new Date().toISOString(), operator: 'admin' };
      await zapisz('allegro_mappings', { items, updated_at: new Date().toISOString() });
      await allegroZapiszPowiazanieProduktu({ id: productId, producent: offer.brand || '' }, { offerId, prepared: { catalogMatch: { selected: { id: offer.productId || '', categoryId: offer.categoryId || '' } } }, draft: {}, resolveTasks: false });
      const workflow = await allegroPrzeliczZamowieniaPoMapowaniu();
      return odpowiedz({ ok: true, mappings: items, ...workflow });
    }

    if (action === 'allegro-unmap-offer') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const offerId = tekst(body.offerId, 100).trim();
      if (!offerId) return odpowiedz({ ok: false, error: 'Brak offerId' }, 422);
      const rec = await czytaj('allegro_mappings', { items: {} });
      const items = allegroMapowaniaItems(rec);
      const oldMapping = items[offerId] || null;
      items[offerId] = { offerId, productId: '', blocked: true, operator: 'admin-unmapped', linked_at: oldMapping?.linked_at || null, synced_at: new Date().toISOString() };
      await zapisz('allegro_mappings', { items, updated_at: new Date().toISOString() });
      if (oldMapping?.productId) {
        const settingsRec = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
        const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
        const edits = data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? { ...data.artway_produkty_edytowane } : {};
        const current = { ...(edits[String(oldMapping.productId)] || {}) };
        if (String(current.allegroOfferId || '') === offerId) delete current.allegroOfferId;
        edits[String(oldMapping.productId)] = current; data.artway_produkty_edytowane = edits;
        await zapisz('settings', { ...settingsRec, data, rev: (Number(settingsRec.rev) || 0) + 1, updated_at: new Date().toISOString() });
      }
      const workflow = await allegroPrzeliczZamowieniaPoMapowaniu();
      return odpowiedz({ ok: true, mappings: items, ...workflow });
    }

    // ─── INPOST: konfiguracja (publiczny token Geowidget + status) ───
    if (action === 'inpost-config') {
      return odpowiedz({ ok: true, inpost: inpostPublicConfig() });
    }

    // ─── INPOST: publiczne wyszukiwanie paczkomatów / punktów odbioru dla checkoutu ───
    if (action === 'inpost-points') {
      const dane = await inpostSzukajPunktow(url);
      return odpowiedz(dane, dane.ok === false ? 400 : 200);
    }

    // ─── INPOST: webhook z Managera Paczek / ShipX → obsługa zleceń i tracking ───
    if (action === 'inpost-webhook') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!inpostWebhookSecret()) return odpowiedz({ ok: false, error: 'Brak INPOST_WEBHOOK_SECRET w Netlify.', code: 'webhook_not_configured' }, 503);
      if (!inpostWebhookAutoryzowany(req, url)) return odpowiedz({ ok: false, error: 'Nieprawidłowy token webhooka', code: 'auth' }, 401);
      const rawBody = await req.text();
      let payload = {};
      try { payload = JSON.parse(rawBody || '{}'); } catch (e) { return odpowiedz({ ok: false, error: 'Webhook InPost nie przesłał poprawnego JSON', code: 'invalid_json' }, 400); }
      const c = inpostKonfiguracja();
      const wyniki = [];
      for (const event of inpostZdarzeniaZWebhooka(payload)) {
        let dane = inpostDaneZWebhooka(event);
        let shipment = null;
        if (c.configured && dane.id) {
          try {
            shipment = await inpostWywolaj(`/v1/shipments/${encodeURIComponent(dane.id)}`, { method: 'GET' });
            dane = inpostDaneZWebhooka(event, shipment);
          } catch (e) {
            // Sam webhook nadal zapisujemy — pełne dane ShipX mogą być chwilowo niedostępne.
          }
        }
        if (!dane.id && !dane.tracking && !dane.reference && !dane.status) continue;
        wyniki.push(await zastosujWebhookInpost(dane));
      }
      if (!wyniki.length) {
        await zapiszLogInpostWebhook({ matched: false, status: 'empty_payload' });
      }
      return odpowiedz({ ok: true, accepted: true, processed: wyniki.length, results: wyniki }, 202);
    }

    // ─── INPOST: realny test tokenu i organizacji ShipX (admin) ───
    if (action === 'inpost-test') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = inpostKonfiguracja();
      if (!c.configured) {
        return odpowiedz({
          ok: false,
          configured: false,
          code: 'inpost_not_configured',
          error: 'InPost nie jest skonfigurowany. Ustaw brakujące zmienne Netlify.',
          missingEnv: c.missingEnv,
          inpost: inpostPublicConfig(),
        }, 503);
      }
      const org = await inpostOrganizacja(c);
      const availability = inpostDostepnoscUslug(c, org);
      return odpowiedz({
        ok: true,
        configured: true,
        inpost: {
          ...inpostPublicConfig(),
          authenticated: true,
          serviceAvailability: availability,
          organization: {
            id: tekst(org?.id || c.orgId, 40),
            name: tekst(org?.name || '', 160),
            services: availability.services,
          },
        },
      });
    }

    // ─── INPOST: utworzenie przesyłki ShipX (admin) ───
    if (action === 'inpost-create') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = inpostKonfiguracja();
      if (!c.configured) return odpowiedz({ ok: false, configured: false, error: 'InPost nie jest skonfigurowany. Ustaw INPOST_TOKEN i INPOST_ORG_ID w Netlify.', code: 'inpost_not_configured' }, 503);
      const body = await req.json().catch(() => ({}));
      const nr = numerZamowienia(body.nr || body.number);
      if (!nr) return odpowiedz({ ok: false, error: 'Brak numeru zamówienia' }, 422);
      const rec = await czytaj('orders', { items: [] });
      const z = (Array.isArray(rec.items) ? rec.items : []).find((x) => x.nr === nr);
      if (!z) return odpowiedz({ ok: false, error: 'Nie znaleziono zamówienia', code: 'not_found' }, 404);
      if (z?.wysylka?.inpostId) return odpowiedz({ ok: false, error: `Przesyłka InPost już istnieje (${z.wysylka.inpostId}).`, code: 'exists', inpostId: z.wysylka.inpostId }, 409);
      const doPaczkomatu = czyDostawaPaczkomatInPost(z);
      if (doPaczkomatu && !tekst(z?.paczkomat || z?.wysylka?.punktKod, 40).trim()) return odpowiedz({ ok: false, error: 'Brak wybranego paczkomatu w zamówieniu — uzupełnij punkt InPost przed wygenerowaniem etykiety.', code: 'no_point' }, 422);
      const walidacja = walidujPrzesylkeInPost(z);
      if (!walidacja.ok) {
        return odpowiedz({
          ok: false,
          error: 'Nie można utworzyć przesyłki InPost — uzupełnij dane zamówienia.',
          code: 'inpost_validation',
          details: walidacja.errors,
        }, 422);
      }
      let availability = null;
      try {
        const org = await inpostOrganizacja(c);
        availability = inpostDostepnoscUslug(c, org);
      } catch (e) {
        availability = null;
      }
      if (availability?.services?.length) {
        const wymaganyTyp = walidacja.doPaczkomatu ? 'locker' : 'courier';
        const service = walidacja.doPaczkomatu ? availability.lockerService : availability.courierService;
        if (!availability[wymaganyTyp]) {
          return odpowiedz({
            ok: false,
            error: `Konto InPost nie ma aktywnej usługi ${service}. Włącz tę usługę w Managerze Paczek.`,
            code: 'inpost_service_unavailable',
            service,
            serviceAvailability: availability,
          }, 422);
        }
      }
      const aktywneUslugi = availability ? { ...c, lockerService: availability.lockerService || c.lockerService, courierService: availability.courierService || c.courierService } : c;
      const payload = przesylkaShipXPayload(z, aktywneUslugi, walidacja);
      const dane = await inpostWywolaj(`/v1/organizations/${encodeURIComponent(c.orgId)}/shipments`, { method: 'POST', bodyObj: payload });
      const inpostId = tekst(dane?.id, 60).trim();
      let daneAktualne = dane;
      if (inpostId) {
        try { daneAktualne = await inpostCzekajNaEtykiete(inpostId, { proby: 10, opoznienieMs: 1100 }); } catch (e) { daneAktualne = dane; }
      }
      const numer = numerZShipX(daneAktualne) || numerZShipX(dane);
      const statusShipX = inpostStatusZShipX(daneAktualne) || inpostStatusZShipX(dane);
      const labelReady = inpostEtykietaGotowa(daneAktualne) || inpostEtykietaGotowa(dane);
      const ofertaId = inpostOfertaId(daneAktualne) || inpostOfertaId(dane);
      const teraz = new Date().toLocaleString('pl-PL');
      const opisGotowosci = labelReady ? 'etykieta gotowa' : 'czeka na potwierdzenie/opłacenie w InPost';
      const historia = [...(Array.isArray(z?.wysylka?.historia) ? z.wysylka.historia : []), { czas: teraz, status: 'Przesyłka utworzona w InPost', opis: `${inpostId ? 'ID ' + inpostId : ''}${numer ? ' • ' + numer : ''}${statusShipX ? ' • ' + statusShipX : ''}${ofertaId ? ' • oferta ' + ofertaId : ''} • ${opisGotowosci}`, zewnetrzneId: inpostId }];
      const patch = {
        przewoznik: 'inpost',
        usluga: walidacja.doPaczkomatu ? 'Paczkomat 24/7' : 'Kurier InPost',
        punktKod: walidacja.doPaczkomatu ? walidacja.punkt : '',
        inpostId,
        inpostStatus: statusShipX,
        inpostOfertaId: ofertaId,
        etykietaGotowa: labelReady,
        numer: numer || z?.wysylka?.numer || '',
        etap: labelReady ? 'etykieta' : (z?.wysylka?.etap && z.wysylka.etap !== 'problem' ? z.wysylka.etap : 'przygotowanie'),
        bladIntegracji: '',
        ostatniaSynchronizacja: new Date().toISOString(),
        zaktualizowano: new Date().toISOString(),
        zadania: { ...(z?.wysylka?.zadania || {}), dane: true, etykieta: labelReady },
        historia,
      };
      const { stary, nowy } = await zapiszPrzesylkeNaZamowieniu(nr, patch);
      // jeśli od razu jest numer nadania → wyślij e-mail „nadanie"
      let email = null;
      if (numer && !numerZShipX({ tracking_number: stary?.wysylka?.numer })) {
        try { email = await obsluzEmailePrzejsciaStatusu({ ...stary, wysylka: { ...(stary?.wysylka || {}), numer: '' } }, nowy); } catch (e) { email = { sent: false, error: e.message }; }
      }
      return odpowiedz({ ok: true, configured: true, inpostId, trackingNumber: numer, status: statusShipX, labelReady, offerId: ofertaId, email, order: { nr, status: nowy?.status, wysylka: nowy?.wysylka } }, 201);
    }

    // ─── INPOST: pobranie oficjalnej etykiety PDF (admin) ───
    if (action === 'inpost-label') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = inpostKonfiguracja();
      if (!c.configured) return odpowiedz({ ok: false, configured: false, error: 'InPost nie jest skonfigurowany.', code: 'inpost_not_configured' }, 503);
      const nr = numerZamowienia(url.searchParams.get('nr'));
      let inpostId = tekst(url.searchParams.get('id'), 60).trim();
      const typ = tekst(url.searchParams.get('type'), 10).trim().toUpperCase() === 'A4' ? 'A4' : 'A6';
      if (!inpostId && nr) {
        const rec = await czytaj('orders', { items: [] });
        const z = (rec.items || []).find((x) => x.nr === nr);
        inpostId = tekst(z?.wysylka?.inpostId, 60).trim();
      }
      if (!inpostId) return odpowiedz({ ok: false, error: 'Brak ID przesyłki InPost — najpierw utwórz przesyłkę.', code: 'no_shipment' }, 422);
      let daneAktualne = null;
      try { daneAktualne = await inpostCzekajNaEtykiete(inpostId, { proby: 6, opoznienieMs: 900 }); } catch (e) { daneAktualne = null; }
      const statusShipX = inpostStatusZShipX(daneAktualne);
      const numer = numerZShipX(daneAktualne);
      const labelReady = inpostEtykietaGotowa(daneAktualne);
      if (!labelReady) {
        if (nr && daneAktualne) {
          const rec = await czytaj('orders', { items: [] });
          const z = (rec.items || []).find((x) => x.nr === nr);
          if (z) {
            const stareH = Array.isArray(z?.wysylka?.historia) ? z.wysylka.historia : [];
            const teraz = new Date().toLocaleString('pl-PL');
            const historia = statusShipX && !stareH.some((h) => h.opis && h.opis.includes(statusShipX))
              ? [...stareH, { czas: teraz, status: 'Etykieta InPost jeszcze niedostępna', opis: statusShipX }]
              : stareH;
            await zapiszPrzesylkeNaZamowieniu(nr, {
              inpostStatus: statusShipX,
              numer: numer || z?.wysylka?.numer || '',
              etykietaGotowa: false,
              ostatniaSynchronizacja: new Date().toISOString(),
              zadania: { ...(z?.wysylka?.zadania || {}), dane: true, etykieta: false },
              historia,
            });
          }
        }
        return odpowiedz({
          ok: false,
          code: 'label_not_ready',
          error: `InPost jeszcze nie potwierdził etykiety${statusShipX ? ` (status: ${statusShipX})` : ''}. Kliknij „Status InPost” za chwilę albo sprawdź, czy przesyłka została opłacona w Managerze Paczek.`,
          inpostId,
          status: statusShipX,
          trackingNumber: numer,
          labelReady: false,
        }, 409);
      }
      try {
        const pdf = await inpostWywolaj(`/v1/shipments/${encodeURIComponent(inpostId)}/label?format=pdf&type=${typ}`, { method: 'GET', accept: 'application/pdf' });
        return odpowiedz({ ok: true, format: 'pdf', type: typ, filename: `etykieta-inpost-${nr || inpostId}.pdf`, base64: pdf.base64, inpostId, status: statusShipX, trackingNumber: numer, labelReady: true });
      } catch (e) {
        if (e.code === 'invalid_action' || /invalid_action|statusie wcześniejszym niż|nieopłaconej/i.test(e.message || '')) {
          return odpowiedz({
            ok: false,
            code: 'label_not_ready',
            error: `InPost nie pozwala jeszcze pobrać etykiety${statusShipX ? ` (status: ${statusShipX})` : ''}. Przesyłka musi być opłacona i mieć status confirmed lub późniejszy.`,
            inpostId,
            status: statusShipX,
            trackingNumber: numer,
            labelReady: false,
          }, 409);
        }
        throw e;
      }
    }

    // ─── INPOST: synchronizacja statusu / trackingu przesyłki (admin) ───
    if (action === 'inpost-status') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = inpostKonfiguracja();
      if (!c.configured) return odpowiedz({ ok: false, configured: false, error: 'InPost nie jest skonfigurowany.', code: 'inpost_not_configured' }, 503);
      const nr = numerZamowienia(url.searchParams.get('nr'));
      const rec = await czytaj('orders', { items: [] });
      const z = (rec.items || []).find((x) => x.nr === nr);
      const inpostId = tekst(url.searchParams.get('id') || z?.wysylka?.inpostId, 60).trim();
      if (!inpostId) return odpowiedz({ ok: false, error: 'Brak ID przesyłki InPost.', code: 'no_shipment' }, 422);
      const dane = await inpostWywolaj(`/v1/shipments/${encodeURIComponent(inpostId)}`, { method: 'GET' });
      const numer = numerZShipX(dane);
      const statusShipX = inpostStatusZShipX(dane);
      const labelReady = inpostEtykietaGotowa(dane);
      const ofertaId = inpostOfertaId(dane);
      const teraz = new Date().toLocaleString('pl-PL');
      const stareH = Array.isArray(z?.wysylka?.historia) ? z.wysylka.historia : [];
      const wpisIstnieje = stareH.some((h) => h.opis && h.opis.includes(statusShipX));
      const historia = (statusShipX && !wpisIstnieje) ? [...stareH, { czas: teraz, status: 'Status InPost', opis: statusShipX + (numer ? ' • ' + numer : '') }] : stareH;
      const patch = {
        inpostStatus: statusShipX,
        inpostOfertaId: ofertaId || z?.wysylka?.inpostOfertaId || '',
        numer: numer || z?.wysylka?.numer || '',
        etykietaGotowa: labelReady,
        ostatniaSynchronizacja: new Date().toISOString(),
        zadania: { ...(z?.wysylka?.zadania || {}), dane: true, etykieta: labelReady },
        historia,
      };
      if (labelReady && (!z?.wysylka?.etap || z.wysylka.etap === 'przygotowanie' || z.wysylka.etap === 'problem')) patch.etap = 'etykieta';
      if (labelReady) patch.bladIntegracji = '';
      const { stary, nowy } = await zapiszPrzesylkeNaZamowieniu(nr, patch);
      let email = null;
      if (numer && !(stary?.wysylka?.numer)) {
        try { email = await obsluzEmailePrzejsciaStatusu(stary, nowy); } catch (e) { email = { sent: false, error: e.message }; }
      }
      return odpowiedz({ ok: true, configured: true, inpostId, trackingNumber: numer, status: statusShipX, labelReady, offerId: ofertaId, email, order: { nr, wysylka: nowy?.wysylka } });
    }

    // ─── INPOST: automatyczne sprawdzenie statusów WSZYSTKICH przesyłek (admin / harmonogram co 6h) ───
    if (action === 'inpost-sync-all') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = inpostKonfiguracja();
      if (!c.configured) return odpowiedz({ ok: false, configured: false, error: 'InPost nie jest skonfigurowany.', code: 'inpost_not_configured' }, 503);
      const rec = await czytaj('orders', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const zamkniete = ['dostarczone', 'zakończone', 'anulowane', 'zwrot', 'zwrot pieniędzy'];
      const doSync = items.filter((z) => tekst(z?.wysylka?.inpostId, 60).trim() && !zamkniete.includes(String(z?.status || '').toLowerCase()));
      let sprawdzone = 0, zmienione = 0, bledy = 0, maile = 0;
      const zmiany = [];
      for (const z of doSync.slice(0, 300)) {
        const inpostId = tekst(z.wysylka.inpostId, 60).trim();
        try {
          const dane = await inpostWywolaj(`/v1/shipments/${encodeURIComponent(inpostId)}`, { method: 'GET' });
          sprawdzone++;
          const status = inpostStatusZShipX(dane);
          const tracking = numerZShipX(dane);
          const statusStary = tekst(z?.wysylka?.inpostStatus, 60).trim();
          const trackingStary = tekst(z?.wysylka?.numer, 120).trim();
          const etykietaStara = !!z?.wysylka?.etykietaGotowa;
          const etykietaNowa = inpostEtykietaGotowa(dane);
          if ((status && status !== statusStary) || (tracking && tracking !== trackingStary) || (etykietaNowa && !etykietaStara)) {
            const r = await zastosujWebhookInpost({ id: inpostId, status, tracking, reference: z.nr, occurredAt: new Date().toISOString() });
            if (r && r.matched) { zmienione++; if (r.email && r.email.sent) maile++; zmiany.push({ nr: z.nr, status, etap: r.etap }); }
          }
        } catch (e) { bledy++; }
      }
      return odpowiedz({ ok: true, configured: true, sprawdzone, zmienione, bledy, maile, zmiany, sprawdzono: new Date().toISOString() });
    }

    // ─── POBRANIE USTAWIEŃ (publiczne) + zamówień/klientów (admin) ───
    if (action === 'pull' || action === 'store-data') {
      const s = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
      const res = { ok: true, settings: s.data || {}, rev: s.rev || 0, updated_at: s.updated_at || null };
      if (czyAdmin(req, url)) {
        const o = await czytaj('orders', { items: [] });
        const u = await czytaj('users', { items: [] });
        const d = await czytajUsunieteZamowienia();
        res.deleted_orders = d;
        res.orders = filtrujNieusunieteZamowienia(o.items || [], d);
        res.users = u.items || [];
      }
      return odpowiedz(res);
    }

    // ─── ZAPIS USTAWIEŃ (tylko admin) ───
    if (action === 'settings') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const dane = oczyscUstawienia(body.settings);
      const rozmiar = JSON.stringify(dane).length;
      if (rozmiar > LIMIT_USTAWIEN) return odpowiedz({ ok: false, error: 'Ustawienia są zbyt duże' }, 413);
      const prev = await czytaj('settings', { rev: 0 });
      const rec = { data: dane, rev: (prev.rev || 0) + 1, updated_at: new Date().toISOString() };
      await zapisz('settings', rec);
      return odpowiedz({ ok: true, rev: rec.rev, updated_at: rec.updated_at });
    }

    // ─── KLIENT SKŁADA ZAMÓWIENIE (publiczne) ───
    if (action === 'store-order-create') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const zam = normalizujZamowienie(body.order);
      if (!zam) return odpowiedz({ ok: false, error: 'Brak danych zamówienia' }, 422);
      const usuniete = mapaUsunietych(await czytajUsunieteZamowienia());
      if (usuniete.has(zam.nr)) return odpowiedz({ ok: true, stored: false, deleted: true, number: zam.nr });
      const rec = await czytaj('orders', { items: [] });
      const items = filtrujNieusunieteZamowienia(rec.items || [], usuniete);
      let email = null;
      if (!items.some((x) => x.nr === zam.nr)) {
        items.unshift(zam);
        while (items.length > LIMIT_ZAMOWIEN) items.pop();
        await zapisz('orders', { items, updated_at: new Date().toISOString() });
        await odejmijStany(zam);
        if (zam.platnoscId !== 'paynow') {
          try { email = await wyslijEmaileNowegoZamowienia(zam); }
          catch (e) {
            email = { configured: emailKonfiguracja().configured, sent: false, error: e.message };
            await dopiszHistorieEmaila(zam.nr, { typ: 'potwierdzenie', status: 'błąd wysyłki', blad: e.message, automatyczne: true });
          }
        }
      }
      return odpowiedz({ ok: true, stored: true, number: zam.nr, email });
    }

    // ─── KLIENT SKŁADA OPINIĘ (publiczne, do moderacji) ───
    if (action === 'store-review-add') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const op = body.review;
      if (!op || typeof op !== 'object') return odpowiedz({ ok: false, error: 'Brak danych opinii' }, 422);
      const rec = await czytaj('settings', { data: {}, rev: 0 });
      const dane = rec.data || {};
      const lista = Array.isArray(dane.artway_opinie) ? dane.artway_opinie : [];
      op.status = 'oczekuje';
      op.serwer = true;
      lista.unshift(op);
      while (lista.length > 5000) lista.pop();
      dane.artway_opinie = lista;
      await zapisz('settings', { ...rec, data: dane, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, stored: true });
    }

    // ─── MOJE ZAMÓWIENIA (po e-mailu) ───
    if (action === 'store-orders-mine') {
      const email = tekst(url.searchParams.get('email'), 200).trim().toLowerCase();
      if (!email) return odpowiedz({ ok: true, orders: [] });
      const rec = await czytaj('orders', { items: [] });
      const usuniete = await czytajUsunieteZamowienia();
      const moje = filtrujNieusunieteZamowienia(rec.items || [], usuniete).filter((z) => (z.email || '').toLowerCase() === email);
      return odpowiedz({ ok: true, orders: moje });
    }

    // ─── SYNCHRONIZACJA ADMINA (scala lokalne z serwerem) ───
    if (action === 'store-sync') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const przychodzaceZ = Array.isArray(body.orders) ? body.orders : [];
      const przychodzacyU = Array.isArray(body.users) ? body.users : [];
      const przychodzaceD = Array.isArray(body.deleted_orders) ? body.deleted_orders : [];
      const zapisaneD = await czytajUsunieteZamowienia();
      const usunieteMapa = mapaUsunietych([...zapisaneD, ...przychodzaceD]);
      const deletedOrders = [...usunieteMapa.values()]
        .sort((a, b) => String(b.deleted_at || '').localeCompare(String(a.deleted_at || '')))
        .slice(0, LIMIT_USUNIETYCH_ZAMOWIEN);
      await zapisz('deleted_orders', { items: deletedOrders, updated_at: new Date().toISOString() });

      const recO = await czytaj('orders', { items: [] });
      const orders = filtrujNieusunieteZamowienia(recO.items || [], usunieteMapa);
      const numery = new Set(orders.map((z) => z.nr));
      for (const raw of przychodzaceZ) {
        const z = normalizujZamowienie(raw);
        if (z && !usunieteMapa.has(z.nr) && !numery.has(z.nr)) { orders.unshift(z); numery.add(z.nr); }
      }
      orders.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
      while (orders.length > LIMIT_ZAMOWIEN) orders.pop();
      await zapisz('orders', { items: orders, updated_at: new Date().toISOString() });

      const recU = await czytaj('users', { items: [] });
      const users = Array.isArray(recU.items) ? recU.items : [];
      const maile = new Set(users.map((u) => (u.email || '').toLowerCase()));
      for (const raw of przychodzacyU) {
        const u = normalizujKlienta(raw);
        if (u && !maile.has(u.email)) { users.push(u); maile.add(u.email); }
      }
      while (users.length > LIMIT_KLIENTOW) users.pop();
      await zapisz('users', { items: users, updated_at: new Date().toISOString() });

      return odpowiedz({ ok: true, orders, users, deleted_orders: deletedOrders, updated_at: new Date().toISOString() });
    }

    // ─── ADMIN: zapis / usuwanie zamówienia ───
    if (action === 'store-order-save') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const zam = normalizujZamowienie(body.order);
      if (!zam) return odpowiedz({ ok: false, error: 'Brak danych zamówienia' }, 422);
      const usuniete = mapaUsunietych(await czytajUsunieteZamowienia());
      if (usuniete.has(zam.nr)) return odpowiedz({ ok: true, stored: false, deleted: true, number: zam.nr });
      const rec = await czytaj('orders', { items: [] });
      const items = filtrujNieusunieteZamowienia(rec.items || [], usuniete);
      const i = items.findIndex((x) => x.nr === zam.nr);
      const stary = i >= 0 ? items[i] : null;
      // zachowaj serwerową historię e-maili (klient mógł mieć starszą kopię)
      if (stary) {
        zam.wysylka = zam.wysylka || {};
        zam.wysylka.powiadomienia = polaczPowiadomienia(stary?.wysylka?.powiadomienia, zam.wysylka.powiadomienia);
      }
      if (i >= 0) items[i] = zam; else items.unshift(zam);
      await zapisz('orders', { items, updated_at: new Date().toISOString() });
      let email = null;
      try { email = await obsluzEmailePrzejsciaStatusu(stary, zam); }
      catch (e) { email = { sent: false, error: e.message }; }
      return odpowiedz({ ok: true, stored: true, number: zam.nr, email, powiadomienia: email?.powiadomienia });
    }
    if (action === 'store-order-delete') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const nr = numerZamowienia(body.number || body.nr);
      if (!nr) return odpowiedz({ ok: false, error: 'Brak numeru zamówienia' }, 422);
      await dopiszUsunieteZamowienie({ nr, by: 'admin' });
      const rec = await czytaj('orders', { items: [] });
      const items = (rec.items || []).filter((x) => x.nr !== nr);
      await zapisz('orders', { items, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, deleted: true });
    }

    // ─── KLIENT: usuwa własne zlecenie/zamówienie ───
    if (action === 'store-order-delete-mine') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const nr = numerZamowienia(body.number || body.nr);
      const email = tekst(body.email, 200).trim().toLowerCase();
      if (!nr || !email) return odpowiedz({ ok: false, error: 'Brak numeru zamówienia albo e-maila klienta' }, 422);
      const rec = await czytaj('orders', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const zam = items.find((x) => x.nr === nr);
      if (zam && (zam.email || '').toLowerCase() !== email) {
        return odpowiedz({ ok: false, error: 'To zlecenie nie należy do podanego klienta', code: 'auth' }, 403);
      }
      await dopiszUsunieteZamowienie({ nr, email, by: 'customer' });
      await zapisz('orders', { items: items.filter((x) => x.nr !== nr), updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, deleted: true });
    }

    // ─── ADMIN/KLIENT: zapis klienta ───
    if (action === 'store-user-save' || action === 'account-profile-save') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const u = normalizujKlienta(body.user);
      if (!u) return odpowiedz({ ok: false, error: 'Brak danych klienta' }, 422);
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const i = items.findIndex((x) => (x.email || '').toLowerCase() === u.email);
      if (i >= 0) items[i] = { ...items[i], ...u }; else items.push(u);
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, stored: true, email: u.email });
    }
    if (action === 'store-user-delete') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const email = tekst(body.email, 200).trim().toLowerCase();
      const rec = await czytaj('users', { items: [] });
      const items = (rec.items || []).filter((x) => (x.email || '').toLowerCase() !== email);
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, deleted: true });
    }

    // ─── REJESTRACJA KLIENTA (publiczna, konto we wspólnej bazie) ───
    if (action === 'account-register') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const u = normalizujKlienta(body.user);
      if (!u || !u.hash) return odpowiedz({ ok: false, error: 'Brak danych konta' }, 422);
      u.rola = 'klient'; u.account = true;
      const rec = await czytaj('users', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      if (items.some((x) => (x.email || '').toLowerCase() === u.email)) {
        return odpowiedz({ ok: false, error: 'Konto z tym adresem już istnieje.', code: 'exists' }, 409);
      }
      items.push(u);
      await zapisz('users', { items, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, stored: true, user: { imie: u.imie || u.email, email: u.email, rola: 'klient' } });
    }

    // ─── LOGOWANIE KLIENTA (publiczne, sprawdzenie hasła we wspólnej bazie) ───
    if (action === 'account-login') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const email = tekst(body.email, 200).trim().toLowerCase();
      const hash = tekst(body.hash, 300);
      if (!email || !hash) return odpowiedz({ ok: false, error: 'Podaj e-mail i hasło', code: 'auth' }, 401);
      const rec = await czytaj('users', { items: [] });
      const u = (rec.items || []).find((x) => (x.email || '').toLowerCase() === email);
      if (!u || !u.hash || u.hash !== hash) return odpowiedz({ ok: false, error: 'Nieprawidłowy e-mail lub hasło.', code: 'auth' }, 401);
      return odpowiedz({ ok: true, authenticated: true, user: { imie: u.imie || u.email, email: u.email, rola: u.rola || 'klient' } });
    }

    // ─── logowanie tokenem (sprawdzenie hasła administratora) ───
    if (action === 'login') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const podane = tekst(body.password || body.token, 500);
      const env = process.env.ARTWAY_ADMIN_TOKEN || '';
      if (!env) return odpowiedz({ ok: false, error: 'Serwer nie ma ustawionego hasła (ARTWAY_ADMIN_TOKEN).', code: 'no_token' }, 503);
      if (!bezpiecznePorownanie(podane, env)) return odpowiedz({ ok: false, error: 'Nieprawidłowe hasło administratora', code: 'auth' }, 401);
      return odpowiedz({ ok: true, authenticated: true });
    }

    return odpowiedz({ ok: false, error: 'Nieznana akcja: ' + action }, 404);
  } catch (e) {
    const status = Number(e?.status) >= 400 && Number(e?.status) < 600 ? Number(e.status) : 500;
    const body = {
      ok: false,
      error: e && e.message ? e.message : String(e),
      code: e?.code || (status === 500 ? 'server_error' : 'request_error'),
    };
    if (Array.isArray(e?.missingEnv)) body.missingEnv = e.missingEnv;
    if (e?.inpost?.details) body.details = e.inpost.details;
    if (e?.allegro) body.allegroError = e.allegro;
    if (e?.draft) body.draft = e.draft;
    if (e?.categorySuggestion) body.categorySuggestion = e.categorySuggestion;
    if (e?.salesConditions) body.salesConditions = e.salesConditions;
    if (e?.categoryParameters) body.categoryParameters = e.categoryParameters;
    if (e?.requiredParameters) body.requiredParameters = e.requiredParameters;
    if (e?.catalogMatch) body.catalogMatch = e.catalogMatch;
    if (e?.supportErrors) body.supportErrors = e.supportErrors;
    if (e?.agentTask) body.agentTask = e.agentTask;
    return odpowiedz(body, status);
  }
};
