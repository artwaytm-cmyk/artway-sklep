import test from 'node:test';
import assert from 'node:assert/strict';
import { telegramActorAllowed } from '../netlify/functions/lib/domain/telegram-communication.mjs';

test('Telegram wymaga dozwolonego czatu i konkretnego użytkownika grupy', () => {
  const config = { allowedChatIds: new Set(['100', '-200']), allowedUserIds: new Set() };
  assert.equal(telegramActorAllowed(config, { chatId: '100', userId: '100', chatType: 'private' }), true);
  assert.equal(telegramActorAllowed(config, { chatId: '-200', userId: '100', chatType: 'group' }), true);
  assert.equal(telegramActorAllowed(config, { chatId: '-200', userId: '999', chatType: 'group' }), false);
  assert.equal(telegramActorAllowed(config, { chatId: '-999', userId: '100', chatType: 'group' }), false);
});
test('jawna lista użytkowników grupy rozszerza właściciela bez odbierania mu dostępu', () => {
  const config = { allowedChatIds: new Set(['100', '-200']), allowedUserIds: new Set(['300']) };
  assert.equal(telegramActorAllowed(config, { chatId: '-200', userId: '300', chatType: 'supergroup' }), true);
  assert.equal(telegramActorAllowed(config, { chatId: '-200', userId: '100', chatType: 'supergroup' }), true);
  assert.equal(telegramActorAllowed(config, { chatId: '-200', userId: '999', chatType: 'supergroup' }), false);
  assert.equal(telegramActorAllowed(config, { chatId: '-999', userId: '300', chatType: 'supergroup' }), false);
});
