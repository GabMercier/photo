/**
 * Prebuild Script: Extract EXIF Data
 *
 * Reads EXIF metadata from all JPEG images in public/images/uploads/
 * and writes a manifest to src/data/exif-manifest.json.
 *
 * - Uses Sharp to read raw EXIF buffer, exif-reader to parse it
 * - Mtime-based caching (skips unchanged images)
 * - Keyed by image path (e.g., "/images/uploads/photo.jpg")
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';
import exifReader from 'exif-reader';

const UPLOADS_DIR = 'public/images/uploads';
const POSTS_DIR = 'src/content/posts';
const MANIFEST_PATH = 'src/data/exif-manifest.json';

interface ExifEntry {
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

type ExifManifest = Record<string, ExifEntry>;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Convert exposure time (decimal seconds) to human-readable fraction */
function formatShutterSpeed(exposureTime: number): string {
  if (exposureTime >= 1) return `${exposureTime}s`;
  const denominator = Math.round(1 / exposureTime);
  return `1/${denominator}`;
}

/** Clean up camera model string (remove redundant make prefix) */
function cleanModel(make: string | undefined, model: string | undefined): string | undefined {
  if (!model) return undefined;
  if (make && model.startsWith(make)) {
    return model.slice(make.length).trim();
  }
  return model;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('📷 Extracting EXIF data from uploaded images...\n');

  // Load existing manifest
  let manifest: ExifManifest = {};
  if (existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf-8'));
  }

  // Scan uploads directory
  if (!existsSync(UPLOADS_DIR)) {
    console.log('  ⚠️  No uploads directory found, skipping.');
    return;
  }

  const files = (await readdir(UPLOADS_DIR))
    .filter(f => /\.(jpe?g)$/i.test(f));

  let extracted = 0;
  let skipped = 0;
  const seenPaths = new Set<string>();

  for (const file of files) {
    const filePath = join(UPLOADS_DIR, file);
    const publicPath = `/images/uploads/${file}`;
    const manifestKey = publicPath.toLowerCase();
    seenPaths.add(manifestKey);

    // Check mtime
    const fileStat = await stat(filePath);
    const mtime = fileStat.mtimeMs;

    if (manifest[manifestKey] && manifest[manifestKey].mtime === mtime) {
      skipped++;
      continue;
    }

    // Extract EXIF
    try {
      const metadata = await sharp(filePath).metadata();

      if (!metadata.exif) {
        console.log(`  ⚠️  No EXIF data: ${file}`);
        manifest[manifestKey] = { mtime };
        extracted++;
        continue;
      }

      const exif = exifReader(metadata.exif);

      const entry: ExifEntry = { mtime };

      // Camera
      const make = exif.Image?.Make as string | undefined;
      const model = exif.Image?.Model as string | undefined;
      if (make) entry.cameraMake = make.trim();
      if (model) entry.cameraModel = cleanModel(make?.trim(), model.trim());

      // Lens (filter out "0.0 mm f/0.0" from manual/legacy lenses)
      const lens = exif.Photo?.LensModel as string | undefined;
      if (lens && !lens.startsWith('0.0 mm')) entry.lens = lens.trim();

      // Focal length
      const fl = exif.Photo?.FocalLength as number | undefined;
      if (fl) entry.focalLength = Math.round(fl);

      const fl35 = exif.Photo?.FocalLengthIn35mmFilm as number | undefined;
      if (fl35) entry.focalLength35mm = fl35;

      // Aperture
      const fNumber = exif.Photo?.FNumber as number | undefined;
      if (fNumber) entry.aperture = Math.round(fNumber * 10) / 10;

      // Shutter speed
      const exposureTime = exif.Photo?.ExposureTime as number | undefined;
      if (exposureTime) entry.shutterSpeed = formatShutterSpeed(exposureTime);

      // ISO
      const isoArr = exif.Photo?.ISOSpeedRatings as number | number[] | undefined;
      const iso = Array.isArray(isoArr) ? isoArr[0] : isoArr;
      if (iso) entry.iso = iso;

      // Date taken
      const dateTaken = exif.Photo?.DateTimeOriginal as Date | string | undefined;
      if (dateTaken) {
        entry.dateTaken = dateTaken instanceof Date
          ? dateTaken.toISOString()
          : String(dateTaken);
      }

      manifest[manifestKey] = entry;
      const summary = [
        entry.cameraModel || entry.cameraMake,
        entry.focalLength && `${entry.focalLength}mm`,
        entry.aperture && `f/${entry.aperture}`,
        entry.shutterSpeed,
        entry.iso && `ISO ${entry.iso}`,
      ].filter(Boolean).join(' · ');

      console.log(`  ✅ ${file} → ${summary || '(minimal data)'}`);
      extracted++;
    } catch (err) {
      console.log(`  ⚠️  Failed to read EXIF: ${file} (${err instanceof Error ? err.message : err})`);
      manifest[manifestKey] = { mtime };
      extracted++;
    }
  }

  // Clean up manifest entries for deleted images
  for (const key of Object.keys(manifest)) {
    if (!seenPaths.has(key)) {
      delete manifest[key];
    }
  }

  // Save manifest
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  console.log(`\n📊 Images: ${extracted} processed | ${skipped} cached`);

  // -------------------------------------------------------------------------
  // Pass 2: Fill post dates + exifSummary from EXIF
  // -------------------------------------------------------------------------
  console.log('\n📅 Syncing EXIF data to posts...\n');

  const postFiles = (await readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
  let datesFilled = 0;
  let dateTakenFilled = 0;
  let summaryFilled = 0;

  for (const file of postFiles) {
    const filePath = join(POSTS_DIR, file);
    const content = await readFile(filePath, 'utf-8');

    // Parse frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;

    const yaml = fmMatch[1];
    const body = content.slice(fmMatch[0].length);

    // Get cover image path
    const srcMatch = yaml.match(/coverImage:[\s\S]*?src:\s*(.+?)$/m);
    if (!srcMatch) continue;
    const imageSrc = srcMatch[1].trim().replace(/^['"]|['"]$/g, '');

    // Look up EXIF from manifest
    const manifestKey = imageSrc.toLowerCase();
    const exifEntry = manifest[manifestKey];
    if (!exifEntry) continue;

    let updated = false;
    let lines = yaml.split('\n');

    // Build EXIF summary string
    const summaryStr = [
      exifEntry.cameraModel || exifEntry.cameraMake,
      exifEntry.lens,
      exifEntry.focalLength && `${exifEntry.focalLength}mm`,
      exifEntry.aperture && `f/${exifEntry.aperture}`,
      exifEntry.shutterSpeed,
      exifEntry.iso && `ISO ${exifEntry.iso}`,
    ].filter(Boolean).join('  ·  ');

    if (summaryStr) {
      const summaryLineIdx = lines.findIndex(l => /^exifSummary:/.test(l));
      const quotedSummary = `exifSummary: '${summaryStr.replace(/'/g, "''")}'`;
      if (summaryLineIdx >= 0) {
        if (lines[summaryLineIdx] !== quotedSummary) {
          lines[summaryLineIdx] = quotedSummary;
          updated = true;
          summaryFilled++;
        }
      } else {
        // Insert after showExif or dateTaken or date
        const afterField = lines.findIndex(l => /^showExif:/.test(l))
          ?? lines.findIndex(l => /^dateTaken:/.test(l))
          ?? lines.findIndex(l => /^date:/.test(l));
        if (afterField >= 0) {
          lines.splice(afterField + 1, 0, quotedSummary);
        } else {
          lines.push(quotedSummary);
        }
        updated = true;
        summaryFilled++;
      }
    }

    // Date filling requires dateTaken in EXIF
    const exifDate = exifEntry.dateTaken?.slice(0, 10);

    if (exifDate) {
      // Check if date field is missing or empty
      const dateLineIdx = lines.findIndex(l => /^date:/.test(l));
      const dateValue = dateLineIdx >= 0
        ? lines[dateLineIdx].replace(/^date:\s*/, '').replace(/^['"]|['"]$/g, '').trim()
        : '';

      if (!dateValue || dateValue === 'null' || dateValue === '""' || dateValue === "''") {
        if (dateLineIdx >= 0) {
          lines[dateLineIdx] = `date: ${exifDate}`;
        } else {
          const coverIdx = lines.findIndex(l => /^coverImage:/.test(l));
          let insertAt = lines.length;
          if (coverIdx >= 0) {
            for (let i = coverIdx + 1; i < lines.length; i++) {
              if (/^\S/.test(lines[i])) { insertAt = i; break; }
            }
          }
          lines.splice(insertAt, 0, `date: ${exifDate}`);
        }
        updated = true;
        datesFilled++;
        console.log(`  📅 ${file} → date: ${exifDate} (from EXIF)`);
      }

      // Write dateTaken field
      const dateTakenLineIdx = lines.findIndex(l => /^dateTaken:/.test(l));
      if (dateTakenLineIdx >= 0) {
        const existing = lines[dateTakenLineIdx].replace(/^dateTaken:\s*/, '').replace(/^['"]|['"]$/g, '').trim();
        if (existing !== exifDate) {
          lines[dateTakenLineIdx] = `dateTaken: ${exifDate}`;
          updated = true;
          dateTakenFilled++;
        }
      } else {
        const newDateIdx = lines.findIndex(l => /^date:/.test(l));
        if (newDateIdx >= 0) {
          lines.splice(newDateIdx + 1, 0, `dateTaken: ${exifDate}`);
        } else {
          lines.push(`dateTaken: ${exifDate}`);
        }
        updated = true;
        dateTakenFilled++;
      }
    }

    if (updated) {
      const newContent = `---\n${lines.join('\n')}\n---${body}`;
      await writeFile(filePath, newContent, 'utf-8');
    }
  }

  console.log(`\n✨ EXIF extraction complete!`);
  console.log(`📅 Dates filled: ${datesFilled} | dateTaken synced: ${dateTakenFilled} | summaries: ${summaryFilled}`);
}

main().catch((err) => {
  console.error('❌ EXIF extraction failed:', err);
  process.exit(1);
});
