import { bezpiecznePorownanie, tekst } from './core/http.mjs';

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

export { inpostWebhookSecret, inpostWebhookAutoryzowany, pierwszePole, inpostZdarzeniaZWebhooka, numerZReferencji, etapZInpostStatus, znajdzZamowienieInpost };

