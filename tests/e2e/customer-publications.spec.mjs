import { expect, test } from '@playwright/test';

test('@public powitanie pojawia się tylko z podpisanego linku i zapisuje odpowiedź', async ({ page }) => {
  const events = [];
  await page.route('**/api/store**', async (route) => {
    const action = new URL(route.request().url()).searchParams.get('action');
    if (action === 'customer-publication-entry') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, entryId: 'entry-e2e', publication: { id: 'e2e', eyebrow: 'Witamy w Artway-TM', title: 'Dzień dobry! Miło Cię widzieć', message: 'Trafiasz do nas z polecenia.', active: true, actions: [{ id: 'zakupy', label: 'Idę na zakupy', target: '#/', style: 'primary' }, { id: 'promocje', label: 'Zobaczę promocje', target: '#/promocje', style: 'secondary' }, { id: 'nowosci', label: 'Sprawdzę nowości', target: '#/nowosci', style: 'soft' }, { id: 'mily-dzien', label: 'Miłego dnia', target: '', style: 'soft' }] } }) });
      return;
    }
    if (action === 'customer-publication-event') {
      events.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, accepted: true, changed: true }) });
      return;
    }
    await route.fallback();
  });

  await page.goto('/?awref=podpisany-token#/promocje');
  const dialog = page.getByRole('dialog', { name: 'Dzień dobry! Miło Cię widzieć' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button')).toHaveCount(5);
  await dialog.getByRole('button', { name: 'Miłego dnia' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => events.map((event) => event.event)).toEqual(['landing', 'confirmed']);
  expect(events[1].responseId).toBe('mily-dzien');
  await page.reload();
  await expect(page.locator('#customerPublicationLayer')).toHaveCount(0);
});

test('administrator widzi wspólne publikacje, podgląd klienta i raport poleceń', async ({ page }) => {
  await page.route('**/api/store**', async (route) => {
    const action = new URL(route.request().url()).searchParams.get('action');
    if (action === 'customer-publication-report') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, report: { updatedAt: null, items: [] } }) });
      return;
    }
    await route.fallback();
  });
  await page.goto('/#/logowanie');
  await page.locator('#loginForm [name="email"]').fill('admin');
  await page.locator('#loginForm [name="haslo"]').fill('admin');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page).toHaveURL(/#\/admin(?:\/|$)/, { timeout: 20_000 });
  await page.goto('/#/admin/personalizacja/publikacje');
  await expect(page.getByRole('heading', { name: 'Publikacje i linki promocyjne' })).toBeVisible();
  await expect(page.getByText('Widok administratora').first()).toBeVisible();
  await expect(page.getByText('Widok klienta').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Potwierdzone udostępnienia' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});
