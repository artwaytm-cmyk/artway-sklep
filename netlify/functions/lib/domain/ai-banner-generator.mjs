import crypto from 'node:crypto';

const ASSET_INDEX_KEY = 'ai_banner_assets';
const ASSET_PREFIX = 'ai_banner_asset:';
const ALLOWED_QUALITY = new Set(['low', 'medium', 'high']);
const ALLOWED_STYLE = new Set(['produktowy', 'radosny', 'elegancki', 'imprezowy', 'minimalny']);

function clean(value, limit = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function normalizeAiBannerRequest(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const brief = clean(source.brief, 900);
  if (brief.length < 8) {
    const error = new Error('Opisz grafikę co najmniej w kilku słowach.');
    error.code = 'banner_brief_required';
    error.status = 400;
    throw error;
  }
  return {
    brief,
    goal: clean(source.goal, 160) || 'promocja sklepu internetowego',
    subject: clean(source.subject, 220) || 'gry, zabawki lub artykuły imprezowe',
    style: ALLOWED_STYLE.has(clean(source.style, 30)) ? clean(source.style, 30) : 'produktowy',
    quality: ALLOWED_QUALITY.has(clean(source.quality, 20)) ? clean(source.quality, 20) : 'medium',
    discountCode: clean(source.discountCode, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
    title: clean(source.title, 100),
  };
}

export function buildAiBannerPrompt(input) {
  const style = {
    produktowy: 'profesjonalna fotografia produktowa, czytelna kompozycja e-commerce',
    radosny: 'radosna, przyjazna rodzinom ilustracja reklamowa z dynamiczną kompozycją',
    elegancki: 'elegancka, premium kompozycja reklamowa z miękkim światłem',
    imprezowy: 'energetyczna scena imprezowa z balonami, konfetti i atrakcyjnym światłem',
    minimalny: 'minimalistyczna, czysta kompozycja produktowa z dużą ilością spokojnej przestrzeni',
  }[input.style] || 'profesjonalna kompozycja reklamowa';
  return [
    'Stwórz poziomą grafikę hero/banner dla polskiego sklepu Artway-TM.',
    `Opis użytkownika: ${input.brief}.`,
    `Cel kampanii: ${input.goal}. Motyw lub produkt: ${input.subject}.`,
    `Kierunek wizualny: ${style}.`,
    'Paleta zgodna ze sklepem: nowoczesne odcienie niebieskiego i fioletu, neutralne jasne tło oraz naturalne kolory produktów.',
    'Najważniejsze elementy umieść po prawej lub centralnie, pozostawiając bezpieczną, spokojniejszą przestrzeń po lewej na tytuł i przycisk nakładane przez stronę.',
    'Grafika ma wyglądać jak gotowa kampania dużego sklepu internetowego, być atrakcyjna także po przycięciu na telefonie.',
    'Nie dodawaj żadnych liter, napisów, cen, znaków wodnych, logotypów ani ramek. Nie kopiuj chronionych postaci ani marek.',
  ].join(' ');
}

function imageError(response, payload) {
  const message = clean(payload?.error?.message || payload?.message || `OpenAI HTTP ${response.status}`, 700);
  const error = new Error(message || 'Nie udało się wygenerować grafiki.');
  error.code = clean(payload?.error?.code || payload?.error?.type || 'openai_image_error', 100);
  error.status = response.status >= 400 && response.status < 500 ? 422 : 502;
  return error;
}

export function createAiBannerGenerator({ read, write, remove, fetchImpl = globalThis.fetch, apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2', publicPath = '/api/store?action=ai-banner-image&id=' } = {}) {
  if (typeof read !== 'function' || typeof write !== 'function') throw new Error('Generator AI wymaga repozytorium danych.');
  if (typeof fetchImpl !== 'function') throw new Error('Generator AI wymaga klienta HTTP.');

  async function list() {
    const index = await read(ASSET_INDEX_KEY, { items: [], updatedAt: null });
    return { items: Array.isArray(index?.items) ? index.items.slice(0, 40) : [], updatedAt: index?.updatedAt || null };
  }

  async function saveIndex(item) {
    const previous = await list();
    const items = [item, ...previous.items.filter((entry) => entry?.id !== item.id)].slice(0, 40);
    await write(ASSET_INDEX_KEY, { items, updatedAt: item.createdAt });
    return items;
  }

  async function generate(raw = {}) {
    if (!clean(apiKey, 300)) {
      const error = new Error('Generator grafiki AI nie ma skonfigurowanego klucza OpenAI.');
      error.code = 'openai_not_configured';
      error.status = 503;
      throw error;
    }
    const input = normalizeAiBannerRequest(raw), prompt = buildAiBannerPrompt(input);
    const response = await fetchImpl('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: '1536x1024',
        quality: input.quality,
        output_format: 'webp',
        output_compression: 82,
        background: 'opaque',
        moderation: 'auto',
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw imageError(response, payload);
    const base64 = clean(payload?.data?.[0]?.b64_json, 20 * 1024 * 1024);
    if (!base64) {
      const error = new Error('OpenAI nie zwrócił danych obrazu. Spróbuj ponownie.');
      error.code = 'image_empty';
      error.status = 502;
      throw error;
    }
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length < 10_000 || bytes.length > 10 * 1024 * 1024) {
      const error = new Error('Wygenerowany obraz ma nieprawidłowy rozmiar.');
      error.code = 'image_size_invalid';
      error.status = 502;
      throw error;
    }
    const id = `ai_${Date.now()}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const createdAt = new Date().toISOString();
    const url = `${publicPath}${encodeURIComponent(id)}`;
    const record = { id, mime: 'image/webp', base64: bytes.toString('base64'), bytes: bytes.length, sha256, createdAt, model, input, prompt };
    await write(`${ASSET_PREFIX}${id}`, record);
    const metadata = { id, url, mime: record.mime, bytes: record.bytes, sha256, createdAt, model, brief: input.brief, title: input.title, discountCode: input.discountCode, style: input.style, quality: input.quality };
    await saveIndex(metadata);
    return metadata;
  }

  async function asset(id = '') {
    const normalized = clean(id, 100);
    if (!/^ai_[0-9]{10,16}_[a-f0-9]{8,20}$/.test(normalized)) return null;
    return read(`${ASSET_PREFIX}${normalized}`, null);
  }

  async function deleteAsset(id = '') {
    const normalized = clean(id, 100), existing = await asset(normalized);
    if (!existing) return false;
    const previous = await list(), items = previous.items.filter((entry) => entry?.id !== normalized), updatedAt = new Date().toISOString();
    await write(ASSET_INDEX_KEY, { items, updatedAt });
    if (typeof remove === 'function') await remove(`${ASSET_PREFIX}${normalized}`);
    return true;
  }

  return Object.freeze({ generate, list, asset, deleteAsset });
}
