import { test, expect } from '@playwright/test';

const install = 'zcc marketplace install orgo-machines-6758@zana-community';

test('search, empty state, category, sort and URL state work under the Pages prefix', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Make Zana yours' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search plugins' }).fill('orgo');
  await expect(page.locator('#results .card')).toHaveCount(1);
  await expect(page.locator('#results .card')).toBeVisible();
  await expect(page).toHaveURL(/q=orgo/);
  await page.getByRole('searchbox').fill('no-such-plugin');
  await expect(page.getByText('No plugin matches your search.')).toBeVisible();
  await page.getByRole('link', { name: 'Clear filters' }).click();
  await page.getByRole('combobox', { name: 'Category' }).selectOption('remote-machines');
  await page.getByRole('button', { name: 'A–Z' }).click();
  await expect(page).toHaveURL(/category=remote-machines&sort=name/);
  await page.reload();
  await expect(page.getByRole('combobox')).toHaveValue('remote-machines');
  await expect(page.getByRole('button', { name: 'A–Z' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#results .card')).toBeVisible();
  expect(errors).toEqual([]);
});

test('plugin details, source, install command and publish guide stay on public destinations', async ({ page }) => {
  await page.goto('./');
  await page.locator('#sections .card').click();
  await expect(page).toHaveURL(/\/zana-marketplace\/orgo-machines-6758\/$/);
  await expect(page.getByRole('heading', { name: 'Orgo Machines', exact: true })).toBeVisible();
  await expect(page.locator('.install code')).toContainText(install);
  await expect(page.getByRole('link', { name: 'View source' })).toHaveAttribute('href', 'https://github.com/grebmann1/zana-orgo-machines');
  await page.getByRole('link', { name: 'Publish a plugin', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Publish a community plugin' })).toBeVisible();
  const url = new URL(await page.getByRole('link', { name: 'Create entry on GitHub' }).getAttribute('href'));
  expect(url.origin + url.pathname).toBe('https://github.com/salesforce/zana-marketplace/new/main/entries');
  expect(JSON.parse(url.searchParams.get('value')).id).toBe('my-plugin');
  expect(await page.locator('body').innerText()).not.toMatch(/git\.soma|VPN|Salesforce-internal/);
});

test('copy succeeds and reports clipboard denial without a page error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copiedText = text; } } });
  });
  await page.goto('./orgo-machines-6758/');
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Copied to clipboard.');
  expect(await page.evaluate(() => window.copiedText)).toBe(install);
  await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeEnabled();
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Permission denied'); }; });
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Could not copy.');
  await expect(page.getByRole('button', { name: 'Copy failed', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('all pages fit narrow screens and light/dark themes', async ({ page, isMobile }, testInfo) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 780 });
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    for (const path of ['./', './orgo-machines-6758/', './publish/']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', /assets\/site\.css$/);
      if (path === './') await page.screenshot({ path: testInfo.outputPath(`catalog-${colorScheme}.png`), fullPage: true });
    }
  }
});

test('the catalog remains browsable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4180/zana-marketplace/');
  await page.locator('#sections .card').click();
  await expect(page.locator('.install code')).toContainText(install);
  await context.close();
});

test('keyboard shortcut focuses search', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch browser does not use desktop keyboard shortcuts.');
  await page.goto('./');
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.keyboard.type('ssh');
  await expect(page.locator('#results .card')).toBeVisible();
});
