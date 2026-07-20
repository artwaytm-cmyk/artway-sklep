import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRevisionSafeMutator, createRevisionSafeWriter } from '../netlify/functions/lib/core/store-repository.mjs';

test('stary pełny zapis settings nie może nadpisać nowszej korekty magazynu', async () => {
  let current = { value: { rev: 10, data: { artway_stany: { 31: 1 } } }, etag: 'v10', exists: true };
  const repository = {
    readVersioned: async () => structuredClone(current),
    writeIfVersion: async (_key, value, version) => {
      if (version.etag !== current.etag) return { modified: false };
      current = { value: structuredClone(value), etag: `v${value.rev}`, exists: true };
      return { modified: true };
    },
  };
  const write = createRevisionSafeWriter(repository);
  const staleFullRecord = { rev: 11, data: { artway_stany: { 31: 1 }, other: 'stary formularz' } };

  current = { value: { rev: 11, data: { artway_stany: { 31: 8 }, movement: 'MAG-1' } }, etag: 'inventory-v11', exists: true };
  await assert.rejects(write(staleFullRecord), (error) => error.code === 'settings_write_conflict' && error.status === 409);
  assert.equal(current.value.data.artway_stany['31'], 8);
  assert.equal(current.value.data.movement, 'MAG-1');
});

test('świeży następny rekord jest zapisywany warunkowo po ETag', async () => {
  let current = { value: { rev: 4, data: {} }, etag: 'v4', exists: true };
  const repository = {
    readVersioned: async () => structuredClone(current),
    writeIfVersion: async (_key, value, version) => {
      assert.equal(version.etag, 'v4');
      current = { value: structuredClone(value), etag: 'v5', exists: true };
      return { modified: true };
    },
  };
  await createRevisionSafeWriter(repository)({ rev: 5, data: { ok: true } });
  assert.equal(current.value.rev, 5);
});

test('automatyczna aktualizacja produktu ponawia zapis i zachowuje równoległą zmianę administratora', async () => {
  let current = { value: { rev: 20, data: { product: { name: 'Gra', description: 'stary' }, adminLayout: 'jasny' } }, etag: 'v20', exists: true };
  let writes = 0;
  const repository = {
    readVersioned: async () => structuredClone(current),
    writeIfVersion: async (_key, value, version) => {
      writes++;
      if (writes === 1) {
        current = { value: { ...current.value, rev: 21, data: { ...current.value.data, adminLayout: 'nowy układ' } }, etag: 'admin-v21', exists: true };
      }
      if (version.etag !== current.etag) return { modified: false };
      current = { value: structuredClone(value), etag: `v${value.rev}`, exists: true };
      return { modified: true };
    },
  };

  const result = await createRevisionSafeMutator(repository)(async (data) => {
    data.product = { ...data.product, description: 'opis poprawiony przez Allegro' };
    return true;
  });

  assert.equal(result.attempts, 2);
  assert.equal(current.value.rev, 22);
  assert.equal(current.value.data.adminLayout, 'nowy układ');
  assert.equal(current.value.data.product.description, 'opis poprawiony przez Allegro');
});

test('mutator nie tworzy rewizji, gdy aktualizacja nie ma już nic do zapisania', async () => {
  let writes = 0;
  const repository = {
    readVersioned: async () => ({ value: { rev: 7, data: { ready: true } }, etag: 'v7', exists: true }),
    writeIfVersion: async () => { writes++; return { modified: true }; },
  };
  const result = await createRevisionSafeMutator(repository)(async () => false);
  assert.equal(result.modified, false);
  assert.equal(writes, 0);
});

test('zwykły zapis wysyła tylko zmienione dziedziny i serwer scala je warunkowo', () => {
  const frontend = fs.readFileSync(new URL('../src/frontend/03-cloud-sync.js', import.meta.url), 'utf8');
  const backend = fs.readFileSync(new URL('../netlify/functions/lib/store-data-route.mjs', import.meta.url), 'utf8');
  assert.match(frontend, /chmuraBrudneKlucze = new Set\(\)/);
  assert.match(frontend, /body:\{mode:"patch",patch,expectedRev,mutationId\}/);
  assert.match(frontend, /chmuraPominBrudneDaneSerwera/);
  assert.match(backend, /if \(body\.mode === 'patch'\)/);
  assert.match(backend, /\.\.\.\(prev\.data \|\| \{\}\), \.\.\.patch/);
  assert.match(backend, /last_mutation_id === mutationId/);
  assert.match(backend, /for \(let attempt = 0; attempt < 5; attempt\+\+\)/);
});

test('ręczny zgodnościowy pełny zapis nadal egzekwuje oczekiwaną rewizję', () => {
  const backend = fs.readFileSync(new URL('../netlify/functions/lib/store-data-route.mjs', import.meta.url), 'utf8');
  assert.match(backend, /const expectedRev = Number\(body\.expectedRev\)/);
  assert.match(backend, /Number\(prev\.rev \|\| 0\) !== expectedRev/);
  assert.match(backend, /zapiszJesliWersja\('settings', rec, version\)/);
});
