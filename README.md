# Photography Portfolio

A bilingual photography portfolio built with Astro. Features dynamic color theming, a visual CMS, and smooth page transitions.

## Features

**Bilingual (EN/FR)** — Full i18n support with locale-aware routing and content

**Dynamic Theming** — Accent colors extracted from images at build time, ambient glow effects

**Visual CMS** — Sveltia CMS with separate EN/FR interfaces for content management

**Gallery Views** — Grid gallery with tag filtering, feed view, and homepage carousel

**Image Series** — Support for single images or multi-image series with slideshow

**Performance** — Static site generation, optimized images, minimal JavaScript

## Tech Stack

- **Astro 7** — Static site generation
- **Sveltia CMS** — Git-based visual editor
- **Sharp** — Image processing & color extraction
- **View Transitions API** — Smooth navigation

## Development

Requires Node 22.23 or newer (see `.nvmrc`; with nvm, run `nvm use` in the project folder).

```bash
npm install
npm run dev          # Start dev server (localhost:4321)
```
Open the admin at 
http://localhost:4321/admin/en/index.html

## Content Structure

Posts support bilingual titles, descriptions, and alt text:

```yaml
title:
  en: "Morning Light"
  fr: "Lumière du matin"
coverImage:
  src: "/images/uploads/photo.jpg"
  alt:
    en: "Description in English"
    fr: "Description en français"
```

Where a photo was made and which body of work it belongs to:

```yaml
location:
  name: "Quai de Baie-Saint-Paul"   # spot, as written
  city: "Baie-Saint-Paul"
  region: "Québec"
  country: CA                       # ISO code, translated at build time
project: charlevoix-2025            # src/content/projects/charlevoix-2025.md
```

Projects group posts across time (a trip, a place, a series) and get their own
pages at `/projects`. Posts with several images are a different thing
(`postType: series`).

## Importing a folder of photos

```bash
npm run import -- ~/Pictures/export/charlevoix --project charlevoix-2025 --dry-run
```

Reads Lightroom's title, caption, keywords, location and alt text from the
JPEGs, resizes them to 2400 px, writes the posts and runs the prebuild. See
[docs/IMPORT.md](docs/IMPORT.md).

## License

MIT
