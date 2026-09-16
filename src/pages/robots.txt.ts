import type { APIContext } from 'astro';

// Preview builds disallow everything; production allows everything and points at the sitemap.
export function GET(context: APIContext) {
  const isPreview = import.meta.env.PUBLIC_SITE_ENV === 'preview';
  const body = isPreview
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nSitemap: ${context.site}sitemap-index.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
