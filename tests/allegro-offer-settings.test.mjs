import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLEGRO_DEFAULT_SHIPPING_RATE_ID,
  normalizeAllegroOfferSettings,
} from '../src/backend/lib/domain/allegro-offer-settings.mjs';

test('ustawienia ofert wybierają istniejący cennik artway2 bez zmieniania jego zawartości', () => {
  const settings = normalizeAllegroOfferSettings({ defaultStock: 15, producers: ['Alexander'] });
  assert.equal(settings.shippingRateId, ALLEGRO_DEFAULT_SHIPPING_RATE_ID);
  assert.equal(settings.shippingRateName, 'artway2');
  assert.equal(settings.defaultStock, 15);
});

test('jawnie zapisany cennik pozostaje zachowany', () => {
  const settings = normalizeAllegroOfferSettings({
    shippingRateId: 'existing-rate-id',
    shippingRateName: 'własny cennik',
    returnPolicyId: 'return-1',
    returnPolicyName: 'Zwrot 14 dni',
    impliedWarrantyId: 'claim-1',
    impliedWarrantyName: 'Reklamacje',
    warrantyId: 'warranty-1',
    warrantyName: 'Gwarancja producenta',
  });
  assert.equal(settings.shippingRateId, 'existing-rate-id');
  assert.equal(settings.shippingRateName, 'własny cennik');
  assert.equal(settings.returnPolicyId, 'return-1');
  assert.equal(settings.returnPolicyName, 'Zwrot 14 dni');
  assert.equal(settings.impliedWarrantyId, 'claim-1');
  assert.equal(settings.impliedWarrantyName, 'Reklamacje');
  assert.equal(settings.warrantyId, 'warranty-1');
  assert.equal(settings.warrantyName, 'Gwarancja producenta');
});
