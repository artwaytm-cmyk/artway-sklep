import test from 'node:test';
import assert from 'node:assert/strict';
import { telegramActorAllowed, telegramApproverAllowed, telegramConfig } from '../src/backend/lib/domain/telegram-communication.mjs';

test('Telegram wymaga dozwolonego czatu i konkretnego użytkownika grupy', () => {
  const config = { allowedChatIds: new Set(['100', '-200']), allowedUserIds: new Set() };
  assert.equal(telegramActorAllowed(config, { chatId: '100', userId: '100', chatType: 'private' }), true);
  assert.equal(telegramActorAllowed(config, { chatId: '-200', userId: '100', chatType: 'group' }), true);
  assert.equal(telegramActorAllowed(config, { chatId: '-200', userId: '999', chatType: 'group' }), false);
  assert.equal(telegramActorAllowed(config, { chatId: '-999', userId: '100', chatType: 'group' }), false);
});

test('status allowlisty rozdziela właściciela bootstrap od jawnie dodanych osób bez ujawniania ID', () => {
  const config = telegramConfig({
    TELEGRAM_CHAT_ID: '100', TELEGRAM_GROUP_ID: '-200', TELEGRAM_ALLOWED_CHAT_IDS: '-300', TELEGRAM_ALLOWED_USER_IDS: '300,301',
  });
  assert.deepEqual(config.allowlistCounts, {
    chats: 3, users: 3, approvers: 1, ownerBootstrap: 1, chatBootstrap: 2, explicitChats: 1, explicitUsers: 2, explicitApprovers: 0,
  });
});
test('jawna lista użytkowników grupy rozszerza właściciela bez odbierania mu dostępu', () => {
  const config = { allowedChatIds: new Set(['100', '-200']), allowedUserIds: new Set(['300']) };
  assert.equal(telegramActorAllowed(config, { chatId: '300', userId: '300', chatType: 'private' }), true);
  assert.equal(telegramActorAllowed(config, { chatId: '-200', userId: '300', chatType: 'supergroup' }), true);
  assert.equal(telegramActorAllowed(config, { chatId: '-200', userId: '100', chatType: 'supergroup' }), true);
  assert.equal(telegramActorAllowed(config, { chatId: '-200', userId: '999', chatType: 'supergroup' }), false);
  assert.equal(telegramActorAllowed(config, { chatId: '-999', userId: '300', chatType: 'supergroup' }), false);
});

test('zatwierdzający jest osobną rolą: dodatni TELEGRAM_CHAT_ID plus jawna lista administratorów', () => {
  const config = telegramConfig({
    TELEGRAM_CHAT_ID: '100', TELEGRAM_GROUP_ID: '-200',
    TELEGRAM_ALLOWED_USER_IDS: '300,301', TELEGRAM_APPROVER_USER_IDS: '301,302,-500,abc',
  });
  assert.equal(telegramApproverAllowed(config, { userId: '100' }), true, 'właściciel z dodatniego TELEGRAM_CHAT_ID');
  assert.equal(telegramApproverAllowed(config, { userId: '301' }), true, 'jawny zatwierdzający');
  assert.equal(telegramApproverAllowed(config, { userId: '300' }), false, 'dozwolony użytkownik nie staje się automatycznie zatwierdzającym');
  assert.equal(telegramApproverAllowed(config, { userId: '-500' }), false);
  assert.equal(telegramApproverAllowed(config, { userId: 'abc' }), false);
  assert.deepEqual(config.allowlistCounts, {
    chats: 2, users: 3, approvers: 3, ownerBootstrap: 1, chatBootstrap: 2, explicitChats: 0, explicitUsers: 2, explicitApprovers: 2,
  });
  assert.equal(JSON.stringify(config.allowlistCounts).includes('301'), false, 'status nie ujawnia identyfikatorów');
});

test('ujemny TELEGRAM_CHAT_ID grupy nie nadaje roli zatwierdzającego', () => {
  const config = telegramConfig({ TELEGRAM_CHAT_ID: '-200' });
  assert.equal(config.approverUserIds.size, 0);
  assert.equal(telegramApproverAllowed(config, { userId: '200' }), false);
});
