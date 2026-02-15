/**
 * Content Collections Configuration
 * 
 * Single unified "posts" collection — every photo entry (single, series, etc.)
 * lives here. The gallery/feed/portfolio are just different VIEWS of the same data,
 * filtered by tags, date, or featured status.
 * 
 * Think of it like one Dataverse table with different views.
 */

import { defineCollection, z } from 'astro:content';

/**
 * About Collection
 *
 * Simple content type for the about page.
 * Profile image + bilingual bio content in markdown body.
 */
const about = defineCollection({
  type: 'content',
  schema: z.object({
    // Profile image (displayed as circular)
    profileImage: z.object({
      src: z.string(),
      alt: z.object({
        en: z.string(),
        fr: z.string(),
      }),
    }),
    // Optional subtitle/tagline
    tagline: z.object({
      en: z.string(),
      fr: z.string(),
    }).optional(),
    // Contact/social links (optional)
    contact: z.object({
      email: z.string().optional(),
      instagram: z.string().optional(),
      twitter: z.string().optional(),
    }).optional(),
  }),
});

const posts = defineCollection({
  type: 'content', // Markdown/MDX files with frontmatter
  schema: z.object({
    // --- Bilingual metadata ---
    title: z.object({
      en: z.string(),
      fr: z.string(),
    }),
    description: z.object({
      en: z.string().optional(),
      fr: z.string().optional(),
    }).optional(),

    // --- Dates & status ---
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    private: z.boolean().default(false), // Protected content (Cloudflare Access)

    // --- Images ---
    // Cover image displayed in feed cards and as hero
    coverImage: z.object({
      src: z.string(),
      alt: z.object({
        en: z.string(),
        fr: z.string(),
      }),
    }),
    // Ambient glow color (YouTube-style effect)
    // Extracted from image or manually specified
    glowColor: z.object({
      r: z.number().min(0).max(255),
      g: z.number().min(0).max(255),
      b: z.number().min(0).max(255),
      hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    }).optional(),
    // Additional images for series posts
    images: z.array(
      z.object({
        src: z.string(),
        alt: z.object({
          en: z.string(),
          fr: z.string(),
        }),
        // Optional EXIF-style metadata (for future use)
        camera: z.string().optional(),
        lens: z.string().optional(),
        settings: z.string().optional(),
      })
    ).optional(),

    // --- Classification ---
    // Style tags for filtering (e.g., "street", "macro", "astrophotography")
    tags: z.array(z.string()).default([]),
    // Post format
    postType: z.enum(['single', 'series']).default('single'),
    // Featured on homepage
    featured: z.boolean().default(false),
    // Homepage carousel selection
    homepageCarousel: z.boolean().default(false),
    homepageDefault: z.boolean().default(false),
  }),
});

export const collections = {
  posts,
  about,
};
