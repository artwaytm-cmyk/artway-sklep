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
  'artway_produkty_ukryte',
  'artway_produkty_definitywne',
  'artway_stany',
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
    let zmiana = false;
    for (const p of pozycje) {
      const id = p && (p.id != null ? String(p.id) : '');
      const ile = Number(p && p.ilosc) || 0;
      if (!id || ile <= 0) continue;
      if (id in stany && stany[id] !== '' && stany[id] != null && !Number.isNaN(Number(stany[id]))) {
        stany[id] = Math.max(0, Number(stany[id]) - ile);
        zmiana = true;
      }
    }
    if (zmiana) {
      dane.artway_stany = stany;
      await zapisz('settings', { ...ust, data: dane, updated_at: new Date().toISOString() });
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
function zlSerwer(v) {
  return `${(Number(v) || 0).toFixed(2).replace('.', ',')} zł`;
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
      opis: 'Zapłacisz kurierowi przy doręczeniu. Przygotujemy paczkę i wyślemy kolejne informacje po nadaniu przesyłki.',
      akcja: 'Zobacz szczegóły zamówienia',
      url: linkSklepuEmail('/#/zamowienia'),
      meta: `Wartość zamówienia: ${kwota}`,
    };
  }
  return {
    tytul: 'Płatność',
    opis: z?.platnoscInstrukcja || `Wybrana metoda płatności: ${metoda}.`,
    akcja: 'Zobacz szczegóły zamówienia',
    url: linkSklepuEmail('/#/zamowienia'),
    meta: `Wartość zamówienia: ${kwota}`,
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
  const shippingBody = `${htmlEscape(z?.dostawa || '—')}<br><span style="color:#6b7280">${htmlEscape(adresDostawyEmail(z))}</span>${z?.paczkomat ? `<br><span style="color:#6b7280">Punkt odbioru: ${htmlEscape(z.paczkomat)}</span>` : ''}`;
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
                <div style="text-align:right;margin:14px 0 22px;font-size:20px;font-weight:900;color:#111827">Suma: ${htmlEscape(zlSerwer(z?.razem))}</div>
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

Wartość zamówienia: ${zlSerwer(z.razem)}
Dostawa: ${z.dostawa || '—'}
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

Razem: ${zlSerwer(z.razem)}
Dostawa: ${z.dostawa || '—'}
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
  nadanie: { badge: 'Przesyłka w drodze', title: 'Twoja paczka została nadana', accent: '#059669', opis: 'Przesyłka jest już u przewoźnika. Poniżej znajdziesz numer i link do śledzenia.', subject: (nr) => `Zamówienie ${nr} zostało nadane — Artway-TM` },
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
  problem: ['Czuwamy nad przesyłką', 'Monitorujemy sytuację u przewoźnika i przekażemy kolejną informację zaraz po jej wyjaśnieniu.'],
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
  const platnoscKartaHtml = `<b>${htmlEscape(z?.platnosc || '—')}</b>${platnoscStatus ? `<br><span style="color:#374151">Status płatności: ${htmlEscape(platnoscStatus)}</span>` : ''}<br><span style="display:inline-block;margin-top:8px;color:#111827;font-weight:800">Kwota: ${htmlEscape(zlSerwer(z?.razem))}</span>`;
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
  const body = `${powitanie}\n\n${tresc}\n\nSzczegóły sprawdzisz w sekcji „Moje zamówienia”.\n\nPozdrawiamy\nArtway-TM\n${linkSklepuEmail('/#/')}`;
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

// ─── INPOST ShipX (przesyłki, etykiety, tracking) + Geowidget ───
const INPOST_ENVY = new Set(['production', 'sandbox']);
function inpostEnv() {
  const env = String(process.env.INPOST_ENV || 'production').trim().toLowerCase();
  return INPOST_ENVY.has(env) ? env : 'production';
}
function inpostBaseUrl() {
  return inpostEnv() === 'sandbox' ? 'https://sandbox-api-shipx-pl.easypack24.net' : 'https://api-shipx-pl.easypack24.net';
}
function inpostKonfiguracja() {
  const token = tekst(process.env.INPOST_TOKEN || process.env.INPOST_API_TOKEN || '', 4000).trim();
  const orgId = tekst(process.env.INPOST_ORG_ID || process.env.INPOST_ORGANIZATION_ID || '', 40).trim();
  const geowidgetToken = tekst(process.env.INPOST_GEOWIDGET_TOKEN || '', 4000).trim();
  return {
    token,
    orgId,
    geowidgetToken,
    configured: !!(token && orgId),
    env: inpostEnv(),
    baseUrl: inpostBaseUrl(),
    sendingMethod: tekst(process.env.INPOST_SENDING_METHOD || 'dispatch_order', 40).trim() || 'dispatch_order',
  };
}
function inpostPublicConfig() {
  const c = inpostKonfiguracja();
  return {
    configured: c.configured,
    env: c.env,
    geowidgetToken: c.geowidgetToken,
    geowidgetConfigured: !!c.geowidgetToken,
    requiredEnv: ['INPOST_TOKEN', 'INPOST_ORG_ID', 'INPOST_GEOWIDGET_TOKEN'],
    optionalEnv: ['INPOST_ENV=production', 'INPOST_SENDING_METHOD=dispatch_order'],
  };
}
async function inpostWywolaj(path, { method = 'GET', bodyObj = null, accept = 'application/json' } = {}) {
  const c = inpostKonfiguracja();
  if (!c.configured) {
    const blad = new Error('InPost nie jest skonfigurowany po stronie serwera. Ustaw INPOST_TOKEN i INPOST_ORG_ID w Netlify.');
    blad.code = 'inpost_not_configured';
    throw blad;
  }
  const headers = { 'Authorization': `Bearer ${c.token}`, 'Accept': accept, 'User-Agent': 'Artway-TM/1.0' };
  const body = bodyObj === null ? undefined : JSON.stringify(bodyObj);
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(new URL(path, c.baseUrl).toString(), { method, headers, body });
  const ct = r.headers.get('content-type') || '';
  if (accept === 'application/pdf' || ct.includes('application/pdf') || ct.includes('octet-stream')) {
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      const blad = new Error(bledyInpostTekst(bezpiecznyJson(t), `InPost HTTP ${r.status}`));
      blad.status = r.status; throw blad;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return { binary: true, contentType: ct || 'application/pdf', base64: buf.toString('base64') };
  }
  const t = await r.text();
  const dane = bezpiecznyJson(t);
  if (!r.ok) {
    const blad = new Error(bledyInpostTekst(dane, `InPost HTTP ${r.status}`));
    blad.status = r.status; blad.inpost = dane; throw blad;
  }
  return dane || {};
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
  if (dane.error) return `${dane.error}${dane.error_description ? ': ' + dane.error_description : ''}`;
  return fallback;
}
function telefonInpost(v) {
  const cyfry = String(v || '').replace(/[^0-9]/g, '');
  if (cyfry.length === 11 && cyfry.startsWith('48')) return cyfry.slice(2);
  return cyfry.slice(-9);
}
function przesylkaShipXPayload(z, c) {
  const k = z?.klient || {};
  const a = z?.adresDostawy || {};
  const w = z?.wysylka || {};
  const doPaczkomatu = z?.dostawaId === 'paczkomat' || !!(z?.paczkomat || w?.punktKod);
  const punkt = tekst(z?.paczkomat || w?.punktKod, 40).trim();
  const receiver = {
    first_name: tekst(k.imie, 80).trim() || 'Klient',
    last_name: tekst(k.nazwisko, 80).trim() || z?.nr || '—',
    email: tekst(z?.email || k.email, 200).trim(),
    phone: telefonInpost(k.telefon || z?.telefon),
  };
  if (!doPaczkomatu) {
    receiver.address = {
      street: tekst(a.ulica, 120).trim() || tekst(z?.adres, 120).trim(),
      building_number: tekst(a.nrDomu, 30).trim() || '1',
      city: tekst(a.miasto, 80).trim(),
      post_code: tekst(a.kod, 12).trim(),
      country_code: 'PL',
    };
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
  const payload = {
    receiver,
    parcels: [parcel],
    service: doPaczkomatu ? 'inpost_locker_standard' : 'inpost_courier_standard',
    reference: tekst(z?.nr, 80),
    custom_attributes: {
      sending_method: doPaczkomatu ? c.sendingMethod : 'dispatch_order',
    },
  };
  if (doPaczkomatu && punkt) payload.custom_attributes.target_point = punkt;
  if (z?.platnoscId === 'pobranie') {
    payload.cod = { amount: Number(z?.razem) || 0, currency: 'PLN' };
    payload.insurance = { amount: Number(z?.razem) || 0, currency: 'PLN' };
  }
  return payload;
}
function numerZShipX(s) {
  return tekst(s?.tracking_number || s?.trackingNumber || '', 120).trim();
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
        inpost: inpostPublicConfig(),
      });
    }

    // ─── E-MAIL: konfiguracja bez sekretów ───
    if (action === 'email-config') {
      return odpowiedz({ ok: true, email: emailPublicConfig() });
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

    // ─── INPOST: konfiguracja (publiczny token Geowidget + status) ───
    if (action === 'inpost-config') {
      return odpowiedz({ ok: true, inpost: inpostPublicConfig() });
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
      const doPaczkomatu = z?.dostawaId === 'paczkomat' || !!(z?.paczkomat || z?.wysylka?.punktKod);
      if (doPaczkomatu && !tekst(z?.paczkomat || z?.wysylka?.punktKod, 40).trim()) return odpowiedz({ ok: false, error: 'Brak wybranego paczkomatu w zamówieniu (klient nie wskazał punktu).', code: 'no_point' }, 422);
      const payload = przesylkaShipXPayload(z, c);
      const dane = await inpostWywolaj(`/v1/organizations/${encodeURIComponent(c.orgId)}/shipments`, { method: 'POST', bodyObj: payload });
      const inpostId = tekst(dane?.id, 60).trim();
      const numer = numerZShipX(dane);
      const statusShipX = tekst(dane?.status, 60).trim();
      const teraz = new Date().toLocaleString('pl-PL');
      const historia = [...(Array.isArray(z?.wysylka?.historia) ? z.wysylka.historia : []), { czas: teraz, status: 'Przesyłka utworzona w InPost', opis: `${inpostId ? 'ID ' + inpostId : ''}${numer ? ' • ' + numer : ''}${statusShipX ? ' • ' + statusShipX : ''}`, zewnetrzneId: inpostId }];
      const patch = {
        przewoznik: 'inpost',
        inpostId,
        inpostStatus: statusShipX,
        numer: numer || z?.wysylka?.numer || '',
        etap: numer ? 'etykieta' : (z?.wysylka?.etap || 'przygotowanie'),
        bladIntegracji: '',
        ostatniaSynchronizacja: new Date().toISOString(),
        zaktualizowano: new Date().toISOString(),
        historia,
      };
      const { stary, nowy } = await zapiszPrzesylkeNaZamowieniu(nr, patch);
      // jeśli od razu jest numer nadania → wyślij e-mail „nadanie"
      let email = null;
      if (numer && !numerZShipX({ tracking_number: stary?.wysylka?.numer })) {
        try { email = await obsluzEmailePrzejsciaStatusu({ ...stary, wysylka: { ...(stary?.wysylka || {}), numer: '' } }, nowy); } catch (e) { email = { sent: false, error: e.message }; }
      }
      return odpowiedz({ ok: true, configured: true, inpostId, trackingNumber: numer, status: statusShipX, email, order: { nr, wysylka: nowy?.wysylka } }, 201);
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
      const pdf = await inpostWywolaj(`/v1/shipments/${encodeURIComponent(inpostId)}/label?format=pdf&type=${typ}`, { method: 'GET', accept: 'application/pdf' });
      return odpowiedz({ ok: true, format: 'pdf', type: typ, filename: `etykieta-inpost-${nr || inpostId}.pdf`, base64: pdf.base64 });
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
      const statusShipX = tekst(dane?.status, 60).trim();
      const teraz = new Date().toLocaleString('pl-PL');
      const stareH = Array.isArray(z?.wysylka?.historia) ? z.wysylka.historia : [];
      const wpisIstnieje = stareH.some((h) => h.opis && h.opis.includes(statusShipX));
      const historia = (statusShipX && !wpisIstnieje) ? [...stareH, { czas: teraz, status: 'Status InPost', opis: statusShipX + (numer ? ' • ' + numer : '') }] : stareH;
      const patch = { inpostStatus: statusShipX, numer: numer || z?.wysylka?.numer || '', ostatniaSynchronizacja: new Date().toISOString(), historia };
      if (numer && z?.wysylka?.etap && z.wysylka.etap === 'przygotowanie') patch.etap = 'etykieta';
      const { stary, nowy } = await zapiszPrzesylkeNaZamowieniu(nr, patch);
      let email = null;
      if (numer && !(stary?.wysylka?.numer)) {
        try { email = await obsluzEmailePrzejsciaStatusu(stary, nowy); } catch (e) { email = { sent: false, error: e.message }; }
      }
      return odpowiedz({ ok: true, configured: true, inpostId, trackingNumber: numer, status: statusShipX, email, order: { nr, wysylka: nowy?.wysylka } });
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
    return odpowiedz({ ok: false, error: 'Błąd serwera: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
