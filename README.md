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

- **Astro 5** — Static site generation
- **Sveltia CMS** — Git-based visual editor
- **Sharp** — Image processing & color extraction
- **View Transitions API** — Smooth navigation

## Development

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

## License

MIT
