# Photography Portfolio Development Roadmap

**Last Updated:** March 7, 2026
**Project:** gphoto.pages.dev  
**Purpose:** Personal portfolio → Template business foundation

---

## Project Vision

**Personal Goal:** Build a fast, beautiful photography portfolio with data sovereignty  
**Business Goal:** Template product for photographers ($799 one-time, no subscriptions)  
**Core Principle:** Own your content, own your code, own your future

---

## Phase 1: Performance & Core UX (CURRENT)

### Image Optimization (HIGH PRIORITY)

**Problem:**
- Loading full-res images everywhere
- No lazy loading
- Missing modern formats (AVIF/WebP)
- Poor mobile landscape handling

**Solution:**

```astro
// Replace all <img> with Astro Image component
import { Image } from 'astro:assets';

<Image 
  src={post.data.coverImage.src}
  alt={post.data.coverImage.alt.en}
  widths={[400, 800, 1200, 2400]}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
  format="avif"
  loading={index < 6 ? "eager" : "lazy"}
  fetchpriority={index === 0 ? "high" : "auto"}
  decoding="async"
/>
```

**Image Size Tiers:**
- Thumbnail: 400px (grid/feed)
- Preview: 1200px (lightbox)
- Full: 2400px (download/zoom)
- LQIP: 20px base64 blur placeholder

**Mobile Landscape Fix:**
```css
@media (orientation: landscape) and (max-width: 1024px) {
  .gallery-image {
    object-fit: contain;
    max-height: 70vh;
    width: auto;
  }
}
```

**Expected Results:**
- 80% reduction in initial load (2-3MB → 500KB)
- Sub-1s LCP on mobile
- Perfect Lighthouse scores

**Status:** Complete
**Completed:** OptimizedImage.astro component with AVIF/WebP/JPEG srcset, optimize-images.ts build script
**Effort:** 4-6 hours
**Priority:** P0 (Critical)

---

### Open Graph / Social Sharing (HIGH PRIORITY)

**Problem:**
- OpenGraph score: 47/100
- Missing og:description
- Missing image dimensions
- Title too short
- No alt text

**Solution:**

Create `src/components/SEO.astro`:

```astro
---
interface Props {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  locale?: 'en' | 'fr';
}

const { 
  title, 
  description, 
  image = '/og-default.jpg',
  imageAlt = 'Gabriel Mercier Photography',
  type = 'website',
  locale = 'en'
} = Astro.props;

const canonicalURL = new URL(Astro.url.pathname, Astro.site);
const imageURL = new URL(image, Astro.site).href; // MUST be absolute

const fullTitle = title.includes('Gabriel') 
  ? title 
  : `${title} | Gabriel Mercier Photography`;
---

<!-- Primary Meta Tags -->
<title>{fullTitle}</title>
<meta name="title" content={fullTitle} />
<meta name="description" content={description} />
<link rel="canonical" href={canonicalURL} />

<!-- Open Graph / Facebook -->
<meta property="og:type" content={type} />
<meta property="og:url" content={canonicalURL} />
<meta property="og:title" content={fullTitle} />
<meta property="og:description" content={description} />
<meta property="og:image" content={imageURL} />
<meta property="og:image:secure_url" content={imageURL} />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content={imageAlt} />
<meta property="og:locale" content={locale === 'en' ? 'en_US' : 'fr_CA'} />
<meta property="og:site_name" content="Gabriel Mercier Photography" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content={canonicalURL} />
<meta name="twitter:title" content={fullTitle} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={imageURL} />
<meta name="twitter:image:alt" content={imageAlt} />

<!-- Additional -->
<meta name="theme-color" content="#000000" />
```

**Usage in Posts:**
```astro
<SEO 
  title={post.data.title.en}
  description={post.data.description.en}
  image={post.data.coverImage.src}
  imageAlt={post.data.coverImage.alt.en}
  type="article"
/>
```

**Content Schema Updates:**
```yaml
# Add to all posts
description:
  en: "150-200 character description for social sharing"
  fr: "Description française"
```

**Create Default OG Image:**
- 1200x630px image at `/public/og-default.jpg`
- Use best photo with text overlay

**Testing:**
- https://www.opengraph.xyz
- https://cards-dev.twitter.com/validator
- https://developers.facebook.com/tools/debug/

**Expected Score:** 90-100/100

**Status:** Complete
**Completed:** Built into Base.astro with full OG/Twitter Card support, bilingual, dynamic accent colors
**Effort:** 2-3 hours
**Priority:** P0 (Critical)

---

### Security Headers

**Add to `/public/_headers`:**
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';
```

**Status:** Complete
**Completed:** Full headers in public/_headers with CSP, frame-src for video embeds, CMS exception
**Effort:** 15 minutes
**Priority:** P1 (High)

---

### Astro Version Upgrade

**Status:** Complete
**Completed:** Already at Astro 5.17.3 — no upgrade needed
**Effort:** N/A
**Priority:** P1 (High)

---

### Preloading Strategy

**Hero Image Preload:**
```astro
<link rel="preload" as="image" href={heroImage} type="image/avif">
```

**Intersection Observer for Gallery:**
```javascript
// Preload next 6 images when scrolling near
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      preloadImage(entry.target.dataset.preview);
    }
  });
}, { rootMargin: '200px' });
```

**Status:** Partially Complete
**Completed:** HomepageCarousel preloads adjacent slides; OptimizedImage uses eager loading + fetchpriority for above-fold; `<link rel="preload">` for hero AVIF on post pages (EN + FR)
**Remaining:** No IntersectionObserver preloading in gallery
**Effort:** 1 hour remaining
**Priority:** P2 (Medium)

---

## Phase 2: Distribution & Discovery

### RSS Feed

**Implementation:**
```astro
// src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('posts');
  
  return rss({
    title: 'Gabriel Mercier Photography',
    description: 'Latest photography work',
    site: context.site,
    items: posts.map(post => ({
      title: post.data.title.en,
      pubDate: post.data.date,
      description: post.data.description.en,
      link: `/posts/${post.slug}/`,
      customData: `<enclosure url="${post.data.coverImage.src}" type="image/jpeg" />`
    }))
  });
}
```

**Status:** Complete
**Completed:** src/pages/rss.xml.ts with filtering, enclosures, customData
**Effort:** 30 minutes
**Priority:** P1 (High)

---

### Email Newsletter (Buttondown)

**Integration:**
```astro
<form 
  action="https://buttondown.email/api/emails/embed-subscribe/gphoto" 
  method="post"
>
  <input type="email" name="email" placeholder="Get new work via email" required />
  <button type="submit">Subscribe</button>
</form>
```

**Features:**
- Free for <1K subscribers
- RSS-to-email automation
- Markdown emails
- Export subscribers anytime

**Status:** Complete
**Completed:** src/components/NewsletterSignup.astro with bilingual support, responsive styling
**Effort:** 1 hour
**Priority:** P1 (High)

---

### Structured Data (Schema.org)

**Add to Post Pages:**
```astro
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Photograph",
  "name": "{post.data.title.en}",
  "creator": {
    "@type": "Person",
    "name": "Gabriel Mercier",
    "url": "https://gphoto.pages.dev"
  },
  "image": "{post.data.coverImage.src}",
  "datePublished": "{post.data.date}",
  "contentLocation": {
    "@type": "Place",
    "name": "{post.data.location}"
  }
}
</script>
```

**Purpose:** AI search discovery (Perplexity, ChatGPT, Google AI)

**Status:** Complete
**Completed:** WebSite schema on all pages, Article + Photograph on posts, CollectionPage + ImageGallery on gallery, ProfilePage on homepage
**Effort:** 1 hour
**Priority:** P1 (High)

---

### Image Sharing & Canonical Source

**Vision:** The site is the single source of truth for all images. Never upload to other platforms — hotlink from your own domain everywhere (Reddit, Discord, forums, blogs). Every view goes through your Cloudflare analytics, EXIF copyright stays intact, and you control the quality. Unlimited bandwidth on Cloudflare Pages makes this free.

**Features:**
1. **Copy Image URL button** on each post page — one tap to get the optimized full-res URL
2. **Size picker** — full res (2400px), preview (1200px), thumbnail (800px) options
3. **Copy with attribution** — copies image URL + credit line (e.g. `Photo by Gabriel Mercier — gphoto.pages.dev/posts/blue`)
4. **Download button** — download the image with EXIF copyright metadata baked in

**UI:** Expandable panel or dropdown near the existing share button in `post__image-info`. Matches glass design language.

**Purpose:** Data sovereignty — own your content, control distribution, track views via Cloudflare analytics. No re-compression by third-party platforms.

**Status:** Not Started
**Effort:** 3-4 hours
**Priority:** P1 (High - core to data sovereignty vision)

---

### Video Post Support

**Vision:** Support YouTube/Vimeo embeds alongside photos without losing photography focus.

**Content Schema Update:**
```typescript
// Three post types: photo, video, mixed
mediaType: z.enum(['photo', 'video', 'mixed'])

