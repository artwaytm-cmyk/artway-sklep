import { expect, test } from '@playwright/test';

function observeRuntime(page) {
  const pageErrors = [];
  const criticalRequestFailures = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText || 'błąd';
    // Nawigacja po SPA świadomie anuluje moduły poprzedniej trasy. Chromium
    // raportuje to jako ERR_ABORTED, mimo że nie jest to awaria zasobu.
    if (/\.(?:js|css)(?:\?|$)/i.test(request.url()) && !/ERR_ABORTED/i.test(errorText)) {
      criticalRequestFailures.push(`${request.method()} ${request.url()}: ${errorText}`);
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

async function mockAdminSession(page) {
  const user = { imie: 'Administrator', email: 'artwaytm@gmail.com', rola: 'admin', verified: true, adminIdleTimeoutMinutes: 60 };
  await page.route('**/api/store**', async (route) => {
    const action = new URL(route.request().url()).searchParams.get('action');
    if (['login', 'session-refresh', 'account-session'].includes(action)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, authenticated: true, user }) });
      return;
    }
    if (action === 'agent-runtime-status') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, runtime: { state: 'ready', running: false, queue: { counts: {} }, eventQueue: { active: 0, queued: 0, running: 0, recent: [] }, history: [] } }) });
      return;
    }
    if (action === 'agent-product-report') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        report: {
          available: true, total: 1, page: 1, pages: 1, limit: 50, revision: new Date().toISOString(),
          summary: { total: 1, working: 0, ready: 1, decision: 0, needs_data: 0, not_started: 0, store_prepared: 1, store_ready: 1, allegro_prepared: 1, allegro_ready: 1, von_prepared: 1, von_ready: 1, ready_to_list: 1, needs_update: 0 },
          items: [{
            productId: 'E2E-AGENT-1', name: 'Gra przygotowana przez Agenta', producer: 'MultiGra', ean: '5900000000999',
            image: '/images/placeholder-product.svg', status: 'ready', saleAvailable: true, hasAllegro: false, updatedAt: new Date().toISOString(),
            task: { status: 'completed', missing: [] },
            store: { prepared: true, ready: true, updatedAt: new Date().toISOString(), savedFields: ['opisKrotki', 'opis'] },
            allegro: { prepared: true, ready: true, updatedAt: new Date().toISOString(), savedFields: ['allegroTitle'], readyToList: true, needsUpdate: false },
            vonHalsky: { prepared: true, ready: true, updatedAt: new Date().toISOString(), savedFields: ['vonHalskyDescription'] },
          }],
        },
      }) });
      return;
    }
    if (action === 'agent-specialists-status') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, specialists: [], decisions: [], history: [] }) });
      return;
    }
    await route.fallback();
  });
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
  await mockAdminSession(page);
  await page.goto('/#/logowanie');
  await page.waitForFunction(() => chmuraStan.sprawdzono === true);
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

