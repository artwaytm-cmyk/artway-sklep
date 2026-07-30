import { planBackgroundCycleWithCodex } from './codex-cycle-coordinator.mjs';

export function createProductEventCodexCoordinator({
  env = process.env,
  timeoutMs = 25_000,
  plan = planBackgroundCycleWithCodex,
} = {}) {
  return ({ kind, productId, productIds = [] } = {}) => plan({
    operations: { summary: {} },
    specialists: {
      lastCycle: {
        status: 'event_received',
        editorialProgress: {
          total: Math.max(1, Array.isArray(productIds) ? productIds.length : 0),
          ready: 0,
          pending: kind === 'product.review' && (productId || productIds.length)
            ? Math.max(1, Array.isArray(productIds) ? productIds.length : 0)
            : 0,
          review: 0,
        },
      },
    },
  }, { env, timeoutMs });
}
