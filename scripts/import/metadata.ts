/**
 * Image metadata reader for the import script.
 *
 * Reads what Lightroom (and cameras) embed in an exported JPEG:
 * - EXIF through sharp + exif-reader: camera, lens, exposure, capture date, GPS
 * - XMP, the primary carrier of Lightroom's title, caption, keywords,
 *   location and accessibility text, parsed with a small tolerant reader
 *   rather than a full XML stack
 * - IPTC-IIM inside the Photoshop APP13 segment, as a fallback for files
 *   whose XMP was stripped by another tool
 */
import sharp from 'sharp';
import exifReader from 'exif-reader';

export interface ExifSummary {
  make?: string;
  model?: string;
  /** Lens name; undefined for manual lenses that report "0.0 mm f/0.0" */
  lens?: string;
  focalLength?: number;
  focalLength35mm?: number;
  aperture?: number;
  shutterSpeed?: string;
  iso?: number;
  dateTaken?: Date;
  software?: string;
  copyright?: string;
  artist?: string;
}

export interface GpsFix {
  lat: number;
  lng: number;
  altitude?: number;
}

export interface LocationFields {
  /** Sublocation / spot */
  name?: string;
  city?: string;
  /** Province or state */
  region?: string;
  /** Country name as written in the file */
  country?: string;
  /** ISO 3166-1 alpha-2 code when the file has one */
  countryCode?: string;
}

/** Descriptive metadata shared by the XMP and IPTC readers */
export interface Descriptive {
  title?: string;
  headline?: string;
  description?: string;
  altText?: string;
  extendedDescription?: string;
  keywords: string[];
  /** Lightroom hierarchical keywords: "Lieux|Québec|Charlevoix" */
  hierarchicalKeywords: string[];
  location: LocationFields;
  creator?: string;
  rights?: string;
  rating?: number;
  gps?: GpsFix;
}

