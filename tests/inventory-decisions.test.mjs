import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVENTORY_DECISIONS_KEY,
  activeInventoryLocations,
  createInventoryDecisionService,
  inventoryDecisionCallback,
  parseInventoryDecisionCallback,
  renderInventoryDecisionConfirmation,
  renderInventoryDecisionReminder,
  renderInventoryLocationPrompt,
} from '../src/backend/lib/domain/inventory-decisions.mjs';

const PRODUCT = {
  id: '31',
  name: 'Gorący Ziemniak Familijny',
  sku: '1410',
  externalId: '1410',
  ean: '5906018014105',
};

function settingsRecord(stock = 1, rev = 10) {
  return {
    rev,
    updated_at: '2026-07-15T12:00:00.000Z',
    data: {
      artway_stany: { 31: stock, 99: 4 },
      artway_ruchy_magazynowe: [],
      artway_magazyn_lokalizacje: [
        { kod: 'A-R01-P01', nazwa: 'Półka 1', aktywna: true },
        { kod: 'B-R02-P03', nazwa: 'Półka 3' },
        { kod: 'ARCHIWUM', aktywna: false },
      ],
      artway_magazyn_produkty: {
        31: { lokalizacja: 'LEGACY-P01', dostawca: 'Alexander' },
      },
      artway_ustawienia: { nazwa: 'Artway-TM' },
    },
  };
}

function repository(initialSettings = settingsRecord()) {
  const values = new Map([
    ['settings', structuredClone(initialSettings)],
    [INVENTORY_DECISIONS_KEY, { schema: 1, items: [], lastReminderSlot: '', updatedAt: null }],
  ]);
  const etags = new Map([['settings', 'settings-v1'], [INVENTORY_DECISIONS_KEY, 'decisions-v1']]);
  const writes = new Map();
  return {
    readVersioned: async (key, fallback) => ({
      value: structuredClone(values.has(key) ? values.get(key) : fallback),
      etag: etags.get(key) || '',
      exists: values.has(key),
    }),
    writeIfVersion: async (key, next, version) => {
      if ((etags.get(key) || '') !== String(version.etag || '')) return { modified: false };
      values.set(key, structuredClone(next));
      writes.set(key, (writes.get(key) || 0) + 1);
      etags.set(key, `${key}-v${(writes.get(key) || 0) + 1}`);
      return { modified: true };
    },
    read: (key) => structuredClone(values.get(key)),
    writeCount: (key) => writes.get(key) || 0,
    externalSet(key, next) {
      values.set(key, structuredClone(next));
      const count = Number((etags.get(key) || '').match(/(\d+)$/)?.[1] || 1) + 1;
      etags.set(key, `${key}-external-v${count}`);
    },
  };
}

function service(repo, clock = new Date('2026-07-15T14:05:00.000Z')) {
  return createInventoryDecisionService({
    settingsReadVersioned: repo.readVersioned,
    settingsWriteIfVersion: repo.writeIfVersion,
    decisionsReadVersioned: repo.readVersioned,
    decisionsWriteIfVersion: repo.writeIfVersion,
    now: () => new Date(clock),
  });
}

async function draft(agent, requestId = 'telegram-100', quantity = 8) {
  return agent.createDraft({
    requestId,
    productId: '31',
    product: PRODUCT,
    mode: 'set',
    quantity,
    confirmed: true,
    source: 'telegram-agent',
    actor: { id: '77', name: 'Tomasz' },
    chatId: '-100123',
  });
}

test('pierwsza komenda tworzy wyłącznie draft oczekujący lokalizacji', async () => {
  const repo = repository(), agent = service(repo);
  const created = await draft(agent);

  assert.equal(created.decision.status, 'awaiting_location');
  assert.equal(created.decision.expectedStock, 1);
  assert.equal(created.decision.after, 8);
  assert.equal(created.decision.location, '');
  assert.equal(created.decision.suggestedLocation, 'LEGACY-P01');
  assert.equal(repo.writeCount('settings'), 0);
  assert.equal(repo.read('settings').data.artway_stany['31'], 1);
  assert.equal(repo.read('settings').data.artway_ruchy_magazynowe.length, 0);

  const duplicate = await draft(agent);
  assert.equal(duplicate.duplicate, true);
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).items.length, 1);
});

