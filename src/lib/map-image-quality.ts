import type { CharacterMap, Point } from './types';

export type MapImageQuality = {
  checkedParts: number;
  outsideParts: number;
  transparentBackground: boolean;
  suspicious: boolean;
  examples: string[];
};

function pointInsidePolygon([x,y]: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let a = 0, b = polygon.length - 1; a < polygon.length; b = a++) {
    const [ax, ay] = polygon[a];
    const [bx, by] = polygon[b];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function analyzeAlphaAlignment(map: CharacterMap, alpha: Uint8ClampedArray, width: number, height: number): MapImageQuality {
  if (width < 1 || height < 1 || alpha.length !== width * height) throw new Error('Invalid alpha buffer');
  let transparentPixels = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] < 24) transparentPixels++;
  const transparentBackground = transparentPixels / alpha.length >= .05;
  if (!transparentBackground) return { checkedParts: 0, outsideParts: 0, transparentBackground: false, suspicious: false, examples: [] };

  let checkedParts = 0;
  let outsideParts = 0;
  const examples: string[] = [];
  for (const part of map.parts) {
    let total = 0;
    let opaque = 0;
    for (const poly of part.polygons) {
      if (poly.length < 3) continue;
      const xs = poly.map(p => p[0]); const ys = poly.map(p => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      for (let iy = 0; iy < 7; iy++) for (let ix = 0; ix < 7; ix++) {
        const x = minX + (maxX - minX) * (ix + .5) / 7;
        const y = minY + (maxY - minY) * (iy + .5) / 7;
        if (!pointInsidePolygon([x,y], poly)) continue;
        const px = Math.min(width - 1, Math.floor(x / 1000 * width));
        const py = Math.min(height - 1, Math.floor(y / 1000 * height));
        total++;
        if (alpha[py * width + px] > 64) opaque++;
      }
    }
    if (total < 3) continue;
    checkedParts++;
    if (opaque / total < .15) {
      outsideParts++;
      if (examples.length < 5) examples.push(part.id);
    }
  }
  return { checkedParts, outsideParts, transparentBackground, suspicious: checkedParts >= 5 && outsideParts / checkedParts > .2, examples };
}

export async function scanMapImageQuality(map: CharacterMap, imageUrl: string): Promise<MapImageQuality> {
  const image = new Image();
  image.decoding = 'async';
  image.src = imageUrl;
  await image.decode();
  const ratio = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Cannot analyze canvas image');
  ctx.drawImage(image, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  return analyzeAlphaAlignment(map, alpha, width, height);
}
