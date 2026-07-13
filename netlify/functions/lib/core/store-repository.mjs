import { getStore } from '@netlify/blobs';

export function createStoreRepository({ name, consistency = 'strong' }) {
  if (!name) throw new Error('Nazwa magazynu danych jest wymagana.');

  const store = () => getStore({ name, consistency });

  return Object.freeze({
    async read(key, fallback) {
      try {
        const value = await store().get(key, { type: 'json' });
        return value === null || value === undefined ? fallback : value;
      } catch {
        return fallback;
      }
    },
    async write(key, value) {
      await store().setJSON(key, value);
    },
  });
}
