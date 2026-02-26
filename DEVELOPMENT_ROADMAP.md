# Photography Portfolio Development Roadmap

**Last Updated:** February 25, 2026  
**Project:** gphoto.pages.dev  
**Purpose:** Personal portfolio → Template business foundation

---

## 🎯 Project Vision

**Personal Goal:** Build a fast, beautiful photography portfolio with data sovereignty  
**Business Goal:** Template product for photographers ($799 one-time, no subscriptions)  
**Core Principle:** Own your content, own your code, own your future

---

## 📋 Phase 1: Performance & Core UX (CURRENT)

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

**Status:** ✅ Complete
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

**Status:** ✅ Complete
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

**Status:** ✅ Complete
**Completed:** Full headers in public/_headers with CSP, frame-src for video embeds, CMS exception
**Effort:** 15 minutes
**Priority:** P1 (High)

---

### Astro Version Upgrade

**Current Status:** Unknown (check `package.json`)  
**Latest Version:** Astro 5.17 (released Jan 29, 2026)

**Why Upgrade:**
- Image background color control (white instead of black for JPEG conversions)
- Sharp kernel selection (fine-tune image quality for photography)
- Async file parsing for content loaders
- Bug fixes and performance improvements

**New Features Relevant to Photography Portfolio:**

**1. Background Color for Images:**
```astro
<Image 
  src={myImage} 
  format="jpeg" 
  background="white"  // No more black backgrounds
  alt="Product" 
/>
```

**2. Sharp Kernel Selection:**
```javascript
// astro.config.mjs
export default defineConfig({
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        kernel: 'mks2021'  // Options: lanczos3 (default), mks2021, cubic, etc.
      }
    }
  }
})
```

**Kernel options for photography:**
- `lanczos3` (default): Good all-around quality
- `mks2021`: Sharper edges, good for detail-heavy photos
- `cubic`: Smoother, good for portraits

**Upgrade Process:**

**1. Check current version:**
```bash
cat package.json | grep "astro"
# or
npm list astro
```

**2. Upgrade (recommended automated method):**
```bash
npx @astrojs/upgrade
```

**3. Manual upgrade if needed:**
```bash
npm install astro@latest
# or
pnpm upgrade astro --latest
```

**4. Testing checklist:**
```bash
# After upgrade, test:
- [ ] Dev server starts (`npm run dev`)
- [ ] Build completes (`npm run build`)
- [ ] Preview works (`npm run preview`)
- [ ] Image optimization still works
- [ ] Decap CMS still loads
- [ ] View transitions working
- [ ] Color extraction still functional
- [ ] Bilingual routing intact
```

**5. Check changelog for breaking changes:**
https://github.com/withastro/astro/blob/main/packages/astro/CHANGELOG.md

**When to Upgrade:**
- **If on 5.x:** Safe to upgrade anytime (minor version)
- **If on 4.x:** Wait until after image optimization work
- **Best timing:** After completing core features, before deployment

**Status:** ⏳ Not Started  
**Effort:** 30 minutes (upgrade + testing)  
**Priority:** P1 (High - do before image optimization work)

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

**Status:** ⏳ Not Started  
**Effort:** 1-2 hours  
**Priority:** P2 (Medium)

---

## 📋 Phase 2: Distribution & Discovery

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

**Status:** ✅ Complete
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

**Status:** ✅ Complete
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

**Status:** ⏳ Not Started  
**Effort:** 1 hour  
**Priority:** P1 (High)

---

### Download with Attribution

**Feature:**
```javascript
async function downloadWithAttribution(imageUrl, title) {
  // Add "© Gabriel Mercier | gphoto.pages.dev" watermark
  // OR inject EXIF copyright data
  // Copy URL to clipboard for tracking
  
  navigator.clipboard.writeText(`${window.location.href}?ref=download`);
}
```

**Purpose:** Let people share your work with attribution baked in

**Status:** ⏳ Not Started  
**Effort:** 2-3 hours  
**Priority:** P2 (Medium)

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

**Status:** ⏳ Not Started  
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

**Status:** ⏳ Not Started  
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
    <button data-mood="light">☀️ Light</button>
    <button data-mood="balanced">🌤️ Balanced</button>
    <button data-mood="dark">🌙 Dark</button>
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

**Status:** ✅ Complete
**Completed:** extractColors.ts extended with colorFamily/mood, FilterBar with color pills, GalleryImage with data attributes
**Effort:** 4-6 hours (color extraction + UI)
**Priority:** P2 (Medium - high UX value, not critical path)

