import { createStoreRepository } from '../core/store-repository.mjs';
import { contestEffectiveStatus, contestPublicView, normalizeContestState } from './contest-center.mjs';

const repository = createStoreRepository({ name: 'artway-sklep' });
const PUBLIC_STATUSES = new Set(['scheduled', 'active', 'review', 'completed']);

export function contestSeoStateView(value = {}) {
  return normalizeContestState(value).contests
    .map((contest) => ({ ...contest, effectiveStatus: contestEffectiveStatus(contest) }))
    .filter((contest) => PUBLIC_STATUSES.has(contest.effectiveStatus))
    .map((contest) => contestPublicView(contest, { includeRules: true }));
}

export async function loadStorefrontSeoContests() {
  try {
    return contestSeoStateView(await repository.read('contest_center_v1', {}));
  } catch {
    return [];
  }
}

export async function loadStorefrontSeoContest(slug = '') {
  const key = String(slug || '').trim().toLowerCase();
  return (await loadStorefrontSeoContests()).find((contest) => contest.slug === key) || null;
}

export const storefrontContestSeoInternals = Object.freeze({ PUBLIC_STATUSES });
