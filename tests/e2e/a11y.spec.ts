import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TEMPLATES } from './templates';

// axe at every impact on every template, in both palettes (the Khaylub.com V2 Phase 16 pattern).
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const t of TEMPLATES) {
      test(`${t.name} has no axe violations`, async ({ page }) => {
        await page.goto(t.path);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
        expect(results.violations, JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
      });
    }
  });
}