test('ponowne użycie requestId dla innej korekty jest blokowane', async () => {
  const repo = repository(), agent = service(repo);
  await draft(agent, 'same-request', 8);
  await assert.rejects(draft(agent, 'same-request', 9), (error) => error.code === 'inventory_decision_request_id_conflict');
  await assert.rejects(agent.createDraft({
    requestId: 'same-request', productId: '99', product: { id: '99', name: 'Inny produkt' },
    mode: 'set', quantity: 8, source: 'telegram-agent', actor: { name: 'Tomasz' },
  }), (error) => error.code === 'inventory_decision_request_id_conflict');
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).items.length, 1);
  assert.equal(repo.writeCount('settings'), 0);
});

test('aktywne lokalizacje obejmują słownik i obecną lokalizację karty produktu', () => {
  const settings = settingsRecord().data;
  const locations = activeInventoryLocations(settings, '31');
  assert.deepEqual(locations.map((item) => item.code), ['LEGACY-P01', 'A-R01-P01', 'B-R02-P03']);
  assert.equal(locations[0].current, true);
  assert.equal(locations.some((item) => item.code === 'ARCHIWUM'), false);
});

test('lokalizacja jest obowiązkowa i dopiero jej osobne przypisanie otwiera potwierdzenie', async () => {
  const repo = repository(), agent = service(repo);
  const created = await draft(agent);

  await assert.rejects(agent.confirm(created.decision.id, { name: 'Tomasz' }), (error) => error.code === 'inventory_decision_location_required');
  await assert.rejects(agent.assignLocation(created.decision.id, 'NIE-MA', { name: 'Tomasz' }), (error) => error.code === 'inventory_decision_location_invalid');
  const assigned = await agent.assignLocation(created.decision.id, 'a r01 p01', { name: 'Tomasz' });
  assert.equal(assigned.decision.status, 'pending_confirmation');
  assert.equal(assigned.decision.location, 'A-R01-P01');
  assert.equal(assigned.decision.expectedLocation, 'LEGACY-P01');
  assert.equal(repo.writeCount('settings'), 0);

  const locationCard = renderInventoryLocationPrompt(created.decision, created.locations);
  const confirmation = renderInventoryDecisionConfirmation(assigned.decision);
  assert.match(locationCard.text, /Nic nie zostało jeszcze zapisane/);
  assert.match(confirmation.text, /osobnym potwierdzeniu/);
  assert.deepEqual(confirmation.replyMarkup.inline_keyboard[0].map((button) => button.text), ['✅ Potwierdzam', '❌ Nie potwierdzam']);
  for (const button of [...locationCard.replyMarkup.inline_keyboard.flat(), ...confirmation.replyMarkup.inline_keyboard.flat()]) {
    assert.ok(Buffer.byteLength(button.callback_data, 'utf8') <= 64);
  }
});

test('osobne potwierdzenie atomowo zapisuje stan i lokalizację dokładnie raz', async () => {
  const repo = repository(), agent = service(repo);
  const created = await draft(agent);
  const assigned = await agent.assignLocation(created.decision.id, 'A-R01-P01', { name: 'Tomasz' });
  assert.equal(assigned.decision.status, 'pending_confirmation');

  const first = await agent.confirm(created.decision.id, { id: '77', name: 'Tomasz' });
  assert.equal(first.decision.status, 'confirmed');
  assert.equal(first.decision.result.before, 1);
  assert.equal(first.decision.result.after, 8);
  assert.equal(first.decision.result.delta, 7);
  assert.equal(repo.read('settings').rev, 11);
  assert.equal(repo.read('settings').data.artway_stany['31'], 8);
  assert.equal(repo.read('settings').data.artway_magazyn_produkty['31'].lokalizacja, 'A-R01-P01');
  assert.equal(repo.read('settings').data.artway_magazyn_produkty['31'].dostawca, 'Alexander');
  assert.equal(repo.read('settings').data.artway_ruchy_magazynowe.length, 1);
  assert.equal(repo.read('settings').data.artway_ruchy_magazynowe[0].sourceRequestId, `inventory-decision:${created.decision.id}`);
  assert.equal(repo.read('settings').data.artway_ruchy_magazynowe[0].lokalizacjaPrzed, 'LEGACY-P01');
  assert.equal(repo.read('settings').data.artway_ruchy_magazynowe[0].lokalizacjaPo, 'A-R01-P01');
  assert.equal(repo.writeCount('settings'), 1);

  const repeated = await agent.confirm(created.decision.id, { id: '77', name: 'Tomasz' });
  assert.equal(repeated.duplicate, true);
  assert.equal(repo.writeCount('settings'), 1);
  assert.equal(repo.read('settings').data.artway_ruchy_magazynowe.length, 1);
});

