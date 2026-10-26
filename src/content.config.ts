/**
 * Content Collections Configuration
 * 
 * Single unified "posts" collection — every photo entry (single, series, etc.)
 * lives here. The gallery/feed/portfolio are just different VIEWS of the same data,
 * filtered by tags, date, or featured status.
 * 
 * Think of it like one Dataverse table with different views.
 */

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// ---------------------------------------------------------------------------
// Shared field helpers
// ---------------------------------------------------------------------------

/** Bilingual text: { en, fr }, missing sides default to '' */
const bilingual = () => z.object({
  en: z.string().optional().default(''),
  fr: z.string().optional().default(''),
}).nullable().optional().transform(val => val ?? { en: '', fr: '' });

/** Empty strings and nulls from the CMS become undefined */
const optionalText = () => z.string().nullable().optional()
  .transform(val => (val === null || val === undefined || val.trim() === '' ? undefined : val.trim()));

/** Optional coordinate; '' / null from the CMS become undefined */
const coordinate = (limit: number) => z.preprocess(
  val => (val === '' || val === null ? undefined : val),
  z.coerce.number().min(-limit).max(limit).optional()
);

/**
 * Location — where a photo or a project was made.
 *
 * Mirrors the IPTC location fields Lightroom writes (sublocation, city,
 * state/province, country, GPS). Place names are stored once, as written;
 * the country is an ISO 3166-1 alpha-2 code (CA, FR, IS) that the site
 * translates at build time (see src/utils/location.ts). A plain country
 * name is accepted too and shown as-is.
 */
const locationSchema = () => z.object({
  name: optionalText(),     // spot / sublocation: "Vieux-Québec"
  city: optionalText(),
  region: optionalText(),   // province / state
  country: optionalText(),  // ISO code preferred
  lat: coordinate(90),
  lng: coordinate(180),
}).nullable().optional().transform(val => {
  if (!val) return undefined;
  const hasAny = Object.values(val).some(v => v !== undefined);
  return hasAny ? val : undefined;
});

/**
 * About Collection
 *
 * Simple content type for the about page.
 * Profile image + bilingual bio content in markdown body.
 */
const about = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/about' }),
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
    }).nullable().optional().transform(val => val ?? undefined),
    // Contact/social links (optional)
    contact: z.object({
      email: z.string().optional(),
      instagram: z.string().optional(),
      twitter: z.string().optional(),
    }).nullable().optional().transform(val => val ?? undefined),
    // Bio content (optional, bilingual)
    bio: z.object({
      en: z.string().optional().default(''),
      fr: z.string().optional().default(''),
    }).nullable().optional().transform(val => val ?? undefined),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }), // Markdown files with frontmatter
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
    dateTaken: z.coerce.date().nullable().optional(), // EXIF capture date (auto-filled by extract-exif script)
    updatedDate: z.coerce.date().nullable().optional(),
    draft: z.boolean().nullable().optional().transform(val => val ?? false),
    private: z.boolean().nullable().optional().transform(val => val ?? false), // Protected content (Cloudflare Access)

    // --- Where & which body of work ---
    // Filled by scripts/import-photos.ts from Lightroom metadata, editable in the CMS
    location: locationSchema(),
    // Slug of a `projects` entry (src/content/projects/<slug>.md): a trip, a
    // place or a series of work. Not the same as postType 'series', which is
    // one post holding several images.
    project: optionalText(),

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
    // Auto-extracted by prebuild script, editable in CMS
    glowColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional()
      .or(z.literal('').transform(() => null)),
    // Secondary accent colors for dual-tone effects and color filtering
    // Manually picked in CMS — supports multiple colors per image
    secondaryColors: z.array(
      z.string().regex(/^#[0-9A-Fa-f]{6}$/)
    ).nullable().optional().transform(val => val ?? [])
      // Legacy: handle single secondaryColor string migrated to array
      .or(z.string().regex(/^#[0-9A-Fa-f]{6}$/).transform(val => [val]))
      .or(z.literal('').transform(() => [])),
    // Additional images for series posts
    images: z.array(
      z.object({
        src: z.string(),
        alt: z.object({
          en: z.string().optional().default(''),
          fr: z.string().optional().default(''),
        }).nullable().optional().transform(val => val ?? { en: '', fr: '' }),
        // Manual EXIF overrides (fills gaps in auto-extracted data, same as cover)
        camera: z.string().nullable().optional(),
        lens: z.string().nullable().optional(),
        focalLength: z.string().nullable().optional(),
        aperture: z.string().nullable().optional(),
        shutterSpeed: z.string().nullable().optional(),
        iso: z.string().nullable().optional(),
        // Legacy field (kept for backwards compatibility)
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
    // Enable 3D depth parallax effect on post detail page
    depth3d: z.boolean().nullable().optional().transform(val => val ?? false),
    // Auto-extracted EXIF summary (written by extract-exif script, visible in CMS)
    exifSummary: z.string().nullable().optional(),
    // Show EXIF metadata on post page (camera, lens, settings)
    showExif: z.boolean().nullable().optional().transform(val => val ?? false),
    // Which EXIF fields to display (default: all except dateTaken)
    exifFields: z.array(
      z.enum(['camera', 'lens', 'focalLength', 'aperture', 'shutterSpeed', 'iso', 'dateTaken'])
    ).nullable().optional().transform(val => val ?? ['camera', 'lens', 'focalLength', 'aperture', 'shutterSpeed', 'iso']),
    // Manual EXIF overrides for cover image (fills gaps from legacy/manual lenses)
    exifOverrides: z.object({
      camera: z.string().nullable().optional(),
      lens: z.string().nullable().optional(),
      focalLength: z.string().nullable().optional(),
      aperture: z.string().nullable().optional(),
      shutterSpeed: z.string().nullable().optional(),
      iso: z.string().nullable().optional(),
    }).nullable().optional(),
  }),
});

/**
 * Projects Collection
 *
 * A project groups posts across time: a trip (Iceland 2026), a place worked
 * repeatedly (rue Saint-Jean through the seasons), a body of work. Posts
 * point at a project with `project: <slug>`; the project page lists them.
 * Cover, dates and counts are derived from the posts when not set here.
 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: bilingual(),
    description: bilingual(),
    // Flavour of project, shown as a small badge; 'other' shows nothing
    kind: z.enum(['travel', 'local', 'astro', 'other']).nullable().optional().transform(val => val ?? 'other'),
    location: locationSchema(),
    // Optional explicit cover; defaults to the newest post's cover image
    coverImage: z.object({
      src: z.string(),
      alt: bilingual(),
    }).nullable().optional().transform(val => val ?? undefined),
    featured: z.boolean().nullable().optional().transform(val => val ?? false),
    draft: z.boolean().nullable().optional().transform(val => val ?? false),
  }),
});

export const collections = {
  posts,
  about,
  projects,
};
