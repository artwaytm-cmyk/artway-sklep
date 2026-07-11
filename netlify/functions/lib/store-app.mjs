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
  'artway_dostepnosc',
  'artway_ruchy_magazynowe',
  'artway_magazyn_ustawienia',
  'artway_magazyn_produkty',
  'artway_magazyn_lokalizacje',
  'artway_faktury_szkice',
  'artway_agent_ai_historia',
  'artway_agent_ai_pamiec',
  'artway_agent_ai_zlecenia',
  'artway_agent_ai_linki_producentow',
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
function allegroKonfiguracja(req) {
  const env = allegroEnv();
  const clientId = tekst(process.env.ALLEGRO_CLIENT_ID || '', 300).trim();
  const clientSecret = tekst(process.env.ALLEGRO_CLIENT_SECRET || '', 500).trim();
  const redirectUri = tekst(process.env.ALLEGRO_REDIRECT_URI || '', 1000).trim() || `${publicznyOrigin(req)}/api/store?action=allegro-callback`;
  const scope = tekst(process.env.ALLEGRO_SCOPE || '', 1000).trim();
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
async function allegroWywolaj(req, path, { method = 'GET', parameters = {}, bodyObj = null } = {}) {
  const c = allegroKonfiguracja(req);
  const token = await allegroAccessToken(req);
  const apiUrl = new URL(path, c.apiBaseUrl);
  for (const [k, v] of Object.entries(parameters || {})) if (v !== undefined && v !== null && v !== '') apiUrl.searchParams.set(k, String(v));
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.allegro.public.v1+json',
    'Accept-Language': 'pl-PL',
    'User-Agent': 'Artway-TM/1.0 Netlify Function',
  };
  const body = bodyObj === null ? undefined : JSON.stringify(bodyObj);
  if (body) headers['Content-Type'] = 'application/vnd.allegro.public.v1+json';
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
  return dane;
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
  return tekst(parts.join('\n\n'), 5000);
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
function allegroZamowienieDoObslugi(z) {
  const vals = [
    z?.status,
    z?.fulfillmentStatus,
    z?.deliveryStatus,
    z?.shipmentStatus,
    z?.statusDetails,
  ].map((x) => String(x || '').trim().toUpperCase()).filter(Boolean);
  const joined = vals.join(' ');
  if (!vals.length) return true;
  if (/\b(CANCELLED|CANCELED|ANUL|SENT|SHIPPED|DELIVERED|DONE|COMPLETED|REALIZED|ZREALIZ|RETURNED)\b/.test(joined)) return false;
  if (/\bREADY_FOR_PROCESSING|NEW|PROCESSING|READY_FOR_SHIPMENT|BOUGHT|FILLED_IN\b/.test(joined)) return true;
  return true;
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
    total: allegroKwotaText(z.summary?.totalToPay || z.summary?.totalPrice || z.totalToPay),
    invoiceRequired: !!invoice.required,
    lineItems,
    rawUpdatedAt: new Date().toISOString(),
  };
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
function allegroMapowaniaItems(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return raw.items && typeof raw.items === 'object' ? raw.items : raw;
}
async function allegroPobierzSzczegolyOfert(req, source, limit) {
  const out = [];
  const base = source.slice(0, limit);
  const batchSize = 8;
  for (let i = 0; i < base.length; i += batchSize) {
    const batch = base.slice(i, i + batchSize);
    const details = await Promise.all(batch.map(async (o) => {
      const id = tekst(o.id, 100);
      if (!id) return o;
      try {
        return await allegroWywolaj(req, `/sale/offers/${encodeURIComponent(id)}`);
      } catch (e) {
        return o;
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
  const niedostepny = statusNiedostepny || (!statusDostepny && /powiadom o dostępności|niedostępny|brak produktu|chwilowo niedostęp/i.test(text));
  const dostepny = statusDostepny || (!niedostepny && /produkt dostępny|\bdostępny\b|in stock|instock/i.test(text));
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
      parametryProducenta: parametry,
    },
    availability: { available: dostepny, text: statusHtml || (dostepny ? 'Produkt dostępny' : (niedostepny ? 'Niedostępny' : 'Do sprawdzenia')) },
  };
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
async function allegroDraftZAutoKategoria(req, product = {}, opt = {}) {
  const options = { ...(opt || {}) };
  let categorySuggestion = null;
  if (!allegroMaKategorie(product, options)) {
    categorySuggestion = await allegroSugerujKategorie(req, product, { limit: 8 });
    if (categorySuggestion?.selected?.id) options.categoryId = categorySuggestion.selected.id;
  }
  const draft = allegroDraftZProduktu(product, options);
  return { ...draft, categorySuggestion };
}
function allegroDraftZProduktu(product = {}, opt = {}) {
  const p = product || {};
  const categoryId = tekst(opt.categoryId || p.allegroCategoryId || p.categoryId || '', 80).trim();
  const images = [p.zdjecie, ...(Array.isArray(p.zdjecia) ? p.zdjecia : [])].filter(Boolean).slice(0, 16);
  const externalId = tekst(p.externalId || p.sku || p.kodProducenta || p.mpn || p.id || '', 120).trim();
  const parameters = [];
  if (p.gtin || p.ean) parameters.push({ name: 'EAN', values: [tekst(p.gtin || p.ean, 80)] });
  if (p.kodProducenta || p.mpn) parameters.push({ name: 'Kod producenta', values: [tekst(p.kodProducenta || p.mpn, 120)] });
  if (p.marka) parameters.push({ name: 'Marka', values: [tekst(p.marka, 120)] });
  const payload = {
    name: tekst(p.nazwa || p.name, 75).trim(),
    category: categoryId ? { id: categoryId } : undefined,
    productSet: [{
      product: {
        id: tekst(p.allegroProductId || '', 120).trim() || undefined,
        name: tekst(p.nazwa || p.name, 75).trim(),
        category: categoryId ? { id: categoryId } : undefined,
        parameters,
      },
    }],
    sellingMode: {
      format: 'BUY_NOW',
      price: { amount: String(Number(p.cena || p.price || 0).toFixed(2)), currency: 'PLN' },
    },
    stock: { available: Math.max(0, Number(opt.stock ?? p.stan ?? 1) || 1) },
    publication: { status: opt.publishNow ? 'ACTIVE' : 'INACTIVE' },
    external: externalId ? { id: externalId } : undefined,
    images: images.map((url) => ({ url: tekst(url, 1000) })),
    description: {
      sections: [{ items: [{ type: 'TEXT', content: `<p>${htmlEscape(tekst(p.opis || p.opisKrotki || '', 12000)).replace(/\n/g, '<br>')}</p>` }] }],
    },
  };
  const missing = [];
  if (!payload.name) missing.push('nazwa');
  if (!categoryId) missing.push('allegroCategoryId');
  if (!Number(p.cena || p.price || 0)) missing.push('cena');
  if (!images.length) missing.push('zdjęcia');
  if (!(p.gtin || p.ean)) missing.push('EAN/GTIN');
  return { payload: JSON.parse(JSON.stringify(payload)), missing };
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
        inpost: inpostPublicConfig(),
        allegro: await allegroStatus(req),
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

    // ─── ALLEGRO: stan integracji i dane zapisane w backendzie (admin) ───
    if (action === 'allegro-data') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const orders = await czytaj('allegro_orders', { items: [], updated_at: null });
      const offers = await czytaj('allegro_offers', { items: [], updated_at: null });
      const mappings = await czytaj('allegro_mappings', { items: {}, updated_at: null });
      const status = await allegroStatus(req);
      return odpowiedz({
        ok: true,
        allegro: { ...status, updated_at: orders.updated_at || offers.updated_at || status.updated_at || null },
        orders: Array.isArray(orders.items) ? orders.items : [],
        offers: Array.isArray(offers.items) ? offers.items : [],
        mappings: allegroMapowaniaItems(mappings),
      });
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
      return odpowiedzHtml('<h1>Allegro połączone</h1><p>Konto Allegro zostało autoryzowane dla panelu Artway-TM. Możesz wrócić do panelu i uruchomić synchronizację zamówień oraz ofert.</p><p><a href="/#/admin/allegro">Wróć do panelu Allegro</a></p>');
    }

    // ─── ALLEGRO: synchronizacja zamówień (admin) ───
    if (action === 'allegro-sync-orders') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const limit = Math.min(100, Math.max(1, Number(body.limit || url.searchParams.get('limit') || 100)));
      const statusy = ['READY_FOR_PROCESSING', 'FILLED_IN', 'BOUGHT'];
      const pobrane = [];
      for (const status of statusy) {
        if (pobrane.length >= limit) break;
        try {
          const dane = await allegroWywolaj(req, '/order/checkout-forms', { parameters: { limit: Math.min(100, limit), offset: 0, status } });
          const source = Array.isArray(dane.checkoutForms) ? dane.checkoutForms : (Array.isArray(dane.items) ? dane.items : []);
          pobrane.push(...source);
        } catch (e) {
          if (status === statusy[0]) {
            const dane = await allegroWywolaj(req, '/order/checkout-forms', { parameters: { limit, offset: 0 } });
            const source = Array.isArray(dane.checkoutForms) ? dane.checkoutForms : (Array.isArray(dane.items) ? dane.items : []);
            pobrane.push(...source);
            break;
          }
        }
      }
      const seen = new Set();
      const items = pobrane
        .map(allegroNormalizujZamowienie)
        .filter((x) => x.id && !seen.has(x.id) && seen.add(x.id))
        .filter(allegroZamowienieDoObslugi)
        .slice(0, limit);
      const rec = { items, updated_at: new Date().toISOString(), count: items.length, fetched: pobrane.length, filtered: pobrane.length - items.length, mode: 'unfulfilled_only' };
      await zapisz('allegro_orders', rec);
      return odpowiedz({ ok: true, allegro: await allegroStatus(req), orders: items, updated_at: rec.updated_at, fetched: rec.fetched, filtered: rec.filtered, mode: rec.mode });
    }

    // ─── ALLEGRO: synchronizacja ofert (admin) ───
    if (action === 'allegro-sync-offers') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const limit = Math.min(100, Math.max(1, Number(body.limit || url.searchParams.get('limit') || 100)));
      const details = body.details !== false && url.searchParams.get('details') !== '0';
      let dane;
      try {
        dane = await allegroWywolaj(req, '/sale/offers', { parameters: { limit, offset: 0, 'publication.status': 'ACTIVE' } });
      } catch (e) {
        dane = await allegroWywolaj(req, '/sale/offers', { parameters: { limit, offset: 0 } });
      }
      const source = Array.isArray(dane.offers) ? dane.offers : (Array.isArray(dane.items) ? dane.items : []);
      const pelne = details ? await allegroPobierzSzczegolyOfert(req, source, limit) : source;
      const items = pelne.map(allegroNormalizujOferte).filter((x) => x.id);
      const rec = { items, updated_at: new Date().toISOString(), count: items.length, details };
      await zapisz('allegro_offers', rec);
      const mappings = await czytaj('allegro_mappings', { items: {} });
      return odpowiedz({ ok: true, allegro: await allegroStatus(req), offers: items, mappings: allegroMapowaniaItems(mappings), updated_at: rec.updated_at });
    }

    // ─── ALLEGRO: szkic i wystawienie produktu sklepu jako oferty ───
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
      return odpowiedz({ ok: true, draft: draft.payload, missing: draft.missing, ready: draft.missing.length === 0, categorySuggestion: draft.categorySuggestion });
    }

    if (action === 'allegro-create-product-offer') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      let categorySuggestion = null;
      let draft = body.draft && typeof body.draft === 'object' ? body.draft : null;
      if (!draft) {
        const prepared = await allegroDraftZAutoKategoria(req, body.product || {}, body.options || {});
        categorySuggestion = prepared.categorySuggestion;
        if (prepared.missing.length) return odpowiedz({ ok: false, error: `Szkic wymaga uzupełnienia: ${prepared.missing.join(', ')}`, missing: prepared.missing, draft: prepared.payload, categorySuggestion }, 422);
        draft = prepared.payload;
      }
      const created = await allegroWywolaj(req, '/sale/product-offers', { method: 'POST', bodyObj: draft });
      return odpowiedz({ ok: true, offer: created, allegro: await allegroStatus(req), categorySuggestion }, 201);
    }

    // ─── PRODUCENT: pobranie danych z URL produktu (admin) ───
    if (action === 'product-url-inspect') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const target = tekst(body.url, 1000).trim();
      if (!/^https?:\/\//i.test(target)) return odpowiedz({ ok: false, error: 'Podaj pełny adres URL produktu' }, 422);
      const r = await fetch(target, {
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'pl-PL,pl;q=0.9,en;q=0.6',
        },
      });
      const html = await r.text();
      if (!r.ok || !html) return odpowiedz({ ok: false, error: `Nie udało się pobrać strony producenta (${r.status})` }, 502);
      return odpowiedz(parsujProduktZHtml(r.url || target, html));
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
      items[offerId] = { offerId, productId, linked_at: new Date().toISOString(), operator: 'admin' };
      await zapisz('allegro_mappings', { items, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, mappings: items });
    }

    if (action === 'allegro-unmap-offer') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const offerId = tekst(body.offerId, 100).trim();
      if (!offerId) return odpowiedz({ ok: false, error: 'Brak offerId' }, 422);
      const rec = await czytaj('allegro_mappings', { items: {} });
      const items = allegroMapowaniaItems(rec);
      delete items[offerId];
      await zapisz('allegro_mappings', { items, updated_at: new Date().toISOString() });
      return odpowiedz({ ok: true, mappings: items });
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
    return odpowiedz(body, status);
  }
};
