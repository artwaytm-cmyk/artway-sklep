const integer = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const oneOf = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

export const ALLEGRO_SYNC_DEFAULTS = Object.freeze({
  autoMapping: true,
  mappingMinScore: 88,
  lightSyncMinutes: 15,
  fullSyncHours: 6,
});

export function normalizeAllegroSyncSettings(raw = {}) {
  return {
    autoMapping: raw?.autoMapping !== false,
    mappingMinScore: oneOf(integer(raw?.mappingMinScore, ALLEGRO_SYNC_DEFAULTS.mappingMinScore), [88, 95, 100], ALLEGRO_SYNC_DEFAULTS.mappingMinScore),
    lightSyncMinutes: oneOf(integer(raw?.lightSyncMinutes, ALLEGRO_SYNC_DEFAULTS.lightSyncMinutes), [15, 30, 60, 120], ALLEGRO_SYNC_DEFAULTS.lightSyncMinutes),
    fullSyncHours: oneOf(integer(raw?.fullSyncHours, ALLEGRO_SYNC_DEFAULTS.fullSyncHours), [6, 12, 24], ALLEGRO_SYNC_DEFAULTS.fullSyncHours),
  };
}

export function allegroScheduledSyncDue(state = {}, settings = {}, kind = 'light', now = new Date()) {
  const config = normalizeAllegroSyncSettings(settings);
  const current = now instanceof Date ? now : new Date(now);
  const currentMs = Number.isFinite(current.getTime()) ? current.getTime() : Date.now();
  const full = kind === 'full';
  const lastKey = full ? 'lastFullSyncAt' : 'lastLightSyncAt';
  const lastMs = Date.parse(state?.[lastKey] || '');
  const intervalMs = full ? config.fullSyncHours * 60 * 60 * 1000 : config.lightSyncMinutes * 60 * 1000;
  return !Number.isFinite(lastMs) || currentMs - lastMs >= intervalMs;
}

export function allegroNextScheduledSyncAt(state = {}, settings = {}, kind = 'light') {
  const config = normalizeAllegroSyncSettings(settings);
  const full = kind === 'full';
  const lastMs = Date.parse(state?.[full ? 'lastFullSyncAt' : 'lastLightSyncAt'] || '');
  if (!Number.isFinite(lastMs)) return null;
  const intervalMs = full ? config.fullSyncHours * 60 * 60 * 1000 : config.lightSyncMinutes * 60 * 1000;
  return new Date(lastMs + intervalMs).toISOString();
}