test('Asortyment filtruje i zapisuje cenę bez przebudowy całego panelu', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  let queryCount = 0, priceSaveCount = 0, savedPrice = 29.9;
  const products = [
    { id: 'E2E-101', nazwa: 'Alpha gra testowa', cena: savedPrice, cenaZakupu: 12, kategoria: 'Gry', producent: 'Alexander', externalId: 'ALPHA-101', sku: 'ALPHA-101', gtin: '5900000000101', zdjecie: '/images/placeholder-product.svg', sourceUrl: 'https://example.test/alpha' },
    { id: 'E2E-102', nazwa: 'Beta gra testowa', cena: 39.9, cenaZakupu: 16, kategoria: 'Gry', producent: 'Multigra', externalId: 'BETA-102', sku: 'BETA-102', gtin: '5900000000102', zdjecie: '/images/placeholder-product.svg', sourceUrl: 'https://example.test/beta' },
  ];
  await page.route('**/api/store**', async (route) => {
    const url = new URL(route.request().url()), action = url.searchParams.get('action');
    if (action === 'product-catalog-query') {
      queryCount++;
      const query = String(url.searchParams.get('q') || '').toLowerCase();
      const items = products
        .filter((product) => !query || `${product.nazwa} ${product.externalId} ${product.gtin}`.toLowerCase().includes(query))
        .map((product) => ({
          ...product,
          ...(product.id === 'E2E-101' ? { cena: savedPrice } : {}),
          _catalog: {
            recordStatus: 'active',
            source: 'bazowy',
            missingFields: [],
            availability: { saleAvailable: true },
            inventory: { stock: 8 },
            channels: { allegro: { offerId: '', status: '' } },
          },
        }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true, available: true, private: true, items, ids: items.map((item) => item.id),
          total: items.length, page: 1, limit: 50,
          summary: { total: 2, active: 2, ready: 2, missing: 0, hidden: 0, connected: 0, promotions: 0, trash: 0, duplicate_store: 0, duplicate_allegro: 0 },
          facets: { categories: [{ value: 'Gry', count: 2 }], producers: [{ value: 'Alexander', count: 1 }, { value: 'Multigra', count: 1 }] },
        }),
      });
      return;
    }
    if (action === 'catalog-product-price-update') {
      const body = route.request().postDataJSON();
      priceSaveCount++;savedPrice = Number(body.value);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true, confirmed: true, productId: body.productId, channel: body.channel,
          value: savedPrice, fields: { cena: savedPrice, cenaManualna: true },
          remove: [], publication: { published: true, queued: false, readbackConfirmed: true },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('/#/admin/asortyment/produkty');
  await expect(page.locator('[data-assortment-product-card]')).toHaveCount(2);
  await page.evaluate(() => { window.__assortmentWorkspaceBefore = document.querySelector('.assortment-catalog-workspace'); });
  const initialQueries = queryCount;
  await page.locator('[data-assortment-search]').fill('Beta');
  await expect(page.locator('[data-assortment-product-card]')).toHaveCount(1);
  await expect(page.locator('[data-assortment-product-card]')).toContainText('Beta gra testowa');
  expect(queryCount).toBeGreaterThan(initialQueries);
  expect(await page.evaluate(() => window.__assortmentWorkspaceBefore === document.querySelector('.assortment-catalog-workspace'))).toBe(true);

  await page.locator('[data-assortment-search]').fill('');
  const alpha = page.locator('[data-assortment-product-card]').filter({ hasText: 'Alpha gra testowa' });
  await expect(alpha).toBeVisible();
  const price = alpha.locator('.catalog-product-edit-value').filter({ hasText: 'Cena sklepu' }).locator('input');
  await price.fill('42,90');
  await price.blur();
  await expect(alpha.getByText('Zapisano i opublikowano')).toBeVisible();
  expect(priceSaveCount).toBe(1);
  expect(await page.evaluate(() => window.__assortmentWorkspaceBefore === document.querySelector('.assortment-catalog-workspace'))).toBe(true);

  await page.reload();
  await expect(page.locator('[data-assortment-product-card]').filter({ hasText: 'Alpha gra testowa' })
    .locator('.catalog-product-edit-value').filter({ hasText: 'Cena sklepu' }).locator('input')).toHaveValue('42,90');
  assertRuntime();
});

test('edytor produktu pokazuje trzy widoki klienta i aktualizuje je bez przeładowania', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  const productsResponse = await page.request.get('/products.json');
  const products = await productsResponse.json();
  const sourceProduct = products.find((item) => item?.id);
  const productId = String(sourceProduct?.id);
  expect(productId).not.toBe('');
  await loginAdmin(page);
  await page.route('**/api/store**', async (route) => {
    const url = new URL(route.request().url()), action = url.searchParams.get('action');
    if (action === 'product-catalog-item') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          product: {
            ...sourceProduct,
            manufacturerProfileId: 'e2e-profile',
            manufacturerProfile: {
              id: 'e2e-profile',
              displayName: sourceProduct.producent || 'Alexander',
              address: 'ul. Testowa 1, 00-001 Warszawa',
              email: 'test@example.test',
            },
            _catalog: { ...(sourceProduct._catalog || {}), detailLevel: 'full' },
          },
        }),
      });
      return;
    }
    await route.fallback();
  });
  await page.evaluate(() => {
    sessionStorage.setItem('artway_product_editor_channel', 'store');
    sessionStorage.setItem('artway_product_editor_section', 'summary');
  });
  await page.goto(`/#/admin/produkty/edytuj/${encodeURIComponent(productId)}`);
  const form = page.locator('form.product-editor-form');
  await expect(form).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#product-editor-record')).toBeVisible();
  await expect(page.locator('#product-editor-channels')).toBeVisible();
  await expect(page.locator('#product-editor-store')).toBeHidden();
  await expect(page.locator('#product-editor-shared-data')).toHaveCount(1);
  await expect(page.locator('[data-product-channel-preview]')).toHaveCount(3);

  await page.evaluate(() => { window.__productEditorFormBefore = document.querySelector('form.product-editor-form'); });
  await page.locator('[data-product-section-nav="basics"]').click();
  await expect(page.locator('#product-editor-record')).toBeHidden();
  await expect(page.locator('#product-editor-basics')).toBeVisible();
  await form.locator('[name="nazwa"]').fill('Produkt testowy — podgląd na żywo');
  await page.locator('[data-product-channel-nav="store"]').click();
  await expect(page.locator('[data-product-channel-preview="store"]')).toBeVisible();
  await expect(page.locator('[data-product-channel-preview="store"] h2')).toHaveText('Produkt testowy — podgląd na żywo');
  await form.locator('[name="opis"]').fill('Krótki wstęp o produkcie.\n\n## Najważniejsze cechy\n• Pierwsza potwierdzona cecha\n• Druga potwierdzona cecha\n\nWiek: 6+');
  await expect(page.locator('[data-product-channel-preview="store"] .product-preview-copy h4')).toContainText('Najważniejsze cechy');
  await expect(page.locator('[data-product-channel-preview="store"] .product-preview-copy li')).toHaveCount(2);
  await expect(page.locator('[data-product-channel-preview="store"] .product-preview-specs')).toContainText('Wiek');
  expect(await page.evaluate(() => window.__productEditorFormBefore === document.querySelector('form.product-editor-form'))).toBe(true);

  await page.locator('[data-product-channel-nav="allegro"]').click();
  await expect(page.locator('[data-product-channel-preview="store"]')).toBeHidden();
  await expect(page.locator('[data-product-channel-preview="allegro"]')).toBeVisible();
  await expect(page.locator('.product-allegro-classification')).toBeVisible();
  await expect(page.locator('.product-allegro-classification-flow>article')).toHaveCount(3);
  if (process.env.ARTWAY_VISUAL_CAPTURE) await page.screenshot({ path: '/tmp/artway-product-editor-allegro-desktop.png', fullPage: true });
  await page.locator('[data-product-channel-nav="vonHalsky"]').click();
  await expect(page.locator('[data-product-channel-preview="allegro"]')).toBeHidden();
  await expect(page.locator('[data-product-channel-preview="vonHalsky"]')).toBeVisible();
  if (process.env.ARTWAY_VISUAL_CAPTURE) await page.screenshot({ path: '/tmp/artway-product-editor-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  if (process.env.ARTWAY_VISUAL_CAPTURE) await page.screenshot({ path: '/tmp/artway-product-editor-mobile.png', fullPage: true });
  assertRuntime();
});

