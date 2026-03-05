"""
Depth Map Generation Script

Generates grayscale depth maps for images flagged with depth3d: true
in their post frontmatter. Uses Depth Anything V2 (Small) via ONNX Runtime.

Run: scripts/.venv/bin/python scripts/generate-depth-maps.py
Or via: npm run generate-depth-maps

Caching: Uses source file mtime (same approach as optimize-images.ts).
Skips images whose depth map already exists and source hasn't changed.
"""

import json
import os
import re
import ssl
import sys
import urllib.request
from pathlib import Path

# Fix SSL certificate verification on macOS
try:
    import certifi
    ssl_context = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ssl_context = ssl.create_default_context()

import numpy as np
import onnxruntime as ort
import yaml
from PIL import Image

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = PROJECT_ROOT / "src" / "content" / "posts"
MANIFEST_PATH = PROJECT_ROOT / "src" / "data" / "depth-manifest.json"
OUTPUT_DIR = PROJECT_ROOT / "public" / "images" / "depth"
MODELS_DIR = Path(__file__).resolve().parent / "models"

# Depth Anything V2 Small (ViT-S) — good quality/speed balance (~98 MB)
MODEL_URL = "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx"
MODEL_PATH = MODELS_DIR / "depth_anything_v2_vits.onnx"

# Output depth map width (height scales proportionally)
DEPTH_MAP_WIDTH = 800

# Model input size (Depth Anything V2 expects 518x518)
MODEL_INPUT_SIZE = 518

# ImageNet normalization constants
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_frontmatter(md_path: Path) -> dict:
    """Extract YAML frontmatter from a markdown file."""
    text = md_path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return {}
    try:
        return yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        return {}


def get_depth3d_images() -> list[tuple[str, Path]]:
    """
    Scan all posts for depth3d: true and return list of
    (coverImage.src, source_file_path) tuples.
    """
    results = []
    if not POSTS_DIR.exists():
        return results

    for md_file in POSTS_DIR.glob("*.md"):
        fm = parse_frontmatter(md_file)
        if not fm.get("depth3d"):
            continue
        cover = fm.get("coverImage", {})
        src = cover.get("src") if isinstance(cover, dict) else None
        if not src:
            continue
        # src is like "/images/uploads/photo.jpg"
        source_path = PROJECT_ROOT / "public" / src.lstrip("/")
        if source_path.exists():
            results.append((src, source_path))
        else:
            print(f"  [skip] Source not found: {source_path}")

    return results


def load_manifest() -> dict:
    """Load existing depth manifest for cache comparison."""
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def save_manifest(manifest: dict) -> None:
    """Write depth manifest to disk."""
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def needs_regeneration(src: str, source_path: Path, manifest: dict) -> bool:
    """Check if a depth map needs to be (re)generated."""
    entry = manifest.get(src)
    if not entry or "mtime" not in entry:
        return True

    # Check source file mtime
    current_mtime = source_path.stat().st_mtime_ns / 1e6  # ms like JS
    if abs(current_mtime - entry["mtime"]) > 1:
        return True

    # Check output file exists
    depth_path = PROJECT_ROOT / "public" / entry["depthMap"].lstrip("/")
    if not depth_path.exists():
        return True

    return False


def depth_map_output_path(src: str) -> tuple[str, Path]:
    """
    Compute output path for a depth map.
    /images/uploads/photo.jpg -> /images/depth/photo.depth.png
    """
    name = Path(src).stem
    relative = f"/images/depth/{name}.depth.png"
    absolute = OUTPUT_DIR / f"{name}.depth.png"
    return relative, absolute


# ---------------------------------------------------------------------------
# Model download & inference
# ---------------------------------------------------------------------------

def ensure_model() -> Path:
    """Download the ONNX model if not already present."""
    if MODEL_PATH.exists():
        return MODEL_PATH

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"  Downloading Depth Anything V2 Small model (~98 MB)...")
    print(f"  From: {MODEL_URL}")

    # Download with progress using SSL context
    opener = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ssl_context)
    )
    urllib.request.install_opener(opener)

    def _progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            pct = min(100, downloaded * 100 // total_size)
            mb = downloaded / (1024 * 1024)
            total_mb = total_size / (1024 * 1024)
            print(f"\r  Progress: {mb:.1f}/{total_mb:.1f} MB ({pct}%)", end="", flush=True)

    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH, reporthook=_progress)
    print()  # newline after progress
    print(f"  Model saved to: {MODEL_PATH}")
    return MODEL_PATH


def create_session(model_path: Path) -> ort.InferenceSession:
    """Create ONNX Runtime inference session."""
    providers = ["CPUExecutionProvider"]
    # Use CoreML on macOS if available for faster inference
    if sys.platform == "darwin":
        available = ort.get_available_providers()
        if "CoreMLExecutionProvider" in available:
            providers.insert(0, "CoreMLExecutionProvider")
    return ort.InferenceSession(str(model_path), providers=providers)


