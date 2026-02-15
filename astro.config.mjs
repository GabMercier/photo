// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Replace with your actual domain when ready
  site: 'https://gmbpho.to',

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
  // (Applied in the Base layout via <ViewTransitions />)
});
