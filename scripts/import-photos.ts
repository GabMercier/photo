/**
 * Bulk Photo Import
 *
 * Turns a folder of exported JPEGs (typically a Lightroom export) into posts:
 *
 *   1. reads EXIF, XMP and IPTC: title, caption, keywords, location, GPS,
 *      capture date, camera and lens (scripts/import/metadata.ts)
 *   2. writes a copy into public/images/uploads/ resized to the site's
 *      2400 px ceiling, keeping camera EXIF but, by default, dropping GPS
 *   3. writes one Markdown post per image in src/content/posts/ (or one
 *      series post with --one-post), mapping keywords onto the tag
 *      vocabulary in src/data/tags/ and filling the location and project
 *      fields of the content model
 *   4. runs the prebuild (optimized sizes, glow colors, EXIF summary)
 *
 * Usage:
 *   npm run import -- <folder-or-files...> [options]
 *
 * Common runs:
 *   npm run import -- ~/Pictures/export/charlevoix --project charlevoix-2025 --project-title "Charlevoix 2025" --project-kind travel
 *   npm run import -- ~/Pictures/export/milky-way --lens "Nikkor 180mm f/2.8 AI-S" --tags astro --show-exif
 *   npm run import -- ~/Pictures/export/charlevoix --dry-run
 *   npm run import -- ~/Pictures/re-export --update
 *
 * Options:
 *   --project <slug>         group every post under this project (created if missing)
 *   --project-title "<text>" title of a newly created project ("Français || English", or one text for both)
 *   --project-kind <kind>    travel | local | astro | other (default other)
 *   --tags a,b               tag slugs added to every post
 *   --lang fr|en             language of single-language titles, captions and alt text (default fr)
 *   --mirror                 copy single-language text to the other language instead of leaving it empty
 *   --date taken|today       publication date source (default taken: the EXIF capture date)
 *   --draft                  create the posts as drafts
 *   --one-post               one series post holding every image (cover = --cover <file> or the earliest shot)
 *   --cover <file>           cover image for --one-post
 *   --title "<text>"         title for --one-post ("Français || English")
 *   --description "<text>"   description for --one-post
 *   --show-exif              show camera info on the post page (showExif: true)
 *   --lens "<name>"          lens for images whose EXIF has none (manual lenses) → exifOverrides.lens
 *   --gps coarse|precise|none
 *                            coarse (default): coordinates rounded to ~1 km in the post, GPS removed from the published JPEG
 *                            precise: exact coordinates in the post, every byte of metadata kept in the JPEG
 *                            none: no coordinates anywhere
 *   --max-edge <px>          long-edge ceiling for the published JPEG (default 2400)
 *   --quality <1-100>        JPEG quality when the file is re-encoded (default 90)
 *   --create-tags            create tag files for keywords that match no existing tag (default: report them)
 *   --update                 for images that already have a post: fill empty fields from the file, never overwrite
 *   --dry-run                print the plan and the report, write nothing
 *   --no-prebuild            skip `npm run prebuild` at the end
 *
 * Bilingual convention: Lightroom has one Title, one Caption and one Alt Text
 * field. Write "Texte français || English text" to fill both languages; a
 * single text goes to the --lang side and the other side is listed in the
 * report for translation.
 *
 * Project from keywords: a hierarchical keyword under a root named project,
 * projet, series or série ("Projet|Charlevoix 2025") assigns the project when
 * --project is not given.
 */

import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, extname, join, resolve, parse as parsePath } from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { readImageMetadata, buildExifWithoutGps, isoDate, type ImageMetadata } from './import/metadata.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PATHS = {
  uploads: 'public/images/uploads',
  posts: 'src/content/posts',
  tags: 'src/data/tags',
  projects: 'src/content/projects',
  manifest: 'src/data/import-manifest.json',
  keywordMap: 'scripts/import/keyword-map.json',
  report: 'scripts/import/last-report.md',
};
const PUBLIC_PREFIX = '/images/uploads';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp']);
const PROJECT_KEYWORD_ROOTS = new Set(['project', 'projects', 'projet', 'projets', 'series', 'serie']);
const PROJECT_KINDS = new Set(['travel', 'local', 'astro', 'other']);
const BILINGUAL_SEPARATOR = '||';
const MAX_SLUG_LENGTH = 60;

/** Country names (FR/EN, accent-insensitive) → ISO 3166-1 alpha-2 */
const COUNTRY_CODES: Record<string, string> = {
  'canada': 'CA',
  'etats unis': 'US', 'etats unis d amerique': 'US', 'united states': 'US', 'united states of america': 'US', 'usa': 'US',
  'france': 'FR', 'islande': 'IS', 'iceland': 'IS', 'italie': 'IT', 'italy': 'IT', 'espagne': 'ES', 'spain': 'ES',
  'portugal': 'PT', 'royaume uni': 'GB', 'united kingdom': 'GB', 'uk': 'GB', 'angleterre': 'GB', 'england': 'GB',
  'ecosse': 'GB', 'scotland': 'GB', 'irlande': 'IE', 'ireland': 'IE', 'allemagne': 'DE', 'germany': 'DE',
  'pays bas': 'NL', 'netherlands': 'NL', 'belgique': 'BE', 'belgium': 'BE', 'suisse': 'CH', 'switzerland': 'CH',
  'norvege': 'NO', 'norway': 'NO', 'suede': 'SE', 'sweden': 'SE', 'danemark': 'DK', 'denmark': 'DK',
  'finlande': 'FI', 'finland': 'FI', 'japon': 'JP', 'japan': 'JP', 'mexique': 'MX', 'mexico': 'MX',
  'perou': 'PE', 'peru': 'PE', 'chili': 'CL', 'chile': 'CL', 'argentine': 'AR', 'argentina': 'AR',
  'maroc': 'MA', 'morocco': 'MA', 'grece': 'GR', 'greece': 'GR', 'croatie': 'HR', 'croatia': 'HR',
  'autriche': 'AT', 'austria': 'AT', 'republique tcheque': 'CZ', 'tchequie': 'CZ', 'czech republic': 'CZ', 'czechia': 'CZ',
  'costa rica': 'CR', 'cuba': 'CU', 'nouvelle zelande': 'NZ', 'new zealand': 'NZ', 'australie': 'AU', 'australia': 'AU',
  'groenland': 'GL', 'greenland': 'GL', 'feroe': 'FO', 'iles feroe': 'FO', 'faroe islands': 'FO',
};

