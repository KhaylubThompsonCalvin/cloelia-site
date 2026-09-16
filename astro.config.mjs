// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const isPreview = process.env.PUBLIC_SITE_ENV === 'preview';

export default defineConfig({
  site: 'https://cloelia.ai',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // One external stylesheet keeps the Content Security Policy strict (no inline styles).
    inlineStylesheets: 'never',
  },
  integrations: [
    sitemap({
      // Preview builds never emit a sitemap that could be indexed by mistake.
      filter: (page) => !isPreview && !page.includes('/404'),
    }),
  ],
  vite: {
    build: { cssCodeSplit: false, assetsInlineLimit: 0 },
  },
});
