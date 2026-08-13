import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateVonHalskyOffers,
  normalizeVonHalskySettings,
  summarizeVonHalskyCatalog,
  vonHalskyDefaultSettings,
  vonHalskyEffectivePrice,
  vonHalskyOfferProjection,
  vonHalskyOfferProposal,
  vonHalskyProductPresentation,
  vonHalskyProductReadiness,
  vonHalskyPublicConfig,
} from '../src/backend/lib/domain/von-halsky-catalog.mjs';
import { createVonHalskyApiClient } from '../src/backend/lib/domain/von-halsky-api-client.mjs';
import { createVonHalskyRoute } from '../src/backend/lib/von-halsky-route.mjs';
import { reusableVonHalskyEditorial } from '../src/backend/lib/domain/von-halsky-agent-route.mjs';
import { SOURCE_IMAGE_POLICY_VERSION } from '../src/backend/lib/domain/source-product-images.mjs';
import {
  createVonHalskyCatalogRoute,
  reconcileVonHalskyCommands,
  vonHalskyCreateReceipts,
} from '../src/backend/lib/domain/von-halsky-catalog-route.mjs';
import { persistVonHalskyReconciliationState } from '../src/backend/lib/domain/von-halsky-publication-reconciliation.mjs';
import { vonHalskyCheckEditorial, VON_HALSKY_CONTENT_POLICY } from '../src/backend/lib/domain/von-halsky-compliance.mjs';
import {
  compileVonHalskyCategoryIndex,
  matchVonHalskyAttributes,
  suggestVonHalskyCategory,
  vonHalskyAgentPreparationPatch,
} from '../src/backend/lib/domain/von-halsky-agent-preparation.mjs';
import {
  resolveVonHalskyResponsibleProducer,
  responsibleProducerFromSourceText,
} from '../src/backend/lib/domain/von-halsky-responsible-producer.mjs';
import {
  preferredVonHalskyOffers,
  reconcileVonHalskyCatalog,
  resolveVonHalskyRemoteOffer,
  vonHalskyCatalogTruthSummary,
  vonHalskyEffectiveOfferStatus,
} from '../src/backend/lib/domain/von-halsky-catalog-reconciliation.mjs';

const emptyCategoryApi = Object.freeze({
  fetchCategoryAttributes: async () => ({ payload: { attributes: [] } }),
});

test('bezpieczna gotowa treść Von Halsky jest używana ponownie bez kosztownej redakcji AI', () => {
  const reused = reusableVonHalskyEditorial({
    id: 'VH-REUSE-1',
    vonHalskyTitle: 'Gra edukacyjna Alexander dla dzieci',
    vonHalskyShortDescription: 'Czytelny opis najważniejszych cech gry dla całej rodziny.',
    vonHalskyDescription: 'Gra edukacyjna wspiera ćwiczenie spostrzegawczości, koncentracji i logicznego myślenia. Zestaw zawiera elementy potrzebne do wspólnej zabawy dzieci i dorosłych.',
  }, 'run-reused');
  assert.equal(reused?.reused, true);
  assert.equal(reused?.run?.id, 'run-reused');
  assert.equal(reused?.applied?.applied, false);
  assert.equal(reusableVonHalskyEditorial({ vonHalskyTitle: 'Za krótko' }), null);
});

function categoryContractResponse(url) {
  const parsed = new URL(String(url));
  if (/\/v1\/categories\/[^/]+\/attributes$/.test(parsed.pathname)) {
    return new Response(JSON.stringify({ attributes: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  const match = parsed.pathname.match(/\/v1\/categories\/([^/]+)$/);
  if (!match) return null;
  return new Response(JSON.stringify({
    id: decodeURIComponent(match[1]),
    name: 'Kategoria testowa',
    leaf: true,
    doesNotRequireGpsrInfo: true,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('odczyt katalogu Von Halsky domyka potwierdzenie publikacji nawet bez zmiany kartoteki', async () => {
  const states = [], receipts = [], reconciled = [];
  const result = await persistVonHalskyReconciliationState({
    channelState: {
      upsertState: async (value) => states.push(value),
      recordReceipt: async (value) => receipts.push(value),
      reconcilePendingReceiptsForProduct: async (value) => {
        reconciled.push(value);
        return 2;
      },
    },
    products: [{
      id: 'P-STATE-1',
      vonHalskyOfferId: 'OFFER-1',
      vonHalskyCommandId: 'COMMAND-1',
      vonHalskyRemoteStatus: 'PENDING',
      vonHalskyCategoryId: 'CATEGORY-1',
    }],
    productUpdates: [{ productId: 'P-STATE-1', fields: { vonHalskyRemoteStatus: 'PUBLISHED' } }],
    timestamp: '2026-08-01T10:00:00.000Z',
    source: 'test-reconciliation',
  });
  assert.deepEqual(result, { observed: 1, receipts: 2 });
  assert.equal(states[0].publicationStatus, 'confirmed');
  assert.equal(states[0].readbackConfirmedAt, '2026-08-01T10:00:00.000Z');
  assert.equal(receipts[0].idempotencyKey, 'COMMAND-1');
  assert.equal(receipts[0].status, 'readback_confirmed');
  assert.equal(receipts[0].targetId, 'OFFER-1');
  assert.equal(reconciled[0].productId, 'P-STATE-1');
  assert.equal(reconciled[0].status, 'readback_confirmed');
});

test('błąd weryfikacji Von Halsky nie pozostaje oznaczony jako trwająca publikacja', async () => {
  const states = [], receipts = [];
  await persistVonHalskyReconciliationState({
    channelState: {
      upsertState: async (value) => states.push(value),
      reconcilePendingReceiptsForProduct: async (value) => {
        receipts.push(value);
        return 1;
      },
    },
    products: [{
      id: 'P-VERIFY-ERROR',
      vonHalskyOfferId: 'OFFER-VERIFY-ERROR',
      vonHalskyRemoteStatus: 'VERIFICATION_ERROR',
      vonHalskyEditorialSyncError: 'Minimalny wiek wymaga jednej wartości.',
    }],
    timestamp: '2026-08-05T00:00:00.000Z',
  });
  assert.equal(states[0].publicationStatus, 'failed');
  assert.equal(states[0].errorCode, 'von_halsky_verification_error');
  assert.equal(receipts[0].status, 'failed');
});

test('oferta Von Halsky jest odnajdywana po EAN albo kodzie producenta z marką', () => {
  const index = preferredVonHalskyOffers([{
    offer: {
      id: 'VH-REMOTE-1',
      status: 'REJECTED',
      externalId: 'stary-identyfikator',
      product: {
        sku: 'STARE-SKU',
        ean: '5906018027532',
        manufacturerProductNumber: '2753',
        brand: 'Alexander',
        categoryId: 'gry',
      },
    },
  }]);
  const byGtin = resolveVonHalskyRemoteOffer({
    externalId: 'NOWE-SKU',
    gtin: '5906018027532',
  }, index);
  assert.equal(byGtin.offer.offerId, 'VH-REMOTE-1');
  assert.match(byGtin.matchedBy, /gtin/);
  const byManufacturer = resolveVonHalskyRemoteOffer({
    manufacturerCode: '2753',
    brand: 'Alexander',
  }, index);
  assert.equal(byManufacturer.offer.offerId, 'VH-REMOTE-1');
  assert.match(byManufacturer.matchedBy, /manufacturerCode\+brand/);
});

test('powtórzony EXTERNAL_ID nigdy nie przypina oferty z innym EAN-em', () => {
  const index = preferredVonHalskyOffers([{
    offer: {
      id: '27113452-e0d6-44a9-bd13-3b7e64e0228b',
      status: 'PUBLISHED',
      externalId: '0157',
      product: {
        sku: '0157',
        ean: '5906395301577',
        manufacturerProductNumber: '0157',
        brand: 'Multigra',
      },
    },
  }]);
  const correct = resolveVonHalskyRemoteOffer({
    externalId: '0157',
    gtin: '5906395301577',
    manufacturerCode: '0157',
    brand: 'Multigra',
  }, index);
  assert.equal(correct.offer?.offerId, '27113452-e0d6-44a9-bd13-3b7e64e0228b');
  assert.match(correct.matchedBy, /gtin/);

  const wrongProduct = resolveVonHalskyRemoteOffer({
    offerId: '27113452-e0d6-44a9-bd13-3b7e64e0228b',
    externalId: '0157',
    gtin: '5906018001570',
    manufacturerCode: '0157',
    brand: 'Alexander',
  }, index);
  assert.equal(wrongProduct.offer, null);
  assert.equal(wrongProduct.conflicts[0]?.reason, 'gtin_mismatch');
  assert.equal(wrongProduct.conflicts[0]?.offerId, '27113452-e0d6-44a9-bd13-3b7e64e0228b');
});

test('mocny EAN wygrywa ze słabym EXTERNAL_ID wskazującym inną ofertę', () => {
  const index = preferredVonHalskyOffers([
    { offerId: 'WEAK-WRONG', externalId: 'DUPLICATE', gtin: '5906018005288', status: 'PUBLISHED' },
    { offerId: 'STRONG-CORRECT', externalId: 'UNIQUE', gtin: '5903796605280', status: 'REJECTED' },
  ]);
  const result = resolveVonHalskyRemoteOffer({
    externalId: 'DUPLICATE',
    gtin: '5903796605280',
  }, index);
  assert.equal(result.offer?.offerId, 'STRONG-CORRECT');
  assert.match(result.matchedBy, /gtin/);
  assert.equal(result.conflicts.some((item) => item.offerId === 'WEAK-WRONG' && item.reason === 'gtin_mismatch'), true);
});

test('status kanału zachowuje relacyjne liczniki PostgreSQL bez pobierania całej listy ofert', async () => {
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async (_key, fallback) => ({ value: fallback, revision: 0 }),
    writeIfVersion: async () => ({ modified: true }),
    readStatus: async (fallback) => ({
      ...fallback,
      truth: {
        total: 160,
        published: 105,
        pending: 39,
        rejected: 16,
        closed: 0,
        statuses: { PUBLISHED: 105, PENDING: 39, REJECTED: 16 },
      },
      commandSummary: { pending: 12, total: 50 },
      sync: { remoteOfferCount: 160, publishedOfferCount: 105 },
    }),
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-status');
  const response = await route(request, new URL(request.url), 'von-halsky-status');
  assert.equal(response.status, 200);
  assert.equal(response.body.truth.total, 160);
  assert.equal(response.body.truth.published, 105);
  assert.equal(response.body.channelStatus.operations.pendingCommands, 12);
  assert.equal(response.body.channelStatus.consistent, true);
});

test('potwierdzenia publikacji Von Halsky są rozpoznawane także w opakowanej odpowiedzi API', () => {
  assert.deepEqual(vonHalskyCreateReceipts({
    data: [{
      command: { id: 'COMMAND-1' },
      offer: { id: 'OFFER-1', externalId: 'EXT-1' },
    }],
  }), [{
    command: { id: 'COMMAND-1' },
    offer: { id: 'OFFER-1', externalId: 'EXT-1' },
    commandId: 'COMMAND-1',
    offerId: 'OFFER-1',
    externalId: 'EXT-1',
  }]);
  assert.deepEqual(vonHalskyCreateReceipts({ message: 'accepted' })[0], {
    message: 'accepted',
    commandId: '',
    offerId: '',
    externalId: '',
  });
});

test('polecenia publikacji kończą się wyłącznie na podstawie odczytu katalogu API', () => {
  const checked = reconcileVonHalskyCommands([
    { commandId: 'C-1', externalId: 'EXT-1', status: 'PENDING', updatedAt: '2026-07-30T07:00:00.000Z' },
    { commandId: 'C-2', externalId: 'EXT-2', status: 'PENDING', updatedAt: '2026-07-30T07:00:00.000Z' },
    { commandId: 'C-3', externalId: 'EXT-3', status: 'PENDING', updatedAt: '2026-07-30T07:00:00.000Z' },
  ], [
    { offerId: 'O-1', externalId: 'EXT-1', status: 'PUBLISHED' },
    { offerId: 'O-2', externalId: 'EXT-2', status: 'REJECTED', validationErrors: [{ code: 'CATEGORY_INCORRECT' }] },
  ], '2026-07-30T08:00:00.000Z');
  assert.equal(checked[0].status, 'SUCCESS');
  assert.equal(checked[1].status, 'FAILED');
  assert.match(checked[1].error, /CATEGORY_INCORRECT/);
  assert.equal(checked[2].status, 'PROVIDER_PROCESSING');
  assert.equal(checked[2].remoteStatus, 'AWAITING_CATALOG');
  assert.equal(checked[2].missingChecks, 1);
});

test('brak oferty staje się NOT_FOUND dopiero po 24 godzinach i trzech kontrolach', () => {
  const checked = reconcileVonHalskyCommands([
    {
      commandId: 'C-LATE',
      externalId: 'EXT-LATE',
      status: 'PROVIDER_PROCESSING',
      updatedAt: '2026-07-29T07:00:00.000Z',
      missingChecks: 2,
      firstMissingAt: '2026-07-29T08:00:00.000Z',
    },
  ], [], '2026-07-30T08:00:00.000Z');
  assert.equal(checked[0].status, 'NOT_FOUND');
  assert.equal(checked[0].missingChecks, 3);
});

test('osobna bramka Von Halsky blokuje logistykę, linki i nieobsługiwany HTML', () => {
  const safe = vonHalskyCheckEditorial({
    nazwa: 'Rodzinna gra edukacyjna Alexander',
    opisKrotki: 'Gra wspiera spostrzegawczość i wspólną zabawę.',
    opis: '<h2>Rozgrywka</h2><p>Zestaw zawiera elementy potrzebne do rozegrania partii zgodnie z dołączoną instrukcją.</p>',
  });
  assert.equal(safe.ok, true);
  const blocked = vonHalskyCheckEditorial({
    nazwa: 'Gra',
    opis: '<table><tr><td>Wysyłka InPost. Więcej na https://sklep.example.pl</td></tr></table>',
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.policyId, VON_HALSKY_CONTENT_POLICY.id);
  assert.ok(blocked.violations.some((item) => item.id === 'delivery_data'));
  assert.ok(blocked.violations.some((item) => item.id === 'external_link'));
  assert.ok(blocked.violations.some((item) => item.id === 'unsupported_markup'));
  const contact = vonHalskyCheckEditorial({ vonHalskyTitle: 'Rodzinna gra edukacyjna', vonHalskyShortDescription: 'Gra rozwijająca spostrzegawczość.', vonHalskyDescription: '<p>Produkt zapewnia wspólną zabawę. Napisz do nas na e-mail, aby poznać więcej informacji o zakupie.</p>' });
  assert.ok(contact.violations.some((item) => item.id === 'contact_data'));
  assert.equal(VON_HALSKY_CONTENT_POLICY.contactPlacement, 'merchant_store_settings_only');
  assert.equal(VON_HALSKY_CONTENT_POLICY.productDescriptionLinksAllowed, false);
});

test('Von Halsky uznaje produkt z EAN, opisem, zdjęciem i ceną za gotowy', () => {
  const result = vonHalskyProductReadiness({
    nazwa: 'Alexander Edukarty Poznajemy Emocje',
    opis: 'Rozbudowany opis produktu edukacyjnego przeznaczonego dla dzieci i rodziców. Zestaw pomaga rozwijać umiejętności poprzez wspólną, angażującą zabawę.',
    ean: '5906018000030',
    zdjecie: '/img/produkt.webp',
    cena: 39.9,
    vonHalskyDoesNotRequireGpsrInfo: true,
  });
  assert.equal(result.ready, true);
  assert.equal(result.identifiers.ean, '5906018000030');
  assert.deepEqual(result.issues, []);
});

test('Von Halsky dopuszcza kod producenta z marką, ale wykrywa braki treści', () => {
  const validIdentity = vonHalskyProductReadiness({
    nazwa: 'Gra edukacyjna dla dzieci',
    opis: 'Pełny opis produktu zawiera wszystkie najważniejsze cechy, przeznaczenie, zawartość zestawu i informacje potrzebne klientowi do świadomego wyboru produktu.',
    kodProducenta: '0031',
    marka: 'Alexander',
    zdjecie: '/img/produkt.webp',
    cena: 25,
    vonHalskyDoesNotRequireGpsrInfo: true,
  });
  assert.equal(validIdentity.ready, true);
  const invalid = vonHalskyProductReadiness({ nazwa: 'Gra', opis: 'https://sklep.pl', cena: 0 });
  assert.equal(invalid.ready, false);
  assert.ok(invalid.issues.some((issue) => issue.includes('7–150')));
  assert.ok(invalid.issues.some((issue) => issue.includes('linków')));
  assert.ok(invalid.issues.some((issue) => issue.includes('EAN')));
});

test('podsumowanie katalogu nie dubluje produktów', () => {
  const summary = summarizeVonHalskyCatalog([
    { nazwa: 'Produkt pierwszy', opis: 'a'.repeat(120), ean: '5906018000030', zdjecie: 'a.jpg', cena: 10, vonHalskyDoesNotRequireGpsrInfo: true, vonHalskyAttributeDefinitions: [] },
    { nazwa: 'Produkt drugi', opis: 'krótki', cena: 20 },
  ]);
  assert.deepEqual(summary, { total: 2, ready: 1, needsWork: 1, withEan: 1, averageScore: 54 });
});

test('ustawienia wymuszają wybraną bezpośrednią integrację API i ograniczają wartości', () => {
  const settings = normalizeVonHalskySettings({
    integrationMethod: 'integrator',
    integrator: 'apilo',
    channelAlias: 'v-h',
    minimumStock: -10,
    maximumStock: 999999,
    syncIntervalMinutes: 1,
    automaticPriceSync: false,
    catalogAutomationEnabled: true,
  });
  assert.equal(settings.integrationMethod, 'api');
  assert.equal(settings.integrator, '');
  assert.equal(settings.channelAlias, 'VH');
  assert.equal(settings.minimumStock, 0);
  assert.equal(settings.maximumStock, 99999);
  assert.equal(settings.syncIntervalMinutes, 15);
  assert.equal(settings.automaticPriceSync, false);
  assert.equal(settings.newOfferPublicationMode, 'manual_selection');
  assert.equal(settings.catalogAutomationEnabled, false);
  assert.equal(settings.agentPreparationEnabled, true);
  assert.equal(settings.agentMinimumConfidence, 0.82);
});

test('Agent Von Halsky automatycznie wybiera tylko jednoznaczną kategorię końcową', () => {
  const clear = suggestVonHalskyCategory(
    { nazwa: 'Balony foliowe serca czerwone', kategoria: 'Balony foliowe', podkategoria: 'Serca' },
    [
      { id: 'leaf-hearts', name: 'Balony foliowe serca', path: 'Impreza › Balony › Balony foliowe serca', leaf: true },
      { id: 'leaf-animals', name: 'Balony foliowe zwierzęta', path: 'Impreza › Balony › Balony foliowe zwierzęta', leaf: true },
      { id: 'parent', name: 'Balony', path: 'Impreza › Balony', leaf: false },
    ],
  );
  assert.equal(clear.selected.id, 'leaf-hearts');
  assert.equal(clear.autoApplicable, true);
  const ambiguous = suggestVonHalskyCategory(
    { nazwa: 'Zestaw kreatywny dla dzieci', kategoria: 'Zabawki' },
    [
      { id: 'one', name: 'Zestawy kreatywne', path: 'Zabawki › Zestawy kreatywne', leaf: true },
      { id: 'two', name: 'Zabawki kreatywne', path: 'Zabawki › Zabawki kreatywne', leaf: true },
    ],
  );
  assert.equal(ambiguous.autoApplicable, false);
});

test('balon foliowy Chase nie zatrzymuje się przez sezonową kategorię Walentynki', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Balon Chase Psi Patrol, foliowy 94 cm - Grabo',
    kategoria: 'Balony Foliowe',
    opisKrotki: 'Foliowy balon z licencjonowanym bohaterem. Do nadmuchiwania powietrzem lub helem.',
  }, [
    { id: 'party', name: 'Balony', path: 'Dla dzieci › Okazje i przyjęcia › Dekoracje i gadżety › Balony', leaf: true },
    { id: 'valentine', name: 'Balony', path: 'Dom i ogród › Wyposażenie › Ozdoby świąteczne i okolicznościowe › Walentynki › Balony', leaf: true },
    { id: 'wedding', name: 'Balony ślubne', path: 'Moda › Odzież, obuwie i dodatki › Ślub i wesele › Dekoracje ślubne › Balony ślubne', leaf: true },
  ]);
  assert.equal(result.selected.id, 'party');
  assert.equal(result.intent.type, 'balloon');
  assert.equal(result.autoApplicable, true);
  assert.ok(result.margin >= 0.08);
});

test('wiatraczek trafia jednoznacznie do końcowej kategorii Wiatraczki', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Wiatrak B Alexander',
    kategoria: 'Wiatraczki',
    opisKrotki: 'Kolorowy wiatraczek montowany przy dziecięcym rowerze.',
  }, [
    { id: 'windmills', name: 'Wiatraczki', path: 'Dla dzieci › Rowery i pojazdy › Akcesoria do dziecięcych rowerów i pojazdów › Wiatraczki', leaf: true },
    { id: 'decorations', name: 'Dekoracje', path: 'Dom › Dekoracje domowe', leaf: true },
  ]);
  assert.equal(result.selected.id, 'windmills');
  assert.equal(result.intent.type, 'windmill');
  assert.equal(result.autoApplicable, true);
});

test('brelok X-Press Me DIY trafia do prac manualnych, a nie do klocków konstrukcyjnych', () => {
  const categories = [
    {
      id: 'creative-manual',
      name: 'Prace manualne',
      path: 'Dla dzieci › Zabawki › Zabawki plastyczne › Prace manualne',
      leaf: true,
    },
    {
      id: 'construction-blocks',
      name: 'Klocki konstrukcyjne',
      path: 'Dla dzieci › Zabawki › Klocki › Klocki konstrukcyjne',
      leaf: true,
    },
    {
      id: 'gsm-keychains',
      name: 'Breloki',
      path: 'Elektronika › Telefony i akcesoria › Akcesoria GSM › Smycze, breloki › Breloki',
      leaf: true,
    },
  ];
  const result = suggestVonHalskyCategory({
    nazwa: 'X-Press Me – brelok DIY Garbus – zestaw 72 elementy',
    kategoria: 'Zabawki Konstrukcyjne',
    opisKrotki: 'Zestaw kreatywny do samodzielnego składania ozdoby z blaszek i śrubek.',
    parametryProducenta: { seria: 'X-Press Me' },
  }, categories);
  assert.equal(result.selected.id, 'creative-manual');
  assert.equal(result.autoApplicable, true);
  assert.match(result.selected.evidence.join(' '), /X-Press\/brelok DIY/);
});

test('kreator mody pozostaje pracą manualną mimo propozycji gier w instrukcji', () => {
  const categories = [
    {
      id: 'creative-manual',
      name: 'Prace manualne',
      path: 'Dla dzieci › Zabawki › Zabawki plastyczne › Prace manualne',
      leaf: true,
    },
    {
      id: 'board-games',
      name: 'Pozostałe gry planszowe',
      path: 'Kultura i rozrywka › Gry › Planszowe › Pozostałe gry planszowe',
      leaf: true,
    },
  ];
  const result = suggestVonHalskyCategory({
    nazwa: 'Moda i Modelki 2 – kreator mody',
    kategoria: 'Top Fashion',
    opisKrotki: 'Zestaw do projektowania mody z instrukcją zawierającą 7 propozycji gier.',
  }, categories);
  assert.equal(result.selected.id, 'creative-manual');
  assert.equal(result.intent.type, 'creative');
  assert.equal(result.autoApplicable, true);
  assert.ok(result.confidence >= 0.82);
});

test('szablony kieszonkowe trafiają do prac manualnych mimo starej kategorii gry kieszonkowe', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Szablony kieszonkowe Zabawa - Alexander',
    kategoria: 'Gry kieszonkowe',
    opisKrotki: 'Zestaw zawiera 4 szablony i notes do kreatywnego rysowania.',
    parametryProducenta: { symbol: '2511', wiek: '7-107' },
  }, [
    {
      id: 'creative-manual',
      name: 'Prace manualne',
      path: 'Dla dzieci › Zabawki › Zabawki plastyczne › Prace manualne',
      leaf: true,
    },
    {
      id: 'pocket-games',
      name: 'Pozostałe gry planszowe',
      path: 'Kultura i rozrywka › Gry › Planszowe › Pozostałe gry planszowe',
      leaf: true,
    },
  ]);
  assert.equal(result.selected.id, 'creative-manual');
  assert.equal(result.intent.type, 'creative');
  assert.equal(result.autoApplicable, true);
  assert.ok(result.confidence >= 0.82);
});

