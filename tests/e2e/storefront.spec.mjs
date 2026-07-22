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
