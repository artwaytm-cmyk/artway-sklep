import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BENCHMARK_DATABASE,
  BENCHMARK_ROLE,
  assertIsolatedBenchmarkIdentity,
} from '../scripts/lib/benchmark-database-guard.mjs';

test('benchmark przyjmuje wyłącznie osobną bazę i nieuprzywilejowaną rolę', () => {
  assert.deepEqual(assertIsolatedBenchmarkIdentity({
    database: BENCHMARK_DATABASE,
    role: BENCHMARK_ROLE,
    superuser: false,
  }), { database: BENCHMARK_DATABASE, role: BENCHMARK_ROLE, superuser: false });
  assert.throws(() => assertIsolatedBenchmarkIdentity({ database: 'artway', role: BENCHMARK_ROLE }), /Benchmark zablokowany/);
  assert.throws(() => assertIsolatedBenchmarkIdentity({ database: BENCHMARK_DATABASE, role: 'artway' }), /Benchmark zablokowany/);
  assert.throws(() => assertIsolatedBenchmarkIdentity({ database: BENCHMARK_DATABASE, role: BENCHMARK_ROLE, superuser: true }), /Benchmark zablokowany/);
});

test('benchmark nie odczytuje produkcyjnego DATABASE_URL ani konfiguracji systemd', async () => {
  const [benchmark, runner, setup, pkg] = await Promise.all([
    readFile('scripts/benchmark-large-catalog.mjs', 'utf8'),
    readFile('scripts/run-isolated-catalog-benchmark.mjs', 'utf8'),
    readFile('ops/postgres/setup-isolated-benchmark.sh', 'utf8'),
    readFile('package.json', 'utf8'),
  ]);
  assert.doesNotMatch(benchmark, /process\.env\.DATABASE_URL|\.env\.netlify|artway-backend\.service/);
  assert.match(benchmark, /ARTWAY_BENCHMARK_DATABASE_URL/);
  assert.match(benchmark, /verifyIsolatedBenchmarkDatabase\(pool\)/);
  assert.match(runner, /BENCHMARK_DATABASE/);
  assert.match(runner, /BENCHMARK_ROLE/);
  assert.match(setup, /REVOKE CONNECT, TEMPORARY ON DATABASE artway FROM PUBLIC/);
  assert.match(setup, /GRANT CONNECT, TEMPORARY ON DATABASE artway TO artway, postgres/);
  assert.match(setup, /REVOKE CONNECT, TEMPORARY ON DATABASE artway_benchmark FROM PUBLIC/);
  assert.match(pkg, /benchmark:setup/);
  assert.match(pkg, /run-isolated-catalog-benchmark\.mjs/);
});
