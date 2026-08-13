import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const services = [
  'artway-backend.service',
  'artway-agent.service',
  'artway-allegro-sync.service',
  'artway-von-halsky-sync.service',
  'artway-postgres-migrate.service',
  'artway-postgres-maintain.service',
  'artway-postgres-observe.service',
  'artway-seo-daily.service',
];

const required = [
  'NoNewPrivileges=true',
  'CapabilityBoundingSet=',
  'PrivateDevices=true',
  'PrivateMounts=true',
  'ProtectSystem=strict',
  'ProtectKernelTunables=true',
  'ProtectKernelModules=true',
  'ProtectKernelLogs=true',
  'ProtectControlGroups=true',
  'ProtectClock=true',
  'ProtectHostname=true',
  'ProtectProc=invisible',
  'ProcSubset=pid',
  'RestrictNamespaces=true',
  'RestrictRealtime=true',
  'RestrictSUIDSGID=true',
  'RemoveIPC=true',
  'LockPersonality=true',
  'SystemCallArchitectures=native',
  'SystemCallFilter=@system-service',
];

test('usługi aplikacyjne mają wspólny, rygorystyczny profil izolacji systemd', async () => {
  for (const service of services) {
    const source = await readFile(`ops/systemd/${service}`, 'utf8');
    for (const directive of required) {
      assert.ok(source.includes(directive), `${service}: brak ${directive}`);
    }
    assert.match(source, /^ProtectHome=(?:true|tmpfs)$/m, `${service}: katalog domowy nie jest chroniony`);
    assert.doesNotMatch(source, /MemoryDenyWriteExecute=true/, `${service}: V8 wymaga bezpiecznego JIT`);
  }
});
