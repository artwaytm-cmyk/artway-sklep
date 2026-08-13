import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SETTINGS_DOMAIN_CONFIGS } from '../src/backend/lib/core/normalized-domain-repository.mjs';
import {
  ADMIN_SETTINGS_DOMAIN_KEYS,
  filterKnownSettingsDomains,
  mergeAgentPlanCycle,
} from '../src/backend/lib/core/settings-domain-contract.mjs';
import { createStoreDataRoute } from '../src/backend/lib/store-data-route.mjs';

test('backend HTTP i repozytorium PostgreSQL korzystają z jednego kontraktu domen', () => {
  assert.deepEqual(ADMIN_SETTINGS_DOMAIN_KEYS, Object.keys(SETTINGS_DOMAIN_CONFIGS));
  assert.ok(ADMIN_SETTINGS_DOMAIN_KEYS.includes('artway_agent_ai_plan_cykl'));
  const plan = { task: { status: 'done' } };
  assert.deepEqual(
    filterKnownSettingsDomains({ artway_agent_ai_plan_cykl: plan, niedozwolona_domena: { secret: true } }),
    { artway_agent_ai_plan_cykl: plan },
  );
});

test('każda domena wysyłana przez panel jest znana backendowi', async () => {
  const frontend = await readFile('src/frontend/03-cloud-sync.js', 'utf8');
  const match = frontend.match(/const KLUCZE_WSPOLNE = (\[[^;]+\]);/);
  assert.ok(match, 'nie znaleziono kontraktu domen panelu');
  const frontendKeys = JSON.parse(match[1]);
  const unknown = frontendKeys.filter((key) => !ADMIN_SETTINGS_DOMAIN_KEYS.includes(key));
  assert.deepEqual(unknown, []);
});

test('trasa HTTP przyjmuje i wersjonuje plan cyklu Agenta', async () => {
  let written = null;
  const route = createStoreDataRoute({
    odpowiedz: (body, status = 200) => ({ body, status }),
    czyAdmin: () => true,
    oczyscUstawienia: filterKnownSettingsDomains,
    zapiszJesliWersja: async (key, value, expected) => {
      written = { key, value, expected };
      return { modified: true, version: 10 };
    },
    czytajWersjonowane: async (key) => key === 'settings'
      ? { value: { data: {}, rev: 44 }, etag: '"44"', exists: true }
      : { value: {}, etag: '', exists: false },
    tekst: (value, max = 1000) => String(value ?? '').slice(0, max),
    czytaj: async (_key, fallback) => fallback,
  });
  const value = { 'zadanie-1': { status: 'done' } };
  const response = await route(
    { method: 'POST', json: async () => ({ mode: 'domain', key: 'artway_agent_ai_plan_cykl', value }) },
    new URL('https://artwaytm.pl/api/store?action=settings'),
    'settings',
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.version, 10);
  assert.equal(response.body.rev, 44);
  assert.deepEqual(written, { key: 'artway_agent_ai_plan_cykl', value, expected: null });
});

test('stały błąd domeny nie tworzy pętli zapisu co 1,2 sekundy', async () => {
  const frontend = `${await readFile('src/frontend/03-cloud-sync.js', 'utf8')}\n${await readFile('src/frontend/03d-cloud-persistence-runtime.js', 'utf8')}`;
  assert.match(frontend, /CHMURA_ODRZUCONA_DOMENA_RETRY_MS = 15\*60\*1000/);
  assert.match(frontend, /Number\(e\.status\)===422/);
  assert.match(frontend, /chmuraWstrzymaneDomeny\.set\(key,Date\.now\(\)\+CHMURA_ODRZUCONA_DOMENA_RETRY_MS\)/);
  assert.match(frontend, /chmuraZaplanujKolejnyZapis\(\)/);
});

test('równoległe wpisy planu Agenta są scalane bez utraty wykonanego zadania', () => {
  const server = {
    'zadanie-a': { state: 'done', updatedAt: '2026-07-26T00:10:00.000Z' },
    'zadanie-b': { state: 'queued', updatedAt: '2026-07-26T00:08:00.000Z' },
  };
  const browser = {
    'zadanie-a': { state: 'running', updatedAt: '2026-07-26T00:09:00.000Z' },
    'zadanie-c': { state: 'queued', updatedAt: '2026-07-26T00:11:00.000Z' },
  };
  assert.deepEqual(mergeAgentPlanCycle(server, browser), {
    'zadanie-a': server['zadanie-a'],
    'zadanie-b': server['zadanie-b'],
    'zadanie-c': browser['zadanie-c'],
  });
});

test('trasa scala konflikt planu na aktualnej wersji serwera', async () => {
  const current = { 'zadanie-serwer': { state: 'done', updatedAt: '2026-07-26T00:10:00.000Z' } };
  const writes = [];
  const route = createStoreDataRoute({
    odpowiedz: (body, status = 200) => ({ body, status }),
    czyAdmin: () => true,
    oczyscUstawienia: filterKnownSettingsDomains,
    zapiszJesliWersja: async (key, value, expected) => {
      writes.push({ key, value, expected });
      if (writes.length === 1) return { modified: false };
      return { modified: true, version: 12 };
    },
    czytajWersjonowane: async (key) => key === 'settings'
      ? { value: { data: {}, rev: 45 }, etag: '"45"', exists: true }
      : { value: current, etag: '"11"', exists: true },
    tekst: (value, max = 1000) => String(value ?? '').slice(0, max),
    czytaj: async (_key, fallback) => fallback,
  });
  const incoming = { 'zadanie-przegladarka': { state: 'queued', updatedAt: '2026-07-26T00:11:00.000Z' } };
  const response = await route(
    { method: 'POST', json: async () => ({ mode: 'domain', key: 'artway_agent_ai_plan_cykl', value: incoming, expectedRevision: 10 }) },
    new URL('https://artwaytm.pl/api/store?action=settings'),
    'settings',
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.merged, true);
  assert.deepEqual(writes[1].value, { ...current, ...incoming });
  assert.equal(writes[1].expected.etag, '"11"');
});
