import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { createEmailService } from '../netlify/functions/lib/email-service.mjs';

const cloudSource = await fs.readFile(new URL('../src/frontend/03-cloud-sync.js', import.meta.url), 'utf8');
const adminNavigationSource = await fs.readFile(new URL('../src/frontend/08-admin-navigation.js', import.meta.url), 'utf8');
const integrationCenterSource = await fs.readFile(new URL('../src/frontend/11-integration-center.js', import.meta.url), 'utf8');
const shippingSource = await fs.readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
const storeSource = await fs.readFile(new URL('../netlify/functions/lib/store-app.mjs', import.meta.url), 'utf8');
const systemRouteSource = await fs.readFile(new URL('../netlify/functions/lib/system-route.mjs', import.meta.url), 'utf8');
const inpostRouteSource = await fs.readFile(new URL('../netlify/functions/lib/inpost-route.mjs', import.meta.url), 'utf8');
const securitySource = await fs.readFile(new URL('../netlify/functions/lib/core/security.mjs', import.meta.url), 'utf8');

test('maska hasła SMTP nigdy nie jest uznawana za działające poświadczenie', () => {
  const previous = { ...process.env };
  Object.assign(process.env, {
    EMAIL_PROVIDER: 'gmail', SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_SECURE: 'true',
    SMTP_USER: 'sklep@example.com', SMTP_PASS: '****************smtp', EMAIL_FROM: 'sklep@example.com',
  });
  try {
    const service = createEmailService({ read: async () => ({}), write: async () => ({}) });
    const config = service.emailPublicConfig();
    assert.equal(config.configured, false);
    assert.equal(config.authenticated, false);
    assert.equal(config.credentialIssue, 'masked_placeholder');
    assert.equal('pass' in config, false);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test('panel używa odnawialnej sesji administratora zamiast proszenia o token bazy', () => {
  assert.match(adminNavigationSource, /chmuraOdswiezSesjeAdministratora/);
  assert.match(adminNavigationSource, /session-refresh/);
  assert.doesNotMatch(cloudSource, /prompt\("Wklej hasło administratora wspólnej bazy/);
  assert.match(securitySource, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(systemRouteSource, /action === 'session-refresh'/);
  assert.match(securitySource, /HttpOnly/);
  assert.doesNotMatch(securitySource, /ARTWAY_SESSION_SECRET \|\| process\.env\.ARTWAY_ADMIN_TOKEN/);
});

test('InPost i SMTP mają rzeczywiste testy serwerowe z trwałą historią zdrowia', () => {
  assert.match(storeSource, /action === 'email-test'/);
  assert.match(storeSource, /sprawdzEmailSMTP\(\{ force: true \}\)/);
  assert.match(storeSource, /zapisz\('integration_health'/);
  assert.match(inpostRouteSource, /action === 'inpost-test'[\s\S]*?organizationId/);
  assert.match(shippingSource, /sprawdzPolaczeniaSerwerowe/);
  assert.match(integrationCenterSource, /bez tokenów w przeglądarce/);
});
