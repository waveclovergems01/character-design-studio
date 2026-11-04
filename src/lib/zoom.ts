/** Zoom is relative to the fitted (100%) size of the image, not its raw pixel size. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 10;

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value * 1000) / 1000));
}

export function wheelZoom(current: number, deltaY: number, deltaMode = 0): number {
  // Wheel events use pixels, lines or pages depending on the pointing device.
  const pixelDelta = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 600 : 1);
  return clampZoom(current * Math.exp(-pixelDelta * 0.0016));
}

export function stepZoom(current: number, direction: 1 | -1): number {
  return clampZoom(current * (direction > 0 ? 1.25 : 0.8));
}

export function fittedImageSize(imageWidth: number, imageHeight: number, viewportWidth: number, viewportHeight: number, zoom = 1) {
  if (imageWidth <= 0 || imageHeight <= 0) return { width: 0, height: 0 };
  const fit = Math.min(Math.max(1, viewportWidth - 60) / imageWidth, Math.max(1, viewportHeight - 60) / imageHeight, 1);
  return { width: imageWidth * fit * zoom, height: imageHeight * fit * zoom };
}