test('pieczątki mikro trafiają do prac manualnych mimo starej kategorii gry kieszonkowe', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Pieczątki Zwierzątka Mikro - zestaw edukacyjny z poduszką do odbijania',
    kategoria: 'Gry kieszonkowe',
    opisKrotki: 'Zestaw zawiera poduszkę z tuszem i 4 pieczątki do tworzenia rysunków.',
  }, [
    {
      id: 'creative-manual',
      name: 'Prace manualne',
      path: 'Dla dzieci › Zabawki › Zabawki plastyczne › Prace manualne',
      leaf: true,
    },
    {
      id: 'pocket-games',
      name: 'Pozostałe gry planszowe',
      path: 'Kultura i rozrywka › Gry › Planszowe › Pozostałe gry planszowe',
      leaf: true,
    },
  ]);
  assert.equal(result.selected.id, 'creative-manual');
  assert.equal(result.intent.type, 'creative');
  assert.equal(result.autoApplicable, true);
  assert.ok(result.confidence >= 0.82);
});

test('gra Na Tropie mini korzysta z liczby graczy zamiast trafiać do mini kamer', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Na Tropie mini - Multigra',
    kategoria: 'Multigra',
    opisKrotki: 'Kompaktowa gra edukacyjna o świecie zwierząt, przeznaczona do rodzinnej rozgrywki.',
    parametryZrodla: { 'wiek graczy od': '8 lat', 'liczba graczy': '2-4', 'liczba elementow': '193 szt' },
  }, [
    {
      id: 'educational-games',
      name: 'Logiczne i edukacyjne',
      path: 'Kultura i rozrywka › Gry › Planszowe › Logiczne i edukacyjne',
      leaf: true,
    },
    {
      id: 'mini-cameras',
      name: 'Mini kamery',
      path: 'Elektronika › RTV i AGD › Kamery › Mini kamery',
      leaf: true,
    },
  ]);
  assert.equal(result.selected.id, 'educational-games');
  assert.equal(result.intent.type, 'board_game');
  assert.equal(result.intent.subtype, 'educational');
  assert.equal(result.autoApplicable, true);
  assert.ok(result.confidence >= 0.82);
});

test('Piotruś dla dzieci rozstrzyga remis kategorii kart na korzyść najmłodszych', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Piotruś - Przyjaciele z Podwórka - gra karciana Multigra',
    kategoria: 'Gry karciane',
    opisKrotki: 'Gra dla dzieci od 4 lat polegająca na dobieraniu kart do pary.',
    parametryZrodla: { wiek: '4+', 'liczba graczy': '2-4' },
  }, [
    {
      id: 'children-cards',
      name: 'Karciane dla najmłodszych',
      path: 'Kultura i rozrywka › Gry › Karciane › Karciane dla najmłodszych',
      leaf: true,
    },
    {
      id: 'traditional-cards',
      name: 'Karciane tradycyjne',
      path: 'Kultura i rozrywka › Gry › Karciane › Karciane tradycyjne',
      leaf: true,
    },
    {
      id: 'other-cards',
      name: 'Pozostałe gry karciane',
      path: 'Kultura i rozrywka › Gry › Karciane › Pozostałe gry karciane',
      leaf: true,
    },
  ]);
  assert.equal(result.selected.id, 'children-cards');
  assert.equal(result.intent.type, 'card_game');
  assert.equal(result.intent.subtype, 'card_children');
  assert.equal(result.autoApplicable, true);
  assert.ok(result.margin >= 0.08);
});

test('autorska kieszonkowa gra karciana trafia do pozostałych zamiast kart tradycyjnych lub dla najmłodszych', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'GRRR! Nie dla Psa Kiełbasa - kieszonkowa gra karciana edycja limitowana',
    kategoria: 'Gry karciane',
    opisKrotki: 'Gra o zbieraniu jamników i podejmowaniu decyzji przy limicie pięciu kart.',
    parametryProducenta: { wiek: '6+', liczbaGraczy: '3-6' },
  }, [
    { id: 'children', name: 'Karciane dla najmłodszych', path: 'Kultura i rozrywka › Gry › Karciane › Karciane dla najmłodszych', leaf: true },
    { id: 'traditional', name: 'Karciane tradycyjne', path: 'Kultura i rozrywka › Gry › Karciane › Karciane tradycyjne', leaf: true },
    { id: 'other', name: 'Pozostałe gry karciane', path: 'Kultura i rozrywka › Gry › Karciane › Pozostałe gry karciane', leaf: true },
  ]);
  assert.equal(result.selected.id, 'other');
  assert.equal(result.intent.type, 'card_game');
  assert.equal(result.intent.subtype, 'card_other');
  assert.equal(result.autoApplicable, true);
});

test('opisowe słowo rysowanie nie zmienia jawnej gry familijnej w pracę manualną', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Gadka Szmatka - gra słowna Alexander 2468',
    kategoria: 'Gry familijne i dla dzieci',
    opisKrotki: 'Rodzinna gra z tablicą do rysowania i odgadywania haseł.',
    parametryProducenta: { liczbaGraczy: '3-8' },
  }, [
    { id: 'family', name: 'Rodzinne', path: 'Kultura i rozrywka › Gry › Planszowe › Rodzinne', leaf: true },
    { id: 'manual', name: 'Prace manualne', path: 'Dla dzieci › Zabawki › Zabawki plastyczne › Prace manualne', leaf: true },
    { id: 'word', name: 'Słowne i liczbowe', path: 'Kultura i rozrywka › Gry › Planszowe › Słowne i liczbowe', leaf: true },
  ]);
  assert.equal(result.selected.id, 'family');
  assert.equal(result.intent.type, 'board_game');
  assert.equal(result.autoApplicable, true);
});

