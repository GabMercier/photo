/**
 * Shared schema.org Person for the photographer.
 *
 * Constraint: the full name appears ONLY in JSON-LD (invisible to visitors,
 * read by search engines) — never in URLs or visible text, where the short
 * form "Gabriel Mercier" is used. The stable @id lets Google merge the
 * Person entity across every page that embeds it.
 */
export function personSchema(siteUrl: string) {
  const base = siteUrl.replace(/\/+$/, '');
  return {
    '@type': 'Person',
    '@id': `${base}/#photographer`,
    name: 'Gabriel Mercier-Blouin',
    alternateName: 'Gabriel Mercier',
    url: base,
    jobTitle: 'Photographer',
    address: {
      '@type': 'PostalAddress',
      addressRegion: 'QC',
      addressCountry: 'CA',
    },
    // Public profile URLs (Instagram, GitHub, …) that carry the full name;
    // each one strengthens the name→site association in Google's entity graph.
    sameAs: [] as string[],
  };
}
