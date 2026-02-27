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
    // Profile image (displayed as circular) - optional
    profileImage: z.object({
      src: z.string(),
      alt: z.object({
        en: z.string().optional().default(''),
        fr: z.string().optional().default(''),
      }).optional(),
    }).optional(),
    // Optional subtitle/tagline
    tagline: z.object({
      en: z.string().optional().default(''),
      fr: z.string().optional().default(''),
    }).optional(),
    // Contact/social links (optional)
    contact: z.object({
      email: z.string().optional(),
      instagram: z.string().optional(),
      twitter: z.string().optional(),
    }).optional(),
    // Bio content (optional, bilingual)
    bio: z.object({
      en: z.string().optional().default(''),
      fr: z.string().optional().default(''),
    }).optional(),
  }),
});

const posts = defineCollection({
  type: 'content', // Markdown/MDX files with frontmatter
  schema: z.object({
    // --- CMS identifier (auto-generated UUID, not displayed) ---
    id: z.string().optional(),

    // --- Bilingual metadata ---
    // Title is optional - if not provided, post displays without title
    // Slug is derived from filename, not title
    title: z.object({
      en: z.string().optional().default(''),
      fr: z.string().optional().default(''),
    }).nullable().optional().transform(val => val ?? { en: '', fr: '' }),
    description: z.object({
      en: z.string().optional().default(''),
      fr: z.string().optional().default(''),
    }).nullable().optional().transform(val => val ?? { en: '', fr: '' }),

    // --- Dates & status ---
    date: z.coerce.date().nullable().optional().transform(val => val ?? new Date()),
    updatedDate: z.coerce.date().nullable().optional(),
    draft: z.boolean().nullable().optional().transform(val => val ?? false),
    private: z.boolean().nullable().optional().transform(val => val ?? false), // Protected content (Cloudflare Access)

    // --- Images ---
    // Cover image displayed in feed cards and as hero
    coverImage: z.object({
      src: z.string(),
      alt: z.object({
        en: z.string().optional().default(''),
        fr: z.string().optional().default(''),
      }).nullable().optional().transform(val => val ?? { en: '', fr: '' }),
      // Horizontal crop position for landscape images in portrait containers (mobile, gallery)
      // Only applies when image needs horizontal cropping
      focalPoint: z.enum(['left', 'center', 'right']).nullable().optional().default('center'),
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
          en: z.string().optional().default(''),
          fr: z.string().optional().default(''),
        }).nullable().optional().transform(val => val ?? { en: '', fr: '' }),
        // Optional EXIF-style metadata (for future use)
        camera: z.string().nullable().optional(),
        lens: z.string().nullable().optional(),
        settings: z.string().nullable().optional(),
      })
    ).nullable().optional(),

    // --- Classification ---
    // Style tags for filtering (e.g., "street", "macro", "astrophotography")
    tags: z.array(z.string()).nullable().optional().transform(val => val ?? []),
    // Post format
    postType: z.enum(['single', 'series']).nullable().optional().transform(val => val ?? 'single'),
    // Gallery display size (controls masonry grid spanning)
    // auto: uses aspect ratio detection
    // small: 1×1 cell
    // portrait: 1 col × 2 rows
    // portrait-tall: 1 col × 3 rows (extra tall)
    // landscape: 2 cols × 1 row
    // featured: 2 cols × 2 rows (big prominent image)
    gallerySize: z.enum(['auto', 'small', 'portrait', 'portrait-tall', 'landscape', 'featured']).nullable().optional().transform(val => val ?? 'auto'),
    // Featured on homepage
    featured: z.boolean().nullable().optional().transform(val => val ?? false),
    // Homepage carousel selection
    homepageCarousel: z.boolean().nullable().optional().transform(val => val ?? false),
    homepageDefault: z.boolean().nullable().optional().transform(val => val ?? false),
  }),
});

export const collections = {
  posts,
  about,
};
