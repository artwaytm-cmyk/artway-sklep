import test from 'node:test';
import assert from 'node:assert/strict';
import { createInfaktService, infaktCredentialLooksMasked } from '../netlify/functions/lib/infakt-service.mjs';

test('inFakt nie uznaje maski sekretu za działający klucz API', async () => {
  const previous = process.env.INFAKT_API_KEY;
  process.env.INFAKT_API_KEY = '****************api';
  try {
    const service = createInfaktService({ read: async () => ({}), write: async () => ({}) });
    const config = service.infaktPublicConfig();
    assert.equal(config.configured, false);
    assert.equal(config.credentialStored, true);
    assert.equal(config.credentialIssue, 'masked_placeholder');
    assert.equal('apiKey' in config, false);
    await assert.rejects(() => service.infaktWywolaj('/api/v3/invoices.json'), (error) => error.code === 'infakt_credential_masked' && error.status === 503);
  } finally {
    if (previous === undefined) delete process.env.INFAKT_API_KEY;
    else process.env.INFAKT_API_KEY = previous;
  }
});

test('rozpoznawanie maski nie odrzuca zwykłego tokenu', () => {
  assert.equal(infaktCredentialLooksMasked('****************'), true);
  assert.equal(infaktCredentialLooksMasked('<ukryty-klucz>'), true);
  assert.equal(infaktCredentialLooksMasked('abc123-real-looking-token-456'), false);
});

