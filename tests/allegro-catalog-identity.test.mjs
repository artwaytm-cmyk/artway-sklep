import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAllegroCatalogIdentitySignals, selectAllegroCatalogCandidate } from '../src/backend/lib/domain/allegro-catalog-identity.mjs';

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

test('marka katalogowa potwierdzona w nazwie pozwala poprawić błędne pole marki przy dokładnym GTIN', () => {
  const identity = evaluateAllegroCatalogIdentitySignals({
    gtin: '5906395300761',
    candidateGtins: ['5906395300761'],
    nameScore: 0.55,
    productBrand: 'Alexander',
    candidateBrand: 'Multigra',
    candidateBrandCorroborated: true,
  });
  assert.equal(identity.verified, true);
  assert.equal(identity.brandConflict, false);
  assert.equal(identity.brandCorroborated, true);
});

test('tożsamość katalogu uwzględnia osobno markę i producenta produktu', () => {
  const identity = evaluateAllegroCatalogIdentitySignals({
    gtin: '5906018050066',
    candidateGtins: ['5906018050066'],
    nameScore: 0.7,
    productBrand: 'MilliWOOD',
    productBrands: ['MilliWOOD', 'Alexander'],
    candidateBrand: 'Aleksander',
  });
  assert.equal(identity.verified, true);
  assert.equal(identity.brandMatch, true);
  assert.equal(identity.brandConflict, false);
});

test('zgodny EAN, kod producenta i alias marki naprawiają kategorię mimo skróconej nazwy katalogowej', () => {
  const identity = evaluateAllegroCatalogIdentitySignals({
    gtin: '5906018027532',
    candidateGtins: ['5906018027532'],
    nameScore: 0.429,
    productBrand: 'Alexander',
    productBrands: ['Alexander'],
    candidateBrand: 'Aleksander',
    productCode: '2753',
    candidateCodes: ['2753'],
  });
  assert.equal(identity.verified, true);
  assert.equal(identity.codeMatch, true);
  assert.equal(identity.brandConflict, false);
  assert.equal(identity.nameConsistent, true);
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

test('kilka rekordów katalogu z tym samym GTIN wybiera wyraźnie najlepiej zgodną nazwę', () => {
  const result = selectAllegroCatalogCandidate([
    { id: 'weaker', identity: { verified: true, nameScore: 0.429 } },
    { id: 'better', identity: { verified: true, nameScore: 0.5 } },
  ]);
  assert.equal(result.ambiguous, false);
  assert.equal(result.selected.id, 'better');
});

test('niemal identyczne wyniki katalogowe nadal wymagają decyzji', () => {
  const result = selectAllegroCatalogCandidate([
    { id: 'one', identity: { verified: true, nameScore: 0.51 } },
    { id: 'two', identity: { verified: true, nameScore: 0.5 } },
  ]);
  assert.equal(result.ambiguous, true);
  assert.equal(result.selected, null);
});
