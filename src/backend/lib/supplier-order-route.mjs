const PLAN_ACTIONS = new Map([
  ['supplier-order-line-upsert', 'upsert'],
  ['supplier-order-approve', 'approve'],
  ['supplier-order-cancel', 'cancel'],
  ['supplier-order-correction', 'correction'],
  ['supplier-order-receive', 'receive'],
  ['supplier-order-document-receive', 'receiveDocument'],
]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

/** Kanoniczna trasa Planu zatowarowania i ręcznego zasilania go z Allegro. */
export function createSupplierOrderRoute(options = {}) {
  const {
    isAdmin,
    isAllegroOrderActive,
    plan,
    read,
    recalculateAllegroOrders,
    reconciliation,
    respond,
    sessionOf,
    syncProcurement,
    text,
  } = options;

  function methodOrAuthError(req, url) {
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    return null;
  }

  return async function supplierOrderRoute({ req, url, action }) {
    const planMethod = PLAN_ACTIONS.get(action);
    if (planMethod) {
      const blocked = methodOrAuthError(req, url);
      if (blocked) return blocked;
      const body = await req.json().catch(() => ({}));
      const actor = sessionOf(req)?.email || 'administrator';
      const result = await plan[planMethod](body, actor);
      const workflow = ['receive', 'receiveDocument', 'correction'].includes(planMethod)
        ? await syncProcurement(result.supplierOrders, planMethod === 'correction' ? 'supplier-correction' : 'supplier-receipt')
        : null;
      return respond({ ...result, ...(workflow ? { procurementWorkflow: { changed: workflow.changed } } : {}) });
    }

    if (action === 'supplier-order-reconcile') {
      const blocked = methodOrAuthError(req, url);
      if (blocked) return blocked;
      const result = await reconciliation.reconcileDraftsSafely();
      const settings = await read('settings', { data: {}, rev: 0, updated_at: null });
      const supplierOrders = list(settings.data?.artway_agent_ai_zlecenia);
      const workflow = await syncProcurement(supplierOrders, 'supplier-reconcile');
      return respond({
        ok: result.ok !== false,
        supplierOrders,
        rev: Math.max(0, Number(settings.rev) || 0),
        updated_at: settings.updated_at || null,
        reconciliation: result,
        procurementWorkflow: { changed: workflow.changed },
      }, result.ok === false ? 409 : 200);
    }

    if (action !== 'supplier-order-from-allegro') return null;
    const blocked = methodOrAuthError(req, url);
    if (blocked) return blocked;
    const body = await req.json().catch(() => ({}));
    const requestedIds = [...new Set(list(Array.isArray(body.orderIds) ? body.orderIds : [body.orderId])
      .map((value) => text(value, 180).trim()).filter(Boolean))].slice(0, 200);
    if (!requestedIds.length) return respond({ ok: false, error: 'Wskaż co najmniej jedno zamówienie Allegro.', code: 'validation' }, 422);

    const refreshed = await recalculateAllegroOrders();
    const orders = list(refreshed.orders);
    const wanted = new Set(requestedIds);
    const orderId = (order) => text(order?.id || order?.nr || order?.orderId || order?.checkoutForm?.id, 180);
    const selected = orders.filter((order) => wanted.has(orderId(order)));
    const selectedIds = new Set(selected.map(orderId));
    const missing = requestedIds.filter((id) => !selectedIds.has(id));
    const settings = await read('settings', { data: {}, rev: 0, updated_at: null });
    const supplierOrders = list(settings.data?.artway_agent_ai_zlecenia);
    const orderRefs = new Set([...selectedIds].flatMap((id) => [id, `Allegro ${id}`]));
    const lineHasReference = (line, references) => list(line?.zamowienia).some((reference) => references.has(text(reference, 180)));
    const relatedDrafts = supplierOrders.filter((draft) => list(draft?.pozycje).some((line) => lineHasReference(line, orderRefs)));
    const summaries = selected.map((order) => {
      const id = orderId(order);
      const analysis = order?.agentAnalysis && typeof order.agentAnalysis === 'object' ? order.agentAnalysis : {};
      const positions = list(analysis.positions);
      const shortages = positions.filter((position) => Number(position?.shortage) > 0 && position?.supplierMatchVerified === true && text(position?.productId, 160));
      const unresolved = Number(analysis.nierozpoznane || 0) + Number(analysis.bezStanu || 0);
      const references = new Set([id, `Allegro ${id}`]);
      const drafts = relatedDrafts.filter((draft) => list(draft?.pozycje).some((line) => lineHasReference(line, references)));
      return {
        orderId: id,
        active: isAllegroOrderActive(order),
        shortages: shortages.reduce((sum, position) => sum + Math.max(0, Number(position.shortage) || 0), 0),
        unresolved,
        draftIds: drafts.map((draft) => text(draft.id, 160)),
        draftNumbers: drafts.map((draft) => text(draft.numer || draft.id, 160)),
      };
    });
    return respond({
      ok: true,
      orders,
      order: selected.length === 1 ? selected[0] : null,
      supplierOrders,
      relatedDrafts,
      processed: summaries.length,
      withShortages: summaries.filter((item) => item.shortages > 0).length,
      covered: summaries.filter((item) => item.shortages === 0 && item.unresolved === 0).length,
      unresolved: summaries.filter((item) => item.unresolved > 0).length,
      missing,
      summaries,
      reconciliation: refreshed.supplierReconciliation || null,
      procurementWorkflow: refreshed.procurementWorkflow || null,
      rev: Math.max(0, Number(settings.rev) || 0),
      updated_at: settings.updated_at || null,
    });
  };
}