video: z.object({
  provider: z.enum(['youtube', 'vimeo']),
  id: z.string(), // e.g., "dQw4w9WgXcQ"
  thumbnail: z.string().optional(), // Auto-fetched
  duration: z.string().optional(), // e.g., "4:32"
  aspectRatio: z.enum(['16:9', '9:16', '4:3', '1:1'])
}).optional()
```

**Example Video Post:**
```yaml
---
mediaType: video
title:
  en: "Behind the Lens: Charlevoix Winter Expedition"
  fr: "Dans les coulisses : Expédition hivernale"
video:
  provider: youtube
  id: "dQw4w9WgXcQ"
  duration: "10:24"
  aspectRatio: "16:9"
---
```

**Feed Display:**
- Video thumbnails with play button overlay
- Duration badge
- Filter tabs: All / Photos / Videos / Stories
- Lazy loading with lite-youtube-embed (saves 500KB per video)

**Auto-Thumbnail Fetching:**
```typescript
// Build-time fetch from YouTube
const thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
```

**Schema.org VideoObject:**
```json
{
  "@type": "VideoObject",
  "name": "...",
  "thumbnailUrl": "...",
  "embedUrl": "https://www.youtube.com/embed/...",
  "duration": "..."
}
```

**Use Cases:**
- Behind-the-scenes documentaries
- Time-lapses complementing photo series
- Expedition recaps
- Tutorials/workshops

**Recommendation:** 1 video per 10 photos - keep photography focus

**Status:** Not Started  
**Effort:** 6-10 hours  
**Priority:** P2 (Medium - add after core features)

**Components to Build:**
- VideoEmbed.astro (lite-youtube wrapper)
- PostCard with video detection
- Feed filter tabs
- Video-specific OG tags
- RSS feed updates

---

### Webmentions

**Setup:**
1. Sign up at webmention.io
2. Add `<link>` tags
3. Display mentions on posts

```astro
<script src="https://webmention.io/gphoto.pages.dev/webmention.js"></script>
<div id="webmentions"></div>
```

**Purpose:** Decentralized social interactions (indie web)

**Status:** Not Started  
**Effort:** 1-2 hours  
**Priority:** P3 (Low)

---

### Color-Based Filtering

**Concept:** Let users browse photos by dominant color and mood (light/dark)

**Implementation:**

**1. Extend Color Extraction at Build Time:**
```javascript
// You already extract accent colors, extend this:
import sharp from 'sharp';

async function extractColorMetadata(imagePath) {
  const { dominant } = await sharp(imagePath)
    .stats();
  
  // Get dominant color
  const dominantColor = {
    r: dominant.r,
    g: dominant.g,
    b: dominant.b,
    hex: rgbToHex(dominant.r, dominant.g, dominant.b)
  };
  
  // Calculate lightness (HSL)
  const hsl = rgbToHsl(dominant.r, dominant.g, dominant.b);
  const lightness = hsl.l;
  
  // Categorize color family
  const colorFamily = getColorFamily(hsl.h);
  
  // Determine mood
  const mood = lightness > 0.6 ? 'light' : lightness < 0.4 ? 'dark' : 'balanced';
  
  return {
    dominant: dominantColor.hex,
    colorFamily, // 'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'neutral'
    lightness: Math.round(lightness * 100), // 0-100
    mood // 'light', 'dark', 'balanced'
  };
}

function getColorFamily(hue) {
  // Hue is 0-360
  if (hue < 15 || hue >= 345) return 'red';
  if (hue < 45) return 'orange';
  if (hue < 75) return 'yellow';
  if (hue < 165) return 'green';
  if (hue < 255) return 'blue';
  if (hue < 345) return 'purple';
  return 'neutral';
}
```

**2. Add to Content Schema:**
```yaml
# Auto-generated at build time, stored in frontmatter
colorData:
  dominant: "#3a5f8c"
  colorFamily: "blue"
  lightness: 45
  mood: "balanced"
```

**3. Gallery Filter UI:**
```astro
<div class="color-filters">
  <!-- Color family pills -->
  <button data-color="all" class="active">All</button>
  <button data-color="red" style="--color: #e74c3c">Reds</button>
  <button data-color="orange" style="--color: #e67e22">Oranges</button>
  <button data-color="yellow" style="--color: #f1c40f">Yellows</button>
  <button data-color="green" style="--color: #2ecc71">Greens</button>
  <button data-color="blue" style="--color: #3498db">Blues</button>
  <button data-color="purple" style="--color: #9b59b6">Purples</button>
  <button data-color="neutral" style="--color: #95a5a6">Neutrals</button>
  
  <!-- Mood filter -->
  <div class="mood-filter">
    <button data-mood="all" class="active">All Moods</button>
    <button data-mood="light">Light</button>
    <button data-mood="balanced">Balanced</button>
    <button data-mood="dark">Dark</button>
  </div>
</div>

<script>
  // Filter gallery items by color and mood
  document.querySelectorAll('[data-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      const items = document.querySelectorAll('.gallery-item');
      
      items.forEach(item => {
        if (color === 'all' || item.dataset.colorFamily === color) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });
</script>
```

**4. Visual Design:**
```css
.color-filters button {
  background: var(--color);
  border: 2px solid transparent;
  border-radius: 24px;
  padding: 8px 16px;
  color: white;
  font-weight: 500;
  transition: all 0.2s;
}

.color-filters button.active {
  border-color: white;
  box-shadow: 0 0 0 2px var(--color);
}

/* Show dominant color as subtle background on hover */
.gallery-item {
  position: relative;
}

.gallery-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--item-dominant-color);
  opacity: 0;
  transition: opacity 0.3s;
  z-index: -1;
}

.gallery-item:hover::before {
  opacity: 0.1;
}
```

**5. Advanced: Color Palette View**
```astro
<!-- Optional: Show color palette extracted from image -->
<div class="color-palette">
  {colorData.palette.map(color => (
    <div 
      class="palette-swatch" 
      style={`background: ${color}`}
      title={color}
    />
  ))}
