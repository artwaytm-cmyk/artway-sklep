import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approveSupplierPlanDraft,
  cancelSupplierPlanDraft,
  prepareSupplierPlanCorrection,
  receiveSupplierPlanDocument,
  receiveSupplierPlanLine,
  supplierLineIdentifiers,
  supplierLineStableKey,
  upsertSupplierPlanLine,
} from '../netlify/functions/lib/domain/supplier-order-plan.mjs';
import {
  createSupplierOrderPlanService,
  preserveSupplierPlanOnGenericSettings,
  resolveCanonicalSupplierContacts,
} from '../netlify/functions/lib/supplier-order-plan-service.mjs';

const NOW = new Date('2026-07-15T18:00:00.000Z');

function product(overrides = {}) {
  return {
    id: 1,
    externalId: 'ALEX-1748',
    sku: 'SKU-1748',
    kodProducenta: '1748',
    ean: '5901234567890',
    nazwa: 'Przeplatanki dla Chłopców',
    producent: 'Alexander',
    ...overrides,
  };
}

function draft(overrides = {}) {
  return {
    id: 'D-1', numer: 'AZ/2026/07/0001', supplier: 'Alexander', status: 'szkic', revision: 3,
    pozycje: [{
      produktId: '1', externalId: 'ALEX-1748', sku: 'SKU-1748', kodProducenta: '1748',
      ean: '5901234567890', kod: 'ALEX-1748', nazwa: 'Przeplatanki dla Chłopców',
      dostawca: 'Alexander', ilosc: 2, iloscPotrzebna: 2, manualExtra: 0, przyjeto: 0,
    }],
    ...overrides,
  };
}

const producerRecord = { id: 'producer-alexander', name: 'Alexander', orderEmail: 'server-orders@alexander.example', active: true };

function memoryRepository(initial) {
  let record = structuredClone(initial);
  let revision = 1;
  return {
    get record() { return structuredClone(record); },
    async readVersioned() { return { value: structuredClone(record), exists: true, etag: `v${revision}` }; },
    async writeIfVersion(_key, value, version) {
      if (version.etag !== `v${revision}`) return { modified: false };
      record = structuredClone(value);
      revision += 1;
      return { modified: true };
    },
  };
}

test('stabilny klucz i deduplikacja preferują EXTERNAL_ID, potem SKU, kod producenta, jawny kod i EAN', () => {
  const ids = supplierLineIdentifiers(product());
  assert.deepEqual(ids.slice(0, 4), [
    'external:ALEX-1748', 'sku:SKU-1748', 'manufacturer:1748', 'ean:5901234567890',
  ]);
  assert.equal(supplierLineStableKey(product()), 'external:ALEX-1748');
  assert.deepEqual(supplierLineIdentifiers({ produktId: '44', kod: '44', ean: '5901234123457' }).slice(0, 2), [
    'ean:5901234123457', 'product:44',
  ]);
  assert.deepEqual(supplierLineIdentifiers({ produktId: '45', kod: 'CAT-45', ean: '5901234123457' }).slice(0, 3), [
    'catalog:CAT-45', 'ean:5901234123457', 'product:45',
  ]);
  assert.equal(supplierLineStableKey({ produktId: '46', externalId: '46' }), 'external:46');

  const result = upsertSupplierPlanLine({
    drafts: [draft({ approvedAt: NOW.toISOString(), approvalRevision: 3, status: 'zaakceptowane' })],
    draftId: 'D-1', supplier: 'Alexander', product: product({ id: 999 }), quantity: 5,
    expectedRevision: 3, actor: 'admin@example.test', now: NOW,
  });
  assert.equal(result.draft.pozycje.length, 1, 'inna lokalna wartość ID nie dubluje wspólnego EXTERNAL_ID');
  assert.equal(result.draft.pozycje[0].ilosc, 5);
  assert.equal(result.draft.pozycje[0].manualExtra, 3);
  assert.equal(result.draft.revision, 4);
  assert.equal(result.draft.status, 'do sprawdzenia');
  assert.equal(Object.hasOwn(result.draft, 'approvedAt'), false);
});

