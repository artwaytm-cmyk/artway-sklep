import crypto from 'node:crypto';
import { canonicalProductCode, synchronizeProductIdentifierAliases } from './product-identifiers.mjs';
import { SOURCE_IMAGE_POLICY_VERSION } from './source-product-images.mjs';

export const IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY = 'imported-product-catalog:manifest:v1';
export const IMPORTED_PRODUCT_CATALOG_SHARD_PREFIX = 'imported-product-catalog:shard:v1:';

const DEFAULT_SHARD_SIZE = 50;
const MAX_PAGE_SIZE = 500;
const FIRST_IMPORTED_PRODUCT_ID = 1_000_000;
const MAX_CAS_ATTEMPTS = 12;

const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const clean = (value, max = 1000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const clone = (value) => structuredClone(value);
const timestamp = () => new Date().toISOString();

function normalizedText(value) {
  return clean(value, 1000)
    .toLocaleLowerCase('pl-PL')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function importedCatalogCanonicalUrl(value) {
  const raw = clean(value, 3000);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.protocol = 'https:';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|query_id|fbclid|gclid|ref|source)$/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    url.searchParams.sort();
    return url.toString().replace(/\?$/, '');
  } catch {
    return '';
  }
}

export function importedCatalogValidGtin(value) {
  const gtin = clean(value, 40).replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(gtin.length)) return '';
  const digits = [...gtin].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return ((10 - (sum % 10)) % 10 === check) ? gtin : '';
}

function first(product, fields, max = 1000) {
  for (const field of fields) {
    const value = clean(product?.[field], max);
    if (value) return value;
  }
  return '';
}

function values(product, fields, max = 1000) {
  return [...new Set(fields.map((field) => clean(product?.[field], max)).filter(Boolean))];
}

function productFingerprints(product = {}, sourceUrl = '') {
  const result = [];
  const urls = [...new Set([
    sourceUrl,
    ...values(product, ['sourceUrl', 'producentUrl', 'agentImportUrl', 'url'], 3000),
    product?.sourceEvidence?.url,
  ].map(importedCatalogCanonicalUrl).filter(Boolean))];
  const gtins = [...new Set(values(product, ['ean', 'gtin', 'EAN', 'GTIN'], 40).map(importedCatalogValidGtin).filter(Boolean))];
  const externalIds = [...new Set(values(product, ['externalId', 'external_id', 'EXTERNAL_ID', 'sku', 'SKU'], 240).map(normalizedText).filter(Boolean))];
  const manufacturer = normalizedText(first(product, ['producent', 'manufacturer', 'marka', 'brand'], 240));
  const manufacturerCodes = [...new Set(values(product, ['kodProducenta', 'manufacturerCode', 'mpn', 'MPN'], 240).map(normalizedText).filter(Boolean))];
  for (const url of urls) result.push({ type: 'source_url', value: url });
  for (const gtin of gtins) result.push({ type: 'gtin', value: gtin });
  for (const externalId of externalIds) result.push({ type: 'external_id', value: externalId });
  if (manufacturer) for (const manufacturerCode of manufacturerCodes) result.push({ type: 'manufacturer_code', value: `${manufacturer}|${manufacturerCode}` });
  return result;
}

function fingerprintKey(fingerprint) {
  return `${fingerprint.type}:${crypto.createHash('sha256').update(fingerprint.value).digest('hex')}`;
}

function duplicateInProducts(candidateFingerprints, products) {
  for (const fingerprint of candidateFingerprints) {
    const match = asArray(products).find((existing) => productFingerprints(existing).some((entry) => entry.type === fingerprint.type && entry.value === fingerprint.value));
    if (match) return { product: clone(match), reason: fingerprint.type, certain: true, fingerprint: fingerprint.value };
  }
  return null;
}