</div>
```

**Use Cases:**
- Browse all warm photos (reds, oranges, yellows)
- Find moody dark images
- Discover vibrant blue landscapes
- Curate color-themed series

**Business Angle:**
- Unique differentiator (most portfolios don't have this)
- Great for photographers organizing shoots
- Useful for clients looking for specific aesthetics

**Status:** Complete
**Completed:** extractColors.ts extended with colorFamily/mood, FilterBar with color pills, GalleryImage with data attributes
**Effort:** 4-6 hours (color extraction + UI)
**Priority:** P2 (Medium - high UX value, not critical path)

**Implementation Notes:**
- Uses existing glowColor RGB values (no extra extraction needed)
- Color families: red, orange, yellow, green, blue, purple, neutral
- Mood detection: light (>60% lightness), dark (<40%), balanced
- URL params supported: ?color=blue for deep linking

---

### Secondary Color Support

**Goal:** Extract and optionally display a secondary accent color for richer visual effects.

**Current State:**
- `extractDominantColor()` in extractColors.ts returns single average color (normalized for glow)
- `extractColorPalette()` exists for basic palette extraction
- `secondaryColor` field added to content schema (optional hex string)
- `secondaryColor` field added to CMS configs
- Gallery passes `secondaryColorFamily` data attribute to GalleryImage for filtering
- **Not yet used visually** — glow effects in PostCard, feed, Base layout only use primary `glowColor`

**Remaining Work:**
1. **Improve extraction** — upgrade to k-means clustering for better multi-color detection (current averaging misses secondary tones)
2. **Auto-extract secondary color** at build time instead of manual CMS picker
3. **Use both colors in glow effects** — dual-tone glow in PostCard, feed, and Base layout background

**Status:** Partially Complete
**Completed:** Schema field, CMS integration, filtering support, basic palette extraction, dual-tone glow in PostCard/feed/post pages
**Remaining:** Better extraction algorithm (k-means), auto-extract secondary color at build time
**Effort:** 2-3 hours remaining
**Priority:** P2 (Medium)

---

## Phase 2.5: Mobile CMS & Offline Support

### Mobile-Optimized Sveltia CMS

**Status:** Partially Complete - Sveltia CMS has built-in mobile support

**Problem:**
- Too many fields for quick posting from phone
- Need simpler workflow for mobile

**Solution: Multi-tier CMS configuration**

**1. Quick Post Collection (Mobile-First):**
```yaml
# Minimal fields for fast mobile posting
collections:
  - name: "quick-posts"
    label: "Quick Post"
    editor:
      preview: false  # Saves screen space
    fields:
      - {label: "Photo", name: "coverImage", widget: "image"}
      - {label: "Title", name: "title", widget: "string"}
      - {label: "Caption", name: "caption", widget: "text", required: false}
      - {label: "Location", name: "location", widget: "string", required: false}
      - {label: "Tags", name: "tags", widget: "list"}
      - {label: "Date", name: "date", widget: "datetime", default: "{{now}}"}
```

**2. Full Post Editor (Desktop):**
- Complete bilingual fields
- Image series support
- Video integration
- Advanced metadata

**3. Site Settings Collection (No code editing):**
```yaml
collections:
  - name: "settings"
    label: "Site Settings"
    files:
      - label: "Feature Toggles"
        name: "features"
        file: "src/config/features.json"
        fields:
          - {label: "Enable RSS Feed", name: "enableRSS", widget: "boolean"}
          - {label: "Enable Email Newsletter", name: "enableNewsletter", widget: "boolean"}
          - {label: "Enable Video Posts", name: "enableVideo", widget: "boolean"}
          - {label: "Show Social Share", name: "showSocialShare", widget: "boolean"}
          - {label: "Enable Dark Mode", name: "enableDarkMode", widget: "boolean"}
      
      - label: "Homepage Sections"
        name: "homepage"
        file: "src/config/homepage.json"
        fields:
          - {label: "Show Hero Carousel", name: "showHero", widget: "boolean"}
          - {label: "Hero Image Count", name: "heroCount", widget: "number", default: 5}
          - {label: "Show Featured Gallery", name: "showFeatured", widget: "boolean"}
          - {label: "Latest Posts Count", name: "latestCount", widget: "number"}
      
      - label: "Colors & Branding"
        name: "general"
        file: "src/config/settings.json"
        fields:
          - {label: "Site Title", name: "siteTitle", widget: "string"}
          - {label: "Primary Color", name: "primaryColor", widget: "color"}
          - {label: "Accent Color", name: "accentColor", widget: "color"}
```

**4. Dynamic Navigation:**
```yaml
- label: "Navigation"
  name: "navigation"
  file: "src/config/navigation.json"
  fields:
    - label: "Main Menu"
      name: "mainMenu"
      widget: "list"
      fields:
        - {label: "Label (EN)", name: "labelEn", widget: "string"}
        - {label: "Label (FR)", name: "labelFr", widget: "string"}
        - {label: "URL", name: "url", widget: "string"}
        - {label: "Show in Menu", name: "enabled", widget: "boolean"}
```

**Status:** Not Started  
**Effort:** 4-6 hours  
**Priority:** P1 (High - enables mobile workflow)

---

### Local Development & Offline Support

**Status:** Complete - Sveltia CMS uses File System Access API

**Sveltia CMS Local Workflow:**
1. Run `npm run dev` (Astro dev server)
2. Open `/admin/en/index.html` in Chrome/Edge
3. Click "Work with Local Repository"
4. Select project root folder
5. Edit locally - changes save directly to files

**No proxy server needed** - Sveltia uses browser's File System Access API.

**Browser Requirements:**
- Chrome, Edge, or Chromium-based browsers
- Brave requires enabling File System Access API flag
- Firefox/Safari not supported for local editing

**Online Workflow:**
- GitHub OAuth via Cloudflare Pages Functions
- Direct commits to main branch
- GitHub Actions auto-deploys on push

---

### Using Site Settings in Code

**Load settings dynamically:**

```astro
---
// src/layouts/Layout.astro
import settings from '../config/settings.json';
import features from '../config/features.json';
import homepage from '../config/homepage.json';

const { siteTitle, primaryColor, accentColor } = settings;
const { enableRSS, enableNewsletter } = features;
---

<html>
  <head>
    <title>{siteTitle}</title>
    <style define:vars={{ primaryColor, accentColor }}>
      :root {
        --color-primary: var(--primaryColor);
        --color-accent: var(--accentColor);
      }
    </style>
  </head>
  <body>
    {enableNewsletter && <NewsletterSignup />}
  </body>
</html>
```

**Navigation from CMS:**
```astro
---
import navigation from '../config/navigation.json';
const enabledItems = navigation.mainMenu.filter(item => item.enabled);
---

<nav>
  {enabledItems.map(item => (
    <a href={item.url}>
      {Astro.currentLocale === 'fr' ? item.labelFr : item.labelEn}
    </a>
  ))}
</nav>
```

**Status:** Not Started  
**Effort:** 2-3 hours  
**Priority:** P1 (High)

---

### Auto-Processing Quick Posts

**Transform simple posts into full schema at build time:**

```javascript
// scripts/process-quick-posts.js
// Converts quick posts (simple title string) 
// into full bilingual schema automatically

const transformed = {
  mediaType: 'photo',
  title: {
    en: data.title,
    fr: data.title // Copy for now
  },
  description: {
    en: data.caption || '',
    fr: data.caption || ''
  },
  coverImage: {
    src: data.coverImage,
    alt: {
      en: data.altEn || data.title,
      fr: data.altFr || data.title
    }
  }
};
```

**Run as prebuild hook:**
```json
{
  "scripts": {
    "prebuild": "node scripts/process-quick-posts.js",
    "build": "astro build"
  }
}
```

**Status:** Not Started  
**Effort:** 2 hours  
**Priority:** P2 (Medium)

---

### Mobile CMS UX Polish

**Custom CSS for mobile:**
```css
/* public/admin/custom.css */
@media (max-width: 768px) {
  /* Larger touch targets */
  input, textarea {
    font-size: 16px; /* Prevents iOS zoom */
    padding: 12px;
  }
  
  /* Hide preview panel */
  .nc-previewPane-frame {
    display: none;
  }
  
  /* Bigger publish button */
  button[type="submit"] {
    min-height: 48px;
    font-size: 18px;
  }
}
```

**Better mobile media library:**
```yaml
media_library:
  name: cloudinary
  config:
    multiple: true
    max_file_size: 10000000
    default_transformations:
      - - fetch_format: auto
        - quality: auto
