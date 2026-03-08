/**
 * EXIF Data Utilities
 *
 * Provides helpers to look up EXIF metadata for an image
 * from the build-time manifest.
 *
 * Follows the same pattern as depthMap.ts.
 */

let manifest: ExifManifest | null = null;

export interface ExifEntry {
  cameraMake?: string;
  cameraModel?: string;
  lens?: string;
  focalLength?: number;
  focalLength35mm?: number;
  aperture?: number;
  shutterSpeed?: string;
  iso?: number;
  dateTaken?: string;
  mtime: number;
}

interface ExifManifest {
  [imagePath: string]: ExifEntry;
}

async function loadManifest(): Promise<ExifManifest> {
  if (manifest) return manifest;

  try {
    const data = await import('../data/exif-manifest.json');
    manifest = data.default as ExifManifest;
    return manifest;
  } catch {
    return {};
  }
}

/**
 * Get EXIF data for an image, or null if none exists.
 *
 * @param imagePath - Original image path (e.g., '/images/uploads/photo.jpg')
 */
export async function getExifData(imagePath: string): Promise<ExifEntry | null> {
  const exifManifest = await loadManifest();
  return exifManifest[imagePath] || exifManifest[imagePath.toLowerCase()] || null;
}

/** Format camera display string (model only, or make if no model) */
export function formatCamera(exif: ExifEntry): string {
  return exif.cameraModel || exif.cameraMake || '';
}

/** Build a compact one-line EXIF summary */
export function formatExifSummary(exif: ExifEntry, fields: ExifFieldKey[]): string {
  const parts: string[] = [];
  for (const field of fields) {
    const val = formatExifField(exif, field);
    if (val) parts.push(val);
  }
  return parts.join('  ·  ');
}

/** Format a single EXIF field for display */
export function formatExifField(exif: ExifEntry, field: ExifFieldKey): string | null {
  switch (field) {
    case 'camera':
      return formatCamera(exif) || null;
    case 'lens':
      return exif.lens || null;
    case 'focalLength':
      return exif.focalLength ? `${exif.focalLength}mm` : null;
    case 'aperture':
      return exif.aperture ? `f/${exif.aperture}` : null;
    case 'shutterSpeed':
      return exif.shutterSpeed || null;
    case 'iso':
      return exif.iso ? `ISO ${exif.iso}` : null;
    case 'dateTaken':
      return exif.dateTaken ? new Date(exif.dateTaken).toLocaleDateString() : null;
    default:
      return null;
  }
}

export const EXIF_FIELD_KEYS = [
  'camera', 'lens', 'focalLength', 'aperture', 'shutterSpeed', 'iso', 'dateTaken'
] as const;

export type ExifFieldKey = typeof EXIF_FIELD_KEYS[number];

export interface ExifOverrides {
  camera?: string | null;
  lens?: string | null;
  focalLength?: string | null;
  aperture?: string | null;
  shutterSpeed?: string | null;
  iso?: string | null;
}

/**
 * Merge auto-extracted EXIF with manual overrides.
 * Manual overrides always take precedence over auto-extracted values.
 * Returns a new ExifEntry (or creates one from overrides alone if no auto data).
 */
export function mergeExifWithOverrides(
  auto: ExifEntry | null,
  overrides: ExifOverrides | null | undefined
): ExifEntry | null {
  if (!overrides || Object.values(overrides).every(v => !v)) return auto;

  const merged: ExifEntry = auto ? { ...auto } : { mtime: 0 };

  if (overrides.camera) merged.cameraModel = overrides.camera;
  if (overrides.lens) merged.lens = overrides.lens;
  if (overrides.focalLength) merged.focalLength = parseInt(overrides.focalLength);
  if (overrides.aperture) {
    const num = parseFloat(overrides.aperture.replace(/^f\/?/i, ''));
    if (!isNaN(num)) merged.aperture = num;
  }
  if (overrides.shutterSpeed) merged.shutterSpeed = overrides.shutterSpeed;
  if (overrides.iso) merged.iso = parseInt(overrides.iso);

  return merged;
}
