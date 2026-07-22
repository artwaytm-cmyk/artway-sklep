import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTelegramAccountAccess,
  normalizeTelegramAccountFields,
  telegramAccountAccess,
  telegramAccountAccessList,
} from '../netlify/functions/lib/domain/telegram-account-access.mjs';

test('konto administratora automatycznie rozszerza wspólny czat bez restartu', () => {
  const config = applyTelegramAccountAccess({
    allowedChatIds: new Set(['100']), allowedUserIds: new Set(), approverUserIds: new Set(['100']), teamUserIds: new Set(['100']),
    allowlistCounts: { chats: 1, users: 1, approvers: 1 },
  }, [
    { email: 'operator@example.test', imie: 'Operator', rola: 'admin', telegramUserId: '300', telegramAccess: true },
    { email: 'klient@example.test', rola: 'klient', telegramUserId: '400', telegramAccess: true },
  ]);
  assert.equal(config.allowedChatIds.has('300'), true);
  assert.equal(config.allowedUserIds.has('300'), true);
  assert.equal(config.teamUserIds.has('300'), true);
  assert.equal(config.approverUserIds.has('300'), false, 'dostęp do rozmowy nie nadaje prawa zatwierdzania');
  assert.equal(config.teamUserIds.has('400'), false, 'konto klienta nie może dostać dostępu operacyjnego');
  assert.equal(config.allowlistCounts.accounts, 1);
});

test('zatwierdzanie jest osobnym uprawnieniem konta', () => {
  const access = telegramAccountAccess({ rola: 'admin', telegramUserId: '300', telegramAccess: true, telegramApprover: true });
  assert.deepEqual(access, { userId: '300', approver: true, email: '', name: 'Administrator' });
  assert.equal(telegramAccountAccess({ rola: 'admin', telegramUserId: 'abc', telegramAccess: true }), null);
  assert.equal(telegramAccountAccess({ rola: 'klient', telegramUserId: '300', telegramAccess: true }), null);
  assert.equal(telegramAccountAccessList([
    { rola: 'admin', telegramUserId: '300', telegramAccess: true },
    { rola: 'admin', telegramUserId: '300', telegramAccess: true, telegramApprover: true },
  ]).length, 1);
});

test('zapis konta czyści błędne ID i odbiera dostęp po zmianie roli', () => {
  assert.deepEqual(normalizeTelegramAccountFields({ rola: 'admin', telegramUserId: '00300', telegramAccess: true, telegramApprover: true }), {
    telegramUserId: '', telegramAccess: false, telegramApprover: false,
  });
  assert.deepEqual(normalizeTelegramAccountFields({ rola: 'klient', telegramUserId: '300', telegramAccess: true, telegramApprover: true }), {
    telegramUserId: '300', telegramAccess: false, telegramApprover: false,
  });
  assert.deepEqual(normalizeTelegramAccountFields({ email: 'bez-zmian@example.test' }), {});
});