test('jawna mozaika pozostaje pracą manualną mimo technicznego pola liczby graczy', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Mozaika 300 elementów - Multigra',
    kategoria: 'Multigra',
    opisKrotki: 'Kreatywny zestaw do układania kolorowych elementów.',
    parametryProducenta: { liczbaGraczy: '1+' },
  }, [
    { id: 'manual', name: 'Prace manualne', path: 'Dla dzieci › Zabawki › Zabawki plastyczne › Prace manualne', leaf: true },
    { id: 'games', name: 'Logiczne i edukacyjne', path: 'Kultura i rozrywka › Gry › Planszowe › Logiczne i edukacyjne', leaf: true },
  ]);
  assert.equal(result.selected.id, 'manual');
  assert.equal(result.intent.type, 'creative');
  assert.equal(result.autoApplicable, true);
});

test('Przewlekanki trafiają do labiryntów i przeplatanek mimo pola liczby graczy', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Przewlekanki Alexander - zestaw edukacyjny do nawlekania kolorowych linek',
    kategoria: 'Przeplatanki',
    parametryProducenta: { liczbaGraczy: '1+' },
  }, [
    { id: 'lacing', name: 'Labirynty, przeplatanki', path: 'Dla dzieci › Zabawki › Zabawki edukacyjne › Umysłowe › Labirynty, przeplatanki', leaf: true },
    { id: 'games', name: 'Logiczne i edukacyjne', path: 'Kultura i rozrywka › Gry › Planszowe › Logiczne i edukacyjne', leaf: true },
  ]);
  assert.equal(result.selected.id, 'lacing');
  assert.equal(result.intent.type, 'lacing');
  assert.equal(result.autoApplicable, true);
});

test('Magnesiaki są układanką dziecięcą, a nie przypadkową kategorią z motywu obrazków', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Magnesiaki małe - Gospodarstwo, zestaw obrazków magnetycznych Alexander',
    kategoria: 'Magnesiaki',
  }, [
    { id: 'puzzle', name: 'Pozostałe układanki dla dzieci', path: 'Dla dzieci › Zabawki › Zabawki edukacyjne › Układanki › Pozostałe układanki dla dzieci', leaf: true },
    { id: 'farm', name: 'Gospodarstwo', path: 'Dom i ogród › Ogród › Gospodarstwo', leaf: true },
  ]);
  assert.equal(result.selected.id, 'puzzle');
  assert.equal(result.intent.type, 'magnetic_puzzle');
  assert.equal(result.autoApplicable, true);
});

test('zestaw magicznych sztuczek trafia do pozostałych zabawek edukacyjnych, nie ezoteryki', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Magiczne sztuczki - Magia w 5 minut, Przecięta linia',
    kategoria: 'Multigra',
  }, [
    { id: 'toys', name: 'Pozostałe zabawki edukacyjne', path: 'Dla dzieci › Zabawki › Zabawki edukacyjne › Pozostałe zabawki edukacyjne', leaf: true },
    { id: 'esoteric', name: 'Ezoteryka, magia i tajemnice', path: 'Kultura i rozrywka › Książki › Poradniki i albumy › Ezoteryka, magia i tajemnice', leaf: true },
  ]);
  assert.equal(result.selected.id, 'toys');
  assert.equal(result.intent.type, 'magic_trick');
  assert.equal(result.autoApplicable, true);
});

test('Metalcraft czołg do składania trafia do modelarstwa pojazdów wojskowych', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Metalcraft World of Tanks - Czołg Tiger I, metalowy model do składania',
    kategoria: 'World of tanks',
  }, [
    { id: 'military', name: 'Pojazdy wojskowe', path: 'Kolekcje i sztuka › Kolekcje › Modelarstwo › Pojazdy wojskowe', leaf: true },
    { id: 'remote', name: 'Pojazdy wojskowe', path: 'Kolekcje i sztuka › Kolekcje › Modelarstwo › Zdalnie sterowane › Pojazdy wojskowe', leaf: true },
    { id: 'lego', name: 'Jurrasic World', path: 'Dla dzieci › Zabawki › Klocki › LEGO › Jurrasic World', leaf: true },
  ]);
  assert.equal(result.selected.id, 'military');
  assert.equal(result.intent.type, 'model_kit');
  assert.equal(result.autoApplicable, true);
});

test('edukacyjny zestaw pieniędzy trafia do zestawów pieniędzy papierowych', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Zabawka edukacyjna Pieniądze 500 - Alexander',
    kategoria: 'Tablice edukacyjne i inne',
  }, [
    { id: 'money', name: 'Zestawy pieniędzy pappierowych', path: 'Kolekcje i sztuka › Kolekcje › Pieniądz papierowy › Zestawy pieniędzy pappierowych', leaf: true },
    { id: 'pc', name: 'Edukacyjne', path: 'Kultura i rozrywka › Gry › Gry na PC › Edukacyjne', leaf: true },
  ]);
  assert.equal(result.selected.id, 'money');
  assert.equal(result.intent.type, 'money_play');
  assert.equal(result.autoApplicable, true);
});

test('literówka puzzel nadal prowadzi drewniany produkt do puzzli tradycyjnych', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'MilliWOOD Christmas - Święty Mikołaj, puzzel drewniany 500 elementów',
    kategoria: 'Dream Team',
  }, [
    { id: 'puzzle', name: 'Puzzle tradycyjne', path: 'Dla dzieci › Zabawki › Puzzle › Puzzle tradycyjne', leaf: true },
    { id: 'wheels', name: 'Koła', path: 'Kolekcje i sztuka › Kolekcje › Modelarstwo › Zdalnie sterowane › Koła', leaf: true },
  ]);
  assert.equal(result.selected.id, 'puzzle');
  assert.equal(result.intent.type, 'puzzle');
  assert.equal(result.autoApplicable, true);
});

test('Magiczne Jednorożce pozostają grą rodzinną, a nie zestawem sztuczek', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'RODZINNA GRA PLANSZOWA - MAGICZNE JEDNOROŻCE',
    kategoria: 'Gry familijne i dla dzieci',
    parametryProducenta: { liczbaGraczy: '2-4' },
  }, [
    { id: 'family', name: 'Rodzinne', path: 'Kultura i rozrywka › Gry › Planszowe › Rodzinne', leaf: true },
    { id: 'magic', name: 'Pozostałe zabawki edukacyjne', path: 'Dla dzieci › Zabawki › Zabawki edukacyjne › Pozostałe zabawki edukacyjne', leaf: true },
  ]);
  assert.equal(result.selected.id, 'family');
  assert.equal(result.intent.type, 'board_game');
  assert.equal(result.autoApplicable, true);
});

test('drewniane puzzle regularne trafiają do Puzzle tradycyjne zamiast piankowych lub akcesoriów', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Puzzle drewniane Landscapes – Górska Chata, 580 elementów',
    opis: 'Drewniane puzzle o regularnych kształtach. Zestaw zawiera 580 elementów.',
    kategoria: 'Układanki i puzzle',
    parametryProducenta: { liczbaElementow: '580', wiek: '12+' },
  }, [
    { id: 'accessories', name: 'Akcesoria do puzzli', path: 'Dla dzieci › Zabawki › Puzzle › Akcesoria do puzzli', leaf: true },
    { id: 'foam', name: 'Puzzle piankowe', path: 'Dla dzieci › Zabawki › Puzzle › Puzzle piankowe', leaf: true },
    { id: 'spatial', name: 'Puzzle przestrzenne 3D, 4D', path: 'Dla dzieci › Zabawki › Puzzle › Puzzle przestrzenne 3D, 4D', leaf: true },
    { id: 'traditional', name: 'Puzzle tradycyjne', path: 'Dla dzieci › Zabawki › Puzzle › Puzzle tradycyjne', leaf: true },
  ]);
  assert.equal(result.selected.id, 'traditional');
  assert.equal(result.autoApplicable, true);
  assert.equal(result.intent.type, 'puzzle');
  assert.equal(result.intent.subtype, 'traditional');
});

test('jawne puzzle drewniane zachowują automatyczną pewność przy ogólnej kategorii Nowości', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'MilliWOOD Hello Traveler - Santorini, Puzzle Drewniane 500 elementów',
    kategoria: 'Nowości',
    parametryProducenta: { liczbaElementow: '500', wiek: '12+' },
  }, [
    { id: 'accessories', name: 'Akcesoria do puzzli', path: 'Dla dzieci › Zabawki › Puzzle › Akcesoria do puzzli', leaf: true },
    { id: 'foam', name: 'Puzzle piankowe', path: 'Dla dzieci › Zabawki › Puzzle › Puzzle piankowe', leaf: true },
    { id: 'spatial', name: 'Puzzle przestrzenne 3D, 4D', path: 'Dla dzieci › Zabawki › Puzzle › Puzzle przestrzenne 3D, 4D', leaf: true },
    { id: 'traditional', name: 'Puzzle tradycyjne', path: 'Dla dzieci › Zabawki › Puzzle › Puzzle tradycyjne', leaf: true },
  ]);
  assert.equal(result.selected.id, 'traditional');
  assert.equal(result.intent.subtype, 'traditional');
  assert.equal(result.autoApplicable, true);
  assert.ok(result.confidence >= 0.94);
});

test('Mały Konstruktor Helios nie jest mylony z balonem na hel', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Mały Konstruktor Helios - zestaw do samodzielnego montażu Constructor',
    kategoria: 'Mały Konstruktor Junior',
    opisKrotki: 'Metalowy zestaw konstrukcyjny do samodzielnego montażu.',
  }, [
    { id: 'construction', name: 'Zestawy konstrukcyjne', path: 'Dla dzieci › Zabawki › Majsterkowanie dla dzieci › Zestawy konstrukcyjne', leaf: true },
    { id: 'balloons', name: 'Balony', path: 'Dla dzieci › Okazje i przyjęcia › Dekoracje i gadżety › Balony', leaf: true },
    { id: 'blocks', name: 'Klocki konstrukcyjne', path: 'Dla dzieci › Zabawki › Klocki › Klocki konstrukcyjne', leaf: true },
  ]);
  assert.equal(result.selected.id, 'construction');
  assert.equal(result.intent.type, 'construction');
  assert.equal(result.autoApplicable, true);
});

test('Montino z rurek 3D nie staje się grą przez techniczne pole liczby graczy', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Montino 75 - kreatywny zestaw konstrukcyjny Alexander',
    kategoria: 'Montino- Rurki 3D',
    opisKrotki: 'Zestaw do tworzenia konstrukcji z kolorowych rurek 3D i złączek.',
    parametryProducenta: { liczbaGraczy: '1+', wiek: '7-107' },
  }, [
    { id: 'tubes', name: 'Wafle, jeżyki i słomki konstrukcyjne', path: 'Dla dzieci › Zabawki › Klocki › Wafle, jeżyki i słomki konstrukcyjne', leaf: true },
    { id: 'sets', name: 'Zestawy konstrukcyjne', path: 'Dla dzieci › Zabawki › Majsterkowanie dla dzieci › Zestawy konstrukcyjne', leaf: true },
    { id: 'educational', name: 'Zabawki konstrukcyjne', path: 'Dla dzieci › Zabawki › Zabawki edukacyjne › Zabawki konstrukcyjne', leaf: true },
    { id: 'blocks', name: 'Klocki konstrukcyjne', path: 'Dla dzieci › Zabawki › Klocki › Klocki konstrukcyjne', leaf: true },
    { id: 'games', name: 'Słowne i liczbowe', path: 'Kultura i rozrywka › Gry › Planszowe › Słowne i liczbowe', leaf: true },
  ]);
  assert.equal(result.selected.id, 'tubes');
  assert.equal(result.intent.type, 'construction');
  assert.equal(result.intent.subtype, 'tubes');
  assert.equal(result.autoApplicable, true);
});

test('drewniany zestaw konstrukcyjny ECO FUN wygrywa ze starą kategorią sklepu Gry ekologiczne', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'ECO FUN - Kółko Graniaste - drewniany zestaw konstrukcyjny',
    kategoria: 'Gry ekologiczne - ECO FUN',
    opisKrotki: 'Drewniane elementy do samodzielnego budowania konstrukcji.',
  }, [
    { id: 'sets', name: 'Zestawy konstrukcyjne', path: 'Dla dzieci › Zabawki › Majsterkowanie dla dzieci › Zestawy konstrukcyjne', leaf: true },
    { id: 'games', name: 'Pozostałe gry planszowe', path: 'Kultura i rozrywka › Gry › Planszowe › Pozostałe gry planszowe', leaf: true },
    { id: 'blocks', name: 'Klocki konstrukcyjne', path: 'Dla dzieci › Zabawki › Klocki › Klocki konstrukcyjne', leaf: true },
  ]);
  assert.equal(result.selected.id, 'sets');
  assert.equal(result.intent.type, 'construction');
  assert.equal(result.intent.subtype, 'set');
  assert.equal(result.autoApplicable, true);
});

test('gra rodzinna nie może zostać dopasowana do akcesoriów dla mamy', () => {
  const result = suggestVonHalskyCategory(
    {
      nazwa: '100 Gier - zestaw gier rodzinnych Alexander',
      kategoria: 'Gry familijne i dla dzieci',
      producent: 'Alexander',
      opisKrotki: 'Zestaw klasycznych gier planszowych dla całej rodziny.',
    },
    [
      { id: 'wrong', name: 'Adaptery do pasów', path: 'Dla dzieci › Akcesoria dla mamy i dziecka › Akcesoria dla mamy › Adaptery do pasów', leaf: true },
      { id: 'right', name: 'Rodzinne', path: 'Kultura i rozrywka › Gry › Planszowe › Rodzinne', leaf: true },
      { id: 'digital', name: 'Gry na PC', path: 'Kultura i rozrywka › Gry › Gry na PC', leaf: true },
    ],
  );
  assert.equal(result.selected.id, 'right');
  assert.equal(result.autoApplicable, true);
  assert.equal(result.intent.type, 'board_game');
  assert.equal(result.intent.subtype, 'family');
});

test('jawna gra planszowa wygrywa ze starą błędną kategorią sklepu gry karciane', () => {
  const result = suggestVonHalskyCategory({
    nazwa: 'Kapibary na Start - Gra planszowa Alexander',
    kategoria: 'Gry karciane',
    opisKrotki: 'Rodzinna gra planszowa dla dzieci od 5 lat i 2-4 graczy. Producent oferuje też puzzle, wiatraki i karty.',
    parametryProducenta: { wiek: '5+', liczbaGraczy: '2-4' },
  }, [
    { id: 'family', name: 'Rodzinne', path: 'Kultura i rozrywka › Gry › Planszowe › Rodzinne', leaf: true },
    { id: 'cards', name: 'Pozostałe gry karciane', path: 'Kultura i rozrywka › Gry › Karciane › Pozostałe gry karciane', leaf: true },
    { id: 'other', name: 'Pozostałe gry planszowe', path: 'Kultura i rozrywka › Gry › Planszowe › Pozostałe gry planszowe', leaf: true },
  ]);
  assert.equal(result.selected.id, 'family');
  assert.equal(result.intent.subtype, 'family');
  assert.equal(result.intent.type, 'board_game');
  assert.equal(result.autoApplicable, true);
});

