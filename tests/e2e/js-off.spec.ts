import { test, expect } from '@playwright/test';
import { TEMPLATES, RECORD } from './templates';

// A Record must be fully readable with JavaScript disabled: the static reading path is the product.
test.use({ javaScriptEnabled: false });

for (const t of TEMPLATES) {
  test(`${t.name} reads without JavaScript`, async ({ page }) => {
    await page.goto(t.path);
    await expect(page.locator('main#main h1')).toBeVisible();
    expect(await page.locator('script[src]').count()).toBe(0);
  });
}

test('the Record chart, table, findings, and questions are all present without JavaScript', async ({ page }) => {
  await page.goto(RECORD);
  await expect(page.locator('section#changed figure img')).toBeVisible();
  await expect(page.locator('details.data-table table')).toHaveCount(1);
  expect(await page.locator('li.finding').count()).toBeGreaterThan(0);
  expect(await page.locator('ul.qlist li').count()).toBeGreaterThan(0);
});
