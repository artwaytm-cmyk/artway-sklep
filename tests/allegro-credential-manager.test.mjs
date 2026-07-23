import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAllegroCredentialManager } from '../src/backend/lib/domain/allegro-credential-manager.mjs';

test('sejf odrzuca maskę i zapisuje dopiero dane potwierdzone przez Allegro', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'artway-allegro-')), file = join(dir, 'allegro.env'), env = {};
  let calls = 0;
  const manager = createAllegroCredentialManager({ filePath: file, env, fetchImpl: async () => { calls += 1; return { ok: true, json: async () => ({}) }; } });
  await assert.rejects(() => manager.save({ clientId: '****************a123', clientSecret: '****************b456' }), (error) => error.code === 'allegro_credentials_masked');
  assert.equal(calls, 0);
  const result = await manager.save({ clientId: 'real-client-id-12345', clientSecret: 'real-client-secret-67890' });
  assert.equal(result.verified, true);
  assert.equal(calls, 1);
  const stored = await readFile(file, 'utf8');
  assert.match(stored, /^ALLEGRO_CLIENT_ID="real-client-id-12345"/m);
  assert.equal(env.ALLEGRO_CLIENT_SECRET, 'real-client-secret-67890');
  await rm(dir, { recursive: true, force: true });
});

test('sejf nie zapisuje danych odrzuconych przez OAuth', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'artway-allegro-')), file = join(dir, 'allegro.env');
  const manager = createAllegroCredentialManager({ filePath: file, env: {}, fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }) });
  await assert.rejects(() => manager.save({ clientId: 'wrong-client-id-1234', clientSecret: 'wrong-secret-567890' }), (error) => error.code === 'invalid_client');
  await assert.rejects(() => readFile(file, 'utf8'));
  await rm(dir, { recursive: true, force: true });
});
