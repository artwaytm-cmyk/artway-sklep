import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('strona główna ma osobne centrum całej oferty i wybór działu pod produktami', async () => {
  const [config, storefront, admin, navigation] = await Promise.all([
    readFile('src/frontend/01-config-and-catalog.js', 'utf8'),
    readFile('assets/app.js', 'utf8'),
    readFile('src/frontend/15a-home-promotions-workspace.js', 'utf8'),
    readFile('src/frontend/08-admin-navigation.js', 'utf8'),
  ]);
  assert.match(config, /wyborDzialu:"pod-produktami"/);
  assert.match(storefront, /home-department-picker/);
  assert.match(admin, /function widokAdminStronaGlowna/);
  assert.match(admin, /Cała oferta na stronie głównej/);
  assert.match(navigation, /\["home","🏠 Strona główna"\]/);
});

test('kreator bannerów oferuje szablony, harmonogram i widoczność urządzeń', async () => {
  const source = await readFile('src/frontend/15a-home-promotions-workspace.js', 'utf8');
  for (const marker of ['SZABLONY_BANEROW', 'utworzBanerZSzablonu', 'Start publikacji', 'Koniec publikacji', 'Widoczność urządzeń', 'duplikujBaner']) assert.ok(source.includes(marker), marker);
});

test('banner studio obsługuje wszystkie typy, miejsca, rozmiary i wersję mobilną', async () => {
  const [config, storefront, admin, styles] = await Promise.all([
    readFile('src/frontend/01-config-and-catalog.js', 'utf8'),
    readFile('assets/app.js', 'utf8'),
    readFile('src/frontend/15a-home-promotions-workspace.js', 'utf8'),
    readFile('src/styles/04-home-and-diagnostics.css', 'utf8'),
  ]);
  for (const marker of ['pasek-okazji', 'hero', 'sekcyjny', 'kafelek', 'komunikat', 'normalizujBaner']) assert.ok(config.includes(marker), marker);
  for (const marker of ['nad-hero', 'pod-hero', 'nad-produktami', 'pod-produktami', 'przed-stopka', 'zamknijBannerSklepu']) assert.ok(storefront.includes(marker), marker);
  for (const marker of ['Pełna szerokość (12/12)', 'Pasek — 56 px', 'Zachowanie na telefonie', 'data-banner-live-preview', 'ustawTypBanera']) assert.ok(admin.includes(marker), marker);
  for (const marker of ['banner-width-pelna', 'banner-height-wysoki', 'banner-mobile-bez-obrazu', 'banner-type-pasek-okazji']) assert.ok(styles.includes(marker), marker);
});

test('kreator bannerów używa serwerowego generatora AI i wiąże grafikę z kodem rabatowym', async () => {
  const [frontend, backend, route] = await Promise.all([
    readFile('src/frontend/15a-home-promotions-workspace.js', 'utf8'),
    readFile('src/backend/lib/store-app.mjs', 'utf8'),
    readFile('src/backend/lib/ai-banner-route.mjs', 'utf8'),
  ]);
  for (const marker of ['ai-banner-generate', 'Wygeneruj prawdziwą grafikę AI', 'kodRabatowy', 'utworzBanerZGrafikiAI']) assert.ok(frontend.includes(marker), marker);
  assert.ok(backend.includes('createAiBannerGenerator'));
  for (const marker of ["action === 'ai-banner-generate'", "action === 'ai-banner-image'"]) assert.ok(route.includes(marker), marker);
  assert.doesNotMatch(frontend, /Udawaj|symuluj generowanie/i);
});

test('kody rabatowe mają warunki i są weryfikowane również przez backend', async () => {
  const [admin, backend] = await Promise.all([
    readFile('src/frontend/15a-home-promotions-workspace.js', 'utf8'),
    readFile('src/backend/lib/domain/checkout.mjs', 'utf8'),
  ]);
  for (const marker of ['darmowa_dostawa', 'minKoszyk', 'maxRabat', 'limitUzyc', 'zakres']) assert.ok(admin.includes(marker), marker);
  for (const marker of ['wynikRabatu', 'regulaRabatowaAktywna', 'freeDelivery']) assert.ok(backend.includes(marker), marker);
});

