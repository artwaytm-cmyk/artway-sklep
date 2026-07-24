import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAllegroCatalogIdentitySignals } from '../src/backend/lib/domain/allegro-catalog-identity.mjs';

test('dokładny GTIN dopuszcza wariant nazwy, gdy katalog Allegro nie zwraca marki', () => {
  const identity = evaluateAllegroCatalogIdentitySignals({
    gtin: '5906018027204',
    candidateGtins: ['5906018027204'],
    nameScore: 0.5,
    productBrand: 'Alexander',
    candidateBrand: '',
  });
  assert.equal(identity.verified, true);
  assert.equal(identity.exactGtinCatalogVariant, true);
  assert.match(identity.reason, /wariantem handlowym/);
});

test('dokładny GTIN nie omija jawnego konfliktu producenta', () => {
  const identity = evaluateAllegroCatalogIdentitySignals({
    gtin: '5906018027204',
    candidateGtins: ['5906018027204'],
    nameScore: 0.9,
    productBrand: 'Alexander',
    candidateBrand: 'Inny producent',
  });
  assert.equal(identity.verified, false);
  assert.equal(identity.brandConflict, true);
});

test('podobna nazwa nigdy nie zastępuje brakującej zgodności GTIN', () => {
  const identity = evaluateAllegroCatalogIdentitySignals({
    gtin: '5906018027204',
    candidateGtins: ['5906018027211'],
    nameScore: 1,
    productBrand: 'Alexander',
    candidateBrand: 'Alexander',
  });
  assert.equal(identity.verified, false);
  assert.equal(identity.gtinMatch, false);
});
