import sharp from 'sharp';
import { join } from 'path';

export interface DominantColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

export type ColorFamily = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink' | 'neutral';
export type ColorMood = 'light' | 'dark' | 'balanced';

export interface ColorMetadata extends DominantColor {
  colorFamily: ColorFamily;
  mood: ColorMood;
  lightness: number; // 0-100
}

/**
 * Determine color family from hue angle (0-360)
 * Maps continuous hue to discrete color categories
 */
export function getColorFamily(hue: number, saturation: number): ColorFamily {
  // Low saturation = neutral (grayscale or near-grayscale)
  if (saturation < 10) return 'neutral';

  // Map hue to color family
  if (hue < 15 || hue >= 345) return 'red';
  if (hue < 45) return 'orange';
  if (hue < 75) return 'yellow';
  if (hue < 160) return 'green';
  if (hue < 195) return 'teal';
  if (hue < 255) return 'blue';
  if (hue < 315) return 'purple';
  if (hue < 345) return 'pink';
  return 'neutral';
}

/**
 * Determine mood from lightness value (0-100)
 * Light images feel airy/bright, dark images feel moody/dramatic
 */
export function getMood(lightness: number): ColorMood {
  if (lightness > 60) return 'light';
  if (lightness < 40) return 'dark';
  return 'balanced';
}

/**
 * Convert RGB to HSL color space
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB color space
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert RGB to OKLCH color space
 * Chain: sRGB → Linear sRGB → OKLab → OKLCH (polar form)
 * Returns L (0-1), C (0-~0.4), h (0-360)
 */
function rgbToOklch(r: number, g: number, b: number): { L: number; C: number; h: number } {
  // sRGB to linear sRGB
  let lr = r / 255;
  let lg = g / 255;
  let lb = b / 255;
  lr = lr <= 0.04045 ? lr / 12.92 : Math.pow((lr + 0.055) / 1.055, 2.4);
  lg = lg <= 0.04045 ? lg / 12.92 : Math.pow((lg + 0.055) / 1.055, 2.4);
  lb = lb <= 0.04045 ? lb / 12.92 : Math.pow((lb + 0.055) / 1.055, 2.4);

  // Linear sRGB → LMS (Oklab M1 matrix)
  let l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  let m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  let s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // Cube root
  l = Math.cbrt(l);
  m = Math.cbrt(m);
  s = Math.cbrt(s);

  // LMS → OKLab
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bOk = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;

  // OKLab → OKLCH (polar)
  const C = Math.sqrt(a * a + bOk * bOk);
  let h = Math.atan2(bOk, a) * 180 / Math.PI;
  if (h < 0) h += 360;

  return { L, C, h };
}

/**
 * Derive accent color OKLCH values from glow RGB
 * Used for dynamic theming where UI accent matches image color
 * - Preserves hue
 * - Clamps chroma to readable accent range (0.03-0.15)
 * - Clamps lightness for good contrast on dark backgrounds (0.60-0.75)
 */
export function deriveAccentFromGlow(r: number, g: number, b: number): { hue: number; chroma: number; lightness: number } {
  const oklch = rgbToOklch(r, g, b);

  // Check if input is essentially grayscale (R≈G≈B)
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  const isGrayscale = maxDiff < 15;

  return {
    hue: Math.round(oklch.h * 10) / 10,
    // Keep neutral colors at zero chroma, otherwise clamp to 0.03-0.15
    chroma: isGrayscale ? 0 : Math.round(Math.max(0.03, Math.min(0.15, oklch.C)) * 1000) / 1000,
    // OKLCH lightness 0-1, clamp for good contrast on dark bg
    lightness: Math.round(Math.max(0.60, Math.min(0.75, oklch.L)) * 1000) / 1000,
  };
}

/**
 * Normalize a color for consistent ambient glow effect
 * - Preserves hue (the color itself)
 * - Boosts saturation for vibrant glows
 * - Normalizes lightness to avoid muddy dark colors or blown-out bright colors
 */
function normalizeGlowColor(r: number, g: number, b: number): DominantColor {
  const hsl = rgbToHsl(r, g, b);

  // Boost saturation to make colors more vibrant (min 40%, max 70%)
  hsl.s = Math.max(40, Math.min(70, hsl.s * 1.3));

  // Normalize lightness to mid-range for consistent glow intensity
  // Target range: 45-65% (avoids too dark/too bright)
  hsl.l = Math.max(45, Math.min(65, hsl.l < 50 ? hsl.l + 15 : hsl.l - 5));

  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  const hex = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;

  return { r: rgb.r, g: rgb.g, b: rgb.b, hex };
}

// In-memory caches to avoid re-processing images within a dev server session
const dominantColorCache = new Map<string, DominantColor>();
const colorMetadataCache = new Map<string, ColorMetadata>();

/**
 * Extract the dominant color from an image using Sharp
 * Returns RGB values and hex string
 *
 * Uses simple pixel averaging for fast, reliable color extraction.
 * For YouTube-style ambient glow effect.
 *
 * Supports both local files and remote URLs.
 */
