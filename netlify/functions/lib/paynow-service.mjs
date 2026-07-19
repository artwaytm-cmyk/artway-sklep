import crypto from 'node:crypto';
import { tekst } from './core/http.mjs';

const PAYNOW_ENVY = new Set(['production', 'sandbox']);

export function createPaynowService({ read, write }) {
  const czytaj = read;
  const zapisz = write;
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
  

  return {
    publicznyOrigin,
    paynowKonfiguracja,
    podpisPaynowPowiadomienia,
    porownajPodpis,
    kluczIdempotencji,
    grosze,
    statusPlatnosciPaynow,
    paynowWywolaj,
    payloadPlatnosciPaynow,
    aktualizujZamowieniePaynow,
  };
}
