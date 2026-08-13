import { spawnSync } from 'node:child_process';
import { userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';
import { BENCHMARK_DATABASE, BENCHMARK_ROLE } from './lib/benchmark-database-guard.mjs';

const benchmarkScript = fileURLToPath(new URL('./benchmark-large-catalog.mjs', import.meta.url));
const benchmarkUrl = `postgresql:///${BENCHMARK_DATABASE}?host=/var/run/postgresql`;
const forwardedArguments = process.argv.slice(2);
const environment = `ARTWAY_BENCHMARK_DATABASE_URL=${benchmarkUrl}`;

let result;
if (userInfo().username === BENCHMARK_ROLE) {
  result = spawnSync(process.execPath, [benchmarkScript, ...forwardedArguments], {
    cwd: process.cwd(),
    env: { ...process.env, ARTWAY_BENCHMARK_DATABASE_URL: benchmarkUrl },
    stdio: 'inherit',
  });
} else {
  result = spawnSync('sudo', [
    '-n', '-u', BENCHMARK_ROLE, '--', '/usr/bin/env', environment,
    process.execPath, benchmarkScript, ...forwardedArguments,
  ], { cwd: process.cwd(), stdio: 'inherit' });
}

if (result.error) throw result.error;
process.exitCode = Number.isInteger(result.status) ? result.status : 1;
