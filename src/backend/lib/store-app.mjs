import crypto from 'node:crypto';
import { createRevisionSafeMutator, createRevisionSafeWriter, createStoreRepository } from './core/store-repository.mjs';
import { postgresPoolFor } from './core/postgres-store-repository.mjs';
import { filterKnownSettingsDomains } from './core/settings-domain-contract.mjs';
import { bezpiecznePorownanie, czyAdmin as czyAdminToken, odpowiedz, odpowiedzHtml, tekst } from './core/http.mjs';
import {
  accountSessionHeaders,
  clearAccountSessionHeaders,
  createAccountSession,
  createOrderAccess,
  hashPassword,
  legacyPasswordHash,
  publicUser,
  rateLimit,
  requestSession as requestSignedSession,
  sessionMatchesAccount,
  verifyOrderAccess,
  verifyPassword,
} from './core/security.mjs';
import {
  createAdminMfaChallenge,
  createMfaEmailRecovery,
  createMfaEnrollment,
  decryptMfaSecret,
  mfaProvisioningUri,
  verifyAdminMfaChallenge,
  verifyMfaCode,
  verifyMfaEmailRecoveryChallenge,
  verifyMfaEmailRecoveryCode,
} from './core/mfa.mjs';
import { filtrujNieusunieteZamowienia, mapaUsunietych, normalizujKlienta, normalizujUsunieteZamowienie, normalizujZamowienie, numerZamowienia } from './domain/orders.mjs';
import { bezpieczneZamowienieKlienta } from './domain/checkout.mjs';
import { createEmailService } from './email-service.mjs';
import { createInpostService } from './inpost-service.mjs';
import { createInpostRoute } from './inpost-route.mjs';
import { createInpostServiceShipmentRoute } from './inpost-service-shipment-route.mjs';
import { createVonHalskyRoute } from './von-halsky-route.mjs';
import { createStoreDataRoute } from './store-data-route.mjs';
import { createCatalogProductFieldSaver, createPublishedCatalogProductFieldSaver } from './domain/catalog-product-field-save.mjs';
import { createCentralProductFieldPublisher } from './domain/central-product-field-publication.mjs';
import { createPaynowService } from './paynow-service.mjs';
import { createPaynowRoute } from './paynow-route.mjs';
import { createInfaktService } from './infakt-service.mjs';
import { createInfaktRoute } from './infakt-route.mjs';
import { createSystemRoute } from './system-route.mjs';
import { createSystemDiagnosticsRoute } from './system-diagnostics-route.mjs';
import { createDiagnosticAgentWorkflow } from './domain/diagnostic-agent-workflow.mjs';
import { createServerMaintenanceRoute } from './server-maintenance-route.mjs';
import { createProductSourceInspectionService } from './product-source-inspection-service.mjs';
import { auditCatalog, mergeCatalogProducts } from './domain/catalog-quality.mjs';
import { runIndexNowPromotion } from './domain/indexnow.mjs';
import {
  buildSeoChannelReport,
  duplicateScheduledSeoResult,
  isScheduledSeoSource,
  scheduledSeoRunForDay,
  seoAutomationDay,
} from './domain/seo-daily-automation.mjs';
import { createInventoryDecisionService } from './domain/inventory-decisions.mjs';
import { createCodexAgentQueue } from './domain/codex-agent-queue.mjs';
import { createAgentRuntime } from './domain/agent-runtime.mjs';
import { createAgentEventSystem } from './domain/agent-event-system.mjs';
import { createProductEventCodexCoordinator } from './domain/product-event-codex-coordinator.mjs';
import { createAgentProductReport } from './domain/agent-product-report.mjs';
import { createAgentRuntimeRoute } from './agent-runtime-route.mjs';
import { createAgentSpecialists } from './domain/agent-specialists.mjs';
import { createAllegroPreparationRoute } from './allegro-preparation-route.mjs';
import { allegroAutomaticPreparationDisposition } from './domain/allegro-preparation-queue.mjs';
import { createOpenAiPlatformControl } from './domain/openai-platform-control.mjs';
import { createOpenAiPlatformRoute } from './openai-platform-route.mjs';
import { buildEditorialPublicationPatch } from './domain/agent-product-editorial-state.mjs';
import { prepareLinkedProductEditorial } from './domain/product-editorial-pipeline.mjs';
import { createProductLinkPackagePreparer } from './domain/product-link-package-preparer.mjs';
import { inspectedSourceImages, sourcePageUrl, verifiedSourceImages } from './domain/source-product-images.mjs';
import { createAllegroCredentialManager } from './domain/allegro-credential-manager.mjs';
import { allegroCredentialLooksMasked, buildAllegroConnectionStatus, createAllegroOperationReceipts, createAllegroTokenAccess, createAllegroTokenRequester } from './domain/allegro-operation-receipts.mjs';
import { createAllegroCredentialsRoute } from './allegro-credentials-route.mjs';
import { createAllegroCommunicationsRoute } from './allegro-communications-route.mjs';
import { createAllegroMappingRoute } from './allegro-mapping-route.mjs';
import { createProductAvailabilityRoute } from './product-availability-route.mjs';
import { createEmailRoute } from './email-route.mjs';
import { createAgentSpecialistRoute } from './agent-specialist-route.mjs';
import { createAgentOperationsRoute } from './agent-operations-route.mjs';
import { createAgentOperationalCenter, supplierOrderHasActiveContent } from './domain/agent-operational-center.mjs';
import { createStoreDataInputSanitizers } from './domain/store-data-input-sanitizers.mjs';
import { createAiBannerGenerator } from './domain/ai-banner-generator.mjs';
import { createAiBannerRoute } from './ai-banner-route.mjs';
import { allegroOfferTitle } from './domain/allegro-offer-content.mjs';
import { renderSupplierOrderEmail } from './domain/supplier-order-email.mjs';
import { applySupplierProcurementWorkflow } from './domain/supplier-procurement-workflow.mjs';
import { classifyWarehousePosition, resolveWarehouseInventory, summarizeWarehousePositions, warehouseAnalysisNeedsInvestigation } from './domain/order-warehouse-readiness.mjs';
import { createSupplierOrderPlanService, preserveSupplierPlanOnGenericSettings } from './supplier-order-plan-service.mjs';
import { createSupplierOrderRoute } from './supplier-order-route.mjs';
import {
  allegroMessagePlainText,
  buildAllegroReplyStyleProfile,
  classifyAllegroMessageAuthor,
  fetchAllegroReplyHistory,
  improvePolishReplyStyle,
  mergeAllegroReplyHistory,
} from './domain/allegro-reply-assistant.mjs';
import { createStoreOrderSupplierReconciliation } from './store-order-supplier-reconciliation.mjs';
import { markAllegroInventoryTransition, markAllegroInventoryTransitions, resolveAllegroBaselineCutover } from './domain/allegro-supplier-demand.mjs';
import { allegroOrderNeedsLiveRefresh, createAllegroOrderArchive, selectAllegroStatusRefreshCandidates } from './domain/allegro-order-retention.mjs';
import { countChangedAllegroOrderEvents, mergeRecentAllegroOrders } from './domain/allegro-order-sync-window.mjs';
import { createAllegroDataReader } from './domain/allegro-data-reader.mjs';
import { createProductSaleChannelSynchronizer } from './domain/product-sale-channel-links.mjs';
import { allegroOfferGtinCandidates } from './domain/allegro-offer-identifiers.mjs';
import { canonicalGtin, gtinEquivalent } from './domain/product-identifiers.mjs';
import { evaluateAllegroCatalogIdentitySignals, selectAllegroCatalogCandidate } from './domain/allegro-catalog-identity.mjs';
import { ALLEGRO_AGENT_OFFER_PROCEDURE, buildAllegroPublicationSuccessFields, createAllegroPublicationAgent } from './domain/allegro-publication-agent.mjs';
import { canonicalManufacturerName, recognizeProductManufacturer, sanitizeManufacturerFieldsInSettings } from './domain/product-field-validation.mjs';
import { allegroProductCommercialIdentity } from './domain/allegro-commercial-identity.mjs';
import { findBestAllegroOffer, mappedProductFallback, mappingProductSnapshot, mappingVerifiedForSupplier, reassessBlockedAllegroMapping, scoreAllegroProductMapping } from './domain/allegro-product-mapping.mjs';
import { allegroMappingIsCanonical, allegroProductSyncFingerprint, canonicalizeAllegroMappings, linkCanonicalAllegroMapping, markAllegroMappingSynced } from './domain/allegro-canonical-mappings.mjs';
import { allegroMappingRecordsEqual, createAllegroMappingStore } from './domain/allegro-mapping-store.mjs';
import { allegroOfferVerification, allegroPatchZDraftu } from './domain/allegro-offer-patch.mjs';
import { ALLEGRO_DEFAULT_OFFER_STOCK, ALLEGRO_DEFAULT_PRODUCERS, normalizeAllegroOfferSettings } from './domain/allegro-offer-settings.mjs';
import { executeAllegroOfferWriteWithRecovery } from './domain/allegro-publication-recovery.mjs';
import { allegroApplyProductSetSafety, allegroMergeGpsrMissing, allegroResponsibleProducerDirectory, allegroSyncEditorialOffer } from './domain/allegro-gpsr.mjs';
import { allegroCatalogParameterValue } from './domain/allegro-catalog-parameters.mjs';
import { checkAllegroImageReadiness } from './domain/allegro-image-readiness.mjs';
import { createAllegroImagePublicationClient, prepareAllegroOfferImagesForPublication } from './domain/allegro-image-publication.mjs';
import { applyRequiredAllegroSalesConditions, createAllegroOfferStatusWaiter, createAllegroSalesConditionsLoader } from './domain/allegro-sales-readiness.mjs';
import { allegroNextScheduledSyncAt, allegroScheduledSyncDue, normalizeAllegroSyncSettings } from './domain/allegro-sync-policy.mjs';
import { createCentralProductPatchBuffer } from './domain/central-product-patch-buffer.mjs';
import { createCentralCatalogProductOperationWriter } from './domain/catalog-product-operation-rebase.mjs';
import { centralAllegroPreparationCurrent, centralAllegroPreparationFingerprint, createCentralProductCatalog } from './domain/central-product-catalog.mjs';
import { createCentralProductCatalogRoute } from './central-product-catalog-route.mjs';
import { createCentralProductCatalogSynchronizer } from './domain/central-product-catalog-synchronizer.mjs';
import { createInventoryDecisionRoute } from './inventory-decision-route.mjs';
import { createInventoryStockRoute } from './inventory-route.mjs';
import { createProductLinkImportBundle } from './product-link-import-route.mjs';
import {
  mergeImportedProductSourceRefresh,
} from './domain/imported-product-catalog.mjs';
import { createAllegroOfferWithdrawalRoute } from './allegro-offer-withdrawal-route.mjs';
import { allegroAutomaticCategoryParameters, allegroCategoryParameterResolutionReport } from './domain/allegro-category-parameter-resolver.mjs';
import { enrichAllegroProductEvidence } from './domain/allegro-parameter-enrichment.mjs';
import { allegroCategoryConsensus, allegroCategoryIntentPhrases, allegroCategoryParentPath, allegroCategoryResolution, allegroCategorySpecificScore, allegroCategorySuggestedSelection, allegroCorrectCategorySelection } from './domain/allegro-category-classifier.mjs';
import {
  ALLEGRO_COMPLIANCE_POLICY,
  allegroCheckText,
  allegroSanitizePlainText,
  allegroSanitizeDescription,
  allegroEnforceDraft,
  allegroSecureOfferWrite,
} from './allegro-compliance.mjs';
import {
  ustawieniaPubliczneBezDanychPrywatnych,
  infaktDostawcyDozwoleni,
  produktBezDanychPrywatnych,
} from './infakt-purchase.mjs';
const STORE_NAME = 'artway-sklep';
const repository = createStoreRepository({ name: STORE_NAME });
const postgresPool = String(process.env.ARTWAY_STORE_DRIVER || '').trim().toLowerCase() === 'postgres' && process.env.DATABASE_URL
  ? postgresPoolFor(process.env.DATABASE_URL)
  : null;
const centralProductCatalog = createCentralProductCatalog({
  pool: postgresPool,
  namespace: STORE_NAME,
});
const czytaj = repository.read;
const czytajUstawieniaBazowe = typeof repository.readSettingsBase === 'function'
  ? repository.readSettingsBase
  : (fallback) => czytaj('settings', fallback);
const czytajUstawieniaPrzyrostowo = typeof repository.readSettingsDelta === 'function'
  ? repository.readSettingsDelta
  : null;
