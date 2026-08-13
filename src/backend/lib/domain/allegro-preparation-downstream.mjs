const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function fullPreparationDownstreamReady(value = {}) {
  const downstream = asObject(value);
  const status = String(downstream.status || '').toLowerCase();
  return downstream.channel === 'vonHalsky'
    && ['ready', 'completed'].includes(status)
    && downstream.ready === true
    && downstream.readbackConfirmed === true
    && downstream.qualityConfirmed === true;
}

export async function runAllegroPreparationDownstream({ afterPrepare, task, result, clean }) {
  try {
    return await afterPrepare(task, result);
  } catch (error) {
    return {
      channel: 'vonHalsky',
      status: error?.decisionRequired === true || error?.retryable === false ? 'decision_required' : 'retry',
      ready: false,
      readbackConfirmed: false,
      qualityConfirmed: false,
      decisionRequired: error?.decisionRequired === true,
      retryable: error?.retryable !== false,
      code: clean(error?.code || '', 160),
      error: clean(error?.message || error, 1000),
    };
  }
}

/**
 * Jedno zadanie przygotowania jest zakończone dopiero po potwierdzeniu sklepu,
 * Allegro, Von Halsky i końcowego odczytu centralnej kartoteki. Dzięki temu UI
 * nigdy nie pokazuje „gotowe” dla produktu, którego drugi kanał dopiero czeka.
 */
export async function finalizeFullProductPreparation({ afterPrepare, verifyCompleted = null, task, result, clean }) {
  if (typeof afterPrepare !== 'function') return result;
  const upstreamStatus = String(result?.status || '').toLowerCase();
  if (result?.ready !== true || upstreamStatus !== 'completed') return result;

  const downstream = asObject(await runAllegroPreparationDownstream({ afterPrepare, task, result, clean }));
  if (fullPreparationDownstreamReady(downstream)) {
    if (typeof verifyCompleted === 'function') {
      const verification = asObject(await verifyCompleted(task, result, downstream));
      if (verification.ready !== true) {
        const missing = [...new Set(asArray(verification.missing)
          .map((entry) => clean(entry, 500))
          .filter(Boolean))].slice(0, 50);
        const error = clean(
          verification.error
            || `Centralny odczyt kartoteki nie potwierdził pełnej gotowości${missing.length ? `: ${missing.join(', ')}` : '.'}`,
          1000,
        );
        return {
          ...result,
          status: verification.decisionRequired === true ? 'decision_required' : 'attention',
          ready: false,
          missing,
          error,
          downstream: {
            ...downstream,
            status: verification.decisionRequired === true ? 'decision_required' : 'retry',
            ready: false,
            readbackConfirmed: false,
            code: clean(verification.code || 'central_full_preparation_readback_failed', 160),
            error,
          },
        };
      }
    }
    return { ...result, status: 'completed', ready: true, downstream };
  }

  const issue = clean(
    downstream.error
      || `Von Halsky nie potwierdził pełnego przygotowania i odczytu kontrolnego (status: ${downstream.status || 'brak'}).`,
    1000,
  );
  const missing = [...new Set([
    ...asArray(result?.missing),
    ...asArray(downstream?.issues),
    ...asArray(downstream?.warnings),
    issue,
  ].map((entry) => clean(entry, 500)).filter(Boolean))].slice(0, 50);
  const decisionRequired = downstream.decisionRequired === true
    || downstream.retryable === false
    || downstream.status === 'decision_required';
  return {
    ...result,
    status: decisionRequired ? 'decision_required' : 'attention',
    ready: false,
    missing,
    error: issue,
    providerUnavailable: downstream.providerUnavailable === true || result?.providerUnavailable === true,
    downstream,
    ...(decisionRequired ? {
      decision: {
        reason: downstream.code || 'von_halsky_full_preparation_not_confirmed',
        missing,
        attempts: Number(task?.attempt || 0),
      },
    } : {}),
  };
}
