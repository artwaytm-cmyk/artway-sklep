export function createStoreDataAccountHelpers(deps = {}) {
  const {
    read, save, text, publicUser, respond, decryptMfaSecret,
    createMfaEnrollment, createAdminMfaChallenge, mfaProvisioningUri,
  } = deps;

  const accessAudit = async (entry = {}) => {
    const now = new Date().toISOString();
    const record = await read('user_access_audit', { items: [] });
    const items = Array.isArray(record.items) ? record.items : [];
    items.unshift({ id: `access-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, at: now, ...entry });
    await save('user_access_audit', { items: items.slice(0, 5000), updated_at: now });
  };

  const adminUserRecord = (user = {}) => {
    const optional = {};
    const copyText = (key, max) => {
      const value = text(user[key], max);
      if (value) optional[key] = value;
    };
    for (const [key, max] of [
      ['telefon', 80], ['ulica', 200], ['nrDomu', 40], ['nrLokalu', 40], ['kod', 20],
      ['miasto', 160], ['nip', 20], ['firma', 240], ['notatka', 1000], ['data', 80],
      ['telegramUserId', 100], ['roleUpdatedBy', 200], ['passwordChangedAt', 80],
    ]) copyText(key, max);
    if (user.account === true) optional.account = true;
    if (user.telegramAccess === true) optional.telegramAccess = true;
    if (user.telegramApprover === true) optional.telegramApprover = true;
    if (user.passwordHash) optional.hasPassword = true;
    return { ...publicUser(user), ...optional };
  };

  const beginAdminMfa = async (admin, items) => {
    let secret = decryptMfaSecret(admin.mfaSecretEncrypted);
    const setup = !secret;
    if (!secret) {
      secret = decryptMfaSecret(admin.mfaPendingSecretEncrypted);
      if (!secret) {
        const enrollment = createMfaEnrollment(admin.email);
        secret = enrollment.secret;
        admin.mfaPendingSecretEncrypted = enrollment.encryptedSecret;
        admin.mfaPendingCreatedAt = new Date().toISOString();
        await save('users', { items, updated_at: new Date().toISOString() });
      }
    }
    return respond({
      ok: true,
      authenticated: false,
      mfaRequired: true,
      mfaSetupRequired: setup,
      challengeToken: createAdminMfaChallenge(admin.email, setup),
      ...(setup ? { provisioningUri: mfaProvisioningUri(admin.email, secret) } : {}),
    });
  };

  return { accessAudit, adminUserRecord, beginAdminMfa };
}
