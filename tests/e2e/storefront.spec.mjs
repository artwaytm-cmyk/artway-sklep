import { expect, test } from '@playwright/test';

function observeRuntime(page) {
  const pageErrors = [];
  const criticalRequestFailures = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    if (/\.(?:js|css)(?:\?|$)/i.test(request.url())) {
      criticalRequestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || 'błąd'}`);
    }
  });
  return () => {
    expect(pageErrors, 'Nieobsłużone błędy JavaScript').toEqual([]);
    expect(criticalRequestFailures, 'Niewczytane pliki JS/CSS').toEqual([]);
  };
}

async function waitForCatalog(page) {
  await expect(page.locator('#grid .card').first()).toBeVisible({ timeout: 20_000 });
}

test('@public sklep ładuje katalog i wyszukuje prawdziwym zdarzeniem użytkownika', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Artway-TM/i);
  await expect(page.getByRole('link', { name: /Artway-TM/i }).first()).toBeVisible();
  await waitForCatalog(page);

  const firstCard = page.locator('#grid .card').first();
  const productPath = await firstCard.locator('h3 a').getAttribute('href');
  const productId = decodeURIComponent(String(productPath || '').split('/').filter(Boolean).at(-1) || '');
  const initialSummary = (await page.locator('#wynikowProdukty').innerText()).trim();
  expect(productId).not.toBe('');
  await page.getByRole('textbox', { name: 'Szukaj', exact: true }).fill(productId);
  await expect(page.locator('#wynikowProdukty')).not.toHaveText(initialSummary);
  await expect(page.locator('#grid .card').first()).toBeVisible();
  assertRuntime();
});

test('@public ilość produktu trafia do koszyka bez przeładowania dokumentu', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await page.goto('/');
  await waitForCatalog(page);

  const card = page.locator('#grid .card').filter({ has: page.locator('button.add-btn:not([disabled])') }).first();
  await expect(card).toBeVisible();
  await card.locator('[data-card-quantity]').fill('2');
  await card.getByRole('button', { name: 'Do koszyka', exact: true }).click();
  await expect(page.locator('#cartCount')).toHaveText('2');
  await page.locator('#cartBtn').click();
  await expect(page.locator('#drawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#cartItems')).not.toBeEmpty();
  assertRuntime();
});

test('@public układ mobilny nie tworzy poziomego przewijania', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForCatalog(page);
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(page.locator('#cartBtn')).toBeVisible();
  assertRuntime();
});

test('lokalny administrator loguje się i przechodzi między modułami panelu', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await page.goto('/#/logowanie');
  await expect(page.locator('#loginForm')).toBeVisible();
  await page.locator('#loginForm [name="email"]').fill('admin');
  await page.locator('#loginForm [name="haslo"]').fill('admin');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();

  await expect(page).toHaveURL(/#\/admin(?:\/|$)/, { timeout: 20_000 });
  await expect(page.locator('.admin-page')).toBeVisible();
  await expect(page.locator('.admin-nav')).toBeVisible();

  const inventoryGroup = page.getByRole('button', { name: /Towar i dane/ });
  await expect(inventoryGroup).toBeVisible();
  await inventoryGroup.click();
  await expect(inventoryGroup).toHaveAttribute('aria-expanded', 'true');
  const inventoryLink = page.locator('a[href="#/admin/asortyment"]').first();
  await expect(inventoryLink).toBeVisible();
  await inventoryLink.click();
  await expect(page).toHaveURL(/#\/admin\/asortyment$/);
  await expect(page.locator('.admin-page')).toBeVisible();
  assertRuntime();
});

async function loginAdmin(page) {
  await page.goto('/#/logowanie');
  await page.locator('#loginForm [name="email"]').fill('admin');
  await page.locator('#loginForm [name="haslo"]').fill('admin');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).toHaveURL(/#\/admin(?:\/|$)/, { timeout: 20_000 });
}

test('główne działy administratora mają jeden profesjonalny szablon i nie tworzą poziomego suwaka', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  const routes = [
    '/admin/allegro/wystawianie',
    '/admin/asortyment/produkty',
    '/admin/magazyn/stany',
    '/admin/zamowienia',
    '/admin/wysylki',
    '/admin/agent-ai',
    '/admin/seo/efekty',
    '/admin/personalizacja/home',
    '/admin/infakt',
    '/admin/system',
  ];
  for (const route of routes) {
    await page.goto(`/#${route}`);
    const workspace = page.locator('.admin-workspace-content[data-admin-layout="unified-v2"]');
    await expect(workspace).toBeVisible();
    await expect(workspace.locator('.admin-unified-hero').first()).toBeVisible();
    const dimensions = await workspace.evaluate((element) => ({ width: element.clientWidth, content: element.scrollWidth }));
    expect(dimensions.content, `Poziome przepełnienie na ${route}`).toBeLessThanOrEqual(dimensions.width + 1);
  }
  assertRuntime();
});

test('istniejąca podstrona Efekty obsługuje zakres dzienny i pełne zestawienia', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  await page.goto('/#/admin/seo/efekty');
  await expect(page.locator('[data-seo-effects-workspace]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dzisiaj', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wyniki każdego dnia' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Z którego adresu wszedł klient' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Efektywność produktów' })).toBeVisible();
  await page.getByRole('button', { name: 'Dzisiaj', exact: true }).click();
  const dates = page.locator('[data-seo-effects-workspace] input[type="date"]');
  await expect(dates.nth(0)).toHaveValue(await dates.nth(1).inputValue());
  assertRuntime();
});

test('Centrum systemu pokazuje wersję i bezpieczny przycisk aktualizacji przeglądarki', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  await page.goto('/#/admin/system');
  await expect(page.getByRole('heading', { name: 'System i aktualizacje' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pobierz i uruchom aktualizację' })).toBeVisible();
  await expect(page.locator('.module-tabs-panel a[href="#/admin/system/diagnostyka"]')).toBeVisible();
  await expect(page.locator('.module-tabs-panel a[href="#/admin/system/logi"]')).toBeVisible();
  await expect(page.locator('.module-tabs-panel a[href="#/admin/system/kopie"]')).toBeVisible();
  assertRuntime();
});

test('wspólny układ panelu pozostaje czytelny w aplikacji mobilnej', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAdmin(page);
  for (const route of ['/admin/asortyment/produkty', '/admin/magazyn/stany', '/admin/zamowienia', '/admin/agent-ai']) {
    await page.goto(`/#${route}`);
    const workspace = page.locator('.admin-workspace-content[data-admin-layout="unified-v2"]');
    await expect(workspace).toBeVisible();
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content, `Poziome przepełnienie mobilne na ${route}`).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
  assertRuntime();
});