export interface ImageMetadata extends Descriptive {
  /** Dimensions after EXIF orientation is applied */
  width: number;
  height: number;
  orientation: number;
  exif: ExifSummary;
  /** Raw exif-reader output, used to rebuild EXIF without GPS */
  exifParsed: any | null;
  hasXmp: boolean;
  hasIptc: boolean;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function readImageMetadata(file: string): Promise<ImageMetadata> {
  const meta = await sharp(file).metadata();
  const orientation = meta.orientation ?? 1;
  const swapped = orientation >= 5;
  const width = (swapped ? meta.height : meta.width) ?? 0;
  const height = (swapped ? meta.width : meta.height) ?? 0;

  let exifParsed: any | null = null;
  const exif: ExifSummary = {};
  let gps: GpsFix | undefined;
  if (meta.exif) {
    try {
      exifParsed = exifReader(meta.exif);
      Object.assign(exif, summarizeExif(exifParsed));
      gps = gpsFromExif(exifParsed);
    } catch {
      exifParsed = null;
    }
  }

  const xmp = meta.xmp ? meta.xmp.toString('utf8') : '';
  const fromXmp = xmp ? parseXmp(xmp) : emptyDescriptive();
  const iptc = meta.iptc ? parseIptc(meta.iptc) : {};
  const fromIptc = descriptiveFromIptc(iptc);
  const merged = mergeDescriptive(fromXmp, fromIptc);
  if (!gps && merged.gps) gps = merged.gps;

  return {
    ...merged,
    gps,
    width,
    height,
    orientation,
    exif,
    exifParsed,
    hasXmp: xmp.length > 0,
    hasIptc: Object.keys(iptc).length > 0,
  };
}

export function emptyDescriptive(): Descriptive {
  return { keywords: [], hierarchicalKeywords: [], location: {} };
}

/** YYYY-MM-DD of a capture date, in the camera's local time as EXIF records it */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// EXIF
// ---------------------------------------------------------------------------

function summarizeExif(exif: any): ExifSummary {
  const out: ExifSummary = {};
  const image = exif.Image ?? {};
  const photo = exif.Photo ?? {};

  const make = typeof image.Make === 'string' ? image.Make.trim() : undefined;
  const model = typeof image.Model === 'string' ? image.Model.trim() : undefined;
  if (make) out.make = make;
  if (model) out.model = make && model.startsWith(make) ? model.slice(make.length).trim() : model;
  if (typeof image.Software === 'string') out.software = image.Software.trim();
  if (typeof image.Copyright === 'string') out.copyright = image.Copyright.trim();
  if (typeof image.Artist === 'string') out.artist = image.Artist.trim();

  const lens = typeof photo.LensModel === 'string' ? photo.LensModel.trim() : undefined;
  if (lens && !lens.startsWith('0.0 mm')) out.lens = lens;
  if (typeof photo.FocalLength === 'number' && photo.FocalLength > 0) out.focalLength = Math.round(photo.FocalLength);
  if (typeof photo.FocalLengthIn35mmFilm === 'number' && photo.FocalLengthIn35mmFilm > 0) out.focalLength35mm = photo.FocalLengthIn35mmFilm;
  if (typeof photo.FNumber === 'number' && photo.FNumber > 0) out.aperture = Math.round(photo.FNumber * 10) / 10;
  if (typeof photo.ExposureTime === 'number' && photo.ExposureTime > 0) {
    out.shutterSpeed = photo.ExposureTime >= 1 ? `${photo.ExposureTime}s` : `1/${Math.round(1 / photo.ExposureTime)}`;
  }
  const iso = Array.isArray(photo.ISOSpeedRatings) ? photo.ISOSpeedRatings[0] : photo.ISOSpeedRatings;
  if (typeof iso === 'number' && iso > 0) out.iso = iso;

  const taken = photo.DateTimeOriginal ?? photo.DateTimeDigitized ?? image.DateTime;
  if (taken instanceof Date && !isNaN(taken.valueOf())) out.dateTaken = taken;
  else if (typeof taken === 'string') {
    const parsed = parseExifDate(taken);
    if (parsed) out.dateTaken = parsed;
  }
  return out;
}

/** "2026:02:21 14:03:05" → Date (treated as UTC so the date part survives) */
function parseExifDate(value: string): Date | undefined {
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return isNaN(date.valueOf()) ? undefined : date;
}

function dmsToDecimal(parts: unknown, ref: unknown): number | undefined {
  if (!Array.isArray(parts) || parts.length === 0) return undefined;
  const [d = 0, m = 0, s = 0] = parts.map(Number);
  if ([d, m, s].some(n => isNaN(n))) return undefined;
  const value = d + m / 60 + s / 3600;
  const sign = typeof ref === 'string' && /^[SW]/i.test(ref) ? -1 : 1;
  return sign * value;
}

function gpsFromExif(exif: any): GpsFix | undefined {
  const gps = exif.GPSInfo;
  if (!gps) return undefined;
  const lat = dmsToDecimal(gps.GPSLatitude, gps.GPSLatitudeRef);
  const lng = dmsToDecimal(gps.GPSLongitude, gps.GPSLongitudeRef);
  if (lat === undefined || lng === undefined) return undefined;
  if (lat === 0 && lng === 0) return undefined;
  const fix: GpsFix = { lat, lng };
  if (typeof gps.GPSAltitude === 'number') {
    fix.altitude = gps.GPSAltitudeRef === 1 ? -gps.GPSAltitude : gps.GPSAltitude;
  }
  return fix;
}

/** EXIF date string in the format libvips expects */
function exifDateString(value: unknown): string | undefined {
  if (value instanceof Date && !isNaN(value.valueOf())) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${value.getUTCFullYear()}:${p(value.getUTCMonth() + 1)}:${p(value.getUTCDate())} ${p(value.getUTCHours())}:${p(value.getUTCMinutes())}:${p(value.getUTCSeconds())}`;
  }
  if (typeof value === 'string' && /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}/.test(value)) return value.slice(0, 19);
  return undefined;
}

function rational(value: number, precision = 100): string {
  return `${Math.round(value * precision)}/${precision}`;
}

/**
 * EXIF tags to write back when a file is republished without its GPS block.
 * Keeps what the site shows (camera, lens, exposure, capture date) and the
 * authorship tags; everything else, including maker notes and GPS, is left out.
 */
export function buildExifWithoutGps(exifParsed: any | null): { IFD0: Record<string, string>; IFD2: Record<string, string> } {
  const IFD0: Record<string, string> = {};
  const IFD2: Record<string, string> = {};
  if (!exifParsed) return { IFD0, IFD2 };
  const image = exifParsed.Image ?? {};
  const photo = exifParsed.Photo ?? {};

  for (const tag of ['Make', 'Model', 'Software', 'Copyright', 'Artist', 'ImageDescription']) {
    if (typeof image[tag] === 'string' && image[tag].trim()) IFD0[tag] = image[tag].trim();
  }
  const dateTime = exifDateString(image.DateTime);
  if (dateTime) IFD0.DateTime = dateTime;

  if (typeof photo.ExposureTime === 'number' && photo.ExposureTime > 0) {
    IFD2.ExposureTime = photo.ExposureTime >= 1 ? rational(photo.ExposureTime, 10) : `1/${Math.round(1 / photo.ExposureTime)}`;
  }
  if (typeof photo.FNumber === 'number' && photo.FNumber > 0) IFD2.FNumber = rational(photo.FNumber);
  if (typeof photo.ExposureProgram === 'number') IFD2.ExposureProgram = String(photo.ExposureProgram);
  const iso = Array.isArray(photo.ISOSpeedRatings) ? photo.ISOSpeedRatings[0] : photo.ISOSpeedRatings;
  if (typeof iso === 'number' && iso > 0) IFD2.ISOSpeedRatings = String(iso);
  const original = exifDateString(photo.DateTimeOriginal);
  if (original) IFD2.DateTimeOriginal = original;
  const digitized = exifDateString(photo.DateTimeDigitized);
  if (digitized) IFD2.DateTimeDigitized = digitized;
  if (typeof photo.ExposureBiasValue === 'number') IFD2.ExposureBiasValue = rational(photo.ExposureBiasValue, 10);
  if (typeof photo.FocalLength === 'number' && photo.FocalLength > 0) IFD2.FocalLength = rational(photo.FocalLength);
  if (typeof photo.FocalLengthIn35mmFilm === 'number' && photo.FocalLengthIn35mmFilm > 0) IFD2.FocalLengthIn35mmFilm = String(photo.FocalLengthIn35mmFilm);
  for (const tag of ['LensMake', 'LensModel']) {
    if (typeof photo[tag] === 'string' && photo[tag].trim()) IFD2[tag] = photo[tag].trim();
  }
  return { IFD0, IFD2 };
}

// ---------------------------------------------------------------------------
// XMP
// ---------------------------------------------------------------------------

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return isNaN(code) ? match : String.fromCodePoint(code);
    }
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    return named[entity.toLowerCase()] ?? match;
  });
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const clean = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim();
  return text || undefined;
};

/** Attribute form: prop="value" */
function xmpAttr(xml: string, prop: string): string | undefined {
  const m = xml.match(new RegExp(`\\s${escapeRegex(prop)}=(?:"([^"]*)"|'([^']*)')`));
  return m ? clean(m[1] ?? m[2]) : undefined;
}