function normalizeManifest(value = {}, shardSize = DEFAULT_SHARD_SIZE) {
  const source = asObject(value);
  const shards = asArray(source.shards).map((entry, index) => ({
    id: Math.max(1, Number(entry?.id) || index + 1),
    key: clean(entry?.key, 300) || `${IMPORTED_PRODUCT_CATALOG_SHARD_PREFIX}${String(index + 1).padStart(6, '0')}`,
    count: Math.max(0, Number(entry?.count) || 0),
  }));
  return {
    schemaVersion: 1,
    shardSize: Math.max(1, Math.min(100, Number(source.shardSize) || shardSize)),
    count: Math.max(0, Number(source.count) || 0),
    nextId: Math.max(FIRST_IMPORTED_PRODUCT_ID, Number(source.nextId) || FIRST_IMPORTED_PRODUCT_ID),
    shards,
    importIndex: asObject(source.importIndex),
    fingerprintIndex: asObject(source.fingerprintIndex),
    updatedAt: clean(source.updatedAt, 50) || null,
  };
}

function catalogError(message, code = 'imported_catalog_error', status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

const SOURCE_REFRESH_FIELDS = Object.freeze([
  'sourceUrl', 'producentUrl', 'agentImportUrl', 'sourceEvidence', 'sourceMaterial',
  'parametryProducenta', 'parametryZrodla', 'dostepnoscProducenta', 'stanProducenta',
  'stanProducentaDokladny', 'stanProducentaZrodlo', 'producentStatus', 'producentSprawdzonoAt',
]);
const SOURCE_FILL_FIELDS = Object.freeze([
  'nazwa', 'opisKrotki', 'opis', 'producent', 'marka', 'kategoria', 'zdjecie', 'zdjecia',
  'rozmiar', 'material', 'kolorProduktu',
]);

/** Aktualizacja z linku nie może nadpisać ceny, stanu ani ręcznej redakcji administratora. */
export function mergeImportedProductSourceRefresh(existing = {}, incoming = {}, refreshedAt = timestamp()) {
  let result = { ...clone(existing) };
  for (const field of SOURCE_REFRESH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, field) || incoming[field] === undefined || incoming[field] === null || incoming[field] === '') continue;
    if (field === 'parametryProducenta' || field === 'parametryZrodla' || field === 'sourceEvidence' || field === 'sourceMaterial') {
      result[field] = { ...asObject(result[field]), ...clone(asObject(incoming[field])) };
    } else result[field] = clone(incoming[field]);
  }
  for (const field of SOURCE_FILL_FIELDS) {
    const current = result[field], next = incoming[field];
    const currentMissing = Array.isArray(current) ? current.length === 0 : !clean(current, 20);
    const nextPresent = Array.isArray(next) ? next.length > 0 : !!clean(next, field === 'opis' ? 6000 : 3000);
    if (currentMissing && nextPresent) result[field] = clone(next);
  }
  if (Number(incoming?.sourceEvidence?.imagePolicyVersion) >= SOURCE_IMAGE_POLICY_VERSION && clean(incoming.zdjecie, 3000)) {
    result.zdjecie = clean(incoming.zdjecie, 3000);
    result.zdjecia = asArray(incoming.zdjecia).map((image) => clean(image, 3000)).filter(Boolean).slice(0, 15);
  }
  const gtin = first(incoming, ['gtin', 'ean', 'GTIN', 'EAN'], 40).replace(/\D/g, '');
  if (gtin && !first(result, ['gtin', 'ean', 'GTIN', 'EAN'], 40)) result = synchronizeProductIdentifierAliases({ ...result, gtin, ean: gtin });
  const sourceCode = canonicalProductCode(incoming);
  const existingCode = canonicalProductCode(result);
  if (sourceCode || existingCode) result = synchronizeProductIdentifierAliases(result, { code: existingCode || sourceCode, overwrite: !existingCode });
  result.sourceRefreshedAt = refreshedAt;
  result.sourceRefreshStatus = 'updated_from_product_link_file';
  return result;
}

