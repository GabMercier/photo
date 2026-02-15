/**
 * Internationalization (i18n) Utility
 * 
 * Simple approach: all UI strings live here as a dictionary.
 * Content translations are handled via bilingual frontmatter fields.
 * 
 * Usage in .astro files:
 *   import { t, getLocaleFromUrl } from '@utils/i18n';
 *   const locale = getLocaleFromUrl(Astro.url);
 *   <h1>{t('nav.feed', locale)}</h1>
 */

export type Locale = 'en' | 'fr';
export const defaultLocale: Locale = 'en';
export const locales: Locale[] = ['en', 'fr'];

// ---------------------------------------------------------------------------
// UI translation strings
// ---------------------------------------------------------------------------
const translations: Record<string, Record<Locale, string>> = {
  // Navigation
  'nav.home': { en: 'Home', fr: 'Accueil' },
  'nav.feed': { en: 'Feed', fr: 'Fil' },
  'nav.gallery': { en: 'Gallery', fr: 'Galerie' },
  'nav.about': { en: 'About', fr: 'À propos' },

  // Gallery / Filters
  'gallery.all': { en: 'All', fr: 'Tout' },
  'gallery.filter': { en: 'Filter', fr: 'Filtrer' },
  'gallery.search': { en: 'Search...', fr: 'Rechercher...' },
  'gallery.noResults': { en: 'No photos found.', fr: 'Aucune photo trouvée.' },
  'gallery.photos': { en: 'photos', fr: 'photos' },

  // Post types
  'post.single': { en: 'Photo', fr: 'Photo' },
  'post.series': { en: 'Series', fr: 'Série' },
  'post.readMore': { en: 'View', fr: 'Voir' },

  // Footer
  'footer.rights': { en: 'All rights reserved.', fr: 'Tous droits réservés.' },

  // Misc
  'misc.featured': { en: 'Featured', fr: 'En vedette' },
  'misc.private': { en: 'Private', fr: 'Privé' },
  'misc.backToFeed': { en: 'Back to feed', fr: 'Retour au fil' },
  'misc.backToGallery': { en: '← Back to gallery', fr: '← Retour à la galerie' },

  // Slideshow
  'slideshow.close': { en: 'Close', fr: 'Fermer' },
  'slideshow.previous': { en: 'Previous', fr: 'Précédent' },
  'slideshow.next': { en: 'Next', fr: 'Suivant' },
  'gallery.previous': { en: 'Previous post', fr: 'Post précédent' },
  'gallery.next': { en: 'Next post', fr: 'Post suivant' },

  // Theme
  'theme.label': { en: 'Theme', fr: 'Thème' },

  // Language
  'lang.switch': { en: 'FR', fr: 'EN' },
  'lang.current': { en: 'English', fr: 'Français' },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Get a translated string by key.
 * Falls back to English if the key or locale is missing.
 */
export function t(key: string, locale: Locale = defaultLocale): string {
  return translations[key]?.[locale] ?? translations[key]?.['en'] ?? key;
}

/**
 * Extract the locale from a URL pathname.
 * /fr/feed → 'fr'
 * /feed → 'en' (default)
 */
export function getLocaleFromUrl(url: URL): Locale {
  const [, maybeLang] = url.pathname.split('/');
  if (locales.includes(maybeLang as Locale)) {
    return maybeLang as Locale;
  }
  return defaultLocale;
}

/**
 * Get the localized value from a bilingual field.
 * Usage: localized(post.data.title, locale) → string
 */
export function localized(
  field: Record<Locale, string> | undefined,
  locale: Locale = defaultLocale
): string {
  if (!field) return '';
  return field[locale] ?? field[defaultLocale] ?? '';
}

/**
 * Build a localized path.
 * localePath('/feed', 'fr') → '/fr/feed'
 * localePath('/feed', 'en') → '/feed'
 */
export function localePath(path: string, locale: Locale): string {
  if (locale === defaultLocale) return path;
  return `/${locale}${path}`;
}

/**
 * Get the alternate locale path (for language switcher).
 */
export function alternateLocalePath(url: URL): string {
  const locale = getLocaleFromUrl(url);
  const altLocale = locale === 'en' ? 'fr' : 'en';

  if (locale === defaultLocale) {
    // Currently /feed → need /fr/feed
    return `/${altLocale}${url.pathname}`;
  } else {
    // Currently /fr/feed → need /feed
    return url.pathname.replace(`/${locale}`, '') || '/';
  }
}
