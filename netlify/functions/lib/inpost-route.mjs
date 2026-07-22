export function createInpostRoute(deps = {}) {
  const {
    respond, isAdmin, text, read, write, orderNumber, onOrderStatusTransition,
    publicConfig, configure, call, searchPoints, isLockerDelivery, validateShipment,
    serviceAvailability, organization, shipmentPayload, trackingNumber, shipmentStatus,
    labelReady, offerId, waitForLabel, webhookSecret, webhookAuthorized, webhookEvents,
    webhookData, writeWebhookLog, applyWebhook, saveShipmentOnOrder,
  } = deps;
  return async function inpostRoute(req, url, action) {
    // ─── INPOST: konfiguracja (publiczny token Geowidget + status) ───
    if (action === 'inpost-config') {
      return respond({ ok: true, inpost: publicConfig() });
    }

    // ─── INPOST: publiczne wyszukiwanie paczkomatów / punktów odbioru dla checkoutu ───
    if (action === 'inpost-points') {
      const dane = await searchPoints(url);
      return respond(dane, dane.ok === false ? 400 : 200);
    }

    // ─── INPOST: webhook z Managera Paczek / ShipX → obsługa zleceń i tracking ───
    if (action === 'inpost-webhook') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!webhookSecret()) return respond({ ok: false, error: 'Brak INPOST_WEBHOOK_SECRET w Netlify.', code: 'webhook_not_configured' }, 503);
      if (!webhookAuthorized(req, url)) return respond({ ok: false, error: 'Nieprawidłowy token webhooka', code: 'auth' }, 401);
      const rawBody = await req.text();
      let payload = {};
      try { payload = JSON.parse(rawBody || '{}'); } catch (e) { return respond({ ok: false, error: 'Webhook InPost nie przesłał poprawnego JSON', code: 'invalid_json' }, 400); }
      const c = configure();
      const wyniki = [];
      for (const event of webhookEvents(payload)) {
        let dane = webhookData(event);
        let shipment = null;
        if (c.configured && dane.id) {
          try {
            shipment = await call(`/v1/shipments/${encodeURIComponent(dane.id)}`, { method: 'GET' });
            dane = webhookData(event, shipment);
          } catch (e) {
            // Sam webhook nadal zapisujemy — pełne dane ShipX mogą być chwilowo niedostępne.
          }
        }
        if (!dane.id && !dane.tracking && !dane.reference && !dane.status) continue;
        wyniki.push(await applyWebhook(dane));
      }
      if (!wyniki.length) {
        await writeWebhookLog({ matched: false, status: 'empty_payload' });
      }
      return respond({ ok: true, accepted: true, processed: wyniki.length, results: wyniki }, 202);
    }

    // ─── INPOST: realny test tokenu i organizacji ShipX (admin) ───
    if (action === 'inpost-test') {
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = configure();
      if (!c.configured) {
        return respond({
          ok: false,
          configured: false,
          code: 'inpost_not_configured',
          error: 'InPost nie jest skonfigurowany. Ustaw brakujące zmienne Netlify.',
          missingEnv: c.missingEnv,
          inpost: publicConfig(),
        }, 503);
      }
      const org = await organization(c);
      const availability = serviceAvailability(c, org);
      const checkedAt = new Date().toISOString();
      await write('integration_health', { ...(await read('integration_health', {})), inpost: { authenticated: true, checkedAt, env: c.env, organizationId: text(org?.id || c.orgId, 40), locker: availability.locker === true, courier: availability.courier === true, error: '', code: '' }, updated_at: checkedAt });
      return respond({
        ok: true,
        configured: true,
        inpost: {
          ...publicConfig(),
          authenticated: true,
          lastCheckedAt: checkedAt,
          serviceAvailability: availability,
          organization: {
            id: text(org?.id || c.orgId, 40),
            name: text(org?.name || '', 160),
            services: availability.services,
          },
        },
      });
    }

    // ─── INPOST: utworzenie przesyłki ShipX (admin) ───
    if (action === 'inpost-create') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = configure();
      if (!c.configured) return respond({ ok: false, configured: false, error: 'InPost nie jest skonfigurowany. Ustaw INPOST_TOKEN i INPOST_ORG_ID w Netlify.', code: 'inpost_not_configured' }, 503);
      const body = await req.json().catch(() => ({}));
      const nr = orderNumber(body.nr || body.number);
      if (!nr) return respond({ ok: false, error: 'Brak numeru zamówienia' }, 422);
      const rec = await read('orders', { items: [] });
      const z = (Array.isArray(rec.items) ? rec.items : []).find((x) => x.nr === nr);
      if (!z) return respond({ ok: false, error: 'Nie znaleziono zamówienia', code: 'not_found' }, 404);
      if (z?.wysylka?.inpostId) return respond({ ok: false, error: `Przesyłka InPost już istnieje (${z.wysylka.inpostId}).`, code: 'exists', inpostId: z.wysylka.inpostId }, 409);
      const doPaczkomatu = isLockerDelivery(z);
      if (doPaczkomatu && !text(z?.paczkomat || z?.wysylka?.punktKod, 40).trim()) return respond({ ok: false, error: 'Brak wybranego paczkomatu w zamówieniu — uzupełnij punkt InPost przed wygenerowaniem etykiety.', code: 'no_point' }, 422);
      const walidacja = validateShipment(z);
      if (!walidacja.ok) {
        return respond({
          ok: false,
          error: 'Nie można utworzyć przesyłki InPost — uzupełnij dane zamówienia.',
          code: 'inpost_validation',
          details: walidacja.errors,
        }, 422);
      }
      let availability = null;
      try {
        const org = await organization(c);
        availability = serviceAvailability(c, org);
      } catch (e) {
        availability = null;
      }
      if (availability?.services?.length) {
        const wymaganyTyp = walidacja.doPaczkomatu ? 'locker' : 'courier';
        const service = walidacja.doPaczkomatu ? availability.lockerService : availability.courierService;
        if (!availability[wymaganyTyp]) {
          return respond({
            ok: false,
            error: `Konto InPost nie ma aktywnej usługi ${service}. Włącz tę usługę w Managerze Paczek.`,
            code: 'inpost_service_unavailable',
            service,
            serviceAvailability: availability,
          }, 422);
        }
      }
      const aktywneUslugi = availability ? { ...c, lockerService: availability.lockerService || c.lockerService, courierService: availability.courierService || c.courierService } : c;
      const payload = shipmentPayload(z, aktywneUslugi, walidacja);
      const dane = await call(`/v1/organizations/${encodeURIComponent(c.orgId)}/shipments`, { method: 'POST', bodyObj: payload });
      const inpostId = text(dane?.id, 60).trim();
      let daneAktualne = dane;
      if (inpostId) {
        try { daneAktualne = await waitForLabel(inpostId, { proby: 10, opoznienieMs: 1100 }); } catch (e) { daneAktualne = dane; }
      }
      const numer = trackingNumber(daneAktualne) || trackingNumber(dane);
      const statusShipX = shipmentStatus(daneAktualne) || shipmentStatus(dane);
      const labelReady = labelReady(daneAktualne) || labelReady(dane);
      const ofertaId = offerId(daneAktualne) || offerId(dane);
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
      const { stary, nowy } = await saveShipmentOnOrder(nr, patch);
      // jeśli od razu jest numer nadania → wyślij e-mail „nadanie"
      let email = null;
      if (numer && !trackingNumber({ tracking_number: stary?.wysylka?.numer })) {
        try { email = await onOrderStatusTransition({ ...stary, wysylka: { ...(stary?.wysylka || {}), numer: '' } }, nowy); } catch (e) { email = { sent: false, error: e.message }; }
      }
      return respond({ ok: true, configured: true, inpostId, trackingNumber: numer, status: statusShipX, labelReady, offerId: ofertaId, email, order: { nr, status: nowy?.status, wysylka: nowy?.wysylka } }, 201);
    }

    // ─── INPOST: pobranie oficjalnej etykiety PDF (admin) ───
    if (action === 'inpost-label') {
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = configure();
      if (!c.configured) return respond({ ok: false, configured: false, error: 'InPost nie jest skonfigurowany.', code: 'inpost_not_configured' }, 503);
      const nr = orderNumber(url.searchParams.get('nr'));
      let inpostId = text(url.searchParams.get('id'), 60).trim();
      const typ = text(url.searchParams.get('type'), 10).trim().toUpperCase() === 'A4' ? 'A4' : 'A6';
      if (!inpostId && nr) {
        const rec = await read('orders', { items: [] });
        const z = (rec.items || []).find((x) => x.nr === nr);
        inpostId = text(z?.wysylka?.inpostId, 60).trim();
      }
      if (!inpostId) return respond({ ok: false, error: 'Brak ID przesyłki InPost — najpierw utwórz przesyłkę.', code: 'no_shipment' }, 422);
      let daneAktualne = null;
      try { daneAktualne = await waitForLabel(inpostId, { proby: 6, opoznienieMs: 900 }); } catch (e) { daneAktualne = null; }
      const statusShipX = shipmentStatus(daneAktualne);
      const numer = trackingNumber(daneAktualne);
      const labelReady = labelReady(daneAktualne);
      if (!labelReady) {
        if (nr && daneAktualne) {
          const rec = await read('orders', { items: [] });
          const z = (rec.items || []).find((x) => x.nr === nr);
          if (z) {
            const stareH = Array.isArray(z?.wysylka?.historia) ? z.wysylka.historia : [];
            const teraz = new Date().toLocaleString('pl-PL');
            const historia = statusShipX && !stareH.some((h) => h.opis && h.opis.includes(statusShipX))
              ? [...stareH, { czas: teraz, status: 'Etykieta InPost jeszcze niedostępna', opis: statusShipX }]
              : stareH;
            await saveShipmentOnOrder(nr, {
              inpostStatus: statusShipX,
              numer: numer || z?.wysylka?.numer || '',
              etykietaGotowa: false,
              ostatniaSynchronizacja: new Date().toISOString(),
              zadania: { ...(z?.wysylka?.zadania || {}), dane: true, etykieta: false },
              historia,
            });
          }
        }
        return respond({
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
        const pdf = await call(`/v1/shipments/${encodeURIComponent(inpostId)}/label?format=pdf&type=${typ}`, { method: 'GET', accept: 'application/pdf' });
        return respond({ ok: true, format: 'pdf', type: typ, filename: `etykieta-inpost-${nr || inpostId}.pdf`, base64: pdf.base64, inpostId, status: statusShipX, trackingNumber: numer, labelReady: true });
      } catch (e) {
        if (e.code === 'invalid_action' || /invalid_action|statusie wcześniejszym niż|nieopłaconej/i.test(e.message || '')) {
          return respond({
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
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = configure();
      if (!c.configured) return respond({ ok: false, configured: false, error: 'InPost nie jest skonfigurowany.', code: 'inpost_not_configured' }, 503);
      const nr = orderNumber(url.searchParams.get('nr'));
      const rec = await read('orders', { items: [] });
      const z = (rec.items || []).find((x) => x.nr === nr);
      const inpostId = text(url.searchParams.get('id') || z?.wysylka?.inpostId, 60).trim();
      if (!inpostId) return respond({ ok: false, error: 'Brak ID przesyłki InPost.', code: 'no_shipment' }, 422);
      const dane = await call(`/v1/shipments/${encodeURIComponent(inpostId)}`, { method: 'GET' });
      const numer = trackingNumber(dane);
      const statusShipX = shipmentStatus(dane);
      const labelReady = labelReady(dane);
      const ofertaId = offerId(dane);
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
      const { stary, nowy } = await saveShipmentOnOrder(nr, patch);
      let email = null;
      if (numer && !(stary?.wysylka?.numer)) {
        try { email = await onOrderStatusTransition(stary, nowy); } catch (e) { email = { sent: false, error: e.message }; }
      }
      return respond({ ok: true, configured: true, inpostId, trackingNumber: numer, status: statusShipX, labelReady, offerId: ofertaId, email, order: { nr, wysylka: nowy?.wysylka } });
    }

    // ─── INPOST: automatyczne sprawdzenie statusów WSZYSTKICH przesyłek (admin / harmonogram co 6h) ───
    if (action === 'inpost-sync-all') {
      if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = configure();
      if (!c.configured) return respond({ ok: false, configured: false, error: 'InPost nie jest skonfigurowany.', code: 'inpost_not_configured' }, 503);
      const rec = await read('orders', { items: [] });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const zamkniete = ['dostarczone', 'zakończone', 'anulowane', 'zwrot', 'zwrot pieniędzy'];
      const doSync = items.filter((z) => text(z?.wysylka?.inpostId, 60).trim() && !zamkniete.includes(String(z?.status || '').toLowerCase()));
      let sprawdzone = 0, zmienione = 0, bledy = 0, maile = 0;
      const zmiany = [];
      for (const z of doSync.slice(0, 300)) {
        const inpostId = text(z.wysylka.inpostId, 60).trim();
        try {
          const dane = await call(`/v1/shipments/${encodeURIComponent(inpostId)}`, { method: 'GET' });
          sprawdzone++;
          const status = shipmentStatus(dane);
          const tracking = trackingNumber(dane);
          const statusStary = text(z?.wysylka?.inpostStatus, 60).trim();
          const trackingStary = text(z?.wysylka?.numer, 120).trim();
          const etykietaStara = !!z?.wysylka?.etykietaGotowa;
          const etykietaNowa = labelReady(dane);
          if ((status && status !== statusStary) || (tracking && tracking !== trackingStary) || (etykietaNowa && !etykietaStara)) {
            const r = await applyWebhook({ id: inpostId, status, tracking, reference: z.nr, occurredAt: new Date().toISOString() });
            if (r && r.matched) { zmienione++; if (r.email && r.email.sent) maile++; zmiany.push({ nr: z.nr, status, etap: r.etap }); }
          }
        } catch (e) { bledy++; }
      }
      return respond({ ok: true, configured: true, sprawdzone, zmienione, bledy, maile, zmiany, sprawdzono: new Date().toISOString() });
    }
    return null;
  };
}

