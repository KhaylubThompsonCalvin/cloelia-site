// Screenshots of the home page and the Record at desktop and phone width, light and dark, for the
// owner gate packet. Usage: node scripts/shots.mjs <outDir>. Needs the site served on :4321.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'shots';
mkdirSync(out, { recursive: true });
const base = process.env.SHOTS_BASE || 'http://localhost:4321';
const pages = [
  ['home', '/'],
  ['record', '/records/owning-a-home/fixture-state/'],
];
const views = [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
];
const browser = await chromium.launch();
for (const [vname, viewport] of views) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const [pname, path] of pages) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.screenshot({ path: join(out, `${pname}-${vname}-${scheme}-fold.png`) });
      if (scheme === 'light') await page.screenshot({ path: join(out, `${pname}-${vname}-full.png`), fullPage: true });
    }
    await ctx.close();
  }
}
await browser.close();
console.log('shots written to ' + out);
