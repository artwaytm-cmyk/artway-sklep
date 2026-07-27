function methodError(respond) {
  return respond({ ok: false, error: 'Metoda niedozwolona', code: 'method_not_allowed' }, 405);
}

export function createOpenAiPlatformRoute({ service, isAdmin, rateLimit, respond } = {}) {
  if (!service || typeof service.status !== 'function') throw new Error('Trasa OpenAI Platform wymaga serwisu.');
  const actions = new Set(['openai-platform-status', 'openai-platform-cycle', 'openai-platform-batch-eval']);
  return async function openAiPlatformRoute(req, url, action) {
    if (!actions.has(action)) return null;
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    if (action === 'openai-platform-status') {
      if (req.method !== 'GET') return methodError(respond);
      return respond({ ok: true, platform: await service.status({ force: url.searchParams.get('force') === '1' }) });
    }
    if (req.method !== 'POST') return methodError(respond);
    const limited = rateLimit?.(req, action, 4, 60_000);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    if (action === 'openai-platform-batch-eval') {
      const result = await service.launchEvaluationBatch({ force: body.force === true });
      return respond({ ok: true, ...result }, result.skipped ? 200 : 202);
    }
    return respond({ ok: true, cycle: await service.cycle({ force: body.force === true }) });
  };
}
