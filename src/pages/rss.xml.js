import rss from '@astrojs/rss';
import site from '../data/site.json';

export async function GET(context) {
  const posts = await import.meta.glob('../content/news/*.md', { eager: true });

  const items = Object.values(posts)
    .map((post) => {
      const fm = post.frontmatter;
      const slug = post.file.split('/').pop()?.replace('.md', '');
      const url = `${context.site}/news/${slug}`;
      return {
        title: fm.titleCN || fm.title,
        description: fm.excerpt || '',
        link: url,
        pubDate: new Date(fm.date),
        author: fm.author || site.name,
      };
    })
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: `${site.name} News`,
    description: site.descriptionCN,
    site: context.site,
    items,
    customData: `<language>zh-CN</language>`,
  });
}