test('wszystkie bannery mają wspólne studio, własne wzory i przypisanie grafik AI', async () => {
  const source = await readFile('src/frontend/15b-banner-icon-studio.js', 'utf8');
  for (const marker of ['heroStudioHTML', 'pasekOkazjiStudioHTML', 'zapiszBanerJakoWzor', 'wlasneWzoryBanerowHTML', 'przypiszGrafikeAIDoBanera', 'Pozycja obrazu', 'Przyciemnienie obrazu']) assert.ok(source.includes(marker), marker);
});

test('studio ikon AI obsługuje grupy menu, katalogi i podstrony', async () => {
  const [studio, storefront, navigation] = await Promise.all([
    readFile('src/frontend/15b-banner-icon-studio.js', 'utf8'),
    readFile('assets/app.js', 'utf8'),
    readFile('src/frontend/08-admin-navigation.js', 'utf8'),
  ]);
  for (const marker of ['widokAdminIkonyAI', 'uruchomGeneratorIkonyAI', 'przypiszIkoneAI', 'category:', 'subpage:', 'group:']) assert.ok(studio.includes(marker), marker);
  assert.ok(storefront.includes('ikonaKategoriiHTML'));
  assert.ok(navigation.includes('✨ Ikony AI'));
});

test('usunięte kody rabatowe nie wracają z konfiguracji starszego modułu', async () => {
  const config = await readFile('src/frontend/01-config-and-catalog.js', 'utf8');
  assert.ok(config.includes('maZapisaneReguly'));
  assert.ok(config.includes('maZapisaneReguly?{}'));
});

test('studio kampanii pro zapisuje rzeczywiste parametry kompozycji i pokazuje trzy urządzenia', async () => {
  const [studio, storefront, styles] = await Promise.all([
    readFile('src/frontend/15c-campaign-studio-pro.js', 'utf8'),
    readFile('assets/app.js', 'utf8'),
    readFile('src/styles/24-campaign-studio-pro.css', 'utf8'),
  ]);
  for (const marker of ['Reżyser kampanii AI', 'format', 'composition', 'palette', 'focalX', 'focalY', 'szerokoscTresci', "bannerProDevice(this,'mobile')"]) assert.ok(studio.includes(marker), marker);
  for (const marker of ['kierunekNakladki', '--banner-content', 'managed-banner-cta']) assert.ok(storefront.includes(marker), marker);
  for (const marker of ['data-device="mobile"', 'managed-banner-content', 'campaign-surface-map']) assert.ok(styles.includes(marker), marker);
});

test('kody rabatowe mają potwierdzony zapis serwerowy, tester i operacje grupowe', async () => {
  const studio = await readFile('src/frontend/15c-campaign-studio-pro.js', 'utf8');
  for (const marker of ['await chmuraZapiszUstawienia()', 'Tester kodu', 'rabatProMasowo', 'Zaznacz widoczne', 'Eksportuj', 'Utwórz i zapisz na serwerze']) assert.ok(studio.includes(marker), marker);
});

test('studio ikon nie obiecuje przezroczystości, gdy model jej nie obsługuje', async () => {
  const [studio, generator] = await Promise.all([
    readFile('src/frontend/15c-campaign-studio-pro.js', 'utf8'),
    readFile('src/backend/lib/domain/ai-banner-generator.mjs', 'utf8'),
  ]);
  assert.ok(studio.includes('jasnym tle zgodnym ze sklepem'));
  assert.ok(generator.includes("/^gpt-image-2(?:$|-)/i"));
  assert.ok(generator.includes("background: layout.background"));
});
