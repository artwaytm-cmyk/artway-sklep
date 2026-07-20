import { tekst } from './core/http.mjs';
import { inpostWebhookSecret, inpostWebhookAutoryzowany, pierwszePole, inpostZdarzeniaZWebhooka, numerZReferencji, etapZInpostStatus, znajdzZamowienieInpost } from './inpost-webhook-support.mjs';

export function createInpostService({ read, write, onOrderStatusTransition }) {
  const czytaj = read;
  const zapisz = write;
  const obsluzEmailePrzejsciaStatusu = onOrderStatusTransition;
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
    const inventory = await storeOrderSupplierReconciliation.finalizeInventoryForOrder(nowy);
    if (inventory.inventoryMode) nowy.inventoryMode = inventory.inventoryMode;
    const supplierDrafts = await storeOrderSupplierReconciliation.reconcileDraftsSafely({ summary: true });
    let email = null;
    try { email = await obsluzEmailePrzejsciaStatusu(stary, nowy); } catch (e) { email = { sent: false, error: e.message }; }
    await zapiszLogInpostWebhook({ matched: true, nr: nowy.nr, id: dane.id, tracking: dane.tracking, status: dane.status, reference: dane.reference });
    return { matched: true, nr: nowy.nr, tracking: w.numer || '', status: w.inpostStatus || '', etap: w.etap || '', inventory, supplierDrafts, email };
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
  

  return {
    inpostKonfiguracja,
    inpostPublicConfig,
    inpostWywolaj,
    inpostSzukajPunktow,
    czyDostawaPaczkomatInPost,
    walidujPrzesylkeInPost,
    inpostDostepnoscUslug,
    inpostOrganizacja,
    przesylkaShipXPayload,
    numerZShipX,
    inpostStatusZShipX,
    inpostEtykietaGotowa,
    inpostOfertaId,
    inpostCzekajNaEtykiete,
    inpostWebhookSecret,
    inpostWebhookAutoryzowany,
    inpostZdarzeniaZWebhooka,
    inpostDaneZWebhooka,
    zapiszLogInpostWebhook,
    zastosujWebhookInpost,
    zapiszPrzesylkeNaZamowieniu,
  };
}