/** Element block: <prop ...>inner</prop> */
function xmpBlock(xml: string, prop: string): string | undefined {
  const m = xml.match(new RegExp(`<${escapeRegex(prop)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegex(prop)}>`));
  return m ? m[1] : undefined;
}

/** Simple text property in either attribute or element form */
function xmpText(xml: string, prop: string): string | undefined {
  const attr = xmpAttr(xml, prop);
  if (attr !== undefined) return attr;
  const block = xmpBlock(xml, prop);
  if (block === undefined || /<rdf:/.test(block)) return undefined;
  return clean(block.replace(/<[^>]+>/g, ''));
}

/** Language alternative (rdf:Alt); x-default wins, then the first language */
function xmpAlt(xml: string, prop: string): { value?: string; byLang: Record<string, string> } | undefined {
  const block = xmpBlock(xml, prop);
  if (block === undefined) {
    const attr = xmpAttr(xml, prop);
    return attr !== undefined ? { value: attr, byLang: {} } : undefined;
  }
  const byLang: Record<string, string> = {};
  let value: string | undefined;
  for (const li of block.matchAll(/<rdf:li([^>]*)>([\s\S]*?)<\/rdf:li>/g)) {
    const lang = (li[1].match(/xml:lang=(?:"([^"]*)"|'([^']*)')/)?.[1] ?? 'x-default').toLowerCase();
    const text = clean(li[2].replace(/<[^>]+>/g, ''));
    if (!text) continue;
    if (lang === 'x-default') value = text;
    else byLang[lang] = text;
  }
  if (value === undefined && !/<rdf:/.test(block)) value = clean(block.replace(/<[^>]+>/g, ''));
  if (value === undefined) value = Object.values(byLang)[0];
  return value === undefined ? undefined : { value, byLang };
}

/** Unordered/ordered list (rdf:Bag / rdf:Seq) of plain text items */
function xmpList(xml: string, prop: string): string[] {
  const block = xmpBlock(xml, prop);
  if (block === undefined) return [];
  return [...block.matchAll(/<rdf:li(?:\s[^>]*)?>([\s\S]*?)<\/rdf:li>/g)]
    .map(m => clean(m[1].replace(/<[^>]+>/g, '')))
    .filter((v): v is string => Boolean(v));
}

/** First structure of a list property (LocationShown / LocationCreated) */
function xmpFirstStruct(xml: string, prop: string): string | undefined {
  const block = xmpBlock(xml, prop);
  if (block === undefined) return undefined;
  const li = block.match(/<rdf:li\b[\s\S]*?(?:\/>|<\/rdf:li>)/);
  return li ? li[0] : block;
}

/** XMP GPS: "46,45.7558N" or "46,45,45.35N" */
function parseXmpCoordinate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = value.trim().match(/^(\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?))?(?:,(\d+(?:\.\d+)?))?\s*([NSEW])$/i);
  if (!m) return undefined;
  const degrees = Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0) + (m[3] ? Number(m[3]) / 3600 : 0);
  return /[SW]/i.test(m[4]) ? -degrees : degrees;
}