test('odrzucenie jest idempotentne i nigdy nie mutuje magazynu', async () => {
  const repo = repository(), agent = service(repo);
  const created = await draft(agent);
  await agent.assignLocation(created.decision.id, 'LEGACY-P01', { name: 'Tomasz' });
  const first = await agent.reject(created.decision.id, { id: '77', name: 'Tomasz' });
  const repeated = await agent.reject(created.decision.id, { id: '77', name: 'Tomasz' });
  assert.equal(first.decision.status, 'rejected');
  assert.equal(first.duplicate, false);
  assert.equal(repeated.duplicate, true);
  assert.equal(repo.writeCount('settings'), 0);
  assert.equal(repo.read('settings').data.artway_stany['31'], 1);
  assert.equal(repo.read('settings').data.artway_ruchy_magazynowe.length, 0);
});

test('zmiana stanu unieważnia potwierdzenie i wymaga kolejnego kliknięcia', async () => {
  const repo = repository(), agent = service(repo);
  const created = await draft(agent);
  await agent.assignLocation(created.decision.id, 'A-R01-P01', { name: 'Tomasz' });
  const changed = repo.read('settings');
  changed.rev = 11;
  changed.data.artway_stany['31'] = 3;
  repo.externalSet('settings', changed);

  await assert.rejects(agent.confirm(created.decision.id, { name: 'Tomasz' }), (error) => (
    error.code === 'inventory_decision_stale'
    && error.details.decision.status === 'awaiting_location'
    && error.details.decision.expectedStock === 3
  ));
  assert.equal(repo.read('settings').data.artway_stany['31'], 3);
  assert.equal(repo.read('settings').data.artway_ruchy_magazynowe.length, 0);

  await assert.rejects(agent.confirm(created.decision.id, { name: 'Tomasz' }), (error) => error.code === 'inventory_decision_location_required');
  await agent.assignLocation(created.decision.id, 'A-R01-P01', { name: 'Tomasz' });
  const confirmed = await agent.confirm(created.decision.id, { name: 'Tomasz' });
  assert.equal(confirmed.decision.status, 'confirmed');
  assert.equal(confirmed.decision.result.before, 3);
  assert.equal(confirmed.decision.result.after, 8);
});

test('niezwiązana zmiana globalnej rewizji nie unieważnia odłożonej decyzji produktu', async () => {
  const repo = repository(), agent = service(repo);
  const created = await draft(agent, 'late-confirmation');
  await agent.assignLocation(created.decision.id, 'A-R01-P01', { name: 'Tomasz' });
  const changed = repo.read('settings');
  changed.rev = 11;
  changed.data.artway_ustawienia = { nazwa: 'Artway-TM', baner: 'Nowy tekst' };
  repo.externalSet('settings', changed);

  const confirmed = await agent.confirm(created.decision.id, { name: 'Tomasz' });
  assert.equal(confirmed.decision.status, 'confirmed');
  assert.equal(confirmed.decision.result.before, 1);
  assert.equal(confirmed.decision.result.after, 8);
  assert.deepEqual(repo.read('settings').data.artway_ustawienia, { nazwa: 'Artway-TM', baner: 'Nowy tekst' });
});

