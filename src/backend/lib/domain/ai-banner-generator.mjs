import crypto from 'node:crypto';

const ASSET_INDEX_KEY = 'ai_banner_assets';
const ASSET_PREFIX = 'ai_banner_asset:';
const ALLOWED_QUALITY = new Set(['low', 'medium', 'high']);
const ALLOWED_STYLE = new Set(['produktowy', 'radosny', 'elegancki', 'imprezowy', 'minimalny']);
const ALLOWED_KINDS = new Set(['banner', 'icon']);
const ALLOWED_ICON_USES = new Set(['category', 'subpage', 'navigation']);
const ALLOWED_FORMATS = new Set(['landscape', 'square', 'portrait']);
const ALLOWED_COMPOSITIONS = new Set(['text-left', 'text-right', 'center']);
const ALLOWED_PALETTES = new Set(['brand', 'pastel', 'warm', 'premium', 'natural']);

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
    kind: ALLOWED_KINDS.has(clean(source.kind, 20)) ? clean(source.kind, 20) : 'banner',
    iconUse: ALLOWED_ICON_USES.has(clean(source.iconUse, 30)) ? clean(source.iconUse, 30) : 'category',
    brief,
    goal: clean(source.goal, 160) || 'promocja sklepu internetowego',
    subject: clean(source.subject, 220) || 'gry, zabawki lub artykuły imprezowe',
    style: ALLOWED_STYLE.has(clean(source.style, 30)) ? clean(source.style, 30) : 'produktowy',
    quality: ALLOWED_QUALITY.has(clean(source.quality, 20)) ? clean(source.quality, 20) : 'medium',
    format: ALLOWED_FORMATS.has(clean(source.format, 20)) ? clean(source.format, 20) : (clean(source.kind, 20) === 'icon' ? 'square' : 'landscape'),
    composition: ALLOWED_COMPOSITIONS.has(clean(source.composition, 30)) ? clean(source.composition, 30) : 'text-left',
    palette: ALLOWED_PALETTES.has(clean(source.palette, 30)) ? clean(source.palette, 30) : 'brand',
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
  const palette = {
    brand: 'nowoczesny niebieski i fiolet jako akcenty, jasne neutralne tło i naturalne kolory przedmiotu',
    pastel: 'miękkie pastele, jasne tło, delikatny niebieski i fiolet',
    warm: 'ciepłe, rodzinne kolory z kontrolowanym pomarańczowym i czerwonym akcentem',
    premium: 'granat, fiolet, biel i subtelne złote akcenty',
    natural: 'naturalne kolory produktu, kremowe tło i spokojna zieleń',
  }[input.palette] || 'kolory spójne ze sklepem Artway-TM';
  if (input.kind === 'icon') return [
    'Stwórz pojedynczą, kwadratową ikonę interfejsu dla polskiego sklepu Artway-TM.',
    `Opis ikony: ${input.brief}. Zastosowanie: ${input.iconUse === 'subpage' ? 'nagłówek podstrony' : input.iconUse === 'navigation' ? 'nawigacja sklepu' : 'katalog produktów'}.`,
    `Motyw: ${input.subject}. Kierunek wizualny: ${style}.`,
    'Ikona ma być prosta, nowoczesna i natychmiast rozpoznawalna również w rozmiarze 32–64 px.',
    'Kompozycja centralna, jeden główny symbol, czytelna sylwetka, delikatna głębia i spójna grubość detali.',
    `Paleta: ${palette}. Tło ma być jednolite, jasne i łatwe do wizualnego wtopienia w interfejs sklepu.`,
    'Nie dodawaj żadnych liter, napisów, liczb, cen, znaków wodnych, logotypów ani ramek. Nie kopiuj chronionych postaci ani marek.',
  ].join(' ');
  return [
    'Stwórz poziomą grafikę hero/banner dla polskiego sklepu Artway-TM.',
    `Opis użytkownika: ${input.brief}.`,
    `Cel kampanii: ${input.goal}. Motyw lub produkt: ${input.subject}.`,
    `Kierunek wizualny: ${style}.`,
    `Paleta: ${palette}.`,
    input.composition === 'text-right'
      ? 'Najważniejsze elementy umieść po lewej, pozostawiając bezpieczną, spokojniejszą przestrzeń po prawej na tytuł i przycisk nakładane przez stronę.'
      : input.composition === 'center'
        ? 'Zbuduj centralną, symetryczną kompozycję z bezpiecznym środkiem i marginesami odpornymi na przycięcie.'
        : 'Najważniejsze elementy umieść po prawej, pozostawiając bezpieczną, spokojniejszą przestrzeń po lewej na tytuł i przycisk nakładane przez stronę.',
    'Grafika ma wyglądać jak gotowa kampania dużego sklepu internetowego, być atrakcyjna także po przycięciu na telefonie.',
    'Nie dodawaj żadnych liter, napisów, cen, znaków wodnych, logotypów ani ramek. Nie kopiuj chronionych postaci ani marek.',
  ].join(' ');
}

export function aiImageRequestLayout(input, model = 'gpt-image-2') {
  const isIcon = input.kind === 'icon';
  const format = isIcon ? 'square' : input.format;
  const size = format === 'portrait' ? '1024x1536' : format === 'square' ? '1024x1024' : '1536x1024';
  // GPT Image 2 currently rejects transparent backgrounds. Keep icons usable by
  // generating them on a clean, store-compatible opaque canvas instead of failing.
  const transparentSupported = !/^gpt-image-2(?:$|-)/i.test(String(model || ''));
  return { size, background: isIcon && transparentSupported ? 'transparent' : 'opaque', transparentSupported };
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
    const input = normalizeAiBannerRequest(raw), prompt = buildAiBannerPrompt(input), layout = aiImageRequestLayout(input, model);
    const response = await fetchImpl('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: layout.size,
        quality: input.quality,
        output_format: 'webp',
        output_compression: 82,
        background: layout.background,
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
    const record = { id, mime: 'image/webp', base64: bytes.toString('base64'), bytes: bytes.length, sha256, createdAt, model, input, prompt, background: layout.background, size: layout.size };
    await write(`${ASSET_PREFIX}${id}`, record);
    const metadata = { id, url, mime: record.mime, bytes: record.bytes, sha256, createdAt, model, kind: input.kind, iconUse: input.iconUse, brief: input.brief, title: input.title, discountCode: input.discountCode, style: input.style, quality: input.quality, format: input.format, composition: input.composition, palette: input.palette, background: layout.background, size: layout.size };
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