**Implementation Notes:**
- Uses existing glowColor RGB values (no extra extraction needed)
- Color families: red, orange, yellow, green, blue, purple, neutral
- Mood detection: light (>60% lightness), dark (<40%), balanced
- URL params supported: ?color=blue for deep linking

---

## 📋 Phase 2.5: Mobile CMS & Offline Support

### Mobile-Optimized Decap CMS

**Problem:** 
- Current CMS interface not optimized for mobile
- Hard to post from phone
- No offline support
- Too many fields for quick posting

**Solution: Multi-tier CMS configuration**

**1. Quick Post Collection (Mobile-First):**
```yaml
# Minimal fields for fast mobile posting
collections:
  - name: "quick-posts"
    label: "📱 Quick Post"
    editor:
      preview: false  # Saves screen space
    fields:
      - {label: "📷 Photo", name: "coverImage", widget: "image"}
      - {label: "✏️ Title", name: "title", widget: "string"}
      - {label: "📝 Caption", name: "caption", widget: "text", required: false}
      - {label: "📍 Location", name: "location", widget: "string", required: false}
      - {label: "🏷️ Tags", name: "tags", widget: "list"}
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

**Status:** ⏳ Not Started  
**Effort:** 4-6 hours  
**Priority:** P1 (High - enables mobile workflow)

---

### Offline Support

**Three approaches:**

**1. Editorial Workflow (Built-in):**
```yaml
publish_mode: editorial_workflow
# Creates Draft → Review → Ready workflow
# Saves drafts to localStorage when offline
```

**Workflow:**
- Create post offline → Saved as Draft
- Internet reconnects → Move to Ready
- Publish → Commits to Git

**2. Progressive Web App (PWA):**
```javascript
// Service Worker for offline CMS
const CACHE_NAME = 'decap-cms-v1';
const urlsToCache = ['/admin/', '/admin/index.html'];

// Cache CMS files for offline use
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});
```

**PWA Manifest:**
```json
{
  "name": "Photography CMS",
  "short_name": "Photo CMS",
  "start_url": "/admin/",
  "display": "standalone",
  "icons": [...]
}
```

**Result:** Install CMS as app on phone home screen, works offline

**3. Local Backend (Testing):**
```yaml
local_backend: true
# Run: npx decap-server
# CMS works 100% offline on local network
```

**Status:** ⏳ Not Started  
**Effort:** 3-4 hours  
**Priority:** P1 (High - critical for mobile)

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

**Status:** ⏳ Not Started  
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

**Status:** ⏳ Not Started  
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

**Status:** ⏳ Not Started  
**Effort:** 1-2 hours  
**Priority:** P2 (Medium)

---

### Mobile Workflow Testing Checklist

```
✅ Access https://gphoto.pages.dev/admin/ on phone
✅ Login with GitHub
✅ Create quick post with photo from camera roll
✅ Test offline mode (airplane mode)
✅ Verify draft saves locally
✅ Reconnect, move draft to Ready
✅ Publish and verify on site
✅ Toggle feature in settings
✅ Verify feature appears/disappears on site
✅ Test navigation editing
✅ Add to home screen (PWA)
✅ Test offline posting from installed app
```

**Expected Results:**
- Post from phone in <2 minutes
- Works offline, syncs when online
- Toggle features without code
- Edit navigation without code
- Install as native app

---

## 📋 Phase 2.75: Modern CSS Upgrades

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

**Status:** ⏳ Not Started
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

**Status:** ⏳ Not Started
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

**Status:** ⏳ Not Started
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
- [ ] Add text-wrap: balance to headings
- [ ] Replace transform with independent scale/translate
- [x] Use inset: 0 for overlays and positioned elements (PostCard.astro)
```

**Medium Priority:**
```
- [ ] Upgrade color extraction to OKLCH
- [ ] Implement color-mix for dynamic overlays
- [ ] Add scroll-linked animations to gallery
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

## 📋 Phase 3: Visual Enhancements

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

**Status:** ⏳ Not Started  
**Effort:** 3-4 hours  
**Priority:** P2 (Medium)

---

## 📋 Phase 4: Business Architecture

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

**Status:** ⏳ Not Started  
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

**Status:** ⏳ Not Started  
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

**Status:** ⏳ Not Started  
**Effort:** 2-3 weeks  
**Priority:** P3 (Low - after validation)

---

### CMS for Non-Technical Users

**Decap CMS Configuration:**
```yaml
# /public/admin/config.yml
backend:
  name: git-gateway
  branch: main

