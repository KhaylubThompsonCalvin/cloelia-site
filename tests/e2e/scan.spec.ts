import { test, expect } from '@playwright/test';
import { RECORD } from './templates';

// The Phase 4 scan test (owner amendment, 2026-09-16). At desktop and phone width, before scrolling and
// without reading a paragraph, a visitor can answer: what freedom, what place, what period, who it covers,
// the main measured result, how strong the evidence is, and what to click next.

const inFirstScreen = async (page: import('@playwright/test').Page, selector: string, screens = 1) => {
  const box = await page.locator(selector).first().boundingBox();
  const h = page.viewportSize()!.height;
  expect(box, selector + ' is rendered').not.toBeNull();
  expect(box!.y + Math.min(box!.height, 24), selector + ' starts within ' + screens + ' screen(s)').toBeLessThanOrEqual(h * screens);
};

test('the Record answers the seven scan questions in the first screen', async ({ page, viewport }) => {
  await page.goto(RECORD);
  const phone = (viewport?.width ?? 1440) <= 500;
  await inFirstScreen(page, '[data-test="scan-dimension"]');      // 1 what freedom
  await inFirstScreen(page, '[data-test="scan-place-period"]');   // 2 what place, 3 what period
  await inFirstScreen(page, '[data-test="scan-population"]');     // 4 who it covers
  await inFirstScreen(page, '[data-test="scan-change"]');         // 5 the main measured result
  await inFirstScreen(page, '.scan .badge.grade');                // 6 how strong the evidence is
  await inFirstScreen(page, 'nav.rail a', phone ? 1.25 : 1);      // 7 what to click next (the rail may start just past the phone fold; it then sticks)
  // the identity is typography, not prose: the largest text on the page is the place name
  const sizes = await page.evaluate(() => {
    const px = (el: Element | null) => (el ? parseFloat(getComputedStyle(el).fontSize) : 0);
    return { h1: px(document.querySelector('.scan h1')), dim: px(document.querySelector('.scan .dimension')), change: px(document.querySelector('.scan .change')), body: px(document.body) };
  });
  expect(sizes.h1).toBeGreaterThan(sizes.change);
  expect(sizes.change).toBeGreaterThanOrEqual(sizes.body);
  expect(sizes.dim).toBeGreaterThanOrEqual(14);
});

test('the Record is not a text wall: short prose before the rail, secondary material behind disclosures', async ({ page }) => {
  await page.goto(RECORD);
  const words = await page.evaluate(() => {
    const rail = document.querySelector('nav.rail')!;
    let n = 0;
    for (const el of Array.from(document.querySelectorAll('main p, main dd, main h1, main h2, main figcaption'))) {
      if (el.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING) n += (el.textContent || '').trim().split(/\s+/).filter(Boolean).length;
    }
    return n;
  });
  expect(words, 'words before the action rail').toBeLessThanOrEqual(140);
  const longVisible = await page.locator('main p:visible').evaluateAll((els) => els.map((e) => (e.textContent || '').trim()).filter((t) => t.length > 320));
  expect(longVisible, 'no visible paragraph over 320 characters').toEqual([]);
  expect(await page.locator('main details').count()).toBeGreaterThanOrEqual(3);
  for (const d of await page.locator('main details').all()) expect(await d.getAttribute('open')).toBeNull();
});

test('every control on the home page and the Record goes somewhere real', async ({ page, request }) => {
  for (const path of ['/', RECORD]) {
    await page.goto(path);
    const hrefs = await page.locator('main a[href], header a[href], footer a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs) {
      if (href.startsWith('#')) {
        expect(await page.locator(href).count(), `${path}: anchor ${href} resolves`).toBe(1);
      } else if (href.startsWith('/')) {
        const res = await request.get(href);
        expect(res.status(), `${path}: link ${href}`).toBe(200);
      }
    }
    expect(await page.locator('button, [role="button"]').count(), 'no buttons without a function').toBe(0);
  }
});

test('the home page lets a visitor act in the first screen', async ({ page }) => {
  await page.goto('/');
  await inFirstScreen(page, 'h1');
  const btns = page.locator('.hero .btn');
  await expect(btns).toHaveText(['Explore freedoms', 'Explore places', /Browse questions/]);
  for (const b of await btns.all()) await inFirstScreen(page, `.hero .btn:text-is("${(await b.textContent())!.trim()}")`);
  await expect(page.locator('.featured .badge.grade')).toHaveCount(1);
  expect(await page.locator('.cards .tile').count()).toBeGreaterThanOrEqual(6);
});
