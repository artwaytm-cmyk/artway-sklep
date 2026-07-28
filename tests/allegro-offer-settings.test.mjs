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
  const settings = normalizeAllegroOfferSettings({ shippingRateId: 'existing-rate-id', shippingRateName: 'własny cennik' });
  assert.equal(settings.shippingRateId, 'existing-rate-id');
  assert.equal(settings.shippingRateName, 'własny cennik');
});
