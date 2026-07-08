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
function htmlLayoutEmail({ preheader, badge, title, intro, z, mainCta, extraCta = [], admin = false }) {
  const payment = instrukcjaPlatnosciEmail(z);
  const sklepUrl = linkSklepuEmail('/#/');
  const kontoUrl = linkSklepuEmail('/#/zamowienia');
  const adminUrl = linkSklepuEmail(`/#/admin/zamowienie/${encodeURIComponent(z?.nr || '')}`);
  const k = z?.klient || {};
  const telefon = tekst(k.telefon || '', 80).trim();
  const email = tekst(z?.email || '', 200).trim();
  const shippingBody = `${htmlEscape(z?.dostawa || '—')}<br><span style="color:#6b7280">${htmlEscape(adresDostawyEmail(z))}</span>${z?.paczkomat ? `<br><span style="color:#6b7280">Punkt odbioru: ${htmlEscape(z.paczkomat)}</span>` : ''}`;
  const paymentBody = `<b>${htmlEscape(payment.tytul)}</b><br><span style="color:#374151">${htmlEscape(payment.opis)}</span><br><span style="display:inline-block;margin-top:8px;color:#111827;font-weight:800">${htmlEscape(payment.meta)}</span>`;
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
                ${admin ? htmlKartaEmail('Klient', `<b>${htmlEscape(nazwaKlientaEmail(z))}</b>${email ? `<br>${htmlEscape(email)}` : ''}${telefon ? `<br>${htmlEscape(telefon)}` : ''}`, '#7c3aed') : ''}
                ${htmlKartaEmail('Płatność', paymentBody, '#f59e0b')}
                ${htmlKartaEmail('Dostawa', shippingBody, '#10b981')}
                <h2 style="font-size:18px;margin:22px 0 10px;color:#111827">Produkty w zamówieniu</h2>
                ${htmlProduktyEmail(z)}
                <div style="text-align:right;margin:14px 0 22px;font-size:20px;font-weight:900;color:#111827">Suma: ${htmlEscape(zlSerwer(z?.razem))}</div>
                ${z?.uwagi ? htmlKartaEmail('Uwagi do zamówienia', htmlEscape(z.uwagi), '#64748b') : ''}
                <div style="background:#f8fafc;border-radius:18px;padding:18px;margin:20px 0">
                  <h3 style="margin:0 0 8px;font-size:17px;color:#111827">${admin ? 'Co dalej w obsłudze?' : 'Co dalej?'}</h3>
                  <p style="margin:0;color:#374151;line-height:1.6">${admin
                    ? 'Sprawdź płatność, przygotuj paczkę, wygeneruj etykietę i aktualizuj status zamówienia. Klient dostanie kolejne informacje automatycznie.'
                    : 'Przyjęliśmy zamówienie. Będziemy informować o kolejnych etapach realizacji. W każdej chwili możesz wrócić do sklepu, sprawdzić szczegóły lub dobrać kolejne produkty do zestawu.'}</p>
                </div>
                <div style="margin:22px 0 8px">${ctaHtml}${admin ? emailButton('Otwórz zamówienie w panelu', adminUrl, '#111827') : emailButton('Wróć do sklepu', sklepUrl, '#111827')}</div>
                ${!admin ? `<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:18px 0 0">Dziękujemy za zaufanie. Życzymy dobrego dnia i udanych zakupów w Artway-TM.</p>` : ''}
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
      if (i >= 0) items[i] = zam; else items.unshift(zam);
      await zapisz('orders', { items, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, stored: true, number: zam.nr });
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
