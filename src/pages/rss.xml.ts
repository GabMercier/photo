/**
 * RSS Feed
 *
 * Generates an RSS feed of all published posts.
 * Available at /rss.xml
 */
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', ({ data }) => {
    // Filter out drafts and private posts
    return !data.draft && !data.private;
  });

  // Sort by date descending
  const sortedPosts = posts.sort((a, b) =>
    new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
  );

  return rss({
    title: 'Gabriel Mercier Photography',
    description: 'Latest photography work by Gabriel Mercier',
    site: context.site || 'https://gmbpho.to',
    items: sortedPosts.map(post => {
      const slug = post.slug || post.id.replace(/\.md$/, '');
      return {
        title: post.data.title?.en || post.data.title?.fr || 'Untitled',
        pubDate: post.data.date,
        description: post.data.description?.en || post.data.description?.fr || '',
        link: `/posts/${slug}/`,
        // Include cover image as enclosure
        enclosure: post.data.coverImage?.src ? {
          url: new URL(post.data.coverImage.src, context.site || 'https://gmbpho.to').href,
          type: 'image/jpeg',
          length: 0, // Unknown file size
        } : undefined,
      };
    }),
    // Add custom XML namespaces for media
    customData: `<language>en-ca</language>`,
  });
}
