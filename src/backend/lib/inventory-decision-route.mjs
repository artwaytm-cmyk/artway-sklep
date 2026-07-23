import { mergeCatalogProducts } from './domain/catalog-quality.mjs';
import { matchInventoryProduct } from './domain/inventory-command.mjs';
import {
  activeInventoryLocations,
  renderInventoryDecisionConfirmation,
  renderInventoryLocationPrompt,
} from './domain/inventory-decisions.mjs';

const ACTIONS = new Set([
  'inventory-decisions-list',
  'inventory-decision-create',
  'inventory-decision-location',
  'inventory-decision-confirm',
  'inventory-decision-reject',
]);
const HUMAN_DECISION_ACTIONS = new Set(['inventory-decision-confirm', 'inventory-decision-reject']);

function html(value = '') {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function actor(body = {}, fallback = 'administrator') {
  const source = body.actor && typeof body.actor === 'object' ? body.actor : {};
  return {
    id: String(source.id || source.userId || '').slice(0, 100),
    name: String(source.name || source.username || body.operator || fallback || 'administrator').slice(0, 160),
  };
}

function finalCard(decision = {}, rejected = false) {
  const before = decision.expectedStock === null ? 'niemonitorowany' : `${decision.expectedStock} szt.`;
  const after = decision.result?.after ?? decision.after;
  if (rejected || decision.status === 'rejected') {
    return {
      text: `<b>❌ Zmiana odrzucona</b>\n${html(decision.product?.name || `Produkt ${decision.productId || ''}`)}\nStan pozostał bez zmian.`,
      replyMarkup: undefined,
    };
  }
  return {
    text: `<b>✅ Zmiana magazynowa zapisana</b>\n${html(decision.product?.name || `Produkt ${decision.productId || ''}`)}\nStan: <b>${html(before)}</b> → <b>${html(`${after} szt.`)}</b>\nLokalizacja: <b>${html(decision.location || '—')}</b>`,
    replyMarkup: undefined,
  };
}

export function createInventoryDecisionRoute({ decisions, isAdmin, rateLimit, readVersioned, respond, sessionOf, text } = {}) {
  if (!decisions || typeof decisions.createDraft !== 'function') throw new Error('Trasa decyzji magazynowych wymaga serwisu decyzji.');
  return async function inventoryDecisionRoute(req, url, action) {
    if (!ACTIONS.has(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    const session = sessionOf(req);
    if (HUMAN_DECISION_ACTIONS.has(action) && session?.role !== 'admin') {
      return respond({
        ok: false,
        error: 'Końcowa decyzja magazynowa wymaga zalogowanego administratora.',
        code: 'inventory_decision_human_admin_required',
      }, 403);
    }
    const limited = rateLimit(req, 'inventory-decisions', 240, 60 * 60 * 1000);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const operator = session?.email || 'administrator';
    const decisionActor = HUMAN_DECISION_ACTIONS.has(action)
      ? { id: operator, name: operator }
      : actor(body, operator);
    try {
      if (action === 'inventory-decisions-list') {
        const statuses = Array.isArray(body.statuses) ? body.statuses : ['awaiting_location', 'pending_confirmation', 'confirming'];
        const items = await decisions.list({ statuses });
        const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
        const settings = version.value?.data && typeof version.value.data === 'object' ? version.value.data : {};
        const locationsByProduct = Object.fromEntries([...new Set(items.map((item) => String(item.productId || '')).filter(Boolean))]
          .map((productId) => [productId, activeInventoryLocations(settings, productId)]));
        return respond({ ok: true, items, locationsByProduct });
      }

      if (action === 'inventory-decision-create') {
        const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
        const settings = version.value?.data && typeof version.value.data === 'object' ? version.value.data : {};
        const products = mergeCatalogProducts(settings).activeProducts;
        const productId = text(body.productId || '', 120).trim();
        let product = productId ? products.find((item) => String(item.id) === productId) : null;
        if (!product) {
          const match = matchInventoryProduct(products, text(body.query || '', 500));
          if (match.status === 'not_found') return respond({ ok: false, error: 'Nie znaleziono kartoteki produktu.', code: 'inventory_product_not_found' }, 404);
          if (match.status !== 'matched') return respond({ ok: false, error: 'Pasuje kilka produktów. Podaj ID, EXTERNAL_ID, EAN albo SKU.', code: 'inventory_product_ambiguous', alternatives: match.alternatives || [] }, 409);
          product = match.product;
        }
        const result = await decisions.createDraft({
          requestId: text(body.requestId || '', 160).trim(),
          productId: String(product.id),
          product: {
            id: String(product.id), name: product.nazwa || product.name || `Produkt ${product.id}`,
            sku: product.sku || product.SKU || '', externalId: product.externalId || product.EXTERNAL_ID || product.mpn || '',
            ean: product.ean || product.gtin || product.EAN || product.GTIN || '',
          },
          mode: body.mode,
          quantity: body.quantity,
          source: text(body.source || 'admin-agent-panel', 80),
          channel: body.channel === 'telegram' ? 'telegram' : 'panel',
          chatId: body.chatId,
          messageThreadId: body.messageThreadId,
          actor: decisionActor,
          reason: text(body.reason || 'Zmiana przygotowana przez Agenta', 300),
        });
        const card = result.decision.status === 'confirmed'
          ? finalCard(result.decision, false)
          : result.decision.status === 'rejected'
            ? finalCard(result.decision, true)
            : result.decision.status === 'pending_confirmation'
              ? renderInventoryDecisionConfirmation(result.decision)
              : renderInventoryLocationPrompt(result.decision, result.locations);
        return respond({ ok: true, ...result, ...card });
      }

      const id = text(body.id || '', 40).trim();
      if (action === 'inventory-decision-location') {
        const result = await decisions.assignLocation(id, body.location, decisionActor);
        return respond({ ok: true, ...result, ...renderInventoryDecisionConfirmation(result.decision) });
      }
      if (action === 'inventory-decision-confirm') {
        const result = await decisions.confirm(id, decisionActor);
        return respond({ ok: true, ...result, ...finalCard(result.decision, false) });
      }
      const result = await decisions.reject(id, decisionActor);
      return respond({ ok: true, ...result, ...finalCard(result.decision, true) });
    } catch (error) {
      return respond({
        ok: false,
        error: error?.message || 'Nie udało się obsłużyć decyzji magazynowej.',
        code: error?.code || 'inventory_decision_error',
        ...(error?.details || {}),
      }, Number(error?.status || 422));
    }
  };
}