test('nowe konto klienta działa po rejestracji i ponownym logowaniu na czystym urządzeniu', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  const user = { imie: 'Test Klienta', email: 'test-klienta@example.test', rola: 'klient' };
  await page.route('**/api/store**', async (route) => {
    const action = new URL(route.request().url()).searchParams.get('action');
    if (action === 'account-register' || action === 'account-login') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, authenticated: true, user }) });
      return;
    }
    if (action === 'store-orders-mine') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, orders: [], deleted_orders: [] }) });
      return;
    }
    if (action === 'session-logout') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.continue();
  });

  await page.goto('/#/rejestracja');
  await page.waitForFunction(() => chmuraStan.sprawdzono === true);
  await page.locator('form [name="imie"]').fill(user.imie);
  await page.locator('form [name="email"]').fill(user.email);
  await page.locator('form [name="haslo"]').fill('BezpieczneHaslo-2026!');
  await page.locator('form [name="haslo2"]').fill('BezpieczneHaslo-2026!');
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL(/#\/konto$/);
  await expect(page.getByRole('button', { name: 'Wyloguj się' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zapisz moje dane' })).toBeVisible();

  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await page.goto('/#/logowanie');
  await page.locator('#loginForm [name="email"]').fill(user.email);
  await page.locator('#loginForm [name="haslo"]').fill('BezpieczneHaslo-2026!');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).toHaveURL(/#\/konto$/);
  await expect(page.getByText(user.email, { exact: false })).toBeVisible();
  await page.evaluate(() => { location.hash = '#/admin'; });
  await expect(page.getByRole('heading', { name: 'Strefa właściciela' })).toBeVisible();
  await expect(page.locator('.admin-page')).toHaveCount(0);
  assertRuntime();
});

async function loginAdmin(page) {
  await mockAdminSession(page);
  await page.goto('/#/logowanie');
  await page.waitForFunction(() => chmuraStan.sprawdzono === true);
  await page.locator('#loginForm [name="email"]').fill('admin');
  await page.locator('#loginForm [name="haslo"]').fill('admin');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).toHaveURL(/#\/admin(?:\/|$)/, { timeout: 20_000 });
}

test('raport Agenta pokazuje trwałe zapisy trzech kanałów i działa bez przeładowania panelu', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  await page.goto('/#/admin/agent-ai/raport');
  await expect(page.getByRole('heading', { name: 'Produkty i kanały' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Produkty obsłużone przez Agenta' })).toBeVisible();
  await expect(page.getByText('Gra przygotowana przez Agenta')).toBeVisible();
  await expect(page.getByText('Gotowy do wystawienia na Allegro')).toBeVisible();
  await expect(page.locator('.agent-report-channel.ready')).toHaveCount(3);
  await page.getByLabel('Kanał').selectOption('allegro');
  await expect(page.getByText('Gra przygotowana przez Agenta')).toBeVisible();
  await expect(page).toHaveURL(/#\/admin\/agent-ai\/raport$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.agent-report-catalog')).toBeVisible();
  const width = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
  assertRuntime();
});

test('administrator tworzy PZ i WZ jednym kliknięciem bez dublowania żądania', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  const documents = [];
  const createRequests = [];
  await page.route('**/api/store**', async (route) => {
    const url = new URL(route.request().url()), action = url.searchParams.get('action');
    if (action === 'warehouse-documents-list') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, documents, rev: documents.length }) });
      return;
    }
    if (action === 'warehouse-document-create') {
      const body = route.request().postDataJSON();
      createRequests.push(body);
      const document = {
        id: `WD-E2E-${body.type}`,
        number: `${body.type}/2026/07/0001`,
        type: body.type,
        status: 'draft',
        warehouse: body.warehouse,
        reference: '',
        note: '',
        lines: [],
        revision: 1,
        createdAt: '2026-07-28T12:00:00.000Z',
        updatedAt: '2026-07-28T12:00:00.000Z',
      };
      documents.unshift(document);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, created: true, document, documents, rev: documents.length }) });
      return;
    }
    await route.fallback();
  });
  await loginAdmin(page);
  await page.goto('/#/admin/magazyn/plan');
  await expect(page.locator('[data-restock-mode="braki"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-restock-mode="pz-wz"]').click();
  await expect(page.locator('[data-restock-mode="pz-wz"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ops-control-center')).toHaveCount(0);
  await expect(page.locator('[data-create-warehouse-document="PZ"]')).toBeVisible();
  await page.locator('[data-create-warehouse-document="PZ"]').click();
  await expect(page.getByRole('heading', { name: 'PZ/2026/07/0001' })).toBeVisible();
  await page.getByRole('button', { name: /Wszystkie dokumenty/ }).click();
  await page.locator('[data-create-warehouse-document="WZ"]').click();
  await expect(page.getByRole('heading', { name: 'WZ/2026/07/0001' })).toBeVisible();
  expect(createRequests.map((request) => request.type)).toEqual(['PZ', 'WZ']);
  expect(createRequests.every((request) => /^create-(?:pz|wz)-/.test(request.requestId))).toBe(true);
  assertRuntime();
});