```

**Status:** Not Started  
**Effort:** 1-2 hours  
**Priority:** P2 (Medium)

---

### Mobile Workflow Testing Checklist

**Completed:**
- Access https://gphoto.pages.dev/admin/ on phone
- Login with GitHub OAuth
- Create post with photo from camera roll
- Publish and verify auto-deploy via GitHub Actions

**Sveltia Mobile Features:**
- Native mobile-optimized UI
- Touch-friendly interface
- Camera roll access for uploads

**Local Development:**
- "Work with Local Repository" in Chrome/Edge
- Direct file editing without server

---

## Phase 2.75: Modern CSS Upgrades

**Goal:** Replace outdated CSS patterns with modern, native solutions. Better performance, cleaner code, no JavaScript required for many animations.

**Browser Support:** 85%+ on all features listed below.

---

### Quick Wins (Implement First)

**1. Native Aspect Ratios (96% support)**

Replace padding-hack aspect ratios:

```css
/* OLD WAY */
.video-wrapper {
  padding-top: 56.25%; /* 16:9 hack */
  position: relative;
}

/* MODERN */
.gallery-item {
  aspect-ratio: 3 / 2; /* or 4/3, 1/1 */
  overflow: hidden;
}

.gallery-item img {
  object-fit: cover;
  width: 100%;
  height: 100%;
  object-position: center;
}
```

**Use for:** Consistent gallery grid without JavaScript

---

**2. Object-Fit for Responsive Images (96% support)**

```css
/* OLD */
.card-image {
  background-image: url(...);
  background-size: cover;
  background-position: center;
}

/* MODERN */
img {
  object-fit: cover;
  width: 100%;
  aspect-ratio: 3 / 2;
  object-position: center; /* or top, bottom for focal point */
}
```

**Use for:** Gallery thumbnails - no more background-image hacks

---

**3. Dynamic Viewport Height (93% support)**

```css
/* OLD - Breaks on mobile */
.hero {
  height: 100vh; /* Includes browser chrome */
}

/* MODERN */
.hero {
  height: 100dvh; /* Dynamic viewport height */
}

.lightbox {
  height: 100dvh;
}
```

**Use for:** Full-screen image viewer, hero sections, lightbox

---

**4. Text Wrap Balance (87% support)**

```css
/* OLD - Manual <br> tags */
<h1>Breaking Long<br>Headlines Manually</h1>

/* MODERN */
h1, h2, .post-title {
  text-wrap: balance;
  max-inline-size: 40ch;
}
```

**Use for:** Photo titles, description headings

---

**5. Independent Transforms (92% support)**

```css
/* OLD - Rewrite everything to change one */
.icon {
  transform: translateX(10px) rotate(45deg) scale(1.2);
}

/* MODERN - Change individually */
.photo-card {
  transition: scale 0.3s ease;
}

.photo-card:hover {
  scale: 1.05; /* Just scale, no transform rewrite */
}
```

**Use for:** Gallery hover effects, image zoom

---

**6. Inset Shorthand (93% support)**

```css
/* OLD */
.overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

/* MODERN */
.overlay {
  position: absolute;
  inset: 0;
}

/* Or specific sides */
.sticky-header {
  position: sticky;
  inset-block-start: 0; /* top in LTR/RTL aware way */
}
```

**Use for:** Lightbox overlays, positioned elements

---

**Status:** Complete
**Completed:** All quick wins implemented - text-wrap: balance, independent transforms, aspect-ratio, object-fit, dvh, inset
**Effort:** 2-3 hours
**Priority:** P1 (High - easy wins, immediate impact)

---

### Medium Priority (Next Week)

**7. OKLCH Colors (90% support)**

Perceptually uniform color space - better for color extraction:

```css
/* OLD - RGB/HSL doesn't scale well */
--brand: #4f46e5;
--brand-light: #818cf8; /* Manually tweaked */
--brand-dark: #3730a3;

/* MODERN - Perceptually uniform */
:root {
  --photo-accent: oklch(0.65 0.15 var(--hue));
  --accent-light: oklch(0.85 0.15 var(--hue));
  --accent-dark: oklch(0.45 0.15 var(--hue));
}

/* Derive colors from extracted photo color */
.card {
  --accent: oklch(from var(--photo-color) calc(l * 1.2) c h);
  border: 2px solid var(--accent);
}
```

**Use for:** Dynamic color extraction - better color math

---

**8. Color-Mix for Overlays (89% support)**

```css
/* OLD - Sass required */

/* MODERN */
.photo-overlay {
  background: color-mix(
    in oklch,
    var(--extracted-color) 20%,
    transparent
  );
}

.photo-card::before {
  background: color-mix(
    in oklch,
    var(--photo-accent) 15%,
    black
  );
}

/* Hover state */
.photo-card:hover::before {
  background: color-mix(
    in oklch,
    var(--accent-color) 40%,
    black
  );
}
```

**Use for:** Dynamic photo overlays based on image colors

---

**9. Scroll-Linked Animations (78% support)**

No JavaScript required - pure CSS scroll animations:

```css
/* OLD - IntersectionObserver + JS */

/* MODERN */
.gallery-item {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 25%;
}

