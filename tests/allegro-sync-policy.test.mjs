import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLEGRO_SYNC_DEFAULTS,
  allegroNextScheduledSyncAt,
  allegroScheduledSyncDue,
  normalizeAllegroSyncSettings,
} from '../netlify/functions/lib/domain/allegro-sync-policy.mjs';

test('ustawienia synchronizacji mają bezpieczne wartości domyślne', () => {
  assert.deepEqual(normalizeAllegroSyncSettings({}), ALLEGRO_SYNC_DEFAULTS);
  assert.deepEqual(normalizeAllegroSyncSettings({ autoMapping: false, mappingMinScore: 100, lightSyncMinutes: 60, fullSyncHours: 24 }), {
    autoMapping: false,
    mappingMinScore: 100,
    lightSyncMinutes: 60,
    fullSyncHours: 24,
  });
});

test('nieobsługiwane wartości harmonogramu wracają do bezpiecznych domyślnych', () => {
  assert.deepEqual(normalizeAllegroSyncSettings({ lightSyncMinutes: 7, fullSyncHours: 2 }), ALLEGRO_SYNC_DEFAULTS);
});

test('próg mapowania przyjmuje każdą wartość od 55% i pilnuje granic', () => {
  assert.equal(normalizeAllegroSyncSettings({ mappingMinScore: 55 }).mappingMinScore, 55);
  assert.equal(normalizeAllegroSyncSettings({ mappingMinScore: 73 }).mappingMinScore, 73);
  assert.equal(normalizeAllegroSyncSettings({ mappingMinScore: 20 }).mappingMinScore, 55);
  assert.equal(normalizeAllegroSyncSettings({ mappingMinScore: 140 }).mappingMinScore, 100);
});

test('lekka synchronizacja respektuje wybrany interwał', () => {
  const state = { lastLightSyncAt: '2026-07-16T10:00:00.000Z' };
  const settings = { lightSyncMinutes: 30 };
  assert.equal(allegroScheduledSyncDue(state, settings, 'light', '2026-07-16T10:29:59.000Z'), false);
  assert.equal(allegroScheduledSyncDue(state, settings, 'light', '2026-07-16T10:30:00.000Z'), true);
  assert.equal(allegroNextScheduledSyncAt(state, settings, 'light'), '2026-07-16T10:30:00.000Z');
});

test('pełna synchronizacja respektuje osobny interwał', () => {
  const state = { lastFullSyncAt: '2026-07-16T00:00:00.000Z' };
  const settings = { fullSyncHours: 12 };
  assert.equal(allegroScheduledSyncDue(state, settings, 'full', '2026-07-16T11:59:59.000Z'), false);
  assert.equal(allegroScheduledSyncDue(state, settings, 'full', '2026-07-16T12:00:00.000Z'), true);
  assert.equal(allegroNextScheduledSyncAt(state, settings, 'full'), '2026-07-16T12:00:00.000Z');
});
