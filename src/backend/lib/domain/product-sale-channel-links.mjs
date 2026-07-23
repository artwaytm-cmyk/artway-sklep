import { allegroOfferGtinCandidates } from './allegro-offer-identifiers.mjs';
import { canonicalGtin } from './product-identifiers.mjs';
import { scoreAllegroProductMapping } from './allegro-product-mapping.mjs';

const normalize = (value = '') => String(value ?? '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const values = (input) => Array.isArray(input) ? input.flat(Infinity) : [input];

function productGtins(product = {}) {
  return [...new Set(values([
    product.gtin, product.ean, product.GTIN, product.EAN, product.canonicalGtins, product.gtins,
    product.parametryProducenta?.ean, product.parametryProducenta?.gtin,
    product.parametryZrodla?.ean, product.parametryZrodla?.gtin,
  ]).map(canonicalGtin).filter(Boolean))];
}

function addIndex(index, key, productId) {
  if (!key || !productId) return;
  const found = index.get(key) || new Set();
  found.add(String(productId));
  index.set(key, found);
}

function addLink(links, productId, offerId, source = 'mapping') {
  const pid = String(productId ?? '').trim(), oid = String(offerId ?? '').trim();
  if (!pid || !oid) return;
  const found = links.get(pid) || new Map();
  found.set(oid, source);
  links.set(pid, found);
}

/**
 * Buduje jednoznaczny indeks kartoteka -> oferty. Najpierw respektuje zapisane
 * mapowanie administratora, a brakujące powiązania uzupełnia wyłącznie przy
 * mocnym i jednoznacznym identyfikatorze (EAN, UUID katalogu, external.id,
 * kod producenta lub zapisane ID oferty). Sama podobna nazwa nigdy nie steruje
 * automatycznym wstrzymaniem sprzedaży.
 */
export function buildProductSaleChannelLinks({ products = [], offers = [], mappings = {} } = {}) {
  const productList = products instanceof Map ? [...products.values()] : (Array.isArray(products) ? products : []);
  const offerList = Array.isArray(offers) ? offers : (Array.isArray(offers?.items) ? offers.items : []);
  const mappingItems = mappings?.items && typeof mappings.items === 'object' ? mappings.items : (mappings || {});
  const productById = new Map(productList.map((product) => [String(product?.id ?? '').trim(), product]).filter(([id]) => id));
  const links = new Map(), blockedOfferIds = new Set(), indexes = { catalog: new Map(), external: new Map(), code: new Map(), gtin: new Map() };
  for (const [key, raw] of Object.entries(mappingItems)) if (raw?.blocked === true || raw?.quarantined === true) blockedOfferIds.add(String(raw?.offerId || key || '').trim());

  for (const product of productList) {
    const productId = String(product?.id ?? '').trim();
    if (!productId) continue;
    if (!blockedOfferIds.has(String(product.allegroOfferId || '').trim())) addLink(links, productId, product.allegroOfferId, 'saved-offer-id');
    addIndex(indexes.catalog, String(product.allegroProductId || '').trim(), productId);
    addIndex(indexes.external, normalize(product.externalId || product.sku), productId);
    addIndex(indexes.code, normalize(product.kodProducenta || product.mpn), productId);
    productGtins(product).forEach((gtin) => addIndex(indexes.gtin, gtin, productId));
  }

  for (const [key, raw] of Object.entries(mappingItems)) {
    if (raw?.blocked === true || raw?.quarantined === true) { blockedOfferIds.add(String(raw?.offerId || key || '').trim());continue; }
    const productId = String(raw?.productId ?? raw?.produktId ?? raw?.id ?? (typeof raw === 'object' ? '' : raw) ?? '').trim();
    const offerId = String(raw?.offerId || key || '').trim();
    if (productById.has(productId)) addLink(links, productId, offerId, 'mapping');
  }

  for (const offer of offerList) {
    const offerId = String(offer?.id || '').trim();
    if (!offerId || blockedOfferIds.has(offerId)) continue;
    const candidateIds = new Set();
    const collect = (index, key) => { for (const id of index.get(key) || []) candidateIds.add(id); };
    collect(indexes.catalog, String(offer.productId || '').trim());
    collect(indexes.external, normalize(offer.externalId || offer.sku));
    collect(indexes.code, normalize(offer.manufacturerCode || offer.producerCode));
    allegroOfferGtinCandidates(offer).forEach(({ canonical }) => collect(indexes.gtin, canonical));
    const ranked = [...candidateIds].map((productId) => {
      const product = productById.get(productId), validation = scoreAllegroProductMapping(product, offer);
      return { productId, validation };
    }).filter(({ validation }) => validation.valid && validation.score >= 95)
      .sort((left, right) => right.validation.score - left.validation.score || left.productId.localeCompare(right.productId));
    if (!ranked.length) continue;
    const best = ranked[0], second = ranked[1];
    if (second && second.validation.score === best.validation.score) continue;
    addLink(links, best.productId, offerId, `strong-identity:${best.validation.reason}`);
  }

  return new Map([...links].map(([productId, offerMap]) => [productId, [...offerMap].map(([offerId, source]) => ({ offerId, source }))]));
}

export function createProductSaleChannelSynchronizer(dependencies = {}) {
  const {
    read: czytaj, write: zapisz, getProducts: allegroAgentProduktyCentralne,
    getMappings: allegroMapowaniaItems, getOffers: allegroOfertyItems,
    getOfferSettings: allegroPobierzUstawieniaOfert, callAllegro: allegroWywolaj,
    waitForOperation: allegroCzekajNaOperacjeOferty, text: tekst,
  } = dependencies;
async function allegroZmienPublikacjeDostepnosci(req, offerId, { status, stock, unit = 'UNIT' } = {}) {
  const meta = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`, {
    method: 'PATCH', bodyObj: { stock: { available: Math.max(0, Number(stock) || 0), unit: unit || 'UNIT' }, publication: { status, republish: true } }, withMeta: true,
  });
  if (meta.status === 202 && !meta.location) throw Object.assign(new Error('Allegro przyjęło zmianę, ale nie zwróciło adresu kontroli operacji.'), { code: 'allegro_operation_location_missing' });
  const operation = await allegroCzekajNaOperacjeOferty(req, meta.location);
  if (!operation.completed) throw Object.assign(new Error('Allegro nie potwierdziło zakończenia zmiany statusu oferty.'), { code: 'allegro_operation_pending' });
  return { meta, operation };
}
async function synchronizujSprzedazZDostepnosciaProducenta(req, results = [], data = {}, options = {}) {
  const checked = (Array.isArray(results) ? results : []).filter((x) => x?.ok && x?.productId);
  const report = { siteHidden: 0, siteRestored: 0, allegroHidden: 0, allegroRestored: 0, linkedOffers: 0, syncedProducts: 0, failedProducts: 0, unchanged: 0, complete: true, errors: [] };
  if (!checked.length) return report;
  const availability = data.artway_dostepnosc && typeof data.artway_dostepnosc === 'object' ? { ...data.artway_dostepnosc } : {};
  const previousAvailabilityMap = options.previousAvailability && typeof options.previousAvailability === 'object' ? options.previousAvailability : { ...availability };
  const productMap = allegroAgentProduktyCentralne(data);
  const [mappingsRec, offersRec, auditRec, offerSettings] = await Promise.all([
    czytaj('allegro_mappings', { items: {} }),
    czytaj('allegro_offers', { items: [], updated_at: null }),
    czytaj('allegro_availability_automation', { items: {}, updated_at: null }),
    allegroPobierzUstawieniaOfert(),
  ]);
  const mappings = allegroMapowaniaItems(mappingsRec), offers = allegroOfertyItems(offersRec);
  const offersById = new Map(offers.map((offer) => [String(offer?.id || ''), offer]));
  const offerLinks = buildProductSaleChannelLinks({ products: productMap, offers, mappings });
  const auditItems = auditRec.items && typeof auditRec.items === 'object' ? { ...auditRec.items } : {};
  const cachePatches = new Map(), now = new Date().toISOString();
  const restoreAvailability = (productId, previous) => { if (previous) availability[productId] = previous; else delete availability[productId]; };

  for (const result of checked) {
    const productId = String(result.productId), unavailable = result.status === 'brak';
    const available = !unavailable && (result.available === true || Number(result.quantity) > 0 || ['dostepny', 'dostepny_nieznany', 'niski'].includes(String(result.status || '')));
    if (!unavailable && !available) { report.unchanged++; continue; }
    const desiredAvailability = availability[productId], previousAvailability = previousAvailabilityMap[productId];
    const decisionRecord = desiredAvailability || previousAvailability || {}, decisionCode = String(decisionRecord.decision || decisionRecord.decyzja || '').toLowerCase();
    const decisionExpiry = Date.parse(decisionRecord.expiresAt || decisionRecord.waznaDo || ''), graceActive = decisionCode === 'grace' && Number.isFinite(decisionExpiry) && decisionExpiry > Date.now();
    const keepSelling = graceActive || decisionCode === 'manual_available', keepHidden = decisionCode === 'hide_manual';
    if (unavailable && keepSelling) { report.unchanged++; continue; }
    if (available && keepHidden) { report.unchanged++; continue; }

    const previousUnavailable = String(previousAvailability?.status || '').toLowerCase() === 'niedostepny';
    const automaticAvailability = previousAvailability?.automatic === true || previousAvailability?.source === 'producent-agent';
    const legacyTemporaryAvailability = !!previousAvailability && !previousAvailability?.source && /chwilowo niedost[eę]pn|brak u producent/i.test(String(previousAvailability?.powod || ''));
    let plannedAvailability = desiredAvailability;
    if (unavailable && !(String(desiredAvailability?.status || '').toLowerCase() === 'niedostepny')) {
      plannedAvailability = { ...(previousAvailability || {}), status: 'niedostepny', powod: decisionCode === 'grace' ? 'Minął termin pozostawienia sprzedaży — producent nadal zgłasza brak' : 'Automatycznie: produkt niedostępny u producenta', data: now, operator: 'agent-dostepnosci', source: decisionCode === 'grace' ? 'supplier-decision' : 'producent-agent', automatic: true, autoRestore: true, producerStatus: result.status, producerCheckedAt: result.checkedAt || now };
    } else if (available && result.preserveDecision !== true && (automaticAvailability || legacyTemporaryAvailability || ['grace', 'wait_available', 'manual_available'].includes(decisionCode))) plannedAvailability = undefined;

    const links = offerLinks.get(productId) || [], transitions = [], auditSnapshots = new Map();
    report.linkedOffers += links.length;
    let productFailure = null, productChanged = false;
    for (const { offerId, source } of links) {
      const cached = offersById.get(String(offerId)) || {}, previousAudit = auditItems[offerId] && typeof auditItems[offerId] === 'object' ? auditItems[offerId] : {};
      auditSnapshots.set(offerId, previousAudit);
      try {
        const live = await allegroWywolaj(req, `/sale/product-offers/${encodeURIComponent(offerId)}`);
        const status = String(live?.publication?.status || live?.status || cached?.publication?.status || cached?.status || '').toUpperCase();
        const stock = Math.max(0, Number(live?.stock?.available ?? cached?.stock?.available ?? cached?.stock ?? 0) || 0), unit = live?.stock?.unit || cached?.stock?.unit || 'UNIT';
        if (!status) throw Object.assign(new Error('Nie udało się potwierdzić bieżącego statusu oferty Allegro.'), { code: 'allegro_offer_status_unknown' });
        if (unavailable) {
          if (status === 'ACTIVE') {
            await allegroZmienPublikacjeDostepnosci(req, offerId, { status: 'ENDED', stock: 0, unit });
            transitions.push({ offerId, action: 'hide', beforeStatus: status, beforeStock: stock, unit });
            auditItems[offerId] = { ...previousAudit, offerId, productId, linkSource: source, automaticallyHidden: true, previousStock: stock > 0 ? stock : offerSettings.defaultStock, previousStatus: status, hiddenAt: now, restoredAt: null, producerStatus: result.status, pendingAction: '', error: '' };
            cachePatches.set(String(offerId), { status: 'ENDED', publication: { ...(cached.publication || {}), status: 'ENDED', republish: true }, stock: { ...(cached.stock || {}), available: 0, unit }, saleAvailabilityBlocked: true, saleAvailabilityUpdatedAt: now });
            report.allegroHidden++;productChanged = true;
          } else {
            auditItems[offerId] = { ...previousAudit, offerId, productId, linkSource: source, automaticallyHidden: previousAudit.automaticallyHidden === true && status === 'ENDED', alreadyInactive: previousAudit.automaticallyHidden !== true, checkedAt: now, producerStatus: result.status, pendingAction: '', error: '' };
          }
        } else if (previousAudit.automaticallyHidden === true) {
          const targetStock = Math.max(1, Number(previousAudit.previousStock) || offerSettings.defaultStock);
          if (status !== 'ACTIVE') {
            await allegroZmienPublikacjeDostepnosci(req, offerId, { status: 'ACTIVE', stock: targetStock, unit });
            transitions.push({ offerId, action: 'restore', beforeStatus: status, beforeStock: stock, unit });
            report.allegroRestored++;productChanged = true;
          }
          auditItems[offerId] = { ...previousAudit, automaticallyHidden: false, restoredAt: now, producerStatus: result.status, restoredStock: targetStock, pendingAction: '', error: '' };
          cachePatches.set(String(offerId), { status: 'ACTIVE', publication: { ...(cached.publication || {}), status: 'ACTIVE', republish: true }, stock: { ...(cached.stock || {}), available: targetStock, unit }, saleAvailabilityBlocked: false, saleAvailabilityUpdatedAt: now });
        }
      } catch (error) {
        productFailure = { offerId, productId, action: unavailable ? 'hide' : 'restore', error: tekst(error?.message || error, 700), code: tekst(error?.code || '', 120) };
        break;
      }
    }

    if (productFailure) {
      for (const transition of [...transitions].reverse()) {
        try {
          const rollbackStatus = transition.action === 'hide' ? transition.beforeStatus : 'ENDED', rollbackStock = transition.action === 'hide' ? Math.max(1, transition.beforeStock || offerSettings.defaultStock) : 0;
          await allegroZmienPublikacjeDostepnosci(req, transition.offerId, { status: rollbackStatus, stock: rollbackStock, unit: transition.unit });
          auditItems[transition.offerId] = auditSnapshots.get(transition.offerId) || {};
          const cached = offersById.get(String(transition.offerId)) || {};
          cachePatches.set(String(transition.offerId), { status: rollbackStatus, publication: { ...(cached.publication || {}), status: rollbackStatus }, stock: { ...(cached.stock || {}), available: rollbackStock, unit: transition.unit }, saleAvailabilityBlocked: transition.action === 'restore', saleAvailabilityUpdatedAt: now });
          if (transition.action === 'hide') report.allegroHidden = Math.max(0, report.allegroHidden - 1); else report.allegroRestored = Math.max(0, report.allegroRestored - 1);
        } catch (rollbackError) {
          report.errors.push({ offerId: transition.offerId, productId, action: 'rollback', error: tekst(rollbackError?.message || rollbackError, 700), code: tekst(rollbackError?.code || '', 120) });
        }
      }
      const previousAudit = auditSnapshots.get(productFailure.offerId) || {};
      auditItems[productFailure.offerId] = { ...previousAudit, ...productFailure, pendingAction: unavailable ? 'END' : 'ACTIVATE', failedAt: now, producerStatus: result.status };
      restoreAvailability(productId, previousAvailability);report.errors.push(productFailure);report.failedProducts++;continue;
    }

    if (plannedAvailability) availability[productId] = plannedAvailability; else delete availability[productId];
    const plannedUnavailable = String(plannedAvailability?.status || '').toLowerCase() === 'niedostepny';
    if (!previousUnavailable && plannedUnavailable) { report.siteHidden++;productChanged = true; }
    if (previousUnavailable && !plannedUnavailable) { report.siteRestored++;productChanged = true; }
    if (productChanged) report.syncedProducts++; else report.unchanged++;
  }
  report.complete = report.errors.length === 0;
  data.artway_dostepnosc = availability;
  await zapisz('allegro_availability_automation', { items: auditItems, updated_at: now, complete: report.complete, errors: report.errors.slice(-100) });
  if (cachePatches.size) {
    const updatedOffers = offers.map((offer) => cachePatches.has(String(offer.id)) ? { ...offer, ...cachePatches.get(String(offer.id)) } : offer);
    await zapisz('allegro_offers', { ...offersRec, items: updatedOffers, updated_at: now });
  }
  return report;
}
  return synchronizujSprzedazZDostepnosciaProducenta;
}