test('ręczna ilość nie może zejść poniżej zapotrzebowania ani liczby już przyjętej', () => {
  assert.throws(() => upsertSupplierPlanLine({
    drafts: [draft()], draftId: 'D-1', supplier: 'Alexander', product: product(),
    quantity: 1, expectedRevision: 3, now: NOW,
  }), (error) => error.code === 'supplier_quantity_below_required');
});

test('ten sam identyfikator u innego producenta nie zmienia jego dokumentu', () => {
  const other = draft({
    id: 'D-MULTIGRA', supplier: 'Multigra', dostawca: 'Multigra', dostawcy: ['Multigra'],
    status: 'zaakceptowane', revision: 9, approvedAt: NOW.toISOString(), approvalRevision: 9,
    pozycje: [{ produktId: '200', externalId: 'ALEX-1748', nazwa: 'Inny produkt', dostawca: 'Multigra', ilosc: 7, iloscPotrzebna: 7 }],
  });
  const snapshot = structuredClone(other);
  const result = upsertSupplierPlanLine({
    drafts: [draft(), other], draftId: 'D-1', supplier: 'Alexander', product: product(),
    quantity: 3, expectedRevision: 3, actor: 'admin@example.test', now: NOW,
  });
  assert.deepEqual(result.drafts.find((item) => item.id === 'D-MULTIGRA'), snapshot);
  assert.equal(result.draft.pozycje[0].iloscPotrzebna, 2);
});

test('duplikaty tego samego producenta sumują wymaganie, a każdy zmieniony dokument traci approval i zwiększa rewizję', () => {
  const duplicate = draft({
    id: 'D-2', numer: 'AZ/2026/07/0002', status: 'zaakceptowane', revision: 7,
    approvedAt: NOW.toISOString(), approvedBy: 'admin@example.test', approvalRevision: 7,
    pozycje: [{ produktId: '1', externalId: 'ALEX-1748', nazwa: 'Przeplatanki', dostawca: 'Alexander', ilosc: 3, iloscPotrzebna: 3, zamowienia: ['ATM-2'] }],
  });
  const result = upsertSupplierPlanLine({
    drafts: [draft(), duplicate], draftId: 'D-1', supplier: 'Alexander', product: product(),
    quantity: 6, expectedRevision: 3, actor: 'admin@example.test', now: NOW,
  });
  assert.equal(result.draft.pozycje.length, 1);
  assert.equal(result.draft.pozycje[0].iloscPotrzebna, 5);
  assert.equal(result.draft.pozycje[0].manualExtra, 1);
  assert.equal(result.draft.revision, 4);
  const changedDuplicate = result.drafts.find((item) => item.id === 'D-2');
  assert.deepEqual(changedDuplicate.pozycje, []);
  assert.equal(changedDuplicate.revision, 8);
  assert.equal(changedDuplicate.status, 'do sprawdzenia');
  assert.equal(Object.hasOwn(changedDuplicate, 'approvedAt'), false);
  assert.equal(Object.hasOwn(changedDuplicate, 'approvalRevision'), false);
});

test('nowa ręczna pozycja trafia do jednego szkicu właściwego producenta', () => {
  const result = upsertSupplierPlanLine({
    drafts: [], supplier: 'Multigra', product: product({ id: 2, externalId: 'MG-2', producent: 'Multigra' }),
    quantity: 4, actor: 'admin@example.test', now: NOW,
  });
  assert.equal(result.drafts.length, 1);
  assert.equal(result.draft.supplier, 'Multigra');
  assert.equal(result.draft.pozycje[0].externalId, 'MG-2');
  assert.equal(result.draft.pozycje[0].iloscPotrzebna, 0);
  assert.equal(result.draft.pozycje[0].manualExtra, 4);
  assert.equal(result.draft.revision, 1);
});

