import test from 'node:test';
import assert from 'node:assert/strict';
import { createAllegroOfferEventSync } from '../src/backend/lib/domain/allegro-offer-event-sync.mjs';

const text = (value, max = 1000) => String(value ?? '').trim().slice(0, max);

test('brak zdarzeń nie przepisuje katalogu ofert', async () => {
  const writes = [];
  const sync = createAllegroOfferEventSync({
    text,
    call: async () => ({ offerEvents: [] }),
    read: async (key) => key === 'allegro_offers' ? { items: [{ id: '1' }] } : { lastOfferEventId: 'event-1' },
    write: async (key, value) => { writes.push([key, value]); },
    offerItems: (record) => record.items || [],
    fetchDetails: async () => { throw new Error('nie powinno pobierać szczegółów'); },
    normalizeOffer: (offer) => offer,
    mergeOfferDetails: (previous, next) => ({ ...previous, ...next }),
    autoMapOffers: async () => { throw new Error('nie powinno mapować bez zmian'); },
  });
  const result = await sync({}, { source: 'test' });
  assert.equal(result.changed, 0);
  assert.equal(writes.some(([key]) => key === 'allegro_offers'), false);
  assert.equal(writes.some(([key]) => key === 'allegro_offer_sync_state'), true);
});

test('dziennik pobiera i zapisuje tylko zmienione oferty, zachowując poprzedni katalog', async () => {
  const writes = [], calls = [], detailRequests = [];
  const sync = createAllegroOfferEventSync({
    text,
    call: async (_request, path, options) => { calls.push([path, options]); return { offerEvents: [{ id: 'event-2', type: 'OFFER_CHANGED', occurredAt: '2026-08-01T00:00:00Z', offer: { id: '2' } }] }; },
    read: async (key) => key === 'allegro_offers' ? { items: [{ id: '1', name: 'Pierwsza' }, { id: '2', name: 'Stara' }] } : { lastOfferEventId: 'event-1' },
    write: async (key, value) => { writes.push([key, value]); },
    offerItems: (record) => record.items || [],
    fetchDetails: async (_request, source) => { detailRequests.push(...source); return [{ id: '2', name: 'Nowa' }]; },
    normalizeOffer: (offer) => offer,
    mergeOfferDetails: (previous, next) => ({ ...previous, ...next }),
    autoMapOffers: async () => ({ autoMapped: 0, refreshed: 1, quarantined: 0 }),
  });
  const result = await sync({}, { source: 'test' });
  assert.deepEqual(calls[0], ['/sale/offer-events', { parameters: { limit: 1000, from: 'event-1' } }]);
  assert.deepEqual(detailRequests, [{ id: '2' }]);
  const offersWrite = writes.find(([key]) => key === 'allegro_offers')?.[1];
  assert.equal(offersWrite.items.length, 2);
  assert.equal(offersWrite.items[0].name, 'Pierwsza');
  assert.equal(offersWrite.items[1].name, 'Nowa');
  assert.equal(result.changed, 1);
  assert.equal(result.cursor, 'event-2');
});
