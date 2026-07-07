import { defineCollection, z } from 'astro:content';

const newsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    titleCN: z.string().optional(),
    date: z.date(),
    author: z.string().optional(),
    image: z.string().optional(),
    excerpt: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
  }),
});

export const collections = {
  news: newsCollection,
};