@keyframes reveal {
  from {
    opacity: 0;
    scale: 0.8;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

/* Fade in on scroll */
.photo-card {
  animation: fade-in-up linear;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    translate: 0 20px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
```

**Use for:** Gallery scroll animations - no JavaScript!

---

**Status:** Complete
**Completed:** OKLCH colors in colors.css/Base.astro/Header.astro, color-mix for overlays, scroll-linked animations in PostCard.astro/FeedPage.astro
**Effort:** 3-4 hours
**Priority:** P1 (High - significant UX improvement)

---

### Advanced (Month 2)

**10. Container Queries (93% support)**

Components adapt to their container, not viewport:

```css
/* OLD - Media queries check viewport */
@media (max-width: 768px) {
  .card { flex-direction: column; }
}

/* MODERN - Check container width */
.gallery {
  container-type: inline-size;
  container-name: gallery;
}

@container gallery (width < 400px) {
  .photo-card {
    --columns: 1;
    font-size: 0.875rem;
  }
}

@container gallery (width >= 800px) {
  .photo-card {
    --columns: 3;
  }
}
```

**Use for:** Gallery cards that adapt to sidebar vs full-width

---

**11. View Transitions (Page Navigation)**

Smooth page transitions without JavaScript:

```css
@view-transition {
  navigation: auto;
}

.hero-image {
  view-transition-name: hero;
}

/* Customize transition */
::view-transition-old(hero) {
  animation: fade-out 0.3s ease-out;
}

::view-transition-new(hero) {
  animation: fade-in 0.3s ease-in;
}
```

**Use for:** Smooth gallery-to-detail page transitions

---

**Status:** Not Started
**Effort:** 3-4 hours
**Priority:** P2 (Medium - polish features)

---

### Experimental (Future - Skip for Now)

**Border-Shape (Chrome Canary Only)**

Tooltips with proper speech bubble arrows:

```css
.tooltip {
  border-shape: shape(
    from 10px 0,
    hline to calc(100% - 10px),
    curve to right 10px with right top,
    /* ... arrow shape ... */
    close
  );
}
```

**Status:** Experimental only - revisit in 6 months

---

### Implementation Checklist

**Quick Wins (This Sprint):**
```
- [x] Replace aspect ratio hacks with native aspect-ratio (PostCard.astro)
- [x] Update to object-fit for all gallery images (PostCard.astro, feed.astro)
- [x] Use 100dvh for lightbox and hero sections (Base.astro)
- [x] Add text-wrap: balance to headings (global.css)
- [x] Replace transform with independent scale/translate/rotate (global.css, PostCard, GalleryImage, Header, ShareButton)
- [x] Use inset: 0 for overlays and positioned elements (PostCard.astro)
```

**Medium Priority:**
```
- [x] Upgrade color extraction to OKLCH (colors.css, Base.astro, Header.astro)
- [x] Implement color-mix for dynamic overlays (colors.css)
- [x] Add scroll-linked animations to gallery (PostCard.astro, FeedPage.astro)
```

**Advanced:**
```
- [ ] Implement container queries for responsive gallery
- [x] Add view transitions for page navigation (Base.astro - already done!)
```

---

**Expected Impact:**
- Smoother animations without JavaScript
- Better mobile UX (proper viewport handling)
- Cleaner, more maintainable CSS
- Smaller JavaScript bundle
- Better color accuracy for extracted accents

---

## Phase 3: Visual Enhancements

### 3D Depth Parallax Effect

**Feature:** AI-generated depth maps enable a mouse-following 3D parallax hover effect on gallery images.

**Implementation:**
- **Opt-in:** `depth3d: true` in post frontmatter
- **Build-time:** Python script (`scripts/generate-depth-maps.py`) generates depth maps using Depth Anything V2 Small (ONNX)
  - Model auto-downloads to `scripts/models/` (~98MB)
  - Output: `public/images/depth/{name}.depth.png` (800px wide grayscale)
  - Manifest: `src/data/depth-manifest.json`
  - Part of `prebuild` npm script (gracefully skips if no Python venv)
- **Client-side:** `src/components/DepthImage.astro` — raw WebGL shader
  - Proximity-based activation (80px zone around image)
  - Cover-crop UV mapping matches CSS object-fit: cover
  - Mouse-following parallax with smooth lerp
  - Zoom scales 0–2% with proximity
  - Fallback: static OptimizedImage if no WebGL/JS/reduced-motion
- **Utility:** `src/utils/depthMap.ts` — manifest lookup
- **Deployment:** Depth maps committed to git (needed for Cloudflare). Generation is local-only.
- **Workflow:** Toggle depth3d in CMS → pull locally → build (runs generation) → commit → push

**Status:** Complete
**Completed:** Full implementation with proximity-based activation, WebGL shader, cover-crop UV mapping, lazy init, crossfade
**Effort:** 8-10 hours
**Priority:** P2 (Medium - differentiator feature)

---

### Feed Timeline Sidebar Polish

**Current State:** Timeline sidebar fully implemented with liquid glass styling

**Completed:**
1. **Max-width constraint** — timeline doesn't overlap image content
2. **Liquid glass styling** — backdrop-filter blur+saturate, layered box-shadows, ::before shimmer gradient, ::after illumination layer, compact typography
3. **Year/month navigation** — click-to-scroll, IntersectionObserver tracking
4. **Responsive** — hidden on mobile

**References:**
- https://codepen.io/mj-watts/pen/YPWBrqE (Glass displacement effect)
- https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl
- https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/
- https://css-tricks.com/getting-clarity-on-apples-liquid-glass/

---

### Feed Color Crossfade

**Feature:** Ambient glow that smoothly crossfades between post colors as you scroll through the feed.

**Implementation:** Two-layer opacity crossfade pattern — CSS can't interpolate `radial-gradient()` with changing CSS custom properties, so two pseudo-elements (`::before`/`::after`) alternate opacity via `transition: opacity 1s ease`. JS swaps colors on the hidden layer, then toggles visibility.

**Key Files:**
- `src/pages/feed.astro` — glow div, JS crossfade logic, CSS for two layers
- `src/components/PostCard.astro` — per-card glow removed in feed mode

**Status:** Complete
**Completed:** Full two-layer crossfade with IntersectionObserver tracking, `mix-blend-mode: screen`, `filter: blur(80px)`
**Effort:** 2 hours
**Priority:** P1 (High - major visual improvement)

---

### FilterBar Tag System & Search Expansion

**Feature:** Unified filter bar with multi-select tags, color filters, and expanded search.

**Completed:**
1. Tags pill in filter row opens sidebar overlay for multi-select
2. Selected tags appear as dynamic pills in the filter row
3. Search matches: title, tag slugs, localized tag labels, dates (month name + year + day)
4. Multi-color filter with secondary color support
5. URL params for deep linking (`?tag=`, `?colors=`)

**Key Files:**
- `src/components/FilterBar.astro` — all filter state, sidebar, search logic
- `src/components/GalleryImage.astro` — `data-date`, `data-tags`, `data-color-family` attributes
- `src/pages/gallery.astro` / `src/pages/fr/gallery.astro` — pass tags + labels to FilterBar

**Status:** Complete
**Effort:** 6-8 hours (across multiple sessions)
**Priority:** P1 (High - core UX feature)

---

### Bilingual Page Consolidation

**Problem:** EN/FR pages were fully duplicated (~500+ lines each), causing drift and bugs.

**Solution:** Extract shared components, pages become thin wrappers (~10 lines).

**Consolidated:**
- FeedPage.astro ← feed.astro + fr/feed.astro
- GalleryPage.astro ← gallery.astro + fr/gallery.astro
- HomePage.astro ← index.astro + fr/index.astro (merged: accent colors from FR + Schema.org from EN)
- AboutPage.astro ← about.astro + fr/about.astro (dropped dead imports from EN)
- PostPage.astro ← posts/[slug].astro + fr/posts/[slug].astro

**Bugs fixed during consolidation:**
- FR gallery had hardcoded `'fr-CA'` date locale → now conditional
- EN homepage missing accent colors, FR missing Schema.org → both included

**Status:** Complete
**Completed:** March 6, 2026
**Priority:** P1 (High - maintainability)

---

### Slideshow Flash Fix

**Problem:** Gallery → slideshow → "View Post" → back → slideshow briefly flashes stale content.

**Solution:**
- `initSlideshow()` force-resets all state (images, DOM, classes) on every page load/swap
- `openSlideshow()` updates image BEFORE showing overlay
- `closeSlideshow()` clears images array, caption, View Post button

**Status:** Complete
**Completed:** March 6, 2026

---

### Gallery Back Button Navigation

**Problem:** Post page back button always said "Back to feed" even when coming from gallery.

**Solution:**
- Slideshow "View Post" click sets `sessionStorage('navigatedFrom', 'gallery')`
- PostPage reads sessionStorage and adapts back button text/href
- `document.referrer` unreliable with View Transitions → sessionStorage is robust

**Status:** Complete
**Completed:** March 6, 2026

---

### Post Page Sticky Back Button

**Problem:** Back button scrolled away with the hero image.

**Solution:** `position: fixed` with `top: calc(var(--header-height) / 2); transform: translateY(-50%)` — centered in header bar.

**Status:** Complete
**Completed:** March 6, 2026

---

### Feed Expand Button Redesign

**Problem:** Clicking anywhere on feed image opened slideshow; button was opaque and mobile-only.

**Solution:**
- Feed image click blocked via JS `preventDefault` — only expand button triggers slideshow
- Liquid glass styling (translucent, blur, subtle border)
- Desktop: hidden, fades in on image hover. Mobile: always visible
- JS positioning with `getVisibleImageRect()` to handle `object-fit: contain` letterboxing on 16:9 images

**Status:** Complete
**Completed:** March 6, 2026

---

## Liquid Glass Implementation Guide

### Approach 1: Pure CSS (Recommended - Broad Browser Support)

Apple's liquid glass has 3 visual layers: **highlight**, **shadow**, and **illumination**.

```css
.feed__timeline {
  position: fixed;
  /* ... existing positioning ... */

  /* Base glass layer */
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(2px) saturate(180%);

  /* Liquid border - semi-transparent white */
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: var(--border-radius);

  /* Shadow layering: external depth + inset glow */
  box-shadow:
    0 8px 32px rgba(31, 38, 135, 0.2),
    inset 0 4px 20px rgba(255, 255, 255, 0.3);

  /* Safe positioning - don't overlap too much */
  max-width: 80px;
  right: var(--space-sm);
}

/* Pseudo-element shine effect (illumination layer) */
.feed__timeline::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: inherit;
  backdrop-filter: blur(1px);

  /* Inner light reflections */
  box-shadow:
    inset -10px -8px 0px -11px rgba(255, 255, 255, 1),
    inset 0px -9px 0px -8px rgba(255, 255, 255, 1);

  opacity: 0.6;
  z-index: -1;
  filter: blur(1px) drop-shadow(10px 4px 6px black) brightness(115%);
  pointer-events: none;
}

/* Shimmer animation */
@keyframes shimmer {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}

.feed__timeline::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    transparent 30%,
    rgba(255, 255, 255, 0.08) 50%,
    transparent 70%
  );
  border-radius: inherit;
  animation: shimmer 4s ease-in-out infinite;
  pointer-events: none;
}
```

**Key Property Breakdown:**
- `rgba(255, 255, 255, 0.15)` - Base transparency
- `backdrop-filter: blur(2px) saturate(180%)` - Blur + color boost
- `border: 1px solid rgba(255, 255, 255, 0.8)` - Bright edge highlight
- `brightness(115%)` - Enhances luminous quality
- Dual `inset` box-shadows create inner light reflections

---

### Approach 2: SVG Filter (Advanced Refraction - Chromium Only)

For true distortion/refraction effect like Apple's implementation:

```html
<!-- Add to page once, hidden -->
<svg style="display: none">
  <defs>
    <filter id="liquid-glass-timeline">
      <!-- Base blur -->
      <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blurred" />

      <!-- Noise for organic distortion -->
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.01"
        numOctaves="3"
        result="noise"
      />

      <!-- Displacement creates refraction -->
      <feDisplacementMap
        in="blurred"
        in2="noise"
        scale="15"
        xChannelSelector="R"
        yChannelSelector="G"
        result="displaced"
      />

      <!-- Boost saturation -->
      <feColorMatrix
        in="displaced"
        type="saturate"
        values="1.5"
        result="saturated"
      />

      <!-- Specular highlight -->
      <feSpecularLighting
        in="noise"
        surfaceScale="2"
        specularConstant="0.8"
        specularExponent="20"
        result="specular"
      >
        <fePointLight x="100" y="-50" z="200" />
      </feSpecularLighting>

      <!-- Blend specular with content -->
      <feComposite in="specular" in2="saturated" operator="arithmetic" k1="0" k2="1" k3="0.3" k4="0" />
    </filter>
  </defs>
