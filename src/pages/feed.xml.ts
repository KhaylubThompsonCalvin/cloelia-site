import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

export async function GET(context: APIContext) {
  const [investigations, corrections] = await Promise.all([getCollection('investigations'), getCollection('corrections')]);
  const items = [
    ...investigations.map((i) => ({
      title: `Investigation ${i.data.id}: ${i.data.question}`,
      pubDate: new Date(i.data.dates.verified),
      link: `/investigations/${i.data.id}/`,
      description: `Level ${i.data.level}; ${i.data.status}.`,
    })),
    ...corrections.map((c) => ({ title: c.data.what, pubDate: new Date(c.data.date), link: c.data.target, description: c.data.why })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  return rss({
    title: 'CLOELIA.AI',
    description: 'New investigations, new Records, and corrections.',
    site: context.site!,
    items,
  });
}
