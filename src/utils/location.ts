/**
 * Location Utilities
 *
 * A post (or a project) can carry a `location` object that mirrors the IPTC
 * location fields Lightroom writes: sublocation, city, province/state,
 * country and GPS. Place names are stored once, as written (Québec,
 * Baie-Saint-Paul, Reykjavík); only the country is localized, from its
 * ISO 3166-1 alpha-2 code, through Intl.DisplayNames at build time.
 */
import type { Locale } from './i18n';

export interface Location {
  /** Spot or sublocation: "Vieux-Québec", "Quai de Baie-Saint-Paul" */
  name?: string;
  city?: string;
  /** Province, state or region */
  region?: string;
  /** ISO 3166-1 alpha-2 code preferred (CA, FR, IS); a plain name also works */
  country?: string;
  lat?: number;
  lng?: number;
}

/**
 * Country the photographer works from. The short form used on cards omits
 * it so hyperlocal work doesn't read "…, Québec, Canada" on every tile.
 */
export const HOME_COUNTRY = 'CA';

const displayNames = new Map<Locale, Intl.DisplayNames>();

/** Localized country name from an ISO code; names pass through unchanged. */
export function countryName(country: string | undefined, locale: Locale): string {
  if (!country) return '';
  const code = country.trim();
  if (!/^[A-Za-z]{2}$/.test(code)) return code;
  try {
    let dn = displayNames.get(locale);
    if (!dn) {
      dn = new Intl.DisplayNames([locale === 'fr' ? 'fr-CA' : 'en-CA'], { type: 'region' });
      displayNames.set(locale, dn);
    }
    return dn.of(code.toUpperCase()) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** Lowercase, accent-insensitive key for de-duplicating place names. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function uniqueParts(parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (!value) continue;
    const key = fold(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * Human-readable location.
 *
 * - `full`  → "Quai de Baie-Saint-Paul, Baie-Saint-Paul, Québec, Canada"
 * - `short` → "Baie-Saint-Paul, Québec" (spot or city, then region; the
 *             country only when it isn't HOME_COUNTRY)
 */
export function formatLocation(
  location: Location | undefined | null,
  locale: Locale,
  form: 'full' | 'short' = 'full'
): string {
  if (!location) return '';
  const country = countryName(location.country, locale);

  if (form === 'short') {
    const isHome = (location.country || '').toUpperCase() === HOME_COUNTRY;
    return uniqueParts([
      location.name || location.city,
      location.name ? location.city : location.region,
      !location.name ? undefined : location.region,
      isHome ? undefined : country,
    ]).slice(0, 3).join(', ');
  }

  return uniqueParts([location.name, location.city, location.region, country]).join(', ');
}

/** True when the object carries at least one usable field. */
export function hasLocation(location: Location | undefined | null): location is Location {
  if (!location) return false;
  return Boolean(
    location.name || location.city || location.region || location.country ||
    typeof location.lat === 'number' || typeof location.lng === 'number'
  );
}

/** Schema.org Place for structured data (contentLocation). */
export function locationToPlace(location: Location, locale: Locale): Record<string, unknown> | undefined {
  if (!hasLocation(location)) return undefined;
  const place: Record<string, unknown> = {
    '@type': 'Place',
    name: formatLocation(location, locale),
  };
  const address: Record<string, string> = {};
  if (location.city) address.addressLocality = location.city;
  if (location.region) address.addressRegion = location.region;
  if (location.country) address.addressCountry = location.country.toUpperCase();
  if (Object.keys(address).length > 0) {
    place.address = { '@type': 'PostalAddress', ...address };
  }
  if (typeof location.lat === 'number' && typeof location.lng === 'number') {
    place.geo = { '@type': 'GeoCoordinates', latitude: location.lat, longitude: location.lng };
  }
  return place;
}