</svg>
```

```css
/* Apply SVG filter with CSS fallback */
.feed__timeline {
  /* Fallback for Safari/Firefox */
  backdrop-filter: blur(2px) saturate(180%);

  /* Chromium: use SVG filter */
  @supports (filter: url(#liquid-glass-timeline)) {
    filter: url(#liquid-glass-timeline) brightness(150%);
  }
}
```

**SVG Filter Parameters:**
- `baseFrequency="0.01"` - Controls noise scale (lower = larger distortion)
- `numOctaves="3"` - Complexity of noise pattern
- `scale="15"` - Displacement intensity (15-55 range)
- `xChannelSelector="R", yChannelSelector="G"` - Use red/green for X/Y displacement

---

### Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| backdrop-filter | Yes | Yes (v103+) | Yes | Yes |
| SVG feDisplacementMap | Yes | Limited | No | Yes |
| feTurbulence | Yes | Yes | Yes | Yes |

**Recommendation:** Use Approach 1 (pure CSS) for production. Add SVG filter as progressive enhancement for Chromium users.

---

**Status:** Complete
**Completed:** Liquid glass styling applied - backdrop-filter blur+saturate, layered box-shadows, ::before shimmer gradient, ::after illumination layer, max-width constraint, compact typography
**Effort:** 1-2 hours
**Priority:** P1 (High - polish for recently added feature)

---

### Glass Effect (Cross-Browser)

**Decision:** Skip liquid glass SVG (Chrome-only), use enhanced CSS

**Implementation:**
```css
.glass-card {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.03)
  );
  backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 10px 40px rgba(0, 0, 0, 0.2);
}

.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('data:image/svg+xml;base64,...'); /* noise texture */
  opacity: 0.03;
  mix-blend-mode: overlay;
  pointer-events: none;
}

.glass-card::after {
  background: radial-gradient(
    circle at var(--mouse-x) var(--mouse-y),
    rgba(255,255,255,0.1),
    transparent
  );
  animation: shimmer 3s ease-in-out infinite;
}
```

**Where to Use:**
- Navigation bar
- Photo card overlays
- Lightbox backgrounds
- About page sections

**Research Note:** Liquid glass SVG documented at https://kube.io/blog/liquid-glass-css-svg/ (Chrome-only, skip for now)

**Status:** Complete
**Completed:** Glass effect applied to Header (full liquid glass with shimmer, illumination, glass-dot logo), Feed timeline sidebar, HomepageCarousel controls, ShareButton
**Effort:** 3-4 hours
**Priority:** P2 (Medium)

---

### CMS Color Preview & Adjustment

**Goal:** Preview and optionally adjust extracted colors directly in Sveltia CMS, without needing to build locally.

**Completed:**
1. Prebuild script (`scripts/extract-glow-colors.ts`) auto-extracts dominant color → writes hex to frontmatter
2. `glowColor` schema simplified from `{r,g,b,hex}` object to hex string
3. `glowColor` color picker added to all 3 CMS configs (main, EN, FR)
4. CMS preview pane shows only cover image (for eyedropping colors)
5. Field reorder: Cover Image first, colors next, rarely-used fields at bottom
6. Mtime-based caching with manifest (`src/data/glow-manifest.json`)
7. Manual CMS overrides preserved (script skips if image unchanged and glowColor exists)

**Status:** Complete
**Completed:** March 7, 2026
**Effort:** 4-5 hours
**Priority:** P2 (Medium - quality of life for content editing)

---

### Gradient Position Control

**Goal:** Per-post control over where the ambient glow gradients sit on screen.

**Current State:**
- Glow gradients use fixed positions (35% 30% for primary, 65% 70% for secondary)
- Same layout for every post regardless of image composition

**Planned:**
1. Add optional `glowPosition` frontmatter field (e.g., `top-left`, `center`, `bottom-right`, or custom x/y percentages)
2. CMS dropdown or coordinate picker
3. Feed crossfade and post page glow respect the position values
4. Default falls back to current positions if not specified

**Status:** Not Started
**Effort:** 2-3 hours
**Priority:** P3 (Low - fine-tuning, not critical)

---

### Gallery Aspect Ratio & Sizing Overhaul

**Goal:** Expand gallery size options with proper aspect ratios and two prominence levels per ratio. Fix `auto` to use the image's native aspect ratio instead of bucketing into 3 categories.

**Current State:**
- `gallerySize`: `auto`, `small` (1×1), `portrait` (1×2), `portrait-tall` (1×3), `landscape` (2×1), `featured` (2×2)
- `auto` detection is too coarse: < 0.85 → portrait, > 1.2 → landscape, else → square
- All images forced into `aspect-ratio: 3/4` container with `object-fit: cover` — crops everything
- No 1:1, 4:5, 3:2, 16:9 options

**New Options (each ratio has regular + prominent):**

| Ratio | Regular (1 col) | Prominent (multi-span) |
|-------|-----------------|----------------------|
| 1:1 | `square` (1×1) | `square-lg` (2×2) |
| 4:5 | `portrait-4x5` (1×1, 4:5 ratio) | `portrait-4x5-lg` (1×2 span) |
| 3:4 | `portrait-3x4` (1×1, 3:4 ratio) | `portrait-3x4-lg` (1×2 span) |
| 2:3 | `portrait-2x3` (1×1, 2:3 ratio) | `portrait-2x3-lg` (1×3 span) |
| 3:2 | `landscape-3x2` (1×1, 3:2 ratio) | `landscape-3x2-lg` (2×1 span) |
| 16:9 | `landscape-16x9` (1×1, 16:9 ratio) | `landscape-16x9-lg` (2×1 span) |
| Auto | Use native aspect ratio, 1 col | — |

**Key Changes:**
1. Each cell has its own CSS `aspect-ratio` matching the chosen ratio — no more forced 3:4 for everything
2. "Prominent" variants span extra grid cells for visual emphasis
3. `auto` fallback: use the actual image dimensions from `getOptimizedImage()` to set `aspect-ratio` dynamically — no cropping
4. Update schema, CMS configs (all 3), and GalleryImage/GalleryPage components
5. Mobile: all images use their chosen ratio in a single column (no spanning)

**Status:** Not Started
**Effort:** 4-6 hours
**Priority:** P2 (Medium - important for gallery presentation)

---

### Color Wheel Discovery ("Spin to Discover")

**Goal:** A playful discovery feature — spin a hue-based color wheel/ring, watch it animate to a random landing, and get redirected to a random image matching that color family.

**Concept:**
- Visual color wheel using a conic gradient mapped to the 360° hue spectrum
- Segments correspond to color families (red, orange, yellow, green, teal, blue, purple, pink)
- User taps "spin" → wheel animates with deceleration easing → lands on a color
- Redirects to a random gallery image matching that color family
- Could live as a standalone page (`/discover`) or a modal triggered from gallery

**Technical Approach:**
1. Conic gradient ring via CSS `conic-gradient()` with segments matching `getColorFamily()` boundaries
2. CSS rotation animation with cubic-bezier easing for realistic deceleration
3. JS picks random target angle, maps to color family, selects random image from that family
4. View Transition or crossfade animation to the selected image's post page

**Status:** Not Started
**Effort:** 4-6 hours
**Priority:** P3 (Low - fun discovery feature, not critical)

---

### Gallery Mosaic Curation

**Goal:** Control the first 6-12 tiles in the gallery grid via CMS, so the initial view is always curated.

**Current State:**
- Gallery shows all images sorted by date
- No control over which images appear first or how they're arranged
- Masonry grid auto-fills based on orientation metadata

**Planned:**
1. Add a "Featured Gallery" file collection in CMS with ordered image references
2. Gallery pages render featured images first, then remaining by date
3. Optional: featured images get special sizing (e.g., always landscape-span or hero-size)
4. Drag-and-drop ordering in CMS if Sveltia supports it

**Status:** Not Started
**Effort:** 4-6 hours
**Priority:** P2 (Medium - important for first impressions)

---

## Phase 4: Business Architecture

### Multi-Template System

**Current Structure (Personal):**
```
/content/posts/
/public/images/
/src/components/
```

**Template Structure (Business):**
```
/templates/
  ├── minimal/          # Current design
  ├── bold/            # High-contrast variant
  ├── editorial/       # Magazine-style
  └── gallery-focus/   # Minimal text, max images