test('zestaw wielu gier nie przegrywa z pojedynczym domino znalezionym w opisie zawartości', () => {
  const result = suggestVonHalskyCategory({
    nazwa: '20 Gier - zestaw klasycznych rozgrywek Alexander',
    opis: 'W zestawie znajdują się warcaby, młynek, domino, pamięć i Piotruś.',
    kategoria: 'Gry rodzinne',
  }, [
    { id: 'family', name: 'Rodzinne', path: 'Kultura i rozrywka › Gry › Planszowe › Rodzinne', leaf: true },
    { id: 'domino', name: 'Domino', path: 'Kultura i rozrywka › Gry › Tradycyjne › Domino', leaf: true },
  ], { minimumConfidence: 0.82 });
  assert.equal(result.selected.id, 'family');
  assert.equal(result.autoApplicable, true);
});

test('indeks pełnego drzewa Von Halsky jest kompilowany raz i obsługuje duży katalog bez ponownego przeliczania kategorii', () => {
  const categories = Array.from({ length: 8076 }, (_, index) => ({
    id: `category-${index}`,
    name: index === 8075 ? 'Rodzinne' : `Kategoria ${index}`,
    path: index === 8075
      ? 'Kultura i rozrywka › Gry › Planszowe › Rodzinne'
      : `Dział ${index % 80} › Grupa ${index % 500} › Kategoria ${index}`,
    leaf: true,
  }));
  const startedAt = performance.now();
  const categoryIndex = compileVonHalskyCategoryIndex(categories);
  const results = Array.from({ length: 50 }, (_, index) => suggestVonHalskyCategory({
    id: `product-${index}`,
    nazwa: `Rodzinna gra planszowa ${index}`,
    kategoria: 'Gry rodzinne',
  }, categories, { categoryIndex }));
  const duration = performance.now() - startedAt;
  assert.equal(categoryIndex.size, 8076);
  assert.ok(results.every((result) => result.selected?.id === 'category-8075'));
  assert.ok(results.every((result) => result.categoryTreeSize === 8076));
  assert.ok(duration < 2000, `dopasowanie trwało ${Math.round(duration)} ms`);
});

test('Agent może bezpiecznie odziedziczyć kategorię z zaakceptowanych ofert tej samej gałęzi sklepu', () => {
  const categories = [
    { id: 'family', name: 'Rodzinne', path: 'Kultura i rozrywka › Gry › Planszowe › Rodzinne', leaf: true },
    { id: 'educational', name: 'Logiczne i edukacyjne', path: 'Kultura i rozrywka › Gry › Planszowe › Logiczne i edukacyjne', leaf: true },
  ];
  const relatedProducts = [
    { id: 'accepted-1', nazwa: 'Gra A', kategoria: 'Gry familijne', vonHalskyCategoryId: 'family' },
    { id: 'accepted-2', nazwa: 'Gra B', kategoria: 'Gry familijne', vonHalskyCategoryId: 'family' },
    { id: 'untrusted', nazwa: 'Gra C', kategoria: 'Gry familijne', vonHalskyCategoryId: 'educational' },
  ];
  const result = suggestVonHalskyCategory({
    id: 'target',
    nazwa: 'Nowa pozycja wydawnicza',
    kategoria: 'Gry familijne',
  }, categories, {
    categoryIndex: compileVonHalskyCategoryIndex(categories),
    relatedProducts,
    trustedProductIds: new Set(['accepted-1', 'accepted-2']),
  });
  assert.equal(result.selected.id, 'family');
  assert.equal(result.source, 'accepted_catalog_consensus');
  assert.equal(result.autoApplicable, true);
  assert.match(result.selected.evidence.join(' '), /2 zaakceptowane oferty/);
});

test('znany producent Alexander otrzymuje kompletną, źródłową kartotekę GPSR', () => {
  const result = resolveVonHalskyResponsibleProducer({
    producent: 'Alexander',
    marka: 'MilliWOOD',
  });
  assert.equal(result.ready, true);
  assert.equal(result.value.legalName, 'Zakład Produkcyjny "Alexander" Piotr Pundzis');
  assert.match(result.value.address, /Telewizyjna 19/);
  assert.equal(result.value.email, 'alexander@alexander.com.pl');
  assert.match(result.value.phone, /58 552 83 70/);
  assert.equal(result.evidence.method, 'verified-producer-alias');
});

test('blok Podmiot odpowiedzialny ze źródła jest zamieniany na dane strukturalne', () => {
  const value = responsibleProducerFromSourceText(
    'Podmiot odpowiedzialny Producent: Firma Testowa Sp. z o.o. Adres: ul. Dobra 1 Kod pocztowy: 00-001 Miasto: Warszawa Kraj: Polska Adres email: gpsr@example.test Numer telefonu: +48 500 600 700',
    { sourceUrl: 'https://producent.example.test/produkt' },
  );
  assert.equal(value.legalName, 'Firma Testowa Sp. z o.o.');
  assert.equal(value.postalCode, '00-001');
  assert.equal(value.city, 'Warszawa');
  assert.equal(value.email, 'gpsr@example.test');
  assert.equal(value.phone, '+48 500 600 700');
});

test('parser odrzuca fragment interfejsu sklepu podszywający się pod nazwę producenta', () => {
  const value = responsibleProducerFromSourceText(
    'Producent: a 2015582123113 Gwarancja [Gwarancja](http://example.test) Kolor Brązowy Adres: Via del Lavoro 33 Kod pocztowy: 47853 Miasto: Pian delle Pieve Kraj: Włochy',
    { sourceUrl: 'https://hurtowniabalonow.pl/produkt' },
  );
  assert.equal(value?.legalName || '', '');
});

test('gotowość kanału wymaga kompletnego GPSR po włączeniu tej kontroli', () => {
  const base = {
    nazwa: 'Gra rodzinna Alexander',
    opis: 'Pełny opis produktu zawiera wszystkie najważniejsze cechy, przeznaczenie, zawartość zestawu i informacje potrzebne klientowi.',
    ean: '5906018000030',
    zdjecie: '/produkt.webp',
    cena: 39.9,
    producent: 'Alexander',
    vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
    vonHalskyGpsrRequired: true,
    vonHalskyAttributeDefinitions: [],
  };
  const blocked = vonHalskyProductReadiness(base);
  assert.equal(blocked.publishable, false);
  assert.ok(blocked.issues.some((issue) => issue.includes('GPSR')));
  const producer = resolveVonHalskyResponsibleProducer(base).value;
  const ready = vonHalskyProductReadiness({ ...base, vonHalskyResponsibleProducer: producer });
  assert.equal(ready.publishable, true);
  assert.deepEqual(ready.gpsrMissing, []);
});

test('payload oferty przekazuje GPSR na najwyższym poziomie i nie wymaga telefonu', () => {
  const base = {
    id: 'GPSR-1', nazwa: 'Gra rodzinna z kompletem elementów',
    opis: 'Pełny opis produktu zawiera przeznaczenie, zawartość zestawu, najważniejsze cechy oraz informacje potrzebne klientowi do świadomego wyboru.',
    ean: '5906018000030', producent: 'Producent Testowy', zdjecie: '/produkt.webp', cena: 49.9, stan: 3,
    vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
    vonHalskyCategoryTreeValid: true, vonHalskyAttributeDefinitions: [],
    vonHalskyResponsibleProducer: { legalName: 'Producent Testowy Sp. z o.o.', address: 'ul. Testowa 1, 00-001 Warszawa, Polska', email: 'gpsr@example.test' },
    vonHalskySafetyInformation: 'Używać zgodnie z przeznaczeniem i pod nadzorem osoby dorosłej.',
  };
  const proposal = vonHalskyOfferProposal(vonHalskyOfferProjection(base));
  assert.equal(proposal.gpsr.manufacturer.name, 'Producent Testowy Sp. z o.o.');
  assert.equal(proposal.gpsr.manufacturer.email, 'gpsr@example.test');
  assert.equal(proposal.gpsr.manufacturer.unstructuredAddress, 'ul. Testowa 1, 00-001 Warszawa, Polska');
  assert.equal(Object.hasOwn(proposal.gpsr.manufacturer, 'phone'), false);
  assert.equal(Object.hasOwn(proposal.product, 'gpsr'), false);
});

test('PENDING z błędami walidacji jest błędem weryfikacji, a nie oczekującą ofertą', () => {
  const source = {
    offer: { id: 'OFFER-INVALID', status: 'PENDING' },
    metadata: { validationErrors: [{ validationCode: 'PARAMETER_REQUIRED', validationMessage: 'Uzupełnij Minimalny wiek dziecka' }] },
  };
  assert.equal(vonHalskyEffectiveOfferStatus(source), 'VERIFICATION_ERROR');
  assert.deepEqual(vonHalskyCatalogTruthSummary([source]), {
    total: 1, published: 0, pending: 0, verificationErrors: 1, rejected: 0, problems: 1, closed: 0,
    statuses: { VERIFICATION_ERROR: 1 }, providerStatuses: { PENDING: 1 },
  });
});

test('Agent Von Halsky mapuje parametry wyłącznie po dokładnej nazwie i wartości słownika', () => {
  const result = matchVonHalskyAttributes({
    parametry: { Kolor: 'Czerwony', Materiał: 'Folia', Motyw: 'Serce' },
  }, {
    attributes: [
      { id: 'color', name: 'Kolor', required: true, values: [{ id: 'red', name: 'Czerwony' }, { id: 'blue', name: 'Niebieski' }] },
      { id: 'material', name: 'Materiał', required: true, values: [{ id: 'paper', name: 'Papier' }] },
      { id: 'theme', name: 'Motyw', required: false },
    ],
  });
  assert.deepEqual(result.mapped, { color: 'red', theme: 'Serce' });
  assert.deepEqual(result.missingRequired, ['Materiał']);
  assert.equal(result.coverage, 0.5);
  assert.equal(result.exactOnly, true);
});

test('Agent Von Halsky rozpoznaje kontrolowany alias minimalnego wieku i zachowuje dokładnie jedną wartość', () => {
  const result = matchVonHalskyAttributes({
    parametry: { 'Wiek dziecka': '6 lat' },
  }, {
    attributes: [{ id: 'minimum-age', name: 'Minimalny wiek dziecka', expectedValue: 'ONE', type: 'TEXT' }],
  });
  assert.deepEqual(result.mapped, { 'minimum-age': '6 lat' });
  assert.deepEqual(result.missingRequired, []);
  assert.equal(result.evidence[0].strategy, 'verified-semantic-alias');
  assert.equal(result.semanticAliases, true);

  const ambiguous = matchVonHalskyAttributes({
    parametry: { 'Wiek dziecka': ['6 lat', '8 lat'] },
  }, {
    attributes: [{ id: 'minimum-age', name: 'Minimalny wiek dziecka', expectedValue: 'ONE', type: 'TEXT' }],
  });
  assert.deepEqual(ambiguous.mapped, {});
  assert.deepEqual(ambiguous.missingRequired, ['Minimalny wiek dziecka']);
});

test('Agent Von Halsky wykorzystuje potwierdzony konsensus wieku zapisany przez przygotowanie Allegro', () => {
  const result = matchVonHalskyAttributes({
    allegroParameterEvidence: {
      age: { value: '4 lat', source: 'konsensus 2 podobnych produktów', confidence: 0.9 },
    },
  }, {
    attributes: [{ id: 'minimum-age', name: 'Minimalny wiek dziecka', expectedValue: 'ONE', type: 'TEXT_VALUE' }],
  });
  assert.deepEqual(result.mapped, { 'minimum-age': '4 lat' });
  assert.deepEqual(result.missingRequired, []);
  assert.equal(result.evidence[0].source, 'minimalny wiek dziecka');
});

test('fakt wieku z oficjalnego opakowania wygrywa z wartością podobnych produktów', () => {
  const result = matchVonHalskyAttributes({
    productPackagingFacts: {
      minimumAge: '6+',
      sourceType: 'official_manufacturer_packaging',
      sourceUrl: 'https://producent.example.test/x-press-me-opakowanie.jpg',
    },
    parametryProducenta: { wiek: '8+' },
  }, {
    attributes: [{
      id: 'minimum-age',
      name: 'Minimalny wiek dziecka',
      type: 'TEXT_VALUE',
      required: true,
    }],
  });
  assert.deepEqual(result.mapped, { 'minimum-age': '6+' });
  assert.equal(result.missingRequired.length, 0);
  assert.equal(result.evidence[0].value, '6+');
});

test('Agent Von Halsky łączy parametry źródła i producenta oraz rozpoznaje ich techniczne nazwy', () => {
  const result = matchVonHalskyAttributes({
    parametryZrodla: { wiek: '12+', 'ilosc puzzli': '580' },
    parametryProducenta: { kodProducenta: '5032', ean: '5906018050325' },
  }, {
    attributes: [
      { id: 'minimum-age', name: 'Minimalny wiek dziecka', expectedValue: 'ONE', type: 'TEXT_VALUE' },
      { id: 'elements', name: 'Liczba elementów', expectedValue: 'ONE', type: 'TEXT_VALUE' },
      { id: 'manufacturer-code', name: 'Kod producenta', expectedValue: 'ONE', type: 'TEXT_VALUE' },
      { id: 'ean', name: 'EAN', expectedValue: 'ONE', type: 'TEXT_VALUE' },
    ],
  });
  assert.deepEqual(result.mapped, {
    'minimum-age': '12+',
    elements: '580',
    'manufacturer-code': '5032',
    ean: '5906018050325',
  });
  assert.deepEqual(result.missingRequired, []);
  assert.equal(result.coverage, 1);
});

test('wynik Agenta Von Halsky zapisuje dowody, braki i wersję reguł', () => {
  const patch = vonHalskyAgentPreparationPatch({
    product: { ean: '5906018000030' },
    readiness: { publishable: false, score: 76, issues: ['Brak kategorii'], publicationIssues: [], warnings: ['Jedno zdjęcie'], identifiers: { ean: '5906018000030' } },
    categoryMatch: { selected: { id: 'games', name: 'Gry', path: 'Zabawki › Gry', evidence: ['zgodność 100%'] }, confidence: 0.91, autoApplicable: true },
    attributeMatch: { coverage: 0.5, missingRequired: ['Wiek'], evidence: [{ attributeId: 'players' }] },
    timestamp: '2026-07-29T10:00:00.000Z',
    savedFields: ['vonHalskyTitle', 'vonHalskyDescription'],
    runId: 'run-vh-1',
  });
  assert.equal(patch.vonHalskyAgentStatus, 'requires_data');
  assert.equal(patch.vonHalskyAgentEvidence.identity, 'gtin');
  assert.equal(patch.vonHalskyAgentEvidence.attributesMapped, 1);
  assert.deepEqual(patch.vonHalskyAgentMissingAttributes, ['Wiek']);
  assert.deepEqual(patch.vonHalskyAgentSavedFields, ['vonHalskyTitle', 'vonHalskyDescription']);
  assert.equal(patch.vonHalskyAgentReadbackConfirmed, false);
  assert.equal(patch.vonHalskyAgentSaveState, 'pending_readback');
  assert.equal(patch.vonHalskyAgentPreparationRunId, 'run-vh-1');
  assert.match(patch.vonHalskyAgentRulesVersion, /^2026-08-06/);
});