type Lang = 'en' | 'fr';
interface Bilingual { en: string; fr: string }

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `Usage: npm run import -- <folder-or-files...> [options]

  --project <slug>          group every post under this project (created if missing)
  --project-title "<text>"  title of a new project ("Français || English")
  --project-kind <kind>     travel | local | astro | other
  --tags a,b                tag slugs added to every post
  --lang fr|en              language of single-language text (default fr)
  --mirror                  copy single-language text to both languages
  --date taken|today        publication date source (default taken)
  --draft                   create posts as drafts
  --one-post                one series post for the whole folder (--cover, --title, --description)
  --show-exif               show camera info on the post page
  --lens "<name>"           lens for images whose EXIF has none
  --gps coarse|precise|none GPS handling (default coarse)
  --max-edge <px>           long-edge ceiling (default 2400)
  --quality <1-100>         JPEG quality when re-encoding (default 90)
  --create-tags             create tags for unknown keywords
  --update                  fill empty fields of existing posts, never overwrite
  --dry-run                 plan and report only
  --no-prebuild             skip npm run prebuild

See the header of scripts/import-photos.ts and docs/IMPORT.md for details.`;

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    project: { type: 'string' },
    'project-title': { type: 'string' },
    'project-kind': { type: 'string', default: 'other' },
    tags: { type: 'string' },
    lang: { type: 'string', default: 'fr' },
    mirror: { type: 'boolean', default: false },
    date: { type: 'string', default: 'taken' },
    draft: { type: 'boolean', default: false },
    'one-post': { type: 'boolean', default: false },
    cover: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    'show-exif': { type: 'boolean', default: false },
    lens: { type: 'string' },
    gps: { type: 'string', default: 'coarse' },
    'max-edge': { type: 'string', default: '2400' },
    quality: { type: 'string', default: '90' },
    'create-tags': { type: 'boolean', default: false },
    update: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'no-prebuild': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (opts.help) {
  console.log(USAGE);
  process.exit(0);
}
if (positionals.length === 0) {
  console.log(USAGE);
  process.exit(1);
}

const lang: Lang = opts.lang === 'en' ? 'en' : opts.lang === 'fr' ? 'fr' : fail(`--lang must be fr or en (got ${opts.lang})`);
const otherLang: Lang = lang === 'en' ? 'fr' : 'en';
const gpsPolicy = (['coarse', 'precise', 'none'] as const).find(p => p === opts.gps) ?? fail(`--gps must be coarse, precise or none (got ${opts.gps})`);
const dateMode = opts.date === 'today' ? 'today' : opts.date === 'taken' ? 'taken' : fail(`--date must be taken or today (got ${opts.date})`);
const maxEdge = Number.parseInt(opts['max-edge'] ?? '2400', 10);
if (!Number.isFinite(maxEdge) || maxEdge < 400) fail(`--max-edge must be a number of pixels, 400 or more (got ${opts['max-edge']})`);
const quality = Number.parseInt(opts.quality ?? '90', 10);
if (!Number.isFinite(quality) || quality < 1 || quality > 100) fail(`--quality must be between 1 and 100 (got ${opts.quality})`);
const projectKind = opts['project-kind'] ?? 'other';
if (!PROJECT_KINDS.has(projectKind)) fail(`--project-kind must be travel, local, astro or other (got ${projectKind})`);
if (opts.project && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts.project)) fail(`--project must be a slug like charlevoix-2025 (got ${opts.project})`);
if ((opts.title || opts.description || opts.cover) && !opts['one-post']) fail('--title, --description and --cover apply to --one-post only');
const dryRun = opts['dry-run'];
const today = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const stripAccents = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Loose key for matching keywords, labels and country names */
const normalizeKey = (value: string) => stripAccents(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (value: string) => stripAccents(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** Published filename: lowercase ASCII, spaces to dashes, always .jpg */
function destinationName(sourceName: string): string {
  const { name } = parsePath(sourceName);
  const stem = stripAccents(name).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') || 'image';
  return `${stem}.jpg`;
}

/** "Texte français || English text" → both sides; one text → the --lang side */
function splitBilingual(text: string | undefined): Bilingual | undefined {
  if (!text) return undefined;
  const parts = text.split(BILINGUAL_SEPARATOR).map(part => part.trim());
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return lang === 'fr' ? { fr: parts[0], en: parts[1] } : { en: parts[0], fr: parts[1] };
  }
  const value = parts.find(Boolean);
  if (!value) return undefined;
  const other = opts.mirror ? value : '';
  return lang === 'fr' ? { fr: value, en: other } : { en: value, fr: other };
}

const isBlank = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

function humanize(slug: string): string {
  return slug.split('-').map(word => (/^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))).join(' ');
}

async function sha1(file: string): Promise<string> {
  return createHash('sha1').update(await readFile(file)).digest('hex');
}

// ---------------------------------------------------------------------------
// Repository context: tags, posts, uploads, manifest
// ---------------------------------------------------------------------------

interface TagInfo { slug: string; en: string; fr: string }
interface ExistingPost { file: string; path: string; data: Record<string, any>; body: string }
interface PostRef { post: ExistingPost; where: 'cover' | 'image'; index: number }
interface ImportManifestEntry { source: string; sha1: string; importedAt: string; post?: string; width: number; height: number }
type ImportManifest = Record<string, ImportManifestEntry>;

