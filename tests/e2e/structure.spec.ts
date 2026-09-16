import { test, expect } from '@playwright/test';
import { TEMPLATES, RECORD } from './templates';

for (const t of TEMPLATES) {
  test(`${t.name} renders with the shared structure`, async ({ page }) => {
    const res = await page.goto(t.path);
    expect(res?.status()).toBe(t.name === '404' ? 404 : 200);
    await expect(page.locator('a.skip')).toHaveAttribute('href', '#main');
    await expect(page.locator('header .brand')).toContainText('CLOELIA.AI');
    const nav = page.locator('nav.site-nav a');
    await expect(nav).toHaveText(['Freedoms', 'Places', 'Investigations', 'Questions', 'About']);
    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
    await expect(page.locator('footer a[href="/about/"]')).toBeVisible();
  });
}

test('the Record keeps the fixed order and the scan block', async ({ page }) => {
  await page.goto(RECORD);
  const scan = page.locator('[data-test="scan"]');
  await expect(scan.locator('[data-test="scan-dimension"]')).toHaveText('Owning a home');
  await expect(scan.locator('h1')).toContainText('Fixture State, 1900 to 1910');
  await expect(scan.locator('[data-test="scan-population"]')).toContainText('Covers all households');
  await expect(scan.locator('[data-test="scan-change"] .chip')).toHaveText('Measured');
  await expect(scan.locator('[data-test="scan-unknown"]')).toContainText('Still unknown');
  const ids = await page.locator('main > section[id]').evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(['changed', 'happened', 'followed', 'concluded', 'unknown', 'verify', 'related']);
  const headings = await page.locator('main > section > h2').allTextContents();
  expect(headings.map((h) => h.trim())).toEqual(['1. What changed', '2. What happened', '3. What followed', '4. What can be concluded', '5. What is still unknown', '6. Verify', '7. Related Records']);
});

test('every finding shows its grade first, every development its source and population, every measure its dataset and investigation', async ({ page }) => {
  await page.goto(RECORD);
  const findings = page.locator('li.finding');
  expect(await findings.count()).toBeGreaterThan(0);
  for (const f of await findings.all()) {
    const first = f.locator(':scope > *').first();
    await expect(first).toHaveClass(/chip/);
    await expect(first).toHaveClass(/grade/);
    await expect(f).toContainText('Limitations:');
  }
  const devs = page.locator('ol.chronicle > li');
  expect(await devs.count()).toBe(3);
  for (const d of await devs.all()) {
    await expect(d).toContainText('Applies to:');
    await expect(d.locator('a[href^="/sources/"]')).toHaveCount(1);
  }
  const measure = page.locator('section.measure');
  await expect(measure.locator('a[href^="/datasets/"]')).toHaveCount(1);
  await expect(measure.locator('a[href^="/investigations/"]')).toHaveCount(1);
  await expect(measure.locator('details.data-table table')).toHaveCount(1);
  await expect(measure.locator('details.data-table')).toContainText('no value');
  await expect(measure.locator('figure img')).toHaveAttribute('alt', /.{20,}/);
});

test('verify layer: source and dataset pages reachable from the Record in one click', async ({ page }) => {
  await page.goto(RECORD);
  await page.locator('ol.chronicle a[href^="/sources/"]').first().click();
  await expect(page).toHaveURL(/\/sources\//);
  await expect(page.locator('h1')).toBeVisible();
  await page.goBack();
  await page.locator('section.measure a[href^="/datasets/"]').first().click();
  await expect(page).toHaveURL(/\/datasets\//);
  await expect(page.locator('dl.facts')).toContainText('SHA-256');
});

test('feeds, sitemap, and robots exist and are well formed', async ({ request }) => {
  const rss = await request.get('/feed.xml');
  expect(rss.status()).toBe(200);
  expect(await rss.text()).toContain('<rss');
  const json = await request.get('/feed.json');
  expect(json.status()).toBe(200);
  const body = await json.json();
  expect(body.version).toBe('https://jsonfeed.org/version/1.1');
  expect(Array.isArray(body.items)).toBe(true);
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  const sitemap = await request.get('/sitemap-index.xml');
  if (robotsText.includes('Disallow: /')) {
    // Preview build: nothing indexable, so no sitemap is emitted and none is advertised.
    expect(robotsText).not.toContain('Sitemap:');
    expect(sitemap.status()).toBe(404);
  } else {
    expect(robotsText).toContain('Sitemap:');
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain('<sitemapindex');
  }
});

test('security headers from the Blueprint are served', async ({ request }) => {
  const res = await request.get(RECORD);
  const h = res.headers();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['content-security-policy-report-only']).toContain("script-src 'self'");
  expect(h['strict-transport-security']).toContain('max-age=');
});