const czytajWersjonowane = repository.readVersioned;
const zapiszJesliWersja = repository.writeIfVersion;
const zapiszUstawieniaBezpiecznie = createRevisionSafeWriter(repository, 'settings');
async function zapisz(key, value) {
  if (key !== 'settings') return repository.write(key, value);
  return zapiszUstawieniaBezpiecznie(value);
}
const zweryfikowaneSesjeZadania = new WeakMap();
async function przygotujZweryfikowanaSesje(request) {
  const signed = requestSignedSession(request);
  if (!signed) return null;
  const record = await czytaj('users', { items: [] });
  const account = (Array.isArray(record.items) ? record.items : []).find((entry) => String(entry?.email || '').trim().toLowerCase() === signed.email);
  if (!sessionMatchesAccount(signed, account)) return null;
  const verified = { ...signed, account };
  zweryfikowaneSesjeZadania.set(request, verified);
  return verified;
}
function requestSession(request) {
  return zweryfikowaneSesjeZadania.get(request) || null;
}
const {
  pobierzProduktProducenta,
  pobierzProduktProducentaZPamiecia,
  produktLinkDuplikaty,
  produktLinkKategoriaSklepu,
  inspectProductUrl,
  inspectProductUrlViaReader,
} = createProductSourceInspectionService({
  read: czytaj,
  write: zapisz,
  normalizeKey: (value) => allegroNormalizujKlucz(value),
  nameSimilarity: (left, right) => allegroPodobienstwoIstotne(left, right),
});
export { inspectProductUrl, inspectProductUrlViaReader };
const {
  publicznyOrigin,
  paynowKonfiguracja,
  paynowDiagnostyka,
  podpisPaynowPowiadomienia,
  porownajPodpis,
  kluczIdempotencji,
  grosze,
  statusPlatnosciPaynow,
  paynowWywolaj,
  payloadPlatnosciPaynow,
  aktualizujZamowieniePaynow,
} = createPaynowService({ read: czytaj, write: zapisz });
const {
  infaktPublicConfig,
  infaktDostawcyUstawienia,
  infaktKosztDoZwrotu,
  infaktPobierzKosztyDozwolone,
  infaktSynchronizujCenyZakupu,
  infaktPrzypiszCeneZakupu,
  infaktCofnijDopasowanieCeny,
  infaktErrorText,
  infaktWywolaj,
  infaktPayloadZamowienia,
  infaktRef,
  infaktInvoiceFromTask,
} = createInfaktService({
  read: czytaj,
  write: zapisz,
  loadProducts: (data) => allegroAgentProduktyKompletne(data),
  saveProductFields: (input) => zapiszIOpublikujPolaProduktuCentralnie(input),
});
const {
  emailKonfiguracja,
  emailPublicConfig,
  sprawdzEmailSMTP,
  wyslijEmailSMTP,
  zlSerwer,
  htmlEscape,
  wiadomoscKlientaZamowienie,
  dopiszHistorieEmaila,
  wyslijEmaileNowegoZamowienia,
  wyslijEmailStatusowy,
  polaczPowiadomienia,
  obsluzEmailePrzejsciaStatusu,
} = createEmailService({ read: czytaj, write: zapisz });
const {
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
} = createInpostService({ read: czytaj, write: zapisz, onOrderStatusTransition: obsluzEmailePrzejsciaStatusu });
const inpostRoute = createInpostRoute({
  respond: odpowiedz,
  isAdmin: czyAdmin,
  text: tekst,
  read: czytaj,
  readVersioned: czytajWersjonowane,
  write: zapisz,
  orderNumber: numerZamowienia,
  onOrderStatusTransition: obsluzEmailePrzejsciaStatusu,
  publicConfig: inpostPublicConfig,
  configure: inpostKonfiguracja,
  call: inpostWywolaj,
  searchPoints: inpostSzukajPunktow,
  isLockerDelivery: czyDostawaPaczkomatInPost,
  validateShipment: walidujPrzesylkeInPost,
  serviceAvailability: inpostDostepnoscUslug,
  organization: inpostOrganizacja,
  shipmentPayload: przesylkaShipXPayload,
  trackingNumber: numerZShipX,
  shipmentStatus: inpostStatusZShipX,
  labelReady: inpostEtykietaGotowa,
  offerId: inpostOfertaId,
  waitForLabel: inpostCzekajNaEtykiete,
  webhookSecret: inpostWebhookSecret,
  webhookAuthorized: inpostWebhookAutoryzowany,
  webhookEvents: inpostZdarzeniaZWebhooka,
  webhookData: inpostDaneZWebhooka,
  writeWebhookLog: zapiszLogInpostWebhook,
  applyWebhook: zastosujWebhookInpost,
  saveShipmentOnOrder: zapiszPrzesylkeNaZamowieniu,
});
const inpostServiceShipmentRoute = createInpostServiceShipmentRoute({
  respond: odpowiedz, isAdmin: czyAdmin, text: tekst, readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja,
  publicConfig: inpostPublicConfig, configure: inpostKonfiguracja, call: inpostWywolaj, serviceAvailability: inpostDostepnoscUslug,
  organization: inpostOrganizacja, waitForLabel: inpostCzekajNaEtykiete, trackingNumber: numerZShipX, shipmentStatus: inpostStatusZShipX,
  labelReady: inpostEtykietaGotowa, offerId: inpostOfertaId, infaktPublicConfig, infaktCall: infaktWywolaj, infaktReference: infaktRef,
});
const agentRuntime = createAgentRuntime({ readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja });
const agentProductReport = createAgentProductReport({ pool: postgresPool, namespace: STORE_NAME });
const coordinateProductEvent = createProductEventCodexCoordinator({ env: process.env });
const agentEvents = createAgentEventSystem({
  pool: postgresPool, namespace: STORE_NAME,
  readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja,
  runtime: agentRuntime,
  coordinate: coordinateProductEvent,
  text: tekst,
});
const { queue: agentEventQueue, emit: emitAgentEvent } = agentEvents;
const vonHalskyRoute = createVonHalskyRoute({
  respond: odpowiedz, isAdmin: czyAdmin, readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja,
  saveProductFields: (input) => zapiszIOpublikujPolaProduktuCentralnie(input),
  reportProgress: (work) => agentRuntime.report({ event: 'work_progress', source: 'von-halsky-api', work }),
  prepareProductWithAgent: (productId, actor, options) => agentSpecialists.prepareVonHalskyProposal(productId, actor, options),
  inspectSource: pobierzProduktProducentaZPamiecia,
  sourceImages: inspectedSourceImages,
  sourceUrlOf: sourcePageUrl,
  sessionOf: requestSession,
  loadCatalog: async () => {
    const settings = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
    const data = settings?.data || {}, availability = data.artway_dostepnosc && typeof data.artway_dostepnosc === 'object' ? data.artway_dostepnosc : {};
    return [...(await allegroAgentProduktyKompletne(data)).values()].map((product) => {
      const record = availability[String(product.id)] || {}, decision = String(record.decision || '').toLowerCase(), expiresAt = Date.parse(String(record.expiresAt || ''));
      const unavailable = decision === 'manual_available' ? false : decision === 'grace' ? (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) : ['niedostepny', 'ukryty', 'wstrzymany', 'brak'].includes(String(record.status || decision).toLowerCase());
      return { ...product, saleAvailable: !unavailable && product.aktywny !== false && product.ukryty !== true && product.sprzedazAktywna !== false };
    });
  },
});
const mutateSettingsSafely = createRevisionSafeMutator(repository, 'settings', { maxAttempts: 8 });
const zapiszOperacjeProduktow = createCentralCatalogProductOperationWriter({
  catalog: centralProductCatalog,
});
const zapiszPolaProduktuCentralnie = createCatalogProductFieldSaver({
  writeOperations: zapiszOperacjeProduktow,
  readProduct: async (productId) => centralProductCatalog.get(productId, { admin: true }),
});
const zapiszIOpublikujPolaProduktuCentralnie = agentEvents.wrapProductSaver(createPublishedCatalogProductFieldSaver({
  saveFields: zapiszPolaProduktuCentralnie,
  readPublishedProduct: (productId) => centralProductCatalog.get(productId, { admin: true }), saveIsPublished: true,
}));
const zapiszMapowaniaBezpiecznie = createAllegroMappingStore({ readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja, getItems: allegroMapowaniaItems }).writeSafely;
async function zwiekszLicznikKoduRabatowego(kod = '') {
  const code = tekst(kod, 30).trim().toUpperCase(); if (!code) return false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const version = await czytajWersjonowane('settings', { data: {}, rev: 0, updated_at: null });
    const previous = version.value || { data: {}, rev: 0, updated_at: null }, data = { ...(previous.data || {}) };
    const config = { ...(data.artway_ustawienia || {}) }, rules = Array.isArray(config.kodyRabatoweZaawansowane) ? config.kodyRabatoweZaawansowane.map((rule) => ({ ...rule })) : [];
    const index = rules.findIndex((rule) => tekst(rule?.kod, 30).trim().toUpperCase() === code); if (index < 0) return false;
    rules[index].uzycia = Math.max(0, Number(rules[index].uzycia) || 0) + 1;
    config.kodyRabatoweZaawansowane = rules; data.artway_ustawienia = config;
    const record = { ...previous, data, rev: Number(previous.rev || 0) + 1, updated_at: new Date().toISOString() };
    const write = await zapiszJesliWersja('settings', record, version); if (write?.modified) return true;
  }
  return false;
}
const inventoryDecisions = createInventoryDecisionService({ readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja });
const codexAgentQueue = createCodexAgentQueue({ readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja });
const openAiPlatform = createOpenAiPlatformControl({ read: czytaj, write: zapisz });
const agentSpecialists = createAgentSpecialists({
  readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja,
  saveProductFields: zapiszIOpublikujPolaProduktuCentralnie, platformStatus: () => openAiPlatform.status(),
  loadProducts: () => allegroAgentProduktyKompletne(),
  reportProgress: (work) => agentRuntime.report({ event: 'work_progress', source: 'openai-specialist', work }),
  localFallback: {
    enabled: process.env.OLLAMA_FALLBACK_ENABLED !== 'false',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_FALLBACK_MODEL || 'qwen3.5:4b',
    keepAlive: process.env.OLLAMA_KEEP_ALIVE || '30s',
  },
});
const diagnosticAgent = createDiagnosticAgentWorkflow();
const allegroPublicationAgent = createAllegroPublicationAgent({ text: tekst, canonicalGtin, linkFromPreparation: allegroDanePowiazaniaZPrzygotowania, runSpecialist: agentSpecialists.run, mutateSettings: mutateSettingsSafely, saveProductFields: zapiszIOpublikujPolaProduktuCentralnie });
function allegroZapiszZadanieAgentaOferty(product = {}, details = {}) { return allegroPublicationAgent.recordFailure(product, details); }
const linkedProductEditorial = (product, sourceUrl, actor) => prepareLinkedProductEditorial(product, { sourceUrl, runSpecialist: agentSpecialists.run, actor });
const przygotujProduktVonHalskyPoPelnejKontroli = agentEvents.vonHalskyFinisher({
  route: vonHalskyRoute,
  publicOrigin: process.env.ARTWAY_PUBLIC_ORIGIN,
  adminToken: process.env.ARTWAY_ADMIN_TOKEN,
  saveProductFields: zapiszIOpublikujPolaProduktuCentralnie,
  getProduct: (productId) => centralProductCatalog.get(productId, { admin: true }),
});
const allegroPreparationRoute = createAllegroPreparationRoute({
  respond: odpowiedz, isAdmin: czyAdmin, sessionOf: requestSession, text: tekst,
  readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja, runtime: agentRuntime,
  pool: postgresPool, namespace: STORE_NAME,
  coordinate: coordinateProductEvent,
  afterPrepare: przygotujProduktVonHalskyPoPelnejKontroli,
  worker: {
    text: tekst, readSettings: () => czytaj('settings', { data: {}, rev: 0, updated_at: null }), loadProducts: allegroAgentProduktyKompletne,
    getCatalogProduct: (productId) => centralProductCatalog.get(productId, { admin: true }), sourceUrlOf: sourcePageUrl,
    inspectSource: pobierzProduktProducentaZPamiecia, sourceImages: inspectedSourceImages, editorialize: linkedProductEditorial,
    prepareDraft: allegroDraftZAutoKategoria, enforceDraft: allegroEnforceDraft, verifyIdentity: allegroZweryfikujTozsamoscPublikacji,
    preparationCurrent: centralAllegroPreparationCurrent, preparationFingerprint: centralAllegroPreparationFingerprint,
    saveProduct: zapiszIOpublikujPolaProduktuCentralnie,
    requestFactory: () => new Request(`${String(process.env.ARTWAY_PUBLIC_ORIGIN || 'https://artwaytm.pl').replace(/\/+$/, '')}/api/store?action=allegro-preparation-worker`, { headers: process.env.ARTWAY_ADMIN_TOKEN ? { 'x-admin-token': process.env.ARTWAY_ADMIN_TOKEN } : {} }),
  },
});
const productLinkPackagePreparer = createProductLinkPackagePreparer({ inspect: pobierzProduktProducentaZPamiecia, readSettings: () => czytaj('settings', { data: {}, rev: 0, updated_at: null }), offerSettings: allegroPobierzUstawieniaOfert, centralProducts: () => allegroAgentProduktyKompletne(), recognizeProducer: allegroRozpoznajProducenta, chooseCategory: produktLinkKategoriaSklepu, editorialize: linkedProductEditorial, prepareOffer: allegroDraftZAutoKategoria, duplicates: produktLinkDuplikaty, shortDescription: allegroOpisKrotkiZTekstu, text: tekst, sessionOf: requestSession });
const allegroOperationReceipts = createAllegroOperationReceipts({ readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja, text: tekst });
const allegroTokenRequest = createAllegroTokenRequester({ configure: allegroKonfiguracja, errorText: bledyAllegroTekst });
const allegroAccessToken = createAllegroTokenAccess({ configure: allegroKonfiguracja, read: czytaj, write: zapisz, requestToken: allegroTokenRequest, text: tekst });
const allegroCredentials = createAllegroCredentialManager();
const allegroCredentialsRoute = createAllegroCredentialsRoute({ manager: allegroCredentials, isAdmin: czyAdmin, rateLimit: ograniczRuch, respond: odpowiedz, refresh: allegroAccessToken, status: allegroStatus });
const agentSpecialistRoute = createAgentSpecialistRoute({ service: agentSpecialists, isAdmin: czyAdmin, rateLimit: ograniczRuch, respond: odpowiedz, sessionOf: requestSession });
const openAiPlatformRoute = createOpenAiPlatformRoute({ service: openAiPlatform, isAdmin: czyAdmin, rateLimit: ograniczRuch, respond: odpowiedz });
const aiBannerGenerator = createAiBannerGenerator({ read: czytaj, write: zapisz, remove: repository.delete });
const aiBannerRoute = createAiBannerRoute({ generator: aiBannerGenerator, isAdmin: czyAdmin, rateLimit: ograniczRuch, respond: odpowiedz, configured: () => !!process.env.OPENAI_API_KEY, model: () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2' });
const allegroOrderArchive = createAllegroOrderArchive({ read: czytaj, write: zapisz });
const allegroDataReader = createAllegroDataReader({ read: czytaj, archive: allegroOrderArchive, getOfferSettings: allegroPobierzUstawieniaOfert, getStatus: allegroStatus, mappingItems: allegroMapowaniaItems, orderStatus: (order) => allegroStatusKolejkiZamowienia(order, {}), orderNeedsRefresh: allegroOrderNeedsLiveRefresh, nextScheduledSyncAt: allegroNextScheduledSyncAt, compliancePolicy: ALLEGRO_COMPLIANCE_POLICY });
async function productLinkRefreshCentralProduct(productId, incoming = {}) {
  const existing = await centralProductCatalog.get(String(productId), { admin: true });
  if (!existing) return { updated: false, notFound: true, product: null, changedFields: [] };
  const next = mergeImportedProductSourceRefresh(existing, incoming);
  const changedFields = Object.keys(next).filter((field) => (
    field !== 'id' && JSON.stringify(next[field]) !== JSON.stringify(existing[field])
  ));
  if (!changedFields.length) return { updated: false, product: existing, changedFields: [] };
  const fields = Object.fromEntries(changedFields.map((field) => [field, next[field]]));
  await centralProductCatalog.patchProductFields(String(productId), fields, [], {
    mutationId: `product-link-refresh:${productId}:${Date.now().toString(36)}`,
    actor: 'product-link-import',
    area: 'product-source-refresh',
  });
  agentEvents.signalProduct(productId, {
    source: 'product-source-refresh',
    priority: 600,
    productName: next.nazwa || next.name || '',
    action: 'pełny przegląd po aktualizacji źródła',
    changedFields,
  }).catch((error) => console.error('agent_product_source_event', error));
  return { updated: true, product: { ...existing, ...fields }, changedFields };
}
const productLinkImport = createProductLinkImportBundle({
  read: czytaj,
  readVersioned: czytajWersjonowane,
  writeIfVersion: zapiszJesliWersja,
  centralCatalog: centralProductCatalog,
  updateExistingProduct: productLinkRefreshCentralProduct,
  sanitize: produktBezDanychPrywatnych,
  preparation: {
    readSettings: () => czytaj('settings', { data: {}, rev: 0, updated_at: null }),
    centralProducts: () => allegroAgentProduktyKompletne(),
    inspect: pobierzProduktProducentaZPamiecia,
    offerSettings: allegroPobierzUstawieniaOfert,
    recognizeProducer: allegroRozpoznajProducenta,
    chooseCategory: produktLinkKategoriaSklepu,
    shortDescription: allegroOpisKrotkiZTekstu,
    editorialize: linkedProductEditorial,
    text: tekst,
  },
  route: {
    isAdmin: czyAdmin,
    rateLimit: ograniczRuch,
    respond: odpowiedz,
    sessionOf: requestSession,
    text: tekst,
    adminEmail: () => process.env.ARTWAY_ADMIN_EMAIL || '',
  },
});
const centralProductCatalogSynchronizer = createCentralProductCatalogSynchronizer({
  repository, read: czytaj, catalog: centralProductCatalog,
  importedProducts: () => productLinkImport.catalog.list(),
  offerItems: allegroOfertyItems, mappingItems: allegroMapowaniaItems,
});
const centralProductCatalogRevisionState = centralProductCatalogSynchronizer.revisionState;
const synchronizeCentralProductCatalog = centralProductCatalogSynchronizer.synchronize;
const publishCentralProductFields = createCentralProductFieldPublisher({
  catalog: centralProductCatalog, revisionState: centralProductCatalogRevisionState,
  synchronize: synchronizeCentralProductCatalog, errorText: tekst,
});
const centralProductCatalogRoute = createCentralProductCatalogRoute({ catalog: centralProductCatalog, isAdmin: czyAdmin, rateLimit: ograniczRuch, respond: odpowiedz, revisionState: centralProductCatalogRevisionState, synchronize: synchronizeCentralProductCatalog });
const allegroOfferWithdrawalRoute = createAllegroOfferWithdrawalRoute({
  autoMapOffers: allegroAutoMapujOfertyZKartoteka,
  callAllegro: allegroWywolaj,
  getMappings: allegroMapowaniaItems,
  getOffers: allegroOfertyItems,
  getProducts: allegroAgentProduktyKompletne,
  isAdmin: czyAdmin,
  read: czytaj,
  respond: odpowiedz,
  text: tekst,
  write: zapisz,
  saveProductFields: zapiszIOpublikujPolaProduktuCentralnie,
});
const agentCentrumOperacyjne = createAgentOperationalCenter({
  read: czytaj,
  text: tekst,
  allegroOrderIsActive: allegroAgentZlecenieAktywne,
  communicationNeedsReply: allegroKomunikacjaWymagaOdpowiedzi,
  mergeProducts: mergeCatalogProducts,
  orderNumber: numerZamowienia,
  integrationStatus: () => ({
    email: !!emailPublicConfig().configured,
    inpost: !!inpostPublicConfig().configured,
    allegro: !!(process.env.ALLEGRO_CLIENT_ID && process.env.ALLEGRO_CLIENT_SECRET),
    infakt: !!infaktPublicConfig().configured,
  }),
});
const agentRuntimeRoute = createAgentRuntimeRoute({
  queue: codexAgentQueue,
  events: agentEventQueue,
  runtime: agentRuntime,
  productReport: agentProductReport,
  isAdmin: czyAdmin,
  respond: odpowiedz,
  sessionOf: requestSession,
  text: tekst,
});
const agentOperationsRoute = createAgentOperationsRoute({ respond: odpowiedz, isAdmin: czyAdmin, text: tekst, read: czytaj, write: zapisz, getOperationalCenter: agentCentrumOperacyjne, publicOrigin: publicznyOrigin });
const LIMIT_USTAWIEN = 10 * 1024 * 1024; // 10 MB na komplet ustawień
const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024; // 12 MB dla pojedynczego żądania do /api/store
const LIMIT_ZAMOWIEN = 20000;
const LIMIT_KLIENTOW = 20000;
const LIMIT_USUNIETYCH_ZAMOWIEN = 50000;
const BACKUP_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_./-]{0,199}$/;
const PAYNOW_STATUSY_KONCOWE = new Set(['CONFIRMED', 'ERROR', 'EXPIRED', 'REJECTED', 'ABANDONED']);
const storeOrderSupplierReconciliation = createStoreOrderSupplierReconciliation({
  readVersioned: czytajWersjonowane,
  writeIfVersion: zapiszJesliWersja,
  mergeImportedSettings: (data) => productLinkImport.mergeSettings(data),
  catalogProducts: (data) => mergeCatalogProducts(data).products,
  orderLimit: LIMIT_ZAMOWIEN,
  settingsLimit: LIMIT_USTAWIEN,
});
const supplierOrderPlan = createSupplierOrderPlanService({
  readVersioned: czytajWersjonowane, writeIfVersion: zapiszJesliWersja,
  mergeSettings: (data) => productLinkImport.mergeSettings(data),
  catalogProducts: (data) => mergeCatalogProducts(data).products.map((product) => {
    const meta = data?.artway_magazyn_produkty?.[String(product?.id ?? product?.produktId)] || {};
    return {
      ...product,
      optimaCode: product.optimaCode || product.supplierOptimaCode || meta.optimaCode || meta.supplierOptimaCode || meta.kodOptima || '',
      kodDostawcy: product.kodDostawcy || product.supplierCode || meta.kodDostawcy || meta.supplierCode || meta.vendorCode || '',
    };
  }),
  settingsLimit: LIMIT_USTAWIEN,
});
const supplierOrderRoute = createSupplierOrderRoute({
  isAdmin: czyAdmin,
  isAllegroOrderActive: allegroAgentZlecenieAktywne,
  plan: supplierOrderPlan,
  read: czytaj,
  recalculateAllegroOrders: allegroPrzeliczZamowieniaPoMapowaniu,
  reconciliation: storeOrderSupplierReconciliation,
  respond: odpowiedz,
  sessionOf: requestSession,
  syncProcurement: synchronizujEtapyZakupoweZlecen,
  text: tekst,
});
function czyAdmin(request, url) {
  return czyAdminToken(request, url) || requestSession(request)?.role === 'admin';
}
function ograniczRuch(request, name, limit, windowMs) {
  const result = rateLimit(request, name, limit, windowMs);
  if (result.ok) return null;
  return odpowiedz({ ok: false, error: 'Zbyt wiele prób. Spróbuj ponownie później.', code: 'rate_limit', retryAfter: result.retryAfter }, 429);
}
const inventoryStockRoute = createInventoryStockRoute({ isAdmin: czyAdmin, rateLimit: ograniczRuch, readVersioned: czytajWersjonowane, reconciliation: storeOrderSupplierReconciliation, refreshOrderReadiness: () => allegroPrzeliczZamowieniaPoMapowaniu({ reconcile: false, source: 'warehouse-document-confirm' }), respond: odpowiedz, sessionOf: requestSession, settingsLimit: LIMIT_USTAWIEN, writeIfVersion: zapiszJesliWersja, mergeSettings: (data) => productLinkImport.mergeSettings(data) });
const inventoryDecisionRoute = createInventoryDecisionRoute({ decisions: inventoryDecisions, isAdmin: czyAdmin, rateLimit: ograniczRuch, readVersioned: czytajWersjonowane, reconciliation: storeOrderSupplierReconciliation, respond: odpowiedz, sessionOf: requestSession, text: tekst });
const {
  customerProfile: profilKlienta,
  safeReview: bezpiecznaOpinia,
} = createStoreDataInputSanitizers(tekst);
function producentEmailZlecenia(order = {}, supplier = {}) {
  return renderSupplierOrderEmail(order, supplier);
}

// zostaw tylko dozwolone klucze wspólne i pilnuj rozmiaru
function oczyscUstawienia(obj) {
  return sanitizeManufacturerFieldsInSettings(filterKnownSettingsDomains(obj));
}

async function czytajUsunieteZamowienia() {
  const rec = await czytaj('deleted_orders', { items: [] });
  return Array.isArray(rec.items) ? rec.items : [];
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

// ─── ALLEGRO API (OAuth, zamówienia, oferty, mapowania) ───
function allegroEnv() {
  return String(process.env.ALLEGRO_ENV || 'production').trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production';
}
const ALLEGRO_DEFAULT_SCOPE = [
  'allegro:api:sale:offers:read',
  'allegro:api:sale:offers:write',
  'allegro:api:sale:settings:read',
  'allegro:api:orders:read',
  'allegro:api:orders:write',
  'allegro:api:shipments:read',
  'allegro:api:shipments:write',
  'allegro:api:messaging',
  'allegro:api:disputes',
].join(' ');
function allegroKonfiguracja(req) {
  const env = allegroEnv();
  const clientId = tekst(process.env.ALLEGRO_CLIENT_ID || '', 300).trim();
  const clientSecret = tekst(process.env.ALLEGRO_CLIENT_SECRET || '', 500).trim();
  const redirectUri = tekst(process.env.ALLEGRO_REDIRECT_URI || '', 1000).trim() || `${publicznyOrigin(req)}/api/store?action=allegro-callback`;
  const envScope = tekst(process.env.ALLEGRO_SCOPE || '', 1000).trim();
  const scope = [...new Set(`${envScope} ${ALLEGRO_DEFAULT_SCOPE}`.split(/\s+/).map((x) => x.trim()).filter(Boolean))].join(' ');
  const authBaseUrl = env === 'sandbox' ? 'https://allegro.pl.allegrosandbox.pl' : 'https://allegro.pl';
  const apiBaseUrl = env === 'sandbox' ? 'https://api.allegro.pl.allegrosandbox.pl' : 'https://api.allegro.pl';
  const missingEnv = [], invalidEnv = [];
  if (!clientId) missingEnv.push('ALLEGRO_CLIENT_ID');
  if (!clientSecret) missingEnv.push('ALLEGRO_CLIENT_SECRET');
  if (clientId && allegroCredentialLooksMasked(clientId)) invalidEnv.push('ALLEGRO_CLIENT_ID');
  if (clientSecret && allegroCredentialLooksMasked(clientSecret)) invalidEnv.push('ALLEGRO_CLIENT_SECRET');
  return { env, clientId, clientSecret, redirectUri, scope, authBaseUrl, apiBaseUrl, configured: missingEnv.length === 0 && invalidEnv.length === 0, missingEnv, invalidEnv, credentialsRedacted: invalidEnv.length > 0 };
}
async function allegroStatus(req) {
  const c = allegroKonfiguracja(req);
  const auth = await czytaj('allegro_auth', {});
  return buildAllegroConnectionStatus({ configuration: c, auth, requiredScope: c.scope, recommendedScope: ALLEGRO_DEFAULT_SCOPE, text: tekst });
}
function bledyAllegroTekst(dane, fallback) {
  const errors = Array.isArray(dane?.errors) ? dane.errors : [];
  const msg = errors.map((e) => [e.code || e.error, e.message, e.userMessage].filter(Boolean).join(': ')).filter(Boolean).join('; ');
  return msg || dane?.error_description || dane?.message || fallback || 'Błąd Allegro';
}
const ALLEGRO_PUBLIC_JSON = 'application/vnd.allegro.public.v1+json';
const ALLEGRO_BETA_JSON = 'application/vnd.allegro.beta.v1+json';
async function allegroWywolaj(req, path, { method = 'GET', parameters = {}, bodyObj = null, accept = ALLEGRO_PUBLIC_JSON, contentType = null, withMeta = false } = {}) {
  const c = allegroKonfiguracja(req);
  const token = await allegroAccessToken(req);
  const apiUrl = new URL(path, c.apiBaseUrl);
  for (const [k, v] of Object.entries(parameters || {})) if (v !== undefined && v !== null && v !== '') apiUrl.searchParams.set(k, String(v));
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': accept,
    'Accept-Language': 'pl-PL',
    'User-Agent': 'Artway-TM/1.0 VPS',
  };
  // Fail closed: każda nowa lub przyszła ścieżka zapisu opisu przechodzi przez
  // tę samą bramkę, nawet gdy jej autor zapomni wywołać kontrolę wcześniej.
  const securedWrite = allegroSecureOfferWrite({ path, method, body: bodyObj });
  const body = securedWrite.body === null ? undefined : JSON.stringify(securedWrite.body);
  if (body) headers['Content-Type'] = contentType || accept || ALLEGRO_PUBLIC_JSON;
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
  if (withMeta) return { data: dane, status: r.status, location: r.headers.get('location') || '', url: r.url || apiUrl.toString() };
  return dane;
}
const allegroPublikujZdjecia = createAllegroImagePublicationClient({ configuration: allegroKonfiguracja, accessToken: allegroAccessToken, errorText: bledyAllegroTekst });
async function allegroCzekajNaOperacjeOferty(req, location = '') {
  if (!location || !/\/operations\//.test(location)) return { completed: true, result: null, checks: 0 };
  let path = location;
  try { const u = new URL(location); path = `${u.pathname}${u.search}`; } catch (e) {}
  for (let i = 0; i < 18; i++) {
    if (i) await new Promise((resolve) => setTimeout(resolve, Math.min(1000, 650 + i * 25)));
    const meta = await allegroWywolaj(req, path, { withMeta: true });
    if (meta?.data?.id || (meta.status !== 202 && Object.keys(meta?.data || {}).length)) return { completed: true, result: meta.data || {}, checks: i + 1, status: meta.status };
  }
  return { completed: false, result: null, checks: 18, status: 202 };
}
function allegroLista(raw = {}, keys = []) {
  for (const key of keys) if (Array.isArray(raw?.[key])) return raw[key];
  if (Array.isArray(raw)) return raw;
  return [];
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
  return tekst(allegroCatalogParameterValue({ parameters: allegroParametry(o) }, nazwy), 300).trim();
}
function allegroOpisTekst(desc) {
  const sections = Array.isArray(desc?.sections) ? desc.sections : [];
  const parts = [];
  for (const s of sections) {
    for (const item of (Array.isArray(s?.items) ? s.items : [])) {
      if (item?.type === 'TEXT' && item.content) parts.push(String(item.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
  }
  return tekst(parts.join('\n\n'), 20000);
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
function allegroStatusKolejkiZamowienia(z) {
  const status = String(z?.status || '').trim().toUpperCase();
  const fulfillment = String(z?.fulfillmentStatus || z?.fulfillment?.status || '').trim().toUpperCase();
  if (status === 'CANCELLED' || fulfillment === 'CANCELLED') return 'CANCELLED';
  return fulfillment || 'NEW';
}
function allegroEtapMagazynu(z = {}, poprzednie = {}) {
  const terminal = ['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(allegroStatusKolejkiZamowienia(z, poprzednie));
  if (terminal) return 'zamkniete';
  const zapisany = String(z?.warehouseStage || poprzednie?.warehouseStage || '').toLowerCase();
  return ['do_sprawdzenia', 'braki', 'oczekuje_na_dostawe', 'kompletacja', 'spakowane', 'zrealizowane'].includes(zapisany) ? zapisany : 'do_sprawdzenia';
}
function allegroZamowienieJestNoweLubDoWyslania(z) {
  const status = String(z?.status || '').trim().toUpperCase();
  const fulfillment = String(z?.fulfillmentStatus || z?.fulfillment?.status || '').trim().toUpperCase();
  return status === 'READY_FOR_PROCESSING' && ['NEW', 'PROCESSING', 'READY_FOR_SHIPMENT', 'READY_FOR_PICKUP', 'SUSPENDED'].includes(fulfillment || 'NEW');
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
    revision: tekst(z.revision || z.checkoutForm?.revision || '', 160),
    total: allegroKwotaText(z.summary?.totalToPay || z.summary?.totalPrice || z.totalToPay),
    invoiceRequired: !!invoice.required,
    lineItems,
    rawUpdatedAt: new Date().toISOString(),
  };
}
function allegroScalZamowienie(z, poprzednie = {}) {
  const teraz = new Date().toISOString();
  const surowe = !!(z?.buyer || z?.delivery || z?.summary || z?.fulfillment || z?.invoice);
  const nowe = surowe ? allegroNormalizujZamowienie(z) : z;
  const allegroStatus = allegroStatusKolejkiZamowienia(nowe, poprzednie);
  const warehouseStage = allegroEtapMagazynu(nowe, poprzednie);
  return {
    ...poprzednie,
    ...nowe,
    allegroStatus,
    warehouseStage,
    firstFetchedAt: poprzednie.firstFetchedAt || nowe.createdAt || teraz,
    lastSeenAt: teraz,
    checkedAt: warehouseStage !== 'do_sprawdzenia' ? (poprzednie.checkedAt || teraz) : null,
  };
}
async function allegroAgentProduktyKompletne(dane = {}) {
  return centralProductCatalog.listDataMap({ includeTrash: true });
}
function allegroOpisKrotkiZTekstu(v = '') {
  const clean = tekst(v, 5000).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  return tekst(sentences.slice(0, 2).join(' ') || clean, 420).trim();
}
async function allegroAutoMapujOfertyZKartoteka(offers = []) {
  const [settingsRec, mappingsRec, offerSettings] = await Promise.all([
    czytaj('settings', { data: {}, rev: 0, updated_at: null }),
    czytaj('allegro_mappings', { items: {}, updated_at: null }),
    allegroPobierzUstawieniaOfert(),
  ]);
  const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
  let products = await allegroAgentProduktyKompletne(data);
  const baseMappings = { ...allegroMapowaniaItems(mappingsRec) }, productPatches = createCentralProductPatchBuffer(products);
  const applyUpdate = (id, fields = {}, remove = []) => productPatches.apply(id, fields, remove);
  const now = new Date().toISOString(), mappingPolicy = normalizeAllegroSyncSettings(offerSettings);
  const offersList = allegroOfertyItems(offers), offersById = new Map(offersList.map((offer) => [String(offer?.id || ''), offer]));
  const canonical = canonicalizeAllegroMappings({ mappings: baseMappings, offers: offersList, products, now });
  const mappings = { ...canonical.mappings };
  let quarantined = 0, reassessed = 0;
  if (offerSettings.autoCorrections !== false) for (const [offerId, current] of Object.entries(mappings)) {
    const productId = String(current?.productId || current?.previousProductId || '').trim(), product = products.get(productId), offer = offersById.get(String(offerId));
    if (current?.blocked === true) {
      const reassessment = reassessBlockedAllegroMapping({ current, product, offer, mappings, offersById, minimumScore: mappingPolicy.mappingMinScore, now });
      if (reassessment) { mappings[offerId] = reassessment; reassessed++; }
      if (product && (String(product.allegroOfferId || '') === String(offerId) || product.allegroMappingStatus === 'wymaga_sprawdzenia')) applyUpdate(productId, { allegroMappingStatus: 'wymaga_sprawdzenia', ...(current.conflict ? { allegroMappingConflict: current.conflict } : {}) }, ['allegroOfferId', 'allegroProductId', 'allegroCategoryId']);
      continue;
    }
    const identityValidation = product && offer ? allegroOcenaPowiazania(product, offer) : null;
    const administratorConfirmed = /^(admin-|manual-|operator-)/i.test(String(current?.operator || ''));
    if (identityValidation?.strongConflict && !administratorConfirmed) {
      mappings[offerId] = {
        ...current, offerId, previousProductId: productId, productId: '', blocked: true,
        locked: false, canonicalLocked: false, canonical: false, mappingRole: 'unlinked',
        operator: 'auto-quarantine:identity-conflict', quarantined_at: now,
        conflict: { productName: tekst(product.nazwa || product.name, 300), offerName: tekst(offer.name, 300), reasons: identityValidation.conflicts },
      };
      applyUpdate(productId, { allegroMappingStatus: 'wymaga_sprawdzenia', allegroMappingConflict: mappings[offerId].conflict }, ['allegroOfferId', 'allegroProductId', 'allegroCategoryId']);
      quarantined++;
      continue;
    }
    if (current?.locked === true || current?.canonicalLocked === true) {
      if (product && offer && !allegroPowiazanieWiarygodne(product, offer)) {
        const fingerprint = allegroProductSyncFingerprint(product);
        mappings[offerId] = { ...current, sourceOfTruth: 'store', syncState: current.lastSourceFingerprint === fingerprint ? 'synced' : 'pending', pendingSourceFingerprint: fingerprint, syncRequestedAt: current.syncRequestedAt || now };
        if (current.lastSourceFingerprint !== fingerprint) applyUpdate(productId, { allegroEditorialSyncPending: true, allegroEditorialSyncPendingAt: now, allegroEditorialSyncState: 'pending', allegroEditorialSyncReason: 'kanoniczne mapowanie — sklep jest źródłem danych' });
      }
      continue;
    }
    if (!product || !offer || allegroPowiazanieWiarygodne(product, offer)) continue;
    mappings[offerId] = {
      ...current, offerId, previousProductId: productId, productId: '', blocked: true,
      operator: 'auto-quarantine:name-conflict', quarantined_at: now,
      conflict: { productName: tekst(product.nazwa || product.name, 300), offerName: tekst(offer.name, 300) },
    };
    applyUpdate(productId, { allegroMappingStatus: 'wymaga_sprawdzenia', allegroMappingConflict: mappings[offerId].conflict }, ['allegroOfferId', 'allegroProductId', 'allegroCategoryId']);
    quarantined++;
  }
  const used = new Map(Object.values(mappings).filter((m) => m?.blocked !== true && m?.lifecycle !== 'historical').map((m) => [String(m?.offerId || ''), String(m?.productId || '')]).filter(([o, p]) => o && p && products.has(p)));
  const usedProducts = new Set(Object.values(mappings).filter((m) => allegroMappingIsCanonical(m)).map((m) => String(m.productId)).filter((id) => products.has(id)));
  let autoMapped = 0, refreshed = 0, descriptionsUpdated = 0, producersUpdated = 0, productsUpdated = 0;
  for (const product of products.values()) {
    const match = allegroDopasowanieOferty(product, offers, mappings, mappingPolicy.mappingMinScore);
    const offer = match?.offer;
    if (!offer?.id || (used.has(String(offer.id)) && used.get(String(offer.id)) !== String(product.id))) continue;
    const current = mappings[String(offer.id)] || {};
    if (current.blocked === true) continue;
    const validation = allegroOcenaPowiazania(product, offer);
    if (!current.offerId) {
      if (mappingPolicy.autoMapping === false || validation.strongConflict || validation.score < mappingPolicy.mappingMinScore || usedProducts.has(String(product.id))) continue;
      const competitor = [...products.values()]
        .filter((candidate) => String(candidate.id) !== String(product.id) && !usedProducts.has(String(candidate.id)))
        .map((candidate) => ({ candidate, validation: allegroOcenaPowiazania(candidate, offer) }))
        .filter((entry) => !entry.validation.strongConflict && entry.validation.score >= mappingPolicy.mappingMinScore)
        .sort((left, right) => right.validation.score - left.validation.score)[0];
      if (competitor && validation.score - competitor.validation.score < 6) continue;
    }
    const fingerprint = allegroProductSyncFingerprint(product);
    const record = {
      ...current, offerId: String(offer.id), productId: String(product.id), allegroProductId: tekst(offer.productId || product.allegroProductId, 120), categoryId: tekst(offer.categoryId || product.allegroCategoryId, 80),
      productName: tekst(product.nazwa || product.name, 300), linked_at: current.linked_at || now, operator: current.operator || `auto:${match.reason}`,
      confidence: validation.score,
      reason: validation.reason,
      evidence: validation.evidence,
      conflicts: validation.conflicts,
      warnings: validation.warnings,
      verifiedForSupplier: current.verifiedForSupplier === true || (validation.valid && validation.score >= 88),
      verification: current.verification || (validation.valid && validation.score >= 88 ? 'strong-identifiers' : 'catalog-sync-review'),
      productSnapshot: mappingProductSnapshot(product, data),
      sourceOfTruth: 'store', syncState: current.lastSourceFingerprint === fingerprint ? 'synced' : 'pending', pendingSourceFingerprint: current.lastSourceFingerprint === fingerprint ? '' : fingerprint,
    };
    if (!current.offerId) autoMapped++;
    else if (JSON.stringify(record) !== JSON.stringify(current)) refreshed++;
    mappings[String(offer.id)] = record; used.set(String(offer.id), String(product.id)); usedProducts.add(String(product.id));
    const producer = allegroRozpoznajProducenta(product, offer, offerSettings);
    const missingProducer = !tekst(product.producent, 300).trim();
    const missingBrand = !tekst(product.marka, 300).trim();
    const fields = {
      allegroOfferId: String(offer.id),
      ...(record.allegroProductId ? { allegroProductId: record.allegroProductId } : {}),
      ...(record.categoryId ? { allegroCategoryId: record.categoryId } : {}),
      ...(producer && missingProducer ? { producent: producer } : {}),
      ...(producer && missingBrand ? { marka: producer } : {}),
      ...(!canonicalGtin(product.gtin || product.ean) && canonicalGtin(offer.gtin || offer.ean) ? { ean: tekst(offer.ean || offer.gtin, 80), gtin: tekst(offer.gtin || offer.ean, 80) } : {}),
      ...(record.synced_at ? { allegroSyncedAt: record.synced_at } : {}),
      allegroSyncSource: 'offer-sync',
      ...(record.syncState === 'pending' ? {
        allegroEditorialSyncPending: true, allegroEditorialSyncPendingAt: product.allegroEditorialSyncPendingAt || now,
        allegroEditorialSyncState: 'pending',
        allegroEditorialSyncReason: 'zmiana danych sklepu po trwałym mapowaniu',
      } : {}),
    };
    if (offerSettings.syncDescriptions !== false && tekst(offer.descriptionText, 20000).trim()) {
      const offerDescription = tekst(offer.descriptionText, 20000).trim();
      if (offerDescription !== tekst(product.sourceMaterial?.allegroOfferDescription, 20000).trim()) {
        fields.sourceMaterial = { ...(product.sourceMaterial || {}), allegroOfferDescription: offerDescription };
        descriptionsUpdated++;
      }
    }
    if (producer && (producer !== product.producent || producer !== product.marka)) producersUpdated++;
    if (!product.zdjecie && offer.mainImage) fields.zdjecie = offer.mainImage;
    if ((!Array.isArray(product.zdjecia) || !product.zdjecia.length) && Array.isArray(offer.images) && offer.images.length > 1) fields.zdjecia = offer.images.slice(1, 16);
    if (applyUpdate(product.id, fields, ['allegroMappingStatus', 'allegroMappingConflict'])) productsUpdated++;
  }
  const pendingUpdates = productPatches.operations();
  const productDataChanged = pendingUpdates.length > 0;
  const canonicalFinal = canonicalizeAllegroMappings({ mappings, offers: offersList, products, now });
  const finalMappings = canonicalFinal.mappings;
  refreshed = Object.keys(finalMappings).filter((offerId) => baseMappings[offerId]
    && !allegroMappingRecordsEqual(finalMappings[offerId], baseMappings[offerId])).length;
  if (autoMapped || refreshed || quarantined || reassessed || canonical.changed || canonicalFinal.changed || productDataChanged) {
    await Promise.all([
      zapiszMapowaniaBezpiecznie(baseMappings, finalMappings, now),
      ...(productDataChanged ? [zapiszOperacjeProduktow(pendingUpdates, now)] : []),
    ]);
  }
  return { mappings: finalMappings, autoMapped, refreshed, quarantined, reassessed, descriptionsUpdated, producersUpdated, productsUpdated, canonical: canonicalFinal.stats };
}
function allegroAgentWirtualnyProduktOferty(line = {}, offer = {}) {
  const offerId = tekst(line.offerId || offer.id || '', 120).trim();
  const haystack = allegroNormalizujKlucz([
    offer.supplier, offer.dostawca, offer.producer, offer.producent, offer.manufacturer,
    offer.brand, offer.name, line.offerName,
  ].filter(Boolean).join(' '));
  const supplier = haystack.includes('alexander') ? 'Alexander'
    : haystack.includes('multigra') ? 'Multigra'
      : (haystack.includes('godan') || haystack.includes('go dan')) ? 'Godan' : '';
  const externalId = tekst(line.externalId || offer.externalId || '', 160).trim();
  const ean = tekst(offer.ean || offer.gtin || '', 80).trim();
  const producerCode = tekst(offer.manufacturerCode || offer.producerCode || '', 160).trim();
  if (!offerId || !supplier || !(externalId || ean || producerCode)) return null;
  const id = `allegro-offer:${offerId}`;
  const name = tekst(line.offerName || offer.name || `Oferta Allegro ${offerId}`, 300).trim();
  return {
    id,
    product: {
      id, productId: id, nazwa: name, name,
      externalId, sku: externalId, ean, gtin: ean, kodProducenta: producerCode,
      producent: supplier, marka: supplier, dostawca: supplier,
      zdjecie: tekst(offer.mainImage || offer.images?.[0] || '', 3000),
      allegroOfferId: offerId, allegroProductId: tekst(offer.productId || '', 120),
      virtualFromAllegroOffer: true,
    },
    match: 'pełne dane oferty Allegro — produkt poza kartoteką sklepu',
    confidence: ean ? 99 : 96,
    supplierMatchVerified: true,
    matchEvidence: ['oferta Allegro', supplier, externalId || producerCode || ean],
    virtualProduct: true,
  };
}
function allegroAgentProduktDlaPozycji(line = {}, offer = {}, mappings = {}, products = new Map()) {
  const offerId = String(line.offerId || '').trim();
  const mapped = mappings[offerId];
  if (mapped?.blocked === true && mapped?.withdrawnAt && mapped?.previousProductId && products.has(String(mapped.previousProductId))) {
    const archivedId = String(mapped.previousProductId), product = products.get(archivedId);
    return { id: archivedId, product, match: 'historyczne mapowanie wycofanej oferty', confidence: Number(mapped.confidence || 100), supplierMatchVerified: true, matchEvidence: ['oferta wycofana po sprzedaży', 'zachowane mapowanie zamówienia'] };
  }
  if (mapped?.blocked === true) return allegroAgentWirtualnyProduktOferty(line, offer);
  const mappedId = String(mapped?.productId ?? mapped?.produktId ?? mapped?.id ?? mapped ?? '').trim();
  if (mappedId && products.has(mappedId)) {
    const product = products.get(mappedId);
    const assessment = allegroOcenaPowiazania(product, { ...offer, name: offer.name || line.offerName, externalId: offer.externalId || line.externalId });
    if (assessment.valid && assessment.score >= 88) return { id: mappedId, product, match: `zweryfikowane mapowanie: ${assessment.reason}`, confidence: assessment.score, supplierMatchVerified: true, matchEvidence: assessment.evidence };
  }
  if (mappedId && mappingVerifiedForSupplier(mapped)) {
    return {
      id: mappedId,
      product: mappedProductFallback(mapped, line, offer, mappedId),
      match: 'zatwierdzone mapowanie — kartoteka poza aktywnym katalogiem',
      confidence: Number(mapped.confidence || 100),
      supplierMatchVerified: true,
      matchEvidence: Array.isArray(mapped.evidence) ? mapped.evidence : ['ręczne zatwierdzenie administratora'],
      virtualProduct: true,
    };
  }
  const ext = allegroNormalizujKlucz(line.externalId || offer.externalId || '');
  const ean = offer.ean || offer.gtin || '';
  const code = allegroNormalizujKlucz(offer.manufacturerCode || offer.producerCode || '');
  const name = allegroNormalizujKlucz(line.offerName || offer.name || '');
  const candidates = [...products.values()].map((p) => {
    const pe = p.gtin || p.ean || '';
    const px = allegroNormalizujKlucz(p.externalId || p.sku || '');
    const pc = allegroNormalizujKlucz(p.kodProducenta || p.mpn || '');
    const pn = allegroNormalizujKlucz(p.nazwa || p.name || '');
    let score = 0, match = '';
    if (ean && pe && (gtinEquivalent(pe, ean) || allegroNormalizujKlucz(pe) === allegroNormalizujKlucz(ean))) { score = 99; match = 'EAN/GTIN'; }
    else if (ext && px === ext) { score = 96; match = 'SKU/external.id'; }
    else if (code && pc === code) { score = 93; match = 'kod producenta'; }
    else if (name && pn === name) { score = 90; match = 'identyczna nazwa'; }
    else if (name.length >= 8 && pn.length >= 8 && (pn.includes(name) || name.includes(pn))) { score = 91; match = 'pełna fraza nazwy'; }
    else {
      const similarity = allegroPodobienstwoNazw(line.offerName || offer.name || '', p.nazwa || p.name || '');
      if (similarity >= 0.9) { score = 82 + Math.round(similarity * 6); match = 'bardzo podobna nazwa'; }
    }
    return score ? { product: p, score, match } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  const best = candidates[0], second = candidates[1];
  if (!best || best.score < 88 || (second && best.score - second.score < 5)) return allegroAgentWirtualnyProduktOferty(line, offer);
  return { id: String(best.product.id), product: best.product, match: best.match, confidence: best.score, supplierMatchVerified: best.score >= 88 };
}
function allegroAgentZlecenieAktywne(z = {}) {
  const official = allegroStatusKolejkiZamowienia(z, {});
  const local = [z.warehouseStage, z.agentStage, z.localStage, z.magazynStatus, z.localStatus]
    .map((value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l'));
  const completedLocally = local.some((value) => ['zrealizowane', 'zamkniete', 'wyslane', 'anulowane'].includes(value))
    || z.agentHandled === true || z.localCompleted === true;
  return !['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(official) && !completedLocally;
}
async function allegroAgentPrzetworzZamowienia(items = [], options = {}) {
  const [settingsRec, offersRec, mappingsRec] = await Promise.all([
    czytaj('settings', { data: {}, rev: 0, updated_at: null }),
    czytaj('allegro_offers', { items: [] }),
    czytaj('allegro_mappings', { items: {} }),
  ]);
  const dane = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
  const stany = dane.artway_stany && typeof dane.artway_stany === 'object' ? dane.artway_stany : {};
  const kartoteki = dane.artway_magazyn_produkty && typeof dane.artway_magazyn_produkty === 'object' ? dane.artway_magazyn_produkty : {};
  const products = await allegroAgentProduktyKompletne(dane);
  const offers = new Map(allegroOfertyItems(offersRec).map((o) => [String(o.id || ''), o]));
  const mappings = allegroMapowaniaItems(mappingsRec);
  const aktywne = (Array.isArray(items) ? items : []).filter(allegroAgentZlecenieAktywne);
  const noweIds = new Set((Array.isArray(options.newOrderIds) ? options.newOrderIds : []).map((id) => String(id)));
  const swiezyLimit = Date.now() - 48 * 60 * 60 * 1000;
  const automatyczneIds = new Set(aktywne.filter((z) => {
    if (noweIds.has(String(z.id || z.nr || ''))) return true;
    if (z.agentReviewedAt) return false;
    const data = Date.parse(z.createdAt || z.firstFetchedAt || '');
    return Number.isFinite(data) && data >= swiezyLimit;
  }).map((z) => String(z.id || z.nr || '')));
  const lineMatches = new Map(), reservations = new Map();
  let autoMapped = 0;
  for (const z of aktywne) {
    const orderId = String(z.id || z.nr || '').trim();
    const matched = [];
    for (const line of Array.isArray(z.lineItems) ? z.lineItems : []) {
      const offerId = String(line.offerId || '').trim();
      const offer = offers.get(offerId) || {};
      const match = allegroAgentProduktDlaPozycji(line, offer, mappings, products);
      const quantity = Math.max(1, Number(line.quantity) || 1);
      const rec = { line, offer, match, quantity };
      matched.push(rec);
      if (match?.id) {
        const currentMapping = mappings[offerId];
        const currentMappedId = String(currentMapping?.productId ?? currentMapping?.produktId ?? currentMapping?.id ?? currentMapping ?? '').trim();
        const requiresDurableMapping = !currentMapping || (currentMappedId && !products.has(currentMappedId))
          || currentMapping.verifiedForSupplier !== true || !currentMapping.productSnapshot;
        if (offerId && match.supplierMatchVerified === true && !match.virtualProduct && requiresDurableMapping) {
          mappings[offerId] = { ...currentMapping, offerId, productId: String(match.id), allegroProductId: tekst(offer.productId || '', 120), categoryId: tekst(offer.categoryId || '', 80), productName: tekst(match.product?.nazwa || match.product?.name || line.offerName || '', 300), linked_at: currentMapping?.linked_at || new Date().toISOString(), synced_at: new Date().toISOString(), operator: currentMapping?.operator || `auto-order:${match.match}`, confidence: Number(match.confidence || 0), verifiedForSupplier: true, verification: currentMapping?.verification || 'strong-identifiers', productSnapshot: mappingProductSnapshot(match.product, dane) };
          autoMapped++;
        }
        reservations.set(match.id, (reservations.get(match.id) || 0) + quantity);
      }
    }
    lineMatches.set(orderId, matched);
  }
  const supplierOrders = Array.isArray(dane.artway_agent_ai_zlecenia)
    ? dane.artway_agent_ai_zlecenia.map((z) => ({ ...z, pozycje: Array.isArray(z.pozycje) ? z.pozycje.map((p) => ({ ...p })) : [] }))
    : [];
  const supplierDocsByProduct = new Map();
  for (const z of supplierOrders.filter(supplierOrderHasActiveContent)) for (const p of z.pozycje || []) {
    const id = String(p.produktId || '');
    if (!id) continue;
    if (!supplierDocsByProduct.has(id)) supplierDocsByProduct.set(id, []);
    supplierDocsByProduct.get(id).push({ id: z.id, numer: z.numer, status: z.status, dostawca: p.dostawca, ilosc: p.ilosc });
  }
  const now = new Date().toISOString();
  const updatedItems = (Array.isArray(items) ? items : []).map((z) => {
    if (!allegroAgentZlecenieAktywne(z)) return z;
    const orderId = String(z.id || z.nr || '');
    const positions = (lineMatches.get(orderId) || []).map(({ line, offer, match, quantity }) => {
      if (!match?.id) return { offerId: line.offerId, nazwa: line.offerName || offer.name || 'Produkt Allegro', ilosc: quantity, decision: 'nierozpoznany', reason: 'Brak jednoznacznego EAN/SKU lub mapowania oferty' };
      const productId = match.id, meta = kartoteki[productId] && typeof kartoteki[productId] === 'object' ? kartoteki[productId] : {};
      const legacyStockKnown = Object.prototype.hasOwnProperty.call(stany, productId) && stany[productId] !== '' && stany[productId] != null && Number.isFinite(Number(stany[productId]));
      const inventory = resolveWarehouseInventory(match.product, { legacyStockKnown, legacyStock: stany[productId], legacyMeta: meta });
      const known = inventory.stockKnown, stock = inventory.stock, reserved = reservations.get(productId) || 0, available = stock - reserved, shortage = Math.max(0, -available);
      const docs = supplierDocsByProduct.get(productId) || [];
      const location = tekst(inventory.location, 120), classification = classifyWarehousePosition({ matched: true, stockKnown: known, shortage, location });
      return { offerId: line.offerId, productId, externalId: tekst(match.product?.externalId || match.product?.sku || match.product?.kodProducenta || match.product?.mpn || line.externalId || '', 160), ean: tekst(match.product?.gtin || match.product?.ean || offer.ean || offer.gtin || '', 80), nazwa: line.offerName || match.product?.nazwa || offer.name || `Produkt ${productId}`, ilosc: quantity, match: match.match, confidence: Number(match.confidence || 0), supplierMatchVerified: match.supplierMatchVerified === true, stock, stockRecordKnown: known, inventorySource: inventory.source, reserved, available, shortage, location, supplier: tekst(inventory.supplier, 120), product: match.product, supplierOrders: docs, decision: classification.decision, locationMissing: classification.locationMissing, fulfillmentReady: classification.fulfillmentReady };
    });
    const analysis = summarizeWarehousePositions(positions);
    let warehouseStage = String(z.warehouseStage || 'do_sprawdzenia').toLowerCase();
    if (z.supplierProcurement?.status === 'dostawa_przyjeta') warehouseStage = 'kompletacja';
    else if (!['oczekuje_na_dostawe', 'kompletacja', 'spakowane', 'zrealizowane'].includes(warehouseStage)) warehouseStage = analysis.braki > 0 ? 'braki' : warehouseAnalysisNeedsInvestigation(analysis) ? 'do_sprawdzenia' : 'kompletacja';
    return { ...z, warehouseStage, warehouseStageUpdatedAt: now, agentReviewedAt: now, agentVersion: 'allegro-stock-agent-v2', agentAnalysis: { positions, ...analysis } };
  });
  if (autoMapped) await zapisz('allegro_mappings', { items: mappings, updated_at: now });
  const activeIds = new Set(aktywne.map((z) => String(z.id || z.nr || '')));
  return { items: updatedItems, mappings, report: { reviewed: aktywne.length, autoEligible: automatyczneIds.size, autoMapped, shortagesAdded: 0, supplierDocumentsChanged: 0, supplierReferencesChanged: 0, unresolved: updatedItems.filter((z) => activeIds.has(String(z.id || z.nr || ''))).reduce((s, z) => s + Number(z.agentAnalysis?.nierozpoznane || 0) + Number(z.agentAnalysis?.bezStanu || 0), 0), ready: updatedItems.filter((z) => activeIds.has(String(z.id || z.nr || '')) && z.agentAnalysis?.gotowe).length, at: now } };
}
async function allegroZapisStanIMozeUzgodnijPlan(items = []) {
  const inventory = await storeOrderSupplierReconciliation.finalizeAllegroInventorySafely(items);
  const supplierReconciliation = inventory.ok
    ? await storeOrderSupplierReconciliation.reconcileDraftsSafely()
    : { ok: false, changed: false, pendingRetry: true, code: 'allegro_inventory_pending', error: 'Plan nie został przeliczony, dopóki stan wysłanych zleceń Allegro nie zostanie bezpiecznie zdjęty.', inventory };
  // Lokalny etap kompletacji wynika z bieżącego stanu i powiązań dokumentów.
  // Nie może pozostać zablokowany przez niezależny błąd rozchodu innego,
  // wcześniej wysłanego zamówienia. Sam Plan zatowarowania nadal zachowuje
  // ostrzejszą blokadę powyżej.
  const settings = await czytaj('settings', { data: {} });
  const procurementWorkflow = await synchronizujEtapyZakupoweZlecen(
    Array.isArray(settings.data?.artway_agent_ai_zlecenia) ? settings.data.artway_agent_ai_zlecenia : [],
    supplierReconciliation.ok === false ? 'allegro-sync-inventory-pending' : 'allegro-sync',
  );
  return { inventory, supplierReconciliation, procurementWorkflow: { changed: procurementWorkflow.changed } };
}
async function allegroPrzeliczZamowieniaPoMapowaniu(options = {}) {
  const rec = await czytaj('allegro_orders', { items: [], updated_at: null });
  const source = Array.isArray(rec.items) ? rec.items : [];
  const result = await allegroAgentPrzetworzZamowienia(source, { newOrderIds: [] });
  const updated_at = new Date().toISOString();
  const zapis = { ...rec, items: result.items, updated_at, agent: { ...result.report, source: tekst(options.source || 'order-recalculation', 100) } };
  await zapisz('allegro_orders', zapis);
  if (options.reconcile === false) return { orders: result.items, agent: zapis.agent, updated_at };
  const plan = await allegroZapisStanIMozeUzgodnijPlan(result.items);
  return { orders: result.items, agent: zapis.agent, ...plan, updated_at };
}
async function synchronizujEtapyZakupoweZlecen(supplierOrders = [], source = 'supplier-plan') {
  const record = await czytaj('allegro_orders', { items: [], updated_at: null });
  const current = Array.isArray(record.items) ? record.items : [];
  const result = applySupplierProcurementWorkflow(current, supplierOrders, { at: new Date() });
  if (result.changed) {
    await zapisz('allegro_orders', {
      ...record,
      items: result.items,
      procurement_updated_at: new Date().toISOString(),
      procurement_source: tekst(source, 80),
    });
  }
  return { changed: result.changed, orders: result.items };
}
function allegroNormalizujOferte(o) {
  const price = o?.sellingMode?.price || o?.price || {};
  const stock = o?.stock || {};
  const images = allegroZdjecia(o);
  const gtins = allegroOfferGtinCandidates(o), ean = gtins[0]?.raw || '';
  const kodProducenta = allegroWartoscParametru(o, ['kod producenta', 'mpn', 'symbol', 'symbol producenta']);
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
    gtins: gtins.map((x) => x.raw),
    canonicalGtins: gtins.map((x) => x.canonical),
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
function allegroScalSzczegolyOferty(previous = {}, next = {}, detailed = false) {
  if (detailed || !previous?.id) return next;
  const merged = { ...previous, ...next };
  const richFields = ['productId', 'ean', 'gtin', 'gtins', 'canonicalGtins', 'manufacturerCode', 'producerCode', 'brand', 'images', 'mainImage', 'parameters', 'descriptionText', 'productSet', 'delivery', 'payments', 'afterSalesServices', 'publication', 'location'];
  for (const field of richFields) {
    const value = next[field];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) merged[field] = previous[field];
  }
  return merged;
}
function allegroMapowaniaItems(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return raw.items && typeof raw.items === 'object' ? raw.items : raw;
}

function allegroNormalizujKlucz(v = '') {
  return tekst(v, 500).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function allegroTokeny(v = '') {
  return new Set(allegroNormalizujKlucz(v).split(/\s+/).filter((x) => x.length > 2));
}
function allegroPodobienstwoNazw(a = '', b = '') {
  const aa = allegroTokeny(a), bb = allegroTokeny(b);
  if (!aa.size || !bb.size) return 0;
  let wspolne = 0;
  for (const x of aa) if (bb.has(x)) wspolne++;
  return wspolne / Math.max(aa.size, bb.size);
}
function allegroTokenyIstotne(v = '') {
  const stop = new Set(['gra', 'gry', 'zabawka', 'zabawki', 'zestaw', 'alexander', 'multigra', 'godan', 'origami', 'konstruktor', 'junior', 'maly', 'mala', 'duzy', 'duza', 'dla', 'oraz', 'wersja', 'szt', 'elementow']);
  return new Set(allegroNormalizujKlucz(v).split(/\s+/).filter((x) => x.length > 2 && !stop.has(x)));
}
function allegroPodobienstwoIstotne(a = '', b = '') {
  const aa = allegroTokenyIstotne(a), bb = allegroTokenyIstotne(b);
  if (!aa.size || !bb.size) return 0;
  let common = 0;
  for (const token of aa) if (bb.has(token)) common++;
  return common / Math.max(aa.size, bb.size);
}
function allegroOcenaPowiazania(product = {}, offer = {}) {
  return scoreAllegroProductMapping(product, offer);
}
function allegroPowiazanieWiarygodne(product = {}, offer = {}) {
  const offerName = tekst(offer.name || offer.offerName, 400).trim();
  const hasOfferEvidence = !!(offerName || offer.productId || offer.ean || offer.gtin || offer.externalId || offer.manufacturerCode || offer.producerCode);
  if (!hasOfferEvidence) return true;
  return allegroOcenaPowiazania(product, offer).valid;
}
function allegroOfertyItems(raw) {
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw?.items) ? raw.items : [];
}
function allegroDopasowanieOferty(product = {}, offers = [], mappings = {}, minimumScore = 85) {
  return findBestAllegroOffer(product, offers, mappings, minimumScore);
}
function allegroPodobneOferty(product = {}, offersRaw = [], limit = 5) {
  return allegroOfertyItems(offersRaw).map((o) => {
    const similarity = allegroPodobienstwoNazw(product.nazwa || product.name, o.name);
    const sameCategory = product.allegroCategoryId && String(product.allegroCategoryId) === String(o.categoryId || '');
    return { offer: o, score: similarity + (sameCategory ? 0.25 : 0) };
  }).filter((x) => x.score >= 0.18).sort((a, b) => b.score - a.score).slice(0, limit);
}
function allegroZdania(v = '') {
  return tekst(v, 20000).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 18);
}
function allegroOpisKrotki(product = {}, podobne = []) {
  const wlasny = tekst(allegroSanitizePlainText(product.opisKrotki || product.krotkiOpis || product.shortDescription).text, 500).trim();
  if (wlasny) return tekst(allegroZdania(wlasny).slice(0, 2).join(' ') || wlasny, 420).trim();
  const opis = allegroZdania(allegroSanitizePlainText(product.opis || '').text).filter((x) => !/^(zawartość|w zestawie|wymiary|ostrzeżenie)/i.test(x));
  if (opis.length) return tekst(opis.slice(0, 2).join(' '), 420).trim();
  const nazwy = podobne.map((x) => x.offer?.name).filter(Boolean);
  const kat = tekst(product.kategoria || 'gry i zabawki', 120).toLowerCase();
  const inspiracja = nazwy.length ? ` Pasuje do produktów wyszukiwanych także jako: ${nazwy.slice(0, 2).map((x) => tekst(x, 70)).join(' oraz ')}.` : '';
  return tekst(`${product.nazwa || 'Produkt'} to starannie wybrana propozycja z kategorii ${kat}, odpowiednia na prezent i do wspólnej zabawy.${inspiracja}`, 420);
}
function allegroOpisPelny(product = {}, shortDescription = '') {
  const blocks = [];
  if (shortDescription) blocks.push({ type: 'lead', text: shortDescription });
  const raw = tekst(allegroSanitizePlainText(product.allegroDescription || product.opis || '').text, 20000)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s*[•·▪◦]\s*/g, '\n• ')
    .replace(/\b(Opis produktu|Najważniejsze cechy|Cechy produktu|Zawartość opakowania|W zestawie|Skład zestawu|Zasady gry|Jak grać|Wymiary|Dane techniczne|Informacje dodatkowe|Ostrzeżenie|Bezpieczeństwo)\s*:/gi, '\n\n$1\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const heading = /^(opis produktu|najważniejsze cechy|cechy produktu|zawartość opakowania|w zestawie|skład zestawu|zasady gry|jak grać|wymiary|dane techniczne|informacje dodatkowe|ostrzeżenie|bezpieczeństwo)$/i;
  const sourceBlocks = raw.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  let currentTitle = '';
  for (const source of sourceBlocks) {
    const lines = source.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    for (const line of lines) {
      if (heading.test(line)) { currentTitle = line; continue; }
      if (/^•\s+/.test(line)) {
        const last = blocks[blocks.length - 1];
        if (last?.type === 'list' && (!currentTitle || last.title === currentTitle)) last.items.push(line.replace(/^•\s+/, ''));
        else blocks.push({ type: 'list', title: currentTitle, items: [line.replace(/^•\s+/, '')] });
        currentTitle = '';
        continue;
      }
      const sentences = allegroZdania(line);
      const parts = sentences.length > 3 ? Array.from({ length: Math.ceil(sentences.length / 2) }, (_, i) => sentences.slice(i * 2, i * 2 + 2).join(' ')) : [line];
      for (const text of parts.filter(Boolean)) {
        blocks.push({ type: 'body', title: currentTitle, text });
        currentTitle = '';
      }
    }
  }
  if (!blocks.some((x) => x.type === 'body' || x.type === 'list') && shortDescription) blocks.push({ type: 'body', title: 'Opis produktu', text: shortDescription });
  const usesCanonicalSharedDescription = product.contentEditorial?.targets?.store === true
    && product.contentEditorial?.targets?.allegro === true;
  const rawKey = allegroNormalizujKlucz(raw), facts = usesCanonicalSharedDescription ? [] : [
    product.marka || product.producent ? `Marka: ${product.marka || product.producent}` : '',
    product.kodProducenta || product.mpn ? `Kod producenta: ${product.kodProducenta || product.mpn}` : '',
    product.gtin || product.ean ? `EAN/GTIN: ${product.gtin || product.ean}` : '',
    product.rozmiar ? `Rozmiar: ${product.rozmiar}` : '',
    product.material ? `Materiał: ${product.material}` : '',
  ].filter(Boolean).filter((fact) => !rawKey.includes(allegroNormalizujKlucz(fact)));
  if (facts.length) blocks.push({ type: 'facts', items: facts });
  return blocks.slice(0, 12);
}
function allegroOpisPelnyTekst(product = {}, shortDescription = '') {
  return allegroOpisPelny(product, shortDescription).filter((x) => x.type !== 'lead').map((x) => {
    if (x.type === 'body') return [x.title, x.text].filter(Boolean).join('\n\n');
    if (x.type === 'list') return [x.title, ...(x.items || []).map((item) => `• ${item}`)].filter(Boolean).join('\n\n');
    if (x.type === 'facts') return ['Najważniejsze informacje', ...(x.items || []).map((item) => `• ${item}`)].join('\n\n');
    return '';
  }).filter(Boolean).join('\n\n');
}
function allegroSekcjeOpisu(product = {}, shortDescription = '') {
  const blocks = allegroOpisPelny(product, shortDescription);
  const items = [];
  for (const block of blocks) {
    if (block.type === 'lead') items.push({ type: 'TEXT', content: `<p><b>${htmlEscape(block.text)}</b></p>` });
    if (block.type === 'body' && block.text !== shortDescription) items.push({ type: 'TEXT', content: `${block.title ? `<h2>${htmlEscape(block.title)}</h2>` : ''}<p>${htmlEscape(block.text)}</p>` });
    if (block.type === 'list') items.push({ type: 'TEXT', content: `${block.title ? `<h2>${htmlEscape(block.title)}</h2>` : ''}<ul>${block.items.map((x) => `<li>${htmlEscape(x)}</li>`).join('')}</ul>` });
    if (block.type === 'facts') items.push({ type: 'TEXT', content: `<h2>Najważniejsze informacje</h2><ul>${block.items.map((x) => `<li>${htmlEscape(x)}</li>`).join('')}</ul>` });
  }
  const images = [product.zdjecie, ...(Array.isArray(product.zdjecia) ? product.zdjecia : [])].filter(Boolean);
  const sections = [];
  for (let i = 0; i < items.length; i++) {
    sections.push({ items: [items[i]] });
    if (images[i + 1] && (i === 0 || i === 2 || i === 4)) sections.push({ items: [{ type: 'IMAGE', url: tekst(images[i + 1], 1000) }] });
  }
  const source = sections.length ? sections : [{ items: [{ type: 'TEXT', content: `<p>${htmlEscape(product.nazwa || 'Produkt')}</p>` }] }];
  const sanitized = allegroSanitizeDescription({ sections: source });
  return sanitized.description.sections.length ? sanitized.description.sections : [{ items: [{ type: 'TEXT', content: `<p>${htmlEscape(product.nazwa || 'Produkt')}</p>` }] }];
}
async function allegroPobierzSzczegolyOfert(req, source, limit) {
  const out = [];
  const base = source.slice(0, limit);
  const batchSize = 25;
  for (let i = 0; i < base.length; i += batchSize) {
    const batch = base.slice(i, i + batchSize);
    const details = await Promise.all(batch.map(async (o) => {
      const id = tekst(o.id, 100);
      if (!id) return o;
      try {
        return await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(id)}`);
      } catch (productOfferError) {
        try { return await allegroWywolaj(req, `/sale/offers/${encodeURIComponent(id)}`); }
        catch (e) { return { ...o, detailError: tekst(e.message || productOfferError.message, 500) }; }
      }
    }));
    out.push(...details);
  }
  return out;
}
async function allegroAudytZgodnosciOfert(req, options = {}) {
  const requestedIds = [...new Set((Array.isArray(options.offerIds) ? options.offerIds : [options.offerId]).map((id) => tekst(id, 100).trim()).filter(Boolean))].slice(0, 50);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 25));
  const fix = options.fix === true;
  const activeOnly = options.activeOnly !== false;
  const [offersRec, previous] = await Promise.all([
    czytaj('allegro_offers', { items: [], updated_at: null }),
    czytaj('allegro_compliance_audit', { items: [], summary: {}, updated_at: null }),
  ]);
  const cached = allegroOfertyItems(offersRec);
  const previousById = new Map((Array.isArray(previous.items) ? previous.items : []).map((item) => [String(item?.offerId || ''), item]));
  const candidates = cached
    .filter((offer) => !activeOnly || ['ACTIVE', 'ACTIVATING'].includes(String(offer?.status || offer?.publication?.status || '').toUpperCase()))
    .sort((a, b) => (Date.parse(previousById.get(String(a?.id || ''))?.checkedAt || '') || 0) - (Date.parse(previousById.get(String(b?.id || ''))?.checkedAt || '') || 0));
  let source = requestedIds.length
    ? requestedIds.map((id) => cached.find((offer) => String(offer?.id || '') === id) || { id })
    : candidates.slice(0, limit);
  if (!source.length && !requestedIds.length) {
    const parameters = { limit, offset: 0 };
    if (activeOnly) parameters.publicationStatus = 'ACTIVE';
    const remote = await allegroWywolaj(req, '/sale/offers', { parameters });
    source = (Array.isArray(remote?.offers) ? remote.offers : (Array.isArray(remote?.items) ? remote.items : [])).slice(0, limit);
  }
  const details = await allegroPobierzSzczegolyOfert(req, source, requestedIds.length || limit);
  const now = new Date().toISOString();
  const results = [];
  const cacheUpdates = new Map();
  for (const offer of details) {
    const offerId = tekst(offer?.id, 100).trim();
    const name = tekst(offer?.name || `Oferta ${offerId}`, 300).trim();
    const status = tekst(offer?.publication?.status || offer?.status || '', 80).toUpperCase();
    if (!offerId) continue;
    if (offer.detailError) {
      results.push({ offerId, name, status, ok: false, error: tekst(offer.detailError, 700), checkedAt: now });
      continue;
    }
    const before = allegroCheckText(allegroOpisTekst(offer.description));
    let finalCheck = before;
    let fixed = false;
    let removedCount = 0;
    let changedBlocks = 0;
    let layoutPreserved = true;
    let layout = null;
    let error = '';
    if (!before.ok && fix) {
      try {
        const enforced = allegroEnforceDraft({ name, description: offer.description || { sections: [] } });
        if (!enforced.compliance.ok) {
          const complianceError = new Error('Opis po automatycznym oczyszczeniu nadal narusza reguły zgodności');
          complianceError.code = 'allegro_compliance_block';
          throw complianceError;
        }
        const meta = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', bodyObj: { description: enforced.draft.description }, withMeta: true });
        await allegroCzekajNaOperacjeOferty(req, meta?.location || '');
        const verified = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`);
        finalCheck = allegroCheckText(allegroOpisTekst(verified.description));
        fixed = finalCheck.ok;
        removedCount = enforced.compliance.removedCount;
        changedBlocks = enforced.compliance.changedBlocks;
        layoutPreserved = enforced.compliance.layoutPreserved !== false;
        layout = enforced.compliance.layout || null;
        cacheUpdates.set(offerId, allegroNormalizujOferte(verified));
      } catch (auditError) {
        error = tekst(auditError?.message || auditError, 700);
      }
    }
    results.push({
      offerId,
      name,
      status,
      ok: finalCheck.ok,
      hadViolation: !before.ok,
      fixed,
      removedCount,
      changedBlocks,
      layoutPreserved,
      layout,
      violations: (finalCheck.ok ? before.violations : finalCheck.violations).map((item) => ({ id: item.id, label: item.label, matches: item.matches })),
      error,
      checkedAt: now,
      policyId: ALLEGRO_COMPLIANCE_POLICY.id,
    });
  }
  if (cacheUpdates.size) {
    const items = cached.map((offer) => cacheUpdates.has(String(offer?.id || '')) ? allegroScalSzczegolyOferty(offer, cacheUpdates.get(String(offer.id)), true) : offer);
    await zapisz('allegro_offers', { ...offersRec, items, updated_at: now });
  }
  const merged = new Map((Array.isArray(previous.items) ? previous.items : []).map((item) => [String(item?.offerId || ''), item]));
  for (const item of results) merged.set(String(item.offerId), item);
  const items = [...merged.values()].filter((item) => item.offerId).sort((a, b) => String(b.checkedAt || '').localeCompare(String(a.checkedAt || ''))).slice(0, 2000);
  const summary = {
    checked: results.length,
    violations: results.filter((item) => item.hadViolation).length,
    remaining: results.filter((item) => !item.ok).length,
    fixed: results.filter((item) => item.fixed).length,
    errors: results.filter((item) => item.error).length,
    allAudited: items.length,
    allOpen: items.filter((item) => !item.ok).length,
  };
  const audit = { items, summary, updated_at: now, policy: ALLEGRO_COMPLIANCE_POLICY };
  await zapisz('allegro_compliance_audit', audit);
  return { ...audit, run: results, fix, activeOnly };
}
async function przygotujPakietProduktuZLinku(req, target = '', options = {}) {
  return productLinkPackagePreparer(req, target, options);
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
  if (/\b(alexander|multigra|godan)\b/.test(allText)) base.push('zabawki dla dzieci');
  if (/\b(wiatrak|wiatraczek)\b/.test(allText)) base.push('wiatraczki zabawki', 'zabawki ogrodowe dla dzieci');
  return [...new Set([...allegroCategoryIntentPhrases(allText), ...base].map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length >= 2))].slice(0, 8);
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
    if (!path.length) path.push(...allegroCategoryParentPath(c.parent || item.parent));
    if (name && path[path.length - 1] !== name) path.push(name);
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
  score += allegroCategorySpecificScore(productText, catText);
  const toyProduct = /\b(alexander|multigra|godan|zabawk|gra|gry|plansz|edukacyjn|kreatywn|origami|puzzle|wiatrak|wiatraczek|balon)\b/.test(productText);
  if (toyProduct && /\b(motoryzac|czesci samochod|samochod osobow|uklad napedow|silnik|karoseri|zawieszen)\b/.test(catText)) score -= 1000;
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
function allegroGtinsProduktuKatalogowego(product = {}) {
  const values = [product.eans, product.gtins, product.ean, product.gtin];
  for (const parameter of Array.isArray(product.parameters) ? product.parameters : []) {
    const name = allegroNormalizujKlucz(parameter?.name || parameter?.label || '');
    const id = String(parameter?.id || '').trim();
    if (parameter?.options?.isGTIN === true || ['225693', '245669', '245673'].includes(id) || /(^| )(ean|gtin|isbn|issn|kod kreskowy)( |$)/.test(name)) {
      values.push(parameter?.values, parameter?.valuesLabels, parameter?.value);
    }
  }
  return [...new Set(values.flat(Infinity).map(canonicalGtin).filter(Boolean))];
}
function allegroOcenaTozsamosciKatalogu(product = {}, candidate = {}) {
  const gtin = canonicalGtin(product.gtin || product.ean || '');
  const candidateGtins = allegroGtinsProduktuKatalogowego(candidate);
  const nameScore = allegroPodobienstwoNazw(product.nazwa || product.name, candidate.name);
  const commercial = allegroProductCommercialIdentity(product);
  const productBrands = commercial.identityCandidates.map(allegroNormalizujKlucz).filter(Boolean);
  const productBrand = productBrands[0] || '';
  const candidateBrand = allegroNormalizujKlucz(candidate.brand || allegroWartoscParametru(candidate, ['producent', 'marka', 'brand']));
  const productCode = tekst(product.kodProducenta || product.mpn || product.numerReferencyjny || product.externalId || product.sku, 160).trim();
  const candidateCodes = [
    allegroWartoscParametru(candidate, ['kod producenta', 'mpn', 'symbol producenta', 'numer referencyjny']),
    candidate.manufacturerCode, candidate.producerCode,
  ].filter(Boolean);
  const productName = allegroNormalizujKlucz(product.nazwa || product.name || '');
  const candidateBrandCorroborated = !!(candidateBrand && productName && (
    productName === candidateBrand
    || productName.includes(candidateBrand)
    || candidateBrand.includes(productName)
  ));
  return evaluateAllegroCatalogIdentitySignals({ gtin, candidateGtins, nameScore, productBrand, productBrands, candidateBrand, productCode, candidateCodes, candidateBrandCorroborated });
}
function allegroNormalizujProduktKatalogu(product = {}, raw = {}) {
  const candidate = {
    id: tekst(raw.id, 120), name: tekst(raw.name, 300), categoryId: tekst(raw.category?.id || raw.categoryId || '', 80),
    eans: Array.isArray(raw.eans) ? raw.eans.map((x) => tekst(x, 80)) : [], images: allegroZdjecia(raw),
    parameters: Array.isArray(raw.parameters) ? raw.parameters.slice(0, 120) : [], descriptionText: allegroOpisTekst(raw.description),
    brand: allegroWartoscParametru(raw, ['producent', 'marka', 'brand']), trustedContent: raw.trustedContent || null, productSafety: raw.productSafety || null,
    matchScore: Number(allegroPodobienstwoNazw(product.nazwa || product.name, raw.name).toFixed(3)),
  };
  return { ...candidate, identity: allegroOcenaTozsamosciKatalogu(product, candidate) };
}
async function allegroPobierzProduktKataloguPoId(req, product = {}, productId = '') {
  const id = tekst(productId, 160).trim();
  if (!id) return null;
  return allegroNormalizujProduktKatalogu(product, await allegroWywolaj(req, `/sale/products/${encodeURIComponent(id)}`));
}
async function allegroZnajdzProduktKatalogu(req, product = {}) {
  const gtinRaw = tekst(product.gtin || product.ean || '', 80).trim();
  const gtin = canonicalGtin(gtinRaw);
  if (!gtinRaw) return { selected: null, products: [], searchedBy: '', blockedReason: 'Brak EAN/GTIN — automat nie szuka ani nie podpina produktu katalogowego po nazwie.' };
  if (!gtin) return { selected: null, products: [], searchedBy: 'GTIN', blockedReason: 'EAN/GTIN ma niepoprawną długość lub cyfrę kontrolną.' };
  try {
    const searchedBy = 'GTIN';
    const parameters = { phrase: gtinRaw.replace(/\D/g, ''), mode: 'GTIN', language: 'pl-PL' };
    const raw = await allegroWywolaj(req, '/sale/products', { parameters });
    const source = Array.isArray(raw.products) ? raw.products : (Array.isArray(raw.items) ? raw.items : []);
    const products = source.map((item) => allegroNormalizujProduktKatalogu(product, item)).filter((item) => item.id);
    const selection = selectAllegroCatalogCandidate(products, { preferredProductId: product.allegroProductId });
    const { verified, ambiguous } = selection;
    let { selected } = selection;
    if (selected?.id) {
      try {
        const detailed = await allegroPobierzProduktKataloguPoId(req, product, selected.id);
        selected = detailed?.identity?.verified ? detailed : null;
      } catch {}
    }
    return {
      selected,
      products: products.slice(0, 10),
      searchedBy,
      blockedReason: ambiguous ? 'Ten sam GTIN zwrócił kilka podobnych produktów — wymagana jest ręczna decyzja.'
        : (!selected && products.length ? 'Wyniki GTIN nie mają zgodnej nazwy lub producenta — automat nie podepnie produktu.' : ''),
    };
  } catch (e) {
    return { selected: null, products: [], searchedBy: 'GTIN', error: { status: e.status || 0, code: e.code || '', message: e.message || String(e) } };
  }
}
function allegroBrakujaceParametryWymagane(product = {}, categoryParameters = []) {
  const auto = allegroParametryAutomatyczne(product, categoryParameters);
  const custom = Array.isArray(product.allegroParameters) ? product.allegroParameters : [];
  const present = new Set([...auto, ...custom].map((x) => String(x?.id || '')).filter(Boolean));
  return (Array.isArray(categoryParameters) ? categoryParameters : []).filter((p) => (p?.required === true || p?.requiredForProduct === true) && p?.options?.describesProduct === true && !present.has(String(p.id))).map((p) => ({
    id: tekst(p.id, 80), name: tekst(p.name, 180), type: tekst(p.type, 40), unit: tekst(p.unit, 40), dictionary: Array.isArray(p.dictionary) ? p.dictionary.slice(0, 200) : [], restrictions: p.restrictions || {},
  }));
}
const allegroWarunkiSprzedazy = createAllegroSalesConditionsLoader({ call: (req, path, options) => allegroWywolaj(req, path, options) });
const allegroCzekajNaStatusOferty = createAllegroOfferStatusWaiter({ call: (req, path, options) => allegroWywolaj(req, path, options) });
async function allegroParametryKategorii(req, categoryId = '') {
  const id = tekst(categoryId, 80).trim();
  if (!id) return { parameters: [], errors: [] };
  try {
    const raw = await allegroWywolaj(req, `/sale/categories/${encodeURIComponent(id)}/parameters`);
    return { parameters: Array.isArray(raw.parameters) ? raw.parameters : [], errors: [] };
  } catch (e) {
    return { parameters: [], errors: [{ key: 'categoryParameters', status: e.status || 0, code: e.code || '', message: e.message || String(e) }] };
  }
}
function allegroParametryAutomatyczne(product = {}, categoryParameters = []) {
  return allegroAutomaticCategoryParameters(product, categoryParameters);
}
function allegroScalParametryBezDuplikatow(...groups) {
  const byId = new Map();
  for (const list of groups) for (const param of Array.isArray(list) ? list : []) {
    const id = tekst(param?.id, 80).trim();
    if (!id) continue;
    byId.set(id, param);
  }
  return [...byId.values()];
}
function allegroUstawieniaOfert(raw = {}) { return normalizeAllegroOfferSettings(raw); }
async function allegroPobierzUstawieniaOfert() {
  return allegroUstawieniaOfert(await czytaj('allegro_offer_settings', { defaultStock: ALLEGRO_DEFAULT_OFFER_STOCK, republish: true, producers: ALLEGRO_DEFAULT_PRODUCERS, updated_at: null }));
}
const synchronizujSprzedazZDostepnosciaProducenta = createProductSaleChannelSynchronizer({
  read: czytaj, write: zapisz, getProducts: allegroAgentProduktyKompletne,
  getMappings: allegroMapowaniaItems, getOffers: allegroOfertyItems,
  getOfferSettings: allegroPobierzUstawieniaOfert, callAllegro: allegroWywolaj,
  waitForOperation: allegroCzekajNaOperacjeOferty, text: tekst,
});
function allegroRozpoznajProducenta(product = {}, evidence = {}, settings = {}) {
  const known = Array.isArray(settings.producers) && settings.producers.length
    ? settings.producers
    : ALLEGRO_DEFAULT_PRODUCERS;
  return recognizeProductManufacturer(product, evidence, known);
}
async function allegroAutoUzupelnijKatalogProduktow(req, options = {}) {
  const [settingsRec, offerSettings, previousAudit, mappingsRec] = await Promise.all([
    czytaj('settings', { data: {}, rev: 0, updated_at: null }),
    allegroPobierzUstawieniaOfert(),
    czytaj('allegro_catalog_maintenance', { cursor: 0, lastRun: null }),
    czytaj('allegro_mappings', { items: {}, updated_at: null }),
  ]);
  if (offerSettings.autoCatalog === false && offerSettings.syncDescriptions === false && offerSettings.autoUpdateOffers === false && offerSettings.autoFees === false) return { enabled: false, lastRun: previousAudit.lastRun || null };
  const data = settingsRec.data && typeof settingsRec.data === 'object' ? { ...settingsRec.data } : {};
  const completeProducts = await allegroAgentProduktyKompletne(data);
  const products = [...completeProducts.values()].filter((p) => p && p.id !== undefined);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 10));
  const start = products.length ? Math.max(0, Number(previousAudit.cursor) || 0) % products.length : 0;
  const requestedProductIds = new Set((Array.isArray(options.productIds) ? options.productIds : []).map((id) => String(id || '')).filter(Boolean));
  const pendingEditorial = products.filter((product) => product.allegroEditorialSyncPending === true).sort((left, right) => String(left.allegroEditorialSyncPendingAt || '').localeCompare(String(right.allegroEditorialSyncPendingAt || '')));
  const rotation = products.length <= limit ? products : Array.from({ length: limit }, (_, index) => products[(start + index) % products.length]);
  const requested = requestedProductIds.size ? products.filter((product) => requestedProductIds.has(String(product.id))) : [], candidates = options.pendingOnly === true ? [...requested, ...pendingEditorial] : [...requested, ...pendingEditorial, ...rotation], selected = [...new Map(candidates.map((product) => [String(product.id), product])).values()].slice(0, limit);
  const productPatches = createCentralProductPatchBuffer(completeProducts), applyUpdate = (id, fields = {}, remove = []) => productPatches.apply(id, fields, remove);
  const baseMappings = { ...allegroMapowaniaItems(mappingsRec) }, mappings = { ...baseMappings }, syncedMappingIds = new Set();
  const report = { enabled: true, lastRun: new Date().toISOString(), scanned: selected.length, verified: 0, updated: 0, matched: 0, categories: 0, producers: 0, titles: 0, descriptions: 0, offersUpdated: 0, feesUpdated: 0, gpsrMatched: 0, categoriesRepaired: 0, unresolved: 0, errors: [] };
  let responsibleProducers = null;
  for (const product of selected) {
    const trackPublication = product.allegroEditorialSyncPending === true || requestedProductIds.has(String(product.id));
    const automaticDisposition = allegroAutomaticPreparationDisposition(product);
    // Zwykła rotacja konserwacyjna nie jest zgodą na ponowne przepisywanie
    // aktywnej oferty. Taką ofertę kontroluje lekka synchronizacja statusów.
    // Pełna aktualizacja wraca dopiero dla jawnej kolejki publikacji lub
    // konkretnego produktu wskazanego przez administratora.
    if (automaticDisposition.verificationOnly && !trackPublication) {
      report.verified = Math.max(0, Number(report.verified) || 0) + 1;
      continue;
    }
    const workId = `editorial:${product.id}:allegro:${tekst(product.allegroEditorialSyncRunId || product.allegroEditorialSyncPendingAt || report.lastRun, 64)}`;
    const reportWork = async (work = {}) => {
      if (!trackPublication) return;
      try { await agentRuntime.report({ event: 'work_progress', source: 'allegro-api', work: { id: workId, runId: product.allegroEditorialSyncRunId, productId: String(product.id), productName: tekst(product.nazwa || product.name, 180), channel: 'allegro', target: 'powiązana oferta Allegro', ...work } }); } catch { /* telemetria nie może zatrzymać synchronizacji */ }
    };
    try {
      await reportWork({ action: 'publikacja treści w kanale', phase: 'preparing_api_payload', status: 'running', message: 'Buduję dane oferty wyłącznie z potwierdzonej kartoteki sklepu.' });
      const fields = {};
      const productSourceUrl = sourcePageUrl(product), sourceImagesAge = Date.parse(String(product?.sourceEvidence?.imagesFetchedAt || ''));
      if (productSourceUrl && (!verifiedSourceImages(product).length || !Number.isFinite(sourceImagesAge) || sourceImagesAge < Date.now() - 30 * 86400000)) {
        const sourceInspection = await pobierzProduktProducentaZPamiecia(productSourceUrl).catch(() => null);
        const sourceImageResult = inspectedSourceImages(product, sourceInspection || {});
        if (sourceImageResult.ok) Object.assign(fields, sourceImageResult.patch);
      }
      const commercial = allegroProductCommercialIdentity(product);
      if (commercial.manufacturer && product.producent !== commercial.manufacturer) {
        fields.producent = commercial.manufacturer;
        report.producers++;
      }
      if (commercial.brand && product.marka !== commercial.brand) fields.marka = commercial.brand;
      let catalog = null;
      if (offerSettings.autoCatalog !== false && (!product.allegroProductId || !product.allegroCategoryId || (offerSettings.syncDescriptions !== false && !tekst(product.opis, 20000).trim()))) {
        const found = await allegroZnajdzProduktKatalogu(req, { ...product, ...fields });
        catalog = found?.selected || null;
        if (catalog?.id) {
          fields.allegroProductId = catalog.id;
          if (catalog.categoryId) fields.allegroCategoryId = catalog.categoryId;
          report.matched++;
          // Marka katalogu służy kanałowi Allegro i nie nadpisuje producenta ani pewniejszej marki źródłowej.
          const catalogBrand = canonicalManufacturerName(catalog.brand || allegroWartoscParametru(catalog, ['marka', 'brand']));
          if (catalogBrand && !commercial.brand) fields.marka = catalogBrand;
          if (offerSettings.syncDescriptions !== false && !tekst(product.opis, 20000).trim() && catalog.descriptionText) fields.sourceMaterial = { ...(product.sourceMaterial || {}), allegroCatalogDescription: tekst(catalog.descriptionText, 20000).trim(), fetchedAt: report.lastRun };
        }
      }
      if (offerSettings.autoCatalog !== false && !fields.allegroCategoryId && !product.allegroCategoryId) {
        const category = await allegroSugerujKategorie(req, { ...product, ...fields }, { limit: 5 });
        if (category?.selected?.id) { fields.allegroCategoryId = category.selected.id; report.categories++; }
      }
      const styledProduct = { ...product, ...fields };
      const offerTitle = allegroOfferTitle(styledProduct);
      if (offerTitle && offerTitle !== tekst(product.allegroTitle, 75).trim()) { fields.allegroTitle = offerTitle; report.titles++; }
      if (offerSettings.syncDescriptions !== false) {
        const shortDescription = allegroOpisKrotki(styledProduct, []), fullDescription = allegroOpisPelnyTekst(styledProduct, shortDescription), sections = allegroSekcjeOpisu(styledProduct, shortDescription);
        if (fullDescription) fields.allegroDescription = fullDescription;
        fields.allegroDescriptionSections = sections;
        report.descriptions++;
      }
      if (product.allegroShippingSubsidy === undefined) fields.allegroShippingSubsidy = 3;
      if (!catalog?.id && !product.allegroProductId) report.unresolved++;
      const finalProduct = { ...product, ...fields };
      if (Object.keys(fields).length && applyUpdate(product.id, { ...fields, allegroCatalogCheckedAt: report.lastRun, allegroCatalogSource: 'automatic-maintenance' })) report.updated++;
      if (offerSettings.autoUpdateOffers !== false || product.allegroEditorialSyncPending === true) {
        const prepared = await allegroDraftZAutoKategoria(req, finalProduct, { publicationAction: 'keep' });
        const offerId = tekst(prepared?.existingOffer?.offer?.id || finalProduct.allegroOfferId, 100).trim();
        if (offerId) {
          await reportWork({ action: 'publikacja treści w kanale', phase: 'sending_to_allegro', status: 'running', targetRef: offerId, message: `Wysyłam zmianę do istniejącej oferty ${offerId} i czekam na wynik operacji Allegro.` });
          const sync = await allegroSyncEditorialOffer({
            offerId, prepared, product: finalProduct, responsibleProducers,
            loadResponsibleProducers: () => allegroResponsibleProducerDirectory((path, callOptions) => allegroWywolaj(req, path, callOptions)),
            patchFromDraft: allegroPatchZDraftu,
            writePatch: (bodyObj) => allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', bodyObj, withMeta: true }),
            waitForOperation: (location) => allegroCzekajNaOperacjeOferty(req, location),
          });
          responsibleProducers = sync.responsibleProducers;
          if (sync.skipped === 'catalog_identity_conflict') {
            const message = 'Automatyczna aktualizacja zatrzymana: powiązana oferta ma inne ID produktu katalogowego Allegro.';
            applyUpdate(product.id, buildEditorialPublicationPatch({ product: finalProduct, channel: 'allegro', status: 'blocked', stateOverride: 'requires_mapping_review', timestamp: report.lastRun, targetRef: offerId, error: message }));
            await reportWork({ action: 'publikacja treści w kanale', phase: 'identity_conflict', status: 'attention', targetRef: offerId, error: message, message: 'Nic nie zmieniono w ofercie; wymagana jest kontrola mapowania produktu.' });
            report.unresolved++;
            continue;
          }
          if (sync.gpsrMatched) report.gpsrMatched++;
          applyUpdate(product.id, buildEditorialPublicationPatch({ product: finalProduct, channel: 'allegro', status: 'confirmed', timestamp: report.lastRun, targetRef: offerId, receiptId: offerId }));
          await reportWork({ action: 'publikacja treści w kanale', phase: 'confirmed_by_allegro', status: 'confirmed', targetRef: offerId, receiptId: offerId, completedAt: report.lastRun, message: `Allegro potwierdziło aktualizację oferty ${offerId}.` });
          if (mappings[offerId] && String(mappings[offerId].productId || '') === String(product.id)) {
            mappings[offerId] = markAllegroMappingSynced(mappings[offerId], finalProduct, report.lastRun);
            syncedMappingIds.add(offerId);
          }
          report.offersUpdated++;
          if (sync.categoryRepaired) report.categoriesRepaired++;
          if (offerSettings.autoFees !== false) {
            const actual = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`), price = Math.max(0, Number(finalProduct.cenaAllegro || finalProduct.cena) || 0);
            actual.sellingMode = actual.sellingMode || { format: 'BUY_NOW' };actual.sellingMode.price = { amount: price.toFixed(2), currency: 'PLN' };
            const preview = await allegroWywolaj(req, '/pricing/offer-fee-preview', { method: 'POST', bodyObj: { offer: actual, marketplaceId: 'allegro-pl' } }), fee = allegroPodsumujKalkulacjeOplat(preview, price);
            applyUpdate(product.id, { allegroCommissionAmount: fee.commissionAmount, allegroCommissionRate: fee.commissionRate, allegroRecurringFees: fee.recurringFees, allegroFeeTotal: fee.totalPreviewFees, allegroFeePrice: fee.salePrice, allegroFeeCurrency: fee.currency, allegroFeeDetails: { commissions: fee.commissions, quotes: fee.quotes }, allegroFeeCalculatedAt: fee.calculatedAt, allegroFeeSource: fee.source });
            report.feesUpdated++;
          }
        } else if (product.allegroEditorialSyncPending === true) {
          const message = 'Brak istniejącej powiązanej oferty. Nowa publikacja wymaga decyzji administratora.';
          applyUpdate(product.id, buildEditorialPublicationPatch({ product: finalProduct, channel: 'allegro', status: 'decision_required', timestamp: report.lastRun, error: message }));
          await reportWork({ action: 'publikacja nowej oferty', phase: 'administrator_decision', status: 'decision_required', error: message, message: 'Treść jest zapisana, ale Agent nie utworzył nowej oferty bez decyzji administratora.' });
          report.unresolved++;
        }
      }
    } catch (error) {
      const message = tekst(error?.message || error, 500), nextRetryAt = new Date(Date.parse(report.lastRun) + 15 * 60_000).toISOString();
      if (product.allegroEditorialSyncPending === true) applyUpdate(product.id, buildEditorialPublicationPatch({ product, channel: 'allegro', status: 'retry', timestamp: report.lastRun, error: message, nextRetryAt }));
      await reportWork({ action: 'publikacja treści w kanale', phase: 'retry_scheduled', status: 'failed', error: message, nextRetryAt, message: 'Allegro nie potwierdziło zmiany. Stan pozostaje nieopublikowany i trafi do ponownej próby.' });
      report.errors.push({ productId: String(product.id), name: tekst(product.nazwa || product.name, 180), error: tekst(error?.message || error, 500) });
    }
  }
  const pendingUpdates = productPatches.operations();
  const changed = pendingUpdates.length > 0;
  if (changed) await zapiszOperacjeProduktow(pendingUpdates, report.lastRun);
  if (syncedMappingIds.size) {
    const persistedSettings = changed ? await czytaj('settings', { data: {}, rev: 0, updated_at: null }) : { data };
    const persistedProducts = await allegroAgentProduktyKompletne(persistedSettings.data || data);
    for (const offerId of syncedMappingIds) {
      const product = persistedProducts.get(String(mappings[offerId]?.productId || ''));
      if (product) mappings[offerId] = markAllegroMappingSynced(mappings[offerId], product, report.lastRun);
    }
  }
  await zapiszMapowaniaBezpiecznie(baseMappings, mappings, report.lastRun);
  const audit = { ...report, cursor: products.length ? (start + selected.length) % products.length : 0, totalProducts: products.length, errors: report.errors.slice(0, 20) };
  await zapisz('allegro_catalog_maintenance', audit);
  return audit;
}
async function allegroDraftZAutoKategoria(req, product = {}, opt = {}) {
  const options = { ...(opt || {}) };
  const relatedProducts = options.relatedProducts instanceof Map || Array.isArray(options.relatedProducts)
    ? options.relatedProducts
    : await allegroAgentProduktyKompletne();
  product = enrichAllegroProductEvidence(product, relatedProducts).product;
  const categoryConsensus = allegroCategoryConsensus(product, relatedProducts);
  const categoryConsensusApplicable = categoryConsensus.selected
    && ((!options.categoryId && !product.allegroCategoryId) || categoryConsensus.replaceCurrent);
  if (categoryConsensusApplicable) {
    options.categoryId = categoryConsensus.selected.id;
  }
  const [offersRec, mappingsRec, offerSettings] = await Promise.all([
    czytaj('allegro_offers', { items: [] }),
    czytaj('allegro_mappings', { items: {} }),
    allegroPobierzUstawieniaOfert(),
  ]);
  options.offerStock = offerSettings.defaultStock;
  const similarOffers = allegroPodobneOferty(product, offersRec, 5);
  const existingOffer = allegroDopasowanieOferty(product, offersRec, mappingsRec);
  if (!options.categoryId && !product.allegroCategoryId && existingOffer?.offer?.categoryId) options.categoryId = existingOffer.offer.categoryId;
  options.shortDescription = allegroOpisKrotki(product, similarOffers);
  options.descriptionSections = allegroSekcjeOpisu(product, options.shortDescription);
  let categorySuggestion = null;
  if (!allegroMaKategorie(product, options)) {
    categorySuggestion = await allegroSugerujKategorie(req, product, { limit: 8 });
    if (categorySuggestion?.selected?.id) options.categoryId = categorySuggestion.selected.id;
  }
  const categoryId = tekst(options.categoryId || product.allegroCategoryId || product.categoryId || '', 80).trim();
  const [salesConditions, catalogLookup] = await Promise.all([
    allegroWarunkiSprzedazy(req, {
      shippingRateId: product.allegroShippingRateId || offerSettings.shippingRateId,
      returnPolicyId: product.allegroReturnPolicyId || offerSettings.returnPolicyId,
      impliedWarrantyId: product.allegroImpliedWarrantyId || offerSettings.impliedWarrantyId,
      warrantyId: product.allegroWarrantyId || offerSettings.warrantyId,
    }),
    allegroZnajdzProduktKatalogu(req, product),
  ]);
  const catalogMatch = options.catalogMatchOverride?.selected ? options.catalogMatchOverride : catalogLookup;
  // Edycja treści istniejącej oferty nie może podmieniać jej tożsamości
  // katalogowej. Zachowanie aktualnego produktu i kategorii zapobiega
  // konfliktom kategorii, a przekazanie jego ID pozwala Allegro uzupełnić GPSR.
  const existingCatalogProductId = tekst(existingOffer?.offer?.productId || existingOffer?.offer?.productSet?.[0]?.product?.id || '', 120).trim();
  const matchedCatalogProductId = tekst(catalogMatch?.selected?.id, 120).trim();
  const existingIdentityVerified = !!(existingOffer && /(?:zweryfikowane|ręczne mapowanie administratora|external\.id|EAN\/GTIN|kod producenta i nazwa)/i.test(String(existingOffer.reason || '')));
  const catalogIdentityVerified = catalogMatch?.selected?.identity?.verified === true;
  const exactExistingCatalogMatch = existingCatalogProductId && matchedCatalogProductId === existingCatalogProductId;
  let effectiveCategoryId = tekst((exactExistingCatalogMatch ? catalogMatch?.selected?.categoryId : '') || (existingCatalogProductId ? existingOffer?.offer?.categoryId : '') || catalogMatch?.selected?.categoryId || categoryId, 80).trim();
  if (effectiveCategoryId) options.categoryId = effectiveCategoryId;
  let categoryParameters = await allegroParametryKategorii(req, effectiveCategoryId);
  const categoryCorrection = !existingCatalogProductId ? await allegroCorrectCategorySelection({ product, categoryId: effectiveCategoryId, parameters: categoryParameters.parameters, suggest: () => allegroSugerujKategorie(req, product, { limit: 8 }), loadParameters: (id) => allegroParametryKategorii(req, id) }) : { changed: false };
  if (categoryCorrection.changed) { categorySuggestion = categoryCorrection.suggestion; effectiveCategoryId = categoryCorrection.categoryId; options.categoryId = effectiveCategoryId; categoryParameters = categoryCorrection.parameters; }
  const categoryResolution = allegroCategoryResolution({
    product, categoryId: effectiveCategoryId, categorySuggestion, consensus: categoryConsensus, catalogLookup, existingCatalogProductId,
  });
  options.salesConditions = salesConditions;
  options.categoryParameters = categoryParameters.parameters;
  if (existingCatalogProductId && existingIdentityVerified) {
    options.catalogProductId = existingCatalogProductId;
    options.catalogIdentityVerified = true;
  } else if (catalogIdentityVerified && catalogMatch?.selected?.id) {
    options.catalogProductId = catalogMatch.selected.id;
    options.catalogIdentityVerified = true;
  }
  const catalog = catalogMatch?.selected || {};
  const safeOffer = existingOffer?.offer || {};
  const commercial = allegroProductCommercialIdentity(product);
  const catalogBrand = canonicalManufacturerName(allegroWartoscParametru(catalog, ['marka', 'brand']) || catalog.brand || safeOffer.brand);
  const catalogManufacturer = canonicalManufacturerName(allegroWartoscParametru(catalog, ['producent', 'manufacturer', 'wydawca']));
  const preparedManufacturer = commercial.manufacturer || catalogManufacturer;
  const preparedBrand = commercial.brand || catalogBrand || preparedManufacturer;
  const catalogCode = allegroWartoscParametru(catalog, ['kod producenta', 'mpn', 'symbol producenta']) || tekst(safeOffer.manufacturerCode || safeOffer.producerCode || '', 160).trim();
  const catalogGtin = tekst((catalog.eans || [])[0] || safeOffer.ean || safeOffer.gtin || '', 80).trim();
  const productSourceUrl = sourcePageUrl(product);
  let sourceImages = verifiedSourceImages(product), sourceImagePatch = sourceImages.length ? { zdjecie: sourceImages[0], zdjecia: sourceImages.slice(1), sourceEvidence: product.sourceEvidence } : {};
  if (productSourceUrl && !sourceImages.length) {
    const inspection = await pobierzProduktProducentaZPamiecia(productSourceUrl).catch(() => null);
    const sourceResult = inspectedSourceImages(product, inspection || {});
    if (sourceResult.ok) { sourceImages = sourceResult.images; sourceImagePatch = sourceResult.patch; }
  }
  const productWithSafeImages = productSourceUrl ? { ...product, zdjecie: '', zdjecia: [], ...sourceImagePatch } : product;
  const preparedProduct = {
    ...productWithSafeImages,
    ...(!preparedManufacturer ? {} : { producent: preparedManufacturer }),
    ...(!preparedBrand ? {} : { marka: preparedBrand }),
    ...(product.gtin || product.ean || !catalogGtin ? {} : { gtin: catalogGtin, ean: catalogGtin }),
    ...(product.kodProducenta || product.mpn || !catalogCode ? {} : { kodProducenta: catalogCode, mpn: catalogCode }),
  };
  options.descriptionSections = allegroSekcjeOpisu(preparedProduct, options.shortDescription);
  const requiredParameters = options.catalogProductId ? [] : allegroBrakujaceParametryWymagane(preparedProduct, categoryParameters.parameters);
  options.requiredParameters = requiredParameters;
  const draft = allegroDraftZProduktu(preparedProduct, options);
  const imageReadiness = await checkAllegroImageReadiness([
    preparedProduct.zdjecie,
    ...(Array.isArray(preparedProduct.zdjecia) ? preparedProduct.zdjecia : []),
  ], { limit: 16 });
  const remoteImageValidation = sourceImages.length > 0 && imageReadiness.remote.length > 0;
  if (!imageReadiness.ready && !imageReadiness.adaptable.length && !remoteImageValidation) {
    if (options.catalogProductId || existingOffer) {
      // Dla istniejącego produktu katalogowego Allegro posiada zweryfikowane
      // zdjęcia. Nie wysyłamy małych miniatur producenta i nie nadpisujemy
      // nimi istniejącej oferty.
      draft.payload.images = [];
    } else {
      draft.missing = [...new Set([...draft.missing, `zdjęcie Allegro min. ${imageReadiness.minLongEdge}px`])];
    }
  }
  let responsibleProducers = [];
  if (!Array.isArray(catalog?.productSafety?.responsibleProducers) || !catalog.productSafety.responsibleProducers.length) {
    responsibleProducers = await allegroResponsibleProducerDirectory((path, callOptions) => allegroWywolaj(req, path, callOptions)).catch(() => []);
  }
  const gpsr = allegroApplyProductSetSafety({
    draft: draft.payload,
    product: preparedProduct,
    catalog,
    responsibleProducers,
  });
  draft.payload = gpsr.draft;
  if (!existingOffer && preparedProduct.marketedBeforeGPSRObligation !== true) {
    draft.missing = allegroMergeGpsrMissing(draft.missing, gpsr.missing);
  }
  draft.missing = applyRequiredAllegroSalesConditions(draft.missing, draft.payload, { existingOffer: !!existingOffer });
  const autoParameters = allegroParametryAutomatyczne(preparedProduct, categoryParameters.parameters);
  const parameterResolution = allegroCategoryParameterResolutionReport(preparedProduct, categoryParameters.parameters);
  return {
    ...draft,
    categorySuggestion,
    categoryConsensus,
    categoryResolution,
    salesConditions,
    categoryParameters: categoryParameters.parameters,
    requiredParameters,
    catalogMatch,
    supportErrors: [...(salesConditions.errors || []), ...(categoryParameters.errors || [])],
    existingOffer,
    similarOffers: similarOffers.map((x) => ({ id: x.offer?.id, name: x.offer?.name, score: Number(x.score.toFixed(2)) })),
    improvedDescriptions: {
      shortDescription: options.shortDescription,
      fullDescription: tekst(preparedProduct.opis, 20000),
      storeShortDescription: tekst(preparedProduct.opisKrotki, 500),
      storeFullDescription: tekst(preparedProduct.opis, 20000),
      allegroDescription: allegroOpisPelnyTekst(preparedProduct, options.shortDescription) || options.shortDescription,
      sections: options.descriptionSections,
    },
    autoFilled: {
      allegroTitle: allegroOfferTitle(preparedProduct),
      producent: preparedProduct.producent || preparedProduct.marka || '',
      marka: preparedProduct.marka || preparedProduct.producent || '',
      gtin: preparedProduct.gtin || preparedProduct.ean || '',
      ean: preparedProduct.ean || preparedProduct.gtin || '',
      kodProducenta: preparedProduct.kodProducenta || preparedProduct.mpn || '',
      mpn: preparedProduct.mpn || preparedProduct.kodProducenta || '',
      zdjecie: preparedProduct.zdjecie || '',
      zdjecia: Array.isArray(preparedProduct.zdjecia) ? preparedProduct.zdjecia.slice(0, 15) : [],
      sourceEvidence: preparedProduct.sourceEvidence || null,
      allegroParameters: autoParameters,
      allegroParameterResolution: parameterResolution,
      allegroProductId: options.catalogProductId || '',
      allegroCategoryId: effectiveCategoryId || '',
      allegroCategoryName: categoryResolution.categoryName,
      allegroCategoryResolution: categoryResolution,
      allegroSafetyInformation: gpsr.safetyInformation,
      allegroResponsibleProducer: gpsr.responsibleProducer,
      allegroParameterEvidence: preparedProduct.allegroParameterEvidence || {},
    },
    publicationReadiness: {
      catalogIdentityVerified: options.catalogIdentityVerified === true,
      categoryResolved: !!effectiveCategoryId,
      requiredParametersResolved: requiredParameters.length === 0,
      gpsrReady: gpsr.ready || !!existingOffer || preparedProduct.marketedBeforeGPSRObligation === true,
      gpsrSource: gpsr.source,
      imagesReady: imageReadiness.ready || imageReadiness.adaptable.length > 0 || remoteImageValidation || !!options.catalogProductId || !!existingOffer,
      imageSource: imageReadiness.ready
        ? 'zweryfikowane zdjęcie źródłowe'
        : imageReadiness.adaptable.length
          ? 'zdjęcie źródłowe do automatycznego dopasowania'
          : remoteImageValidation
            ? 'oficjalne zdjęcie źródłowe — końcowa walidacja przez Allegro'
            : ((options.catalogProductId || existingOffer) ? 'zdjęcia produktu katalogowego Allegro' : ''),
      imageAdaptationRequired: imageReadiness.adaptable.length > 0,
      imageRemoteValidationRequired: remoteImageValidation,
      imageInspection: imageReadiness.inspected.map((item) => ({ url: item.url, ok: item.ok, width: item.width || 0, height: item.height || 0, error: item.error || '' })),
      checks: ['tożsamość GTIN', 'kategoria katalogowa', 'parametry wymagane', 'GPSR', 'wymiary zdjęć', 'warunki sprzedaży', 'zgodność opisu'],
    },
    agentDecision: {
      action: existingOffer ? 'update_existing' : (draft.missing.length ? 'complete_data' : 'create_inactive'),
      existingOfferId: tekst(existingOffer?.offer?.id || '', 100),
      duplicatePrevented: !!existingOffer,
      reason: tekst(existingOffer?.reason || (catalogMatch?.selected?.id ? `katalog ${catalogMatch.searchedBy}` : 'brak pewnego dopasowania'), 300),
    },
  };
}

function allegroDraftZProduktu(product = {}, opt = {}) {
  const p = product || {};
  const offerTitle = allegroOfferTitle(p);
  const categoryId = tekst(opt.categoryId || p.allegroCategoryId || p.categoryId || '', 80).trim();
  const images = [p.zdjecie, ...(Array.isArray(p.zdjecia) ? p.zdjecia : [])].filter(Boolean).slice(0, 16);
  const externalId = tekst(p.externalId || p.sku || p.kodProducenta || p.mpn || p.id || '', 120).trim();
  const rawGtin = tekst(p.gtin || p.ean, 80).trim();
  const gtin = canonicalGtin(rawGtin) ? rawGtin.replace(/\D/g, '') : '';
  const persistedCatalogConfirmed = p.allegroCatalogIdentityConfirmed === true ? tekst(p.allegroProductId, 120).trim() : '';
  const allegroProductId = tekst(opt.catalogIdentityVerified === true ? opt.catalogProductId : persistedCatalogConfirmed, 120).trim();
  const parameters = [];
  if (gtin) parameters.push({ name: 'EAN', values: [gtin] });
  if (p.kodProducenta || p.mpn) parameters.push({ name: 'Kod producenta', values: [tekst(p.kodProducenta || p.mpn, 120)] });
  if (p.marka) parameters.push({ name: 'Marka', values: [tekst(p.marka, 120)] });
  const autoParameters = allegroParametryAutomatyczne(p, opt.categoryParameters);
  const categoryParameterTypes = new Map((Array.isArray(opt.categoryParameters) ? opt.categoryParameters : []).map((param) => [
    String(param?.id || ''),
    param?.options?.describesProduct,
  ]));
  const customParameters = (Array.isArray(p.allegroParameters) ? p.allegroParameters : [])
    .filter((param) => !categoryParameterTypes.size || categoryParameterTypes.has(String(param?.id || '')));
  const mergedParameters = allegroScalParametryBezDuplikatow(autoParameters, customParameters);
  const offerParameters = mergedParameters.filter((param) => categoryParameterTypes.get(String(param?.id || '')) === false);
  const productParameters = mergedParameters.filter((param) => categoryParameterTypes.get(String(param?.id || '')) !== false);
  const productObj = allegroProductId
    ? { id: allegroProductId }
    : (!categoryId && gtin)
      ? { id: gtin, idType: 'GTIN' }
      : {
          name: offerTitle,
          category: categoryId ? { id: categoryId } : undefined,
          parameters: [...parameters.filter((x) => x.id), ...productParameters],
          images,
        };
  const stockRaw = Number(opt.offerStock ?? ALLEGRO_DEFAULT_OFFER_STOCK);
  const payload = {
    name: offerTitle,
    category: categoryId ? { id: categoryId } : undefined,
    productSet: [{
      product: productObj,
    }],
    parameters: offerParameters,
    sellingMode: {
      format: 'BUY_NOW',
      price: { amount: String(Number(p.cenaAllegro || p.allegroPrice || p.cena || p.price || 0).toFixed(2)), currency: 'PLN' },
    },
    stock: { available: Number.isFinite(stockRaw) ? Math.max(0, Math.floor(stockRaw)) : 0 },
    publication: { status: opt.publishNow ? 'ACTIVE' : 'INACTIVE', republish: true },
    external: externalId ? { id: externalId } : undefined,
    images: images.map((url) => tekst(url, 1000)),
    description: { sections: Array.isArray(opt.descriptionSections) && opt.descriptionSections.length ? opt.descriptionSections : allegroSekcjeOpisu(p, opt.shortDescription || allegroOpisKrotki(p, [])) },
  };
  const sc = opt.salesConditions || {};
  const defaults = sc.defaults || {};
  if (defaults.shippingRateId) payload.delivery = { shippingRates: { id: defaults.shippingRateId } };
  const afterSalesServices = {};
  if (defaults.returnPolicyId) afterSalesServices.returnPolicy = { id: defaults.returnPolicyId };
  if (defaults.impliedWarrantyId) afterSalesServices.impliedWarranty = { id: defaults.impliedWarrantyId };
  if (defaults.warrantyId) afterSalesServices.warranty = { id: defaults.warrantyId };
  if (Object.keys(afterSalesServices).length) payload.afterSalesServices = afterSalesServices;
  const missing = [];
  if (!payload.name) missing.push('nazwa');
  if (rawGtin && !gtin) missing.push('poprawny EAN/GTIN (błędna długość lub cyfra kontrolna)');
  if (!categoryId && !allegroProductId && !gtin) missing.push('ID kategorii Allegro');
  if (!Number(p.cenaAllegro || p.allegroPrice || p.cena || p.price || 0)) missing.push('cena');
  if (!images.length) missing.push('zdjęcia');
  if (!(p.producent || p.marka)) missing.push('producent');
  for (const param of Array.isArray(opt.requiredParameters) ? opt.requiredParameters : []) missing.push(`parametr Allegro: ${param.name}`);
  const enforced = allegroEnforceDraft(JSON.parse(JSON.stringify(payload)));
  if (!enforced.compliance.ok) missing.push('opis niezgodny z zasadami Allegro');
  return { payload: enforced.draft, missing: [...new Set(missing)], compliance: enforced.compliance };
}

async function allegroZweryfikujTozsamoscPublikacji(req, product = {}, draft = {}, prepared = {}, opt = {}) {
  const rawGtin = tekst(product.gtin || product.ean || '', 80).trim();
  const productGtin = canonicalGtin(rawGtin);
  if (rawGtin && !productGtin) return { ok: false, code: 'invalid_gtin', reason: 'EAN/GTIN ma niepoprawną długość lub cyfrę kontrolną.' };
  const draftProduct = draft?.productSet?.[0]?.product || {};
  const draftId = tekst(draftProduct.id || '', 120).trim();
  const draftIdType = tekst(draftProduct.idType || '', 20).trim().toUpperCase();
  if (draftIdType === 'GTIN') {
    const draftGtin = canonicalGtin(draftId);
    if (!draftGtin || (productGtin && draftGtin !== productGtin)) return { ok: false, code: 'gtin_identity_mismatch', reason: 'GTIN w szkicu nie jest zgodny z kartoteką sklepu.' };
    return { ok: true, mode: 'exact_gtin', gtin: draftGtin };
  }
  if (draftIdType) return { ok: false, code: 'unsafe_catalog_identifier', reason: `Automatyczne powiązanie przez ${draftIdType} jest zablokowane. Użyj zgodnego GTIN albo ręcznie wskaż ofertę.` };
  if (!draftId) return { ok: true, mode: productGtin ? 'new_product_with_gtin' : 'new_product_without_gtin', gtin: productGtin, warning: productGtin ? '' : 'Nowa kartoteka bez EAN — bez automatycznego powiązania z Katalogiem Allegro.' };

  const catalogSelected = prepared?.catalogMatch?.selected || {};
  if (String(catalogSelected.id || '') === draftId && catalogSelected?.identity?.verified === true) {
    return { ok: true, mode: 'verified_catalog_gtin', catalogProductId: draftId, gtin: productGtin };
  }
  if (product.allegroCatalogIdentityConfirmed === true && String(product.allegroProductId || '') === draftId) {
    return { ok: true, mode: 'admin_confirmed_catalog', catalogProductId: draftId };
  }
  const existing = prepared?.existingOffer;
  const existingCatalogId = tekst(existing?.offer?.productId || existing?.offer?.productSet?.[0]?.product?.id || '', 120).trim();
  const safeExisting = !!(existing?.offer?.id && /(?:zweryfikowane|ręczn|external\.id|EAN\/GTIN|kod producenta i nazwa)/i.test(String(existing.reason || '')));
  if (existingCatalogId === draftId && (safeExisting || opt.manualOffer === true)) {
    return { ok: true, mode: opt.manualOffer === true ? 'admin_selected_offer' : 'verified_existing_offer', catalogProductId: draftId };
  }
  if (productGtin) {
    const catalogMatch = prepared?.catalogMatch?.selected ? prepared.catalogMatch : await allegroZnajdzProduktKatalogu(req, product);
    if (String(catalogMatch?.selected?.id || '') === draftId && catalogMatch?.selected?.identity?.verified === true) {
      return { ok: true, mode: 'verified_catalog_gtin', catalogProductId: draftId, gtin: productGtin };
    }
  }
  return {
    ok: false,
    code: 'allegro_identity_unverified',
    reason: 'Zablokowano powiązanie z produktem Katalogu Allegro: UUID nie został potwierdzony zgodnym GTIN oraz zgodnymi cechami produktu. Automat nie może zgadywać po nazwie.',
    catalogProductId: draftId,
  };
}

function allegroPodsumujKalkulacjeOplat(raw = {}, price = 0) {
  const normalize = (item = {}, group = '') => ({ name: tekst(item.name || item.type || 'Opłata', 200), type: tekst(item.type || '', 120), group, amount: Math.max(0, Number(item.fee?.amount) || 0), currency: tekst(item.fee?.currency || 'PLN', 12), cycleDuration: tekst(item.cycleDuration || '', 80) });
  const commissions = (Array.isArray(raw.commissions) ? raw.commissions : []).map((x) => normalize(x, 'commission'));
  const quotes = (Array.isArray(raw.quotes) ? raw.quotes : []).map((x) => normalize(x, 'quote'));
  const commissionAmount = Number(commissions.reduce((sum, x) => sum + x.amount, 0).toFixed(2));
  const recurringFees = Number(quotes.reduce((sum, x) => sum + x.amount, 0).toFixed(2));
  const salePrice = Math.max(0, Number(price) || 0);
  return {
    commissionAmount,
    commissionRate: salePrice > 0 ? Number((commissionAmount / salePrice * 100).toFixed(4)) : 0,
    recurringFees,
    totalPreviewFees: Number((commissionAmount + recurringFees).toFixed(2)),
    salePrice,
    currency: commissions[0]?.currency || quotes[0]?.currency || 'PLN',
    commissions,
    quotes,
    calculatedAt: new Date().toISOString(),
    source: 'allegro-offer-fee-preview',
  };
}

function allegroDanePowiazaniaZPrzygotowania(product = {}, prepared = {}, draft = {}) {
  const katalog = prepared?.catalogMatch?.selected || {};
  const draftProduct = draft?.productSet?.[0]?.product || {};
  const verifiedCatalogId = katalog?.identity?.verified === true ? tekst(katalog.id, 120).trim() : '';
  const existingCatalogId = tekst(prepared?.existingOffer?.offer?.productId || prepared?.existingOffer?.offer?.productSet?.[0]?.product?.id || '', 120).trim();
  const safeExisting = !!(existingCatalogId && /(?:zweryfikowane|ręczn|external\.id|EAN\/GTIN|kod producenta i nazwa)/i.test(String(prepared?.existingOffer?.reason || '')));
  const confirmedProductId = product.allegroCatalogIdentityConfirmed === true ? tekst(product.allegroProductId, 120).trim() : '';
  const draftCatalogId = draftProduct.idType ? '' : tekst(draftProduct.id, 120).trim();
  const catalogProductId = tekst(verifiedCatalogId || (safeExisting && draftCatalogId === existingCatalogId ? draftCatalogId : '') || confirmedProductId, 120).trim();
  const categoryId = tekst(katalog.categoryId || prepared?.autoFilled?.allegroCategoryId || prepared?.categorySuggestion?.selected?.id || product.allegroCategoryId || draftProduct.category?.id || '', 80).trim();
  const producent = tekst(allegroProductCommercialIdentity(product).manufacturer || allegroWartoscParametru(katalog, ['producent', 'manufacturer']) || '', 160).trim();
  return { catalogProductId, categoryId, producent };
}
async function allegroZapiszPowiazanieProduktu(product = {}, details = {}) {
  const productId = tekst(product.id, 100).trim(), offerId = tekst(details.offerId, 100).trim();
  if (!productId || !offerId) return null;
  const link = allegroDanePowiazaniaZPrzygotowania(product, details.prepared || {}, details.draft || {});
  const auto = details.prepared?.autoFilled || {};
  const autoPatch = {};
  for (const key of ['producent', 'marka', 'gtin', 'ean', 'kodProducenta', 'mpn', 'zdjecie']) {
    const value = auto[key];
    if (value && !product[key]) autoPatch[key] = value;
  }
  if (auto.sourceEvidence?.imageSourceType === 'product_source_page' && auto.zdjecie) {
    autoPatch.zdjecie = auto.zdjecie;
    autoPatch.zdjecia = Array.isArray(auto.zdjecia) ? auto.zdjecia.slice(0, 15) : [];
    autoPatch.sourceEvidence = auto.sourceEvidence;
  } else if (Array.isArray(auto.zdjecia) && auto.zdjecia.length && !(product.zdjecia || []).length) autoPatch.zdjecia = auto.zdjecia.slice(0, 15);
  if (Array.isArray(auto.allegroParameters) && auto.allegroParameters.length && !Array.isArray(product.allegroParameters)) autoPatch.allegroParameters = auto.allegroParameters;
  if (auto.allegroSafetyInformation?.type) autoPatch.allegroSafetyInformation = auto.allegroSafetyInformation;
  if (auto.allegroResponsibleProducer?.id) autoPatch.allegroResponsibleProducer = auto.allegroResponsibleProducer;
  const improved = details.prepared?.improvedDescriptions || {};
  if (details.prepared?.autoFilled?.allegroTitle) autoPatch.allegroTitle = tekst(details.prepared.autoFilled.allegroTitle, 75);
  if (improved.shortDescription) autoPatch.opisKrotki = tekst(improved.shortDescription, 500);
  if (improved.fullDescription) autoPatch.opis = tekst(improved.fullDescription, 20000);
  if (improved.allegroDescription) autoPatch.allegroDescription = tekst(improved.allegroDescription, 20000);
  if (Array.isArray(improved.sections) && improved.sections.length) autoPatch.allegroDescriptionSections = improved.sections;
  if (product.allegroShippingSubsidy === undefined) autoPatch.allegroShippingSubsidy = 3;
  const now = new Date().toISOString(), fields = buildAllegroPublicationSuccessFields({ text: tekst, product, details: { ...details, offerId }, link, autoPatch, now });
  await zapiszIOpublikujPolaProduktuCentralnie({ productId, fields, mutationId: `allegro-publication-success:${productId}:${offerId}:${Date.now()}`, actor: 'allegro-api', area: 'allegro-publication' });
  if (details.resolveTasks !== false) await mutateSettingsSafely((data) => {
    const tasks = Array.isArray(data.artway_agent_ai_allegro_zadania) ? [...data.artway_agent_ai_allegro_zadania] : [];
    let changed = false;
    for (let i = 0; i < tasks.length; i++) if (String(tasks[i]?.productId) === productId && !['wykonane', 'anulowane'].includes(String(tasks[i]?.status || '').toLowerCase())) {
      const remaining = Array.isArray(details.prepared?.missing) ? details.prepared.missing : [];
      tasks[i] = remaining.length
        ? { ...tasks[i], status: 'oczekuje', offerId, missing: remaining, errors: [], updatedAt: now }
        : { ...tasks[i], status: 'wykonane', offerId, missing: [], errors: [], resolvedAt: now, updatedAt: now };
      changed = true;
    }
    if (!changed) return false;
    data.artway_agent_ai_allegro_zadania = tasks.slice(0, 500);
    return true;
  }, { updatedAt: now });
  return fields;
}

const ALLEGRO_AUTO_REPLY_DEFAULT = `Dzień dobry,

dziękujemy za wiadomość. Potwierdzamy, że zgłoszenie trafiło do obsługi Artway-TM. Odpowiemy możliwie jak najszybciej.

Pozdrawiamy
Artway-TM`;
function allegroUstawieniaKomunikacji(raw = {}) {
  return {
    enabled: raw.enabled !== false,
    messageCenter: raw.messageCenter !== false,
    issues: raw.issues !== false,
    freshHours: Math.max(1, Math.min(168, Number(raw.freshHours || 48))),
    template: tekst(raw.template || ALLEGRO_AUTO_REPLY_DEFAULT, 2000).trim() || ALLEGRO_AUTO_REPLY_DEFAULT,
  };
}
function allegroTypAutoraWiadomosci(m = {}) {
  return classifyAllegroMessageAuthor(m);
}
function allegroCzyWiadomoscKlienta(m = {}) { return allegroTypAutoraWiadomosci(m) === 'buyer'; }
function allegroCzyWiadomoscSprzedawcy(m = {}) { return allegroTypAutoraWiadomosci(m) === 'seller'; }
function allegroNormalizujWiadomosc(m = {}, fallbackThreadId = '') {
  const authorType = allegroTypAutoraWiadomosci(m);
  return {
    id: tekst(m.id, 120),
    threadId: tekst(m.thread?.id || fallbackThreadId, 120),
    text: tekst(allegroMessagePlainText(m.text || m.body || ''), 3000),
    subject: tekst(m.subject || '', 300),
    createdAt: tekst(m.createdAt || m.created_at || '', 80),
    authorLogin: tekst(m.author?.login || m.author?.id || '', 200),
    role: tekst(m.author?.role || m.author?.type || '', 40).toUpperCase(),
    isInterlocutor: typeof m.author?.isInterlocutor === 'boolean' ? m.author.isInterlocutor : undefined,
    authorType,
    incoming: authorType === 'buyer',
    seller: authorType === 'seller',
    system: authorType === 'allegro',
    source: authorType === 'buyer' ? 'customer' : authorType === 'seller' ? 'artway' : 'allegro',
    status: tekst(m.status || '', 80),
    offerId: tekst(m.relatesTo?.offer?.id || '', 100),
    orderId: tekst(m.relatesTo?.order?.id || '', 120),
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
  };
}
function allegroNormalizujWatek(t = {}, messages = []) {
  const msgs = (Array.isArray(messages) ? messages : []).map((m) => allegroNormalizujWiadomosc(m, t.id));
  const last = msgs.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
  return {
    id: tekst(t.id, 120),
    read: !!t.read,
    lastMessageDateTime: tekst(t.lastMessageDateTime || t.updatedAt || last?.createdAt || '', 80),
    buyerLogin: tekst(t.interlocutor?.login || last?.authorLogin || '', 200),
    subject: tekst(t.subject || last?.subject || '', 300),
    messages: msgs,
    lastMessage: last,
    incomingCount: msgs.filter(allegroCzyWiadomoscKlienta).length,
    sellerCount: msgs.filter(allegroCzyWiadomoscSprzedawcy).length,
    systemCount: msgs.filter((m) => allegroTypAutoraWiadomosci(m) === 'allegro').length,
  };
}
function allegroNormalizujIssueChatMessage(m = {}, fallbackIssueId = '') {
  const role = String(m.author?.role || '').toUpperCase();
  const authorType = allegroTypAutoraWiadomosci({ ...m, role });
  return {
    id: tekst(m.id, 120),
    issueId: tekst(fallbackIssueId, 120),
    text: tekst(allegroMessagePlainText(m.text || ''), 3000),
    createdAt: tekst(m.createdAt || '', 80),
    authorLogin: tekst(m.author?.login || '', 200),
    role,
    authorType,
    incoming: authorType === 'buyer',
    seller: authorType === 'seller',
    system: authorType === 'allegro',
    source: authorType === 'buyer' ? 'customer' : authorType === 'seller' ? 'artway' : 'allegro',
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
  };
}
function allegroNormalizujIssue(i = {}, chat = []) {
  const msgs = (Array.isArray(chat) ? chat : []).map((m) => allegroNormalizujIssueChatMessage(m, i.id));
  const last = msgs.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
  return {
    id: tekst(i.id, 120),
    type: tekst(i.type || '', 60),
    status: tekst(i.currentState?.status || i.status || '', 120),
    openedDate: tekst(i.openedDate || '', 80),
    dueDate: tekst(i.currentState?.dueDate || i.currentState?.statusDueDate || i.decisionDueDate || '', 80),
    subject: tekst(i.subject || i.reason?.type || '', 240),
    buyerLogin: tekst(i.buyer?.login || i.chat?.initialMessage?.author?.login || '', 200),
    orderId: tekst(i.checkoutForm?.id || '', 120),
    offerId: tekst(i.offer?.id || '', 120),
    chatActive: i.currentState?.chatActive !== false,
    messagesCount: Number(i.chat?.messagesCount || msgs.length) || msgs.length,
    initialMessage: i.chat?.initialMessage || null,
    messages: msgs,
    lastMessage: last || allegroNormalizujIssueChatMessage(i.chat?.initialMessage || {}, i.id),
    incomingCount: msgs.filter(allegroCzyWiadomoscKlienta).length,
    sellerCount: msgs.filter(allegroCzyWiadomoscSprzedawcy).length,
    systemCount: msgs.filter((m) => allegroTypAutoraWiadomosci(m) === 'allegro').length,
  };
}
function allegroJestSwieze(dateText = '', hours = 48) {
  const t = new Date(dateText).getTime();
  if (!Number.isFinite(t) || !t) return false;
  return Date.now() - t <= Math.max(1, Number(hours) || 48) * 3600 * 1000;
}
function allegroPierwszaWiadomoscKlienta(messages = []) {
  const sorted = (Array.isArray(messages) ? messages : []).slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  return sorted.find(allegroCzyWiadomoscKlienta) || null;
}
function allegroKluczWiadomosci(m = {}) {
  m = m || {};
  return tekst(m.id || `${m.createdAt || ''}:${m.authorLogin || ''}:${m.text || ''}`, 500).trim();
}
function allegroAutoReplyWyslanaDlaRozmowy(items = {}, type = 'thread', id = '') {
  const safeType = type === 'issue' ? 'issue' : 'thread', safeId = String(id || '');
  return Object.values(items && typeof items === 'object' ? items : {}).some((entry) => entry?.type === safeType && String(entry?.id || '') === safeId);
}
function allegroNoweWiadomosciKlienta(messages = [], previousMessages = [], hasBaseline = true) {
  if (!hasBaseline) return [];
  const previousKeys = new Set((Array.isArray(previousMessages) ? previousMessages : []).map(allegroKluczWiadomosci).filter(Boolean));
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => allegroCzyWiadomoscKlienta(m) && allegroKluczWiadomosci(m) && !previousKeys.has(allegroKluczWiadomosci(m)))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}
function allegroScalPelnaHistorie(item = {}, previous = {}) {
  const messages = mergeAllegroReplyHistory(previous.messages || [], item.messages || [], previous.lastMessage ? [previous.lastMessage] : [], item.lastMessage ? [item.lastMessage] : []);
  const lastMessage = messages.at(-1) || item.lastMessage || previous.lastMessage || null;
  return {
    ...previous,
    ...item,
    messages,
    lastMessage,
    incomingCount: messages.filter(allegroCzyWiadomoscKlienta).length,
    sellerCount: messages.filter(allegroCzyWiadomoscSprzedawcy).length,
    systemCount: messages.filter((m) => allegroTypAutoraWiadomosci(m) === 'allegro').length,
    fullHistoryCount: messages.length,
  };
}
function allegroOznaczNowaKomunikacje(data = {}, previous = {}) {
  const hasBaseline = !!previous?.updated_at;
  const previousThreads = new Map((Array.isArray(previous?.threads) ? previous.threads : []).map((t) => [String(t.id), t]));
  const previousIssues = new Map((Array.isArray(previous?.issues) ? previous.issues : []).map((i) => [String(i.id), i]));
  let threads = (Array.isArray(data?.threads) ? data.threads : []).map((thread) => {
    const previousThread = previousThreads.get(String(thread.id)) || {};
    thread = allegroScalPelnaHistorie(thread, previousThread);
    const nowe = allegroNoweWiadomosciKlienta(thread.messages, previousThread.messages, hasBaseline);
    const latestNewIncoming = nowe[0] || null;
    const humanReplyNeeded = !!latestNewIncoming || (!!previousThread.humanReplyNeeded && !previousThread.manualReplyAt);
    return { ...thread, newIncomingCount: nowe.length, newIncomingKeys: nowe.map(allegroKluczWiadomosci), latestNewIncoming, latestNewIncomingKey: allegroKluczWiadomosci(latestNewIncoming), needsReply: !!latestNewIncoming && !allegroMaOdpowiedzSprzedawcyPo(thread.messages, latestNewIncoming), humanReplyNeeded, humanReplySource: latestNewIncoming || previousThread.humanReplySource || null, manualReplyAt: latestNewIncoming ? null : (previousThread.manualReplyAt || null) };
  });
  let issues = (Array.isArray(data?.issues) ? data.issues : []).map((issue) => {
    const previousIssue = previousIssues.get(String(issue.id)) || {};
    issue = allegroScalPelnaHistorie(issue, previousIssue);
    const wiadomosci = issue.messages?.length ? issue.messages : [issue.lastMessage].filter(Boolean);
    const poprzednie = previousIssue?.messages?.length ? previousIssue.messages : [previousIssue?.lastMessage].filter(Boolean);
    const nowe = allegroNoweWiadomosciKlienta(wiadomosci, poprzednie, hasBaseline);
    const latestNewIncoming = nowe[0] || null;
    const humanReplyNeeded = !!latestNewIncoming || (!!previousIssue?.humanReplyNeeded && !previousIssue?.manualReplyAt);
    return { ...issue, newIncomingCount: nowe.length, newIncomingKeys: nowe.map(allegroKluczWiadomosci), latestNewIncoming, latestNewIncomingKey: allegroKluczWiadomosci(latestNewIncoming), needsReply: !!latestNewIncoming && !!issue.chatActive && !allegroMaOdpowiedzSprzedawcyPo(wiadomosci, latestNewIncoming), humanReplyNeeded, humanReplySource: latestNewIncoming || previousIssue?.humanReplySource || null, manualReplyAt: latestNewIncoming ? null : (previousIssue?.manualReplyAt || null) };
  });
  const freshThreadIds = new Set(threads.map((x) => String(x.id))), freshIssueIds = new Set(issues.map((x) => String(x.id)));
  threads = [...threads, ...[...previousThreads.values()].filter((x) => !freshThreadIds.has(String(x.id))).map((x) => ({ ...x, cachedOlder: true }))].slice(0, 500);
  issues = [...issues, ...[...previousIssues.values()].filter((x) => !freshIssueIds.has(String(x.id))).map((x) => ({ ...x, cachedOlder: true }))].slice(0, 500);
  return { ...data, threads, issues, baselineCreated: !hasBaseline };
}
function allegroMaOdpowiedzSprzedawcyPo(messages = [], msg = null) {
  if (!msg) return false;
  const t = new Date(msg.createdAt || 0).getTime() || 0;
  return (Array.isArray(messages) ? messages : []).some((m) => allegroCzyWiadomoscSprzedawcy(m) && ((new Date(m.createdAt || 0).getTime() || 0) >= t));
}
function allegroNajnowszaWiadomoscKlienta(item = {}) {
  const messages = item.messages?.length ? item.messages : [item.lastMessage].filter(Boolean);
  return (Array.isArray(messages) ? messages : []).filter(allegroCzyWiadomoscKlienta).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
}
function allegroKluczSprawyWewnetrznej(type = 'thread', id = '') {
  return `${type === 'issue' ? 'issue' : 'thread'}:${tekst(id, 120).trim()}`;
}
function allegroKomunikacjaWewnetrznieZalatwiona(item = {}) {
  return item?.internalResolved === true || item?.internalResolution?.resolved === true;
}
function allegroKomunikacjaWymagaOdpowiedzi(item = {}) {
  return !allegroKomunikacjaWewnetrznieZalatwiona(item) && !!(item?.needsReply || item?.humanReplyNeeded || Number(item?.newIncomingCount || 0) > 0);
}
function allegroZastosujStatusyWewnetrzne(data = {}, internalRec = {}) {
  const items = internalRec.items && typeof internalRec.items === 'object' ? { ...internalRec.items } : {};
  let changed = false;
  const apply = (type, item = {}) => {
    const key = allegroKluczSprawyWewnetrznej(type, item.id);
    let state = items[key] && typeof items[key] === 'object' ? { ...items[key] } : null;
    const latestIncoming = allegroNajnowszaWiadomoscKlienta(item);
    const sourceMessageKey = allegroKluczWiadomosci(latestIncoming);
    if (state?.resolved && sourceMessageKey && state.sourceMessageKey !== sourceMessageKey) {
      state = { ...state, resolved: false, reopenedAt: new Date().toISOString(), reopenReason: 'new_customer_message', currentSourceMessageKey: sourceMessageKey };
      items[key] = state; changed = true;
    }
    if (state?.resolved) return { ...item, internalResolved: true, internalResolution: state, needsReply: false, humanReplyNeeded: false, newIncomingCount: 0 };
    return { ...item, internalResolved: false, internalResolution: state || null };
  };
  return {
    data: { ...data, threads: (data.threads || []).map((x) => apply('thread', x)), issues: (data.issues || []).map((x) => apply('issue', x)) },
    items,
    changed,
  };
}
function allegroAutoReplyText(settings = {}, item = {}, kind = 'message') {
  const buyer = item.buyerLogin || 'Kliencie';
  return String(settings.template || ALLEGRO_AUTO_REPLY_DEFAULT)
    .replace(/\{login\}/g, buyer)
    .replace(/\{typ\}/g, kind === 'issue' ? 'dyskusję/reklamację' : 'wiadomość')
    .slice(0, 2000);
}
async function allegroPobierzKomunikacje(req, { limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const errors = [];
  let threadsSource = [];
  try {
    for (let offset = 0; offset < safeLimit; offset += 20) {
      const pageLimit = Math.min(20, safeLimit - offset);
      const threadsRaw = await allegroWywolaj(req, '/messaging/threads', { parameters: { limit: pageLimit, offset } });
      const page = allegroLista(threadsRaw, ['threads', 'items']);
      threadsSource.push(...page);
      if (page.length < pageLimit) break;
    }
  } catch (e) {
    errors.push({ key: 'threads', status: e.status || 0, code: e.code || '', message: e.message || String(e) });
  }
  const threads = (await Promise.all(threadsSource.slice(0, safeLimit).map(async (t) => {
    const id = tekst(t.id, 120);
    if (!id) return null;
    let messages = [], historyPages = 0, historyTruncated = false;
    try {
      const history = await fetchAllegroReplyHistory({ call: (path, options) => allegroWywolaj(req, path, options), type: 'thread', id, maxMessages: 200 });
      messages = history.messages; historyPages = history.pages; historyTruncated = history.truncated;
    } catch {}
    return { ...allegroNormalizujWatek(t, messages), historyPages, historyTruncated };
  }))).filter(Boolean);
  let issuesSource = [];
  try {
    const issuesRaw = await allegroWywolaj(req, '/sale/issues', { parameters: { limit: Math.min(100, safeLimit), offset: 0 }, accept: ALLEGRO_BETA_JSON });
    issuesSource = allegroLista(issuesRaw, ['issues', 'items']);
  } catch (e) {
    errors.push({ key: 'issues', status: e.status || 0, code: e.code || '', message: e.message || String(e) });
  }
  const issues = (await Promise.all(issuesSource.slice(0, safeLimit).map(async (i) => {
    const id = tekst(i.id, 120);
    if (!id) return null;
    let chat = [], historyPages = 0, historyTruncated = false;
    try {
      const history = await fetchAllegroReplyHistory({ call: (path, options) => allegroWywolaj(req, path, options), type: 'issue', id, maxMessages: 300, issueAccept: ALLEGRO_BETA_JSON });
      chat = history.messages; historyPages = history.pages; historyTruncated = history.truncated;
    } catch {}
    return { ...allegroNormalizujIssue(i, chat), historyPages, historyTruncated };
  }))).filter(Boolean);
  return { threads, issues, errors, requiresReauth: errors.some((e) => Number(e.status) === 403) };
}
async function allegroWyslijAutoOdpowiedzi(req, data, settings) {
  const rec = await czytaj('allegro_auto_replies', { items: {}, updated_at: null });
  const items = rec.items && typeof rec.items === 'object' ? rec.items : {};
  const sent = [];
  const skipped = [];
  const s = allegroUstawieniaKomunikacji(settings);
  const markSkip = (key, reason) => skipped.push({ key, reason });
  if (s.enabled && s.messageCenter) {
    for (const thread of data.threads || []) {
      const first = allegroPierwszaWiadomoscKlienta(thread.messages);
      const sourceKey = allegroKluczWiadomosci(first);
      const key = `thread:${thread.id}:first-contact`;
      if (thread.cachedOlder) { markSkip(key, 'starszy wpis zachowany wyłącznie do wyszukiwania'); continue; }
      if (allegroKomunikacjaWewnetrznieZalatwiona(thread)) { markSkip(key, 'sprawa zamknięta wewnętrznie'); continue; }
      if (!first || !thread.needsReply || !(thread.newIncomingKeys || []).includes(sourceKey)) { markSkip(key, 'to nie jest pierwszy kontakt w tej rozmowie'); continue; }
      if (allegroAutoReplyWyslanaDlaRozmowy(items, 'thread', thread.id)) { markSkip(key, 'pierwsza odpowiedź była już wysłana w tej rozmowie'); continue; }
      if ((thread.messages || []).some(allegroCzyWiadomoscSprzedawcy)) { markSkip(key, 'sprzedawca wcześniej uczestniczył w rozmowie'); continue; }
      if (!allegroJestSwieze(first.createdAt, s.freshHours)) { markSkip(key, 'wiadomość poza oknem czasowym'); continue; }
      if (allegroMaOdpowiedzSprzedawcyPo(thread.messages, first)) { markSkip(key, 'sprzedawca już odpowiedział'); continue; }
      const text = allegroAutoReplyText(s, thread, 'thread');
      const res = await allegroWywolaj(req, `/messaging/threads/${encodeURIComponent(thread.id)}/messages`, { method: 'POST', bodyObj: { text, attachments: [] } });
      items[key] = { key, type: 'thread', id: thread.id, mode: 'first-contact-only', sourceMessageId: first.id, responseId: res.id || '', sent_at: new Date().toISOString(), buyerLogin: thread.buyerLogin };
      sent.push(items[key]);
    }
  }
  if (s.enabled && s.issues) {
    for (const issue of data.issues || []) {
      const messages = issue.messages?.length ? issue.messages : [issue.lastMessage].filter(Boolean);
      const first = allegroPierwszaWiadomoscKlienta(messages);
      const sourceKey = allegroKluczWiadomosci(first);
      const key = `issue:${issue.id}:first-contact`;
      if (issue.cachedOlder) { markSkip(key, 'starszy wpis zachowany wyłącznie do wyszukiwania'); continue; }
      if (allegroKomunikacjaWewnetrznieZalatwiona(issue)) { markSkip(key, 'sprawa zamknięta wewnętrznie'); continue; }
      if (!first || !issue.needsReply || !(issue.newIncomingKeys || []).includes(sourceKey)) { markSkip(key, 'to nie jest pierwszy kontakt w tej dyskusji'); continue; }
      if (allegroAutoReplyWyslanaDlaRozmowy(items, 'issue', issue.id)) { markSkip(key, 'pierwsza odpowiedź była już wysłana w tej dyskusji'); continue; }
      if (messages.some(allegroCzyWiadomoscSprzedawcy)) { markSkip(key, 'sprzedawca wcześniej uczestniczył w dyskusji'); continue; }
      if (!issue.chatActive) { markSkip(key, 'czat nieaktywny'); continue; }
      if (!allegroJestSwieze(first.createdAt, s.freshHours)) { markSkip(key, 'wiadomość poza oknem czasowym'); continue; }
      if (allegroMaOdpowiedzSprzedawcyPo(messages, first)) { markSkip(key, 'sprzedawca już odpowiedział'); continue; }
      const text = allegroAutoReplyText(s, issue, 'issue');
      const res = await allegroWywolaj(req, `/sale/issues/${encodeURIComponent(issue.id)}/message`, { method: 'POST', accept: ALLEGRO_BETA_JSON, contentType: ALLEGRO_BETA_JSON, bodyObj: { text, attachments: [], type: 'REGULAR' } });
      items[key] = { key, type: 'issue', id: issue.id, mode: 'first-contact-only', sourceMessageId: first.id, responseId: res.id || '', sent_at: new Date().toISOString(), buyerLogin: issue.buyerLogin };
      sent.push(items[key]);
    }
  }
  await zapisz('allegro_auto_replies', { items, updated_at: new Date().toISOString() });
  return { sent, skipped, items };
}
function allegroOrderIdKomunikacji(item = {}) {
  const messages = Array.isArray(item.messages) ? item.messages : [];
  return tekst(item.orderId || item.lastMessage?.orderId || messages.find((m) => m?.orderId)?.orderId || '', 120).trim();
}
function allegroZnajdzZamowienieKomunikacji(item = {}, orders = []) {
  const list = Array.isArray(orders) ? orders : [];
  const directId = allegroOrderIdKomunikacji(item);
  if (directId) return { orderId: directId, order: list.find((x) => String(x?.id || x?.nr) === directId) || null, match: 'conversation_order_id', candidates: [directId] };
  const text = `${item.subject || ''} ${(item.messages || []).map((m) => m?.text || '').join(' ')}`.toLowerCase();
  const inText = list.find((x) => {
    const id = String(x?.id || x?.nr || '').trim();
    return id.length >= 8 && text.includes(id.toLowerCase());
  });
  if (inText) return { orderId: String(inText.id || inText.nr), order: inText, match: 'order_id_in_message', candidates: [String(inText.id || inText.nr)] };
  const login = String(item.buyerLogin || '').trim().toLowerCase();
  const buyerOrders = login ? list.filter((x) => String(x?.buyerLogin || '').trim().toLowerCase() === login).sort((a, b) => String(b.createdAt || b.firstFetchedAt || '').localeCompare(String(a.createdAt || a.firstFetchedAt || ''))) : [];
  return { orderId: '', order: null, match: '', candidates: buyerOrders.slice(0, 5).map((x) => String(x.id || x.nr)) };
}
function allegroStatusZamowieniaOpis(status = '') {
  return ({ NEW: 'nowe', PROCESSING: 'w realizacji', READY_FOR_SHIPMENT: 'gotowe do wysyłki', READY_FOR_PICKUP: 'gotowe do odbioru', SENT: 'wysłane', PICKED_UP: 'odebrane', CANCELLED: 'anulowane', SUSPENDED: 'wstrzymane', RETURNED: 'zwrócone' })[String(status || '').toUpperCase()] || String(status || 'brak statusu').toLowerCase();
}
function allegroKontekstOdpowiedzi(item = {}, order = null, checks = {}) {
  const analysis = order?.agentAnalysis || {};
  const positions = Array.isArray(analysis.positions) ? analysis.positions : [];
  const products = (Array.isArray(order?.lineItems) ? order.lineItems : []).map((x) => `${tekst(x.offerName || 'produkt', 120)} × ${Math.max(1, Number(x.quantity) || 1)}`).slice(0, 8);
  const stock = positions.map((p) => ({ name: tekst(p.nazwa || p.productName || 'produkt', 120), stock: p.stock, available: p.available, shortage: Math.max(0, Number(p.shortage) || 0), location: tekst(p.location || '', 80) }));
  const officialStatus = allegroStatusKolejkiZamowienia(order || {}, {});
  const shipments = Array.isArray(checks.shipments) ? checks.shipments : [];
  const localShipping = checks.localOrder?.wysylka || {};
  const tracking = tekst(shipments.find((x) => x?.waybill)?.waybill || localShipping.numer || checks.localOrder?.trackingNumber || '', 120).trim();
  const carrier = tekst(shipments.find((x) => x?.waybill)?.carrierName || shipments.find((x) => x?.waybill)?.carrierId || localShipping.przewoznik || '', 120).trim();
  const shippingStatus = tekst(order?.shipmentStatus || order?.deliveryStatus || localShipping.inpostStatus || localShipping.etap || '', 160).trim();
  const sent = ['SENT', 'PICKED_UP'].includes(officialStatus);
  const delivered = officialStatus === 'PICKED_UP' || /delivered|dostarcz|odebran/i.test(shippingStatus);
  return {
    orderId: tekst(order?.id || order?.nr || checks.orderId || allegroOrderIdKomunikacji(item), 120),
    orderFound: !!order,
    orderMatch: checks.orderMatch || '',
    candidateOrderIds: Array.isArray(checks.candidateOrderIds) ? checks.candidateOrderIds : [],
    status: officialStatus,
    statusLabel: allegroStatusZamowieniaOpis(officialStatus),
    warehouseStage: tekst(order?.warehouseStage || '', 40),
    paymentStatus: tekst(order?.paymentStatus || '', 160),
    products,
    stock,
    ready: !!analysis.gotowe,
    shortages: stock.reduce((sum, p) => sum + p.shortage, 0),
    shipment: { sent, delivered, tracking, carrier, status: shippingStatus, labelCreated: !!(localShipping.etykietaGotowa || localShipping.inpostId), checked: checks.shipmentsChecked === true, source: shipments.length ? 'Allegro' : (checks.localOrder ? 'InPost/sklep' : '') },
    verifiedAt: new Date().toISOString(),
    checks: { liveOrder: checks.liveOrderChecked === true, shipments: checks.shipmentsChecked === true, localShipping: !!checks.localOrder, warehouse: !!order?.agentAnalysis },
    errors: Array.isArray(checks.errors) ? checks.errors.map((x) => tekst(x, 300)).slice(0, 5) : [],
  };
}
async function allegroSprawdzKontekstOdpowiedzi(req, item = {}, allegroOrders = [], storeOrders = []) {
  const found = allegroZnajdzZamowienieKomunikacji(item, allegroOrders);
  let order = found.order, shipments = [], liveOrderChecked = false, shipmentsChecked = false;
  const errors = [];
  if (found.orderId) {
    try {
      const raw = await allegroWywolaj(req, `/order/checkout-forms/${encodeURIComponent(found.orderId)}`, { method: 'GET' });
      order = allegroScalZamowienie(raw, order || {});
      liveOrderChecked = true;
    } catch (error) { errors.push(`Zamówienie Allegro: ${error.message || error}`); }
    try {
      const raw = await allegroWywolaj(req, `/order/checkout-forms/${encodeURIComponent(found.orderId)}/shipments`, { method: 'GET' });
      shipments = Array.isArray(raw?.shipments) ? raw.shipments : [];
      shipmentsChecked = true;
    } catch (error) { errors.push(`Przesyłki Allegro: ${error.message || error}`); }
  }
  const localOrder = (Array.isArray(storeOrders) ? storeOrders : []).find((x) => [x?.nr, x?.id, x?.allegroOrderId, x?.checkoutFormId].some((value) => String(value || '') === String(found.orderId || ''))) || null;
  const context = allegroKontekstOdpowiedzi(item, order, { orderId: found.orderId, orderMatch: found.match, candidateOrderIds: found.candidates, shipments, liveOrderChecked, shipmentsChecked, localOrder, errors });
  return { order, context };
}
async function allegroPelnaSprawaDoOdpowiedzi(req, type = 'thread', item = {}) {
  try {
    const history = await fetchAllegroReplyHistory({
      call: (path, options) => allegroWywolaj(req, path, options), type, id: item.id,
      maxMessages: type === 'issue' ? 300 : 200, issueAccept: type === 'issue' ? ALLEGRO_BETA_JSON : '',
    });
    const normalized = history.messages.map((message) => type === 'issue'
      ? allegroNormalizujIssueChatMessage(message, item.id)
      : allegroNormalizujWiadomosc(message, item.id));
    const messages = mergeAllegroReplyHistory(item.messages || [], normalized);
    return { item: { ...item, messages, lastMessage: messages.at(-1) || item.lastMessage || null, fullHistoryCount: messages.length }, live: true, pages: history.pages, truncated: history.truncated, error: '' };
  } catch (error) {
    const messages = mergeAllegroReplyHistory(item.messages || [], item.lastMessage ? [item.lastMessage] : []);
    return { item: { ...item, messages, fullHistoryCount: messages.length }, live: false, pages: 0, truncated: false, error: tekst(error?.message || error, 300) };
  }
}
function allegroPoprzednieSprawyKlienta(comm = {}, currentType = 'thread', currentItem = {}) {
  const login = String(currentItem.buyerLogin || '').trim().toLowerCase();
  if (!login) return [];
  return [
    ...(Array.isArray(comm.threads) ? comm.threads : []).map((item) => ({ ...item, communicationType: 'thread' })),
    ...(Array.isArray(comm.issues) ? comm.issues : []).map((item) => ({ ...item, communicationType: 'issue' })),
  ].filter((item) => String(item.buyerLogin || '').trim().toLowerCase() === login && !(item.communicationType === currentType && String(item.id || '') === String(currentItem.id || '')));
}
function allegroWzorceStyluOdpowiedzi(comm = {}, memory = {}) {
  const stored = Array.isArray(memory.items) ? memory.items : [];
  const live = [
    ...(Array.isArray(comm.threads) ? comm.threads : []),
    ...(Array.isArray(comm.issues) ? comm.issues : []),
  ].flatMap((item) => Array.isArray(item.messages) ? item.messages : [])
    .filter(allegroCzyWiadomoscSprzedawcy)
    .map((message) => ({ text: message.text, at: message.createdAt || '' }));
  const examples = [...stored, ...live]
    .filter((entry) => entry && typeof entry === 'object')
    .sort((a, b) => String(a.at || a.sentAt || '').localeCompare(String(b.at || b.sentAt || '')))
    .map((entry) => tekst(entry.normalizedText || entry.text || '', 20_000).trim())
    .filter(Boolean)
    .slice(-30);
  return { examples, profile: buildAllegroReplyStyleProfile(examples) };
}
async function allegroZapamietajStylRecznejOdpowiedzi({ type = 'thread', id = '', text = '', messageId = '' } = {}) {
  const rec = await czytaj('allegro_reply_style_memory', { items: [], updated_at: null });
  const items = Array.isArray(rec.items) ? [...rec.items] : [];
  const normalizedText = improvePolishReplyStyle(text, { ensureReplyFrame: true });
  items.push({ id: crypto.randomUUID(), type, conversationId: id, messageId, text: tekst(text, 20_000), normalizedText, sentAt: new Date().toISOString(), source: 'manual-seller-reply' });
  await zapisz('allegro_reply_style_memory', { items: items.slice(-200), updated_at: new Date().toISOString() });
  return buildAllegroReplyStyleProfile(items.map((item) => item.normalizedText || item.text));
}
function seoBezHtml(value = '') {
  return tekst(value, 30000).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}
function seoSkroc(value, max) {
  const clean = seoBezHtml(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(1, max - 1)).replace(/\s+\S*$/, '')}…`;
}
function seoPropozycja(p = {}) {
  const name = tekst(p.nazwa, 500).trim() || 'Produkt', brand = tekst(p.producent || p.marka, 200).trim(), category = tekst(p.kategoria, 200).trim();
  let title = `${name}${brand && !name.toLowerCase().includes(brand.toLowerCase()) ? ` – ${brand}` : ''}`;
  if (title.length < 30 && category && !title.toLowerCase().includes(category.toLowerCase())) title += ` – ${category}`;
  if (title.length < 30) title += ' | Artway-TM';
  title = seoSkroc(title, 60);
  let description = seoBezHtml(p.opisKrotki || p.krotkiOpis || p.opis);
  if (!description) description = `${name}${category ? ` z kategorii ${category}` : ''}. Sprawdź szczegóły, dostępność i bezpieczne zakupy w Artway-TM.`;
  if (description.length < 80) description += ' Poznaj najważniejsze cechy produktu i jego zastosowanie.';
  const keywords = [...new Set([name, category, brand, p.gtin || p.ean, p.sku].map((v) => tekst(v, 500).trim()).filter(Boolean))].slice(0, 8).join(', ');
  return { seoTitle: title, seoDescription: seoSkroc(description, 158), seoKeywords: keywords };
}
function seoOcena(p = {}) {
  const title = tekst(p.seoTitle, 500), description = tekst(p.seoDescription, 1000), full = seoBezHtml(p.opis); let score = 0;
  if (title.length >= 30 && title.length <= 65) score += 18;
  if (description.length >= 80 && description.length <= 165) score += 18;
  if (full.length >= 250) score += 16;
  if (p.zdjecie) score += 12;
  if (p.kategoria) score += 8;
  if (p.gtin || p.ean) score += 8;
  if (p.producent || p.marka) score += 7;
  if (Number(p.cena) > 0) score += 7;
  if (p.sourceUrl || p.producentUrl) score += 3;
  if (p.seoReviewedAt) score += 3;
  return Math.min(100, score);
}
async function seoWykonajDziennyPlan({ limit, source } = {}) {
  const rec = await czytaj('settings', { data: {}, rev: 0 }), data = rec.data && typeof rec.data === 'object' ? { ...rec.data } : {}, config = { enabled: true, dailyLimit: 50, autoFillMissing: true, preferBestsellers: true, indexNowEnabled: true, ...(data.artway_seo_ustawienia || {}), autoAllProducts: true };
  const amount = Math.max(1, Math.min(50, Number(limit || config.dailyLimit) || 50));
  const runSource = tekst(source || 'manual-admin', 100), now = new Date().toISOString(), scheduledDay = seoAutomationDay(now);
  const history = Array.isArray(data.artway_seo_historia) ? data.artway_seo_historia : [];
  if (config.enabled === false && isScheduledSeoSource(runSource)) return { processed: 0, skipped: true, reason: 'disabled' };
  if (isScheduledSeoSource(runSource)) {
    const completed = scheduledSeoRunForDay(history, scheduledDay);
    if (completed) return duplicateScheduledSeoResult(completed, amount);
  }
  const canonical = await centralProductCatalog.listDataMap({ includeTrash: false });
  const today = new Date().toISOString().slice(0, 10), products = [...canonical.values()]
    .filter((product) => Number(product.cena || product.price) > 0 && product?._catalog?.availability?.saleAvailable !== false)
    .map((product) => ({ product, score: seoOcena(product) })).sort((a, b) => {
    const ap = a.product.seoPromoted || a.product.badge ? 1 : 0, bp = b.product.seoPromoted || b.product.badge ? 1 : 0;
    if (config.preferBestsellers !== false && bp !== ap) return bp - ap;
    return a.score - b.score || String(a.product.seoReviewedAt || '').localeCompare(String(b.product.seoReviewedAt || ''));
  });
  const fresh = products.filter((x) => !String(x.product.seoReviewedAt || '').startsWith(today)), selected = fresh.slice(0, amount);
  for (const item of selected) {
    const proposal = seoPropozycja(item.product), mode = item.product.seoMode === 'manual' ? 'manual' : 'auto', patch = { seoMode: mode, seoReviewedAt: now, seoSource: runSource, seoScore: 0 };
    if (config.autoFillMissing !== false) {
      if (mode === 'auto' && config.autoAllProducts !== false) { patch.seoTitle = proposal.seoTitle; patch.seoDescription = proposal.seoDescription; patch.seoKeywords = proposal.seoKeywords; }
      else { if (!item.product.seoTitle) patch.seoTitle = proposal.seoTitle; if (!item.product.seoDescription) patch.seoDescription = proposal.seoDescription; if (!item.product.seoKeywords) patch.seoKeywords = proposal.seoKeywords; }
    }
    patch.seoScore = seoOcena({ ...item.product, ...patch });
    await zapiszIOpublikujPolaProduktuCentralnie({
      productId: String(item.product.id),
      fields: patch,
      mutationId: `seo:${String(item.product.id)}:${now}`,
      actor: 'seo-automation',
      area: 'seo',
    });
  }
  const fullCatalogSubmission = !config.indexNowFullCatalogAt;
  const promotion = await runIndexNowPromotion({ catalogProducts: products.map((item) => item.product), changedProducts: selected.map((item) => item.product), config });
  const channels = buildSeoChannelReport({ selectedProducts: selected.map((item) => item.product), catalogProducts: products.map((item) => item.product), promotion, runAt: now });
  data.artway_seo_ustawienia = { ...config, dailyLimit: amount, lastRunAt: now, lastRunCount: selected.length, lastScheduledDay: isScheduledSeoSource(runSource) ? scheduledDay : (config.lastScheduledDay || ''), lastChannels: channels, lastPromotionAt: promotion.submitted ? now : (config.lastPromotionAt || ''), lastPromotionStatus: promotion.submitted ? promotion.status : (config.lastPromotionStatus || promotion.status), lastPromotionCount: promotion.submitted ? promotion.count : (Number(config.lastPromotionCount) || 0), lastPromotionHttpStatus: promotion.submitted ? promotion.httpStatus : (config.lastPromotionHttpStatus || null), indexNowFullCatalogAt: fullCatalogSubmission && promotion.accepted ? now : (config.indexNowFullCatalogAt || ''), indexNowFullCatalogCount: fullCatalogSubmission && promotion.accepted ? Math.max(0, promotion.count - 1) : (Number(config.indexNowFullCatalogCount) || 0) };
  data.artway_seo_historia = [{ id: `seo-${Date.now()}`, at: now, scheduledDay: isScheduledSeoSource(runSource) ? scheduledDay : '', type: 'daily', source: runSource, count: selected.length, channels, promotion: { status: promotion.status, count: promotion.count, httpStatus: promotion.httpStatus, scope: promotion.scope }, products: selected.map((x) => ({ id: x.product.id, name: x.product.nazwa, scoreBefore: x.score })) }, ...history].slice(0, 500);
  const saved = { data, rev: Number(rec.rev || 0) + 1, updated_at: now }; await zapisz('settings', saved);
  return { processed: selected.length, limit: amount, scheduledDay: isScheduledSeoSource(runSource) ? scheduledDay : '', channels, promotion, products: selected.map((x) => ({ id: x.product.id, name: x.product.nazwa, scoreBefore: x.score })), updated_at: now, rev: saved.rev };
}

async function katalogWykonajAudyt({ fixSafe = false, quarantineOrphans = false, source = 'manual-admin' } = {}) {
  const settingsRec = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
  const catalogBefore = [...(await centralProductCatalog.listDataMap({ includeTrash: false })).values()];
  let data = { artway_produkty_dodane: catalogBefore };
  const before = auditCatalog(data);
  let changes = [], orphanArchive = [], saved = false, rev = Number(settingsRec.rev || 0);
  if (fixSafe) {
    const operations = before.rows
      .filter((row) => row.id && Object.keys(row.safePatch || {}).length)
      .map((row) => ({ id: row.id, fields: row.safePatch }));
    changes = before.rows
      .filter((row) => row.id && Object.keys(row.safePatch || {}).length)
      .map((row) => ({ id: row.id, name: row.name, fields: Object.keys(row.safePatch) }));
    if (operations.length) {
      const now = new Date().toISOString();
      const write = await zapiszOperacjeProduktow(operations, now);
      if (write.skippedProductIds?.length) throw new Error(`Nie zapisano ${write.skippedProductIds.length} bezpiecznych poprawek katalogu.`);
      saved = write.modified === true;
    }
    data = { artway_produkty_dodane: [...(await centralProductCatalog.listDataMap({ includeTrash: false })).values()] };
  }
  const report = auditCatalog(data);
  const now = new Date().toISOString();
  const previous = await czytaj('catalog_quality_audit', { history: [], orphanArchive: [] });
  const history = [{
    id: `quality-${Date.now()}`,
    at: now,
    source: tekst(source, 100),
    fixed: !!fixSafe,
    changes: changes.length,
    quarantined: orphanArchive.length,
    before: before.summary,
    after: report.summary,
  }, ...(Array.isArray(previous.history) ? previous.history : [])].slice(0, 120);
  const archived = [...orphanArchive, ...(Array.isArray(previous.orphanArchive) ? previous.orphanArchive : [])].slice(0, 200);
  await zapisz('catalog_quality_audit', { report, history, orphanArchive: archived, updated_at: now });
  return { report, before: before.summary, changes, quarantined: orphanArchive.map((entry) => ({ id: entry.id, reason: entry.reason })), saved, rev, updated_at: now };
}

const infaktRoute = createInfaktRoute({
  odpowiedz,
  czyAdmin,
  tekst,
  czytaj,
  zapisz,
  numerZamowienia,
  infaktPublicConfig,
  infaktDostawcyUstawienia,
  infaktDostawcyDozwoleni,
  infaktPobierzKosztyDozwolone,
  infaktKosztDoZwrotu,
  infaktSynchronizujCenyZakupu,
  infaktPrzypiszCeneZakupu,
  infaktCofnijDopasowanieCeny,
  infaktWywolaj,
  infaktPayloadZamowienia,
  infaktRef,
  infaktInvoiceFromTask,
  infaktErrorText,
});

const paynowRoute = createPaynowRoute({
  respond: odpowiedz,
  isAdmin: czyAdmin,
  rateLimit: ograniczRuch,
  text: tekst,
  read: czytaj,
  write: zapisz,
  readDeletedOrders: czytajUsunieteZamowienia,
  deletedOrderMap: mapaUsunietych,
  filterUndeletedOrders: filtrujNieusunieteZamowienia,
  normalizeOrder: normalizujZamowienie,
  orderNumber: numerZamowienia,
  orderLimit: LIMIT_ZAMOWIEN,
  finalStatuses: PAYNOW_STATUSY_KONCOWE,
  configure: paynowKonfiguracja,
  diagnose: paynowDiagnostyka,
  paymentStatus: statusPlatnosciPaynow,
  idempotencyKey: kluczIdempotencji,
  call: paynowWywolaj,
  paymentPayload: payloadPlatnosciPaynow,
  updateOrder: aktualizujZamowieniePaynow,
  signNotification: podpisPaynowPowiadomienia,
  compareSignature: porownajPodpis,
  cents: grosze,
  currencyText: zlSerwer,
  sendNewOrderEmails: wyslijEmaileNowegoZamowienia,
  emailConfig: emailKonfiguracja,
  appendEmailHistory: dopiszHistorieEmaila,
  sendStatusEmail: wyslijEmailStatusowy,
});

const storeDataRoute = createStoreDataRoute({
  odpowiedz,
  czyAdmin,
  czytaj,
  productLinkImport,
  ustawieniaPubliczneBezDanychPrywatnych,
  czytajUsunieteZamowienia,
  filtrujNieusunieteZamowienia,
  oczyscUstawienia,
  tekst,
  czytajWersjonowane,
  preserveSupplierPlanOnGenericSettings,
  LIMIT_USTAWIEN,
  zapiszJesliWersja,
  zapiszOperacjeProduktow,
  zapiszPolaProduktuCentralnie: zapiszIOpublikujPolaProduktuCentralnie,
  publikujPolaProduktuCentralnie: null,
  createCatalogProduct: (product, options) => centralProductCatalog.upsertProduct(product, options),
  readCatalogProduct: (productId) => centralProductCatalog.get(productId, { admin: true }),
  setCatalogProductStatus: (productId, status, options) => centralProductCatalog.setRecordStatus(productId, status, options),
  purgeCatalogProduct: (productId, options) => centralProductCatalog.purgeProduct(productId, options),
  ograniczRuch,
  bezpieczneZamowienieKlienta,
  loadCheckoutProducts: async () => [...(await centralProductCatalog.listDataMap({ includeTrash: false })).values()]
    .filter((product) => product?._catalog?.availability?.saleAvailable !== false),
  requestSession,
  emitAgentEvent,
  signalProductMutation: (productId, details) => agentEvents.signalProduct(productId, details),
  mapaUsunietych,
  storeOrderSupplierReconciliation,
  zwiekszLicznikKoduRabatowego,
  wyslijEmaileNowegoZamowienia,
  emailKonfiguracja,
  dopiszHistorieEmaila,
  createOrderAccess,
  bezpiecznaOpinia,
  zapisz,
  normalizujZamowienie,
  LIMIT_USUNIETYCH_ZAMOWIEN,
  LIMIT_ZAMOWIEN,
  normalizujKlienta,
  LIMIT_KLIENTOW,
  polaczPowiadomienia,
  obsluzEmailePrzejsciaStatusu,
  numerZamowienia,
  dopiszUsunieteZamowienie,
  verifyOrderAccess,
  profilKlienta,
  publicUser,
  hashPassword,
  createAccountSession,
  verifyPassword,
  bezpiecznePorownanie,
  legacyPasswordHash,
  accountSessionHeaders,
  createAdminMfaChallenge,
  createMfaEmailRecovery,
  createMfaEnrollment,
  decryptMfaSecret,
  mfaProvisioningUri,
  verifyAdminMfaChallenge,
  verifyMfaCode,
  verifyMfaEmailRecoveryChallenge,
  verifyMfaEmailRecoveryCode,
  wyslijEmailSMTP,
  czytajUstawieniaBazowe,
  czytajUstawieniaPrzyrostowo,
  primaryAdminEmail: () => process.env.ARTWAY_ADMIN_EMAIL || 'artwaytm@gmail.com',
  clearAccountSessionHeaders,
});

const systemRoute = createSystemRoute({
  odpowiedz,
  czyAdmin,
  czytaj,
  filtrujNieusunieteZamowienia,
  emailPublicConfig,
  inpostPublicConfig,
  paynowKonfiguracja,
  allegroStatus,
  infaktPublicConfig,
  requestSession,
  createAccountSession,
  publicUser,
  accountSessionHeaders,
  clearAccountSessionHeaders,
  repository,
  storeName: STORE_NAME,
  backupKeyPattern: BACKUP_KEY_PATTERN,
  czytajUstawieniaBazowe,
});
const systemDiagnostics = createSystemDiagnosticsRoute({
  readVersioned: czytajWersjonowane,
  writeIfVersion: zapiszJesliWersja,
  respond: odpowiedz,
  isAdmin: czyAdmin,
  rateLimit: ograniczRuch,
  sessionOf: requestSession,
  agentRuntime,
  diagnosticAgent,
});
const serverMaintenanceRoute = createServerMaintenanceRoute({
  respond: odpowiedz,
  isAdmin: czyAdmin,
  sessionOf: requestSession,
});

const allegroCommunicationsRoute = createAllegroCommunicationsRoute({
  respond: odpowiedz, isAdmin: czyAdmin, read: czytaj, write: zapisz, text: tekst, allegroStatus,
  applyInternalStatuses: allegroZastosujStatusyWewnetrzne, normalizeSettings: allegroUstawieniaKomunikacji,
  caseKey: allegroKluczSprawyWewnetrznej, latestCustomerMessage: allegroNajnowszaWiadomoscKlienta,
  messageKey: allegroKluczWiadomosci, learnedReplyStyle: allegroWzorceStyluOdpowiedzi,
  fullReplyCase: allegroPelnaSprawaDoOdpowiedzi, previousCustomerCases: allegroPoprzednieSprawyKlienta,
  checkReplyContext: allegroSprawdzKontekstOdpowiedzi, callAllegro: allegroWywolaj, betaJson: ALLEGRO_BETA_JSON,
  normalizeIssueMessage: allegroNormalizujIssueChatMessage, normalizeThreadMessage: allegroNormalizujWiadomosc,
  rememberManualReplyStyle: allegroZapamietajStylRecznejOdpowiedzi, fetchCommunications: allegroPobierzKomunikacje,
  markNewCommunications: allegroOznaczNowaKomunikacje,
  sendAutoReplies: allegroWyslijAutoOdpowiedzi,
  emitAgentEvent,
});
const allegroMappingRoute = createAllegroMappingRoute({
  respond: odpowiedz, isAdmin: czyAdmin, text: tekst, read: czytaj, write: zapisz,
  mappingItems: allegroMapowaniaItems, offerItems: allegroOfertyItems, completeProducts: allegroAgentProduktyKompletne,
  assessMapping: allegroOcenaPowiazania,
  productSnapshot: mappingProductSnapshot, writeMappingsSafely: zapiszMapowaniaBezpiecznie,
  recalculateOrders: allegroPrzeliczZamowieniaPoMapowaniu,
  saveProductFields: zapiszIOpublikujPolaProduktuCentralnie,
});
const productAvailabilityRoute = createProductAvailabilityRoute({
  respond: odpowiedz, isAdmin: czyAdmin, text: tekst, read: czytaj, write: zapisz,
  inspectProduct: pobierzProduktProducentaZPamiecia, prepareProduct: przygotujPakietProduktuZLinku,
  syncSaleChannels: synchronizujSprzedazZDostepnosciaProducenta, mappingItems: allegroMapowaniaItems,
  isAllegroOrderActive: allegroAgentZlecenieAktywne, fetchProduct: pobierzProduktProducenta,
  loadProducts: allegroAgentProduktyKompletne,
  saveProductFields: zapiszIOpublikujPolaProduktuCentralnie,
  mutateSettings: mutateSettingsSafely,
});
const emailRoute = createEmailRoute({
  respond: odpowiedz, isAdmin: czyAdmin, text: tekst, read: czytaj, write: zapisz,
  publicConfig: emailPublicConfig, checkSmtp: sprawdzEmailSMTP, supplierPlan: supplierOrderPlan,
  renderSupplierOrder: producentEmailZlecenia, sendSmtp: wyslijEmailSMTP, sessionOf: requestSession,
  syncProcurement: synchronizujEtapyZakupoweZlecen, orderNumber: numerZamowienia, emailConfig: emailKonfiguracja,
  orderConfirmation: wiadomoscKlientaZamowienie, appendHistory: dopiszHistorieEmaila, sendStatus: wyslijEmailStatusowy,
});

agentEvents.connect({
  preparationRoute: allegroPreparationRoute,
  storeOrderReconciliation: storeOrderSupplierReconciliation,
  readAllegroOrders: () => czytaj('allegro_orders', { items: [] }),
  reconcileAllegroPlan: allegroZapisStanIMozeUzgodnijPlan,
});
export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'health';

  if (req.method === 'OPTIONS') return odpowiedz({ ok: true });
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_PAYLOAD_BYTES) return odpowiedz({ ok: false, error: 'Żądanie jest zbyt duże.', code: 'payload_too_large' }, 413);
  try {
    await przygotujZweryfikowanaSesje(req);
    const agentRuntimeResponse = await agentRuntimeRoute(req, url, action);
    if (agentRuntimeResponse) return agentRuntimeResponse;
    const allegroCredentialsResponse = await allegroCredentialsRoute(req, url, action);
    if (allegroCredentialsResponse) return allegroCredentialsResponse;
    const inventoryDecisionResponse = await inventoryDecisionRoute(req, url, action);
    if (inventoryDecisionResponse) return inventoryDecisionResponse;
    const inventoryResponse = await inventoryStockRoute(req, url, action);
    if (inventoryResponse) return inventoryResponse;
    const withdrawalResponse = await allegroOfferWithdrawalRoute({ req, url, action });
    if (withdrawalResponse) return withdrawalResponse;
    const aiBannerResponse = await aiBannerRoute(req, url, action);
    if (aiBannerResponse) return aiBannerResponse;
    const agentSpecialistResponse = await agentSpecialistRoute(req, url, action);
    if (agentSpecialistResponse) return agentSpecialistResponse;
    const openAiPlatformResponse = await openAiPlatformRoute(req, url, action);
    if (openAiPlatformResponse) return openAiPlatformResponse;
    const diagnosticsResponse = await systemDiagnostics.route(req, url, action);
    if (diagnosticsResponse) return diagnosticsResponse;
    const serverMaintenanceResponse = await serverMaintenanceRoute(req, url, action);
    if (serverMaintenanceResponse) return serverMaintenanceResponse;
    const systemResponse = await systemRoute(req, url, action);
    if (systemResponse) return systemResponse;
    if (action === 'catalog-quality-audit') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const result = await katalogWykonajAudyt({
        fixSafe: body.fixSafe === true,
        quarantineOrphans: body.quarantineOrphans === true,
        source: body.source || 'manual-admin',
      });
      return odpowiedz({ ok: true, ...result });
    }

    if (action === 'seo-daily-run') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({})), result = await seoWykonajDziennyPlan({ limit: body.limit, source: body.source || 'manual-admin' });
      return odpowiedz({ ok: true, ...result });
    }
    const infaktResponse = await infaktRoute(req, url, action);
    if (infaktResponse) return infaktResponse;

    const agentOperationsResponse = await agentOperationsRoute(req, url, action);
    if (agentOperationsResponse) return agentOperationsResponse;

    // ─── PLAN ZATOWAROWANIA: jedna serwerowa kolejka dokumentów producentów ───
    const supplierRouteResponse = await supplierOrderRoute({ req, url, action });
    if (supplierRouteResponse) return supplierRouteResponse;

    const emailResponse = await emailRoute(req, url, action);
    if (emailResponse) return emailResponse;

    const paynowResponse = await paynowRoute(req, url, action);
    if (paynowResponse) return paynowResponse;

    // ─── ALLEGRO: stan integracji i dane zapisane w backendzie (admin) ───
    if (action === 'allegro-data') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      return odpowiedz(await allegroDataReader(url.searchParams.get('scope') || 'all', req));
    }

    // ─── ALLEGRO: lekkie archiwum zamówień starszych niż 30 dni (admin) ───
    if (action === 'allegro-orders-archive') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const page = await allegroOrderArchive.page({
        month: tekst(url.searchParams.get('month') || '', 7),
        offset: Number(url.searchParams.get('offset') || 0),
        limit: Number(url.searchParams.get('limit') || 100),
      });
      return odpowiedz({ ok: true, readOnly: true, retentionDays: 30, ...page });
    }

    // ─── ALLEGRO: obowiązkowa kontrola zgodności opisów (admin) ───
    if (action === 'allegro-offer-compliance') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const audit = await allegroAudytZgodnosciOfert(req, {
        offerId: body.offerId,
        offerIds: body.offerIds,
        limit: body.limit,
        fix: body.fix === true,
        activeOnly: body.activeOnly !== false,
      });
      return odpowiedz({ ok: true, ...audit });
    }

    if (action === 'allegro-offer-settings') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const requested = Number(body.defaultStock);
      if (!Number.isInteger(requested) || requested < 1 || requested > 99999) return odpowiedz({ ok: false, error: 'Domyślny stan ofert musi być liczbą całkowitą od 1 do 99999', code: 'validation' }, 422);
      const previous = await allegroPobierzUstawieniaOfert();
      const settings = allegroUstawieniaOfert({ ...previous, ...body, defaultStock: requested, republish: true, updated_at: new Date().toISOString() });
      await zapisz('allegro_offer_settings', settings);
      return odpowiedz({ ok: true, settings });
    }

    if (action === 'allegro-connection-check') {
      if (req.method !== 'GET') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      await allegroAccessToken(req);
      const status = await allegroStatus(req);
      return odpowiedz({ ok: true, allegro: status, ready: status.connected === true && status.requiresReauth !== true });
    }

    // ─── ALLEGRO: utworzenie linku OAuth (admin) ───
    if (action === 'allegro-auth-url') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const c = allegroKonfiguracja(req);
      if (!c.configured) return odpowiedz({ ok: false, configured: false, error: 'Allegro API nie jest skonfigurowane. Ustaw ALLEGRO_CLIENT_ID i ALLEGRO_CLIENT_SECRET na serwerze.', code: 'allegro_not_configured', missingEnv: c.missingEnv }, 503);
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
      return odpowiedzHtml('<h1>Allegro połączone</h1><p>Konto Allegro zostało ponownie autoryzowane dla panelu Artway-TM. Możesz teraz sprawdzić oferty, wiadomości oraz dyskusje.</p><p><a href="/#/admin/allegro/wiadomosci">Przejdź do wiadomości</a> · <a href="/#/admin/allegro/dyskusje">Przejdź do dyskusji</a></p>');
    }

    // ─── ALLEGRO: synchronizacja zamówień (admin) ───
    if (action === 'allegro-sync-orders') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const limit = Math.min(1000, Math.max(1, Number(body.limit || url.searchParams.get('limit') || 200)));
      const officialCheckedAt = new Date().toISOString(), pobrane = [];
      for (let offset = 0; offset < limit; offset += 100) {
        const pageLimit = Math.min(100, limit - pobrane.length);
        if (pageLimit <= 0) break;
        const dane = await allegroWywolaj(req, '/order/checkout-forms', { parameters: { limit: pageLimit, offset } });
        const source = Array.isArray(dane.checkoutForms) ? dane.checkoutForms : (Array.isArray(dane.items) ? dane.items : []);
        pobrane.push(...source);
        if (source.length < pageLimit) break;
      }
      const poprzedniRec = await czytaj('allegro_orders', { items: [], updated_at: null });
      const poprzednie = Array.isArray(poprzedniRec.items) ? poprzedniRec.items : [];
      const archiveIndex = await allegroOrderArchive.index();
      const archivedLookup = archiveIndex.lookup && typeof archiveIndex.lookup === 'object' ? archiveIndex.lookup : {};
      const baselineRec = await czytaj('allegro_orders_baseline_v2', { baseline_at: null });
      const { baselineCreated, baselineAt, baselineMarkerMissing } = resolveAllegroBaselineCutover(baselineRec, poprzedniRec);
      const recent = mergeRecentAllegroOrders({ fetched: pobrane, previous: poprzednie, archivedLookup, normalize: allegroNormalizujZamowienie, merge: allegroScalZamowienie, isWorkItem: allegroZamowienieJestNoweLubDoWyslania, checkedAt: officialCheckedAt });
      const { byId: mapa, previousById: poprzedniePoId, seenIds: seen, newOrderIds: noweIds } = recent;
      const dodane = recent.imported, odswiezoneZListy = recent.refreshed, pominieteNoweTerminalne = recent.ignoredTerminal;
      let odswiezone = odswiezoneZListy;
      const doAktualizacji = selectAllegroStatusRefreshCandidates(poprzednie, { seenIds: seen, limit: Math.min(32, Math.max(8, Math.ceil(limit / 5))) });
      const batchSize = 8;
      for (let i = 0; i < doAktualizacji.length; i += batchSize) {
        const batch = doAktualizacji.slice(i, i + batchSize);
        const wyniki = await Promise.all(batch.map(async (stare) => {
          try {
            const pelne = await allegroWywolaj(req, `/order/checkout-forms/${encodeURIComponent(stare.id)}`);
            return { ...allegroScalZamowienie(pelne, stare), officialStatusCheckedAt: officialCheckedAt };
          } catch (e) {
            return { ...stare, syncError: tekst(e.message, 500), lastSyncErrorAt: new Date().toISOString() };
          }
        }));
        for (const z of wyniki) {
          mapa.set(String(z.id), z);
          if (!z.syncError) odswiezone++;
        }
      }
      let items = [...mapa.values()]
        .map((z) => allegroScalZamowienie(z, z))
        .sort((a, b) => String(b.firstFetchedAt || '').localeCompare(String(a.firstFetchedAt || '')))
        .slice(0, 5000);
      let baselineArchived = 0;
      if (baselineCreated) {
        items = items.map((z) => {
          baselineArchived++;
          const terminal = ['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(allegroStatusKolejkiZamowienia(z, {}));
          return { ...z, ...(terminal ? {} : { warehouseStage: 'zrealizowane', checkedAt: z.checkedAt || baselineAt }), baselineArchived: true, baselineArchivedAt: z.baselineArchivedAt || baselineAt, workflowUpdatedAt: z.workflowUpdatedAt || baselineAt };
        });
        noweIds.length = 0;
      }
      items = markAllegroInventoryTransitions(items, poprzedniePoId, { cutover: baselineCreated });
      let agent = { reviewed: 0, shortagesAdded: 0, supplierDocumentsChanged: 0, unresolved: 0, ready: 0 }, orderMappings = null;
      try {
        const wynikAgenta = await allegroAgentPrzetworzZamowienia(items, { newOrderIds: noweIds });
        items = wynikAgenta.items;
        agent = wynikAgenta.report;
        orderMappings = wynikAgenta.mappings;
      } catch (e) {
        agent = { ...agent, error: tekst(e.message || String(e), 500) };
      }
      const retention = await allegroOrderArchive.archive(items, { now: new Date(), retentionDays: 30 });
      items = retention.items;
      const changedOrders = countChangedAllegroOrderEvents(poprzednie, items);
      const rec = { items, updated_at: new Date().toISOString(), count: items.length, fetched: pobrane.length, imported_new: baselineCreated ? 0 : dodane, changed_orders: changedOrders, refreshed: odswiezone, refreshed_from_recent_list: odswiezoneZListy, refreshed_individually: Math.max(0, odswiezone - odswiezoneZListy), status_refresh_candidates: doAktualizacji.length, filtered: pominieteNoweTerminalne, mode: 'allegro_status_authoritative_recent_snapshot_v2', retention_days: 30, archive: retention.summary, archived_now: retention.archived, baseline_at: baselineAt, baseline_created: baselineCreated, baseline_archived: baselineArchived, agent };
      await zapisz('allegro_orders', rec);
      // Marker cutover jest commitem końcowym: awaria zapisu zamówień nie może
      // oznaczyć baseline jako zakończonego. Ponowne archiwizowanie po awarii
      // samego markera jest bezpieczne i idempotentne.
      if (baselineMarkerMissing) await zapisz('allegro_orders_baseline_v2', { baseline_at: baselineAt, reason: baselineCreated ? 'existing_orders_confirmed_handled' : 'recovered_from_orders_record', created_at: baselineAt });
      const plan = await allegroZapisStanIMozeUzgodnijPlan(items);
      if (!baselineCreated && noweIds.length) {
        agentEvents.signalAllegroOrders(noweIds)
          .catch((error) => console.error('agent_allegro_order_events', error));
      }
      return odpowiedz({ ok: true, allegro: await allegroStatus(req), orders: items, mappings: orderMappings || undefined, archive: retention.summary, archived: retention.archived, retention_days: 30, updated_at: rec.updated_at, fetched: rec.fetched, imported_new: rec.imported_new, changed_orders: rec.changed_orders, refreshed: rec.refreshed, filtered: rec.filtered, mode: rec.mode, baseline_at: rec.baseline_at, baseline_created: rec.baseline_created, baseline_archived: rec.baseline_archived, agent, ...plan });
    }

    // ─── ALLEGRO: lokalny etap obsługi zamówienia (admin) ───
    if (action === 'allegro-order-checked') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const orderIds = [...new Set((Array.isArray(body.orderIds) ? body.orderIds : [body.orderId]).map((id) => tekst(id, 100).trim()).filter(Boolean))].slice(0, 1000);
      const checked = body.checked !== false;
      const rec = await czytaj('allegro_orders', { items: [], updated_at: null });
      const items = Array.isArray(rec.items) ? rec.items : [];
      if (!orderIds.length) return odpowiedz({ ok: false, error: 'Nie wybrano zamówień Allegro', code: 'validation' }, 400);
      const wanted = new Set(orderIds);
      let changed = 0;
      const skipped = [];
      for (let index = 0; index < items.length; index++) {
        const stare = items[index];
        if (!wanted.has(String(stare?.id || ''))) continue;
        const terminal = ['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(allegroStatusKolejkiZamowienia(stare, {}));
        if (terminal) { skipped.push({ id: stare.id, reason: 'terminal_order' }); continue; }
        const warehouseStage = checked ? 'kompletacja' : 'do_sprawdzenia';
        items[index] = { ...stare, warehouseStage, checkedAt: checked ? new Date().toISOString() : null, workflowUpdatedAt: new Date().toISOString() };
        changed++;
      }
      if (!changed && skipped.length === 0) return odpowiedz({ ok: false, error: 'Nie znaleziono wybranych zamówień Allegro', code: 'not_found' }, 404);
      const zapis = { ...rec, items, updated_at: new Date().toISOString() };
      await zapisz('allegro_orders', zapis);
      const plan = await allegroZapisStanIMozeUzgodnijPlan(items);
      return odpowiedz({ ok: true, order: orderIds.length === 1 ? items.find((z) => String(z.id) === orderIds[0]) : null, orders: items, changed, skipped, ...plan, updated_at: zapis.updated_at });
    }

    if (action === 'allegro-order-warehouse-stage') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const orderIds = [...new Set((Array.isArray(body.orderIds) ? body.orderIds : [body.orderId]).map((id) => tekst(id, 100).trim()).filter(Boolean))].slice(0, 1000);
      const stage = tekst(body.stage, 40).trim().toLowerCase();
      const allowed = new Set(['do_sprawdzenia', 'braki', 'oczekuje_na_dostawe', 'kompletacja', 'spakowane', 'zrealizowane']);
      if (!orderIds.length || !allowed.has(stage)) return odpowiedz({ ok: false, error: 'Nieprawidłowe zlecenie albo etap magazynu' }, 422);
      const rec = await czytaj('allegro_orders', { items: [], updated_at: null });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const wanted = new Set(orderIds), skipped = [];
      let changed = 0;
      for (let index = 0; index < items.length; index++) {
        const current = items[index];
        if (!wanted.has(String(current?.id || ''))) continue;
        const terminal = ['SENT', 'PICKED_UP', 'CANCELLED', 'RETURNED'].includes(allegroStatusKolejkiZamowienia(current, {}));
        if (terminal) { skipped.push({ id: current.id, reason: 'terminal_order' }); continue; }
        const next = { ...current, warehouseStage: stage, warehouseStageUpdatedAt: new Date().toISOString(), workflowUpdatedAt: new Date().toISOString(), checkedAt: stage === 'do_sprawdzenia' ? null : (current.checkedAt || new Date().toISOString()) };
        items[index] = markAllegroInventoryTransition(next, current);
        changed++;
      }
      if (!changed && !skipped.length) return odpowiedz({ ok: false, error: 'Nie znaleziono wybranych zleceń Allegro' }, 404);
      const zapis = { ...rec, items, updated_at: new Date().toISOString() };
      await zapisz('allegro_orders', zapis);
      const plan = await allegroZapisStanIMozeUzgodnijPlan(items);
      return odpowiedz({ ok: true, order: orderIds.length === 1 ? items.find((z) => String(z.id) === orderIds[0]) : null, orders: items, changed, skipped, stage, ...plan, updated_at: zapis.updated_at });
    }

    // ─── ALLEGRO: zmiana statusu realizacji po stronie Allegro (admin) ───
    if (action === 'allegro-order-fulfillment') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const orderId = tekst(body.orderId, 100).trim();
      const status = tekst(body.status, 80).trim().toUpperCase();
      const dozwolone = new Set(['NEW', 'PROCESSING', 'READY_FOR_SHIPMENT', 'SENT', 'CANCELLED']);
      if (!orderId || !dozwolone.has(status)) return odpowiedz({ ok: false, error: 'Nieprawidłowy numer zamówienia lub status Allegro', code: 'validation' }, 400);
      const rec = await czytaj('allegro_orders', { items: [], updated_at: null });
      const items = Array.isArray(rec.items) ? rec.items : [];
      const index = items.findIndex((z) => String(z.id) === orderId);
      if (index < 0) return odpowiedz({ ok: false, error: 'Nie znaleziono zamówienia Allegro', code: 'not_found' }, 404);
      const stare = items[index];
      await allegroWywolaj(req, `/order/checkout-forms/${encodeURIComponent(orderId)}/fulfillment`, {
        method: 'PUT',
        parameters: stare.revision ? { 'checkoutForm.revision': stare.revision } : {},
        bodyObj: { status },
      });
      const zmienione = allegroScalZamowienie({ ...stare, fulfillmentStatus: status, rawUpdatedAt: new Date().toISOString() }, {});
      items[index] = markAllegroInventoryTransition({ ...zmienione, workflowUpdatedAt: new Date().toISOString() }, stare);
      const zapis = { ...rec, items, updated_at: new Date().toISOString() };
      await zapisz('allegro_orders', zapis);
      const plan = await allegroZapisStanIMozeUzgodnijPlan(items);
      return odpowiedz({ ok: true, order: items[index], orders: items, ...plan, updated_at: zapis.updated_at });
    }

    // ─── ALLEGRO: synchronizacja ofert (admin) ───
    if (action === 'allegro-sync-offers') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const limit = Math.min(20000, Math.max(1, Number(body.limit || url.searchParams.get('limit') || 10000)));
      const details = body.details !== false && url.searchParams.get('details') !== '0';
      const detailsLimit = details ? Math.min(limit, 1000, Math.max(1, Number(body.detailsLimit || 500))) : 0;
      const [previousOffersRec, offerSettings, previousSyncState] = await Promise.all([
        czytaj('allegro_offers', { items: [] }),
        allegroPobierzUstawieniaOfert(),
        czytaj('allegro_offer_sync_state', { lastLightSyncAt: null, lastFullSyncAt: null, lastSource: null, lastResult: null }),
      ]);
      const sourceName = tekst(body.source || 'manual', 100), scheduledLight = sourceName === 'scheduled-catalog-refresh', scheduledFull = sourceName === 'scheduled-offers-sync';
      const syncKind = scheduledFull || details ? 'full' : 'light';
      if ((scheduledLight || scheduledFull) && !allegroScheduledSyncDue(previousSyncState, offerSettings, syncKind)) {
        return odpowiedz({
          ok: true, skipped: true, reason: 'not_due', source: sourceName, count: allegroOfertyItems(previousOffersRec).length,
          offerSyncState: {
            ...previousSyncState,
            nextLightSyncAt: allegroNextScheduledSyncAt(previousSyncState, offerSettings, 'light'),
            nextFullSyncAt: allegroNextScheduledSyncAt(previousSyncState, offerSettings, 'full'),
          },
        });
      }
      const previousById = new Map(allegroOfertyItems(previousOffersRec).map((offer) => [String(offer?.id || ''), offer]));
      const source = [];
      let pages = 0;
      let totalCount = null;
      for (let offset = 0; offset < limit; offset += 1000) {
        const pageLimit = Math.min(1000, limit - offset);
        const dane = await allegroWywolaj(req, '/sale/offers', { parameters: { limit: pageLimit, offset } });
        const page = Array.isArray(dane.offers) ? dane.offers : (Array.isArray(dane.items) ? dane.items : []);
        if (Number.isFinite(Number(dane.totalCount))) totalCount = Number(dane.totalCount);
        source.push(...page);
        pages++;
        if (page.length < pageLimit || (totalCount !== null && source.length >= totalCount)) break;
      }
      const pelne = details ? await allegroPobierzSzczegolyOfert(req, source, detailsLimit) : [];
      const pelnePoId = new Map(pelne.filter((x) => x?.id).map((x) => [String(x.id), x]));
      const items = source.map((summary) => {
        const id = String(summary?.id || ''), detailedOffer = pelnePoId.get(id);
        const normalized = allegroNormalizujOferte(detailedOffer || summary);
        return allegroScalSzczegolyOferty(previousById.get(id), normalized, !!detailedOffer);
      }).filter((x) => x.id);
      const rec = { items, updated_at: new Date().toISOString(), count: items.length, totalCount: totalCount ?? items.length, pages, details, detailedCount: pelne.length, requestedLimit: limit };
      await zapisz('allegro_offers', rec);
      const mappingResult = await allegroAutoMapujOfertyZKartoteka(items);
      let maintenance = null;
      if (body.maintenance === true || body.source === 'scheduled-offers-sync') maintenance = await allegroAutoUzupelnijKatalogProduktow(req, { limit: body.maintenanceLimit || 10 });
      let compliance = null;
      if (body.source === 'scheduled-offers-sync') compliance = await allegroAudytZgodnosciOfert(req, { limit: Math.min(20, Math.max(1, Number(body.complianceLimit) || 10)), fix: true, activeOnly: true });
      const completedAt = new Date().toISOString(), offerSyncState = {
        ...previousSyncState,
        lastLightSyncAt: completedAt,
        ...(syncKind === 'full' ? { lastFullSyncAt: completedAt } : {}),
        lastSource: sourceName,
        lastResult: { offers: items.length, detailed: rec.detailedCount, autoMapped: mappingResult.autoMapped, refreshed: mappingResult.refreshed, quarantined: mappingResult.quarantined },
      };
      await zapisz('allegro_offer_sync_state', offerSyncState);
      return odpowiedz({ ok: true, allegro: await allegroStatus(req), offers: items, mappings: mappingResult.mappings, autoMapped: mappingResult.autoMapped, mappingsRefreshed: mappingResult.refreshed, mappingsQuarantined: mappingResult.quarantined, descriptionsUpdated: mappingResult.descriptionsUpdated, producersUpdated: mappingResult.producersUpdated, productsUpdated: mappingResult.productsUpdated, maintenance, compliance, offerSyncState: { ...offerSyncState, nextLightSyncAt: allegroNextScheduledSyncAt(offerSyncState, offerSettings, 'light'), nextFullSyncAt: allegroNextScheduledSyncAt(offerSyncState, offerSettings, 'full') }, updated_at: rec.updated_at, detailedCount: rec.detailedCount, requestedLimit: rec.requestedLimit, pages: rec.pages, totalCount: rec.totalCount });
    }

    if (action === 'allegro-auto-map-offers') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const [offersRec, offerSettings] = await Promise.all([
        czytaj('allegro_offers', { items: [] }),
        allegroPobierzUstawieniaOfert(),
      ]);
      if (offerSettings.autoMapping === false) return odpowiedz({ ok: true, skipped: true, reason: 'disabled', mappings: allegroMapowaniaItems(await czytaj('allegro_mappings', { items: {} })), settings: offerSettings });
      const mapping = await allegroAutoMapujOfertyZKartoteka(allegroOfertyItems(offersRec));
      const workflow = mapping.autoMapped || mapping.quarantined ? await allegroPrzeliczZamowieniaPoMapowaniu() : {};
      return odpowiedz({ ok: true, ...mapping, settings: offerSettings, ...workflow });
    }

    if (action === 'allegro-auto-maintenance') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      // Publikacja konkretnych opisów nie wymaga ponownego mapowania całych
      // 10 000 ofert. Pełne mapowanie w tym miejscu blokowało cykl aż do timeoutu.
      const targetedPublication = body.pendingOnly === true && Array.isArray(body.productIds) && body.productIds.length > 0;
      let mapping = { skipped: true, reason: 'targeted_publication' };
      if (!targetedPublication) {
        const offersRec = await czytaj('allegro_offers', { items: [] });
        mapping = await allegroAutoMapujOfertyZKartoteka(allegroOfertyItems(offersRec));
      }
      const maintenance = await allegroAutoUzupelnijKatalogProduktow(req, { limit: Math.min(50, Math.max(1, Number(body.limit) || 20)), pendingOnly: body.pendingOnly === true, productIds: Array.isArray(body.productIds) ? body.productIds.slice(0, 50) : [] });
      return odpowiedz({ ok: true, mapping, maintenance });
    }

    if (action === 'allegro-apply-offer-defaults') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const offerSettings = await allegroPobierzUstawieniaOfert();
      const targetStock = offerSettings.defaultStock;
      const offerIds = [...new Set((Array.isArray(body.offerIds) ? body.offerIds : []).map((x) => tekst(x, 100).trim()).filter(Boolean))].slice(0, 50);
      if (!offerIds.length) return odpowiedz({ ok: false, error: 'Podaj identyfikatory ofert Allegro' }, 422);
      const results = [];
      for (let i = 0; i < offerIds.length; i += 10) {
        const batch = offerIds.slice(i, i + 10);
        const settled = await Promise.allSettled(batch.map(async (offerId) => {
          const stockMeta = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, {
            method: 'PATCH', bodyObj: { stock: { available: targetStock } }, withMeta: true,
          });
          try {
            const republishMeta = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, {
              method: 'PATCH', bodyObj: { publication: { republish: true } }, withMeta: true,
            });
            return { offerId, stockUpdated: true, republishUpdated: true, status: republishMeta.status, location: republishMeta.location || stockMeta.location || '' };
          } catch (e) {
            return { offerId, stockUpdated: true, republishUpdated: false, status: e.status || 422, code: tekst(e.code || '', 120), republishError: tekst(e.message || e, 700) };
          }
        }));
        settled.forEach((item, index) => results.push(item.status === 'fulfilled' ? { ok: true, ...item.value } : { ok: false, stockUpdated: false, republishUpdated: false, offerId: batch[index], error: tekst(item.reason?.message || item.reason, 700), code: tekst(item.reason?.code || '', 120), status: item.reason?.status || 500 }));
      }
      const now = new Date().toISOString();
      const auditRec = await czytaj('allegro_offer_defaults_audit', { items: {}, updated_at: null });
      const auditItems = auditRec.items && typeof auditRec.items === 'object' ? { ...auditRec.items } : {};
      for (const result of results) auditItems[result.offerId] = { offerId: result.offerId, stock: targetStock, stockUpdated: !!result.stockUpdated, republishUpdated: !!result.republishUpdated, error: tekst(result.republishError || result.error || '', 700), code: tekst(result.code || '', 120), status: result.status || 0, updatedAt: now };
      await zapisz('allegro_offer_defaults_audit', { items: auditItems, updated_at: now });
      return odpowiedz({ ok: true, stock: targetStock, republish: true, requested: offerIds.length, stockUpdated: results.filter((x) => x.stockUpdated).length, stockFailed: results.filter((x) => !x.stockUpdated).length, republishUpdated: results.filter((x) => x.republishUpdated).length, republishFailed: results.filter((x) => !x.republishUpdated).length, auditOpen: Object.values(auditItems).filter((x) => !x.stockUpdated || !x.republishUpdated).length, results });
    }

    const allegroCommunicationsResponse = await allegroCommunicationsRoute(req, url, action);
    if (allegroCommunicationsResponse) return allegroCommunicationsResponse;
    // ─── ALLEGRO: szkic i wystawienie produktu sklepu jako oferty ───
    if (action === 'allegro-offer-support') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const categoryId = tekst(url.searchParams.get('categoryId') || '', 80).trim();
      const offerSettings = await allegroPobierzUstawieniaOfert();
      const [salesConditions, categoryParameters] = await Promise.all([
        allegroWarunkiSprzedazy(req, {
          shippingRateId: offerSettings.shippingRateId,
          returnPolicyId: offerSettings.returnPolicyId,
          impliedWarrantyId: offerSettings.impliedWarrantyId,
          warrantyId: offerSettings.warrantyId,
        }),
        allegroParametryKategorii(req, categoryId),
      ]);
      return odpowiedz({ ok: true, salesConditions, categoryParameters: categoryParameters.parameters, errors: [...(salesConditions.errors || []), ...(categoryParameters.errors || [])] });
    }

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
      const relatedProducts = await allegroAgentProduktyKompletne();
      const consensus = allegroCategoryConsensus(body.product || {}, relatedProducts);
      const result = await allegroSugerujKategorie(req, body.product || {}, { phrase: body.phrase, limit: body.limit || 10 });
      const selected = allegroCategorySuggestedSelection(consensus, result.selected, Boolean(body.phrase));
      return odpowiedz({ ok: true, ...result, selected, consensus });
    }

    if (action === 'allegro-category-parameters') {
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const categoryId = tekst(url.searchParams.get('categoryId') || url.searchParams.get('id') || '', 80).trim();
      if (!categoryId) return odpowiedz({ ok: false, error: 'Podaj categoryId' }, 422);
      const raw = await allegroWywolaj(req, `/sale/categories/${encodeURIComponent(categoryId)}/parameters`);
      return odpowiedz({ ok: true, categoryId, parameters: raw.parameters || [], raw });
    }

    const allegroPreparationResponse = await allegroPreparationRoute(req, url, action);
    if (allegroPreparationResponse) return allegroPreparationResponse;

    if (action === 'allegro-offer-draft') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const draft = await allegroDraftZAutoKategoria(req, body.product || {}, body.options || {});
      const compliance = allegroEnforceDraft(draft.payload || {}), identityCheck = await allegroZweryfikujTozsamoscPublikacji(req, body.product || {}, compliance.draft, draft);
      const missing = [...new Set([
        ...draft.missing,
        ...(compliance.compliance.ok ? [] : ['opis niezgodny z zasadami Allegro']),
        ...(identityCheck.ok ? [] : [identityCheck.reason]),
      ].filter(Boolean))];
      const ready = (!!draft.existingOffer || missing.length === 0) && compliance.compliance.ok && identityCheck.ok;
      const prepared = { ...draft, payload: compliance.draft, missing, compliance: compliance.compliance };
      const agentTask = missing.length ? await allegroZapiszZadanieAgentaOferty(body.product || {}, { missing, prepared, draft: compliance.draft, errors: identityCheck.ok ? [] : [{ code: identityCheck.code, message: identityCheck.reason }] }) : null;
      return odpowiedz({ ok: true, draft: compliance.draft, missing, ready, categorySuggestion: draft.categorySuggestion, salesConditions: draft.salesConditions, categoryParameters: draft.categoryParameters, requiredParameters: draft.requiredParameters, catalogMatch: draft.catalogMatch, supportErrors: draft.supportErrors, existingOffer: draft.existingOffer, similarOffers: draft.similarOffers, improvedDescriptions: draft.improvedDescriptions, compliance: compliance.compliance, identityCheck, publicationReadiness: draft.publicationReadiness, autoFilled: draft.autoFilled, agentDecision: draft.agentDecision, agentProcedure: ALLEGRO_AGENT_OFFER_PROCEDURE, operation: draft.existingOffer ? 'update' : 'create', agentTask });
    }

    if (action === 'allegro-description-improve') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const sourceProduct = body.product || {};
      const editorial = await prepareLinkedProductEditorial(sourceProduct, { sourceUrl: sourceProduct.sourceUrl || sourceProduct.producentUrl, runSpecialist: agentSpecialists.run, actor: requestSession(req) || { source: 'product-editorial' } });
      const product = editorial.product;
      const offersRec = await czytaj('allegro_offers', { items: [] });
      const similarOffers = allegroPodobneOferty(product, offersRec, 5);
      const shortDescription = allegroOpisKrotki(product, similarOffers);
      const sections = allegroSekcjeOpisu(product, shortDescription);
      const allegroDescription = allegroOpisPelnyTekst(product, shortDescription);
      return odpowiedz({
        ok: true,
        name: product.nazwa || '',
        shortDescription: product.opisKrotki || shortDescription,
        fullDescription: product.opis || '',
        allegroTitle: product.allegroTitle || allegroOfferTitle(product),
        allegroDescription: allegroDescription || product.allegroDescription || shortDescription,
        sections,
        contentEditorial: product.contentEditorial,
        editorial: { status: editorial.status, sourceRole: 'facts_only', warnings: editorial.warnings },
        compliance: allegroEnforceDraft({ name: product.nazwa || product.name || 'Produkt', description: { sections } }).compliance,
        similarOffers: similarOffers.map((x) => ({ id: x.offer?.id, name: x.offer?.name, score: Number(x.score.toFixed(2)) })),
      });
    }

    if (action === 'allegro-create-product-offer') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const saleSettings = await czytaj('settings', { data: {} }), saleData = saleSettings?.data && typeof saleSettings.data === 'object' ? saleSettings.data : {};
      const saleProductId = tekst(body.product?.id || '', 100).trim(), saleRecord = saleData.artway_dostepnosc?.[saleProductId] || {};
      const authoritativeProducts = await allegroAgentProduktyKompletne(saleData);
      const authoritativeProduct = authoritativeProducts.get(saleProductId) || {};
      const publicationProduct = { ...(body.product || {}), ...authoritativeProduct, id: saleProductId };
      const saleDecision = String(saleRecord.decision || '').toLowerCase(), graceUntil = Date.parse(String(saleRecord.expiresAt || ''));
      const unavailableByRecord = saleDecision === 'manual_available' ? false : saleDecision === 'grace' ? (!Number.isFinite(graceUntil) || graceUntil <= Date.now()) : ['niedostepny', 'ukryty', 'wstrzymany', 'brak'].includes(String(saleRecord.status || saleDecision).toLowerCase());
      const unavailableByProduct = [publicationProduct].some((product) => product.sprzedazAktywna === false || product.saleAvailable === false || product.dostepny === false || product.aktywny === false || product.ukryty === true || product?._catalog?.availability?.saleAvailable === false);
      if (unavailableByRecord || unavailableByProduct) return odpowiedz({ ok: false, error: 'Produkt jest ukryty lub niedostępny. Najpierw wznów sprzedaż w kartotece.', code: 'product_sale_unavailable', productId: saleProductId }, 409);
      const approval = body.approval && typeof body.approval === 'object' ? body.approval : null;
      const requestProductId = saleProductId;
      const approvalHandle = allegroOperationReceipts.validate({ approval, productId: requestProductId });
      const approvalOperationId = approvalHandle?.operationId || '';
      const offerSettings = await allegroPobierzUstawieniaOfert();
      const mappedOfferId = tekst(body.mappedOfferId, 100).trim();
      let mappedExisting = null;
      if (mappedOfferId) {
        const offersRec = await czytaj('allegro_offers', { items: [] });
        const exactOffer = allegroOfertyItems(offersRec).find((x) => String(x.id) === mappedOfferId);
        if (!exactOffer) return odpowiedz({ ok: false, error: 'Nie znaleziono ręcznie wskazanej oferty Allegro', code: 'mapped_offer_not_found' }, 404);
        mappedExisting = { offer: exactOffer, score: 100, reason: 'ręczna decyzja administratora' };
      }
      let categorySuggestion = null;
      let prepared = await allegroDraftZAutoKategoria(req, publicationProduct, body.options || {});
      if (mappedExisting) prepared.existingOffer = mappedExisting;
      categorySuggestion = prepared.categorySuggestion;
      let draft = prepared.payload;
      const agentTask = prepared.missing.length ? await allegroZapiszZadanieAgentaOferty(publicationProduct, { missing: prepared.missing, prepared, draft }) : null;
      if (prepared.missing.length && !prepared.existingOffer) {
        return odpowiedz({ ok: false, error: `Szkic wymaga uzupełnienia: ${prepared.missing.join(', ')}`, missing: prepared.missing, draft, categorySuggestion, salesConditions: prepared.salesConditions, categoryParameters: prepared.categoryParameters, requiredParameters: prepared.requiredParameters, catalogMatch: prepared.catalogMatch, autoFilled: prepared.autoFilled, supportErrors: prepared.supportErrors, agentDecision: prepared.agentDecision, agentProcedure: ALLEGRO_AGENT_OFFER_PROCEDURE, agentTask }, 422);
      }
      let existing = prepared.existingOffer;
      let complianceGate = allegroEnforceDraft(draft || {});
      draft = complianceGate.draft;
      if (!complianceGate.compliance.ok) {
        return odpowiedz({ ok: false, error: 'Publikacja została zablokowana: opis nadal zawiera treść niezgodną z zasadami Allegro.', code: 'allegro_compliance_block', compliance: complianceGate.compliance, draft }, 422);
      }
      let identityCheck = await allegroZweryfikujTozsamoscPublikacji(req, publicationProduct, draft, prepared, { manualOffer: !!mappedExisting });
      if (!identityCheck.ok) {
        const agentTask = await allegroZapiszZadanieAgentaOferty(publicationProduct, {
          missing: ['jednoznaczna tożsamość produktu Allegro'],
          errors: [{ code: identityCheck.code, message: identityCheck.reason }],
          prepared, operationId: approvalOperationId,
          draft,
        });
        return odpowiedz({ ok: false, error: identityCheck.reason, code: identityCheck.code, identityCheck, draft, catalogMatch: prepared?.catalogMatch || null, agentTask }, 422);
      }
      const receiptStart = await allegroOperationReceipts.begin(approvalHandle, { action: approval?.action || body.options?.publicationAction || 'keep', approvedBy: (requestSession(req) || {})?.email || 'administrator' });
      if (receiptStart.kind === 'duplicate') return odpowiedz(receiptStart.response, receiptStart.httpStatus);
      let result, responseMeta = null, operationCheck = { completed: true, checks: 0 }, catalogRecovery = null, imagePublication = null;
      try {
        imagePublication = await prepareAllegroOfferImagesForPublication({
          req, draft, existingOfferId: existing?.offer?.id, publish: allegroPublikujZdjecia,
        });
        const execution = await executeAllegroOfferWriteWithRecovery({
          draft, prepared, existing,
          send: async (outgoing, found) => {
            const meta = found?.offer?.id
              ? await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(found.offer.id)}`, { method: 'PATCH', bodyObj: allegroPatchZDraftu(outgoing, body.options || {}), withMeta: true })
              : await allegroWywolaj(req, '/sale/product-offers', { method: 'POST', bodyObj: outgoing, withMeta: true });
            const check = await allegroCzekajNaOperacjeOferty(req, meta?.location || '');
            return { responseMeta: meta, operationCheck: check, result: check.result?.id ? check.result : (meta?.data || {}) };
          },
          loadCatalog: (productId) => allegroPobierzProduktKataloguPoId(req, publicationProduct, productId),
          prepareRecovery: async ({ hint, catalog, decision }) => {
            const rejected = new Set(hint.parameterIds || []), recoveryProduct = { ...publicationProduct, allegroCategoryId: decision.categoryId, ...(rejected.size ? { allegroParameters: (publicationProduct.allegroParameters || []).filter((param) => !rejected.has(String(param?.id || ''))) } : {}) };
            const next = await allegroDraftZAutoKategoria(req, recoveryProduct, { ...(body.options || {}), categoryId: decision.categoryId, ...(catalog ? { catalogProductId: decision.productId, catalogIdentityVerified: true, catalogMatchOverride: { selected: catalog, searchedBy: 'metadata błędu Allegro' } } : {}) });
            const gate = allegroEnforceDraft(next.payload || {}), check = await allegroZweryfikujTozsamoscPublikacji(req, publicationProduct, gate.draft, next);
            return { draft: gate.draft, prepared: next, existing: next.existingOffer, identityCheck: check, ready: !next.missing.length && gate.compliance.ok && check.ok, missing: [...next.missing, ...(check.ok ? [] : [check.reason])] };
          },
        });
        ({ result, responseMeta, operationCheck, prepared, draft, existing, catalogRecovery } = execution);
        if (execution.identityCheck) identityCheck = execution.identityCheck;
        complianceGate = allegroEnforceDraft(draft);
        categorySuggestion = prepared.categorySuggestion;
      } catch (e) {
        e.draft = draft;
        e.missing = prepared?.missing || [];
        e.categorySuggestion = categorySuggestion;
        e.requiredParameters = prepared?.requiredParameters || [];
        e.catalogMatch = prepared?.catalogMatch || null;
        e.catalogRecovery = e.catalogRecovery || catalogRecovery;
        e.agentTask = await allegroZapiszZadanieAgentaOferty(publicationProduct, { operationId: approvalOperationId, missing: prepared?.missing || [], errors: e.allegro?.errors || [{ code: e.code, message: e.message }], prepared, draft });
        await zapisz('allegro_offer_last_error', { at: new Date().toISOString(), productId: saleProductId, productName: tekst(publicationProduct.nazwa || publicationProduct.name, 300), message: tekst(e.message, 1000), status: e.status || 500, code: e.code || '', errors: Array.isArray(e.allegro?.errors) ? e.allegro.errors.slice(0, 20) : [], missing: prepared?.missing || [], requiredParameters: prepared?.requiredParameters || [], catalogMatch: prepared?.catalogMatch || null });
        await allegroOperationReceipts.fail(approvalHandle, e);
        throw e;
      }
      const locationOfferId = String(responseMeta?.location || '').match(/\/sale\/product-offers\/([^/?]+)/)?.[1] || '';
      const offerId = tekst(result?.id || existing?.offer?.id || locationOfferId, 100);
      if (!offerId) {
        const e = new Error('Allegro przyjęło operację, ale nie zwróciło identyfikatora oferty. Zadanie zapisano dla Agenta AI.');
        e.status = 502; e.code = 'allegro_missing_offer_id'; e.draft = draft; e.categorySuggestion = categorySuggestion; e.catalogMatch = prepared?.catalogMatch || null;
        e.agentTask = await allegroZapiszZadanieAgentaOferty(publicationProduct, { operationId: approvalOperationId, errors: [{ code: e.code, message: e.message }], prepared, draft });
        await allegroOperationReceipts.fail(approvalHandle, e);
        throw e;
      }
      let verifiedOffer = null, publicationWait = null;
      try {
        const publicationAction = String(body.options?.publicationAction || '').toLowerCase();
        const expectedStatus = publicationAction === 'activate' ? 'ACTIVE' : publicationAction === 'deactivate' ? 'INACTIVE' : '';
        if (expectedStatus) {
          publicationWait = await allegroCzekajNaStatusOferty(req, offerId, expectedStatus);
          verifiedOffer = publicationWait.offer;
        } else verifiedOffer = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`);
        if (verifiedOffer?.id) result = verifiedOffer;
      } catch {}
      await zapisz('allegro_offer_last_error', null);
      if (offerId) {
        const offersRec = await czytaj('allegro_offers', { items: [] });
        const normalized = allegroNormalizujOferte({ ...(existing?.offer || {}), ...draft, ...(result || {}), id: offerId });
        const items = allegroOfertyItems(offersRec).filter((x) => String(x.id) !== offerId);
        items.unshift(normalized);
        await zapisz('allegro_offers', { ...offersRec, items: items.slice(0, 20000), updated_at: new Date().toISOString(), count: Math.min(20000, items.length), totalCount: Math.max(Number(offersRec.totalCount || 0), items.length) });
        const productId = saleProductId;
        if (productId) {
          const mappingRec = await czytaj('allegro_mappings', { items: {} });
          const mappings = { ...allegroMapowaniaItems(mappingRec) };
          const link = allegroDanePowiazaniaZPrzygotowania(publicationProduct, prepared, draft);
          const now = new Date().toISOString(), settingsRec = await czytaj('settings', { data: {}, rev: 0, updated_at: null }), settingsData = settingsRec.data && typeof settingsRec.data === 'object' ? settingsRec.data : {};
          const products = await allegroAgentProduktyKompletne(settingsData), centralProduct = products.get(productId) || publicationProduct;
          const currentOffer = { ...normalized, ...(result || {}), id: offerId, productId: link.catalogProductId || normalized.productId, categoryId: link.categoryId || normalized.categoryId };
          const validation = allegroOcenaPowiazania(centralProduct, currentOffer);
          const canonicalLink = linkCanonicalAllegroMapping({ mappings, offers: [currentOffer, ...items], products, offer: currentOffer, product: centralProduct, validation, operator: mappedOfferId ? 'admin-manual-decision' : 'auto-offer-save', now });
          canonicalLink.mappings[offerId] = markAllegroMappingSynced({ ...canonicalLink.mappings[offerId], allegroProductId: link.catalogProductId, categoryId: link.categoryId, productSnapshot: mappingProductSnapshot(centralProduct, settingsData) }, centralProduct, now);
          const changedMappingIds = Object.keys(canonicalLink.mappings).filter((id) => JSON.stringify(mappings[id] ?? null) !== JSON.stringify(canonicalLink.mappings[id] ?? null));
          await zapiszMapowaniaBezpiecznie(mappings, canonicalLink.mappings, now, { forceKeys: changedMappingIds });
          await allegroZapiszPowiazanieProduktu(publicationProduct, {
            offerId,
            prepared,
            draft,
            offer: result || normalized,
            verifiedOffer,
            imagePublication,
            expectedStatus: String(body.options?.publicationAction || '').toLowerCase() === 'activate' ? 'ACTIVE' : '',
          });
        }
      }
      const responseBody = { ok: true, offer: { ...(existing?.offer || {}), ...(result || {}), id: offerId }, mode: existing ? 'updated' : 'created', duplicatePrevented: !!existing, match: existing ? { score: existing.score, reason: existing.reason } : null, identityCheck, catalogRecovery, catalogMatch: prepared.catalogMatch || null, autoFilled: prepared.autoFilled || null, improvedDescriptions: prepared.improvedDescriptions || null, imagePublication, compliance: complianceGate.compliance, verification: { ...allegroOfferVerification(result, !!verifiedOffer), publicationConfirmed: publicationWait?.completed !== false, publicationChecks: publicationWait?.checks || 0 }, agentDecision: prepared.agentDecision || null, agentProcedure: ALLEGRO_AGENT_OFFER_PROCEDURE, warnings: Array.isArray(result?.warnings) ? result.warnings : [], operation: { id: approvalOperationId, status: responseMeta?.status || 200, location: responseMeta?.location || '', completed: operationCheck.completed || publicationWait?.completed === true, checks: operationCheck.checks || 0 }, allegro: await allegroStatus(req), categorySuggestion };
      await allegroOperationReceipts.complete(approvalHandle, { offerId, httpStatus: existing ? 200 : 201, response: responseBody });
      return odpowiedz(responseBody, existing ? 200 : 201);
    }

    // ─── ALLEGRO: kalkulator prowizji i opłat dla konkretnej oferty / produktu ───
    if (action === 'allegro-fee-preview') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const product = body.product && typeof body.product === 'object' ? body.product : {};
      const productId = tekst(body.productId || product.id, 100).trim();
      const offerId = tekst(body.offerId || product.allegroOfferId, 100).trim();
      const price = Math.max(0, Number(body.price ?? product.cenaAllegro ?? product.allegroPrice ?? product.cena ?? product.price) || 0);
      if (!price) return odpowiedz({ ok: false, error: 'Podaj cenę Allegro większą od zera', code: 'price_required' }, 422);
      let offer, prepared = null;
      if (offerId) offer = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`);
      else {
        prepared = await allegroDraftZAutoKategoria(req, { ...product, cenaAllegro: price }, { publishNow: false });
        if (!prepared?.payload || prepared.missing?.length) return odpowiedz({ ok: false, error: `Nie można policzyć opłat — uzupełnij: ${(prepared?.missing || ['pełne dane oferty']).join(', ')}`, code: 'incomplete_offer', missing: prepared?.missing || [] }, 422);
        offer = prepared.payload;
      }
      offer = JSON.parse(JSON.stringify(offer || {}));
      offer.sellingMode = offer.sellingMode || { format: 'BUY_NOW' };
      offer.sellingMode.price = { amount: price.toFixed(2), currency: 'PLN' };
      const preview = await allegroWywolaj(req, '/pricing/offer-fee-preview', { method: 'POST', bodyObj: { offer, marketplaceId: 'allegro-pl' } });
      const summary = allegroPodsumujKalkulacjeOplat(preview, price);
      let saved = false;
      if (body.save !== false && productId) {
        await zapiszIOpublikujPolaProduktuCentralnie({
          productId,
          fields: {
            allegroCommissionAmount: summary.commissionAmount,
            allegroCommissionRate: summary.commissionRate,
            allegroRecurringFees: summary.recurringFees,
            allegroFeeTotal: summary.totalPreviewFees,
            allegroFeePrice: summary.salePrice,
            allegroFeeCurrency: summary.currency,
            allegroFeeDetails: { commissions: summary.commissions, quotes: summary.quotes },
            allegroFeeCalculatedAt: summary.calculatedAt,
            allegroFeeSource: summary.source,
            ...(offerId ? { allegroOfferId: offerId } : {}),
          },
          mutationId: `allegro-fee:${productId}:${summary.calculatedAt}`,
          actor: 'allegro-api',
          area: 'allegro-fee-preview',
        });
        const auditRec = await czytaj('allegro_fee_preview_audit', { items: [], updated_at: null });
        const audit = Array.isArray(auditRec.items) ? [...auditRec.items] : [];
        audit.unshift({ id: crypto.randomUUID(), productId, offerId, ...summary });
        await zapisz('allegro_fee_preview_audit', { items: audit.slice(0, 5000), updated_at: summary.calculatedAt });
        saved = true;
      }
      return odpowiedz({ ok: true, productId, offerId, summary, raw: preview, saved, prepared: prepared ? { missing: prepared.missing || [], categoryId: prepared.autoFilled?.allegroCategoryId || '', catalogProductId: prepared.autoFilled?.allegroProductId || '' } : null });
    }

    if (action === 'allegro-offer-price-change') {
      if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
      if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
      const body = await req.json().catch(() => ({}));
      const offerIds = [...new Set((Array.isArray(body.offerIds) ? body.offerIds : []).map((x) => tekst(x, 100).trim()).filter(Boolean))].slice(0, 1000);
      const mode = String(body.mode || 'percent').toLowerCase();
      const value = Number(String(body.value ?? '').replace(',', '.'));
      if (!offerIds.length) return odpowiedz({ ok: false, error: 'Zaznacz co najmniej jedną ofertę Allegro' }, 422);
      if (!Number.isFinite(value) || value === 0) return odpowiedz({ ok: false, error: 'Podaj prawidłową wartość zmiany ceny' }, 422);
      let modification;
      if (mode === 'percent') modification = { type: value > 0 ? 'INCREASE_PERCENTAGE' : 'DECREASE_PERCENTAGE', marketplaceId: 'allegro-pl', percentage: Math.abs(value) };
      else if (mode === 'fixed') {
        if (value <= 0) return odpowiedz({ ok: false, error: 'Cena docelowa musi być większa od zera' }, 422);
        modification = { type: 'FIXED_PRICE', marketplaceId: 'allegro-pl', price: { amount: value.toFixed(2), currency: 'PLN' } };
      } else modification = { type: value > 0 ? 'INCREASE_PRICE' : 'DECREASE_PRICE', marketplaceId: 'allegro-pl', value: { amount: Math.abs(value).toFixed(2), currency: 'PLN' } };
      const commandId = crypto.randomUUID();
      const command = await allegroWywolaj(req, `/sale/offer-price-change-commands/${commandId}`, {
        method: 'PUT',
        bodyObj: { modification, offerCriteria: [{ type: 'CONTAINS_OFFERS', offers: offerIds.map((id) => ({ id })) }] },
      });
      return odpowiedz({ ok: true, commandId, command, modification, offerCount: offerIds.length }, 202);
    }

    const productLinkImportResponse = await productLinkImport.route(req, url, action);
    if (productLinkImportResponse) return productLinkImportResponse;
    const productAvailabilityResponse = await productAvailabilityRoute(req, url, action);
    if (productAvailabilityResponse) return productAvailabilityResponse;

    const allegroMappingResponse = await allegroMappingRoute(req, url, action);
    if (allegroMappingResponse) return allegroMappingResponse;

    const inpostResponse = await inpostRoute(req, url, action);
    if (inpostResponse) {
      if (action === 'inpost-test' && inpostResponse.status < 400) { const inpostChecks = [{ source: 'backend:inpost-test', route: url.pathname }, { source: 'autotest:Integracje', messageIncludes: 'InPost ShipX API' }]; await systemDiagnostics.resolveMatching(inpostChecks, { actor: requestSession(req)?.email || 'automatyczny test InPost', resolution: 'Ponowny test serwerowy potwierdził token, organizację i dostępność API InPost ShipX.' }).catch(() => {}); }
      return inpostResponse;
    }
    const inpostServiceShipmentResponse = await inpostServiceShipmentRoute(req, url, action);
    if (inpostServiceShipmentResponse) return inpostServiceShipmentResponse;
    const vonHalskyResponse = await vonHalskyRoute(req, url, action);
    if (vonHalskyResponse) return vonHalskyResponse;

    // ─── CENTRALNA KARTOTEKA PRODUKTÓW (PostgreSQL, stronicowanie serwerowe) ───
    const centralCatalogResponse = await centralProductCatalogRoute(req, url, action);
    if (centralCatalogResponse) return centralCatalogResponse;

    const storeDataResponse = await storeDataRoute(req, url, action);
    if (storeDataResponse) return storeDataResponse;

    return odpowiedz({ ok: false, error: 'Nieznana akcja: ' + action }, 404);
  } catch (e) {
    const status = Number(e?.status) >= 400 && Number(e?.status) < 600 ? Number(e.status) : 500;
    if (status >= 500) {
      await systemDiagnostics.record([{
        level: e?.transient ? 'ostrzezenie' : 'blad',
        message: `${e?.code || 'server_error'}: ${e?.message || String(e)}`,
        source: `backend:${action}`,
        route: url.pathname,
        release: process.env.ARTWAY_RELEASE_ID || '',
        kind: 'backend',
      }], { trusted: true }).catch(() => {});
    }
    const body = {
      ok: false,
      error: e && e.message ? e.message : String(e),
      code: e?.code || (status === 500 ? 'server_error' : 'request_error'),
    };
    if (Array.isArray(e?.missingEnv)) body.missingEnv = e.missingEnv;
    if (e?.inpost?.details) body.details = e.inpost.details;
    if (e?.allegro) body.allegroError = e.allegro;
    if (e?.draft) body.draft = e.draft;
    if (e?.categorySuggestion) body.categorySuggestion = e.categorySuggestion;
    if (e?.salesConditions) body.salesConditions = e.salesConditions;
    if (e?.categoryParameters) body.categoryParameters = e.categoryParameters;
    if (e?.requiredParameters) body.requiredParameters = e.requiredParameters;
    if (e?.catalogMatch) body.catalogMatch = e.catalogMatch;
    if (e?.catalogRecovery) body.catalogRecovery = e.catalogRecovery;
    if (e?.supportErrors) body.supportErrors = e.supportErrors;
    if (e?.agentTask) body.agentTask = e.agentTask;
    if (e?.linkDiagnostics) body.linkDiagnostics = e.linkDiagnostics;
    return odpowiedz(body, status);
  }
};