/shared/
  ├── components/      # Reusable across templates
  └── utils/          # Color extraction, etc.

/client-config/
  └── config.yaml     # Branding, colors, fonts
```

**Status:** Not Started  
**Effort:** 1-2 weeks  
**Priority:** P3 (Low - after validation)

---

### Data Sovereignty Features

**Export Script:**
```javascript
// npm run export-data
import fs from 'fs';
import { getCollection } from 'astro:content';

const posts = await getCollection('posts');

fs.writeFileSync('content-export.json', JSON.stringify(posts, null, 2));
fs.writeFileSync('analytics-export.csv', generateCSV(analytics));
// Copy all images to export folder
```

**Git-Based Ownership:**
- Client owns GitHub repo
- Template as npm package or submodule
- Can fork/modify/leave anytime

**Status:** Not Started  
**Effort:** 1 week  
**Priority:** P3 (Low - after validation)

---

### Setup Automation (CLI Tool)

**Vision:**
```bash
npx create-photo-portfolio

# Prompts:
# - Name, bio, social links
# - Color preferences
# - Template choice
# - Deploy target (Cloudflare/Netlify/Vercel)

# Generates:
# - Custom repo in their GitHub
# - Pre-configured Decap CMS
# - Deployment pipeline
# - Documentation
```

**Status:** Not Started  
**Effort:** 2-3 weeks  
**Priority:** P3 (Low - after validation)

---

### CMS for Non-Technical Users

**Status:** Complete - Sveltia CMS deployed with GitHub OAuth

**Current Configuration:**
- Backend: GitHub OAuth via Cloudflare Pages Functions
- Bilingual interface: English (`/admin/en/`) and French (`/admin/fr/`)
- Image uploads to `public/images/uploads`
- Auto-deploy on commit via GitHub Actions

**Key Features Working:**
- Create/edit/delete posts from browser or mobile
- GitHub authentication (no Netlify Identity needed)
- Bilingual field support (en/fr objects)
- Tag management
- Image focal point control
- Homepage carousel and featured flags

---

## Phase 5: Commerce Layer (Optional)

**Architecture:**
```
Portfolio (static, client-owned)
    ↓
Commerce API (hosted service, optional $49/mo)
    ├── Stripe integration
    ├── Printful/WHCC fulfillment
    ├── Order management
    └── Email notifications