export function parseXmp(xmp: string): Descriptive {
  const out = emptyDescriptive();
  out.title = xmpAlt(xmp, 'dc:title')?.value;
  out.description = xmpAlt(xmp, 'dc:description')?.value;
  out.headline = xmpText(xmp, 'photoshop:Headline');
  out.altText = xmpAlt(xmp, 'Iptc4xmpCore:AltTextAccessibility')?.value;
  out.extendedDescription = xmpAlt(xmp, 'Iptc4xmpCore:ExtDescrAccessibility')?.value;
  out.keywords = xmpList(xmp, 'dc:subject');
  out.hierarchicalKeywords = xmpList(xmp, 'lr:hierarchicalSubject');
  out.creator = xmpList(xmp, 'dc:creator')[0];
  out.rights = xmpAlt(xmp, 'dc:rights')?.value;
  const rating = xmpText(xmp, 'xmp:Rating');
  if (rating && !isNaN(Number(rating))) out.rating = Number(rating);

  // Lightroom's Location panel writes the IPTC Core fields; the IPTC
  // Extension panel writes LocationCreated / LocationShown structures.
  const location: LocationFields = {
    name: xmpText(xmp, 'Iptc4xmpCore:Location'),
    city: xmpText(xmp, 'photoshop:City'),
    region: xmpText(xmp, 'photoshop:State'),
    country: xmpText(xmp, 'photoshop:Country'),
    countryCode: xmpText(xmp, 'Iptc4xmpCore:CountryCode'),
  };
  for (const prop of ['Iptc4xmpExt:LocationCreated', 'Iptc4xmpExt:LocationShown']) {
    const struct = xmpFirstStruct(xmp, prop);
    if (!struct) continue;
    location.name ??= xmpText(struct, 'Iptc4xmpExt:Sublocation');
    location.city ??= xmpText(struct, 'Iptc4xmpExt:City');
    location.region ??= xmpText(struct, 'Iptc4xmpExt:ProvinceState');
    location.country ??= xmpText(struct, 'Iptc4xmpExt:CountryName');
    location.countryCode ??= xmpText(struct, 'Iptc4xmpExt:CountryCode');
  }
  out.location = location;

  const lat = parseXmpCoordinate(xmpText(xmp, 'exif:GPSLatitude'));
  const lng = parseXmpCoordinate(xmpText(xmp, 'exif:GPSLongitude'));
  if (lat !== undefined && lng !== undefined && !(lat === 0 && lng === 0)) out.gps = { lat, lng };

  return out;
}