test('stany magazynowe wyszukują po kodzie i przełączają układ na regały', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  await page.goto('/#/admin/magazyn/stany');
  await expect(page.locator('[data-warehouse-code-search]')).toBeVisible();
  await page.locator('[data-warehouse-code-search]').fill('1523');
  await expect(page.locator('.warehouse-stock-results')).toContainText(/Pokazano/);
  await page.locator('[data-warehouse-grouping]').selectOption('regaly');
  await expect(page.locator('[data-warehouse-grouping]')).toHaveValue('regaly');
  assertRuntime();
});

test('Moje konto administratora pokazuje zabezpieczenia i zarządzanie dostępem właściciela', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  await page.goto('/#/konto');
  await expect(page.getByRole('heading', { name: 'Moje konto administratora' })).toBeVisible();
  await expect(page.getByText('Ochrona dostępu jest aktywna.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zarządzaj uprawnieniami' })).toBeVisible();
  await expect(page.getByText('Google Authenticator', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zapisz nowe hasło' })).toBeVisible();
  await page.getByText('Skonfiguruj Authenticator ponownie').click();
  await expect(page.getByRole('button', { name: 'Odłącz i skonfiguruj ponownie' })).toBeVisible();
  assertRuntime();
});

test('delegowany administrator działa na czystym urządzeniu bez lokalnej kopii ról', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('artway_uzytkownicy', JSON.stringify([]));
    localStorage.setItem('artway_sesja', JSON.stringify({
      imie: 'Tomasz Miotke',
      email: 'tom90mio@gmail.com',
      rola: 'admin',
      verified: true,
    }));
  });
  await page.reload();
  await page.goto('/#/admin');
  await expect(page.locator('.admin-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Strefa właściciela' })).toHaveCount(0);
  assertRuntime();
});

