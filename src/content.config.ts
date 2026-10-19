// The schema of the blog collection (SPEC-DATA §3.2).
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({
    base: './src/content/blog',
    pattern: '**/*.md',
    // The id of the entry is the name of the file (the `post_name` of the
    // WordPress), so that the URL of the post is its slug (R4).
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    hero: z.string(),
    heroAlt: z.string(),
    category: z.string(),
    categoryName: z.string(),
    tags: z.array(z.string()).default([]),
    seoTitle: z.string(),
    seoDescription: z.string(),
    // REV-18 (E13): o `focusKeyword` foi removido — nunca era renderizado
    // (e uma `<meta name="keywords">` é ignorada por todos os motores).
    author: z.string().default('Ana Paula Galastri'),
    authorSlug: z.string().default('ana-paula-galastri'),
    readingTime: z.number().int().positive(),
    comments: z
      .array(
        z.object({
          id: z.number().int(),
          author: z.string(),
          date: z.coerce.date(),
          body: z.string(),
        }),
      )
      .default([]),
  }),
});

export const collections = { blog };
