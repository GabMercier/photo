// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Replace with your actual domain when ready
  site: 'https://gphoto.pages.dev',

  // Astro 7 changed the default to 'jsx' whitespace handling. Keep the
  // HTML-aware compression that previous versions used so inline spacing
  // in templates is unchanged.
  compressHTML: true,

  vite: {
    build: {
      // Astro builds with target 'esnext', which gives Vite's CSS minifier
      // (LightningCSS since Vite 8) no browser targets. Without targets it
      // folds `animation-timeline: view()` into the `animation` shorthand,
      // which browsers reject, so the scroll-driven reveal rules in
      // PostCard and GalleryImage were dropped and feed cards stayed
      // invisible. Explicit targets (Vite's own baseline-widely-available
      // list) keep the longhands. See parcel-bundler/lightningcss#1369.
      cssTarget: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'],
    },
  },

  // Enable internationalization
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: {
      // English at root (/feed), French at /fr/feed
      prefixDefaultLocale: false,
    },
  },

  // Image optimization — Astro handles this out of the box
  image: {
    // Generate responsive sizes for different viewports
    // These are used by the <Image> and <Picture> components
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        // High quality for a photography site
        quality: 80,
      },
    },
  },

  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          fr: 'fr',
        },
      },
    }),
  ],

  // Enable View Transitions for smooth page navigation
  // (Applied in the Base layout via <ClientRouter />)
});