/** Ten sam bezpieczny merge dla produktów przechowywanych w głównej kartotece ustawień. */
export async function refreshCentralProductSource({ productId, incoming = {}, readVersioned, writeIfVersion, getProducts, createUpdater, maxAttempts = 6 } = {}) {
  const id = String(productId ?? '').trim();
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const version = await readVersioned('settings', { data: {}, rev: 0, updated_at: null });
    const previous = version.value || { data: {}, rev: 0, updated_at: null }, data = { ...(previous.data || {}) };
    const products = getProducts(data), existing = products.get(id);
    if (!existing) return { updated: false, notFound: true, product: null, changedFields: [] };
    const next = mergeImportedProductSourceRefresh(existing, incoming);
    const changedFields = Object.keys(next).filter((field) => field !== 'id' && JSON.stringify(next[field]) !== JSON.stringify(existing[field]));
    if (!changedFields.length) return { updated: false, product: existing, changedFields: [] };
    const updater = createUpdater(data, products.keys());
    updater.apply(id, Object.fromEntries(changedFields.map((field) => [field, next[field]])));
    if (!updater.commit()) return { updated: false, product: existing, changedFields: [] };
    const record = { ...previous, data, rev: Number(previous.rev || 0) + 1, updated_at: timestamp() };
    const write = await writeIfVersion('settings', record, version);
    if (write?.modified) return { updated: true, product: { ...existing, ...Object.fromEntries(changedFields.map((field) => [field, next[field]])) }, changedFields };
  }
  throw catalogError('Kartoteka zmieniła się podczas aktualizacji z pliku linków.', 'settings_write_conflict');
}

