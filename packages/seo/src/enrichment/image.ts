import type { ImageMetadataInput, ImageOrientation } from '../types.js';

/** Determine image orientation from dimensions. */
export function resolveImageOrientation(image: ImageMetadataInput | undefined): ImageOrientation {
  const width = image?.width;
  const height = image?.height;

  if (
    width === undefined ||
    height === undefined ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return 'unknown';
  }

  if (width === height) return 'square';
  if (width > height) return 'landscape';
  return 'portrait';
}

/** Deterministic alt text placeholder from title. */
export function buildAltTextPlaceholder(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return 'Image';
  return `Image: ${trimmed}`;
}