def preprocess_image(img: Image.Image) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    """
    Preprocess image for Depth Anything V2:
    - Resize to fit within 518x518 (letterbox, no cropping)
    - Normalize with ImageNet mean/std
    - Convert to NCHW format

    Returns (input_tensor, (pad_left, pad_top, resized_w, resized_h))
    so the output depth map can be cropped back to the original aspect ratio.
    """
    w, h = img.size
    scale = MODEL_INPUT_SIZE / max(w, h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    img_resized = img.resize((new_w, new_h), Image.LANCZOS)

    # Letterbox: pad to MODEL_INPUT_SIZE x MODEL_INPUT_SIZE with neutral gray
    padded = Image.new("RGB", (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), (128, 128, 128))
    pad_left = (MODEL_INPUT_SIZE - new_w) // 2
    pad_top = (MODEL_INPUT_SIZE - new_h) // 2
    padded.paste(img_resized, (pad_left, pad_top))

    # Convert to float32 array, normalize
    arr = np.array(padded, dtype=np.float32) / 255.0
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD

    # HWC -> NCHW
    arr = arr.transpose(2, 0, 1)
    arr = np.expand_dims(arr, axis=0)
    return arr, (pad_left, pad_top, new_w, new_h)


def run_depth_inference(
    session: ort.InferenceSession,
    source_path: Path,
    output_path: Path,
) -> tuple[int, int]:
    """
    Run depth estimation and save the result as a grayscale PNG.
    Returns (width, height) of the output depth map.
    """
    # Load and convert to RGB
    img = Image.open(source_path).convert("RGB")
    orig_w, orig_h = img.size

    # Preprocess with letterboxing (preserves full image, no cropping)
    input_tensor, (pad_left, pad_top, resized_w, resized_h) = preprocess_image(img)

    # Run inference
    input_name = session.get_inputs()[0].name
    output = session.run(None, {input_name: input_tensor})
    depth = output[0]  # Shape: (1, 1, H, W) or (1, H, W)

    # Squeeze to 2D
    depth = np.squeeze(depth)

    # Crop out letterbox padding to get depth at original aspect ratio
    depth = depth[pad_top:pad_top + resized_h, pad_left:pad_left + resized_w]

    # Normalize to 0-255
    depth_min = depth.min()
    depth_max = depth.max()
    if depth_max - depth_min > 1e-6:
        depth_normalized = (depth - depth_min) / (depth_max - depth_min)
    else:
        depth_normalized = np.zeros_like(depth)

    # Convert to uint8 (near=white=255, far=black=0 for displacement)
    depth_uint8 = (depth_normalized * 255).astype(np.uint8)

    # Resize to target output dimensions (preserves original aspect ratio)
    out_w = DEPTH_MAP_WIDTH
    out_h = int(orig_h * (DEPTH_MAP_WIDTH / orig_w))
    depth_img = Image.fromarray(depth_uint8, mode="L")
    depth_img = depth_img.resize((out_w, out_h), Image.LANCZOS)

    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    depth_img.save(output_path, "PNG", optimize=True)

    return out_w, out_h


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("\n--- Depth Map Generation ---\n")

    # Find images flagged for 3D depth
    images = get_depth3d_images()
    if not images:
        print("  No images flagged with depth3d: true. Nothing to do.\n")
        return

    print(f"  Found {len(images)} image(s) flagged for depth processing.\n")

    # Load existing manifest
    manifest = load_manifest()

    # Check which images need processing
    to_process = []
    for src, source_path in images:
        if needs_regeneration(src, source_path, manifest):
            to_process.append((src, source_path))
        else:
            print(f"  [cached] {src}")

    if not to_process:
        print("\n  All depth maps are up to date. Nothing to generate.\n")
        return

    print(f"\n  Processing {len(to_process)} image(s)...\n")

    # Ensure model is downloaded
    model_path = ensure_model()

    # Create inference session
    print("  Loading ONNX model...")
    session = create_session(model_path)
    print("  Model loaded.\n")

    # Process each image
    for src, source_path in to_process:
        rel_path, abs_path = depth_map_output_path(src)
        print(f"  Generating depth map: {src}")
        print(f"    -> {rel_path}")

        try:
            out_w, out_h = run_depth_inference(session, source_path, abs_path)
            mtime = source_path.stat().st_mtime_ns / 1e6

            manifest[src] = {
                "depthMap": rel_path,
                "width": out_w,
                "height": out_h,
                "mtime": mtime,
            }
            print(f"    Done ({out_w}x{out_h})")
        except Exception as e:
            print(f"    ERROR: {e}")

    # Clean up manifest entries for images no longer flagged
    flagged_srcs = {src for src, _ in images}
    removed = [key for key in manifest if key not in flagged_srcs]
    for key in removed:
        del manifest[key]
        print(f"  [removed] {key} (no longer flagged)")

    # Save updated manifest
    save_manifest(manifest)
    print(f"\n  Manifest saved: {MANIFEST_PATH}")
    print(f"  Depth maps: {OUTPUT_DIR}\n")


if __name__ == "__main__":
    main()
