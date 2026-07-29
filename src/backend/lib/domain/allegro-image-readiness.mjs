const cache = new Map();
const text = (value = '', max = 1000) => String(value ?? '').trim().slice(0, max);

function pngSize(bytes) {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), format: 'png' };
}

function gifSize(bytes) {
  if (bytes.length < 10 || !['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return null;
  return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8), format: 'gif' };
}

function webpSize(bytes) {
  if (bytes.length < 30 || bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') return null;
  const kind = bytes.subarray(12, 16).toString('ascii');
  if (kind === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3), format: 'webp' };
  if (kind === 'VP8L' && bytes[20] === 0x2f) {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, format: 'webp' };
  }
  return null;
}

function jpegSize(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    if (offset + 4 > bytes.length) break;
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5), format: 'jpeg' };
    }
    offset += 2 + length;
  }
  return null;
}

export function imageDimensions(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  return pngSize(bytes) || gifSize(bytes) || webpSize(bytes) || jpegSize(bytes);
}

async function inspectImage(url, fetcher, now) {
  const source = text(url);
  const previous = cache.get(source);
  if (previous && previous.expiresAt > now) return previous.result;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let result;
  try {
    const response = await fetcher(source, { signal: controller.signal, headers: { Accept: 'image/*' } });
    const contentLength = Number(response.headers?.get?.('content-length') || 0);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (contentLength > 15_000_000) throw new Error('plik przekracza 15 MB');
    const bytes = Buffer.from(await response.arrayBuffer());
    const dimensions = imageDimensions(bytes);
    result = dimensions
      ? { url: source, ok: true, ...dimensions, bytes: bytes.length }
      : { url: source, ok: false, error: 'nie rozpoznano wymiarów obrazu' };
  } catch (error) {
    result = { url: source, ok: false, error: text(error?.message || error, 300) };
  } finally {
    clearTimeout(timeout);
  }
  cache.set(source, { expiresAt: now + 15 * 60_000, result });
  return result;
}

export async function checkAllegroImageReadiness(urls = [], {
  minLongEdge = 500,
  maxLongEdge = 2560,
  minAdaptableLongEdge = 300,
  fetcher = fetch,
  now = Date.now(),
  limit = 16,
} = {}) {
  const selected = [...new Set((Array.isArray(urls) ? urls : []).map((url) => text(url)).filter(Boolean))].slice(0, Math.max(1, limit));
  if (!selected.length) return { ready: false, adaptable: [], remote: [], valid: [], inspected: [], minLongEdge, maxLongEdge, reason: 'brak zdjęć' };
  const inspected = await Promise.all(selected.map((url) => inspectImage(url, fetcher, now)));
  const allowedFormats = new Set(['jpeg', 'png', 'gif']);
  const valid = inspected.filter((item) => {
    const edge = Math.max(Number(item.width) || 0, Number(item.height) || 0);
    return item.ok && edge >= minLongEdge && edge <= maxLongEdge && allowedFormats.has(item.format);
  });
  const adaptable = inspected.filter((item) => {
    const edge = Math.max(Number(item.width) || 0, Number(item.height) || 0);
    return item.ok && !valid.includes(item) && edge >= minAdaptableLongEdge;
  });
  const remote = inspected.filter((item) => !item.ok && /^https?:\/\//i.test(item.url));
  return {
    ready: valid.length > 0,
    valid,
    adaptable,
    remote,
    inspected,
    minLongEdge,
    maxLongEdge,
    reason: valid.length ? '' : adaptable.length
      ? 'zdjęcie wymaga technicznego dopasowania przed wysłaniem do Allegro'
      : remote.length
        ? 'wymiary zostaną potwierdzone przez usługę obrazów Allegro'
      : `żadne zdjęcie nie spełnia zakresu ${minLongEdge}–${maxLongEdge}px`,
  };
}