media_folder: "public/images/uploads"
public_folder: "/images/uploads"

collections:
  - name: "posts"
    label: "Photos"
    folder: "src/content/posts"
    create: true
    fields:
      - {label: "Title (English)", name: "title_en", widget: "string"}
      - {label: "Title (Français)", name: "title_fr", widget: "string"}
      - {label: "Cover Image", name: "coverImage", widget: "image"}
      - {label: "Description (EN)", name: "description_en", widget: "text"}
      - {label: "Description (FR)", name: "description_fr", widget: "text"}
      - {label: "Location", name: "location", widget: "string"}
      - {label: "Tags", name: "tags", widget: "list"}
```

**Status:** ⏳ Not Started  
**Effort:** 1 week  
**Priority:** P3 (Low - after validation)

---

## 📋 Phase 5: Commerce Layer (Optional)

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

**Status:** ⏳ Not Started  
**Effort:** 3-6 months  
**Priority:** P4 (Future - needs validation first)

---

## 🎯 Success Metrics

### Personal Site (Current Month)
- [ ] LCP < 1s on mobile
- [ ] 100/100 Lighthouse performance
- [ ] OpenGraph score: 90+/100
- [ ] RSS subscribers: 10
- [ ] Email subscribers: 25
- [ ] 5 webmentions from other sites

### Business Validation (Month 2)
- [ ] 50+ landing page signups
- [ ] 10 beta testers committed
- [ ] 5 completed beta sites
- [ ] $2,000 in beta revenue
- [ ] 3 testimonials/case studies

### Business Launch (Month 6)
- [ ] 25 paying customers ($799 setup)
- [ ] 10 managed hosting ($20/mo)
- [ ] 5 commerce tier ($49/mo)
- [ ] $20K+ revenue
- [ ] 4.5+ star reviews

---

## 📅 This Week's Sprint (Feb 25 - Mar 3)

**Phase 1 Status - Core Performance (COMPLETE):**
1. ✅ Image optimization (OptimizedImage.astro + build script)
2. ✅ Open Graph meta tags (built into Base.astro)
3. ✅ Security headers (public/_headers)
4. ✅ RSS feed (src/pages/rss.xml.ts)
5. ✅ Email newsletter signup (NewsletterSignup.astro)
6. ✅ View transitions (Base.astro)
7. ✅ Color extraction (extractColors utility)

**Current Priority - Schema.org & Modern CSS:**
1. ⏳ Structured data (Schema.org) for posts - 1hr
2. ⏳ Add text-wrap: balance to headings - 15min
3. ⏳ Independent transforms for hover effects - 30min
4. ⏳ OKLCH color upgrade for extraction - 2hrs
5. ⏳ Scroll-linked animations for gallery - 1hr

**Phase 2.5 - Mobile CMS (Pending):**
6. ⏳ Quick-posts collection in CMS config - 1hr
7. ⏳ Settings JSON files (features, homepage, nav) - 1hr
8. ⏳ PWA manifest for installable CMS - 30min

**Stretch Goals:**
- Container queries for responsive gallery
- Color-mix for dynamic overlays
- Preloading strategy

**Total Remaining Effort:** ~8-10 hours

**Achieved Outcomes:**
- ✅ Modern image formats (AVIF/WebP)
- ✅ Full OG/Twitter Card support
- ✅ RSS + Newsletter ready
- ✅ View transitions working
- ✅ Dynamic color theming
- ✅ Color-based gallery filtering (by color family)

---

## 🛠️ Tech Stack

**Current:**
- Astro 5 (static generation)
- Decap CMS (Git-based editing)
- Sharp (image processing)
- Cloudflare Pages (hosting)
- TypeScript (type safety)
- Tailwind CSS (styling)

**Future (Business):**
- Turborepo (monorepo for templates)
- GitHub API (repo creation automation)
- Stripe (commerce payments)
- Cloudflare Workers (API endpoints)

---

## 📚 Resources

**Development:**
- Astro Docs: https://docs.astro.build
- Sharp: https://sharp.pixelplumbing.com
- Decap CMS: https://decapcms.org

**Distribution:**
- Buttondown: https://buttondown.email
- Webmention.io: https://webmention.io
- Bridgy Fed: https://fed.brid.gy

**Testing:**
- OpenGraph: https://www.opengraph.xyz
- Twitter Cards: https://cards-dev.twitter.com/validator
- Facebook Debugger: https://developers.facebook.com/tools/debug/

---

## 🔄 Document Updates

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

---

## 💡 Ideas Parking Lot

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
