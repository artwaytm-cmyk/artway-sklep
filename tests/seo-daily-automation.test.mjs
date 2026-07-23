import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSeoChannelReport,
  duplicateScheduledSeoResult,
  isScheduledSeoSource,
  scheduledSeoRunForDay,
  seoAutomationDay,
} from '../netlify/functions/lib/domain/seo-daily-automation.mjs';

test('dzień automatu jest liczony w strefie sklepu', () => {
  assert.equal(seoAutomationDay('2026-07-22T22:30:00.000Z'), '2026-07-23');
  assert.equal(isScheduledSeoSource('scheduled-vps-seo-daily'), true);
  assert.equal(isScheduledSeoSource('manual-admin'), false);
});

test('drugi harmonogram tego samego dnia nie wykonuje ponownie partii', () => {
  const history = [
    { type: 'daily', source: 'manual-admin', at: '2026-07-23T01:00:00.000Z', count: 5 },
    { type: 'daily', source: 'scheduled-vps-seo-daily', scheduledDay: '2026-07-23', at: '2026-07-23T02:15:00.000Z', count: 50 },
  ];
  const completed = scheduledSeoRunForDay(history, '2026-07-23');
  assert.equal(completed.count, 50);
  assert.deepEqual(duplicateScheduledSeoResult(completed, 50), {
    processed: 0,
    limit: 50,
    skipped: true,
    reason: 'already-ran-today',
    previousRunAt: '2026-07-23T02:15:00.000Z',
    scheduledDay: '2026-07-23',
    promotion: { status: 'skipped', count: 0 },
    channels: null,
  });
});

test('raport zapisuje rzeczywisty wynik każdego darmowego kanału', () => {
  const selected = Array.from({ length: 50 }, (_, index) => ({ id: index + 1 }));
  const catalog = [...selected, { id: 51, zdjecie: '/51.jpg' }];
  const report = buildSeoChannelReport({
    selectedProducts: selected,
    catalogProducts: catalog,
    promotion: { submitted: true, accepted: true, status: 'accepted', count: 51, httpStatus: 202, scope: 'changed-products' },
    runAt: '2026-07-23T02:15:00.000Z',
  });
  assert.equal(report.metadata.count, 50);
  assert.equal(report.structuredData.count, 50);
  assert.equal(report.sitemap.count, 51);
  assert.equal(report.googleFeed.count, 51);
  assert.equal(report.images.count, 1);
  assert.equal(report.indexNow.count, 50);
  assert.equal(report.indexNow.requestCount, 51);
  assert.equal(report.indexNow.status, 'accepted');
});