test('przypomnienie około 16:00 używa dzierżawy i dopiero complete oznacza slot jako wysłany', async () => {
  const repo = repository(), agent = service(repo);
  const first = await draft(agent, 'reminder-1', 8);
  const second = await draft(agent, 'reminder-2', 5);
  const waiting = await draft(agent, 'waiting-location', 2);
  await agent.assignLocation(first.decision.id, 'A-R01-P01', { name: 'Tomasz' });
  await agent.assignLocation(second.decision.id, 'B-R02-P03', { name: 'Tomasz' });

  const beforeWindow = await agent.prepareReminder(new Date('2026-07-15T13:59:00.000Z')); // 15:59 w Warszawie
  assert.equal(beforeWindow.due, false);
  const reminder = await agent.prepareReminder(new Date('2026-07-15T14:05:00.000Z')); // 16:05 w Warszawie
  assert.equal(reminder.due, true);
  assert.equal(reminder.decisions.length, 3);
  assert.equal(reminder.messages.length, 1);
  assert.equal(reminder.messages[0].replyMarkup.inline_keyboard.length, 3);
  assert.ok(reminder.claimToken);
  assert.ok(reminder.claimExpiresAt);
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).lastReminderSlot, '');
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).items.every((item) => !item.lastReminderAt), true);
  const callbacks = reminder.messages[0].replyMarkup.inline_keyboard.flat().map((button) => button.callback_data);
  assert.equal(new Set(callbacks).size, 6);
  callbacks.forEach((value) => assert.ok(Buffer.byteLength(value, 'utf8') <= 64));
  assert.deepEqual(reminder.messages[0].decisionIds.sort(), [first.decision.id, second.decision.id, waiting.decision.id].sort());
  assert.match(reminder.messages[0].replyMarkup.inline_keyboard[2][0].text, /Użyj LEGACY-P01/);

  const repeated = await agent.prepareReminder(new Date('2026-07-15T14:07:00.000Z'));
  assert.equal(repeated.due, false);
  assert.equal(repeated.reason, 'already_claimed');

  const completed = await agent.completeReminder(reminder.claimToken, new Date('2026-07-15T14:08:00.000Z'));
  assert.equal(completed.completed, true);
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).lastReminderSlot, '2026-07-15T16:00');
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).reminderClaim, null);
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).items.every((item) => item.lastReminderAt === '2026-07-15T14:08:00.000Z'), true);
  const afterComplete = await agent.prepareReminder(new Date('2026-07-15T14:46:00.000Z'));
  assert.equal(afterComplete.due, false);
  assert.equal(afterComplete.reason, 'already_sent');
  const nextDay = await agent.prepareReminder(new Date('2026-07-16T14:02:00.000Z'));
  assert.equal(nextDay.due, true);
});

test('błąd dostawy może zwolnić claim, a kolejny cykl ponawia przypomnienie', async () => {
  const repo = repository(), agent = service(repo);
  await draft(agent, 'release-reminder', 8);
  const first = await agent.prepareReminder(new Date('2026-07-15T14:05:00.000Z'));
  const released = await agent.releaseReminder(first.claimToken);
  assert.equal(released.released, true);
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).lastReminderSlot, '');
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).reminderClaim, null);

  const retry = await agent.prepareReminder(new Date('2026-07-15T14:06:00.000Z'));
  assert.equal(retry.due, true);
  assert.notEqual(retry.claimToken, first.claimToken);
});

test('utknięte potwierdzenie wraca po dzierżawie do bezpiecznej decyzji i przypomnienia', async () => {
  const repo = repository(), agent = service(repo);
  const created = await draft(agent, 'stuck-confirming', 8);
  await agent.assignLocation(created.decision.id, 'A-R01-P01', { name: 'Tomasz' });
  const registry = repo.read(INVENTORY_DECISIONS_KEY);
  registry.items[0] = {
    ...registry.items[0], status: 'confirming',
    confirmationStartedAt: '2026-07-15T13:55:00.000Z', updatedAt: '2026-07-15T13:55:00.000Z',
  };
  repo.externalSet(INVENTORY_DECISIONS_KEY, registry);

  const reminder = await agent.prepareReminder(new Date('2026-07-15T14:05:00.000Z'));
  assert.equal(reminder.due, true);
  assert.equal(reminder.decisions[0].status, 'pending_confirmation');
  assert.match(reminder.decisions[0].lastError, /nie zakończyła się jednoznacznie/);
  assert.equal(repo.read('settings').data.artway_ruchy_magazynowe.length, 0);
});

test('równoległe crony nie mogą przejąć tego samego slotu ani zwolnić cudzego claimu', async () => {
  const repo = repository(), agent = service(repo);
  await draft(agent, 'parallel-reminder', 8);
  const at = new Date('2026-07-15T14:05:00.000Z');
  const results = await Promise.all([agent.prepareReminder(at), agent.prepareReminder(at), agent.prepareReminder(at)]);
  const claimed = results.filter((result) => result.due);
  assert.equal(claimed.length, 1);
  assert.equal(results.filter((result) => result.reason === 'already_claimed').length, 2);
  await assert.rejects(agent.releaseReminder('cudzy-token'), (error) => error.code === 'inventory_reminder_claim_invalid');
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).reminderClaim.token, claimed[0].claimToken);
});

