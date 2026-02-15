import sharp from 'sharp';
import { join } from 'path';

export interface DominantColor {
  r: number;
  g: number;
  b: number;
  hex: string;
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
 * Derive accent color HSL values from glow RGB
 * Used for dynamic theming where UI accent matches image color
 * - Preserves hue
 * - Clamps saturation to readable range (35-60%)
 * - Clamps lightness for good contrast on dark backgrounds (55-70%)
 */
export function deriveAccentFromGlow(r: number, g: number, b: number): { hue: number; saturation: number; lightness: number } {
  const hsl = rgbToHsl(r, g, b);
  return {
    hue: Math.round(hsl.h),
    saturation: Math.round(Math.max(35, Math.min(60, hsl.s))),
    lightness: Math.round(Math.max(55, Math.min(70, hsl.l))),
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