export async function extractDominantColor(imagePath: string): Promise<DominantColor> {
  const cached = dominantColorCache.get(imagePath);
  if (cached) return cached;
  try {
    let sharpInstance: sharp.Sharp;

    // Check if it's a remote URL
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // Fetch remote image
      const response = await fetch(imagePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      sharpInstance = sharp(buffer);
    } else {
      // Local file path
      const fullPath = join(process.cwd(), 'public', imagePath);
      sharpInstance = sharp(fullPath);
    }

    // Resize to small size for faster processing
    // Extract raw pixel data
    const { data, info } = await sharpInstance
      .resize(100, 100, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate average color from pixel data
    let r = 0, g = 0, b = 0;
    const pixelCount = info.width * info.height;

    for (let i = 0; i < data.length; i += 3) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    r = Math.round(r / pixelCount);
    g = Math.round(g / pixelCount);
    b = Math.round(b / pixelCount);

    // Normalize the color for consistent glow effect
    // Convert to HSL, boost saturation, normalize lightness
    const normalized = normalizeGlowColor(r, g, b);

    dominantColorCache.set(imagePath, normalized);
    return normalized;
  } catch (error) {
    console.error(`Error extracting color from ${imagePath}:`, error);
    // Return fallback color (cool blue-gray)
    return { r: 58, g: 68, b: 71, hex: '#3A4447' };
  }
}

/**
 * Extract a palette of dominant colors (for more sophisticated effects)
 * Returns array of colors sorted by prominence
 *
 * This is a simplified approach using Sharp's stats.
 * For production, consider using color-thief or node-vibrant for better palettes.
 */
export async function extractColorPalette(
  imagePath: string,
  numColors: number = 5
): Promise<DominantColor[]> {
  try {
    const fullPath = join(process.cwd(), 'public', imagePath);

    // Get color stats from Sharp
    const stats = await sharp(fullPath)
      .resize(150, 150, { fit: 'cover' })
      .stats();

    // Extract dominant colors from each channel's statistics
    const colors: DominantColor[] = stats.channels.map((channel, idx) => {
      const avg = Math.round(channel.mean);
      return {
        r: idx === 0 ? avg : 0,
        g: idx === 1 ? avg : 0,
        b: idx === 2 ? avg : 0,
        hex: `#${avg.toString(16).padStart(2, '0')}`.repeat(3)
      };
    });

    return colors.slice(0, numColors);
  } catch (error) {
    console.error(`Error extracting palette from ${imagePath}:`, error);
    return [{ r: 58, g: 68, b: 71, hex: '#3A4447' }];
  }
}

/**
 * Extract full color metadata from an image
 * Returns dominant color plus colorFamily and mood for filtering
 *
 * For B&W detection: checks pixel-level color variance
 * For colored images: uses normalized color for classification
 */
export async function extractColorMetadata(imagePath: string): Promise<ColorMetadata> {
  const cached = colorMetadataCache.get(imagePath);
  if (cached) return cached;

  // Check if image is truly grayscale (most pixels have R≈G≈B)
  const grayscale = await isImageGrayscale(imagePath);

  // Get normalized color for glow effect and classification
  const dominantColor = await extractDominantColor(imagePath);
  const normalizedHsl = rgbToHsl(dominantColor.r, dominantColor.g, dominantColor.b);

  const result: ColorMetadata = {
    ...dominantColor,
    // True grayscale → neutral, otherwise use normalized color's hue/saturation
    colorFamily: grayscale ? 'neutral' : getColorFamily(normalizedHsl.h, normalizedHsl.s),
    mood: getMood(normalizedHsl.l),
    lightness: Math.round(normalizedHsl.l),
  };

  colorMetadataCache.set(imagePath, result);
  return result;
}

/**
 * Check if an image is truly grayscale by measuring color variance across pixels
 * Returns true if pixels have R≈G≈B consistently (low color variance)
 */
async function isImageGrayscale(imagePath: string): Promise<boolean> {
  try {
    let sharpInstance: sharp.Sharp;

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      const response = await fetch(imagePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      sharpInstance = sharp(buffer);
    } else {
      const fullPath = join(process.cwd(), 'public', imagePath);
      sharpInstance = sharp(fullPath);
    }

    const { data } = await sharpInstance
      .resize(50, 50, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Measure how many pixels have significant color difference (R≠G or G≠B)
    let coloredPixels = 0;
    const threshold = 15; // Max diff between R,G,B for a pixel to be "gray"

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      if (maxDiff > threshold) {
        coloredPixels++;
      }
    }

    const totalPixels = data.length / 3;
    const coloredRatio = coloredPixels / totalPixels;

    // If less than 10% of pixels have significant color, it's grayscale
    return coloredRatio < 0.1;
  } catch (error) {
    console.error(`Error checking grayscale for ${imagePath}:`, error);
    return false;
  }
}

/**
 * Get color metadata from existing glowColor RGB values
 * Use this when you already have extracted color and just need family/mood
 */
export function getColorMetadataFromRgb(r: number, g: number, b: number): { colorFamily: ColorFamily; mood: ColorMood; lightness: number } {
  const hsl = rgbToHsl(r, g, b);
  return {
    colorFamily: getColorFamily(hsl.h, hsl.s),
    mood: getMood(hsl.l),
    lightness: Math.round(hsl.l),
  };
}

/**
 * Get color family from a hex color string
 * Useful for manually-specified secondary colors from CMS
 */
export function getColorFamilyFromHex(hex: string): ColorFamily {
  // Parse hex to RGB
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  const hsl = rgbToHsl(r, g, b);
  return getColorFamily(hsl.h, hsl.s);
}

/**
 * Parse hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16),
  };
}