interface Context {
  tags: Map<string, TagInfo>;
  /** normalized keyword/label → tag slug */
  tagLookup: Map<string, string>;
  manifest: ImportManifest;
  posts: ExistingPost[];
  /** lowercase upload basename → post that references it */
  refIndex: Map<string, PostRef>;
  /** lowercase upload basename → actual filename on disk */
  uploadNames: Map<string, string>;
  projectSlugs: Set<string>;
  postSlugs: Set<string>;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function parsePost(raw: string): { data: Record<string, any>; body: string } | null {
  const match = raw.match(FRONTMATTER);
  if (!match) return null;
  const data = YAML.parse(match[1]) ?? {};
  return { data: typeof data === 'object' && data ? data : {}, body: raw.slice(match[0].length) };
}

const YAML_OPTIONS: YAML.ToStringOptions = { lineWidth: 0, singleQuote: true };

function serializePost(data: Record<string, unknown>, body: string): string {
  return `---\n${YAML.stringify(data, YAML_OPTIONS)}---\n${body}`;
}

async function loadTags(): Promise<Map<string, TagInfo>> {
  const tags = new Map<string, TagInfo>();
  if (!existsSync(PATHS.tags)) return tags;
  for (const file of (await readdir(PATHS.tags)).filter(f => f.endsWith('.md'))) {
    const content = await readFile(join(PATHS.tags, file), 'utf-8');
    const slug = file.replace(/\.md$/, '');
    tags.set(slug, {
      slug,
      en: content.match(/^en:\s*"([^"]+)"/m)?.[1] || slug,
      fr: content.match(/^fr:\s*"([^"]+)"/m)?.[1] || slug,
    });
  }
  return tags;
}

async function buildTagLookup(tags: Map<string, TagInfo>): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  for (const tag of tags.values()) {
    lookup.set(normalizeKey(tag.slug.replace(/-/g, ' ')), tag.slug);
    lookup.set(normalizeKey(tag.en), tag.slug);
    lookup.set(normalizeKey(tag.fr), tag.slug);
  }
  if (existsSync(PATHS.keywordMap)) {
    const map = JSON.parse(await readFile(PATHS.keywordMap, 'utf-8')) as Record<string, string>;
    for (const [keyword, slug] of Object.entries(map)) {
      if (keyword.startsWith('_')) continue;
      if (!tags.has(slug)) {
        console.warn(`  ⚠️  keyword-map.json: "${keyword}" points to unknown tag "${slug}", ignored`);
        continue;
      }
      lookup.set(normalizeKey(keyword), slug);
    }
  }
  return lookup;
}