test('zatwierdzenie dotyczy tylko bieżącej rewizji i jest idempotentne', () => {
  assert.throws(() => approveSupplierPlanDraft({ drafts: [draft()], draftId: 'D-1', expectedRevision: 2, now: NOW }),
    (error) => error.code === 'supplier_order_revision_conflict' && error.status === 409);
  const first = approveSupplierPlanDraft({ drafts: [draft()], draftId: 'D-1', expectedRevision: 3, actor: 'admin@example.test', now: NOW });
  const second = approveSupplierPlanDraft({ drafts: first.drafts, draftId: 'D-1', expectedRevision: 3, actor: 'admin@example.test', now: NOW });
  assert.equal(first.changed, true);
  assert.equal(first.draft.approvalRevision, 3);
  assert.equal(second.changed, false);
});

test('legacy szkic bez rewizji jest migrowany do wersji 1 i pozostaje edytowalny', () => {
  const legacy = draft();
  delete legacy.revision;
  const approved = approveSupplierPlanDraft({ drafts: [legacy], draftId: 'D-1', expectedRevision: 1, actor: 'admin@example.test', now: NOW });
  assert.equal(approved.draft.revision, 1);
  assert.equal(approved.draft.approvalRevision, 1);
  const edited = upsertSupplierPlanLine({
    drafts: [legacy], draftId: 'D-1', supplier: 'Alexander', product: product(), quantity: 3,
    expectedRevision: 1, actor: 'admin@example.test', now: NOW,
  });
  assert.equal(edited.draft.revision, 2);
});

test('anulowanie jest wersjonowane, zachowuje audyt i nie obejmuje wysłanego dokumentu', async () => {
  const cancelled = cancelSupplierPlanDraft({ drafts: [draft()], draftId: 'D-1', expectedRevision: 3, actor: 'admin@example.test', now: NOW });
  assert.equal(cancelled.draft.status, 'anulowane');
  assert.equal(cancelled.draft.revision, 4);
  assert.equal(cancelled.draft.cancelledBy, 'admin@example.test');
  assert.equal(cancelled.draft.historia.at(-1).type, 'cancelled');
  assert.throws(() => cancelSupplierPlanDraft({
    drafts: [draft({ status: 'wysłane do producenta' })], draftId: 'D-1', expectedRevision: 3, now: NOW,
  }), (error) => error.code === 'supplier_order_locked' && error.status === 409);

  const repo = memoryRepository({ rev: 9, data: { artway_agent_ai_zlecenia: [draft()] }, updated_at: null });
  const service = createSupplierOrderPlanService({ readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion, now: () => NOW });
  const result = await service.cancel({ draftId: 'D-1', expectedRevision: 3 }, 'admin@example.test');
  assert.equal(result.rev, 10);
  assert.equal(result.draft.status, 'anulowane');
});

test('korekta wysłanego dokumentu zachowuje poprzednią wysyłkę i otwiera nową rewizję', async () => {
  const sent = draft({
    status: 'wysłane do producenta', emailSentAt: NOW.toISOString(), emailSentBy: 'admin@example.test',
    approvedAt: NOW.toISOString(), approvalRevision: 3, sentSuppliers: ['Alexander'],
    emailResults: [{ supplier: 'Alexander', sent: true, sentAt: NOW.toISOString() }],
  });
  const result = prepareSupplierPlanCorrection({
    drafts: [sent], draftId: 'D-1', expectedRevision: 3,
    reason: 'Zmiana ilości po rozmowie z producentem', actor: 'admin@example.test', now: NOW,
  });
  assert.equal(result.draft.status, 'do sprawdzenia');
  assert.equal(result.draft.revision, 4);
  assert.equal(result.draft.correctionOfRevision, 3);
  assert.equal(result.draft.supersededSends.length, 1);
  assert.equal(result.draft.supersededSends[0].sentAt, NOW.toISOString());
  assert.equal(result.draft.emailSentAt, undefined);
  assert.equal(result.draft.approvedAt, undefined);
  assert.equal(result.draft.historia.at(-1).type, 'supplier-correction-opened');
  assert.throws(() => prepareSupplierPlanCorrection({
    drafts: [draft({ status: 'wysłane do producenta', emailSentAt: NOW.toISOString(), pozycje: [{ ...draft().pozycje[0], przyjeto: 1 }] })],
    draftId: 'D-1', expectedRevision: 3, reason: 'Korekta', now: NOW,
  }), (error) => error.code === 'supplier_order_receipt_started');
});