test('właściciel nadaje, odbiera i usuwa konto bez lokalnego pozornego zapisu', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  let users = [
    { imie: 'Administrator', email: 'artwaytm@gmail.com', rola: 'admin', mfaEnabled: true, data: '2026-01-01T10:00:00Z' },
    { imie: 'Klient Testowy', email: 'uprawnienia@example.test', rola: 'klient', data: '2026-07-23T10:00:00Z' },
  ];
  await page.route('**/api/store**', async (route) => {
    const url = new URL(route.request().url()), action = url.searchParams.get('action');
    if (action === 'store-users-admin') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, users, usersVersion: String(Date.now()), count: users.length }) });
      return;
    }
    if (action === 'store-user-role') {
      const body = route.request().postDataJSON();
      users = users.map((user) => user.email === body.email ? { ...user, rola: body.role, mfaEnabled: false } : user);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, changed: true, sessionInvalidated: true, user: users.find((user) => user.email === body.email) }) });
      return;
    }
    if (action === 'account-mfa-reset') {
      const body = route.request().postDataJSON();
      users = users.map((user) => user.email === body.email ? { ...user, mfaEnabled: false } : user);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, reset: true, enrollmentRequired: true, sessionInvalidated: true, user: users.find((user) => user.email === body.email) }) });
      return;
    }
    if (action === 'store-user-delete') {
      const body = route.request().postDataJSON();
      users = users.filter((user) => user.email !== body.email);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, deleted: true, sessionInvalidated: true }) });
      return;
    }
    await route.continue();
  });
  await page.evaluate((records) => {
    localStorage.setItem('artway_uzytkownicy', JSON.stringify(records));
    uzytkownicyAdminOstatnieOdswiezenie = 0;
  }, users);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/#/admin/klienci/uprawnienia');
  const row = page.locator('tr').filter({ hasText: 'uprawnienia@example.test' });
  await expect(row).toBeVisible();
  await row.getByTitle('Nadaj rolę administratora').click();
  await expect(row.getByText('administrator', { exact: true })).toBeVisible();
  await row.getByTitle('Resetuj Google Authenticator').click();
  await expect(row.getByText('MFA przy następnym logowaniu')).toBeVisible();
  await row.getByTitle('Odbierz rolę administratora').click();
  await expect(row.getByText('klient', { exact: true })).toBeVisible();
  await row.getByTitle('Usuń konto').click();
  await expect(row).toHaveCount(0);
  assertRuntime();
});

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
    '/admin/von-halsky',
    '/admin/system',
  ];
  for (const route of routes) {
    await page.goto(`/#${route}`);
    const workspace = page.locator('.admin-workspace-content[data-admin-layout="unified-v2"]');
    await expect(workspace, `Nie załadowano obszaru roboczego na ${route}`).toBeVisible();
    await expect(workspace.locator('.admin-unified-hero').first(), `Brak wspólnego nagłówka na ${route}`).toBeVisible();
    const dimensions = await workspace.evaluate((element) => ({ width: element.clientWidth, content: element.scrollWidth }));
    expect(dimensions.content, `Poziome przepełnienie na ${route}`).toBeLessThanOrEqual(dimensions.width + 1);
  }
  assertRuntime();
});

test('Wystawianie rozdziela brak towaru od szkiców i nie pokazuje ogólnego filtra nieaktywnych', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  await page.goto('/#/admin/allegro/wystawianie');
  const queueFilter = page.getByLabel('Dokładny stan kolejki');
  await expect(queueFilter).toBeVisible();
  for (const label of ['Bez oferty Allegro', 'Szkice do aktywacji', 'Zakończone z innego powodu', 'Wycofane — brak towaru']) {
    await expect(queueFilter).toContainText(label);
  }
  await expect(queueFilter).not.toContainText('Istniejące nieaktywne');
  await expect(page.getByRole('button', { name: /Wycofane — brak towaru/ })).toBeVisible();
  await expect(page.getByLabel('Dostępność w sprzedaży')).toBeVisible();
  await expect(page.getByLabel('Stan magazynowy')).toBeVisible();
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

test('Centralny rejestr pokazuje tylko aktywne problemy i odświeża się bez skakania strony', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  let diagnosticsReads = 0;
  await page.route('**/api/store**', async (route) => {
    const action = new URL(route.request().url()).searchParams.get('action');
    if (action !== 'diagnostics-central') return route.fallback();
    diagnosticsReads += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        updatedAt: '2026-07-25T23:28:56.719Z',
        summary: { total: 2, open: 0, errors: 0, warnings: 0, occurrences: 0 },
        agent: { configured: true, model: 'gpt-5-mini', reasoning: 'medium' },
        items: [
          { id: 'diag-1', fingerprint: 'one', level: 'blad', message: 'Historyczny błąd zapisu', source: 'przeglądarka', route: '/#/admin/system/logi', release: 'r1', status: 'resolved', count: 1, firstSeenAt: '2026-07-25T22:00:00.000Z', lastSeenAt: '2026-07-25T22:00:00.000Z', resolvedAt: '2026-07-25T23:00:00.000Z' },
          { id: 'diag-2', fingerprint: 'two', level: 'blad', message: 'Historyczny błąd renderowania', source: 'autotest', route: '/#/admin/system/diagnostyka', release: 'r1', status: 'resolved', count: 1, firstSeenAt: '2026-07-25T22:05:00.000Z', lastSeenAt: '2026-07-25T22:05:00.000Z', resolvedAt: '2026-07-25T23:05:00.000Z' },
        ],
      }),
    });
  });
  await loginAdmin(page);
  await page.goto('/#/admin/system/logi');
  const workspace = page.locator('[data-system-central-workspace]');
  await expect(workspace).toBeVisible();
  await expect(workspace.getByText('Aktywne problemy').locator('..').locator('b')).toHaveText('0');
  await expect(workspace.getByText('Brak aktywnych problemów')).toBeVisible();
  await page.evaluate(() => { window.__centralWorkspaceBefore = document.querySelector('[data-system-central-workspace]'); });

  await workspace.getByRole('button', { name: /Odśwież/ }).click();
  await expect.poll(() => diagnosticsReads).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.__centralWorkspaceBefore === document.querySelector('[data-system-central-workspace]'))).toBe(true);
  await workspace.getByRole('button', { name: /Archiwum 2/ }).click();
  await expect(workspace.getByText('Historyczny błąd zapisu')).toBeVisible();
  await expect(workspace.getByText('Historyczny błąd renderowania')).toBeVisible();
  await page.waitForTimeout(800);
  expect(diagnosticsReads).toBeLessThanOrEqual(2);
  assertRuntime();
});

