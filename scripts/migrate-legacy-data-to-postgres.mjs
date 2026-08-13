import crypto from 'node:crypto';
import { createPostgresStoreRepository } from '../src/backend/lib/core/postgres-store-repository.mjs';

const sourceUrl = String(process.env.ARTWAY_SOURCE_URL || 'https://artwaytm.pl').replace(/\/$/, '');
const adminToken = process.env.ARTWAY_SOURCE_ADMIN_TOKEN || process.env.ARTWAY_ADMIN_TOKEN || '';
if (!adminToken) throw new Error('Brak ARTWAY_SOURCE_ADMIN_TOKEN lub ARTWAY_ADMIN_TOKEN.');

const target = createPostgresStoreRepository({ name: 'artway-sklep' });
const headers = { accept: 'application/json', 'x-admin-token': adminToken };

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

async function json(url) {
  const response = await fetch(url, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(`${body.code || 'migration_http_error'}: ${body.error || `HTTP ${response.status}`}`);
  return body;
}

const manifest = await json(`${sourceUrl}/api/store?action=store-backup-manifest`);
if (!Array.isArray(manifest.entries)) throw new Error('Manifest kopii nie zawiera listy wpisów.');

let bytes = 0;
for (const item of manifest.entries) {
  const params = new URLSearchParams({ action: 'store-backup-entry', key: item.key, etag: item.etag });
  const entry = await json(`${sourceUrl}/api/store?${params}`);
  await target.write(entry.key, entry.value);
  const verified = await target.readVersioned(entry.key, null);
  if (!verified.exists || digest(verified.value) !== digest(entry.value)) throw new Error(`Weryfikacja wpisu ${entry.key} nie powiodła się.`);
  bytes += Buffer.byteLength(JSON.stringify(entry.value));
}

const targetKeys = await target.listKeys();
const sourceKeys = new Set(manifest.entries.map((entry) => entry.key));
const missing = [...sourceKeys].filter((key) => !targetKeys.some((entry) => entry.key === key));
if (missing.length) throw new Error(`Po migracji brakuje ${missing.length} wpisów.`);

console.log(`Migracja danych zakończona: ${manifest.entries.length} wpisów, ${bytes} bajtów, pełna weryfikacja OK.`);
