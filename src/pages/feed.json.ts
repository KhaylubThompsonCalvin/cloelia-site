import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

export async function GET(context: APIContext) {
  const site = String(context.site);
  const [investigations, corrections] = await Promise.all([getCollection('investigations'), getCollection('corrections')]);
  const items = [
    ...investigations.map((i) => ({ id: `${site}investigations/${i.data.id}/`, url: `${site}investigations/${i.data.id}/`, title: `Investigation ${i.data.id}: ${i.data.question}`, date_published: `${i.data.dates.verified}T00:00:00Z`, content_text: `Level ${i.data.level}; ${i.data.status}.` })),
    ...corrections.map((c) => ({ id: `${site}${c.data.target.replace(/^\//, '')}#${c.data.date}`, url: `${site}${c.data.target.replace(/^\//, '')}`, title: c.data.what, date_published: `${c.data.date}T00:00:00Z`, content_text: c.data.why })),
  ].sort((a, b) => b.date_published.localeCompare(a.date_published));
  const feed = { version: 'https://jsonfeed.org/version/1.1', title: 'CLOELIA.AI', home_page_url: site, feed_url: `${site}feed.json`, description: 'New investigations, new Records, and corrections.', items };
  return new Response(JSON.stringify(feed, null, 2), { headers: { 'Content-Type': 'application/feed+json; charset=utf-8' } });
}