test('wygasła krótka dzierżawa może zostać bezpiecznie przejęta przez kolejny cron', async () => {
  const repo = repository(), agent = createInventoryDecisionService({
    settingsReadVersioned: repo.readVersioned,
    settingsWriteIfVersion: repo.writeIfVersion,
    decisionsReadVersioned: repo.readVersioned,
    decisionsWriteIfVersion: repo.writeIfVersion,
    reminderLeaseMs: 30_000,
    now: () => new Date('2026-07-15T14:05:00.000Z'),
  });
  await draft(agent, 'lease-expiry', 8);
  const first = await agent.prepareReminder(new Date('2026-07-15T14:05:00.000Z'));
  const second = await agent.prepareReminder(new Date('2026-07-15T14:05:31.000Z'));
  assert.equal(second.due, true);
  assert.notEqual(second.claimToken, first.claimToken);
  await assert.rejects(agent.completeReminder(first.claimToken), (error) => error.code === 'inventory_reminder_claim_invalid');
  assert.equal(repo.read(INVENTORY_DECISIONS_KEY).reminderClaim.token, second.claimToken);
});

test('długie nazwy tworzą wieloczęściowe wiadomości poniżej bezpiecznego limitu Telegrama', () => {
  const decisions = Array.from({ length: 25 }, (_, index) => ({
    id: `IV${index.toString(16).padStart(14, '0')}`,
    requestId: `long-${index}`,
    status: 'pending_confirmation',
    productId: String(index + 1),
    product: { name: `${'Bardzo długa nazwa produktu ąęł '.repeat(12)}${index}` },
    mode: 'set',
    quantity: 8,
    expectedStock: 1,
    expectedRev: 10,
    after: 8,
    location: 'A-R01-P01',
  }));
  const messages = renderInventoryDecisionReminder(decisions);
  assert.ok(messages.length > 2);
  assert.equal(messages.reduce((count, message) => count + message.decisionIds.length, 0), decisions.length);
  assert.equal(messages.reduce((count, message) => count + message.replyMarkup.inline_keyboard.length, 0), decisions.length);
  messages.forEach((message) => assert.ok(Buffer.byteLength(message.text, 'utf8') <= 3800));
  const callbacks = messages.flatMap((message) => message.replyMarkup.inline_keyboard.flat().map((button) => button.callback_data));
  assert.equal(new Set(callbacks).size, decisions.length * 2);
});

test('callbacki Telegram są krótkie i jednoznacznie parsowane', async () => {
  const repo = repository(), agent = service(repo);
  const created = await draft(agent);
  const confirm = inventoryDecisionCallback('confirm', created.decision.id);
  const reject = inventoryDecisionCallback('reject', created.decision.id);
  const location = inventoryDecisionCallback('location', created.decision.id, 'A-R01-P01');
  assert.deepEqual(parseInventoryDecisionCallback(confirm), { action: 'confirm', id: created.decision.id });
  assert.deepEqual(parseInventoryDecisionCallback(reject), { action: 'reject', id: created.decision.id });
  assert.deepEqual(parseInventoryDecisionCallback(location), { action: 'location', id: created.decision.id, location: 'A-R01-P01' });
  assert.equal(parseInventoryDecisionCallback('tg:resolve:123'), null);
  assert.ok(Buffer.byteLength(location, 'utf8') <= 64);
});

test('przypomnienie szkicu bez propozycji lokalizacji prowadzi do panelu i pozwala odrzucić', () => {
  const messages = renderInventoryDecisionReminder([{
    id: 'IV0123456789abcd', requestId: 'no-location', status: 'awaiting_location', productId: '31', product: PRODUCT,
    mode: 'set', quantity: 8, expectedStock: 1, expectedRev: 10, after: 8, suggestedLocation: '',
  }]);
  assert.equal(messages.length, 1);
  const [open, reject] = messages[0].replyMarkup.inline_keyboard[0];
  assert.equal(open.url, 'https://artwaytm.pl/#/admin/magazyn/stany');
  assert.equal(parseInventoryDecisionCallback(reject.callback_data).action, 'reject');
});