test('minimalny stan kanału nigdy nie przekracza ustawionego maksimum', () => {
  const settings = normalizeVonHalskySettings({ minimumStock: 50, maximumStock: 5 });
  assert.equal(settings.minimumStock, 5);
  assert.equal(settings.maximumStock, 5);
});

test('publiczny status nigdy nie ujawnia sekretu API', () => {
  const config = vonHalskyPublicConfig({
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.example.test',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'top-secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
    INPOST_VON_HALSKY_HEALTH_PATH: '/health',
    INPOST_VON_HALSKY_CATALOG_PATH: '/catalog',
    INPOST_VON_HALSKY_ORDERS_PATH: '/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '2026-07',
  });
  assert.equal(config.configured, true);
  assert.equal(JSON.stringify(config).includes('top-secret'), false);
});

test('projekcja kanału nie przenosi pól administracyjnych i ogranicza prezentowany stan', () => {
  const projection = vonHalskyOfferProjection({
    id: 'P-1',
    externalId: '0031',
    nazwa: 'Alexander Mistrz mnożenia',
    opis: 'Pełny opis produktu zawiera najważniejsze cechy, przeznaczenie, zawartość zestawu oraz informacje przydatne klientowi podczas wyboru gry edukacyjnej.',
    ean: '5906018000030',
    producent: 'Alexander',
    zdjecia: ['/one.webp', '/two.webp'],
    cena: 39.9,
    stan: 400,
    cenaZakupu: 12.5,
    vonHalskyDoesNotRequireGpsrInfo: true,
  }, { maximumStock: 25 });
  assert.equal(projection.stock, 25);
  assert.equal(projection.readiness.ready, true);
  assert.equal('cenaZakupu' in projection, false);
});

test('aktywny produkt dostępny u dostawcy zachowuje minimalny stan kanału, a wstrzymany ma zero', () => {
  const settings = { minimumStock: 3, maximumStock: 25 };
  const product = {
    id: 'P-2',
    nazwa: 'Alexander Mistrz mnożenia',
    opis: 'Pełny opis produktu zawiera najważniejsze cechy, przeznaczenie, zawartość zestawu oraz informacje przydatne klientowi podczas wyboru gry edukacyjnej.',
    ean: '5906018000030',
    producent: 'Alexander',
    zdjecie: '/one.webp',
    cena: 39.9,
  };
  const active = vonHalskyOfferProjection({ ...product, stan: 0 }, settings);
  const hidden = vonHalskyOfferProjection({ ...product, stan: 12, sprzedazAktywna: false }, settings);
  assert.equal(active.available, true);
  assert.equal(active.stock, 3);
  assert.equal(hidden.available, false);
  assert.equal(hidden.stock, 0);
});

test('Von Halsky domyślnie dziedziczy cenę Allegro, ale respektuje własną cenę kanału', () => {
  assert.equal(vonHalskyEffectivePrice({ cena: 20, cenaAllegro: 24.9 }), 24.9);
  assert.equal(vonHalskyEffectivePrice({ cena: 20, cenaAllegro: 24.9, cenaVonHalsky: 27.5 }), 27.5);
  const projection = vonHalskyOfferProjection({
    id: 'VH-PRICE', nazwa: 'Produkt testowy Von Halsky', opis: 'Pełny opis produktu zawiera wszystkie wymagane informacje potrzebne klientowi do świadomego i bezpiecznego wyboru produktu.',
    ean: '5906018000030', zdjecie: '/one.webp', cena: 20, cenaAllegro: 24.9,
  });
  assert.equal(projection.price, 24.9);
});

test('Von Halsky dziedziczy treść sklepu i nigdy nie pobiera starszego opisu Allegro', () => {
  const product = {
    nazwa: 'Nazwa produktu w sklepie',
    opisKrotki: 'Krótkie wprowadzenie zapisane w sklepie.',
    opis: 'Aktualny długi opis sklepu z najważniejszymi cechami produktu i kompletną informacją dla klienta.',
    opisAllegro: 'STARY OPIS ALLEGRO',
    allegroDescription: 'INNA TREŚĆ ALLEGRO',
  };
  const presentation = vonHalskyProductPresentation(product);
  assert.equal(presentation.mode, 'store');
  assert.equal(presentation.name, 'Nazwa produktu w sklepie');
  assert.match(presentation.description, /Krótkie wprowadzenie/);
  assert.match(presentation.description, /Aktualny długi opis sklepu/);
  assert.doesNotMatch(presentation.description, /ALLEGRO/);
});

test('Von Halsky pozwala na świadome dopasowanie kanałowe z bezpiecznym fallbackiem do sklepu', () => {
  const product = {
    nazwa: 'Nazwa sklepu',
    opisKrotki: 'Krótki opis sklepu.',
    opis: 'Długi opis sklepu pozostaje źródłem, gdy własne pole kanału jest puste.',
    vonHalskyContentMode: 'custom',
    vonHalskyTitle: 'Tytuł dopasowany do Von Halsky',
    vonHalskyShortDescription: 'Kanałowe wprowadzenie.',
  };
  const presentation = vonHalskyProductPresentation(product);
  assert.equal(presentation.mode, 'custom');
  assert.equal(presentation.name, 'Tytuł dopasowany do Von Halsky');
  assert.match(presentation.description, /Kanałowe wprowadzenie/);
  assert.match(presentation.description, /Długi opis sklepu/);
});

test('ukryty produkt pozostaje zablokowany w projekcji kanału Von Halsky', () => {
  const base = { id: 'VH-HIDDEN', nazwa: 'Produkt ukryty w sprzedaży', opis: 'Pełny opis produktu zawiera wszystkie wymagane informacje potrzebne klientowi do świadomego i bezpiecznego wyboru produktu.', ean: '5906018000030', zdjecie: '/one.webp', cena: 20 };
  for (const blocked of [{ saleAvailable: false }, { ukryty: true }, { _catalog: { availability: { saleAvailable: false } } }]) {
    const projection = vonHalskyOfferProjection({ ...base, ...blocked, stan: 8 }, { minimumStock: 1, maximumStock: 25 });
    assert.equal(projection.available, false);
    assert.equal(projection.stock, 0);
  }
});

test('Von Halsky przy linku źródłowym używa tylko galerii potwierdzonej przez stronę produktu', () => {
  const base = {
    id: 'VH-SOURCE', nazwa: 'Produkt ze źródła producenta', opis: 'Pełny opis produktu zawiera wszystkie wymagane informacje potrzebne klientowi do świadomego i bezpiecznego wyboru produktu.',
    ean: '5906018000030', cena: 20, sourceUrl: 'https://producent.example.pl/produkt/1', zdjecie: 'https://wrong.example.pl/inny.jpg',
  };
  assert.equal(vonHalskyProductReadiness(base).hasImage, false);
  const verified = {
    ...base,
    sourceEvidence: {
      imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION,
      imageSourceType: 'product_source_page',
      imageSourceUrl: base.sourceUrl,
      imageUrls: ['https://cdn.example.pl/produkt-1.jpg'],
    },
  };
  const projection = vonHalskyOfferProjection(verified);
  assert.deepEqual(projection.images, ['https://cdn.example.pl/produkt-1.jpg']);
});

test('kanał wysyła tylko jedną najlepszą kartotekę dla tego samego EAN', () => {
  const { items, conflicts } = deduplicateVonHalskyOffers([
    { externalId: 'A', gtin: '5906018000030', available: true, readiness: { score: 72 } },
    { externalId: 'B', gtin: '5906018000030', available: true, readiness: { score: 98 } },
    { externalId: 'C', gtin: '5906018000108', available: true, readiness: { score: 80 } },
  ]);
  assert.equal(items.length, 2);
  assert.equal(conflicts.length, 1);
  assert.equal(items.find((item) => item.gtin === '5906018000030').externalId, 'B');
});

test('klient API wykonuje rzeczywisty OAuth i test endpointu bez ujawniania sekretu', async () => {
  const calls = [];
  const env = {
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.example.test',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'top-secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
    INPOST_VON_HALSKY_HEALTH_PATH: '/health',
    INPOST_VON_HALSKY_CATALOG_PATH: '/catalog',
    INPOST_VON_HALSKY_ORDERS_PATH: '/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '2026-07',
  };
  const client = createVonHalskyApiClient({
    env,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'bearer-value', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' } });
    },
    now: () => Date.parse('2026-07-23T10:00:00.000Z'),
  });
  const result = await client.checkConnection();
  assert.equal(result.connected, true);
  assert.equal(result.requestId, 'req-1');
  assert.equal(calls.length, 2);
  assert.equal(String(calls[1].options.headers.authorization).includes('bearer-value'), true);
  assert.equal(JSON.stringify(result).includes('top-secret'), false);
});

test('klient API zachowuje prefiks ścieżki produkcyjnego adresu bazowego', async () => {
  const calls = [];
  const env = {
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.inpost-group.com/inpsa/',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
    INPOST_VON_HALSKY_HEALTH_PATH: '/v1/offers',
    INPOST_VON_HALSKY_CATALOG_PATH: '/v1/offers/batch',
    INPOST_VON_HALSKY_ORDERS_PATH: '/v1/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '1.5.8',
  };
  const client = createVonHalskyApiClient({
    env,
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ data: [], page: { limit: 30, offset: 0, total: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.listOffers();
  assert.equal(new URL(calls[1]).pathname, '/inpsa/v1/offers');
});

test('aktualizacja istniejącej oferty używa wymaganego JSON Merge Patch', async () => {
  const calls = [];
  const env = {
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.inpost-group.com/inpsa/',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'org-123',
    INPOST_VON_HALSKY_HEALTH_PATH: '/v1/categories',
    INPOST_VON_HALSKY_CATALOG_PATH: '/v1/organizations/org-123/offers/batch',
    INPOST_VON_HALSKY_ORDERS_PATH: '/v1/organizations/org-123/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '1.5.8',
  };
  const client = createVonHalskyApiClient({
    env,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.updateOffer('offer-1', { product: { name: 'Gra rodzinna' } });
  assert.equal(calls[1].options.headers['content-type'], 'application/merge-patch+json');
  assert.deepEqual(JSON.parse(calls[1].options.body), { product: { name: 'Gra rodzinna' } });
});

test('klient API obsługuje statusy poleceń, zwroty, reklamacje i refundacje kontraktu 1.5.8', async () => {
  const calls = [];
  const env = {
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.inpost-group.com/inpsa/',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'org-123',
    INPOST_VON_HALSKY_HEALTH_PATH: '/v1/organizations/org-123/offers',
    INPOST_VON_HALSKY_CATALOG_PATH: '/v1/organizations/org-123/offers/batch',
    INPOST_VON_HALSKY_ORDERS_PATH: '/v1/organizations/org-123/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '1.5.8',
  };
  const client = createVonHalskyApiClient({
    env,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ status: 'SUCCESS', data: [], items: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.getOfferCommand('command-1');
  await client.fetchReturns({ limit: 12 });
  await client.fetchClaims({ state: ['RESOLUTION_IN_PROGRESS'] });
  await client.refundOrder('order-1', 19.99);
  await client.resolveClaim('order-1', 'claim-1', 'partial-refund', 'Uznana część roszczenia');
  const requests = calls.slice(1);
  assert.equal(new URL(requests[0].url).pathname, '/inpsa/v1/organizations/org-123/offers/commands/command-1');
  assert.equal(new URL(requests[1].url).pathname, '/inpsa/v1/organizations/org-123/returns');
  assert.equal(new URL(requests[1].url).searchParams.get('limit'), '12');
  assert.equal(new URL(requests[2].url).searchParams.get('state'), 'RESOLUTION_IN_PROGRESS');
  assert.equal(new URL(requests[3].url).pathname, '/inpsa/v1/organizations/org-123/orders/order-1/refund');
  assert.deepEqual(JSON.parse(requests[3].options.body), { amount: { amount: 19.99, currency: 'PLN' } });
  assert.equal(new URL(requests[4].url).pathname, '/inpsa/v1/organizations/org-123/orders/order-1/claims/claim-1/partial-refund');
  assert.deepEqual(JSON.parse(requests[4].options.body), { description: 'Uznana część roszczenia' });
  assert.ok(requests.slice(3).every((request) => request.options.headers['idempotency-key']));
});

test('route zapisuje konfigurację i uczciwie zgłasza brak danych prywatnego API', async () => {
  let state;
  let revision = 0;
  const respond = (body, status = 200) => ({ body, status });
  const route = createVonHalskyRoute({
    respond,
    isAdmin: () => true,
    readVersioned: async (_key, fallback) => ({ value: state || fallback, revision }),
    writeIfVersion: async (_key, value) => { state = value; revision += 1; return { modified: true }; },
    env: () => ({}),
  });
  const settingsRequest = new Request('https://artwaytm.pl/api?action=von-halsky-settings', {
    method: 'POST',
    body: JSON.stringify({ integrationMethod: 'api', maximumStock: 30, onboarding: { merchantAccount: true } }),
  });
  const saved = await route(settingsRequest, new URL(settingsRequest.url), 'von-halsky-settings');
  assert.equal(saved.status, 200);
  assert.equal(saved.body.settings.maximumStock, 30);
  assert.equal(saved.body.settings.onboarding.merchantAccount, true);
  const checkRequest = new Request('https://artwaytm.pl/api?action=von-halsky-connection-check', { method: 'POST' });
  const checked = await route(checkRequest, new URL(checkRequest.url), 'von-halsky-connection-check');
  assert.equal(checked.status, 503);
  assert.equal(checked.body.connected, false);
  assert.equal(checked.body.code, 'von_halsky_not_configured');
  const scheduledRequest = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST',
    body: JSON.stringify({ publish: true, scheduled: true }),
  });
  const scheduled = await route(scheduledRequest, new URL(scheduledRequest.url), 'von-halsky-sync-catalog');
  assert.equal(scheduled.status, 200);
  assert.equal(scheduled.body.skipped, true);
  assert.equal(scheduled.body.reason, 'not-configured');
});

test('korekta dopasowania zapisuje aliasy identyfikatorów i blokuje duplikat EAN', async () => {
  const products = [
    { id: 'P-1', nazwa: 'Gra pierwsza', ean: '', producent: '' },
    { id: 'P-2', nazwa: 'Gra druga', ean: '', producent: '' },
  ];
  const saves = [];
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async (_key, fallback) => ({ value: fallback, revision: 0 }),
    writeIfVersion: async () => ({ modified: true }),
    loadCatalog: async () => products,
    saveProductFields: async (input) => {
      saves.push(structuredClone(input));
      Object.assign(products.find((product) => product.id === input.productId), input.fields);
      return { confirmed: true };
    },
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-product-matching', {
    method: 'POST',
    body: JSON.stringify({ productId: 'P-1', ean: '5906018000030', producerCode: '0030', producer: 'Alexander', brand: 'MilliWOOD' }),
  });
  const saved = await route(request, new URL(request.url), 'von-halsky-product-matching');
  assert.equal(saved.status, 200);
  assert.equal(saved.body.matching.method, 'manual_gtin');
  assert.equal(saves[0].fields.ean, '5906018000030');
  assert.equal(saves[0].fields.gtin, '5906018000030');
  assert.equal(saves[0].fields.kodProducenta, '0030');
  assert.equal(saves[0].fields.mpn, '0030');
  const duplicateRequest = new Request('https://artwaytm.pl/api?action=von-halsky-product-matching', {
    method: 'POST',
    body: JSON.stringify({ productId: 'P-2', ean: '5906018000030', producerCode: 'X-2', producer: 'Alexander', brand: 'Alexander' }),
  });
  const duplicate = await route(duplicateRequest, new URL(duplicateRequest.url), 'von-halsky-product-matching');
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'von_halsky_gtin_conflict');
  assert.equal(saves.length, 1);
});

test('ręczny wybór kategorii zapisuje pełną ścieżkę i dowód z aktualnego drzewa API', async () => {
  const categoryId = 'd623476e-ea17-557d-8502-754a476d4c8e';
  const state = {
    settings: vonHalskyDefaultSettings(),
    categories: [{
      id: categoryId,
      name: 'Rodzinne',
      path: 'Kultura i rozrywka › Gry › Planszowe › Rodzinne',
      leaf: true,
    }],
  };
  let savedFields;
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async () => ({ value: state, revision: 1 }),
    writeIfVersion: async () => ({ modified: true }),
    api: emptyCategoryApi,
    saveProductFields: async ({ fields }) => {
      savedFields = structuredClone(fields);
      return { confirmed: true };
    },
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-product-category', {
    method: 'POST',
    body: JSON.stringify({ productId: 'P-1', categoryId }),
  });
  const response = await route(request, new URL(request.url), 'von-halsky-product-category');
  assert.equal(response.status, 200);
  assert.equal(savedFields.vonHalskyCategoryId, categoryId);
  assert.equal(savedFields.vonHalskyCategoryPath, 'Kultura i rozrywka › Gry › Planszowe › Rodzinne');
  assert.equal(savedFields.vonHalskyCategoryMatchedBy, 'admin');
  assert.equal(savedFields.vonHalskyCategoryResolution.source, 'admin-current-api-tree');
  assert.equal(savedFields.vonHalskyCategoryResolution.confidence, 1);
});