test('Centrum wysyłki udostępnia książkę adresową i wycenę InPost przed nadaniem', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  await page.goto('/#/admin/wysylki/inpost');
  await expect(page.getByRole('heading', { name: 'Wysyłka z InPost', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Utwórz przesyłkę InPost', exact: true })).toBeVisible();
  await expect(page.locator('#inpostServiceForm')).toBeVisible();
  await expect(page.locator('#inpostServiceForm').getByRole('button', { name: /Wybierz z książki/ })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Przelicz według umowy' })).toBeVisible();
  await expect(page.getByText('FV: Artway‑TM → nadawca.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Przy adresie odbiorcy' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Utwórz przesyłkę InPost/ })).toBeVisible();
  await page.evaluate(() => {
    inpostServiceStan.addressBook = [{
      id: 'IPA-E2E',
      label: 'Nadawca testowy',
      roles: ['sender'],
      firstName: 'Anna',
      lastName: 'Nowak',
      phone: '501002003',
      address: { street: 'Lipowa', building_number: '7', post_code: '84-207', city: 'Bojano' },
    }];
    renderuj();
  });
  const senderCard = page.locator('#inpost-party-sender');
  await senderCard.getByRole('button', { name: /Wybierz z książki/ }).click();
  const addressBook = page.locator('#inpostAddressBookModal');
  await expect(addressBook.getByRole('heading', { name: 'Wybierz nadawcę' })).toBeVisible();
  await expect(addressBook.getByRole('button', { name: 'Nadawcy' })).toBeVisible();
  await expect(addressBook.getByRole('button', { name: 'Odbiorcy' })).toBeVisible();
  await addressBook.getByPlaceholder(/Firma, osoba/).fill('Nadawca testowy');
  await expect(addressBook.getByRole('button', { name: /Nadawca testowy/ })).toBeVisible();
  await addressBook.getByRole('button', { name: /Nadawca testowy/ }).click();
  await expect(addressBook.locator('[data-inpost-book-preview]').getByText('Lipowa 7 84-207 Bojano')).toBeVisible();
  await addressBook.getByRole('button', { name: 'Użyj wybranego adresu' }).click();
  await expect(addressBook).toHaveCount(0);
  await expect(senderCard.getByLabel(/Miasto/)).toHaveValue('Bojano');
  await expect(senderCard.getByLabel('Ulica *', { exact: true })).toHaveValue('Lipowa');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#inpost-party-receiver').getByRole('button', { name: /Wybierz z książki/ }).click();
  const mobileBook = page.locator('#inpostAddressBookModal');
  await expect(mobileBook).toBeVisible();
  const mobileDimensions = await mobileBook.locator('.inpost-book-dialog').evaluate((element) => ({
    viewport: window.innerWidth,
    width: element.getBoundingClientRect().width,
    content: element.scrollWidth,
  }));
  expect(mobileDimensions.width).toBeLessThanOrEqual(mobileDimensions.viewport);
  expect(mobileDimensions.content).toBeLessThanOrEqual(mobileDimensions.width + 1);
  await mobileBook.getByRole('button', { name: 'Anuluj' }).click();
  const workspace = page.locator('.admin-workspace-content[data-admin-layout="unified-v2"]');
  const dimensions = await workspace.evaluate((element) => ({ width: element.clientWidth, content: element.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
  assertRuntime();
});

test('potwierdzenie klienta otwiera druk A4 z aktualną historią transportu', async ({ page }) => {
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  await page.goto('/#/admin/wysylki/inpost');
  await expect(page.getByRole('heading', { name: 'Wysyłka z InPost', exact: true })).toBeVisible();
  const popupPromise = page.waitForEvent('popup');
  await page.evaluate(() => {
    inpostServiceStan.items = [{
      id: 'IPS-TEST',
      reference: 'USL-TEST',
      createdAt: '2026-07-23T06:00:00.000Z',
      updatedAt: '2026-07-23T08:10:00.000Z',
      trackingUpdatedAt: '2026-07-23T08:10:00.000Z',
      status: 'label_ready',
      inpostStatus: 'ready_to_pickup',
      trackingNumber: '620000000000000000000001',
      sender: { companyName: 'Artway-TM', email: 'artwaytm@gmail.com', phone: '530038914', address: { street: 'Testowa', buildingNumber: '1', postCode: '84-207', city: 'Bojano' } },
      receiver: { firstName: 'Jan', lastName: 'Klient', email: 'jan@example.pl', phone: '500600700', address: { street: 'Odbiorcza', buildingNumber: '2', postCode: '80-001', city: 'Gdańsk' } },
      deliveryType: 'locker',
      targetPoint: 'GDA01N',
      parcel: { template: 'small', weight: 1 },
      billing: { mode: 'monthly' },
      trackingHistory: [
        { status: 'ready_to_pickup', label: 'Gotowa do odbioru', occurredAt: '2026-07-23T08:10:00.000Z' },
        { status: 'out_for_delivery', label: 'Wydana do doręczenia', occurredAt: '2026-07-23T06:15:00.000Z' },
      ],
    }];
    inpostServicePotwierdzenie('IPS-TEST');
  });
  const popup = await popupPromise;
  await expect(popup.getByRole('heading', { name: 'Potwierdzenie nadania przesyłki' })).toBeVisible();
  await expect(popup.getByText('Gotowa do odbioru', { exact: true })).toHaveCount(2);
  await expect(popup.getByRole('heading', { name: 'Historia transportu' })).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Drukuj / zapisz PDF' })).toBeVisible();
  await expect(popup.getByText('Dokument nie jest fakturą ani paragonem.')).toBeVisible();
  await popup.close();
  assertRuntime();
});

test('InPost Von Halsky ma osobny katalog sprzedaży i nie miesza się z nadawaniem paczek', async ({ page }) => {
  // Widok ładuje trzy rozdzielone moduły nawigacji, katalogu i ustawień.
  // Pełny scenariusz sprawdza je kolejno na desktopie i telefonie, dlatego
  // otrzymuje własny budżet bez osłabiania limitów pozostałych testów.
  test.setTimeout(120_000);
  const assertRuntime = observeRuntime(page);
  await loginAdmin(page);
  await page.goto('/#/admin/von-halsky');
  await expect(page.getByRole('heading', { name: 'InPost Von Halsky', exact: true })).toBeVisible();
  await expect(page.locator('.module-tabs-panel a[href="#/admin/von-halsky/wystawianie"]')).toBeVisible();
  await expect(page.locator('.module-tabs-panel a[href="#/admin/von-halsky/oferty"]')).toHaveCount(0);
  await expect(page.locator('.module-tabs-panel a[href="#/admin/von-halsky/powiazania"]')).toHaveCount(0);
  await expect(page.locator('.module-tabs-panel a[href="#/admin/von-halsky/zamowienia"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Najbliższe działania' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Onboarding kanału' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ostatnie operacje API' })).toHaveCount(0);
  await page.goto('/#/admin/von-halsky/wystawianie');
  await expect(page.getByRole('heading', { name: 'Przygotowanie i wystawianie produktów' })).toBeVisible();
  await expect(page.locator('[data-vh-channel-truth]')).toContainText('Stan potwierdzony bezpośrednio przez API');
  await expect(page.locator('[data-vh-channel-truth]')).toContainText('Oferty w API');
  await expect(page.locator('[data-vh-channel-truth]')).toContainText('W sprzedaży');
  await expect(page.locator('[data-vh-channel-truth]')).toContainText('Polecenia oczekujące');
  await expect(page.locator('.von-halsky-offer-flow')).toContainText('Dopasuj');
  await expect(page.locator('.von-halsky-offer-flow')).toContainText('Opublikuj');
  await expect(page.locator('.von-halsky-stage-filters')).toContainText('W sprzedaży');
  await expect(page.locator('.von-halsky-stage-filters')).toContainText('Do wystawienia');
  await expect(page.locator('.von-halsky-stage-filters')).toContainText('Do przygotowania');
  await expect(page.locator('.von-halsky-table')).toBeVisible();
  await expect(page.getByLabel('Etap sprzedaży')).toBeVisible();
  await expect(page.getByLabel('Jakość danych')).toBeVisible();
  await expect(page.getByLabel('Praca Agenta')).toBeVisible();
  await expect(page.getByLabel('Status kanału')).toBeVisible();
  await expect(page.getByLabel('Dostępność')).toBeVisible();
  await page.evaluate(() => { window.__vonHalskyFiltersNode = document.querySelector('[data-admin-search-id="von-halsky-products"]') || document.querySelector('.von-halsky-filter-grid')?.closest('section'); });
  await page.waitForTimeout(5_500);
  await expect.poll(() => page.evaluate(() => Boolean(window.__vonHalskyFiltersNode && window.__vonHalskyFiltersNode.isConnected))).toBe(true);
  await expect(page.locator('.von-halsky-publication-bar')).toContainText('Agent przygotowuje • administrator publikuje');
  await page.locator('.von-halsky-table tbody input[type="checkbox"]').first().check();
  await expect(page.locator('.von-halsky-publication-count strong')).toHaveText('1');
  await expect(page.getByRole('button', { name: /Przygotuj Agentem/ })).toBeVisible();
  const matchingButton = page.getByRole('button', { name: 'Popraw dopasowanie' }).first();
  await matchingButton.click();
  await expect(page.getByRole('heading', { name: 'Popraw dopasowanie produktu' })).toBeVisible();
  await expect(page.locator('.von-halsky-matching-editor input[name="ean"]')).toBeVisible();
  await expect(page.getByText('Nie można ręcznie wkleić obcego ID oferty.')).toBeVisible();
  await page.locator('.von-halsky-matching-editor [data-close]').first().click();
  const previewButton = page.getByRole('button', { name: 'Podgląd', exact: true }).first();
  await expect(previewButton).toBeVisible();
  await previewButton.click();
  await expect(page.locator('.von-halsky-product-preview')).toBeVisible();
  await expect(page.getByText(/Źródło treści:/)).toBeVisible();
  await page.locator('.von-halsky-product-preview [data-close]').first().click();
  await page.goto('/#/admin/von-halsky/ustawienia');
  await expect(page.getByRole('heading', { name: 'Połączenie InPost Von Halsky' })).toBeVisible();
  await expect(page.locator('.von-halsky-settings').getByText('Bezpośrednie API', { exact: true })).toBeVisible();
  await expect(page.locator('.von-halsky-api-readiness article')).toHaveCount(4);
  await expect(page.locator('.von-halsky-settings-layout')).toBeVisible();
  await expect(page.locator('.von-halsky-settings-index')).toContainText('Polityka danych');
  await expect(page.locator('.von-halsky-settings-index button')).toHaveCount(7);
  await expect(page.locator('.von-halsky-settings-index button.active')).toHaveText('Tożsamość');
  await page.locator('.von-halsky-settings-index button', { hasText: 'Agent' }).click();
  await expect(page.locator('.von-halsky-settings-index button.active')).toHaveText('Agent');
  await expect(page.locator('#von-halsky-settings-agent')).toBeInViewport();
  await page.locator('.von-halsky-settings-index button', { hasText: 'Diagnostyka' }).click();
  await expect(page.locator('.von-halsky-settings-index button.active')).toHaveText('Diagnostyka');
  await expect(page.locator('#von-halsky-settings-diagnostics')).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'Agent przygotowania ofert' })).toBeVisible();
  await expect(page.getByLabel('Minimalna pewność kategorii')).toHaveValue('82');
  await expect(page.getByRole('heading', { name: 'Źródła i priorytety danych' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ostatnie operacje API' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Decyzja ręczna' })).toBeVisible();
  await expect(page.locator('[name="testOfferCode"]')).toHaveCount(0);
  await expect(page.getByText('brak automatycznego tworzenia nowych ofert', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('#artwayAdminStyle-vonHalsky').evaluate((link) => Boolean(link.sheet))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/admin/von-halsky/wystawianie');
  const mobile = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(mobile.content).toBeLessThanOrEqual(mobile.viewport + 1);
  assertRuntime();
});

test('panel ponawia modułowy CSS i nie pokazuje podstrony bez zastosowanych stylów', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('/#/admin/von-halsky');
  const header = page.locator('.von-halsky-workspace-head');
  await expect(header).toBeVisible();
  await page.locator('#artwayAdminStyle-vonHalsky').evaluate((link) => link.remove());
  await page.goto('/#/admin/pulpit');
  await page.goto('/#/admin/von-halsky');
  await expect(page.locator('#artwayAdminStyle-vonHalsky')).toHaveCount(1);
  await expect.poll(() => page.locator('#artwayAdminStyle-vonHalsky').evaluate((link) => Boolean(link.sheet))).toBe(true);
  // Wspólna warstwa panelu może świadomie zmienić nagłówek na flex,
  // dlatego obecność stylu modułu potwierdzamy na jego własnej siatce KPI.
  await expect(page.locator('.von-halsky-stat-grid')).toHaveCSS('display', 'grid');
  await expect(page.locator('#artwayAdminStyle-vonHalsky')).toHaveAttribute('data-loading', 'false');
});

test('wspólny układ panelu pozostaje czytelny w aplikacji mobilnej', async ({ page }) => {
  test.setTimeout(90_000);
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
