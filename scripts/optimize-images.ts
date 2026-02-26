/**
 * Image Optimization Script
 *
 * Processes images in public/images/uploads/ and generates:
 * - Responsive sizes (400, 800, 1200, 2400px width)
 * - AVIF and WebP formats
 * - A manifest file for component consumption
 *
 * Run: npx tsx scripts/optimize-images.ts
 * Or via: npm run optimize-images
 */

import sharp from 'sharp';
import { readdir, mkdir, writeFile, readFile, stat } from 'fs/promises';
import { join, parse, extname } from 'path';
import { existsSync } from 'fs';

// Configuration
const CONFIG = {
  inputDir: 'public/images/uploads',
  outputDir: 'public/images/optimized',
  manifestPath: 'src/data/image-manifest.json',
  widths: [400, 800, 1200, 2400],
  formats: ['avif', 'webp', 'jpg'] as const,
  quality: {
    avif: 75,
    webp: 80,
    jpg: 85,
  },
};

interface ImageVariant {
  width: number;
  format: string;
  path: string;
  size: number;
}

interface ImageEntry {
  original: string;
  width: number;
  height: number;
  aspectRatio: number;
  variants: ImageVariant[];
  srcset: {
    avif: string;
    webp: string;
    jpg: string;
  };
  /** Source file modification time for cache invalidation */
  mtime: number;
}

interface ImageManifest {
  [originalPath: string]: ImageEntry;
}

async function loadExistingManifest(): Promise<ImageManifest> {
  try {
    if (existsSync(CONFIG.manifestPath)) {
      const data = await readFile(CONFIG.manifestPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('⚠️  Could not load existing manifest, will regenerate all images');
  }
  return {};
}

async function needsRegeneration(
  imagePath: string,
  existingManifest: ImageManifest
): Promise<boolean> {
  const relativePath = imagePath.replace('public', '');
  const existing = existingManifest[relativePath];

  if (!existing || !existing.mtime) {
    return true; // Not in manifest or no mtime, needs processing
  }

  // Check if source file has been modified
  const stats = await stat(imagePath);
  const sourceMtime = stats.mtimeMs;

  if (sourceMtime > existing.mtime) {
    return true; // Source file is newer than last processed
  }

  // Check if all variant files still exist
  for (const variant of existing.variants) {
    const variantPath = join('public', variant.path);
    if (!existsSync(variantPath)) {
      return true; // Variant file missing
    }
  }

  return false; // All good, skip this image
}

async function getImageFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getImageFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function processImage(
  inputPath: string,
  outputDir: string
): Promise<{ variants: ImageVariant[]; metadata: sharp.Metadata }> {
  const variants: ImageVariant[] = [];
  const { name } = parse(inputPath);

  // Get original image metadata
  const metadata = await sharp(inputPath).metadata();
  const originalWidth = metadata.width || 2400;

  // Process each width
  for (const width of CONFIG.widths) {
    // Skip if original is smaller than target width
    if (width > originalWidth) continue;

    // Process each format
    for (const format of CONFIG.formats) {
      const outputFileName = `${name}-${width}.${format}`;
      const outputPath = join(outputDir, outputFileName);
      const publicPath = outputPath.replace('public', '');

      let pipeline = sharp(inputPath)
        .resize(width, null, {
          withoutEnlargement: true,
          fit: 'inside',
        });

      // Apply format-specific settings
      if (format === 'avif') {
        pipeline = pipeline.avif({ quality: CONFIG.quality.avif, effort: 4 });
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality: CONFIG.quality.webp, effort: 4 });
      } else {
        pipeline = pipeline.jpeg({ quality: CONFIG.quality.jpg, mozjpeg: true });
      }

      await pipeline.toFile(outputPath);

      const stats = await stat(outputPath);

      variants.push({
        width,
        format,
        path: publicPath,
        size: stats.size,
      });
    }
  }

  return { variants, metadata };
}

function generateSrcset(variants: ImageVariant[]): { avif: string; webp: string; jpg: string } {
  const srcset = { avif: '', webp: '', jpg: '' };

  for (const format of ['avif', 'webp', 'jpg'] as const) {
    const formatVariants = variants
      .filter(v => v.format === format)
      .sort((a, b) => a.width - b.width);

    srcset[format] = formatVariants
      .map(v => `${v.path} ${v.width}w`)
      .join(', ');
  }

  return srcset;
}

async function main() {
  console.log('🖼️  Starting image optimization...\n');

  // Create output directory
  if (!existsSync(CONFIG.outputDir)) {
    await mkdir(CONFIG.outputDir, { recursive: true });
  }

  // Create data directory for manifest
  const dataDir = 'src/data';
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }

  // Load existing manifest for cache comparison
  const existingManifest = await loadExistingManifest();

  // Get all images
  const images = await getImageFiles(CONFIG.inputDir);
  console.log(`📁 Found ${images.length} images\n`);

  // Start with existing manifest (preserves unchanged images)
  const manifest: ImageManifest = { ...existingManifest };
  let totalSaved = 0;
  let processed = 0;
  let skipped = 0;

  for (const imagePath of images) {
    const relativePath = imagePath.replace('public', '');
    const { name } = parse(imagePath);

    // Check if image needs regeneration
    const needsRegen = await needsRegeneration(imagePath, existingManifest);

    if (!needsRegen) {
      console.log(`⏭️  Skipping: ${name} (unchanged)`);
      skipped++;
      continue;
    }

    console.log(`Processing: ${name}...`);

    try {
      const { variants, metadata } = await processImage(imagePath, CONFIG.outputDir);

      const originalStats = await stat(imagePath);
      const savings = originalStats.size - (variants.find(v => v.format === 'avif' && v.width === 1200)?.size || 0);
      totalSaved += savings;

      manifest[relativePath] = {
        original: relativePath,
        width: metadata.width || 0,
        height: metadata.height || 0,
        aspectRatio: metadata.width && metadata.height
          ? Math.round((metadata.width / metadata.height) * 100) / 100
          : 1,
        variants,
        srcset: generateSrcset(variants),
        mtime: originalStats.mtimeMs,
      };

      console.log(`  ✅ Generated ${variants.length} variants`);
      processed++;
    } catch (error) {
      console.error(`  ❌ Error processing ${name}:`, error);
    }
  }

  // Clean up manifest entries for deleted source images
  for (const key of Object.keys(manifest)) {
    const sourcePath = join('public', key);
    if (!existsSync(sourcePath)) {
      console.log(`🗑️  Removing from manifest: ${key} (source deleted)`);
      delete manifest[key];
    }
  }

  // Write manifest
  await writeFile(
    CONFIG.manifestPath,
    JSON.stringify(manifest, null, 2)
  );

  console.log('\n✨ Optimization complete!');
  console.log(`📊 Total images: ${images.length}`);
  console.log(`📊 Processed: ${processed} | Skipped (cached): ${skipped}`);
  if (processed > 0) {
    console.log(`💾 Estimated savings: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
  }
  console.log(`📝 Manifest saved to: ${CONFIG.manifestPath}`);
}

main().catch(console.error);