test('route Agenta Von Halsky zapisuje wynik w centralnej kartotece bez publikacji', async () => {
  const product = {
    id: 'VH-AGENT-1',
    nazwa: 'Gra edukacyjna Alexander',
    opis: 'Krótki opis wymagający bezpiecznego uzupełnienia przez wyspecjalizowanego Agenta.',
    ean: '5906018000030',
    producent: 'Alexander',
    zdjecie: '/produkt.webp',
    cena: 39.9,
    vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
  };
  const savedAreas = [], progress = [], mutationPayloads = new Map();
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    sessionOf: () => ({ email: 'admin@example.test' }),
    readVersioned: async (_key, fallback) => ({ value: fallback, revision: 0 }),
    writeIfVersion: async () => ({ modified: true }),
    api: emptyCategoryApi,
    loadCatalog: async () => [product],
    saveProductFields: async ({ fields, area, mutationId }) => {
      const serialized = JSON.stringify(fields);
      if (mutationPayloads.has(mutationId) && mutationPayloads.get(mutationId) !== serialized) {
        throw Object.assign(new Error('Ten identyfikator operacji został już użyty z innym zestawem zmian.'), {
          code: 'catalog_mutation_payload_conflict',
        });
      }
      mutationPayloads.set(mutationId, serialized);
      Object.assign(product, structuredClone(fields));
      savedAreas.push(area);
      return { confirmed: true, publication: { readbackConfirmed: true }, product: structuredClone(product) };
    },
    prepareProductWithAgent: async () => ({
      run: { id: 'run-vh-agent-1' },
      applied: {
        applied: true,
        patch: {
          vonHalskyContentMode: 'custom',
          vonHalskyTitle: 'Gra edukacyjna Alexander dla dzieci',
          vonHalskyShortDescription: 'Angażująca gra edukacyjna wspierająca naukę przez wspólną zabawę.',
          vonHalskyDescription: 'Angażująca gra edukacyjna wspierająca naukę przez wspólną zabawę. Zestaw zawiera elementy potrzebne do rozegrania partii i rozwijania spostrzegawczości oraz logicznego myślenia.',
        },
      },
      retryScheduled: false,
    }),
    reportProgress: async (entry) => progress.push(entry),
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-agent-prepare', {
    method: 'POST',
    body: JSON.stringify({ productIds: ['VH-AGENT-1'] }),
  });
  const response = await route(request, new URL(request.url), 'von-halsky-agent-prepare');
  assert.equal(response.status, 200);
  assert.equal(response.body.published, false);
  assert.equal(response.body.ready, 1);
  assert.equal(response.body.results[0].readbackConfirmed, true);
  assert.ok(response.body.results[0].savedFields.includes('vonHalskyTitle'));
  assert.equal(product.vonHalskyAgentStatus, 'ready');
  assert.equal(product.vonHalskyAgentError, '');
  assert.ok(savedAreas.includes('von-halsky-agent-preparation'));
  assert.deepEqual(progress.map((entry) => entry.phase), ['matching', 'editorial', 'ready']);

  const repeatedRequest = new Request('https://artwaytm.pl/api?action=von-halsky-agent-prepare', {
    method: 'POST',
    body: JSON.stringify({ productIds: ['VH-AGENT-1'] }),
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const repeatedResponse = await route(repeatedRequest, new URL(repeatedRequest.url), 'von-halsky-agent-prepare');
  assert.equal(repeatedResponse.status, 200);
  assert.equal(repeatedResponse.body.results[0].status, 'ready');
  assert.equal(repeatedResponse.body.results[0].readbackConfirmed, true);
});

test('Agent usuwa odrzuconą kategorię, dobiera grę rodzinną i zapisuje GPSR Alexandra', async () => {
  const wrongCategory = '03cd5874-e280-5d71-abef-2e5d6885c5a1';
  const rightCategory = 'd623476e-ea17-557d-8502-754a476d4c8e';
  const product = {
    id: '84',
    externalId: '0376',
    nazwa: '100 Gier - zestaw gier rodzinnych Alexander',
    opisKrotki: 'Zestaw klasycznych gier planszowych dla całej rodziny.',
    opis: 'Rozbudowany zestaw gier rodzinnych zawiera różnorodne warianty rozgrywki i elementy potrzebne do wspólnej zabawy dzieci oraz dorosłych.',
    ean: '5906018003765',
    producent: 'Alexander',
    marka: 'Alexander',
    zdjecie: '/produkt.webp',
    cena: 89.9,
    kategoria: 'Gry familijne i dla dzieci',
    vonHalskyCategoryId: wrongCategory,
  };
  const state = {
    settings: vonHalskyDefaultSettings(),
    offers: [{
      offer: { id: 'offer-84', externalId: '0376', status: 'PENDING' },
      metadata: { validationErrors: [{ validationCode: 'CATEGORY_INCORRECT', validationMessage: 'Nieprawidłowa kategoria' }] },
    }],
    categories: [
      { id: wrongCategory, name: 'Adaptery do pasów', path: 'Dla dzieci › Akcesoria dla mamy i dziecka › Akcesoria dla mamy › Adaptery do pasów', leaf: true },
      { id: rightCategory, name: 'Rodzinne', path: 'Kultura i rozrywka › Gry › Planszowe › Rodzinne', leaf: true },
    ],
  };
  const saves = [];
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async (_key, fallback) => ({ value: state || fallback, revision: 1 }),
    writeIfVersion: async () => ({ modified: true }),
    api: emptyCategoryApi,
    loadCatalog: async () => [product],
    saveProductFields: async ({ fields, area }) => {
      Object.assign(product, structuredClone(fields));
      saves.push({ area, fields: structuredClone(fields) });
      return { confirmed: true, product: structuredClone(product) };
    },
    prepareProductWithAgent: async () => ({
      run: { id: 'run-vh-84' },
      applied: {
        patch: {
          vonHalskyContentMode: 'custom',
          vonHalskyTitle: '100 gier Alexander – rodzinny zestaw planszowy',
          vonHalskyShortDescription: 'Zestaw klasycznych gier planszowych przeznaczony do wspólnej zabawy dzieci i dorosłych.',
          vonHalskyDescription: 'Rozbudowany zestaw gier rodzinnych zawiera różnorodne warianty rozgrywki oraz elementy potrzebne do wspólnej zabawy dzieci i dorosłych. Poszczególne warianty wspierają logiczne myślenie i zapewniają urozmaiconą rozgrywkę.',
        },
      },
      retryScheduled: false,
    }),
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-agent-prepare', {
    method: 'POST',
    body: JSON.stringify({ productId: '84' }),
  });
  const response = await route(request, new URL(request.url), 'von-halsky-agent-prepare');
  assert.equal(response.status, 200);
  assert.equal(response.body.ready, 1);
  assert.equal(product.vonHalskyCategoryId, rightCategory);
  assert.match(product.vonHalskyCategoryPath, /Planszowe › Rodzinne/);
  assert.equal(product.vonHalskyResponsibleProducerStatus, 'ready');
  assert.equal(product.vonHalskyResponsibleProducer.legalName, 'Zakład Produkcyjny "Alexander" Piotr Pundzis');
  assert.ok(saves.some((entry) => entry.area === 'von-halsky-agent-evidence'));
});

test('Agent odnawia dowód galerii producenta i rozpoznaje GPSR Alexandra dla marki Pink Frog', async () => {
  const product = {
    id: 'PINK-1',
    externalId: '2739',
    nazwa: 'GLUTY – gra karciana',
    opis: 'Dynamiczna gra karciana dla rodziny, której zasady opierają się na dopasowywaniu kart i podejmowaniu szybkich decyzji podczas wspólnej rozgrywki.',
    ean: '5906018027396',
    producent: 'Pink Frog',
    marka: 'Pink Frog',
    cena: 28.9,
    sourceUrl: 'https://www.sklep.alexander.com.pl/product-pol-1397-GLUTY.html',
    sourceEvidence: {
      canonicalUrl: 'https://www.sklep.alexander.com.pl/product-pol-1397-GLUTY.html',
    },
    vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
  };
  const savedAreas = [];
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async (_key, fallback) => ({ value: fallback, revision: 0 }),
    writeIfVersion: async () => ({ modified: true }),
    api: emptyCategoryApi,
    loadCatalog: async () => [product],
    sourceUrlOf: (item) => item.sourceUrl,
    inspectSource: async () => ({
      canonicalUrl: product.sourceUrl,
      product: {
        id: product.id,
        nazwa: product.nazwa,
        ean: product.ean,
        kodProducenta: product.externalId,
        zdjecie: 'https://www.sklep.alexander.com.pl/images/gluty-1.jpg',
        sourceUrl: product.sourceUrl,
        sourceEvidence: { canonicalUrl: product.sourceUrl },
      },
    }),
    sourceImages: (_item, inspection) => ({
      ok: true,
      patch: {
        zdjecie: inspection.product.zdjecie,
        zdjecia: [],
        sourceEvidence: {
          canonicalUrl: product.sourceUrl,
          imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION,
          imageSourceUrl: product.sourceUrl,
          imageUrls: [inspection.product.zdjecie],
        },
      },
    }),
    saveProductFields: async ({ fields, area }) => {
      Object.assign(product, structuredClone(fields));
      savedAreas.push(area);
      return { confirmed: true, product: structuredClone(product) };
    },
    prepareProductWithAgent: async () => ({
      run: { id: 'run-pink-1' },
      applied: { patch: {} },
      retryScheduled: false,
    }),
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-agent-prepare', {
    method: 'POST',
    body: JSON.stringify({ productId: product.id }),
  });
  const response = await route(request, new URL(request.url), 'von-halsky-agent-prepare');
  assert.equal(response.status, 200);
  assert.equal(response.body.ready, 1);
  assert.equal(product.vonHalskyResponsibleProducerStatus, 'ready');
  assert.equal(product.vonHalskyResponsibleProducer.legalName, 'Zakład Produkcyjny "Alexander" Piotr Pundzis');
  assert.equal(product.vonHalskyResponsibleProducerEvidence.method, 'verified-manufacturer-product-domain');
  assert.ok(savedAreas.includes('von-halsky-source-images'));
});

test('ręczna publikacja tworzy wyłącznie zaznaczoną ofertę i zapisuje request ID', async () => {
  let state;
  let revision = 0;
  let catalogPayload;
  let mutationRequests = 0;
  let remoteVisible = false;
  const env = {
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.example.test',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
    INPOST_VON_HALSKY_HEALTH_PATH: '/health',
    INPOST_VON_HALSKY_CATALOG_PATH: '/catalog',
    INPOST_VON_HALSKY_ORDERS_PATH: '/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '2026-01',
  };
  const fetchImpl = async (url, options = {}) => {
    if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
    const categoryResponse = categoryContractResponse(url);
    if (categoryResponse) return categoryResponse;
    if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify({
      data: remoteVisible ? [{
        offer: {
          id: '22222222-2222-4222-8222-222222222222',
          externalId: 'P-7',
          status: 'PUBLISHED',
        },
      }] : [],
      page: { limit: 30, offset: 0, total: remoteVisible ? 1 : 0 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    mutationRequests += 1;
    const payload = JSON.parse(options.body);
    if (Array.isArray(payload)) {
      catalogPayload = payload;
      remoteVisible = true;
      return new Response(JSON.stringify([{ commandId: '11111111-1111-4111-8111-111111111111', offerId: '22222222-2222-4222-8222-222222222222', externalId: 'P-7' }]), { status: 201, headers: { 'content-type': 'application/json', 'x-request-id': 'catalog-req-7' } });
    }
    return new Response(JSON.stringify({ commandId: '33333333-3333-4333-8333-333333333333' }), { status: 202, headers: { 'content-type': 'application/json', 'x-request-id': 'catalog-update-7' } });
  };
  const respond = (body, status = 200) => ({ body, status });
  const route = createVonHalskyRoute({
    respond,
    isAdmin: () => true,
    readVersioned: async (_key, fallback) => ({ value: state || fallback, revision }),
    writeIfVersion: async (_key, value) => { state = value; revision += 1; return { modified: true }; },
    env: () => env,
    fetchImpl,
    loadCatalog: async () => [{
      id: 'P-7',
      nazwa: 'Alexander Mistrz mnożenia',
      opis: 'Pełny opis produktu zawiera najważniejsze cechy, przeznaczenie, zawartość zestawu oraz informacje przydatne klientowi podczas wyboru gry edukacyjnej.',
      ean: '5906018000030',
      producent: 'Alexander',
      zdjecie: '/one.webp',
      cena: 39.9,
      stan: 8,
      vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
      vonHalskyCategoryTreeValid: true,
      vonHalskyDoesNotRequireGpsrInfo: true,
      vonHalskyAttributeDefinitions: [],
    }],
    saveProductFields: async () => ({ confirmed: true }),
  });
  const settingsRequest = new Request('https://artwaytm.pl/api?action=von-halsky-settings', {
    method: 'POST',
    body: JSON.stringify({ automaticPriceSync: false, automaticStockSync: false, catalogAutomationEnabled: true }),
  });
  await route(settingsRequest, new URL(settingsRequest.url), 'von-halsky-settings');
  const unselectedRequest = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST',
    body: JSON.stringify({ publish: true, scheduled: false }),
  });
  const unselected = await route(unselectedRequest, new URL(unselectedRequest.url), 'von-halsky-sync-catalog');
  assert.equal(unselected.status, 200);
  assert.equal(unselected.body.created, 0);
  assert.equal(unselected.body.skippedNew, 1);
  assert.equal(unselected.body.publicationMode, 'manual_selection');
  assert.equal(mutationRequests, 0);
  const syncRequest = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST',
    body: JSON.stringify({ publish: true, scheduled: false, productIds: ['P-7'] }),
  });
  const result = await route(syncRequest, new URL(syncRequest.url), 'von-halsky-sync-catalog');
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.sent, 1);
  assert.equal(Array.isArray(catalogPayload), true);
  assert.equal(catalogPayload[0].product.categoryId, '33333333-3333-4333-8333-333333333333');
  assert.deepEqual(catalogPayload[0].stock, { quantity: 8, unit: 'UNIT' });
  assert.equal(catalogPayload[0].price.grossPrice.amount, 39.9);
  assert.equal(catalogPayload[0].price.taxRateInfo, '23%');
  assert.equal(result.body.sync.lastRequestId, 'catalog-req-7');
  assert.equal(result.body.publicationMode, 'manual_selection');
  assert.equal(state.settings.catalogAutomationEnabled, false);
  const repeatedRequest = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST',
    body: JSON.stringify({ publish: true, scheduled: false, productIds: ['P-7'] }),
  });
  const repeated = await route(repeatedRequest, new URL(repeatedRequest.url), 'von-halsky-sync-catalog');
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.created, 0);
  assert.equal(repeated.body.updated, 1);
  assert.equal(repeated.body.productUpdates[0].productId, 'P-7');
  assert.equal(repeated.body.productUpdates[0].fields.vonHalskyEditorialSyncPending, false);
  assert.equal(repeated.body.productUpdates[0].fields.vonHalskyEditorialSyncState, 'synced');
  assert.equal(repeated.body.publicationConfirmed, true);
  const reconcileRequest = new Request('https://artwaytm.pl/api?action=von-halsky-reconcile-catalog', { method: 'POST' });
  const reconciled = await route(reconcileRequest, new URL(reconcileRequest.url), 'von-halsky-reconcile-catalog');
  assert.equal(reconciled.status, 200);
  assert.equal(reconciled.body.truth.published, 1);
  assert.equal(reconciled.body.productUpdates[0].fields.vonHalskyEditorialSyncState, 'synced');
  const compactRequest = new Request('https://artwaytm.pl/api?action=von-halsky-reconcile-catalog', {
    method: 'POST',
    body: JSON.stringify({ compact: true, source: 'background-worker' }),
  });
  const compact = await route(compactRequest, new URL(compactRequest.url), 'von-halsky-reconcile-catalog');
  assert.equal(compact.status, 200);
  assert.equal(compact.body.truth.published, 1);
  assert.equal(Array.isArray(compact.body.changedProductIds), true);
  assert.equal(typeof compact.body.revision, 'string');
  assert.equal(Object.hasOwn(compact.body, 'offers'), false);
  assert.equal(Object.hasOwn(compact.body, 'productUpdates'), false);
  assert.equal(compact.body.sync.lastReconciliationSource, 'background-worker');
  assert.equal(mutationRequests, 2);
});

