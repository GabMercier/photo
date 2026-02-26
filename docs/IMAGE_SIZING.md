# Image Sizing Reference

Quick reference for controlling image sizes in PostCard and feed/gallery layouts.

---

## Key Concepts

### `max-*` vs actual values

| Property | Behavior |
|----------|----------|
| `max-width: 500px` | Image can be UP TO 500px, but if natural size is 300px, it stays 300px |
| `width: 500px` | Image IS 500px (or scales proportionally with object-fit) |
| `height: 80vh` | Image IS 80% of viewport height |

**Rule:** To make images bigger, set actual `width` or `height`, not just `max-*` ceilings.

---

## PostCard Modes

### Feed Mode (`layout="feed"`)

Full-viewport scroll-snap experience. Images are centered and sized to dominate the screen.

**Current settings** (in `PostCard.astro`):

```css
/* Base - applies to ALL feed images */
.post-card--feed .post-card__image-wrap :global(img) {
  height: 80vh;        /* Forces 80% of viewport height */
  width: auto;         /* Width scales proportionally */
  object-fit: contain; /* Never crops, maintains aspect ratio */
}

/* Portrait images - constrain width so they don't get too wide */
.post-card--feed.post-card--portrait ... {
  max-width: min(90vw, 900px);
}

/* Landscape images - can be wider */
.post-card--feed.post-card--landscape ... {
  max-width: min(95vw, 1300px);
}
```

**To adjust feed image size:**
- Change `height: 80vh` to increase/decrease (e.g., `85vh` for bigger)
- The width auto-scales to maintain aspect ratio

### Grid Mode (`layout="grid"`)

Gallery/grid view with portrait 3:4 cards.

**Current settings:**

```css
/* Portrait variant - fixed aspect ratio container */
.post-card--portrait .post-card__image-wrap {
  aspect-ratio: 3 / 4;
  overflow: hidden;
}

/* Image fills container and crops to fit */
.post-card--portrait .post-card__image-wrap :global(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;  /* Crops to fill */
  object-position: var(--focal-point, center center);
}
```

**To adjust grid card size:**
- Change grid column sizes in `gallery.astro`:
  ```css
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  ```
- Aspect ratio is controlled by `aspect-ratio: 3 / 4` on `.post-card__image-wrap`

---

## object-fit Explained

| Value | Behavior |
|-------|----------|
| `contain` | Fits entire image, may leave empty space (letterboxing) |
| `cover` | Fills container, crops excess (no empty space) |

- **Feed uses `contain`** - shows full image, no cropping
- **Grid uses `cover`** - fills card, crops to aspect ratio

---

## Focal Point (for cropping)

When `object-fit: cover` crops an image, `object-position` controls what part is visible.

Set in frontmatter:
```yaml
coverImage:
  src: /images/photo.jpg
  focalPoint: left  # Options: left, center, right
```

Maps to CSS:
- `left` → `object-position: left center`
- `center` → `object-position: center center`
- `right` → `object-position: right center`

---

## Mobile Overrides

Mobile styles are in the `@media (max-width: 768px)` block.

**Feed on mobile:**
```css
.post-card--feed.post-card--portrait .post-card__image-wrap :global(img) {
  max-width: 95vw;
  height: 80vh;
}
```

**Gallery on mobile:**
- Landscape images are cropped to portrait (3:4) using focal point
- See the mobile media query section for details

---

## Quick Fixes

| Problem | Solution |
|---------|----------|
| Images too small in feed | Increase `height: 80vh` to `85vh` or higher |
| Images too big in feed | Decrease `height: 80vh` to `70vh` |
| Grid cards wrong size | Adjust `minmax(240px, 1fr)` in gallery grid |
| Wrong part of image showing | Set `focalPoint` in frontmatter |
| Image squished/stretched | Check `object-fit` is set correctly |
| Changes not visible | `max-*` only sets ceiling - use actual `width`/`height` |

---

## File Locations

- **PostCard styles:** `src/components/PostCard.astro` (lines 358-375 for feed, 160-180 for grid)
- **Gallery grid:** `src/pages/gallery.astro` (lines 66-89)
- **Feed container:** `src/pages/feed.astro` (lines 84-106)
