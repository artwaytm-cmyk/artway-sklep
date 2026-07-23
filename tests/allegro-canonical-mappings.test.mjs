import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allegroProductSyncFingerprint,
  canonicalizeAllegroMappings,
  linkCanonicalAllegroMapping,
  markAllegroMappingSynced,
} from '../src/backend/lib/domain/allegro-canonical-mappings.mjs';
import { allegroMappingRecordsEqual } from '../src/backend/lib/domain/allegro-mapping-store.mjs';

const product = { id: 'P-1', nazwa: 'ECO FUN - TRYLMA', ean: '5906018025309', cena: 39.9, opis: 'Gra logiczna.', allegroOfferId: 'OFF-NEW' };
const offer = (id, status = 'ACTIVE') => ({ id, name: 'ECO FUN - TRYLMA', ean: '5906018025309', status });

test('nieobecna oferta pozostaje historią, a bieżąca zostaje jedyną ofertą główną', () => {
  const result = canonicalizeAllegroMappings({
    mappings: {
      'OFF-OLD': { offerId: 'OFF-OLD', productId: 'P-1', operator: 'auto-offer-save' },
      'OFF-NEW': { offerId: 'OFF-NEW', productId: 'P-1', operator: 'auto-offer-save' },
    },
    offers: [offer('OFF-NEW')],
    products: new Map([['P-1', product]]),
    now: '2026-07-19T10:00:00.000Z',
  });
  assert.equal(result.mappings['OFF-OLD'].mappingRole, 'historical');
  assert.equal(result.mappings['OFF-OLD'].productId, 'P-1');
  assert.equal(result.mappings['OFF-NEW'].mappingRole, 'primary');
  assert.equal(result.mappings['OFF-NEW'].canonical, true);
  assert.deepEqual(result.stats, { canonical: 1, duplicates: 0, historical: 1, unlinked: 0 });
});

test('ręczna decyzja tworzy trwałą ofertę główną, a drugiej nie odłącza od historii zamówień', () => {
  const offers = [offer('OFF-A'), offer('OFF-B')];
  const result = linkCanonicalAllegroMapping({
    mappings: { 'OFF-A': { offerId: 'OFF-A', productId: 'P-1', canonical: true, mappingRole: 'primary' } },
    offers,
    products: new Map([['P-1', product]]),
    offer: offers[1], product,
    validation: { score: 100, reason: 'identyczny EAN/GTIN', evidence: ['identyczny EAN/GTIN'] },
    now: '2026-07-19T10:05:00.000Z',
  });
  assert.equal(result.mappings['OFF-B'].mappingRole, 'primary');
  assert.equal(result.mappings['OFF-B'].locked, true);
  assert.equal(result.mappings['OFF-A'].mappingRole, 'duplicate');
  assert.equal(result.mappings['OFF-A'].productId, 'P-1');
  assert.equal(result.mappings['OFF-A'].duplicateOf, 'OFF-B');
  assert.deepEqual(result.duplicateOfferIds, ['OFF-A']);
});

test('ponowne kliknięcie tego samego, zsynchronizowanego powiązania jest idempotentne', () => {
  const linked = linkCanonicalAllegroMapping({ mappings: {}, offers: [offer('OFF-1')], products: new Map([['P-1', product]]), offer: offer('OFF-1'), product });
  linked.mappings['OFF-1'] = markAllegroMappingSynced(linked.mappings['OFF-1'], product, '2026-07-19T10:10:00.000Z');
  const repeated = linkCanonicalAllegroMapping({ mappings: linked.mappings, offers: [offer('OFF-1')], products: new Map([['P-1', product]]), offer: offer('OFF-1'), product, now: '2026-07-19T11:00:00.000Z' });
  assert.equal(repeated.idempotent, true);
  assert.equal(repeated.syncRequired, false);
  assert.equal(repeated.mappings['OFF-1'].linked_at, linked.mappings['OFF-1'].linked_at);
});

test('zmiana danych sklepu ustawia ponowną synchronizację bez rozłączania oferty', () => {
  const mapping = markAllegroMappingSynced({ offerId: 'OFF-1', productId: 'P-1', canonical: true, mappingRole: 'primary', locked: true }, product);
  const changedProduct = { ...product, cena: 44.9, opis: 'Nowy, dokładniejszy opis gry.' };
  const result = linkCanonicalAllegroMapping({ mappings: { 'OFF-1': mapping }, offers: [offer('OFF-1')], products: new Map([['P-1', changedProduct]]), offer: offer('OFF-1'), product: changedProduct });
  assert.equal(result.syncRequired, true);
  assert.equal(result.mappings['OFF-1'].syncState, 'pending');
  assert.equal(result.mappings['OFF-1'].productId, 'P-1');
  assert.notEqual(allegroProductSyncFingerprint(product), allegroProductSyncFingerprint(changedProduct));
});

test('kolejność pól JSONB nie powoduje ponownego zapisu tego samego mapowania', () => {
  assert.equal(allegroMappingRecordsEqual(
    { offerId: 'OFF-1', productId: 'P-1', meta: { score: 100, reason: 'EAN' } },
    { meta: { reason: 'EAN', score: 100 }, productId: 'P-1', offerId: 'OFF-1' },
  ), true);
});
