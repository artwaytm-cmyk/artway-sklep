import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramRouter } from '../src/backend/lib/telegram-router.mjs';
import { telegramCanonicalSupplierPreviews } from '../src/backend/lib/domain/telegram-communication.mjs';

function createRouter({ sent = [] } = {}) {
  const record = {
    rev: 12,
    updated_at: '2026-07-18T18:00:00.000Z',
    data: { artway_agent_ai_zlecenia: [{
      id: 'SPD-CANON', numer: 'AZ/2026/07/0012', revision: 3, status: 'do sprawdzenia',
      pozycje: [{ externalId: 'EXT-CANON', nazwa: 'Kanoniczny produkt', ilosc: 4, dostawca: 'Alexander' }],
    }] },
  };
  return createTelegramRouter({
    center: { sendManual: async (message) => { sent.push(message); return { message_id: sent.length }; } },
    codexQueue: null,
    agentRuntime: null,
    getOperationalCenter: async () => ({}),
    inventoryCommand: async () => null,
    inventoryDecisions: null,
    isAdmin: () => true,
    read: async () => record,
    respond: (payload, status = 200) => ({ payload, status }),
    sessionOf: () => ({ email: 'admin@example.test' }),
    publicOrigin: () => 'https://artwaytm.pl',
    supplierPreviews: telegramCanonicalSupplierPreviews,
    text: (value, limit = 500) => String(value || '').slice(0, limit),
  });
}

async function request(router, action, body) {
  const req = new Request(`https://artwaytm.pl/api/store?action=${action}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return router(req, new URL(req.url), action);
}

test('podgląd Telegram ignoruje alternatywny dokument klienta i czyta Plan zatowarowania', async () => {
  const router = createRouter();
  const result = await request(router, 'telegram-supplier-order-preview', {
    draftId: 'SPD-CANON', expectedRevision: 3,
    order: { id: 'FAKE', pozycje: [{ externalId: 'ZLY', nazwa: 'Zła treść', ilosc: 999, dostawca: 'Alexander' }] },
  });
  assert.equal(result.status, 200);
  assert.equal(result.payload.source, 'supplier-plan');
  assert.equal(result.payload.messages[0].draftId, 'SPD-CANON');
  assert.match(result.payload.messages[0].text, /Kanoniczny produkt/);
  assert.doesNotMatch(result.payload.messages[0].text, /Zła treść|999|FAKE/);
});

test('wysyłka z panelu używa tego samego kanonicznego renderera i rewizji', async () => {
  const sent = [], router = createRouter({ sent });
  const result = await request(router, 'telegram-send-supplier-order', { draftId: 'SPD-CANON', expectedRevision: 3 });
  assert.equal(result.payload.ok, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /AZ\/2026\/07\/0012/);
  assert.match(sent[0], /Kanoniczny produkt/);
  await assert.rejects(
    () => request(router, 'telegram-send-supplier-order', { draftId: 'SPD-CANON', expectedRevision: 2 }),
    (error) => error?.code === 'supplier_order_revision_conflict' && error?.status === 409,
  );
});
