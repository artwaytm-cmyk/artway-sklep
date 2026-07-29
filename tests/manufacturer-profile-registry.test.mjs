import test from 'node:test';
import assert from 'node:assert/strict';

import {
  manufacturerProfileProductPatch,
  resolveManufacturerProfile,
  searchManufacturerProfiles,
} from '../src/backend/lib/domain/manufacturer-profile-registry.mjs';

test('alias i literówka producenta prowadzą do jednego zweryfikowanego profilu Alexander', () => {
  const result = resolveManufacturerProfile({ producent: 'Alexader' });
  assert.equal(result.ready, true);
  assert.equal(result.profile.id, 'alexander');
  assert.equal(result.confidence, 1);
});

test('MilliWOOD pozostaje marką, a firmą odpowiedzialną jest Alexander', () => {
  const product = { producent: 'MilliWOOD', gtin: '5906018023456' };
  const result = resolveManufacturerProfile(product);
  const patch = manufacturerProfileProductPatch(product, result, '2026-07-29T12:00:00.000Z');
  assert.equal(result.profile.id, 'alexander');
  assert.equal(patch.producent, 'Alexander');
  assert.equal(patch.marka, 'MilliWOOD');
  assert.equal(patch.manufacturerProfile.legalName, 'Zakład Produkcyjny "Alexander" Piotr Pundzis');
  assert.match(patch.manufacturerProfile.email, /@alexander\.com\.pl$/);
});

test('MultiGra jest dopasowywana niezależnie od sklepu źródłowego Alexander', () => {
  const result = resolveManufacturerProfile({
    producent: 'MultiGra',
    sourceUrl: 'https://www.sklep.alexander.com.pl/product-pol-0310-Gra-planszowa-Multigra-Lap-zajaca.html',
  });
  assert.equal(result.ready, true);
  assert.equal(result.profile.id, 'multigra');
});

test('wspólny sklep źródłowy nie narzuca błędnie producenta Alexander', () => {
  const result = resolveManufacturerProfile({
    sourceUrl: 'https://www.sklep.alexander.com.pl/product-pol-0310-Gra-planszowa-Multigra-Lap-zajaca.html',
  });
  assert.equal(result.ready, false);
  assert.equal(result.profile, null);
});

test('wyszukiwarka producentów rozpoznaje markę i zwraca pełny kontakt', () => {
  const [profile] = searchManufacturerProfiles('milliwood');
  assert.equal(profile.id, 'alexander');
  assert.ok(profile.address);
  assert.ok(profile.email);
  assert.ok(profile.phone);
  assert.ok(profile.sourceUrl);
});