async function loadContext(): Promise<Context> {
  const tags = await loadTags();
  const tagLookup = await buildTagLookup(tags);

  const manifest: ImportManifest = existsSync(PATHS.manifest)
    ? JSON.parse(await readFile(PATHS.manifest, 'utf-8'))
    : {};

  const posts: ExistingPost[] = [];
  const refIndex = new Map<string, PostRef>();
  const postSlugs = new Set<string>();
  if (existsSync(PATHS.posts)) {
    for (const file of (await readdir(PATHS.posts)).filter(f => f.endsWith('.md'))) {
      const path = join(PATHS.posts, file);
      const parsed = parsePost(await readFile(path, 'utf-8'));
      postSlugs.add(file.replace(/\.md$/, '').toLowerCase());
      if (!parsed) continue;
      const post: ExistingPost = { file, path, ...parsed };
      posts.push(post);
      const coverSrc = post.data.coverImage?.src;
      if (typeof coverSrc === 'string') refIndex.set(basename(coverSrc).toLowerCase(), { post, where: 'cover', index: -1 });
      if (Array.isArray(post.data.images)) {
        post.data.images.forEach((image: any, index: number) => {
          if (typeof image?.src === 'string') {
            const key = basename(image.src).toLowerCase();
            if (!refIndex.has(key)) refIndex.set(key, { post, where: 'image', index });
          }
        });
      }
    }
  }

  const uploadNames = new Map<string, string>();
  if (existsSync(PATHS.uploads)) {
    for (const name of await readdir(PATHS.uploads)) {
      if (!name.startsWith('.')) uploadNames.set(name.toLowerCase(), name);
    }
  }

  const projectSlugs = new Set<string>();
  if (existsSync(PATHS.projects)) {
    for (const file of (await readdir(PATHS.projects)).filter(f => f.endsWith('.md'))) {
      projectSlugs.add(file.replace(/\.md$/, ''));
    }
  }

  return { tags, tagLookup, manifest, posts, refIndex, uploadNames, projectSlugs, postSlugs };
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

async function collectSources(inputs: string[]): Promise<string[]> {
  const files = new Set<string>();
  for (const input of inputs) {
    const full = resolve(input);
    if (!existsSync(full)) fail(`Not found: ${input}`);
    const info = await stat(full);
    if (info.isDirectory()) {
      for (const entry of await readdir(full, { withFileTypes: true })) {
        if (entry.isFile() && !entry.name.startsWith('.') && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
          files.add(join(full, entry.name));
        }
      }
    } else if (IMAGE_EXTENSIONS.has(extname(full).toLowerCase())) {
      files.add(full);
    } else {
      console.warn(`  ⚠️  Skipping ${input}: not a supported image (${[...IMAGE_EXTENSIONS].join(', ')})`);
    }
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Metadata → content model
// ---------------------------------------------------------------------------

interface ResolvedKeywords {
  tags: string[];
  unmatched: string[];
  project?: { slug: string; title: string };
}

function resolveKeywords(meta: ImageMetadata, ctx: Context): ResolvedKeywords {
  const tags = new Set<string>();
  const unmatched = new Set<string>();
  const controlled = new Set<string>();
  let project: ResolvedKeywords['project'];

  for (const path of meta.hierarchicalKeywords) {
    const segments = path.split('|').map(s => s.trim()).filter(Boolean);
    if (segments.length < 2 || !PROJECT_KEYWORD_ROOTS.has(normalizeKey(segments[0]))) continue;
    const leaf = segments[segments.length - 1];
    project ??= { slug: slugify(leaf), title: leaf };
    for (const segment of segments) controlled.add(normalizeKey(segment));
  }

  for (const keyword of meta.keywords) {
    const key = normalizeKey(keyword);
    if (!key) continue;
    const slug = ctx.tagLookup.get(key);
    if (slug) tags.add(slug);
    else if (!controlled.has(key) && !PROJECT_KEYWORD_ROOTS.has(key)) unmatched.add(keyword);
  }
  return { tags: [...tags], unmatched: [...unmatched], project };
}

interface LocationData { name?: string; city?: string; region?: string; country?: string; lat?: number; lng?: number }

function buildLocation(meta: ImageMetadata): { location?: LocationData; unknownCountry?: string } {
  const source = meta.location;
  const location: LocationData = {};
  if (source.name) location.name = source.name;
  if (source.city) location.city = source.city;
  if (source.region) location.region = source.region;
  let unknownCountry: string | undefined;
  const code = source.countryCode && /^[A-Za-z]{2}$/.test(source.countryCode)
    ? source.countryCode.toUpperCase()
    : source.country ? COUNTRY_CODES[normalizeKey(source.country)] : undefined;
  if (code) location.country = code;
  else if (source.country) {
    location.country = source.country;
    unknownCountry = source.country;
  }
  if (meta.gps && gpsPolicy !== 'none') {
    const digits = gpsPolicy === 'precise' ? 6 : 2;
    location.lat = round(meta.gps.lat, digits);
    location.lng = round(meta.gps.lng, digits);
  }
  return { location: Object.keys(location).length > 0 ? location : undefined, unknownCountry };
}

/** Lens to write as an override: only when EXIF has none and --lens was given */
function lensOverride(meta: ImageMetadata): string | undefined {
  return opts.lens && !meta.exif.lens ? opts.lens : undefined;
}

interface PostPlan {
  file: string;
  data: Record<string, unknown>;
  body: string;
}

function basePostData(meta: ImageMetadata, publicPath: string, tags: string[], projectSlug: string | undefined, location: LocationData | undefined): Record<string, unknown> {
  const title = splitBilingual(meta.title);
  const description = splitBilingual(meta.description ?? meta.headline);
  const alt = splitBilingual(meta.altText) ?? { en: '', fr: '' };
  const taken = meta.exif.dateTaken ? isoDate(meta.exif.dateTaken) : undefined;

  const data: Record<string, unknown> = {};
  if (title) data.title = title;
  data.coverImage = { src: publicPath, alt, focalPoint: 'center' };
  data.secondaryColors = [];
  if (description) data.description = description;
  data.date = dateMode === 'today' ? today : (taken ?? today);
  if (taken) data.dateTaken = taken;
  if (location) data.location = location;
  if (projectSlug) data.project = projectSlug;
  data.tags = tags;
  data.postType = 'single';
  data.gallerySize = 'auto';
  data.draft = opts.draft;
  data.private = false;
  data.featured = false;
  data.homepageCarousel = false;
  data.homepageDefault = false;
  data.depth3d = false;
  data.showExif = opts['show-exif'];
  const lens = lensOverride(meta);
  if (lens) data.exifOverrides = { lens };
  return data;
}

function postSlug(data: Record<string, unknown>, sourceName: string, ctx: Context, used: Set<string>): string {
  const title = data.title as Bilingual | undefined;
  const stem = parsePath(destinationName(sourceName)).name.replace(/^_+/, '');
  let base = `${data.date}-${slugify(title?.en || title?.fr || stem) || stem}`.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
  let slug = base;
  let counter = 2;
  while (ctx.postSlugs.has(slug.toLowerCase()) || used.has(slug.toLowerCase())) {
    slug = `${base}-${counter++}`;
  }
  used.add(slug.toLowerCase());
  return slug;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

type Action = 'create' | 'attach' | 'update' | 'skip';

interface Entry {
  sourcePath: string;
  sourceName: string;
  sha1: string;
  meta: ImageMetadata;
  destName: string;
  publicPath: string;
  action: Action;
  reason?: string;
  resolved: ResolvedKeywords;
  location?: LocationData;
  unknownCountry?: string;
  existing?: PostRef;
  post?: PostPlan;
  writeImage: boolean;
  renamedFrom?: string;
  changes: string[];
}

function freeDestinationName(wanted: string, ctx: Context, taken: Set<string>): string {
  const { name, ext } = parsePath(wanted);
  let candidate = wanted;
  let counter = 2;
  while (ctx.uploadNames.has(candidate.toLowerCase()) || ctx.manifest[`${PUBLIC_PREFIX}/${candidate}`] || taken.has(candidate.toLowerCase())) {
    candidate = `${name}-${counter++}${ext}`;
  }
  return candidate;
}

async function planEntries(sources: string[], ctx: Context): Promise<Entry[]> {
  const entries: Entry[] = [];
  const takenNames = new Set<string>();

  for (const sourcePath of sources) {
    const sourceName = basename(sourcePath);
    let meta: ImageMetadata;
    try {
      meta = await readImageMetadata(sourcePath);
    } catch (error) {
      console.warn(`  ⚠️  Cannot read ${sourceName}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    const hash = await sha1(sourcePath);
    let destName = destinationName(sourceName);
    const resolved = resolveKeywords(meta, ctx);
    const { location, unknownCountry } = buildLocation(meta);
    const entry: Entry = {
      sourcePath, sourceName, sha1: hash, meta, destName, publicPath: `${PUBLIC_PREFIX}/${destName}`,
      action: 'create', resolved, location, unknownCountry, writeImage: true, changes: [],
    };

    // Same content already imported under any name → skip, or refresh its post with --update
    const imported = Object.entries(ctx.manifest).find(([, m]) => m.sha1 === hash);
    if (imported) {
      const [importedPath, record] = imported;
      const ref = ctx.refIndex.get(basename(importedPath).toLowerCase());
      entry.destName = basename(importedPath);
      entry.publicPath = importedPath;
      entry.writeImage = false;
      if (opts.update && ref) {
        entry.action = 'update';
        entry.existing = ref;
      } else {
        entry.action = 'skip';
        entry.reason = `already imported as ${record.post ?? importedPath} (same content)`;
      }
      entries.push(entry);
      continue;
    }

    // New content. A name clash is either a pre-importer upload (same picture
    // re-exported → --update refreshes its post) or a different picture (→ rename).
    const legacyUpload = !ctx.manifest[entry.publicPath] && ctx.uploadNames.has(destName.toLowerCase());
    if (legacyUpload) {
      const ref = ctx.refIndex.get(destName.toLowerCase());
      if (opts.update && ref) {
        entry.action = 'update';
        entry.existing = ref;
        entry.writeImage = false;
      } else if (opts.update) {
        entry.action = 'skip';
        entry.reason = `an upload named ${ctx.uploadNames.get(destName.toLowerCase())} exists but no post references it`;
        entry.writeImage = false;
      } else {
        const renamed = freeDestinationName(destName, ctx, takenNames);
        entry.renamedFrom = destName;
        entry.destName = renamed;
        entry.publicPath = `${PUBLIC_PREFIX}/${renamed}`;
      }
    } else if (ctx.manifest[entry.publicPath] || takenNames.has(destName.toLowerCase())) {
      const renamed = freeDestinationName(destName, ctx, takenNames);
      entry.renamedFrom = destName;
      entry.destName = renamed;
      entry.publicPath = `${PUBLIC_PREFIX}/${renamed}`;
    }

    if (entry.action === 'create') takenNames.add(entry.destName.toLowerCase());
    entries.push(entry);
  }
  return entries;
}

/** One post per created entry */
function planSinglePosts(entries: Entry[], ctx: Context, extraTags: string[], used: Set<string>): void {
  for (const entry of entries) {
    if (entry.action !== 'create') continue;
    const tags = [...new Set([...extraTags, ...entry.resolved.tags])];
    const projectSlug = opts.project ?? entry.resolved.project?.slug;
    const data = basePostData(entry.meta, entry.publicPath, tags, projectSlug, entry.location);
    const slug = postSlug(data, entry.sourceName, ctx, used);
    entry.post = { file: `${slug}.md`, data, body: '' };
  }
}

/** One series post holding every created entry */
function planSeriesPost(entries: Entry[], ctx: Context, extraTags: string[], used: Set<string>): void {
  const creates = entries.filter(e => e.action === 'create');
  if (creates.length === 0) return;
  const byDate = [...creates].sort((a, b) => {
    const da = a.meta.exif.dateTaken?.valueOf() ?? Infinity;
    const db = b.meta.exif.dateTaken?.valueOf() ?? Infinity;
    return da - db || a.sourceName.localeCompare(b.sourceName);
  });
  let cover = byDate[0];
  if (opts.cover) {
    const wanted = basename(opts.cover).toLowerCase();
    cover = creates.find(e => e.sourceName.toLowerCase() === wanted || e.destName === destinationName(wanted))
      ?? fail(`--cover ${opts.cover} is not among the images to import`);
  }
  const others = byDate.filter(e => e !== cover);

  const tags = [...new Set([...extraTags, ...creates.flatMap(e => e.resolved.tags)])];
  const projectSlug = opts.project ?? creates.map(e => e.resolved.project?.slug).find(Boolean);
  const location = cover.location ?? creates.map(e => e.location).find(Boolean);
  const data = basePostData(cover.meta, cover.publicPath, tags, projectSlug, location);
  const title = splitBilingual(opts.title) ?? (data.title as Bilingual | undefined);
  if (title) data.title = title; else delete data.title;
  const description = splitBilingual(opts.description) ?? (data.description as Bilingual | undefined);
  if (description) data.description = description; else delete data.description;
  const earliest = byDate[0].meta.exif.dateTaken;
  if (earliest) {
    data.dateTaken = isoDate(earliest);
    if (dateMode === 'taken') data.date = isoDate(earliest);
  }
  data.postType = 'series';
  data.images = others.map(entry => {
    const image: Record<string, unknown> = {
      src: entry.publicPath,
      alt: splitBilingual(entry.meta.altText) ?? { en: '', fr: '' },
    };
    const lens = lensOverride(entry.meta);
    if (lens) image.lens = lens;
    return image;
  });
  // Reorder keys so images come last, matching the CMS layout
  const { images, ...rest } = data;
  const ordered = { ...rest, images };

  const slug = postSlug(ordered, cover.sourceName, ctx, used);
  cover.post = { file: `${slug}.md`, data: ordered, body: '' };
  for (const entry of others) entry.action = 'attach';
}

/** --update: fill empty fields of the existing post from the file */
function planUpdate(entry: Entry, extraTags: string[]): void {
  const ref = entry.existing!;
  const data = ref.post.data;
  const changes = entry.changes;
  const meta = entry.meta;

  const fillBilingual = (holder: Record<string, any>, key: string, incoming: Bilingual | undefined, label: string) => {
    if (!incoming) return;
    const current = holder[key] && typeof holder[key] === 'object' ? holder[key] : {};
    let changed = false;
    for (const side of ['en', 'fr'] as const) {
      if (incoming[side] && isBlank(current[side])) {
        current[side] = incoming[side];
        changed = true;
      }
    }
    if (changed) {
      holder[key] = { en: current.en ?? '', fr: current.fr ?? '' };
      changes.push(label);
    }
  };

  if (ref.where === 'cover') {
    fillBilingual(data, 'title', splitBilingual(meta.title), 'title');
    fillBilingual(data, 'description', splitBilingual(meta.description ?? meta.headline), 'description');
    if (data.coverImage && typeof data.coverImage === 'object') {
      fillBilingual(data.coverImage, 'alt', splitBilingual(meta.altText), 'cover alt text');
    }
    const taken = meta.exif.dateTaken ? isoDate(meta.exif.dateTaken) : undefined;
    if (taken && isBlank(data.dateTaken)) { data.dateTaken = taken; changes.push('dateTaken'); }

    const incomingTags = [...new Set([...extraTags, ...entry.resolved.tags])];
    const currentTags: string[] = Array.isArray(data.tags) ? data.tags : [];
    const added = incomingTags.filter(tag => !currentTags.includes(tag));
    if (added.length > 0) { data.tags = [...currentTags, ...added]; changes.push(`tags +${added.join(', ')}`); }

    if (entry.location) {
      if (!data.location || typeof data.location !== 'object') {
        data.location = entry.location;
        changes.push('location');
      } else {
        const filled: string[] = [];
        for (const [key, value] of Object.entries(entry.location)) {
          if (isBlank(data.location[key])) { data.location[key] = value; filled.push(key); }
        }
        if (filled.length > 0) changes.push(`location ${filled.join('/')}`);
      }
    }

    const projectSlug = opts.project ?? entry.resolved.project?.slug;
    if (projectSlug && isBlank(data.project)) { data.project = projectSlug; changes.push('project'); }

    const lens = lensOverride(meta);
    if (lens && isBlank(data.exifOverrides?.lens)) {
      data.exifOverrides = { ...(data.exifOverrides && typeof data.exifOverrides === 'object' ? data.exifOverrides : {}), lens };
      changes.push('exifOverrides.lens');
    }
  } else {
    const image = data.images?.[ref.index];
    if (image && typeof image === 'object') {
      fillBilingual(image, 'alt', splitBilingual(meta.altText), `image ${ref.index + 1} alt text`);
      const lens = lensOverride(meta);
      if (lens && isBlank(image.lens)) { image.lens = lens; changes.push(`image ${ref.index + 1} lens`); }
    }
  }

  if (changes.length === 0) {
    entry.action = 'skip';
    entry.reason = `${ref.post.file} already has every field the file provides`;
  }
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function writeUpload(entry: Entry): Promise<'copied' | 'resized' | 're-encoded'> {
  const dest = join(PATHS.uploads, entry.destName);
  const longEdge = Math.max(entry.meta.width, entry.meta.height);
  const needsResize = longEdge > maxEdge;
  const isJpeg = /\.jpe?g$/i.test(entry.sourcePath);
  const stripGps = Boolean(entry.meta.gps) && gpsPolicy !== 'precise';

  if (!needsResize && isJpeg && !stripGps) {
    await copyFile(entry.sourcePath, dest);
    return 'copied';
  }
  let pipeline = sharp(entry.sourcePath).rotate();
  if (!isJpeg) pipeline = pipeline.flatten({ background: '#ffffff' });
  if (needsResize) pipeline = pipeline.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
  pipeline = stripGps
    ? pipeline.keepIccProfile().withExif(buildExifWithoutGps(entry.meta.exifParsed))
    : pipeline.keepMetadata();
  await pipeline.jpeg({ quality, mozjpeg: true }).toFile(dest);
  return needsResize ? 'resized' : 're-encoded';
}

async function ensureProject(slug: string, title: string | undefined, ctx: Context): Promise<boolean> {
  if (ctx.projectSlugs.has(slug)) return false;
  const titles = splitBilingual(title) ?? { en: humanize(slug), fr: humanize(slug) };
  if (!titles.en) titles.en = titles.fr;
  if (!titles.fr) titles.fr = titles.en;
  const data = {
    title: titles,
    description: { en: '', fr: '' },
    kind: projectKind,
    featured: false,
    draft: false,
  };
  if (!dryRun) {
    await mkdir(PATHS.projects, { recursive: true });
    await writeFile(join(PATHS.projects, `${slug}.md`), serializePost(data, ''), 'utf-8');
  }
  ctx.projectSlugs.add(slug);
  return true;
}

async function createTag(keyword: string, ctx: Context): Promise<string | undefined> {
  const slug = slugify(keyword);
  if (!slug) return undefined;
  if (!ctx.tags.has(slug)) {
    const label = keyword.trim().replace(/"/g, '');
    if (!dryRun) {
      await mkdir(PATHS.tags, { recursive: true });
      await writeFile(join(PATHS.tags, `${slug}.md`), `---\nen: "${label}"\nfr: "${label}"\n---\n`, 'utf-8');
    }
    ctx.tags.set(slug, { slug, en: label, fr: label });
  }
  ctx.tagLookup.set(normalizeKey(keyword), slug);
  return slug;
}

function runPrebuild(): void {
  console.log('\n🏗️  Running prebuild (optimized sizes, glow colors, EXIF)…\n');
  const result = spawnSync('npm', ['run', 'prebuild'], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) console.warn('\n⚠️  Prebuild exited with errors; run `npm run prebuild` again after fixing them.');
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function describeLocation(location: LocationData | undefined): string {
  if (!location) return '';
  const names = [location.name, location.city, location.region, location.country].filter(Boolean).join(', ');
  const coords = typeof location.lat === 'number' && typeof location.lng === 'number' ? `${location.lat}, ${location.lng}` : '';
  return names || coords;
}

function describeTitle(data: Record<string, unknown>): string {
  const title = data.title as Bilingual | undefined;
  return title ? (title[lang] || title[otherLang] || '') : '';
}

function buildReport(entries: Entry[], createdProjects: string[], createdTags: string[]): string {
  const lines: string[] = [];
  const creates = entries.filter(e => e.action === 'create');
  const attaches = entries.filter(e => e.action === 'attach');
  const updates = entries.filter(e => e.action === 'update');
  const skips = entries.filter(e => e.action === 'skip');

  lines.push(`# Import report — ${new Date().toISOString().replace('T', ' ').slice(0, 16)}${dryRun ? ' (dry run)' : ''}`);
  lines.push('');
  lines.push(`Sources: ${positionals.join(', ')}  `);
  lines.push(`Options: lang=${lang}, date=${dateMode}, gps=${gpsPolicy}, max-edge=${maxEdge}${opts.project ? `, project=${opts.project}` : ''}${opts['one-post'] ? ', one-post' : ''}${opts.update ? ', update' : ''}${opts.draft ? ', draft' : ''}`);
  lines.push('');

  if (creates.length > 0) {
    lines.push(`## Created (${creates.length} post${creates.length === 1 ? '' : 's'}${attaches.length ? `, ${attaches.length} attached image${attaches.length === 1 ? '' : 's'}` : ''})`);
    lines.push('');
    lines.push('| Post | Image | Title | Date | Tags | Location | Project |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const e of creates) {
      const d = e.post!.data;
      const loc = describeLocation(e.location);
      lines.push(`| ${e.post!.file} | ${e.destName}${e.renamedFrom ? ` (was ${e.renamedFrom})` : ''} | ${describeTitle(d) || '—'} | ${d.date} | ${(d.tags as string[]).join(', ') || '—'} | ${loc || '—'} | ${d.project ?? '—'} |`);
    }
    for (const e of attaches) {
      lines.push(`| ↳ attached | ${e.destName} | | | | | |`);
    }
    lines.push('');
  }

  if (updates.length > 0) {
    lines.push(`## Updated (${updates.length})`);
    lines.push('');
    for (const e of updates) lines.push(`- ${e.existing!.post.file} ← ${e.sourceName}: ${e.changes.join(', ')}`);
    lines.push('');
  }

  if (skips.length > 0) {
    lines.push(`## Skipped (${skips.length})`);
    lines.push('');
    for (const e of skips) lines.push(`- ${e.sourceName}: ${e.reason}`);
    lines.push('');
  }

  if (createdProjects.length > 0 || createdTags.length > 0) {
    lines.push('## Created vocabulary');
    lines.push('');
    for (const slug of createdProjects) lines.push(`- project: src/content/projects/${slug}.md (fill in the description and kind in the CMS)`);
    for (const slug of createdTags) lines.push(`- tag: src/data/tags/${slug}.md (translate the label)`);
    lines.push('');
  }

  // Attention items
  const attention: string[] = [];
  const posted = creates.map(e => ({ file: e.post!.file, data: e.post!.data, entry: e }));
  const altMissing = posted.filter(p => {
    const alt = (p.data.coverImage as any).alt as Bilingual;
    return !alt.en || !alt.fr;
  });
  if (altMissing.length > 0) {
    attention.push(`- **Alt text missing** (${altMissing.length}): ${altMissing.map(p => {
      const alt = (p.data.coverImage as any).alt as Bilingual;
      const sides = [!alt.en && 'EN', !alt.fr && 'FR'].filter(Boolean).join('/');
      return `${p.file} (${sides})`;
    }).join('; ')}. Ask Claude to draft them from the images, or fill Lightroom's Alt Text field before exporting.`);
  }
  const attachedAltMissing = attaches.filter(e => {
    const alt = splitBilingual(e.meta.altText);
    return !alt || !alt.en || !alt.fr;
  });
  if (attachedAltMissing.length > 0) {
    attention.push(`- **Alt text missing on attached images** (${attachedAltMissing.length}): ${attachedAltMissing.map(e => e.destName).join(', ')}`);
  }
  const noTitle = posted.filter(p => !p.data.title);
  if (noTitle.length > 0) attention.push(`- **No title** (${noTitle.length}): ${noTitle.map(p => p.file).join(', ')}. Posts display fine without one; the RSS feed and share cards read better with one.`);
  const halfTitle = posted.filter(p => p.data.title && (!(p.data.title as Bilingual).en || !(p.data.title as Bilingual).fr));
  if (halfTitle.length > 0) attention.push(`- **Title in one language only** (${halfTitle.length}): ${halfTitle.map(p => `${p.file} (${describeTitle(p.data)})`).join('; ')}`);
  const halfDescription = posted.filter(p => p.data.description && (!(p.data.description as Bilingual).en || !(p.data.description as Bilingual).fr));
  if (halfDescription.length > 0) attention.push(`- **Description in one language only** (${halfDescription.length}): ${halfDescription.map(p => p.file).join(', ')}`);

  const unmatched = new Map<string, number>();
  for (const e of entries) {
    if (e.action === 'skip') continue;
    for (const keyword of e.resolved.unmatched) unmatched.set(keyword, (unmatched.get(keyword) ?? 0) + 1);
  }
  if (unmatched.size > 0) {
    attention.push(`- **Keywords without a tag** (${unmatched.size}): ${[...unmatched.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(', ')}. Add a tag in the CMS, a synonym in scripts/import/keyword-map.json, or rerun with --create-tags.`);
  }
  const unknownCountries = [...new Set(entries.filter(e => e.action !== 'skip' && e.unknownCountry).map(e => e.unknownCountry!))];
  if (unknownCountries.length > 0) attention.push(`- **Country not recognised** (kept as written; replace with the 2-letter ISO code so it is translated): ${unknownCountries.join(', ')}`);
  const withGps = entries.filter(e => e.action !== 'skip' && e.meta.gps);
  if (withGps.length > 0) {
    const how = gpsPolicy === 'precise' ? 'exact coordinates kept in the post and in the JPEG' : gpsPolicy === 'coarse' ? 'coordinates rounded to ~1 km in the post, GPS removed from the published JPEG' : 'no coordinates written, GPS removed from the published JPEG';
    attention.push(`- **GPS present** (${withGps.length}: ${withGps.map(e => e.destName).join(', ')}): ${how}.`);
  }
  const noDate = entries.filter(e => e.action === 'create' && !e.meta.exif.dateTaken);
  if (noDate.length > 0) attention.push(`- **No capture date in EXIF** (${noDate.length}): ${noDate.map(e => e.destName).join(', ')} — published with today's date.`);
  const renamed = entries.filter(e => e.action !== 'skip' && e.renamedFrom);
  if (renamed.length > 0) attention.push(`- **Renamed to avoid a clash** (${renamed.length}): ${renamed.map(e => `${e.renamedFrom} → ${e.destName}`).join(', ')}`);

  lines.push('## Needs attention');
  lines.push('');
  lines.push(attention.length > 0 ? attention.join('\n') : '- Nothing.');
  lines.push('');
  lines.push('## Next steps');
  lines.push('');
  if (dryRun) {
    lines.push('1. Rerun without --dry-run to write the files.');
  } else {
    lines.push('1. Review the posts in the CMS (http://localhost:4321/admin/ with `npm run dev`) or in src/content/posts/.');
    lines.push('2. Fill alt text and translations listed above.');
    lines.push('3. Commit and push: `git add -A && git commit -m "content: import …" && git push` (the GitHub Action deploys).');
  }
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`📥 Importing photos${dryRun ? ' (dry run — nothing will be written)' : ''}…\n`);

  const sources = await collectSources(positionals);
  if (sources.length === 0) fail('No images found in the given paths.');
  console.log(`📁 ${sources.length} image${sources.length === 1 ? '' : 's'} found`);

  const ctx = await loadContext();
  console.log(`🏷️  ${ctx.tags.size} tags, ${ctx.posts.length} existing posts, ${ctx.projectSlugs.size} projects\n`);

  // Extra tags from the command line must exist (or be creatable)
  const extraTags: string[] = [];
  for (const raw of (opts.tags ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
    const slug = ctx.tagLookup.get(normalizeKey(raw)) ?? (ctx.tags.has(raw) ? raw : undefined);
    if (slug) extraTags.push(slug);
    else if (opts['create-tags']) {
      const created = await createTag(raw, ctx);
      if (created) extraTags.push(created);
    } else fail(`--tags: unknown tag "${raw}". Existing slugs: ${[...ctx.tags.keys()].join(', ')} (or use --create-tags)`);
  }

  // Read every file, decide what happens to it
  let entries = await planEntries(sources, ctx);

  // Unknown keywords become tags when asked, then keywords are resolved again
  const createdTags: string[] = [];
  if (opts['create-tags']) {
    const unknown = new Set(entries.filter(e => e.action !== 'skip').flatMap(e => e.resolved.unmatched));
    for (const keyword of unknown) {
      const slug = await createTag(keyword, ctx);
      if (slug) createdTags.push(slug);
    }
    for (const entry of entries) entry.resolved = resolveKeywords(entry.meta, ctx);
  }

  const usedSlugs = new Set<string>();
  if (opts['one-post']) planSeriesPost(entries, ctx, extraTags, usedSlugs);
  else planSinglePosts(entries, ctx, extraTags, usedSlugs);
  for (const entry of entries) if (entry.action === 'update') planUpdate(entry, extraTags);

  // Projects referenced by the plan
  const createdProjects: string[] = [];
  const projectRefs = new Map<string, string | undefined>();
  if (opts.project) projectRefs.set(opts.project, opts['project-title']);
  for (const entry of entries) {
    if (entry.action === 'skip') continue;
    const slug = (entry.post?.data.project as string | undefined) ?? (entry.action === 'update' ? entry.existing!.post.data.project : undefined);
    const fromKeywords = entry.resolved.project;
    if (slug && !projectRefs.has(slug)) projectRefs.set(slug, fromKeywords && fromKeywords.slug === slug ? fromKeywords.title : undefined);
  }
  for (const [slug, title] of projectRefs) {
    if (await ensureProject(slug, title, ctx)) createdProjects.push(slug);
  }

  // Print the plan
  for (const entry of entries) {
    const icon = { create: '✅', attach: '📎', update: '✏️ ', skip: '⏭️ ' }[entry.action];
    let detail = '';
    if (entry.action === 'create') {
      const d = entry.post!.data;
      const loc = describeLocation(entry.location);
      detail = `→ ${entry.post!.file}  [${(d.tags as string[]).join(', ') || 'no tags'}]${loc ? `  📍 ${loc}` : ''}${d.project ? `  📁 ${d.project}` : ''}`;
    } else if (entry.action === 'attach') detail = `→ attached to the series post`;
    else if (entry.action === 'update') detail = `→ ${entry.existing!.post.file}: ${entry.changes.join(', ')}`;
    else detail = `(${entry.reason})`;
    console.log(`  ${icon} ${entry.sourceName}${entry.renamedFrom ? ` as ${entry.destName}` : ''} ${detail}`);
  }

  // Write files
  if (!dryRun) {
    await mkdir(PATHS.uploads, { recursive: true });
    await mkdir(PATHS.posts, { recursive: true });
    for (const entry of entries) {
      if (entry.writeImage && (entry.action === 'create' || entry.action === 'attach')) {
        const how = await writeUpload(entry);
        const output = await sharp(join(PATHS.uploads, entry.destName)).metadata();
        ctx.manifest[entry.publicPath] = {
          source: entry.sourceName,
          sha1: entry.sha1,
          importedAt: new Date().toISOString(),
          width: output.width ?? entry.meta.width,
          height: output.height ?? entry.meta.height,
        };
        console.log(`  🖼️  ${entry.destName} ${how} (${output.width}×${output.height})`);
      }
    }
    // Series images point at the cover's post
    const seriesPost = entries.find(e => e.action === 'create' && e.post && opts['one-post'])?.post?.file;
    for (const entry of entries) {
      if (entry.action === 'create' && entry.post) {
        await writeFile(join(PATHS.posts, entry.post.file), serializePost(entry.post.data, entry.post.body), 'utf-8');
        ctx.manifest[entry.publicPath].post = entry.post.file;
      } else if (entry.action === 'attach' && seriesPost) {
        ctx.manifest[entry.publicPath].post = seriesPost;
      } else if (entry.action === 'update') {
        const post = entry.existing!.post;
        await writeFile(post.path, serializePost(post.data, post.body), 'utf-8');
      }
    }
    await mkdir('src/data', { recursive: true });
    await writeFile(PATHS.manifest, JSON.stringify(ctx.manifest, null, 2) + '\n', 'utf-8');
  }

  const report = buildReport(entries, createdProjects, createdTags);
  if (!dryRun) {
    await mkdir('scripts/import', { recursive: true });
    await writeFile(PATHS.report, report, 'utf-8');
  }

  const counts = {
    create: entries.filter(e => e.action === 'create').length,
    attach: entries.filter(e => e.action === 'attach').length,
    update: entries.filter(e => e.action === 'update').length,
    skip: entries.filter(e => e.action === 'skip').length,
  };
  console.log(`\n📊 ${counts.create} post${counts.create === 1 ? '' : 's'} created${counts.attach ? `, ${counts.attach} images attached` : ''}, ${counts.update} updated, ${counts.skip} skipped`);
  if (createdProjects.length) console.log(`📁 Projects created: ${createdProjects.join(', ')}`);
  if (createdTags.length) console.log(`🏷️  Tags created: ${createdTags.join(', ')}`);

  if (dryRun) {
    console.log('\n' + report);
    return;
  }
  console.log(`📝 Report: ${PATHS.report}`);

  const attention = report.split('## Needs attention')[1]?.split('## Next steps')[0]?.trim();
  if (attention && attention !== '- Nothing.') console.log(`\n⚠️  Needs attention:\n${attention}`);

  if (!opts['no-prebuild'] && (counts.create > 0 || counts.attach > 0 || counts.update > 0)) runPrebuild();
  console.log('\n✨ Import complete. Review in the CMS, then commit and push to deploy.');
}

main().catch(error => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
