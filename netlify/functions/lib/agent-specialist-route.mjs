function methodError(respond) {
  return respond({ ok: false, error: 'Metoda niedozwolona', code: 'method_not_allowed' }, 405);
}

function authError(respond) {
  return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
}

export function createAgentSpecialistRoute({ service, isAdmin, rateLimit, respond, sessionOf = () => null } = {}) {
  if (!service || typeof service.status !== 'function') throw new Error('Trasa specjalistów wymaga serwisu GPT.');
  const actions = new Set(['agent-specialists-status', 'agent-specialist-run', 'agent-specialists-config', 'agent-specialist-apply', 'agent-specialist-decision', 'agent-specialist-product-proposal', 'agent-specialist-auto-cycle']);

  return async function agentSpecialistRoute(req, url, action) {
    if (!actions.has(action)) return null;
    if (!isAdmin(req, url)) return authError(respond);
    const actor = sessionOf(req) || { source: req.headers.get('x-agent-source') || 'admin-api' };

    if (action === 'agent-specialists-status') {
      if (req.method !== 'GET') return methodError(respond);
      return respond({ ok: true, ...(await service.status()) });
    }

    if (req.method !== 'POST') return methodError(respond);
    const limited = rateLimit?.(req, action, action === 'agent-specialist-run' ? 30 : 12, 60_000);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));

    if (action === 'agent-specialist-run') {
      const run = await service.run(body, actor);
      return respond({ ok: true, run, draftOnly: true, sentExternally: false, published: false });
    }
    if (action === 'agent-specialists-config') {
      const config = await service.configure(body.config || body);
      return respond({ ok: true, config });
    }
    if (action === 'agent-specialist-apply') {
      const result = await service.applyProductDraft(body.id, actor);
      return respond({ ok: true, result });
    }
    if (action === 'agent-specialist-decision') {
      const decision = await service.updateDecision(body.id, body.decisionAction || body.action, body, actor);
      return respond({ ok: true, decision, sentExternally: false, published: false });
    }
    if (action === 'agent-specialist-product-proposal') {
      const result = await service.prepareProductProposal(body.productId, actor, body);
      return respond({ ok: true, ...result, draftOnly: result?.applied?.applied !== true, sentExternally: false, published: false });
    }
    const cycle = await service.automaticCycle();
    return respond({ ok: true, cycle });
  };
}
