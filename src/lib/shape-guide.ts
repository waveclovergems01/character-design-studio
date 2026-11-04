import type { Point, Region } from './types';

export type ShapeValues = { width: number; height: number; rotation: number; offsetX: number; offsetY: number };
export const DEFAULT_SHAPE_VALUES: ShapeValues = { width: 100, height: 100, rotation: 0, offsetX: 0, offsetY: 0 };

export function cloneRegion(region: Region): Region { return region.map(poly => poly.map(([x,y]) => [x,y] as Point)); }

export function transformRegion(region: Region, from: ShapeValues, to: ShapeValues): Region {
  const all = region.flat();
  if (!all.length) return cloneRegion(region);
  const cx = (Math.min(...all.map(p=>p[0])) + Math.max(...all.map(p=>p[0]))) / 2;
  const cy = (Math.min(...all.map(p=>p[1])) + Math.max(...all.map(p=>p[1]))) / 2;
  const oldR = from.rotation * Math.PI / 180, nextR = to.rotation * Math.PI / 180;
  const co = Math.cos(-oldR), so = Math.sin(-oldR), cn = Math.cos(nextR), sn = Math.sin(nextR);
  return region.map(poly => poly.map(([x,y]) => {
    const dx = x - cx - from.offsetX, dy = y - cy - from.offsetY;
    const ux = dx * co - dy * so, uy = dx * so + dy * co;
    const nx = ux * (to.width / Math.max(.01, from.width));
    const ny = uy * (to.height / Math.max(.01, from.height));
    return [Math.max(0, Math.min(1000, Math.round(cx + nx * cn - ny * sn + to.offsetX))), Math.max(0, Math.min(1000, Math.round(cy + nx * sn + ny * cn + to.offsetY)))] as Point;
  }));
}

export function makeShapeGuidePrompt(imageName: string, width: number, height: number, partName: string, instruction: string, target: Region, original: Region): string {
  return `TASK: Precisely adjust the SHAPE / POSE of ONE part in the attached original character illustration.

ATTACHMENTS IN THIS ORDER:
1. ORIGINAL MASTER IMAGE: ${imageName} (${width} x ${height}px).
2. ANNOTATED SHAPE GUIDE PNG (the same image with guide lines).

TARGET: ${partName || 'The area outlined by the orange target polygon'}.
USER REQUEST: ${instruction.trim() || 'Adjust the selected part to match the orange target outline.'}

ANNOTATION KEY:
- CYAN DASHED = old region (when provided).
- SOLID ORANGE = desired NEW silhouette / limb direction. Yellow dots = editable target control points.
- Colored overlays are GUIDES, not new colors to paint onto the character.

NORMALIZED COORDINATES: Full image X and Y range 0 to 1000. Anatomy is in the character's own left/right (not the screen's).
ORIGINAL APPROXIMATE REGION: ${JSON.stringify(original)}
DESIRED TARGET SHAPE: ${JSON.stringify(target)}

EDITING RULES:
- Change only the intended part's shape, length, width or angle to closely match the orange outline.
- KEEP the original material, textures, pattern, all original colors, shading style, outline style, lighting direction and character identity.
- Preserve the rest of the character pixel-for-pixel as closely as your image editor allows: face, clothing, arms, other leg, shoes, background, pose and camera.
- Fill gaps from moved anatomy coherently and redraw stretched or occluded details if needed, rather than leaving distorted textures or blank holes.
- Do not draw the cyan or orange guides in the final result.

OUTPUT: ONE complete edited PNG with the SAME ${width} x ${height} dimensions, alpha/transparent background and canvas alignment as the ORIGINAL. No text, guides, grids, crops or extra characters. This is a new candidate version; keep the original unchanged.

If the requested shape would break anatomy, retain natural joint continuity while following the target silhouette as closely as possible.`;
}

function tracePolygon(ctx: CanvasRenderingContext2D, poly: Point[], width: number, height: number) {
  if (poly.length < 2) return;
  ctx.beginPath();
  poly.forEach(([x,y],i) => i === 0 ? ctx.moveTo(x / 1000 * width, y / 1000 * height) : ctx.lineTo(x / 1000 * width, y / 1000 * height));
  ctx.closePath();
}

export async function renderShapeGuidePng(imageUrl: string, width: number, height: number, original: Region, target: Region): Promise<Blob> {
  const image = new Image();
  image.decoding = 'async'; image.src = imageUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D ไม่พร้อมใช้งาน');
  ctx.drawImage(image, 0, 0, width, height);
  const unit = Math.max(1.5, Math.min(width, height) / 160);

  for (const poly of original) {
    if (poly.length < 3) continue;
    tracePolygon(ctx, poly, width, height);
    ctx.strokeStyle = '#42E4DC';
    ctx.lineWidth = unit * 1.25;
    ctx.setLineDash([unit * 3.5, unit * 2]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const poly of target) {
    if (poly.length < 3) continue;
    tracePolygon(ctx, poly, width, height);
    ctx.fillStyle = 'rgba(251,164,55,.16)';
    ctx.fill();
    ctx.strokeStyle = '#FFAE44'; ctx.lineWidth = unit * 2;
    ctx.stroke();
    for (const [x,y] of poly) {
      ctx.beginPath(); ctx.arc(x / 1000 * width, y / 1000 * height, Math.max(2, unit * 2), 0, Math.PI * 2);
      ctx.fillStyle = '#FFED9E'; ctx.fill();
      ctx.strokeStyle = '#734B15'; ctx.lineWidth = unit * .6; ctx.stroke();
    }
  }
  return new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('บันทึก PNG ไม่สำเร็จ')), 'image/png'));
}

/** Clipboard may be unavailable in an insecure browser context or without a user gesture. */
export async function copyPngBlob(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('เบราว์เซอร์นี้ยังไม่รองรับ Copy PNG; ใช้ปุ่มดาวน์โหลดแทน');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export async function imageToPngBlob(imageUrl: string, width: number, height: number): Promise<Blob> {
  const image = new Image(); image.decoding = 'async'; image.src = imageUrl;
  await image.decode();
  const canvas = document.createElement('canvas');canvas.width = width;canvas.height = height;
  const ctx = canvas.getContext('2d');if(!ctx)throw new Error('Canvas ไม่พร้อม');
  ctx.drawImage(image,0,0,width,height);
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('สร้างภาพไม่สำเร็จ')),'image/png'));
}