test('ogólny zapis settings nie może podmienić serwerowego Planu zatowarowania', () => {
  const canonical = [draft({ revision: 7, status: 'do sprawdzenia' })];
  const merged = preserveSupplierPlanOnGenericSettings(
    { artway_ustawienia: { nazwa: 'Nowa nazwa' }, artway_agent_ai_zlecenia: [{ id: 'TAMPERED' }] },
    { artway_ustawienia: { nazwa: 'Stara nazwa' }, artway_agent_ai_zlecenia: canonical },
  );
  assert.deepEqual(merged.artway_ustawienia, { nazwa: 'Nowa nazwa' });
  assert.deepEqual(merged.artway_agent_ai_zlecenia, canonical);
  merged.artway_agent_ai_zlecenia[0].status = 'lokalnie zmieniony';
  assert.equal(canonical[0].status, 'do sprawdzenia', 'wynik nie współdzieli referencji z poprzednim rekordem');
});

test('ogólny zapis settings zachowuje również kanoniczne dokumenty PZ/WZ', () => {
  const previous = { artway_dokumenty_magazynowe: [{ id: 'WD-1', type: 'PZ', status: 'draft' }], artway_dokumenty_magazynowe_seq: { 'PZ:2026-07': 4 } };
  const next = preserveSupplierPlanOnGenericSettings({ artway_stany: { 1: 5 }, artway_dokumenty_magazynowe: [] }, previous);
  assert.deepEqual(next.artway_dokumenty_magazynowe, previous.artway_dokumenty_magazynowe);
  assert.deepEqual(next.artway_dokumenty_magazynowe_seq, previous.artway_dokumenty_magazynowe_seq);
});

test('przyjęcie zwiększa stan o całą faktyczną ilość, zapisuje nadwyżkę i nie dubluje retry', () => {
  const sent = draft({ status: 'wysłane do producenta', emailSentAt: NOW.toISOString(), receiptRevision: 0 });
  const first = receiveSupplierPlanLine({
    drafts: [sent], settings: { artway_stany: { 1: 3 }, artway_ruchy_magazynowe: [] },
    draftId: 'D-1', productId: '1', quantity: 5, requestId: 'receipt-1', expectedReceiptRevision: 0,
    actor: 'admin@example.test', now: NOW,
  });
  assert.equal(first.settings.artway_stany[1], 8);
  assert.equal(first.draft.pozycje[0].przyjeto, 5);
  assert.equal(first.draft.pozycje[0].przyjetaNadwyzka, 3);
  assert.equal(first.draft.status, 'zrealizowane');
  assert.equal(first.movement.ilosc, 5);

  const retry = receiveSupplierPlanLine({
    drafts: first.drafts, settings: first.settings, draftId: 'D-1', productId: '1', quantity: 5,
    requestId: 'receipt-1', expectedReceiptRevision: 0, actor: 'admin@example.test', now: NOW,
  });
  assert.equal(retry.changed, false);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.settings.artway_stany[1], 8);
});

