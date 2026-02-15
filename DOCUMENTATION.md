# GMB Photography Portfolio - Complete Documentation

A bilingual (EN/FR) photography portfolio built with Astro. Static site generation with dynamic theming, ambient glow effects, and a visual CMS.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Pages & Routes](#pages--routes)
4. [Components Reference](#components-reference)
5. [Content System](#content-system)
6. [Visual CMS (Decap)](#visual-cms-decap)
7. [Styling System](#styling-system)
8. [Dynamic Color System](#dynamic-color-system)
9. [Internationalization](#internationalization)
10. [JavaScript Behaviors](#javascript-behaviors)
11. [Development](#development)
12. [Deployment](#deployment)
13. [Maintenance](#maintenance)
14. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Astro 5.x | Static site generation |
| Content | Markdown + Zod | Type-safe content collections |
| Styling | Pure CSS | Custom design system with CSS variables |
| Images | Sharp | Color extraction + optimization |
| CMS | Decap CMS | Visual content editor |
| Transitions | View Transitions API | Smooth page navigation |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        BUILD TIME                                │
├─────────────────────────────────────────────────────────────────┤
│  1. Astro reads Markdown files from src/content/                │
│  2. Validates against Zod schemas in content.config.ts          │
│  3. Extracts dominant colors from images using Sharp            │
│  4. Generates static HTML for every route                       │
│  5. Outputs to dist/ folder                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        RUNTIME (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  • View Transitions for smooth navigation                       │
│  • Carousel auto-rotation & keyboard controls                   │
│  • Gallery filtering (client-side search/tags)                  │
│  • Slideshow lightbox for series images                         │
│  • Dynamic accent color updates                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Single "posts" collection**: All photos live in one collection. The Gallery, Feed, and Homepage are different *views* of the same data, filtered by different criteria.

2. **Bilingual fields in frontmatter**: Each post has `title: { en: "...", fr: "..." }` rather than duplicate files per language.

3. **Build-time color extraction**: Image dominant colors are extracted at build time using Sharp, stored in frontmatter, or computed on-the-fly.

4. **No JavaScript framework**: All interactivity uses vanilla JS to keep bundle size minimal.

---

## Project Structure

```
gmbpho-to-project/
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── Header.astro         # Fixed nav bar with glass lens logo
│   │   ├── Footer.astro         # Simple copyright footer
│   │   ├── HomepageCarousel.astro   # Full-screen image carousel
│   │   ├── PostCard.astro       # Photo card (feed & gallery modes)
│   │   ├── FilterBar.astro      # Search + tag filtering
│   │   └── Slideshow.astro      # Lightbox for image series
│   │
│   ├── content/                 # Content files (Markdown)
│   │   ├── posts/               # Photo posts
│   │   │   ├── first-frost.md
│   │   │   ├── neon-reflections.md
│   │   │   └── ...
│   │   └── about/               # About page content
│   │       ├── en.md            # English bio
│   │       └── fr.md            # French bio
│   │
│   ├── layouts/
│   │   └── Base.astro           # HTML shell with meta, transitions, ambient glow
│   │
│   ├── pages/                   # URL routes
│   │   ├── index.astro          # / (homepage carousel)
│   │   ├── feed.astro           # /feed (chronological scroll)
│   │   ├── gallery.astro        # /gallery (filterable grid)
│   │   ├── about.astro          # /about (profile + bio)
│   │   ├── posts/
│   │   │   └── [slug].astro     # /posts/first-frost (individual post)
│   │   └── fr/                  # French routes (same structure)
│   │       ├── index.astro
│   │       ├── feed.astro
│   │       ├── gallery.astro
│   │       ├── about.astro
│   │       └── posts/
│   │           └── [slug].astro
│   │
│   ├── styles/
│   │   ├── global.css           # Reset, typography, spacing, animations
│   │   └── colors.css           # HSL-based color system
│   │
│   ├── utils/
│   │   ├── i18n.ts              # Translation strings + locale helpers
│   │   └── extractColors.ts     # Image color extraction (Sharp)
│   │
│   └── content.config.ts        # Content collection schemas (Zod)
│
├── public/
│   ├── favicon.svg
│   ├── images/uploads/          # CMS-uploaded images
│   └── admin/                   # Decap CMS
│       ├── index.html           # CMS entry point
│       └── config.yml           # CMS configuration
│
├── astro.config.mjs             # Astro configuration
├── package.json                 # Dependencies + scripts
└── tsconfig.json                # TypeScript configuration
```

---

## Pages & Routes

### Route Structure

| URL | File | Description |
|-----|------|-------------|
| `/` | `src/pages/index.astro` | Homepage with carousel |
| `/feed` | `src/pages/feed.astro` | Chronological photo scroll |
| `/gallery` | `src/pages/gallery.astro` | Filterable photo grid |
| `/about` | `src/pages/about.astro` | Profile + bio |
| `/posts/[slug]` | `src/pages/posts/[slug].astro` | Individual post |
| `/fr/...` | `src/pages/fr/...` | French versions of all above |

### Homepage (`index.astro`)

**Purpose**: Full-screen carousel showcasing selected photos.

**How posts are selected**:
```yaml
# In post frontmatter:
homepageCarousel: true   # Include in carousel
homepageDefault: true    # Make this the first/default slide
```

**Features**:
- Auto-rotation (5s intervals, 10s for reduced-motion users)
- Keyboard navigation (←/→ arrows, spacebar to pause)
- Touch gestures (swipe left/right)
- Ambient glow effect from image colors
- Click image to go to post detail
- Pause button to stop rotation

### Feed (`feed.astro`)

**Purpose**: Instagram-style vertical scroll of photos.

**Features**:
- Single-column, centered images
- Scroll-triggered reveal animations (IntersectionObserver)
- Subtle parallax effect on images (0.05 speed factor)
- Full-width ambient glow behind each image
- Respects `prefers-reduced-motion`

### Gallery (`gallery.astro`)

**Purpose**: Filterable grid view for browsing all photos.

**Features**:
- Responsive grid (2-5 columns based on viewport)
- Search input (filters by title and tags, debounced 200ms)
- Tag pills for category filtering
- URL query params (`?tag=nature`) for direct links
- Gallery navigation mode (prev/next between filtered posts)
- Hover overlays with title, date, tags
- Staggered animation on load

### Post Detail (`posts/[slug].astro`)

**Purpose**: Individual photo display with full details.

**Features**:
- Full-viewport hero image
- Dynamic accent color derived from image
- Page-wide ambient glow effect
- Markdown content (story/notes)
- Series images with clickable lightbox
- EXIF data display (camera, lens, settings)
- Gallery navigation (if entered from gallery via sessionStorage)
- Tag links to filtered gallery view

### About (`about.astro`)

**Purpose**: Profile and bio page.

**Features**:
- Circular profile image (sticky on desktop, centered on mobile)
- Bilingual content from Markdown body
- Contact links with icons (email, Instagram, Twitter)
- Responsive grid layout

---

## Components Reference

### Header.astro

**Location**: `src/components/Header.astro`

**Features**:
- Fixed position with backdrop blur (frosted glass)
- Glass lens logo with chromatic aberration effect
- Desktop nav links with animated underline on hover
- Language switcher (EN ↔ FR)
- Mobile hamburger menu with full-screen overlay
- Active state highlighting for current page

**Logo Effect**: Custom "liquid glass lens" with:
- Radial gradient for depth/transparency
- `::before` pseudo-element for top highlight arc
- `::after` pseudo-element for red/cyan chromatic fringe
- Subtle shimmer animation (respects reduced motion)
- Dynamic accent color integration via CSS variables

### Footer.astro

**Location**: `src/components/Footer.astro`

**Features**:
- Simple copyright notice with current year
- Fixed position on homepage (overlays carousel)
- Transparent background elsewhere

### HomepageCarousel.astro

**Location**: `src/components/HomepageCarousel.astro`

**Props**:
```typescript
interface Props {
  carouselPosts: CollectionEntry<'posts'>[];
  defaultPostSlug?: string;
  locale: 'en' | 'fr';
}
```

**Features**:
- Full viewport height, slides positioned below header
- Per-slide ambient glow using `--glow-r/g/b` CSS custom properties
- Updates `document.body` accent color CSS variables on slide change
- Preloads adjacent images for smooth transitions
- Screen reader announcements via live region
- Controls auto-hide, appear on hover/touch/keyboard focus
- Circular navigation (wraps around at ends)

**Accessibility**:
- `role="region"` with `aria-roledescription="carousel"`
- Each slide has `role="group"` with `aria-roledescription="slide"`
- Live region announces current slide position

### PostCard.astro

**Location**: `src/components/PostCard.astro`

**Props**:
```typescript
interface Props {
  post: CollectionEntry<'posts'>;
  index?: number;           // For staggered animation delay
  variant?: 'square' | 'landscape' | 'auto';
  layout?: 'grid' | 'feed';
}
```

**Modes**:

| Mode | Used In | Behavior |
|------|---------|----------|
| `grid` | Gallery | Square aspect ratio, hover overlay with title/tags/date, ambient glow on hover |
| `feed` | Feed | Natural aspect ratio, scroll-triggered reveal animation, full-width ambient glow |

**CSS Custom Properties**:
- `--glow-r`, `--glow-g`, `--glow-b`: RGB components for ambient glow

### FilterBar.astro

**Location**: `src/components/FilterBar.astro`

**Props**:
```typescript
interface Props {
  tags: string[];  // All unique tags across posts
}
```

**Features**:
- Search input with magnifying glass icon
- Tag pills with active state styling
- URL query param support (`?tag=macro` pre-selects tag on load)
- Debounced search (200ms delay)
- Stores filter context in `sessionStorage` for gallery navigation
- Updates visible count dynamically ("12 / 24")
- Adds query params to card links for gallery mode

### Slideshow.astro

**Location**: `src/components/Slideshow.astro`

**Features**:
- Fullscreen lightbox overlay with backdrop blur
- Prev/next navigation buttons
- Image counter ("1 / 5")
- Caption display (from EXIF data)
- Keyboard support: ←/→ navigate, Escape closes
- Click backdrop to close
- Focus trap for accessibility
- Preloads adjacent images

**Global API**:
```javascript
// Open slideshow from any page
window.openSlideshow(imagesArray, startIndex);
// imagesArray: [{ src: '...', alt: '...', caption: '...' }, ...]
```

---

## Content System

### Content Collections

Defined in `src/content.config.ts` using Zod schemas for type safety.

#### Posts Collection

**Location**: `src/content/posts/*.md`

**Full Schema**:
```typescript
const posts = defineCollection({
  type: 'content',
  schema: z.object({
    // Bilingual title (required)
    title: z.object({
      en: z.string(),
      fr: z.string(),
    }),

    // Bilingual description (optional)
    description: z.object({
      en: z.string().optional(),
      fr: z.string().optional(),
    }).optional(),

    // Publication date (required, coerced from string)
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),

    // Status flags
    draft: z.boolean().default(false),      // Hide from site entirely
    private: z.boolean().default(false),    // Future: Cloudflare Access protected

    // Cover image (required)
    coverImage: z.object({
      src: z.string(),        // URL or local path
      alt: z.object({
        en: z.string(),
        fr: z.string(),
      }),
    }),

    // Ambient glow color (auto-extracted if not provided)
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
        alt: z.object({ en: z.string(), fr: z.string() }),
        camera: z.string().optional(),   // e.g., "Sony A7R IV"
        lens: z.string().optional(),     // e.g., "35mm f/1.4"
        settings: z.string().optional(), // e.g., "f/2.8 · 1/500s · ISO 100"
      })
    ).optional(),

    // Classification
    tags: z.array(z.string()).default([]),  // e.g., ["macro", "nature"]
    postType: z.enum(['single', 'series']).default('single'),
    featured: z.boolean().default(false),   // Shows "Featured" badge

    // Homepage carousel
    homepageCarousel: z.boolean().default(false),  // Include in carousel
    homepageDefault: z.boolean().default(false),   // First/default slide
  }),
});
```

#### About Collection

**Location**: `src/content/about/en.md` and `fr.md`

**Schema**:
```typescript
const about = defineCollection({
  type: 'content',
  schema: z.object({
    profileImage: z.object({
      src: z.string(),
      alt: z.object({ en: z.string(), fr: z.string() }),
    }),
    tagline: z.object({
      en: z.string(),
      fr: z.string(),
    }).optional(),
    contact: z.object({
      email: z.string().optional(),
      instagram: z.string().optional(),  // Handle only, not full URL
      twitter: z.string().optional(),
    }).optional(),
  }),
});
```

The Markdown body contains the bio text, rendered via `<Content />`.

### Creating Posts

**Single Photo Post**:
```markdown
---
title:
  en: "Golden Hour at the Park"
  fr: "Heure dorée au parc"
description:
  en: "Evening light through autumn leaves."
  fr: "Lumière du soir à travers les feuilles d'automne."
date: 2025-02-15
coverImage:
  src: "https://images.unsplash.com/photo-example?w=1200"
  alt:
    en: "Sunlight filtering through orange leaves"
    fr: "Lumière du soleil à travers les feuilles oranges"
tags: ["nature", "autumn", "golden-hour"]
postType: single
featured: false
homepageCarousel: false
---

Write your story or notes here in Markdown.
```

**Series Post** (multiple images):
```yaml
postType: series
images:
  - src: "https://example.com/img1.jpg"
    alt:
      en: "First image description"
      fr: "Description première image"
    camera: "Sony A7R IV"
    lens: "35mm f/1.4"
    settings: "f/2.8 · 1/500s · ISO 100"
  - src: "https://example.com/img2.jpg"
    alt:
      en: "Second image"
      fr: "Deuxième image"
```

**Adding to Homepage Carousel**:
```yaml
homepageCarousel: true   # Include in carousel
homepageDefault: true    # Make this the first slide (only one post should have this)
```

---

## Visual CMS (Decap)

The site includes **Decap CMS** (formerly Netlify CMS) for visual content editing.

### Local Development

```bash
# Terminal 1: Start Astro
npm run dev

# Terminal 2: Start CMS backend
npx decap-server
```

Open: **http://localhost:4321/admin/**

### CMS Features

- Create/edit posts with form fields
- Upload images to `public/images/uploads/`
- Set bilingual titles and descriptions
- Add/remove tags
- Toggle featured, carousel, draft status
- Write content with Markdown editor
- Preview before saving

### Configuration

**File**: `public/admin/config.yml`

Key settings:
```yaml
# Local development mode
local_backend: true

# Where uploaded images go
media_folder: "public/images/uploads"
public_folder: "/images/uploads"

# Content location
collections:
  - name: "posts"
    folder: "src/content/posts"
    create: true
    slug: "{{slug}}"
    fields:
      # ... mirrors the Zod schema
```

### Production Setup

**Step 1**: Edit `public/admin/config.yml`:
```yaml
backend:
  name: github
  repo: YOUR-USERNAME/YOUR-REPO  # ← Change this
  branch: main

# Remove or set to false for production
local_backend: false
```

**Step 2**: Choose authentication method:

| Hosting | Auth Method | Setup |
|---------|-------------|-------|
| Netlify | Git Gateway | Enable Identity + Git Gateway in dashboard |
| Vercel/Cloudflare | GitHub OAuth | See [Decap External OAuth](https://decapcms.org/docs/external-oauth-clients/) |

**For Netlify Git Gateway** (simplest):
```yaml
backend:
  name: git-gateway
  branch: main
```

---

## Styling System

### CSS Architecture

```
src/styles/
├── colors.css    # HSL color system, accent variables, tinted variants
└── global.css    # Reset, typography, spacing, animations, utilities
```

All styles use CSS custom properties for consistency and theming.

### Color System (`colors.css`)

**HSL-based for dynamic theming**:

```css
:root {
  /* Base accent (cool blue-gray) - can be overridden per page */
  --color-accent-hue: 200;
  --color-accent-saturation: 12%;
  --color-accent-lightness: 60%;
}

body {
  /* Computed accent color */
  --color-accent: hsl(
    var(--color-accent-hue),
    var(--color-accent-saturation),
    var(--color-accent-lightness)
  );

  /* Accent hover state (+8% lightness) */
  --color-accent-hover: hsl(
    var(--color-accent-hue),
    var(--color-accent-saturation),
    calc(var(--color-accent-lightness) + 8%)
  );

  /* Tinted text colors (subtle accent hint) */
  --color-text-muted-tinted: hsl(var(--color-accent-hue), 12%, 60%);
  --color-text-subtle-tinted: hsl(var(--color-accent-hue), 10%, 45%);

  /* Tinted borders */
  --color-border-tinted: hsl(var(--color-accent-hue), 8%, 28%);
}
```

### Background Colors

```css
--color-bg: #1a1d1f;           /* Main background */
--color-bg-elevated: #232729;  /* Cards, elevated surfaces */
--color-bg-hover: #2a2f32;     /* Hover states */
--color-surface: #1f2325;      /* Card backgrounds */
--color-text: #E8E4E0;         /* Primary text */
```

### Spacing Scale (`global.css`)

```css
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 1rem;      /* 16px */
--space-lg: 1.5rem;    /* 24px */
--space-xl: 2rem;      /* 32px */
--space-2xl: 3rem;     /* 48px */
--space-3xl: 5rem;     /* 80px */
--space-4xl: 8rem;     /* 128px */
--space-5xl: 12rem;    /* 192px */
--space-6xl: 16rem;    /* 256px */
```

### Typography Scale

```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 2rem;      /* 32px */
--text-4xl: 2.5rem;    /* 40px */
--text-5xl: 3.5rem;    /* 56px */
```

### Font Stacks

```css
--font-display: 'Georgia', 'Times New Roman', serif;
--font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
--font-mono: 'SF Mono', 'Fira Code', monospace;
```

### Transitions

```css
--transition-fast: 150ms ease;
--transition-base: 300ms ease;
--transition-slow: 500ms ease;
--transition-gallery: 600ms cubic-bezier(0.22, 1, 0.36, 1);

/* Easing curves */
--ease-out-smooth: cubic-bezier(0.22, 1, 0.36, 1);
--ease-in-out-smooth: cubic-bezier(0.65, 0, 0.35, 1);
```

### Z-Index Scale

```css
--z-base: 1;
--z-header: 100;
--z-overlay: 200;
--z-lightbox: 300;
--z-toast: 400;
```

### Responsive Breakpoints

```css
/* Mobile: default (< 640px) */
@media (min-width: 640px)  { /* Tablet */ }
@media (min-width: 768px)  { /* Small desktop */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Wide */ }
```

### Utility Classes

| Class | Purpose |
|-------|---------|
| `.container` | Max-width (1400px) wrapper with inline padding |
| `.container--narrow` | Narrower max-width (800px) |
| `.btn` | Base button style |
| `.btn--accent` | Accent-colored button border/text |
| `.tag` | Tag pill style |
| `.tag--active` | Active/selected tag |
| `.animate-in` | Staggered fade-in-up animation |
| `.visually-hidden` | Screen reader only (hidden visually) |
| `.prose` | Markdown content styling |

---

## Dynamic Color System

### How It Works

1. **Build time**: Sharp extracts dominant color from each image
2. **Color stored**: Either in frontmatter (`glowColor`) or computed at build
3. **HSL conversion**: RGB → HSL for flexible manipulation
4. **Accent derivation**: Saturation/lightness clamped for readability (35-60% sat, 55-70% lightness)

### Color Extraction (`extractColors.ts`)

```typescript
// Extract dominant color from image (local or remote URL)
const color = await extractDominantColor(imagePath);
// Returns: { r: 180, g: 120, b: 80, hex: '#B47850' }

// Derive UI-safe accent color (clamped values)
const accent = deriveAccentFromGlow(r, g, b);
// Returns: { hue: 25, saturation: 45, lightness: 60 }
```

**Normalization process**:
1. Resize image to 100x100 for speed
2. Calculate average RGB from all pixels
3. Convert to HSL
4. Boost saturation (min 40%, max 70%)
5. Normalize lightness (45-65% range)

### Where Dynamic Colors Apply

| Element | How Applied |
|---------|-------------|
| Body accent | `Base.astro` props → inline style on `<body>` |
| Logo glow | Uses `--color-accent-hue` CSS variable |
| Nav link underlines | `--color-accent` |
| Tag active state | `--color-accent` + `--color-accent-subtle` |
| Post ambient glow | CSS custom properties `--glow-r/g/b` |
| Carousel per-slide glow | Inline style on each slide |
| Tinted text/borders | Computed from `--color-accent-hue` |

### Manual Color Override

In post frontmatter:
```yaml
glowColor:
  r: 180
  g: 120
  b: 80
  hex: "#B47850"
```

---

## Internationalization

### Structure

- **URL-based routing**: `/feed` (English), `/fr/feed` (French)
- **Default locale**: English (no prefix)
- **UI strings**: Centralized in `src/utils/i18n.ts`
- **Content**: Bilingual fields in frontmatter

### Translation Strings (`i18n.ts`)

```typescript
const translations = {
  // Navigation
  'nav.home': { en: 'Home', fr: 'Accueil' },
  'nav.feed': { en: 'Feed', fr: 'Fil' },
  'nav.gallery': { en: 'Gallery', fr: 'Galerie' },
  'nav.about': { en: 'About', fr: 'À propos' },

  // Gallery/Filters
  'gallery.all': { en: 'All', fr: 'Tout' },
  'gallery.search': { en: 'Search...', fr: 'Rechercher...' },
  'gallery.noResults': { en: 'No photos found.', fr: 'Aucune photo trouvée.' },

  // Post types
  'post.series': { en: 'Series', fr: 'Série' },

  // Footer
  'footer.rights': { en: 'All rights reserved.', fr: 'Tous droits réservés.' },

  // Language switcher
  'lang.switch': { en: 'FR', fr: 'EN' },
  // ... more
};
```

### Helper Functions

```typescript
// Get translated UI string
t('nav.feed', locale)  // → "Feed" or "Fil"

// Get locale from current URL
getLocaleFromUrl(Astro.url)  // → 'en' or 'fr'

// Get localized field from bilingual object
localized(post.data.title, locale)  // → "First Frost" or "Premier gel"

// Build localized path
localePath('/feed', 'fr')  // → "/fr/feed"
localePath('/feed', 'en')  // → "/feed"

// Get alternate locale path (for language switcher)
alternateLocalePath(Astro.url)  // → "/fr/..." or "/..."
```

### Adding New Translations

1. Add to `translations` object:
```typescript
'gallery.loading': { en: 'Loading...', fr: 'Chargement...' },
```

2. Use in component:
```astro
<p>{t('gallery.loading', locale)}</p>
```

---

## JavaScript Behaviors

### View Transitions

Astro's View Transitions API provides smooth page navigation.

**Enabled in** `Base.astro`:
```astro
<ViewTransitions />
```

**Re-initialization pattern** (all interactive components use this):
```javascript
// Initialize on first load
initFunction();

// Re-initialize after View Transition completes
document.addEventListener('astro:after-swap', initFunction);

// Cleanup before transition starts
document.addEventListener('astro:before-swap', cleanup, { once: true });
```

### Carousel Behavior (`HomepageCarousel.astro`)

- Auto-advances every 5s (10s if `prefers-reduced-motion`)
- Keyboard: ←/→ to navigate, Space to pause/play
- Touch: Swipe threshold 50px
- Pause on hover (desktop), resume on mouse leave
- Updates body accent color via `document.body.style.setProperty()`
- Preloads prev/next images
- Controls visible on hover, touch tap, or keyboard focus

### Feed Scroll Animation (`feed.astro`)

- IntersectionObserver with 15% threshold triggers `.visible` class
- Cards start with `opacity: 0; transform: translateY(40px) scale(0.98)`
- Animation: 0.8s ease to `opacity: 1; transform: none`
- Subtle parallax: `transform: translateY(scrollPosition * 0.05)`
- All animations disabled for `prefers-reduced-motion`

### Gallery Filter (`FilterBar.astro`)

- Client-side only (no page reload)
- Search input debounced 200ms
- Filters by:
  - Active tag (exact match on `data-tags` attribute)
  - Search text (substring match on tags + title)
- Shows/hides via `.post-card--hidden` class
- Stores context in `sessionStorage`:
  ```javascript
  { slugs: ['post1', 'post2'], tag: 'nature', search: '' }
  ```
- Updates card links with `?gallery=true&pos=N&total=M`

### Slideshow Lightbox (`Slideshow.astro`)

- Global function: `window.openSlideshow(images, startIndex)`
- Keyboard: ←/→ navigate, Escape closes
- Returns focus to trigger element on close
- Preloads adjacent images
- Updates counter and caption dynamically
- Backdrop click closes

### Gallery Navigation (`posts/[slug].astro`)

- Reads `sessionStorage.galleryContext` for navigation state
- If `?gallery=true` in URL and context exists:
  - Shows prev/next/close buttons
  - Updates back link to gallery
  - Enables keyboard navigation
  - Shows position counter

---

## Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or pnpm

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/gmbpho-to.git
cd gmbpho-to

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at http://localhost:4321 |
| `npm run build` | Build for production → `dist/` |
| `npm run preview` | Preview production build locally |
| `npx decap-server` | Start CMS backend (run alongside dev) |

### Development Workflow

1. `npm run dev` in terminal 1
2. `npx decap-server` in terminal 2 (optional, for CMS)
3. Edit files — changes appear instantly (HMR)
4. Add content to `src/content/posts/`
5. Commit and push to deploy

### Adding New Features

**New page**:
1. Create `src/pages/newpage.astro`
2. Create French version at `src/pages/fr/newpage.astro`
3. Add nav link in `Header.astro` `navLinks` array
4. Add translation in `i18n.ts`

**New component**:
1. Create `src/components/NewComponent.astro`
2. Import and use in pages
3. Styles can be in `<style>` block (scoped) or global CSS

---

## Deployment

### Build Process

```bash
npm run build
```

Creates `dist/` folder containing:
- Pre-rendered HTML for every route
- Optimized images
- Minified CSS
- Sitemap (from `@astrojs/sitemap`)

### Recommended: Cloudflare Pages

**Why**: Unlimited bandwidth (critical for photos), fastest global CDN.

**Steps**:
1. Push code to GitHub
2. Go to [pages.cloudflare.com](https://pages.cloudflare.com/)
3. Connect repository
4. Build settings:
   - Framework: Astro
   - Build command: `npm run build`
   - Output directory: `dist`
5. Deploy

**Custom domain**: Project settings → Custom domains → Add

### Alternative: Vercel

```bash
# Deploy
npx vercel --prod
```

Or connect GitHub for automatic deploys.

### Alternative: Netlify

1. Connect GitHub repo in Netlify dashboard
2. Build settings auto-detected
3. Deploy

### Hosting Comparison

| Feature | Cloudflare Pages | Vercel | Netlify |
|---------|-----------------|--------|---------|
| Bandwidth | Unlimited | 100GB/mo | 100GB/mo |
| Builds | 500/mo | 6000/mo | 300/mo |
| CDN Speed | Best | Great | Good |
| Image CDN | Built-in | Extra | Extra |
| Best for | Photography | Most cases | Beginners |

---

## Maintenance

### Adding Content

**Via CMS**:
1. `npm run dev` + `npx decap-server`
2. Go to http://localhost:4321/admin/
3. Create/edit posts with form interface

**Via files**:
1. Create `src/content/posts/new-post.md`
2. Follow schema structure
3. Commit and push

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update minor/patch
npm update

# Update major versions (check changelogs first)
npx npm-check-updates -u
npm install
```

**After updating**: Test `dev` and `build` before deploying.

### Image Hosting Options

| Service | Free Tier | Best For |
|---------|-----------|----------|
| Unsplash | Unlimited | Stock photos |
| Cloudinary | 25GB | Transformations |
| Cloudflare R2 | 10GB | Self-hosted |

**URL transformations**:
```
?w=1200&h=800&fit=crop  # Resize
?q=80                    # Quality
?fm=webp                 # Format
```

---

## Troubleshooting

### Build Errors

**"Invalid frontmatter"**
- Check YAML syntax (indentation, colons, quotes)
- Ensure required fields present
- Dates: `YYYY-MM-DD` format

**"Image not found"**
- Verify URL is accessible
- Check path for local images

### Development Issues

**Port in use**:
```bash
npm run dev -- --port 3000
```

**CMS not loading**:
- Ensure `npx decap-server` running
- Check `local_backend: true` in config.yml

### Production Issues

**Build fails on host but works locally**:
- Check Node version matches (18+)
- Clear host build cache
- Check for case-sensitivity in imports (Linux is case-sensitive)

---

## Quick Reference

### File Locations

| To change... | Edit file |
|--------------|-----------|
| Site metadata | `astro.config.mjs` |
| Navigation links | `src/components/Header.astro` (navLinks array) |
| Footer | `src/components/Footer.astro` |
| Colors | `src/styles/colors.css` |
| Typography/spacing | `src/styles/global.css` |
| UI translations | `src/utils/i18n.ts` |
| Content schema | `src/content.config.ts` |
| CMS fields | `public/admin/config.yml` |

### Common Commands

```bash
# Development
npm run dev

# CMS (second terminal)
npx decap-server

# Production build
npm run build

# Deploy
git add . && git commit -m "Update" && git push
```

### Post Template

```yaml
---
title:
  en: "Title"
  fr: "Titre"
date: 2025-02-15
coverImage:
  src: "https://..."
  alt:
    en: "Description"
    fr: "Description"
tags: ["tag1", "tag2"]
postType: single
featured: false
homepageCarousel: false
---

Content here...
```
