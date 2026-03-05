/**
 * Depth Map Utilities
 *
 * Provides helpers to check if a depth map exists for an image
 * and get its URL for client-side loading.
 *
 * Follows the same pattern as optimizedImage.ts.
 */

let manifest: DepthManifest | null = null;

interface DepthEntry {
  /** Path to the depth map PNG, e.g. "/images/depth/photo.depth.png" */
  depthMap: string;
  width: number;
  height: number;
  mtime: number;
}

interface DepthManifest {
  [originalPath: string]: DepthEntry;
}

async function loadManifest(): Promise<DepthManifest> {
  if (manifest) return manifest;

  try {
    const data = await import('../data/depth-manifest.json');
    manifest = data.default as DepthManifest;
    return manifest;
  } catch {
    // Manifest doesn't exist yet or is empty
    return {};
  }
}

/**
 * Get depth map entry for an image, or null if none exists.
 *
 * @param imagePath - Original image path (e.g., '/images/uploads/photo.jpg')
 */
export async function getDepthMap(imagePath: string): Promise<DepthEntry | null> {
  const depthManifest = await loadManifest();
  return depthManifest[imagePath] || null;
}