```

**Business Model:**
- Portfolio: $799 one-time (own forever)
- Commerce: $49/month (only when selling)

**Status:** Not Started  
**Effort:** 3-6 months  
**Priority:** P4 (Future - needs validation first)

---

## Tech Stack

**Current:**
- Astro 5 (static generation)
- Sveltia CMS (Git-based editing via GitHub OAuth)
- Sharp (image processing)
- Cloudflare Pages (hosting + OAuth Functions)
- TypeScript (type safety)
- Tailwind CSS (styling)

**Future (Business):**
- Turborepo (monorepo for templates)
- GitHub API (repo creation automation)
- Stripe (commerce payments)
- Cloudflare Workers (API endpoints)

---

## Resources

**Development:**
- Astro Docs: https://docs.astro.build
- Sharp: https://sharp.pixelplumbing.com
- Sveltia CMS: https://github.com/sveltia/sveltia-cms

**Distribution:**
- Buttondown: https://buttondown.email
- Webmention.io: https://webmention.io
- Bridgy Fed: https://fed.brid.gy

**Testing:**
- OpenGraph: https://www.opengraph.xyz
- Twitter Cards: https://cards-dev.twitter.com/validator
- Facebook Debugger: https://developers.facebook.com/tools/debug/

---

## Document Updates

**How to Update This Plan:**

When we discuss new features/changes:
1. I'll use `str_replace` to update specific sections
2. You'll see exactly what changed
3. No regenerating the entire document
4. Git tracks all changes

**Update Log:**
- 2026-02-16: Initial creation with Phases 1-5
- 2026-02-16: Added Open Graph optimization section
- 2026-02-16: Added color-based filtering feature (Phase 2)
- 2026-02-16: Added Astro 5.17 upgrade task (Phase 1)
- 2026-02-16: Added Phase 2.5 - Mobile CMS & Offline Support
- 2026-02-16: Added Video Post Support (YouTube/Vimeo integration)
- 2026-02-16: Added site settings collections (no-code control)
- 2026-02-16: Added quick-posts workflow for mobile
- 2026-02-16: Added editorial workflow for offline posting
- 2026-02-16: Added PWA configuration for installable CMS
- 2026-02-16: Updated This Week's Sprint with mobile priorities
- 2026-02-16: Expanded Ideas Parking Lot with new concepts
- 2026-02-25: Added Phase 2.75 - Modern CSS Upgrades (aspect-ratio, OKLCH, scroll animations, container queries, view transitions)
- 2026-02-25: Status audit - marked completed items (image opt, OG tags, security headers, RSS, newsletter, view transitions)
- 2026-02-25: Updated sprint priorities - Schema.org and Modern CSS now current focus
- 2026-02-25: Implemented Color-Based Filtering (extractColors.ts, FilterBar.astro, GalleryImage.astro, gallery.astro)
- 2026-02-26: **Migrated from Decap CMS to Sveltia CMS** - GitHub OAuth via Cloudflare Pages Functions, updated all CMS references
- 2026-02-26: Updated local development workflow - Sveltia uses File System Access API (no proxy server needed)
- 2026-02-26: Marked CMS setup as complete with bilingual support and auto-deploy
- 2026-03-01: Added Feed Timeline Sidebar Polish task (limit overlap + liquid glass styling)
- 2026-03-03: Implemented 3D Depth Parallax effect (DepthImage.astro, generate-depth-maps.py, depthMap.ts, depth-manifest.json)
- 2026-03-03: Status audit — marked complete: Astro upgrade (5.17.3), Glass Effect (Header/Feed/Carousel), Feed Timeline Sidebar
- 2026-03-03: Updated Secondary Color Support — schema/CMS done, visual glow effects still pending
- 2026-03-03: Updated Preloading Strategy — partially complete (carousel preload done, hero preload missing)
- 2026-03-04: Added Feed Color Crossfade (completed) — two-layer opacity crossfade for ambient glow
- 2026-03-04: Added FilterBar Tag System & Search Expansion (completed) — multi-select tags, date/label search
- 2026-03-04: Added CMS Color Preview & Adjustment task (Phase 3)
- 2026-03-04: Added Gradient Position Control task (Phase 3)
- 2026-03-04: Added Gallery Mosaic Curation task (Phase 3)
- 2026-03-04: Enhanced Liquid Glass header — scroll-reactive blur (12→24px), dynamic shimmer animation, prismatic edge refraction, edge dissolution fade zone
- 2026-03-04: Applied liquid glass styling to FilterBar — glass pills with backdrop-blur, inset highlights, color-tinted glass for color swatches, glass search input, glass tag sidebar
- 2026-03-07: Completed CMS Color Preview & Adjustment — prebuild extraction script, glowColor schema simplified to hex, color picker in all CMS configs, preview pane shows only cover image
- 2026-03-07: Completed bilingual page consolidation (HomePage, FeedPage, GalleryPage, AboutPage, PostPage)
- 2026-03-07: Added Upcoming Features section: Bulk Import Script (+ platform importers), AI Auto-Tagging, Private Gallery, Comment Section
- 2026-03-08: Added Image Sharing & Canonical Source (P1 — site as single image source, copy URL, size picker, download with copyright)
- 2026-03-08: Added Gallery Aspect Ratio & Sizing Overhaul (P2 — proper ratios with regular + prominent levels, fix auto to use native ratio)
- 2026-03-08: Marked Color-Based Filtering as Complete (was already implemented)
- 2026-03-08: Added EXIF display, overrides, exifSummary CMS field, dateTaken CMS field

---

## Upcoming Features

### Bulk Import Script

**Goal:** CLI script to import a folder of images into the site in one command, enabling quick site setup with a different image base (template reuse).

**Workflow:**
1. Drop images into a folder
2. Run import script → copies to `public/images/uploads/`, generates `.md` posts with minimal frontmatter
3. `npm run prebuild` auto-populates colors, optimized images, depth maps
4. Review/adjust in CMS

**Platform Importers:**
- **WordPress** (WXR/XML export) — parse posts, dates, tags/categories, featured images, body content
- **Squarespace** (XML export) — similar structure
- **Smugmug/Flickr** (API) — download media, extract metadata

**Key Challenges:**
- Download media, rewrite image URLs to local paths
- HTML → Markdown conversion (via `turndown`)
- Map source categories/tags to site's tag vocabulary

**Status:** Not Started
**Effort:** 8-12 hours (basic), 20+ hours (with platform importers)
**Priority:** P2 (Medium - enables template product)

---

### AI Auto-Tagging

**Goal:** Vision API classifies images against the site's tag vocabulary for automated tagging.

**Approach:**
- Use Claude or OpenAI Vision API — send image + list of existing tags → get suggested tags
- Runs during bulk import or as standalone prebuild step
- Maps AI output to existing tags in `src/data/tags/` for consistency

**Use Cases:**
- Great for niche portfolios (wildlife: species, habitat; street: urban, night, etc.)
- Bulk import of hundreds of images without manual tagging
- User reviews/adjusts in CMS after — AI provides first pass, human refines

**Status:** Not Started
**Effort:** 4-6 hours
**Priority:** P2 (Medium - high value for bulk import workflow)

---

### Private Gallery

#### Phase 1 — Quick win (no code)
- Protect `/gallery/private` route using **Cloudflare Access**
  - Options: email OTP, shared passcode, or Google login
  - Free tier, zero Astro changes needed

#### Phase 2 — Optional: in-page password prompt
- Enable Astro **hybrid/SSR output** for protected routes
- Add middleware to check cookie, gate the page
- Show password form → set cookie on success

**Status:** Not Started
**Effort:** Phase 1: 30 min, Phase 2: 4-6 hours
**Priority:** P3 (Low - future feature)

---

### Comment Section

#### Phase 1 — Giscus (ship fast)
- Install Giscus on post pages
  - Powered by GitHub Discussions
  - Drop-in `<script>` tag, works with static Astro
  - Free, no ads, spam-resistant (requires GitHub account)

#### Phase 2 — Cloudflare D1 + Pages Functions (anonymous comments)
- Create **D1 database** with `comments` table
  - Columns: `id`, `post_slug`, `author_name`, `message`, `timestamp`, `approved`
- Write **Pages Function** endpoints
  - `POST /api/comments` — submit a comment
  - `GET /api/comments?slug=...` — fetch approved comments for a post
- Add **Cloudflare Turnstile** on the comment form (free, invisible CAPTCHA)
- Add **honeypot field** to the form (hidden input, reject if filled)
- Implement **IP rate limiting** via Cloudflare KV
  - Store `ip → count` with TTL, reject above threshold
- Sanitize all input server-side before writing to D1
- Escape all comment output (never render raw HTML)

#### Phase 3 — Moderation
- Comments default to `approved = false`
- Build small admin route to approve/reject comments
- Protect admin route with **Cloudflare Access**
- Set up **new comment notifications** via Resend or Mailchannels

**Note:** Phase 2 stack is **100% free** (D1, KV, Functions, Turnstile all on CF free tier)

**Status:** Not Started
**Effort:** Phase 1: 30 min, Phase 2: 8-12 hours, Phase 3: 4-6 hours
**Priority:** P3 (Low - future feature)

---

## Ideas Parking Lot

**Future Considerations (Not Prioritized Yet):**

**Distribution & Discovery:**
- ActivityPub/Fediverse integration (Pixelfed, Mastodon)
- Webmentions for decentralized interactions
- Guest blogging strategy
- Photography directory submissions
- Community photo challenges (#30DayChallenge)

**Content Features:**
- Video time-lapse support
- EXIF data display on photos
- Color palette extraction showcase (interactive)
- Behind-the-scenes newsletter series
- Photo-a-day automation

**Mobile & Posting:**
- iOS Shortcut for quick posting via GitHub API
- Email-to-Git posting (Zapier integration)
- Custom mobile native app (long-term)
- Working Copy app deep linking

**Business Features:**
- Print sales integration (Printful/WHCC)
- Client proofing galleries (password-protected)
- Client selection/favoriting system
- High-res download delivery system
- Automatic watermarking options
- Photography workshop/course platform
- Multi-photographer collaboration
- Integration with stock photography platforms

**Advanced Tech:**
- Dynamic OG image generation with Sharp
- Liquid glass SVG effects (Chrome-only, deprioritized)
- AI-powered image tagging
- Automatic alt-text generation
- Smart cropping for thumbnails

---

**End of Roadmap**
