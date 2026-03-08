/**
 * Prebuild Script: Extract Glow Colors
 *
 * Extracts the dominant color from each post's cover image and writes
 * a hex string into the frontmatter as `glowColor`. This makes the color
 * visible/editable in the CMS and avoids runtime extraction during builds.
 *
 * - Uses Sharp-based extraction from src/utils/extractColors.ts
 * - Mtime-based caching via glow-manifest.json
 * - Respects manual CMS overrides (won't overwrite if image unchanged)
 * - Writes #5A5A5A for grayscale/B&W images
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { extractColorMetadata } from '../src/utils/extractColors.js';

const POSTS_DIR = 'src/content/posts';
const MANIFEST_PATH = 'src/data/glow-manifest.json';
const NEUTRAL_HEX = '#5A5A5A';

interface ManifestEntry {
  imageSrc: string;
  autoHex: string;
  imageMtime: number;
}

type Manifest = Record<string, ManifestEntry>;

// ---------------------------------------------------------------------------
// Frontmatter helpers
// ---------------------------------------------------------------------------

/** Extract YAML frontmatter string from a markdown file */
function parseFrontmatter(content: string): { yaml: string; body: string; fullMatch: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return {
    yaml: match[1],
    body: content.slice(match[0].length),
    fullMatch: match[0],
  };
}

/** Read a simple YAML value (e.g., coverImage.src) from raw YAML text */
function readYamlField(yaml: string, field: string): string | null {
  // Handle nested fields like coverImage.src
  const parts = field.split('.');
  if (parts.length === 1) {
    const match = yaml.match(new RegExp(`^${field}:\\s*['"]?(.+?)['"]?\\s*$`, 'm'));
    return match ? match[1] : null;
  }

  // Find the parent object block
  const parentRegex = new RegExp(`^${parts[0]}:\\s*$`, 'm');
  const parentMatch = parentRegex.exec(yaml);
  if (!parentMatch) return null;

  // Find the child field within the indented block
  const afterParent = yaml.slice(parentMatch.index + parentMatch[0].length);
  const childRegex = new RegExp(`^\\s+${parts[1]}:\\s*['"]?(.+?)['"]?\\s*$`, 'm');
  const childMatch = childRegex.exec(afterParent);
  return childMatch ? childMatch[1] : null;
}

/** Read glowColor value from frontmatter */
function readGlowColor(yaml: string): string | null {
  const match = yaml.match(/^glowColor:\s*['"](.+?)['"]\s*$/m);
  return match ? match[1] : null;
}

/**
 * Update or insert glowColor in frontmatter YAML.
 * Returns the updated full file content.
 */
function writeGlowColor(content: string, hex: string): string {
  const parsed = parseFrontmatter(content);
  if (!parsed) return content;

  let { yaml } = parsed;

  // If glowColor line already exists, replace it
  if (/^glowColor:/m.test(yaml)) {
    yaml = yaml.replace(/^glowColor:.*$/m, `glowColor: '${hex}'`);
  } else {
    // Insert after the coverImage block (find first non-indented line after coverImage:)
    const lines = yaml.split('\n');
    let insertIndex = -1;
    let inCoverImage = false;

    for (let i = 0; i < lines.length; i++) {
      if (/^coverImage:/.test(lines[i])) {
        inCoverImage = true;
        continue;
      }
      if (inCoverImage && /^\S/.test(lines[i])) {
        // First non-indented line after coverImage block
        insertIndex = i;
        break;
      }
    }

    if (insertIndex >= 0) {
      lines.splice(insertIndex, 0, `glowColor: '${hex}'`);
    } else {
      // Fallback: append before end of frontmatter
      lines.push(`glowColor: '${hex}'`);
    }

    yaml = lines.join('\n');
  }

  return `---\n${yaml}\n---${parsed.body}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🎨 Extracting glow colors from cover images...\n');

  // Load manifest
  let manifest: Manifest = {};
  if (existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf-8'));
  }

  // Scan posts
  const files = (await readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
  let extracted = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = join(POSTS_DIR, file);
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseFrontmatter(content);
    if (!parsed) {
      console.log(`  ⚠️  No frontmatter: ${file}`);
      continue;
    }

    // Get cover image path
    const imageSrc = readYamlField(parsed.yaml, 'coverImage.src');
    if (!imageSrc) {
      console.log(`  ⚠️  No coverImage.src: ${file}`);
      continue;
    }

    // Get image file mtime
    const imageFullPath = join('public', imageSrc);
    if (!existsSync(imageFullPath)) {
      console.log(`  ⚠️  Image not found: ${imageSrc} (${file})`);
      continue;
    }
    const imageStat = await stat(imageFullPath);
    const imageMtime = imageStat.mtimeMs;

    // Check manifest
    const manifestEntry = manifest[file];
    const existingGlow = readGlowColor(parsed.yaml);

    if (manifestEntry && manifestEntry.imageMtime === imageMtime) {
      if (existingGlow) {
        // Image unchanged and glowColor exists — skip (may be manually overridden)
        skipped++;
        continue;
      }
      // Image unchanged but glowColor was removed — re-insert from manifest
    } else if (manifestEntry && manifestEntry.imageMtime !== imageMtime) {
      // Image changed — re-extract regardless of existing glowColor
    }

    // Extract color
    const colorMeta = await extractColorMetadata(imageSrc);
    const hex = colorMeta.colorFamily === 'neutral' ? NEUTRAL_HEX : colorMeta.hex;

    // Update frontmatter if needed
    if (existingGlow !== hex) {
      const updated = writeGlowColor(content, hex);
      await writeFile(filePath, updated, 'utf-8');
      console.log(`  ✅ ${file} → ${hex}${colorMeta.colorFamily === 'neutral' ? ' (grayscale)' : ''}`);
    } else {
      console.log(`  ⏭️  ${file} (unchanged)`);
    }

    // Update manifest
    manifest[file] = { imageSrc, autoHex: hex, imageMtime };
    extracted++;
  }

  // Clean up manifest entries for deleted posts
  for (const key of Object.keys(manifest)) {
    if (!files.includes(key)) {
      delete manifest[key];
    }
  }

  // Save manifest
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  console.log(`\n✨ Glow color extraction complete!`);
  console.log(`📊 Processed: ${extracted} | Skipped (cached): ${skipped}`);
}

main().catch((err) => {
  console.error('❌ Glow color extraction failed:', err);
  process.exit(1);
});
