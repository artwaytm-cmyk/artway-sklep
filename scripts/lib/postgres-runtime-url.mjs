import { readFile } from 'node:fs/promises';

const DEFAULT_UNIT = '/etc/systemd/system/artway-backend.service';

function environmentValue(unit, key) {
  const prefix = `Environment=${key}=`;
  const raw = unit.split('\n').find((line) => line.startsWith(prefix))?.slice(prefix.length) || '';
  return raw.replace(/^"|"$/g, '');
}

export async function postgresRuntimeUrl({
  role = '',
  unitPath = DEFAULT_UNIT,
  env = process.env,
} = {}) {
  let connectionString = env.DATABASE_URL || '';
  if (!connectionString) {
    const unit = await readFile(unitPath, 'utf8').catch(() => '');
    connectionString = environmentValue(unit, 'DATABASE_URL');
  }
  if (!connectionString) throw new Error('Brak DATABASE_URL dla PostgreSQL.');
  if (!role) return connectionString;
  const url = new URL(connectionString);
  url.username = role;
  url.password = '';
  return url.toString();
}

export function safePostgresTarget(connectionString) {
  const url = new URL(connectionString);
  return {
    database: url.pathname.replace(/^\//, ''),
    role: decodeURIComponent(url.username || ''),
    host: url.searchParams.get('host') || url.hostname || 'unix-socket',
  };
}
