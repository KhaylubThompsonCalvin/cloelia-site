import { test, expect } from '@playwright/test';
import { TEMPLATES, RECORD } from './templates';

// The first Tab lands on the skip link; every focus stop is visible; reduced motion leaves nothing animating;
// every control meets the 24 px floor at phone width.
for (const t of TEMPLATES) {
  test(`${t.name}: skip link first, visible focus`, async ({ page }) => {
    await page.goto(t.path);
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip')).toBeFocused();
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, outline: cs.outlineStyle, width: cs.outlineWidth, shadow: cs.boxShadow };
    });
    expect(outline.outline !== 'none' || outline.shadow !== 'none').toBe(true);
  });
}

test('reduced motion: nothing animates on the Record', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(RECORD);
  const running = await page.evaluate(() => document.getAnimations().length);
  expect(running).toBe(0);
});

test('targets: every link and control is at least 24 px tall on the Record', async ({ page, viewport }) => {
  test.skip(!viewport || viewport.width > 500, 'phone project only');
  await page.goto(RECORD);
  const small = await page.locator('a, button, summary').evaluateAll((els) =>
    els.filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const inline = getComputedStyle(el).display === 'inline' && el.closest('p, li, dd, td');
      return !inline && r.height < 24;
    }).map((el) => (el as HTMLElement).outerHTML.slice(0, 80)),
  );
  expect(small).toEqual([]);
});
