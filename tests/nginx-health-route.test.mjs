import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const configPath = 'ops/nginx/artway-health.conf';

test('publiczny healthz omija SPA i sprawdza rzeczywisty backend', async () => {
  const source = await readFile(configPath, 'utf8');
  const directives = source.replace(/#.*$/gm, '');
  assert.match(source, /location\s*=\s*\/healthz\s*\{/);
  assert.match(source, /proxy_pass\s+http:\/\/127\.0\.0\.1:3000\/healthz;/);
  assert.doesNotMatch(directives, /try_files|index\.html/);
  assert.match(source, /proxy_connect_timeout\s+2s;/);
  assert.match(source, /proxy_read_timeout\s+3s;/);
  assert.match(source, /proxy_buffering\s+off;/);
});

test('awaria backendu healthz zwraca 503 JSON bez możliwości cache', async () => {
  const source = await readFile(configPath, 'utf8');
  assert.match(source, /proxy_intercept_errors\s+on;/);
  assert.match(source, /error_page\s+500\s+502\s+503\s+504\s+=503\s+@artway_health_unavailable;/);
  assert.match(source, /location\s+@artway_health_unavailable\s*\{/);
  assert.match(source, /default_type\s+application\/json;/);
  assert.match(source, /add_header\s+Cache-Control\s+"no-store"\s+always;/);
  assert.match(source, /return\s+503\s+'\{"ok":false,"service":"artway-vps","error":"backend_unavailable"\}';/);
});
