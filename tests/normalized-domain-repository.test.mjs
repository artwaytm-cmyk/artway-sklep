import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DIRECT_DOMAIN_CONFIGS,
  SETTINGS_DOMAIN_CONFIGS,
  hydrateNormalizedValue,
  normalizedRevisionToken,
  splitNormalizedValue,
} from '../netlify/functions/lib/core/normalized-domain-repository.mjs';
import {
  dedicatedDomains,
  dedicatedTableForDomain,
} from '../netlify/functions/lib/core/dedicated-domain-storage.mjs';

test('zamówienia są dzielone na osobne rekordy i składane bez zmiany danych', () => {
  const value = { items: [
    { nr: 'ATM-1', status: 'nowe', pozycjeDane: [{ id: 1, ilosc: 2 }] },
    { nr: 'ATM-2', status: 'wysłane', pozycjeDane: [{ id: 2, ilosc: 1 }] },
  ], updated_at: '2026-07-21T10:00:00.000Z' };
  const config = DIRECT_DOMAIN_CONFIGS.orders;
  const split = splitNormalizedValue(value, config);
  assert.equal(split.records.length, 2);
  assert.deepEqual(split.records.map((row) => row.recordId), ['ATM-1', 'ATM-2']);
  assert.deepEqual(hydrateNormalizedValue(split.metadata, split.records, config), value);
});

test('magazyn zachowuje identyfikatory produktów bez jednego wielkiego obiektu settings', () => {
  const value = { 100: 8, 200: 0 };
  const config = SETTINGS_DOMAIN_CONFIGS.artway_stany;
  const split = splitNormalizedValue(value, config);
  assert.deepEqual(split.records.map((row) => row.recordId), ['100', '200']);
  assert.deepEqual(hydrateNormalizedValue(split.metadata, split.records, config), value);
});

test('historia Agenta zachowuje kolejność i rozróżnia powtórzone identyfikatory', () => {
  const value = [{ id: 'A', opis: 'pierwszy' }, { id: 'A', opis: 'drugi' }];
  const config = SETTINGS_DOMAIN_CONFIGS.artway_agent_ai_historia;
  const split = splitNormalizedValue(value, config);
  assert.deepEqual(split.records.map((row) => row.recordId), ['A', 'A#2']);
  assert.deepEqual(hydrateNormalizedValue(split.metadata, split.records, config), value);
});

test('duże domeny operacyjne są jawnie wyjęte z settings i KV', () => {
  for (const key of ['artway_produkty_edytowane', 'artway_magazyn_lokalizacje', 'artway_agent_ai_zlecenia', 'artway_agent_ai_historia']) assert.ok(SETTINGS_DOMAIN_CONFIGS[key]);
  for (const key of ['orders', 'allegro_offers', 'allegro_mappings', 'allegro_communications', 'agent_specialists_state', 'inpost_service_shipments']) assert.ok(DIRECT_DOMAIN_CONFIGS[key]);
});

test('aktywny stan Agenta, Telegrama i inFaktu jest dzielony na rekordy', () => {
  for (const key of ['agent_runtime', 'telegram_communication_state', 'infakt_purchase_price_sync', 'catalog_quality_audit']) {
    assert.ok(DIRECT_DOMAIN_CONFIGS[key], `Brak konfiguracji ${key}`);
  }
  const value = {
    events: { order: { id: 'ATM-1', status: 'open' } },
    history: [{ id: 'H1', at: '2026-07-21T10:00:00Z' }],
    outbox: [{ id: 'O1', at: '2026-07-21T10:01:00Z' }],
    health: { ok: true },
  };
  const config = DIRECT_DOMAIN_CONFIGS.telegram_communication_state;
  const split = splitNormalizedValue(value, config);
  assert.equal(split.records.length, 3);
  assert.deepEqual(hydrateNormalizedValue(split.metadata, split.records, config), value);
});

test('rejestr InPost rozdziela nadania, adresy i ustawienia z wartościami null bez utraty danych', () => {
  const value = {
    items: [{ id: 'IPS-1', requestId: 'REQ-1', status: 'created' }],
    contacts: [{ id: 'IPA-1', label: 'Nadawca', address: { post_code: '84-207', city: 'Bojano' } }],
    settings: { commissionGross: 4, sender: {}, priceList: { extras: { weekendGross: null } }, updatedAt: null },
    updatedAt: '2026-07-23T08:00:00.000Z',
  };
  const config = DIRECT_DOMAIN_CONFIGS.inpost_service_shipments;
  const split = splitNormalizedValue(value, config);
  assert.deepEqual(split.records.map((row) => [row.collection, row.recordId]), [
    ['items', 'IPS-1'],
    ['contacts', 'IPA-1'],
    ['settings', 'singleton'],
  ]);
  assert.ok(split.records.every((row) => row.data !== null));
  assert.deepEqual(hydrateNormalizedValue(split.metadata, split.records, config), value);
});

test('lekki znacznik rewizji domen jest stabilny, posortowany i uwzględnia brakującą domenę', () => {
  const token = normalizedRevisionToken(
    ['settings:artway_stany', 'kv:allegro_offers', 'settings:artway_stany', 'kv:brak'],
    [{ domain: 'settings:artway_stany', version: 17 }, { domain: 'kv:allegro_offers', version: 8 }],
  );
  assert.equal(token, 'ndv1|kv:allegro_offers=8|kv:brak=0|settings:artway_stany=17');
});

test('repozytorium udostępnia przyrostowy odczyt ustawień zamiast obowiązkowego pełnego nawodnienia', async () => {
  const source = await readFile(new URL('../netlify/functions/lib/core/normalized-domain-repository.mjs', import.meta.url), 'utf8');
  assert.match(source, /const readSettingsDelta = async/);
  assert.match(source, /settings_domain|domainVersions/);
  assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(versions/);
});

test('największe domeny operacyjne mają własne tabele zamiast wspólnej tabeli JSONB', () => {
  const expected = {
    'kv:orders': 'artway_store_orders',
    'kv:deleted_orders': 'artway_store_orders',
    'kv:allegro_orders': 'artway_allegro_orders',
    'kv:allegro_offers': 'artway_allegro_offers',
    'kv:allegro_mappings': 'artway_allegro_mappings',
    'kv:allegro_communications': 'artway_allegro_communications',
    'settings:artway_agent_ai_historia': 'artway_agent_records',
    'settings:artway_agent_ai_pamiec': 'artway_agent_records',
    'settings:artway_agent_ai_zlecenia': 'artway_agent_records',
    'kv:agent_runtime': 'artway_agent_records',
    'kv:telegram_communication_state': 'artway_agent_records',
  };
  for (const [domain, table] of Object.entries(expected)) {
    assert.equal(dedicatedTableForDomain(domain), table, `Domena ${domain} nie ma właściwej tabeli`);
  }
  assert.equal(dedicatedTableForDomain('kv:catalog_quality_audit'), '');
  assert.ok(dedicatedDomains().length >= Object.keys(expected).length);
});

test('dedykowana migracja zachowuje kopię wycofania i usuwa aktywne duplikaty z tabeli ogólnej', async () => {
  const source = await readFile(new URL('../netlify/functions/lib/core/dedicated-domain-storage.mjs', import.meta.url), 'utf8');
  assert.match(source, /artway_domain_records_archive_v2/);
  assert.match(source, /INSERT INTO artway_domain_records_archive_v2/);
  assert.match(source, /DELETE FROM artway_domain_records WHERE namespace=\$1 AND domain=\$2/);
  assert.match(source, /dedicated-domain-tables-v2/);
  assert.match(source, /ON DELETE CASCADE/);
});