test('cały dokument jest przyjmowany jednym zapisem, a korekta pozostawia brak do kolejnej dostawy', () => {
  const sent = draft({
    status: 'wysłane do producenta', emailSentAt: NOW.toISOString(), receiptRevision: 0,
    pozycje: [
      { ...draft().pozycje[0], ilosc: 2, orderAllocations: { 'Allegro ALG-1': 2 }, zamowienia: ['Allegro ALG-1'] },
      { ...draft().pozycje[0], produktId: '2', externalId: 'MULTI-2', nazwa: 'Drugi produkt', ilosc: 3, iloscPotrzebna: 3, orderAllocations: { 'Allegro ALG-2': 3 }, zamowienia: ['Allegro ALG-2'] },
    ],
  });
  const partial = receiveSupplierPlanDocument({
    drafts: [sent], settings: { artway_stany: { 1: 1, 2: 0 }, artway_ruchy_magazynowe: [] },
    draftId: 'D-1', requestId: 'document-1', expectedReceiptRevision: 0,
    receipts: [
      { lineKey: 'external:ALEX-1748', productId: '1', quantity: 2 },
      { lineKey: 'external:MULTI-2', productId: '2', quantity: 0 },
    ], actor: 'admin@example.test', now: NOW,
  });
  assert.equal(partial.settings.artway_stany[1], 3);
  assert.equal(partial.settings.artway_stany[2], 0);
  assert.equal(partial.draft.status, 'częściowo zrealizowane');
  assert.equal(partial.receiptBatch.missingLines, 1);
  assert.deepEqual(partial.draft.pozycje[0].receiptAllocations, { 'Allegro ALG-1': 2 });

  const complete = receiveSupplierPlanDocument({
    drafts: partial.drafts, settings: partial.settings, draftId: 'D-1', requestId: 'document-2',
    expectedReceiptRevision: 1, actor: 'admin@example.test', now: new Date(NOW.getTime() + 60_000),
  });
  assert.equal(complete.settings.artway_stany[2], 3);
  assert.equal(complete.draft.status, 'zrealizowane');
  assert.equal(complete.receiptBatch.completed, true);
  assert.deepEqual(complete.draft.pozycje[1].receiptAllocations, { 'Allegro ALG-2': 3 });
});

test('serwis zapisuje tylko istniejące źródło artway_agent_ai_zlecenia i zachowuje resztę settings', async () => {
  const repo = memoryRepository({
    rev: 7,
    data: { artway_ustawienia: { nazwa: 'Artway-TM' }, artway_agent_ai_zlecenia: [] },
    updated_at: null,
  });
  const service = createSupplierOrderPlanService({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    mergeSettings: async (data) => ({ ...data, artway_produkty_dodane: [product()] }),
    catalogProducts: (data) => data.artway_produkty_dodane,
    now: () => NOW,
  });
  const result = await service.upsert({
    supplier: 'Alexander', productId: '1', quantity: 2,
    product: { id: 1, externalId: 'TAMPERED', sku: 'EVIL-SKU', ean: '0000000000000', nazwa: 'Podmieniona nazwa' },
  }, 'admin@example.test');
  assert.equal(result.ok, true);
  assert.equal(result.rev, 8);
  assert.equal(result.supplierOrders.length, 1);
  assert.equal(result.draft.pozycje[0].externalId, 'ALEX-1748');
  assert.equal(result.draft.pozycje[0].sku, 'SKU-1748');
  assert.equal(result.draft.pozycje[0].nazwa, 'Przeplatanki dla Chłopców');
  assert.deepEqual(repo.record.data.artway_ustawienia, { nazwa: 'Artway-TM' });
  assert.equal(repo.record.data.artway_produkty_dodane, undefined, 'scalony shard katalogu nie wraca do settings');
});

