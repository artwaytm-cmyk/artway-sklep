import { normalizeAllegroSyncSettings } from './allegro-sync-policy.mjs';
import { canonicalManufacturerName } from './product-field-validation.mjs';

export const ALLEGRO_DEFAULT_OFFER_STOCK = 5;
export const ALLEGRO_DEFAULT_PRODUCERS = Object.freeze(['Alexander', 'Multigra', 'GoDan', 'Gabo']);
export const ALLEGRO_DEFAULT_SHIPPING_RATE_ID = 'bf941419-68cf-4a24-a60b-95610058bdf7';

export function normalizeAllegroOfferSettings(raw = {}) {
  const requested = Number(raw?.defaultStock ?? raw?.stock ?? ALLEGRO_DEFAULT_OFFER_STOCK);
  const defaultStock = Number.isFinite(requested)
    ? Math.min(99999, Math.max(1, Math.floor(requested)))
    : ALLEGRO_DEFAULT_OFFER_STOCK;
  const producers = [...new Set((Array.isArray(raw?.producers) ? raw.producers : ALLEGRO_DEFAULT_PRODUCERS)
    .map((value) => canonicalManufacturerName(value, 100)).filter(Boolean))].slice(0, 50);
  const autonomousAgentMinutes = Math.min(120, Math.max(15, Number(raw?.autonomousAgentMinutes) || 15));
  const autoResolveDuplicateMinScore = Math.min(100, Math.max(95, Number(raw?.autoResolveDuplicateMinScore) || 97));
  return {
    defaultStock,
    republish: true,
    shippingRateId: String(raw?.shippingRateId || ALLEGRO_DEFAULT_SHIPPING_RATE_ID).trim().slice(0, 120),
    shippingRateName: String(raw?.shippingRateName || 'artway2').trim().slice(0, 120) || 'artway2',
    producers: producers.length ? producers : [...ALLEGRO_DEFAULT_PRODUCERS],
    autoCatalog: raw?.autoCatalog !== false,
    syncDescriptions: raw?.syncDescriptions !== false,
    autoUpdateOffers: raw?.autoUpdateOffers !== false,
    autoFees: raw?.autoFees !== false,
    autoCorrections: raw?.autoCorrections !== false,
    autonomousAgent: raw?.autonomousAgent !== false,
    autonomousAgentMinutes,
    autoResolveDuplicates: raw?.autoResolveDuplicates !== false,
    autoResolveDuplicateMinScore,
    ...normalizeAllegroSyncSettings(raw),
    updated_at: raw?.updated_at || null,
  };
}