// ---------------------------------------------------------------------------
// IPTC-IIM (Photoshop APP13 segment)
// ---------------------------------------------------------------------------

/** Record:dataset → values, e.g. "2:25" → keywords */
export function parseIptc(buffer: Buffer): Record<string, string[]> {
  let iim: Buffer | undefined;
  if (buffer.subarray(0, 13).toString('latin1') === 'Photoshop 3.0') {
    let i = 14;
    while (i + 12 <= buffer.length) {
      if (buffer.subarray(i, i + 4).toString('latin1') !== '8BIM') break;
      const id = buffer.readUInt16BE(i + 4);
      i += 6;
      const nameLength = buffer[i];
      i += 1 + nameLength + ((1 + nameLength) % 2);
      const size = buffer.readUInt32BE(i);
      i += 4;
      if (id === 0x0404) {
        iim = buffer.subarray(i, i + size);
        break;
      }
      i += size + (size % 2);
    }
  } else if (buffer[0] === 0x1c) {
    iim = buffer;
  }
  if (!iim) return {};

  const out: Record<string, string[]> = {};
  let i = 0;
  while (i + 5 <= iim.length) {
    if (iim[i] !== 0x1c) { i++; continue; }
    const record = iim[i + 1];
    const dataset = iim[i + 2];
    let length = iim.readUInt16BE(i + 3);
    i += 5;
    if (length & 0x8000) {
      const bytes = length & 0x7fff;
      length = 0;
      for (let k = 0; k < bytes; k++) length = length * 256 + iim[i + k];
      i += bytes;
    }
    const data = iim.subarray(i, i + length);
    i += length;
    const key = `${record}:${dataset}`;
    (out[key] ??= []).push(data.toString('utf8'));
  }
  return out;
}

function descriptiveFromIptc(iptc: Record<string, string[]>): Descriptive {
  const out = emptyDescriptive();
  const one = (key: string) => clean(iptc[key]?.[0]);
  out.title = one('2:5');
  out.headline = one('2:105');
  out.description = one('2:120');
  out.keywords = (iptc['2:25'] ?? []).map(k => clean(k)).filter((v): v is string => Boolean(v));
  out.creator = one('2:80');
  out.rights = one('2:116');
  out.location = {
    name: one('2:92'),
    city: one('2:90'),
    region: one('2:95'),
    country: one('2:101'),
    countryCode: one('2:100'),
  };
  return out;
}

/** XMP values win; IPTC fills what XMP left empty */
function mergeDescriptive(primary: Descriptive, fallback: Descriptive): Descriptive {
  const keywords = [...primary.keywords];
  for (const keyword of fallback.keywords) {
    if (!keywords.some(k => k.localeCompare(keyword, undefined, { sensitivity: 'accent' }) === 0)) keywords.push(keyword);
  }
  return {
    title: primary.title ?? fallback.title,
    headline: primary.headline ?? fallback.headline,
    description: primary.description ?? fallback.description,
    altText: primary.altText ?? fallback.altText,
    extendedDescription: primary.extendedDescription ?? fallback.extendedDescription,
    keywords,
    hierarchicalKeywords: primary.hierarchicalKeywords,
    location: {
      name: primary.location.name ?? fallback.location.name,
      city: primary.location.city ?? fallback.location.city,
      region: primary.location.region ?? fallback.location.region,
      country: primary.location.country ?? fallback.location.country,
      countryCode: primary.location.countryCode ?? fallback.location.countryCode,
    },
    creator: primary.creator ?? fallback.creator,
    rights: primary.rights ?? fallback.rights,
    rating: primary.rating ?? fallback.rating,
    gps: primary.gps ?? fallback.gps,
  };
}