test('ręczne dopisanie do istniejącego szkicu nie jest blokowane przez duże niezależne nakładki katalogu', async () => {
  const second = product({ id: 2, externalId: 'ALEX-2000', sku: 'SKU-2000', kodProducenta: '2000', ean: '5901234567005', nazwa: 'Druga gra' });
  const repo = memoryRepository({
    rev: 20,
    data: {
      artway_produkty_edytowane: { duzaNiezaleznaNakladka: 'x'.repeat(20_000) },
      artway_agent_ai_zlecenia: [draft()],
    },
    updated_at: null,
  });
  const service = createSupplierOrderPlanService({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    mergeSettings: async (data) => ({ ...data, artway_produkty_dodane: [product(), second] }),
    catalogProducts: (data) => data.artway_produkty_dodane,
    settingsLimit: 4_096,
    now: () => NOW,
  });

  const result = await service.upsert({
    draftId: 'D-1', expectedRevision: 3, supplier: 'Alexander', productId: '2', quantity: 4,
  }, 'admin@example.test');

  assert.equal(result.draft.id, 'D-1');
  assert.equal(result.draft.revision, 4);
  assert.deepEqual(result.draft.pozycje.map((line) => [line.produktId, line.ilosc]), [['1', 2], ['2', 4]]);
  assert.equal(repo.record.data.artway_produkty_edytowane.duzaNiezaleznaNakladka.length, 20_000);
});

test('nieznany productId nie tworzy osieroconej pozycji z danych klienta', async () => {
  const initial = { rev: 2, data: { artway_agent_ai_zlecenia: [] }, updated_at: null };
  const repo = memoryRepository(initial);
  const service = createSupplierOrderPlanService({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    mergeSettings: async (data) => ({ ...data, artway_produkty_dodane: [product()] }),
    catalogProducts: (data) => data.artway_produkty_dodane,
    now: () => NOW,
  });
  await assert.rejects(
    () => service.upsert({ supplier: 'Alexander', productId: '404', quantity: 2, product: { id: '404', externalId: 'FAKE', nazwa: 'Sierota' } }),
    (error) => error.code === 'supplier_product_not_found' && error.status === 404,
  );
  assert.deepEqual(repo.record, initial);
});

test('serwis blokuje zatwierdzoną rewizję przed SMTP i zapisuje stan wysyłki', async () => {
  const approved = draft({ status: 'zaakceptowane', approvedAt: NOW.toISOString(), approvalRevision: 3 });
  const repo = memoryRepository({ rev: 4, data: { artway_agent_ai_zlecenia: [approved], artway_producenci: [producerRecord] }, updated_at: null });
  const service = createSupplierOrderPlanService({
    readVersioned: repo.readVersioned,
    writeIfVersion: repo.writeIfVersion,
    mergeSettings: async (data) => ({ ...data, artway_produkty_dodane: [product()] }),
    catalogProducts: (data) => data.artway_produkty_dodane,
    now: () => NOW,
  });
  const current = await service.beginEmailSend({ draftId: 'D-1', expectedRevision: 3, requestedSupplierNames: ['Alexander'], actor: 'admin@example.test' });
  assert.equal(current.draft.pozycje[0].ilosc, 2);
  assert.equal(current.draft.status, 'wysyłanie e-mail');
  assert.equal(current.supplierContacts[0].orderEmail, 'server-orders@alexander.example');
  await assert.rejects(
    () => service.upsert({ draftId: 'D-1', supplier: 'Alexander', productId: '1', quantity: 4, expectedRevision: 3 }),
    (error) => error.code === 'supplier_order_locked',
  );
  const marked = await service.markEmailResults({
    draftId: 'D-1', expectedRevision: 3, sendLockId: current.sendLockId, sentAt: NOW.toISOString(), actor: 'admin@example.test',
    results: [{ supplier: 'Alexander', sent: true, sentAt: NOW.toISOString() }],
  });
  assert.equal(marked.draft.status, 'wysłane do producenta');
  assert.equal(marked.draft.emailSentBy, 'admin@example.test');
  assert.equal(marked.draft.receiptRevision, 0);
});

