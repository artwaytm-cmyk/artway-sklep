import { chmod, mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { allegroCredentialLooksMasked } from './allegro-operation-receipts.mjs';

function credential(value = '', limit = 500) {
  return String(value || '').trim().slice(0, limit);
}

function valid(value, min = 12) {
  return value.length >= min && !allegroCredentialLooksMasked(value) && !/[\r\n\0]/.test(value);
}

function envLine(name, value) {
  return `${name}="${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

export function createAllegroCredentialManager({ filePath = process.env.ARTWAY_ALLEGRO_CREDENTIALS_FILE || '', env = process.env, fetchImpl = globalThis.fetch } = {}) {
  async function verify(clientId, clientSecret, environment = 'production') {
    const host = environment === 'sandbox' ? 'https://allegro.pl.allegrosandbox.pl' : 'https://allegro.pl';
    const response = await fetchImpl(`${host}/auth/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'Artway-TM/1.0',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return true;
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload?.error === 'invalid_client' ? 'Allegro odrzuciło Client ID lub Client Secret. Skopiuj ponownie pełne wartości z aplikacji Allegro.' : `Weryfikacja aplikacji Allegro zakończyła się kodem ${response.status}.`);
    error.code = payload?.error || 'allegro_credentials_verify_failed';
    error.status = response.status === 401 ? 422 : 502;
    throw error;
  }

  async function save(input = {}) {
    const clientId = credential(input.clientId, 300), clientSecret = credential(input.clientSecret, 500);
    const environment = String(input.environment || env.ALLEGRO_ENV || 'production').toLowerCase() === 'sandbox' ? 'sandbox' : 'production';
    if (!valid(clientId) || !valid(clientSecret)) {
      const error = new Error('Wpisz pełny Client ID i Client Secret. Zamaskowane wartości z gwiazdkami nie mogą zostać zapisane.');
      error.code = 'allegro_credentials_masked'; error.status = 422; throw error;
    }
    if (!filePath) {
      const error = new Error('Bezpieczny sejf danych Allegro nie jest dostępny na tym środowisku.');
      error.code = 'allegro_credentials_store_unavailable'; error.status = 503; throw error;
    }
    await verify(clientId, clientSecret, environment);
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
    const temporary = `${filePath}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, `${envLine('ALLEGRO_CLIENT_ID', clientId)}\n${envLine('ALLEGRO_CLIENT_SECRET', clientSecret)}\n${envLine('ALLEGRO_ENV', environment)}\n`, { mode: 0o600 });
      await chmod(temporary, 0o600);
      await rename(temporary, filePath);
    } catch (error) {
      await unlink(temporary).catch(() => null);
      throw error;
    }
    env.ALLEGRO_CLIENT_ID = clientId;
    env.ALLEGRO_CLIENT_SECRET = clientSecret;
    env.ALLEGRO_ENV = environment;
    return { configured: true, verified: true, environment };
  }

  return Object.freeze({ save, verify });
}
