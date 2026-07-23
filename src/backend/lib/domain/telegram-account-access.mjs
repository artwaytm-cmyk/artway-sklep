function text(value = '', limit = 200) {
  return String(value ?? '').trim().slice(0, limit);
}

function telegramUserId(value = '') {
  const id = text(value, 100);
  return /^[1-9]\d*$/.test(id) ? id : '';
}

export function telegramAccountAccess(user = {}) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return null;
  const userId = telegramUserId(user.telegramUserId || user.telegramChatId);
  const admin = String(user.rola || user.role || '').toLowerCase() === 'admin';
  if (!admin || user.telegramAccess !== true || !userId) return null;
  return {
    userId,
    approver: user.telegramApprover === true,
    email: text(user.email, 200).toLowerCase(),
    name: text(user.imie || user.name || user.email || 'Administrator', 160),
  };
}

export function telegramAccountAccessList(users = []) {
  const byId = new Map();
  for (const user of Array.isArray(users) ? users : []) {
    const access = telegramAccountAccess(user);
    if (access) byId.set(access.userId, { ...(byId.get(access.userId) || {}), ...access });
  }
  return [...byId.values()];
}

export function applyTelegramAccountAccess(config = {}, users = []) {
  const accounts = telegramAccountAccessList(users);
  const next = {
    ...config,
    allowedChatIds: new Set(config.allowedChatIds instanceof Set ? config.allowedChatIds : []),
    allowedUserIds: new Set(config.allowedUserIds instanceof Set ? config.allowedUserIds : []),
    approverUserIds: new Set(config.approverUserIds instanceof Set ? config.approverUserIds : []),
    teamUserIds: new Set(config.teamUserIds instanceof Set ? config.teamUserIds : []),
  };
  for (const account of accounts) {
    next.allowedChatIds.add(account.userId);
    next.allowedUserIds.add(account.userId);
    next.teamUserIds.add(account.userId);
    if (account.approver) next.approverUserIds.add(account.userId);
  }
  next.allowlistCounts = {
    ...(config.allowlistCounts || {}),
    accounts: accounts.length,
    accountApprovers: accounts.filter((item) => item.approver).length,
    chats: next.allowedChatIds.size,
    users: new Set([...next.allowedUserIds, ...next.allowedChatIds].filter((value) => /^[1-9]\d*$/.test(value))).size,
    approvers: next.approverUserIds.size,
  };
  return next;
}

export function normalizeTelegramAccountFields(user = {}) {
  const source = user && typeof user === 'object' && !Array.isArray(user) ? user : {};
  const mentioned = ['telegramUserId', 'telegramChatId', 'telegramAccess', 'telegramApprover']
    .some((key) => Object.prototype.hasOwnProperty.call(source, key));
  if (!mentioned) return {};
  const userId = telegramUserId(source.telegramUserId || source.telegramChatId);
  const admin = String(source.rola || source.role || '').toLowerCase() === 'admin';
  const access = admin && source.telegramAccess === true && Boolean(userId);
  return {
    telegramUserId: userId,
    telegramAccess: access,
    telegramApprover: access && source.telegramApprover === true,
  };
}