export function createImportedProductCatalog({ read, readVersioned, writeIfVersion, shardSize = DEFAULT_SHARD_SIZE } = {}) {
  if (typeof read !== 'function' || typeof readVersioned !== 'function' || typeof writeIfVersion !== 'function') {
    throw new Error('Katalog importowanych produktów wymaga repozytorium z odczytem i zapisem CAS.');
  }
  const boundedShardSize = Math.max(1, Math.min(100, Number(shardSize) || DEFAULT_SHARD_SIZE));

  async function list() {
    const manifest = normalizeManifest(await read(IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY, {}), boundedShardSize);
    const shards = await Promise.all(manifest.shards.map((entry) => read(entry.key, { items: [] })));
    return shards.flatMap((record) => asArray(record?.items)).filter((product) => product && typeof product === 'object').map(clone);
  }

  async function metadata() {
    const manifest = normalizeManifest(await read(IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY, {}), boundedShardSize);
    return { count: manifest.count, revision: String(manifest.updatedAt || `catalog-${manifest.count}`).slice(0, 100) };
  }

  async function page({ offset = 0, limit = DEFAULT_SHARD_SIZE } = {}) {
    const manifest = normalizeManifest(await read(IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY, {}), boundedShardSize);
    const safeOffset = Math.max(0, Math.min(manifest.count, Number(offset) || 0));
    const safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(limit) || DEFAULT_SHARD_SIZE));
    const end = Math.min(manifest.count, safeOffset + safeLimit);
    let cursor = 0;
    const selected = [];
    for (const descriptor of manifest.shards) {
      const shardStart = cursor, shardEnd = cursor + descriptor.count;
      if (shardEnd > safeOffset && shardStart < end) selected.push({ descriptor, shardStart });
      cursor = shardEnd;
      if (cursor >= end) break;
    }
    const records = await Promise.all(selected.map(({ descriptor }) => read(descriptor.key, { items: [] })));
    const products = [];
    selected.forEach(({ descriptor, shardStart }, index) => {
      const items = asArray(records[index]?.items);
      const from = Math.max(0, safeOffset - shardStart), to = Math.min(items.length, end - shardStart);
      products.push(...items.slice(from, to).map(clone));
    });
    return {
      products,
      offset: safeOffset,
      limit: safeLimit,
      total: manifest.count,
      nextOffset: end < manifest.count ? end : null,
      revision: String(manifest.updatedAt || `catalog-${manifest.count}`).slice(0, 100),
    };
  }

  async function findDuplicate(product = {}, { extraProducts = [], sourceUrl = '' } = {}) {
    const candidateFingerprints = productFingerprints(product, sourceUrl);
    if (!candidateFingerprints.length) return null;
    const products = [...await list(), ...asArray(extraProducts)];
    return duplicateInProducts(candidateFingerprints, products);
  }

  async function appendReservedProduct(reservation, product) {
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const version = await readVersioned(reservation.shardKey, { items: [], updatedAt: null });
      const current = asArray(version.value?.items);
      const existing = current.find((item) => Number(item?.id) === Number(reservation.id) || (reservation.importItemKey && item?.importItemKey === reservation.importItemKey));
      if (existing) return clone(existing);
      const next = { items: [...current, product], updatedAt: timestamp() };
      const write = await writeIfVersion(reservation.shardKey, next, version);
      if (write?.modified) return clone(product);
    }
    throw catalogError('Katalog zmienił się podczas zapisu produktu. Spróbuj ponownie.', 'imported_catalog_shard_conflict');
  }

  async function findReservedProduct(reservation) {
    if (!reservation?.shardKey || !reservation?.id) return null;
    const shard = await read(reservation.shardKey, { items: [] });
    return asArray(shard?.items).find((item) => Number(item?.id) === Number(reservation.id)) || null;
  }

  async function add(product = {}, { sourceUrl = '', importItemKey = '', extraProducts = [] } = {}) {
    if (!product || typeof product !== 'object' || Array.isArray(product)) throw catalogError('Brakuje danych produktu do importu.', 'imported_catalog_product_required', 422);
    const canonicalSourceUrl = importedCatalogCanonicalUrl(sourceUrl || first(product, ['sourceUrl', 'producentUrl', 'agentImportUrl', 'url'], 3000));
    const safeImportItemKey = clean(importItemKey, 240) || `auto:${crypto.createHash('sha256').update(JSON.stringify(productFingerprints(product, canonicalSourceUrl))).digest('hex')}`;
    const fingerprints = productFingerprints(product, canonicalSourceUrl);

    const firstManifest = normalizeManifest(await read(IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY, {}), boundedShardSize);
    let reservation = asObject(firstManifest.importIndex[safeImportItemKey]);
    if (reservation.id) {
      const existingOwn = await findReservedProduct(reservation);
      if (existingOwn) return { added: false, idempotent: true, product: clone(existingOwn), reason: 'import_item_key' };
    } else {
      reservation = null;
      const duplicate = duplicateInProducts(fingerprints, extraProducts);
      if (duplicate) return { added: false, idempotent: false, product: duplicate.product, duplicate, reason: duplicate.reason };
      for (const fingerprint of fingerprints) {
        const indexed = asObject(firstManifest.fingerprintIndex[fingerprintKey(fingerprint)]);
        if (!indexed.id) continue;
        const existing = await findReservedProduct(indexed);
        const match = clone(existing || { id: indexed.id, storageOrigin: 'product-link-file-import' });
        return { added: false, idempotent: false, product: match, duplicate: { product: match, reason: indexed.reason || fingerprint.type, certain: true }, reason: indexed.reason || fingerprint.type };
      }
    }
    let reservedDuplicate = null;
    for (let attempt = 0; !reservation && attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const version = await readVersioned(IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY, {});
      const manifest = normalizeManifest(version.value, boundedShardSize);
      const ownReservation = asObject(manifest.importIndex[safeImportItemKey]);
      if (ownReservation.id) {
        reservation = ownReservation;
        break;
      }
      for (const fingerprint of fingerprints) {
        const indexed = asObject(manifest.fingerprintIndex[fingerprintKey(fingerprint)]);
        if (indexed.id) {
          reservedDuplicate = { ...indexed, reason: indexed.reason || fingerprint.type };
          break;
        }
      }
      if (reservedDuplicate) break;

      const id = manifest.nextId;
      let descriptor = manifest.shards.find((entry) => entry.count < manifest.shardSize);
      if (!descriptor) {
        const shardId = manifest.shards.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
        descriptor = { id: shardId, key: `${IMPORTED_PRODUCT_CATALOG_SHARD_PREFIX}${String(shardId).padStart(6, '0')}`, count: 0 };
      }
      reservation = { id, shardId: descriptor.id, shardKey: descriptor.key, importItemKey: safeImportItemKey, reservedAt: timestamp() };
      const shards = manifest.shards.some((entry) => entry.id === descriptor.id)
        ? manifest.shards.map((entry) => entry.id === descriptor.id ? { ...entry, count: entry.count + 1 } : entry)
        : [...manifest.shards, { ...descriptor, count: 1 }];
      const fingerprintIndex = { ...manifest.fingerprintIndex };
      for (const fingerprint of fingerprints) fingerprintIndex[fingerprintKey(fingerprint)] = { id, shardKey: descriptor.key, reason: fingerprint.type };
      const next = {
        ...manifest,
        count: manifest.count + 1,
        nextId: id + 1,
        shards,
        importIndex: { ...manifest.importIndex, [safeImportItemKey]: reservation },
        fingerprintIndex,
        updatedAt: timestamp(),
      };
      const write = await writeIfVersion(IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY, next, version);
      if (write?.modified) break;
      reservation = null;
    }

    if (reservedDuplicate) {
      const existing = await findReservedProduct(reservedDuplicate);
      return {
        added: false,
        idempotent: false,
        product: clone(existing || { id: reservedDuplicate.id, storageOrigin: 'product-link-file-import' }),
        duplicate: { product: clone(existing || { id: reservedDuplicate.id }), reason: reservedDuplicate.reason, certain: true },
        reason: reservedDuplicate.reason,
      };
    }
    if (!reservation) throw catalogError('Nie udało się zarezerwować miejsca w katalogu.', 'imported_catalog_manifest_conflict');

    const existingOwn = await findReservedProduct(reservation);
    if (existingOwn) return { added: false, idempotent: true, product: clone(existingOwn), reason: 'import_item_key' };
    const now = timestamp();
    const stored = {
      ...clone(product),
      id: Number(reservation.id),
      sourceUrl: canonicalSourceUrl || clean(product.sourceUrl, 3000),
      producentUrl: canonicalSourceUrl || clean(product.producentUrl, 3000),
      stan: 0,
      stock: 0,
      storageOrigin: 'product-link-file-import',
      importItemKey: safeImportItemKey,
      importedAt: now,
      agentOnboardingStatus: 'needs_attention',
      agentOnboardingStartedAt: clean(product.agentOnboardingStartedAt, 50) || now,
    };
    const saved = await appendReservedProduct(reservation, stored);
    return { added: true, idempotent: false, product: saved, reason: null };
  }

  async function updateFromSource(productId, incoming = {}) {
    const id = String(productId ?? '').trim();
    if (!id) throw catalogError('Brakuje identyfikatora aktualizowanego produktu.', 'imported_catalog_product_id_required', 422);
    const manifest = normalizeManifest(await read(IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY, {}), boundedShardSize);
    for (const descriptor of manifest.shards) {
      let changedFields = [];
      const result = await (async () => {
        for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
          const version = await readVersioned(descriptor.key, { items: [], updatedAt: null });
          const items = asArray(version.value?.items), index = items.findIndex((item) => String(item?.id ?? '') === id);
          if (index < 0) return null;
          const previous = items[index], next = mergeImportedProductSourceRefresh(previous, incoming);
          changedFields = Object.keys(next).filter((field) => JSON.stringify(next[field]) !== JSON.stringify(previous[field]));
          if (!changedFields.length) return { updated: false, product: clone(previous), changedFields: [] };
          const nextItems = [...items]; nextItems[index] = next;
          const write = await writeIfVersion(descriptor.key, { items: nextItems, updatedAt: timestamp() }, version);
          if (write?.modified) return { updated: true, product: clone(next), changedFields };
        }
        throw catalogError('Kartoteka zmieniła się podczas odświeżania źródła.', 'imported_catalog_source_refresh_conflict');
      })();
      if (!result) continue;
      if (result.updated) {
        // Dopisujemy nowe identyfikatory do indeksu. Stare klucze zostają jako
        // aliasy historyczne, aby ponowny import nadal nie utworzył duplikatu.
        for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
          const version = await readVersioned(IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY, {}), current = normalizeManifest(version.value, boundedShardSize);
          const fingerprintIndex = { ...current.fingerprintIndex };
          for (const fingerprint of productFingerprints(result.product)) fingerprintIndex[fingerprintKey(fingerprint)] = { id: result.product.id, shardKey: descriptor.key, reason: fingerprint.type };
          const write = await writeIfVersion(IMPORTED_PRODUCT_CATALOG_MANIFEST_KEY, { ...current, fingerprintIndex, updatedAt: timestamp() }, version);
          if (write?.modified) break;
        }
      }
      return result;
    }
    return { updated: false, notFound: true, product: null, changedFields: [] };
  }

  return Object.freeze({ list, metadata, page, findDuplicate, add, updateFromSource });
}