test('ponowienie wysłanego dokumentu wymaga powodu i zapisuje osobną próbę audytową', async () => {
  const sent = draft({ status: 'wysłane do producenta', emailSentAt: '2026-07-15T17:00:00.000Z' });
  const repo = memoryRepository({ rev: 4, data: { artway_agent_ai_zlecenia: [sent], artway_producenci: [producerRecord] }, updated_at: null });
  const service = createSupplierOrderPlanService({ readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion, now: () => NOW });
  await assert.rejects(
    () => service.beginEmailSend({ draftId: 'D-1', expectedRevision: 3, allowResend: true, resendReason: '' }),
    (error) => error.code === 'supplier_order_resend_reason_required',
  );
  const lock = await service.beginEmailSend({ draftId: 'D-1', expectedRevision: 3, allowResend: true, resendReason: 'Producent prosi o ponowienie' });
  assert.equal(lock.resend, true);
  assert.equal(lock.draft.sendLock.mode, 'resend');
  const marked = await service.markEmailResults({
    draftId: 'D-1', expectedRevision: 3, sendLockId: lock.sendLockId, actor: 'admin@example.test',
    resend: true, resendReason: 'Producent prosi o ponowienie',
    results: [{ supplier: 'Alexander', sent: true, sentAt: NOW.toISOString() }], sentAt: NOW.toISOString(),
  });
  assert.equal(marked.draft.status, 'wysłane do producenta');
  assert.equal(marked.draft.emailSendCount, 2);
  assert.equal(marked.draft.emailSendHistory.at(-1).mode, 'resend');
  assert.equal(marked.draft.emailSendHistory.at(-1).reason, 'Producent prosi o ponowienie');
});

test('nieudana wysyłka odblokowuje zatwierdzoną rewizję bez zmiany treści', async () => {
  const approved = draft({ status: 'zaakceptowane', approvedAt: NOW.toISOString(), approvalRevision: 3 });
  const repo = memoryRepository({ rev: 4, data: { artway_agent_ai_zlecenia: [approved], artway_producenci: [producerRecord] }, updated_at: null });
  const service = createSupplierOrderPlanService({ readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion, now: () => NOW });
  const lock = await service.beginEmailSend({ draftId: 'D-1', expectedRevision: 3 });
  const result = await service.abortEmailSend({ draftId: 'D-1', expectedRevision: 3, sendLockId: lock.sendLockId });
  assert.equal(result.draft.status, 'zaakceptowane');
  assert.equal(result.draft.revision, 3);
  assert.equal(result.draft.sendLock, undefined);
});

test('adres odbiorcy pochodzi wyłącznie z serwerowej kartoteki, a brak kontaktu nie zostawia sendLock', async () => {
  const approved = draft({ status: 'zaakceptowane', approvedAt: NOW.toISOString(), approvalRevision: 3 });
  const tamperedRequest = [{ name: 'Alexander', orderEmail: 'attacker@example.test' }];
  const contacts = resolveCanonicalSupplierContacts(approved, {
    artway_producenci: [{ ...producerRecord, orderEmail: 'canonical@alexander.example' }],
  }, tamperedRequest.map((item) => item.name));
  assert.equal(contacts[0].orderEmail, 'canonical@alexander.example');
  assert.notEqual(contacts[0].orderEmail, tamperedRequest[0].orderEmail);

  const repo = memoryRepository({ rev: 4, data: { artway_agent_ai_zlecenia: [approved], artway_producenci: [] }, updated_at: null });
  const service = createSupplierOrderPlanService({ readVersioned: repo.readVersioned, writeIfVersion: repo.writeIfVersion, now: () => NOW });
  await assert.rejects(
    () => service.beginEmailSend({ draftId: 'D-1', expectedRevision: 3, requestedSupplierNames: ['Alexander'] }),
    (error) => error.code === 'supplier_contact_missing' && error.status === 422,
  );
  const unchanged = repo.record.data.artway_agent_ai_zlecenia[0];
  assert.equal(unchanged.status, 'zaakceptowane');
  assert.equal(unchanged.sendLock, undefined);
});
