import test from 'node:test';
import assert from 'node:assert/strict';

import {
  allegroCommercialNamesEquivalent,
  allegroProductCommercialIdentity,
} from '../src/backend/lib/domain/allegro-commercial-identity.mjs';

test('oddziela markę MilliWOOD od producenta Alexander', () => {
  const identity = allegroProductCommercialIdentity({
    producent: 'Alexander',
    marka: 'MilliWOOD',
  });
  assert.equal(identity.manufacturer, 'Alexander');
  assert.equal(identity.brand, 'MilliWOOD');
  assert.ok(identity.brandCandidates.includes('MilliWOOD'));
  assert.ok(identity.brandCandidates.includes('Alexander'));
});
test('rozpoznaje producenta marki MilliWOOD, gdy stary rekord skopiował markę do obu pól', () => {
  const identity = allegroProductCommercialIdentity({
    producent: 'MilliWOOD',
    marka: 'MilliWOOD',
  });
  assert.equal(identity.manufacturer, 'Alexander');
  assert.equal(identity.brand, 'MilliWOOD');
  assert.equal(identity.manufacturerDerivedFromBrand, true);
});

test('Alexander i katalogowe Aleksander są równoważnymi nazwami handlowymi', () => {
  assert.equal(allegroCommercialNamesEquivalent('Alexander', 'Aleksander'), true);
  assert.equal(allegroCommercialNamesEquivalent('Alexander', 'Alexader'), true);
  assert.equal(allegroCommercialNamesEquivalent('Alexander', 'Multigra'), false);
});

test('skrót katalogowy Mg jest kontrolowanym aliasem marki Multigra', () => {
  assert.equal(allegroCommercialNamesEquivalent('Multigra', 'Mg'), true);
  assert.equal(allegroCommercialNamesEquivalent('Alexander', 'Mg'), false);
});
