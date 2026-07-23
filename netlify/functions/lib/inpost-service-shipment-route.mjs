import crypto from 'node:crypto';
import {
  inpostServiceBillingKey,
  inpostServiceDefaultSettings,
  inpostServiceInvoicePayload,
  inpostServicePickupPayload,
  inpostServiceShipxPayload,
  normalizeInpostServiceDraft,
  safeInpostServiceRecord,
  summarizeInpostServiceBilling,
  validateInpostServiceDraft,
} from './domain/inpost-service-shipment.mjs';

const STORE_KEY = 'inpost_service_shipments';

function initialStore() {
  return { items: [], settings: inpostServiceDefaultSettings(), updatedAt: null };
}

function cleanStore(value = {}) {
  return {
    ...value,
    items: Array.isArray(value?.items) ? value.items : [],
    settings: { ...inpostServiceDefaultSettings(), ...(value?.settings || {}) },
  };
}

export function createInpostServiceShipmentRoute(deps = {}) {
  const {
    respond, isAdmin, text, readVersioned, writeIfVersion, publicConfig, configure,
    call, serviceAvailability, organization, waitForLabel, trackingNumber,
    shipmentStatus, labelReady, offerId, infaktPublicConfig, infaktCall,
    infaktReference,
  } = deps;

  async function mutateStore(mutator) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const version = await readVersioned(STORE_KEY, initialStore());
      const current = cleanStore(version.value), next = await mutator(structuredClone(current));
      if (!next) return current;
      next.updatedAt = new Date().toISOString();
      const result = await writeIfVersion(STORE_KEY, next, version);
      if (result?.modified) return next;
    }
    const error = new Error('Rejestr nadań zmienił się w trakcie operacji. Ponów próbę.');
    error.code = 'shipping_write_conflict'; error.status = 409; throw error;
  }

  async function updateRecord(id, updater) {
    let updated = null;
    await mutateStore((store) => {
      const index = store.items.findIndex((item) => item.id === id);
      if (index < 0) return null;
      store.items[index] = updated = updater({ ...store.items[index] });
      return store;
    });
    return updated;
  }

  async function activeServices(config) {
    try {
      const org = await organization(config);
      return serviceAvailability(config, org);
    } catch {
      return {
        services: [],
        locker: true,
        courier: true,
        lockerService: config.lockerService,
        courierService: config.courierService,
      };
    }
  }

  async function saveInvoiceLink(key, link) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const version = await readVersioned('infakt_invoice_links', { items: {}, updated_at: null });
      const current = version.value && typeof version.value === 'object' ? version.value : { items: {}, updated_at: null };
      const next = { ...current, items: { ...(current.items || {}), [key]: link }, updated_at: new Date().toISOString() };
      const result = await writeIfVersion('infakt_invoice_links', next, version);
      if (result?.modified) return next;
    }
    const error = new Error('Rejestr faktur zmienił się podczas zapisu.');
    error.code = 'infakt_write_conflict'; error.status = 409; throw error;
  }

  async function createInvoice(records, invoiceDate = '') {
    const billingKey = inpostServiceBillingKey(records[0]);
    const linksVersion = await readVersioned('infakt_invoice_links', { items: {}, updated_at: null });
    const existing = linksVersion.value?.items?.[billingKey];
    if (existing && !['error', 'cancelled'].includes(String(existing.status || '').toLowerCase())) return { link: existing, duplicatePrevented: true };
    if (!infaktPublicConfig().configured) {
      const error = new Error('inFakt nie jest skonfigurowany po stronie serwera.');
      error.code = 'infakt_not_configured'; error.status = 503; throw error;
    }
    const payload = inpostServiceInvoicePayload(records, { invoiceDate });
    const task = await infaktCall('/api/v3/async/invoices.json', { method: 'POST', bodyObj: payload });
    const reference = infaktReference(task), now = new Date().toISOString();
    if (!reference) {
      const error = new Error('inFakt nie zwrócił referencji zadania faktury.');
      error.code = 'infakt_missing_reference'; error.status = 502; throw error;
    }
    const link = {
      orderNumber: billingKey,
      source: 'inpost-service',
      recordIds: records.map((record) => record.id),
      taskReference: reference,
      status: 'processing',
      processingCode: task.processing_code || 100,
      processingDescription: text(task.processing_description || 'Zlecenie przyjęte', 500),
      createdAt: now,
      updatedAt: now,
      sendToKsef: false,
      payloadHash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    };
    await saveInvoiceLink(billingKey, link);
    await mutateStore((store) => {
      const ids = new Set(records.map((record) => record.id));
      store.items = store.items.map((record) => ids.has(record.id) ? {
        ...record,
        billing: { ...record.billing, status: 'processing', billingKey, taskReference: reference, updatedAt: now, error: '' },
      } : record);
      return store;
    });
    return { link, duplicatePrevented: false };
  }

  async function createPickup(record, config) {
    const response = await call(`/v1/organizations/${encodeURIComponent(config.orgId)}/dispatch_orders`, {
      method: 'POST',
      bodyObj: inpostServicePickupPayload(record),
    });
    return {
      id: text(response?.id, 80),
      status: text(response?.status || 'sent', 80),
      createdAt: text(response?.created_at || new Date().toISOString(), 120),
    };
  }

  return async function inpostServiceShipmentRoute(req, url, action) {
    if (!String(action || '').startsWith('inpost-service-')) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);

    if (action === 'inpost-service-shipments') {
      const store = cleanStore((await readVersioned(STORE_KEY, initialStore())).value);
      const links = (await readVersioned('infakt_invoice_links', { items: {} })).value?.items || {};
      const config = configure(), availability = config.configured ? await activeServices(config) : null;
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 200) || 200));
      const items = store.items.slice(-limit).reverse().map((record) => {
        const key = record.billing?.billingKey || inpostServiceBillingKey(record);
        return safeInpostServiceRecord({ ...record, billing: { ...(record.billing || {}), link: links[key] || null } });
      });
      return respond({
        ok: true,
        config: publicConfig(),
        serviceAvailability: availability,
        settings: store.settings,
        items,
        billing: summarizeInpostServiceBilling(store.items),
        updatedAt: store.updatedAt,
      });
    }

    if (action === 'inpost-service-settings') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({}));
      const commission = Math.max(0, Math.min(10_000, Math.round(Number(String(body.commissionGross ?? 4).replace(',', '.')) * 100) / 100));
      const store = await mutateStore((current) => {
        current.settings = {
          ...current.settings,
          commissionGross: Number.isFinite(commission) ? commission : 4,
          sender: body.sender && typeof body.sender === 'object' ? body.sender : current.settings.sender,
          updatedAt: new Date().toISOString(),
        };
        return current;
      });
      return respond({ ok: true, settings: store.settings });
    }

    if (action === 'inpost-service-create') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const config = configure();
      if (!config.configured) return respond({ ok: false, configured: false, error: 'InPost nie jest skonfigurowany po stronie serwera.', code: 'inpost_not_configured' }, 503);
      const body = await req.json().catch(() => ({})), storeVersion = await readVersioned(STORE_KEY, initialStore()), store = cleanStore(storeVersion.value);
      const requestId = text(body.requestId, 100);
      const duplicate = store.items.find((record) => record.requestId && record.requestId === requestId);
      if (duplicate) {
        const failed = duplicate.status === 'error', creating = duplicate.status === 'creating';
        return respond({
          ok: !failed && !creating,
          duplicatePrevented: true,
          item: safeInpostServiceRecord(duplicate),
          code: failed ? 'previous_attempt_failed' : creating ? 'shipment_in_progress' : undefined,
          error: failed ? 'Poprzednia próba tego nadania zakończyła się błędem. Formularz otrzyma nowy identyfikator — sprawdź dane i ponów.' : creating ? 'To nadanie jest już tworzone.' : undefined,
        }, failed || creating ? 409 : 200);
      }
      const availability = await activeServices(config);
      const draft = normalizeInpostServiceDraft(body, store.settings, availability);
      const validation = validateInpostServiceDraft(draft);
      if (!validation.ok) return respond({ ok: false, error: 'Uzupełnij dane nadania.', code: 'inpost_service_validation', details: validation.errors }, 422);
      if (availability.services?.length && availability[draft.deliveryType] !== true) return respond({ ok: false, error: `Konto InPost nie ma aktywnej usługi ${draft.service}.`, code: 'inpost_service_unavailable', service: draft.service }, 422);
      const id = `IPS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, now = new Date().toISOString();
      const record = {
        id,
        requestId: draft.requestId,
        reference: draft.reference || id,
        createdAt: now,
        updatedAt: now,
        status: 'creating',
        inpostId: '',
        trackingNumber: '',
        inpostStatus: '',
        labelReady: false,
        offerId: '',
        sender: draft.sender,
        receiver: draft.receiver,
        deliveryType: draft.deliveryType,
        service: draft.service,
        sendingMethod: draft.sendingMethod,
        targetPoint: draft.targetPoint,
        dropoffPoint: draft.dropoffPoint,
        parcel: draft.parcel,
        cod: draft.cod,
        insurance: draft.insurance,
        weekend: draft.weekend,
        additionalServices: draft.additionalServices,
        pickupRequested: draft.pickupRequested,
        pickup: null,
        billing: { ...draft.billing, status: draft.billing.mode === 'monthly' ? 'pending' : draft.billing.mode === 'single' ? 'awaiting_invoice' : 'not_required', error: '' },
        error: '',
      };
      let concurrentDuplicate = null;
      await mutateStore((current) => {
        concurrentDuplicate = current.items.find((item) => item.requestId && item.requestId === requestId) || null;
        if (concurrentDuplicate) return null;
        current.items.push(record); current.items = current.items.slice(-5000); return current;
      });
      if (concurrentDuplicate) {
        const failed = concurrentDuplicate.status === 'error', creating = concurrentDuplicate.status === 'creating';
        return respond({
          ok: !failed && !creating,
          duplicatePrevented: true,
          item: safeInpostServiceRecord(concurrentDuplicate),
          code: failed ? 'previous_attempt_failed' : creating ? 'shipment_in_progress' : undefined,
          error: failed ? 'Poprzednia próba tego nadania zakończyła się błędem. Formularz otrzyma nowy identyfikator — sprawdź dane i ponów.' : creating ? 'To nadanie jest już tworzone.' : undefined,
        }, failed || creating ? 409 : 200);
      }
      let saved = record;
      try {
        const created = await call(`/v1/organizations/${encodeURIComponent(config.orgId)}/shipments`, { method: 'POST', bodyObj: inpostServiceShipxPayload(draft) });
        const shipmentId = text(created?.id, 80), current = shipmentId ? await waitForLabel(shipmentId, { proby: 10, opoznienieMs: 1100 }).catch(() => created) : created;
        saved = await updateRecord(id, (item) => ({
          ...item,
          status: labelReady(current) || labelReady(created) ? 'label_ready' : 'created',
          inpostId: shipmentId,
          trackingNumber: trackingNumber(current) || trackingNumber(created),
          inpostStatus: shipmentStatus(current) || shipmentStatus(created),
          labelReady: labelReady(current) || labelReady(created),
          offerId: offerId(current) || offerId(created),
          updatedAt: new Date().toISOString(),
          error: '',
        }));
        if (saved.pickupRequested && saved.labelReady) {
          try {
            const pickup = await createPickup(saved, config);
            saved = await updateRecord(id, (item) => ({ ...item, pickup, updatedAt: new Date().toISOString() }));
          } catch (error) {
            saved = await updateRecord(id, (item) => ({ ...item, pickup: { status: 'error', error: text(error.message, 500) }, updatedAt: new Date().toISOString() }));
          }
        }
        let invoice = null;
        if (saved.billing.mode === 'single') {
          try { invoice = await createInvoice([saved], body.invoiceDate); }
          catch (error) {
            saved = await updateRecord(id, (item) => ({ ...item, billing: { ...item.billing, status: 'error', error: text(error.message, 500) }, updatedAt: new Date().toISOString() }));
            invoice = { error: text(error.message, 500), code: error.code || 'infakt_error' };
          }
        }
        return respond({ ok: true, configured: true, item: safeInpostServiceRecord(saved), invoice }, 201);
      } catch (error) {
        saved = await updateRecord(id, (item) => ({ ...item, status: 'error', error: text(error.message, 700), updatedAt: new Date().toISOString() }));
        error.record = safeInpostServiceRecord(saved); throw error;
      }
    }

    if (action === 'inpost-service-status') {
      const id = text(url.searchParams.get('id'), 100), config = configure();
      const store = cleanStore((await readVersioned(STORE_KEY, initialStore())).value), record = store.items.find((item) => item.id === id);
      if (!record) return respond({ ok: false, error: 'Nie znaleziono nadania.', code: 'not_found' }, 404);
      if (!record.inpostId) return respond({ ok: false, error: 'Nadanie nie ma jeszcze ID InPost.', code: 'no_shipment' }, 422);
      const shipment = await call(`/v1/shipments/${encodeURIComponent(record.inpostId)}`, { method: 'GET' });
      const saved = await updateRecord(id, (item) => ({
        ...item,
        status: labelReady(shipment) ? 'label_ready' : item.status,
        trackingNumber: trackingNumber(shipment) || item.trackingNumber,
        inpostStatus: shipmentStatus(shipment) || item.inpostStatus,
        labelReady: labelReady(shipment),
        offerId: offerId(shipment) || item.offerId,
        updatedAt: new Date().toISOString(),
      }));
      return respond({ ok: true, configured: config.configured, item: safeInpostServiceRecord(saved) });
    }

    if (action === 'inpost-service-pickup') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), id = text(body.id, 100), config = configure();
      const store = cleanStore((await readVersioned(STORE_KEY, initialStore())).value), record = store.items.find((item) => item.id === id);
      if (!record?.inpostId) return respond({ ok: false, error: 'Najpierw utwórz i potwierdź przesyłkę.', code: 'no_shipment' }, 422);
      if (record.pickup?.id) return respond({ ok: true, duplicatePrevented: true, item: safeInpostServiceRecord(record) });
      const shipment = await call(`/v1/shipments/${encodeURIComponent(record.inpostId)}`, { method: 'GET' });
      if (shipmentStatus(shipment) !== 'confirmed') return respond({ ok: false, error: 'Odbiór kuriera można zlecić po potwierdzeniu przesyłki w InPost.', code: 'shipment_not_confirmed', status: shipmentStatus(shipment) }, 409);
      const pickup = await createPickup(record, config);
      const saved = await updateRecord(id, (item) => ({ ...item, pickupRequested: true, pickup, updatedAt: new Date().toISOString() }));
      return respond({ ok: true, item: safeInpostServiceRecord(saved) }, 201);
    }

    if (action === 'inpost-service-cancel') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), id = text(body.id, 100);
      const store = cleanStore((await readVersioned(STORE_KEY, initialStore())).value), record = store.items.find((item) => item.id === id);
      if (!record?.inpostId) return respond({ ok: false, error: 'Nie znaleziono przesyłki InPost.', code: 'no_shipment' }, 422);
      await call(`/v1/shipments/${encodeURIComponent(record.inpostId)}`, { method: 'DELETE' });
      const saved = await updateRecord(id, (item) => ({ ...item, status: 'cancelled', inpostStatus: 'cancelled', updatedAt: new Date().toISOString() }));
      return respond({ ok: true, item: safeInpostServiceRecord(saved) });
    }

    if (action === 'inpost-service-bill') {
      if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
      const body = await req.json().catch(() => ({})), store = cleanStore((await readVersioned(STORE_KEY, initialStore())).value);
      let records = [];
      if (body.id) records = store.items.filter((record) => record.id === text(body.id, 100) && record.status !== 'cancelled');
      else {
        const month = text(body.month, 7), clientKey = text(body.clientKey, 200).toLowerCase();
        records = store.items.filter((record) => record.status !== 'cancelled' && record.billing?.mode === 'monthly' && record.billing?.status === 'pending' && record.billing?.month === month && String(record.billing?.clientKey || '').toLowerCase() === clientKey);
      }
      if (!records.length) return respond({ ok: false, error: 'Brak nierozliczonych nadań dla wybranego klienta i okresu.', code: 'not_found' }, 404);
      const invoice = await createInvoice(records, body.invoiceDate);
      return respond({ ok: true, count: records.length, invoice }, invoice.duplicatePrevented ? 200 : 201);
    }

    return null;
  };
}
