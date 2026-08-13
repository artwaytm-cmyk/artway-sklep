import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { checkAllegroImageReadiness, imageDimensions } from './allegro-image-readiness.mjs';

const runFile = promisify(execFile);
const text = (value = '', limit = 1000) => String(value ?? '').trim().slice(0, limit);

function publicImageUrl(value = '') {
  try {
    const parsed = new URL(text(value, 3000));
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    const blocked = host === 'localhost' || host === '::1' || /^127\./.test(host)
      || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)
      || host.endsWith('.local') || host.endsWith('.internal');
    const range172 = host.match(/^172\.(\d+)\./);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || blocked
      || (range172 && Number(range172[1]) >= 16 && Number(range172[1]) <= 31)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

async function download(url, fetcher) {
  const safeUrl = publicImageUrl(url);
  if (!safeUrl) throw new Error('Adres zdjęcia nie wskazuje publicznego zasobu HTTP/HTTPS.');
  const response = await fetcher(safeUrl, { headers: { Accept: 'image/*' }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Pobranie zdjęcia zakończone kodem HTTP ${response.status}.`);
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > 15_000_000) throw new Error('Zdjęcie przekracza limit 15 MB.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 15_000_000) throw new Error('Zdjęcie jest puste albo przekracza limit 15 MB.');
  return buffer;
}

async function adaptImage(url, dimensions, {
  fetcher,
  execute = (args) => runFile('/usr/bin/magick', args, { timeout: 20_000, maxBuffer: 2_000_000 }),
} = {}) {
  const source = await download(url, fetcher);
  const inputDimensions = dimensions || imageDimensions(source);
  if (!inputDimensions) throw new Error('Nie rozpoznano formatu zdjęcia.');
  const longEdge = Math.max(inputDimensions.width, inputDimensions.height);
  if (longEdge < 300) throw new Error('Zdjęcie źródłowe jest zbyt małe do bezpiecznego dopasowania.');
  const scale = longEdge < 500 ? 500 / longEdge : longEdge > 2560 ? 2560 / longEdge : 1;
  const width = Math.max(1, Math.round(inputDimensions.width * scale));
  const height = Math.max(1, Math.round(inputDimensions.height * scale));
  const directory = await mkdtemp(join(tmpdir(), 'artway-allegro-image-'));
  const input = join(directory, 'source-image');
  const output = join(directory, 'allegro-image.jpg');
  try {
    await writeFile(input, source);
    await execute([input, '-auto-orient', '-strip', '-colorspace', 'sRGB', '-resize', `${width}x${height}!`, '-quality', '92', output]);
    const buffer = await readFile(output);
    const result = imageDimensions(buffer);
    const outputEdge = Math.max(Number(result?.width) || 0, Number(result?.height) || 0);
    if (!result || outputEdge < 500 || outputEdge > 2560) throw new Error('Dopasowane zdjęcie nie spełnia wymiarów Allegro.');
    return { buffer, contentType: 'image/jpeg', width: result.width, height: result.height };
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => null);
  }
}

export function createAllegroImagePublicationService({
  inspect = checkAllegroImageReadiness,
  fetcher = fetch,
  uploadByUrl,
  uploadBinary,
  execute,
} = {}) {
  if (typeof uploadByUrl !== 'function' || typeof uploadBinary !== 'function') {
    throw new TypeError('Publikacja zdjęć Allegro wymaga obu metod wysyłania.');
  }
  return async function publish(req, urls = []) {
    const readiness = await inspect(urls, { fetcher, limit: 16, minLongEdge: 500, maxLongEdge: 2560 });
    const published = [], errors = [];
    for (const item of readiness.inspected) {
      try {
        // Gdy CDN producenta nie odpowiada z VPS-a, Allegro nadal może pobrać
        // ten sam publiczny URL we własnej usłudze obrazów. Ostatecznym
        // potwierdzeniem jest wtedy odpowiedź /sale/images, nie lokalny timeout.
        if (!item.ok) {
          const uploaded = await uploadByUrl(req, item.url);
          const location = text(uploaded?.location || uploaded?.url || uploaded, 1000);
          if (!location) throw new Error('Allegro nie zwróciło adresu zapisanego zdjęcia.');
          published.push({ sourceUrl: item.url, location, adapted: false, remotelyValidated: true, width: 0, height: 0 });
          continue;
        }
        if (Math.max(Number(item.width) || 0, Number(item.height) || 0) < 300) {
          throw new Error('zdjęcie jest zbyt małe');
        }
        const direct = readiness.valid.some((candidate) => candidate.url === item.url);
        const uploaded = direct
          ? await uploadByUrl(req, item.url)
          : await adaptImage(item.url, item, { fetcher, execute });
        const location = direct
          ? text(uploaded?.location || uploaded?.url || uploaded, 1000)
          : text((await uploadBinary(req, uploaded.buffer, uploaded.contentType))?.location, 1000);
        if (!location) throw new Error('Allegro nie zwróciło adresu zapisanego zdjęcia.');
        published.push({
          sourceUrl: item.url,
          location,
          adapted: !direct,
          width: direct ? item.width : uploaded.width,
          height: direct ? item.height : uploaded.height,
        });
      } catch (error) {
        errors.push({ url: item.url, error: text(error?.message || error, 500) });
      }
    }
    return {
      ready: published.length > 0,
      images: published.map((item) => item.location),
      published,
      errors,
      inspected: readiness.inspected,
    };
  };
}

export function createAllegroImagePublicationClient({
  configuration,
  accessToken,
  errorText,
  fetcher = fetch,
} = {}) {
  if (typeof configuration !== 'function' || typeof accessToken !== 'function' || typeof errorText !== 'function') {
    throw new TypeError('Klient zdjęć Allegro wymaga konfiguracji, tokenu i parsera błędów.');
  }
  const upload = async (req, input, contentType = 'application/vnd.allegro.public.v1+json') => {
    const config = configuration(req), token = await accessToken(req);
    const host = config.env === 'sandbox' ? 'https://upload.allegro.pl.allegrosandbox.pl' : 'https://upload.allegro.pl';
    const binary = Buffer.isBuffer(input);
    const response = await fetcher(`${host}/sale/images`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.allegro.public.v1+json',
        'Accept-Language': 'pl-PL',
        'Content-Type': binary ? contentType : 'application/vnd.allegro.public.v1+json',
        'User-Agent': 'Artway-TM/1.0 VPS',
      },
      body: binary ? input : JSON.stringify({ url: input }),
    });
    const raw = await response.text();
    let result = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch { result = { raw }; }
    if (!response.ok) {
      const error = new Error(errorText(result, `Allegro odrzuciło zdjęcie (HTTP ${response.status})`));
      error.status = response.status;
      error.code = result.error || 'allegro_image_upload_failed';
      error.allegro = result;
      throw error;
    }
    return result;
  };
  return createAllegroImagePublicationService({
    uploadByUrl: (req, url) => upload(req, url),
    uploadBinary: (req, buffer, contentType) => upload(req, buffer, contentType),
  });
}

export async function prepareAllegroOfferImagesForPublication({
  req,
  draft,
  existingOfferId = '',
  publish,
} = {}) {
  if (!Array.isArray(draft?.images) || !draft.images.length) return null;
  const result = await publish(req, draft.images);
  if (result.ready) {
    draft.images = result.images;
    const draftProduct = draft.productSet?.[0]?.product;
    // Pusta tablica przy ID produktu katalogowego celowo wyłącza obrazy
    // katalogowe. Nie wolno zastąpić jej galerią oferty, bo Allegro liczy oba
    // źródła do wspólnego limitu 16 zdjęć.
    if (Array.isArray(draftProduct?.images) && !draftProduct?.id) draftProduct.images = result.images;
    return result;
  }
  if (draft.productSet?.[0]?.product?.id || existingOfferId) return result;
  const error = new Error(`Nie udało się przygotować zdjęcia Allegro: ${result.errors.map((item) => item.error).filter(Boolean).join('; ') || 'brak poprawnego obrazu'}`);
  error.status = 422;
  error.code = 'allegro_image_preparation_failed';
  error.allegro = {
    errors: result.errors.map((item) => ({
      code: 'IMAGE_PREPARATION_FAILED',
      path: 'images',
      message: item.error,
      metadata: { sourceUrl: item.url },
    })),
  };
  throw error;
}
