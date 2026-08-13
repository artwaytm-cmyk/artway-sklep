import test from 'node:test';
import assert from 'node:assert/strict';
import { allegroCatalogRecoveryDecision, allegroCatalogRecoveryHint, executeAllegroOfferWriteWithRecovery } from '../src/backend/lib/domain/allegro-publication-recovery.mjs';

test('błąd kategorii Allegro wskazuje jednoznaczną kategorię i produkt do bezpiecznego ponowienia', () => {
  const hint = allegroCatalogRecoveryHint({
    allegro: {
      errors: [{
        code: 'CATEGORY_MISMATCH',
        message: 'Existing Product related to submitted data was found. The provided category Gry zręcznościowe (123948) does not match the existing product category Rodzinne (6105)',
        metadata: {
          requestedCategoryId: '123948',
          existingCategoryId: '6105',
          existingCategoryName: 'Rodzinne',
          existingProductId: 'catalog-product-1',
        },
      }],
    },
  });
  assert.deepEqual({
    kind: hint.kind,
    productId: hint.productId,
    categoryId: hint.categoryId,
    categoryName: hint.categoryName,
    requestedCategoryId: hint.requestedCategoryId,
  }, {
    kind: 'category',
    productId: 'catalog-product-1',
    categoryId: '6105',
    categoryName: 'Rodzinne',
    requestedCategoryId: '123948',
  });
  assert.equal(allegroCatalogRecoveryDecision({
    hint,
    catalog: { id: 'catalog-product-1', categoryId: '6105' },
    identity: { verified: true },
  }).allowed, true);
});

test('rozbieżne parametry korzystają z metadanych produktu zamiast zgadywać po komunikacie', () => {
  const hint = allegroCatalogRecoveryHint({
    allegro: {
      errors: [{
        code: 'PARAMETER_MISMATCH',
        metadata: {
          productId: 'catalog-product-2',
          parameterId: '248811',
          parameterName: 'Marka',
          expectedParameterValue: 'Multigra',
        },
      }],
    },
  });
  assert.equal(hint.kind, 'parameters');
  assert.equal(hint.productId, 'catalog-product-2');
  assert.deepEqual(hint.corrections, [{
    parameterId: '248811',
    parameterName: 'Marka',
    expectedValue: 'Multigra',
    expectedValueId: '',
  }]);
});

test('automat nie podpina produktu katalogowego, gdy EAN, nazwa lub producent tworzą konflikt tożsamości', () => {
  const decision = allegroCatalogRecoveryDecision({
    hint: { kind: 'parameters', productId: 'catalog-product-2' },
    catalog: { id: 'catalog-product-2', categoryId: '6106' },
    identity: { verified: false, reason: 'producent lub marka są sprzeczne' },
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, 'allegro_catalog_identity_conflict');
  assert.match(decision.reason, /producent lub marka/);
});

test('nieaktualny parametr kategorii jest odświeżany bez zgadywania produktu katalogowego', async () => {
  const calls = [];
  const result = await executeAllegroOfferWriteWithRecovery({
    draft: { category: { id: '6106' } },
    prepared: { missing: [] },
    existing: null,
    send: async (draft) => {
      calls.push(draft);
      if (calls.length === 1) throw {
        allegro: { errors: [{ code: 'ParameterIdNotFoundException', metadata: { parameterId: 'old-1', categoryId: '6106' } }] },
      };
      return { result: { id: 'offer-1' } };
    },
    loadCatalog: async () => { throw new Error('nie wolno szukać katalogu'); },
    prepareRecovery: async ({ hint, decision }) => {
      assert.deepEqual(hint.parameterIds, ['old-1']);
      assert.equal(decision.categoryId, '6106');
      return { draft: { category: { id: '6106' }, parameters: [] }, prepared: { missing: [] }, ready: true };
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(result.catalogRecovery.applied, true);
  assert.equal(result.catalogRecovery.kind, 'refresh_parameters');
});

test('jawna korekta EAN z błędu integralności Allegro jest używana tylko po poprawnej cyfrze kontrolnej', async () => {
  const error = {
    allegro: { errors: [{
      code: 'ProductConstraintViolationException.DataIntegrity',
      message: 'Incorrect EAN/ISBN/ISSN (225693). Submitted value "50906018050929" should be "5906018050929".',
    }] },
  };
  const hint = allegroCatalogRecoveryHint(error);
  assert.equal(hint.kind, 'identifier_value');
  assert.equal(hint.expectedGtin, '5906018050929');
  assert.equal(hint.corrections[0].parameterId, '225693');

  let attempts = 0;
  const result = await executeAllegroOfferWriteWithRecovery({
    draft: { category: { id: '257813' }, productSet: [{ product: { id: '50906018050929', idType: 'GTIN' } }] },
    prepared: { missing: [] }, existing: null,
    send: async (draft) => {
      attempts += 1;
      if (attempts === 1) throw error;
      assert.equal(draft.productSet[0].product.id, '5906018050929');
      return { result: { id: 'offer-corrected-ean' } };
    },
    loadCatalog: async () => { throw new Error('korekta identyfikatora najpierw przebudowuje szkic'); },
    prepareRecovery: async ({ hint: correction }) => ({
      draft: { category: { id: '257813' }, productSet: [{ product: { id: correction.expectedGtin, idType: 'GTIN' } }] },
      prepared: { missing: [] }, existing: null, ready: true,
    }),
  });
  assert.equal(attempts, 2);
  assert.equal(result.catalogRecovery.kind, 'identifier_value');
  assert.equal(result.catalogRecovery.correctedParameters[0].expectedValue, '5906018050929');
});