test('publikacja dwóch kartotek z tym samym EXTERNAL_ID aktualizuje zgodny EAN i nadaje drugiej marce osobny kod kanału', async () => {
  let state, revision = 0;
  const products = new Map([
    ['1000892', {
      id: '1000892', externalId: '0157', nazwa: 'Mądra głowa Multigra zestaw ciekawostek',
      opis: 'Kompletny opis produktu Multigra zawiera przeznaczenie, zasady, zawartość zestawu i wszystkie informacje potrzebne klientowi do świadomego wyboru.',
      ean: '5906395301577', producent: 'Multigra', kodProducenta: '0157',
      zdjecie: '/multigra.webp', cena: 59.9, stan: 3,
      vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
      vonHalskyDoesNotRequireGpsrInfo: true, vonHalskyAttributeDefinitions: [],
    }],
    ['87', {
      id: '87', externalId: '0157', nazwa: '25 Gier Alexander zestaw rodzinny',
      opis: 'Kompletny opis produktu Alexander zawiera przeznaczenie, zasady, zawartość zestawu i wszystkie informacje potrzebne klientowi do świadomego wyboru.',
      ean: '5906018001570', producent: 'Alexander', kodProducenta: '0157',
      zdjecie: '/alexander.webp', cena: 79.9, stan: 2,
      vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
      vonHalskyDoesNotRequireGpsrInfo: true, vonHalskyAttributeDefinitions: [],
    }],
  ]);
  const updates = [], creations = [];
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async (_key, fallback) => ({ value: structuredClone(state || fallback), revision }),
    writeIfVersion: async (_key, value) => { state = structuredClone(value); revision += 1; return { modified: true }; },
    env: () => ({
      INPOST_VON_HALSKY_API_BASE_URL: 'https://api.example.test',
      INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
      INPOST_VON_HALSKY_CLIENT_ID: 'client',
      INPOST_VON_HALSKY_CLIENT_SECRET: 'secret',
      INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
      INPOST_VON_HALSKY_HEALTH_PATH: '/health',
      INPOST_VON_HALSKY_CATALOG_PATH: '/catalog',
      INPOST_VON_HALSKY_ORDERS_PATH: '/orders',
      INPOST_VON_HALSKY_CONTRACT_VERSION: '2026-01',
    }),
    api: {
      fetchCategories: async () => ({ payload: { id: '33333333-3333-4333-8333-333333333333', leaf: true, doesNotRequireGpsrInfo: true } }),
      fetchCategoryAttributes: async () => ({ payload: { attributes: [] } }),
      listOffers: async () => ({
        requestId: 'identity-readback',
        data: [{
          offer: {
            id: '27113452-e0d6-44a9-bd13-3b7e64e0228b', externalId: '0157', status: 'PUBLISHED',
            product: { sku: '0157', ean: '5906395301577', manufacturerProductNumber: '0157', brand: 'Multigra' },
          },
        }],
      }),
      updateOffer: async (offerId, patch) => { updates.push({ offerId, patch: structuredClone(patch) }); return { requestId: 'identity-update' }; },
      createOffers: async (proposals) => {
        creations.push(...structuredClone(proposals));
        return {
          requestId: 'identity-create',
          payload: proposals.map((proposal) => ({
            offerId: 'created-alexander-0157',
            commandId: 'command-alexander-0157',
            externalId: proposal.externalId,
            status: 'PENDING',
          })),
        };
      },
    },
    loadCatalog: async () => [...products.values()].map((item) => structuredClone(item)),
    saveProductFields: async ({ productId, fields = {}, remove = [] }) => {
      const next = { ...products.get(String(productId)), ...structuredClone(fields) };
      for (const field of remove) delete next[field];
      products.set(String(productId), next);
      return { product: structuredClone(next), publication: { readbackConfirmed: true } };
    },
  });
  const settingsRequest = new Request('https://artwaytm.pl/api?action=von-halsky-settings', {
    method: 'POST', body: JSON.stringify({ automaticPriceSync: false, automaticStockSync: false }),
  });
  await route(settingsRequest, new URL(settingsRequest.url), 'von-halsky-settings');
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST', body: JSON.stringify({ publish: true, productIds: ['1000892', '87'] }),
  });
  const result = await route(request, new URL(request.url), 'von-halsky-sync-catalog');
  assert.equal(result.status, 200);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].offerId, '27113452-e0d6-44a9-bd13-3b7e64e0228b');
  assert.equal(updates[0].patch.product.name, 'Mądra głowa Multigra zestaw ciekawostek');
  assert.equal(products.get('1000892').vonHalskyOfferId, '27113452-e0d6-44a9-bd13-3b7e64e0228b');
  assert.equal(creations.length, 1);
  assert.equal(creations[0].externalId, 'alexander-0157');
  assert.equal(products.get('87').vonHalskyExternalId, 'alexander-0157');
  assert.equal(products.get('87').vonHalskyOfferId, 'created-alexander-0157');
  assert.notEqual(products.get('87').vonHalskyEditorialSyncState, 'decision_required');
  assert.equal(result.body.remoteIdentityConflicts, 0);
  assert.equal(result.body.failedProducts.some((item) => item.productId === '87' && item.code === 'von_halsky_identity_conflict'), false);
});

test('publikacja wskazanego produktu czeka na odczyt API, a potem zapisuje trwałe potwierdzenie', async () => {
  const records = new Map(), revisions = new Map(), progress = [], products = new Map();
  let remoteVisible = false, createCalls = 0;
  const env = {
    INPOST_VON_HALSKY_API_BASE_URL: 'https://api.example.test',
    INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
    INPOST_VON_HALSKY_CLIENT_ID: 'client',
    INPOST_VON_HALSKY_CLIENT_SECRET: 'secret',
    INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
    INPOST_VON_HALSKY_HEALTH_PATH: '/health',
    INPOST_VON_HALSKY_CATALOG_PATH: '/catalog',
    INPOST_VON_HALSKY_ORDERS_PATH: '/orders',
    INPOST_VON_HALSKY_CONTRACT_VERSION: '2026-01',
  };
  const product = {
    id: 'P-17', externalId: 'EXT-17', nazwa: 'Alexander Gra edukacyjna',
    opis: 'Pełny i prawdziwy opis produktu zawierający cechy, przeznaczenie oraz zawartość potrzebną klientowi do świadomego wyboru produktu.',
    ean: '5906018000030', producent: 'Alexander', zdjecie: '/one.webp', cena: 39.9, stan: 8,
    vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
    vonHalskyEditorialSyncPending: true, vonHalskyEditorialSyncRunId: 'run-17',
    contentEditorial: { channelStates: { vonHalsky: { status: 'ready', publicationStatus: 'queued' } } },
  };
  products.set(product.id, structuredClone(product));
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }), isAdmin: () => true,
    readVersioned: async (key, fallback) => ({ value: structuredClone(records.get(key) ?? fallback), revision: revisions.get(key) || 0 }),
    writeIfVersion: async (key, value) => { records.set(key, structuredClone(value)); revisions.set(key, (revisions.get(key) || 0) + 1); return { modified: true }; },
    env: () => env,
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
      const categoryResponse = categoryContractResponse(url);
      if (categoryResponse) return categoryResponse;
      if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify({
        data: remoteVisible ? [{
          offer: {
            id: '22222222-2222-4222-8222-222222222222',
            externalId: 'EXT-17',
            status: 'PUBLISHED',
          },
        }] : [],
        page: { limit: 30, offset: 0, total: remoteVisible ? 1 : 0 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
      createCalls += 1;
      return new Response(JSON.stringify([{ commandId: '11111111-1111-4111-8111-111111111111', offerId: '22222222-2222-4222-8222-222222222222', externalId: 'EXT-17' }]), { status: 201, headers: { 'content-type': 'application/json', 'x-request-id': 'vh-receipt-17' } });
    },
    loadCatalog: async () => [...products.values()].map((item) => structuredClone(item)),
    saveProductFields: async ({ productId, fields = {}, remove = [] }) => {
      const next = { ...(products.get(String(productId)) || { id: productId }), ...structuredClone(fields) };
      for (const field of remove) delete next[field];
      products.set(String(productId), next);
      return { confirmed: true, product: structuredClone(next) };
    },
    reportProgress: async (work) => progress.push(structuredClone(work)),
  });
  const settingsRequest = new Request('https://artwaytm.pl/api?action=von-halsky-settings', {
    method: 'POST', body: JSON.stringify({ automaticPriceSync: true }),
  });
  await route(settingsRequest, new URL(settingsRequest.url), 'von-halsky-settings');
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST', body: JSON.stringify({ publish: true, productIds: ['P-17'] }),
  });
  const result = await route(request, new URL(request.url), 'von-halsky-sync-catalog');
  assert.equal(result.status, 200);
  assert.equal(result.body.sent, 1);
  assert.equal(result.body.publicationConfirmed, false);
  assert.equal(result.body.publicationStatus, 'accepted_pending_readback');
  let saved = products.get('P-17');
  assert.equal(saved.vonHalskyEditorialSyncState, 'publishing');
  assert.equal(saved.contentEditorial.channelStates.vonHalsky.publicationStatus, 'publishing');
  assert.equal(result.body.productUpdates[0].fields.vonHalskyEditorialSyncPending, true);
  assert.deepEqual(progress.map((item) => item.phase), ['sending_to_von_halsky', 'accepted_by_von_halsky']);
  const repeatedRequest = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST', body: JSON.stringify({ publish: true, productIds: ['P-17'] }),
  });
  const repeated = await route(repeatedRequest, new URL(repeatedRequest.url), 'von-halsky-sync-catalog');
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.sent, 0);
  assert.equal(repeated.body.created, 0);
  assert.equal(repeated.body.awaitingPrevious, 1);
  assert.equal(createCalls, 1);
  remoteVisible = true;
  const reconcileRequest = new Request('https://artwaytm.pl/api?action=von-halsky-reconcile-catalog', { method: 'POST' });
  const reconciled = await route(reconcileRequest, new URL(reconcileRequest.url), 'von-halsky-reconcile-catalog');
  assert.equal(reconciled.status, 200);
  assert.equal(reconciled.body.truth.published, 1);
  saved = products.get('P-17');
  assert.equal(saved.vonHalskyEditorialSyncState, 'synced');
  assert.equal(saved.contentEditorial.channelStates.vonHalsky.publicationStatus, 'confirmed');
  assert.equal(saved.contentEditorial.channelStates.vonHalsky.publicationReceipt, '22222222-2222-4222-8222-222222222222');
  assert.equal(reconciled.body.productUpdates[0].fields.vonHalskyEditorialSyncPending, false);
});

test('HTTP 2xx bez identyfikatora API nie tworzy fałszywego sukcesu publikacji', async () => {
  const records = new Map(), revisions = new Map(), products = new Map();
  const product = {
    id: 'P-NO-RECEIPT', externalId: 'EXT-NO-RECEIPT', nazwa: 'Alexander Gra edukacyjna',
    opis: 'Pełny opis produktu zawiera najważniejsze cechy, przeznaczenie, zawartość zestawu oraz informacje przydatne klientowi podczas świadomego wyboru gry edukacyjnej.',
    ean: '5906018000030', producent: 'Alexander', zdjecie: '/one.webp', cena: 39.9, stan: 8,
    vonHalskyCategoryId: '33333333-3333-4333-8333-333333333333',
  };
  products.set(product.id, structuredClone(product));
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }), isAdmin: () => true,
    readVersioned: async (key, fallback) => ({ value: structuredClone(records.get(key) ?? fallback), revision: revisions.get(key) || 0 }),
    writeIfVersion: async (key, value) => { records.set(key, structuredClone(value)); revisions.set(key, (revisions.get(key) || 0) + 1); return { modified: true }; },
    env: () => ({
      INPOST_VON_HALSKY_API_BASE_URL: 'https://api.example.test',
      INPOST_VON_HALSKY_AUTH_URL: 'https://auth.example.test/token',
      INPOST_VON_HALSKY_CLIENT_ID: 'client',
      INPOST_VON_HALSKY_CLIENT_SECRET: 'secret',
      INPOST_VON_HALSKY_MERCHANT_ID: 'merchant',
      INPOST_VON_HALSKY_HEALTH_PATH: '/health',
      INPOST_VON_HALSKY_CATALOG_PATH: '/catalog',
      INPOST_VON_HALSKY_ORDERS_PATH: '/orders',
      INPOST_VON_HALSKY_CONTRACT_VERSION: '2026-01',
    }),
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes('/token')) return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
      const categoryResponse = categoryContractResponse(url);
      if (categoryResponse) return categoryResponse;
      if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify({ data: [], page: { limit: 30, offset: 0, total: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ message: 'accepted' }), { status: 202, headers: { 'content-type': 'application/json', 'x-request-id': 'no-receipt-request' } });
    },
    loadCatalog: async () => [...products.values()].map((item) => structuredClone(item)),
    saveProductFields: async ({ productId, fields = {}, remove = [] }) => {
      const next = { ...(products.get(String(productId)) || { id: productId }), ...structuredClone(fields) };
      for (const field of remove) delete next[field];
      products.set(String(productId), next);
      return { product: structuredClone(next), publication: { readbackConfirmed: true } };
    },
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-sync-catalog', {
    method: 'POST', body: JSON.stringify({ publish: true, productIds: [product.id] }),
  });
  const result = await route(request, new URL(request.url), 'von-halsky-sync-catalog');
  assert.equal(result.status, 200);
  assert.equal(result.body.sent, 1);
  assert.equal(result.body.created, 0);
  assert.equal(result.body.accepted, 0);
  assert.equal(result.body.unconfirmed, 1);
  assert.equal(products.get(product.id).vonHalskyEditorialSyncState, 'retry');
  assert.notEqual(products.get(product.id).vonHalskyRemoteStatus, 'PUBLISHED');
});

test('uzgodnienie katalogu liczy wyłącznie zdalne PUBLISHED i usuwa fałszywe lokalne powiązania', async () => {
  const mutationIds = [];
  const products = new Map([
    ['REAL', {
      id: 'REAL', externalId: 'REAL-EXT', vonHalskyOfferId: 'REMOTE-1',
      vonHalskyEditorialSyncState: 'publishing', vonHalskyEditorialSyncPending: true,
    }],
    ['STALE', {
      id: 'STALE', externalId: 'STALE-EXT', vonHalskyOfferId: 'LOCAL-ONLY',
      vonHalskyEditorialSyncState: 'synced', vonHalskyEditorialSyncPending: false,
    }],
    ['DUPLICATE', {
      id: 'DUPLICATE', externalId: 'REAL-EXT',
      vonHalskyEditorialSyncState: 'queued', vonHalskyEditorialSyncPending: true,
    }],
  ]);
  const remoteOffers = [
    { offerId: 'REMOTE-1', externalId: 'REAL-EXT', status: 'PUBLISHED' },
    { offerId: 'REMOTE-2', externalId: 'WAIT-EXT', status: 'PENDING' },
  ];
  assert.deepEqual(vonHalskyCatalogTruthSummary(remoteOffers), {
    total: 2,
    published: 1,
    pending: 1,
    verificationErrors: 0,
    rejected: 0,
    problems: 0,
    closed: 0,
    statuses: { PUBLISHED: 1, PENDING: 1 },
    providerStatuses: { PUBLISHED: 1, PENDING: 1 },
  });
  const saveProductFields = async ({ productId, fields, remove = [], mutationId }) => {
    mutationIds.push(mutationId);
    const next = { ...products.get(productId), ...structuredClone(fields) };
    for (const key of remove) delete next[key];
    products.set(productId, next);
    return { product: structuredClone(next), publication: { readbackConfirmed: true } };
  };
  const result = await reconcileVonHalskyCatalog({
    remoteOffers,
    products: [...products.values()],
    timestamp: '2026-07-30T08:00:00.000Z',
    saveProductFields,
  });
  assert.equal(result.truth.published, 1);
  assert.equal(result.counts.staleCleared, 1);
  assert.equal(result.counts.duplicateMappings, 1);
  assert.equal(products.get('REAL').vonHalskyRemoteStatus, 'PUBLISHED');
  assert.equal(products.get('REAL').vonHalskyEditorialSyncState, 'synced');
  assert.equal(products.get('STALE').vonHalskyOfferId, undefined);
  assert.equal(products.get('STALE').vonHalskyRemoteStatus, 'NOT_FOUND');
  assert.equal(products.get('STALE').vonHalskyEditorialSyncState, 'decision_required');
  assert.equal(products.get('DUPLICATE').vonHalskyRemoteStatus, 'DUPLICATE_MAPPING');
  assert.equal(products.get('DUPLICATE').vonHalskyRemotePresent, false);
  const firstCycleMutationIds = new Set(mutationIds);
  mutationIds.length = 0;
  await reconcileVonHalskyCatalog({
    remoteOffers,
    products: [...products.values()],
    timestamp: '2026-07-30T08:15:00.000Z',
    saveProductFields,
  });
  assert.equal(mutationIds.length, 0);
  assert.ok(firstCycleMutationIds.size >= 2);
});

test('uzgodnienie katalogu zapisuje konflikt EAN w edytorze i usuwa błędne powiązanie oferty', async () => {
  const offerId = '27113452-e0d6-44a9-bd13-3b7e64e0228b';
  const products = new Map([
    ['1000892', {
      id: '1000892', externalId: '0157', ean: '5906395301577', producent: 'Multigra',
      kodProducenta: '0157',
    }],
    ['87', {
      id: '87', externalId: '0157', ean: '5906018001570', producent: 'Alexander',
      kodProducenta: '0157', vonHalskyOfferId: offerId,
      vonHalskyEditorialSyncState: 'publishing', vonHalskyEditorialSyncPending: true,
    }],
  ]);
  const saveProductFields = async ({ productId, fields, remove = [] }) => {
    const next = { ...products.get(productId), ...structuredClone(fields) };
    for (const key of remove) delete next[key];
    products.set(productId, next);
    return { product: structuredClone(next), publication: { readbackConfirmed: true } };
  };
  const result = await reconcileVonHalskyCatalog({
    remoteOffers: [{
      offerId,
      externalId: '0157',
      sku: '0157',
      gtin: '5906395301577',
      manufacturerCode: '0157',
      brand: 'Multigra',
      status: 'PUBLISHED',
    }],
    products: [...products.values()],
    timestamp: '2026-08-05T14:00:00.000Z',
    saveProductFields,
  });
  assert.equal(result.counts.published, 1);
  assert.equal(result.counts.identityConflicts, 1);
  assert.equal(products.get('1000892').vonHalskyOfferId, offerId);
  assert.equal(products.get('1000892').vonHalskyRemoteStatus, 'PUBLISHED');
  assert.equal(products.get('87').vonHalskyOfferId, undefined);
  assert.equal(products.get('87').vonHalskyRemoteStatus, 'IDENTITY_CONFLICT');
  assert.equal(products.get('87').vonHalskyEditorialSyncState, 'decision_required');
  assert.match(products.get('87').vonHalskyEditorialSyncError, /Konflikt tożsamości/);
});

test('bieżący odczyt kontrolny nie odnawia bez końca czasu oczekiwania na nieistniejącą ofertę', async () => {
  const product = {
    id: 'STALE-PENDING',
    externalId: 'STALE-PENDING-EXT',
    vonHalskyOfferId: 'LOCAL-NOT-IN-API',
    vonHalskyEditorialSyncState: 'publishing',
    vonHalskyEditorialSyncPending: true,
    vonHalskyEditorialSyncPendingAt: '2026-07-30T07:30:00.000Z',
    vonHalskyEditorialSyncCheckedAt: '2026-07-30T08:00:00.000Z',
  };
  let savedProduct = structuredClone(product);
  const result = await reconcileVonHalskyCatalog({
    remoteOffers: [],
    products: [product],
    timestamp: '2026-07-30T08:00:00.000Z',
    pendingGraceMs: 10 * 60_000,
    saveProductFields: async ({ fields, remove = [] }) => {
      savedProduct = { ...savedProduct, ...structuredClone(fields) };
      for (const key of remove) delete savedProduct[key];
      return { product: structuredClone(savedProduct), publication: { readbackConfirmed: true } };
    },
  });
  assert.equal(result.counts.awaiting, 0);
  assert.equal(result.counts.staleCleared, 1);
  assert.equal(savedProduct.vonHalskyRemoteStatus, 'NOT_FOUND');
  assert.equal(savedProduct.vonHalskyEditorialSyncState, 'decision_required');
  assert.equal(savedProduct.vonHalskyOfferId, undefined);
});

test('świeże polecenie publikacji ma pierwszeństwo przed dawną datą przygotowania Agenta', async () => {
  const product = {
    id: 'FRESH-COMMAND',
    externalId: 'FRESH-COMMAND-EXT',
    vonHalskyOfferId: 'OFFER-IN-READBACK',
    vonHalskyCommandId: 'COMMAND-IN-READBACK',
    vonHalskyEditorialSyncState: 'publishing',
    vonHalskyEditorialSyncPending: true,
    vonHalskyEditorialSyncPendingAt: '2026-07-30T06:00:00.000Z',
    contentEditorial: {
      channelStates: {
        vonHalsky: {
          publicationStatus: 'publishing',
          publicationAttemptedAt: '2026-07-30T07:59:00.000Z',
        },
      },
    },
  };
  let savedProduct = structuredClone(product);
  const result = await reconcileVonHalskyCatalog({
    remoteOffers: [],
    products: [product],
    timestamp: '2026-07-30T08:00:00.000Z',
    pendingGraceMs: 10 * 60_000,
    saveProductFields: async ({ fields, remove = [] }) => {
      savedProduct = { ...savedProduct, ...structuredClone(fields) };
      for (const key of remove) delete savedProduct[key];
      return { product: structuredClone(savedProduct), publication: { readbackConfirmed: true } };
    },
  });
  assert.equal(result.counts.awaiting, 1);
  assert.equal(result.counts.staleCleared, 0);
  assert.equal(savedProduct.vonHalskyRemoteStatus, 'VERIFYING');
  assert.equal(savedProduct.vonHalskyEditorialSyncState, 'publishing');
  assert.equal(savedProduct.vonHalskyOfferId, 'OFFER-IN-READBACK');
  assert.equal(savedProduct.vonHalskyCommandId, 'COMMAND-IN-READBACK');
});

test('trwała kolejka publikacji zachowuje cały wybór, pozwala sterować i rozlicza błędy pojedynczo', async () => {
  let state = { sync: {} };
  const route = createVonHalskyCatalogRoute({
    respond: (body, status = 200) => ({ body, status }),
    loadCatalog: async () => [{ id: 'P-1' }, { id: 'P-2' }, { id: 'P-3' }],
    vonHalskyPublicConfig: () => ({ configured: true }),
    env: () => ({}),
    mutate: async (change) => {
      state = change(structuredClone(state));
      return structuredClone(state);
    },
    recordDiagnostic: async () => {},
  });
  const enqueueRequest = new Request('https://artwaytm.pl/api?action=von-halsky-publication-queue', {
    method: 'POST', body: JSON.stringify({ productIds: ['P-1', 'P-2', 'P-3', 'P-2'] }),
  });
  const enqueued = await route(enqueueRequest, new URL(enqueueRequest.url), 'von-halsky-publication-queue');
  assert.equal(enqueued.status, 200);
  assert.equal(enqueued.body.queue.total, 3);
  assert.equal(enqueued.body.queue.remaining, 3);

  const pauseRequest = new Request('https://artwaytm.pl/api?action=von-halsky-publication-queue-control', {
    method: 'POST', body: JSON.stringify({ command: 'pause' }),
  });
  const paused = await route(pauseRequest, new URL(pauseRequest.url), 'von-halsky-publication-queue-control');
  assert.equal(paused.body.queue.status, 'paused');
  const pausedClaimRequest = new Request('https://artwaytm.pl/api?action=von-halsky-publication-queue-claim', {
    method: 'POST', body: JSON.stringify({ limit: 2 }),
  });
  const pausedClaim = await route(pausedClaimRequest, new URL(pausedClaimRequest.url), 'von-halsky-publication-queue-claim');
  assert.equal(pausedClaim.body.claimed, false);

  const resumeRequest = new Request('https://artwaytm.pl/api?action=von-halsky-publication-queue-control', {
    method: 'POST', body: JSON.stringify({ command: 'resume' }),
  });
  await route(resumeRequest, new URL(resumeRequest.url), 'von-halsky-publication-queue-control');
  const claimRequest = new Request('https://artwaytm.pl/api?action=von-halsky-publication-queue-claim', {
    method: 'POST', body: JSON.stringify({ limit: 2 }),
  });
  const claimed = await route(claimRequest, new URL(claimRequest.url), 'von-halsky-publication-queue-claim');
  assert.deepEqual(claimed.body.productIds, ['P-1', 'P-2']);
  const completeRequest = new Request('https://artwaytm.pl/api?action=von-halsky-publication-queue-complete', {
    method: 'POST', body: JSON.stringify({
      leaseToken: claimed.body.leaseToken,
      failures: [{ productId: 'P-1', error: 'Błąd walidacji tej jednej oferty' }],
    }),
  });
  const completed = await route(completeRequest, new URL(completeRequest.url), 'von-halsky-publication-queue-complete');
  assert.equal(completed.body.queue.completed, 2);
  assert.equal(completed.body.queue.remaining, 1);
  assert.equal(completed.body.queue.failed, 1);
  assert.equal(completed.body.queue.status, 'queued');
});

test('kolejka kończy potwierdzone pozycje, a niepotwierdzone pozostawia do następnego odczytu API', async () => {
  let state = { sync: {} };
  const route = createVonHalskyCatalogRoute({
    respond: (body, status = 200) => ({ body, status }),
    loadCatalog: async () => [{ id: 'P-1' }, { id: 'P-2' }],
    vonHalskyPublicConfig: () => ({ configured: true }),
    env: () => ({}),
    mutate: async (change) => {
      state = change(structuredClone(state));
      return structuredClone(state);
    },
    recordDiagnostic: async () => {},
  });
  await route(new Request('https://artwaytm.pl/api?action=von-halsky-publication-queue', {
    method: 'POST', body: JSON.stringify({ productIds: ['P-1', 'P-2'] }),
  }), new URL('https://artwaytm.pl/api?action=von-halsky-publication-queue'), 'von-halsky-publication-queue');
  const claimed = await route(new Request('https://artwaytm.pl/api?action=von-halsky-publication-queue-claim', {
    method: 'POST', body: JSON.stringify({ limit: 2 }),
  }), new URL('https://artwaytm.pl/api?action=von-halsky-publication-queue-claim'), 'von-halsky-publication-queue-claim');
  const completed = await route(new Request('https://artwaytm.pl/api?action=von-halsky-publication-queue-complete', {
    method: 'POST', body: JSON.stringify({ leaseToken: claimed.body.leaseToken, retryProductIds: ['P-2'] }),
  }), new URL('https://artwaytm.pl/api?action=von-halsky-publication-queue-complete'), 'von-halsky-publication-queue-complete');
  assert.equal(completed.body.queue.completed, 1);
  assert.equal(completed.body.queue.remaining, 1);
  assert.equal(completed.body.queue.failed, 0);
  assert.equal(completed.body.queue.status, 'queued');
});
