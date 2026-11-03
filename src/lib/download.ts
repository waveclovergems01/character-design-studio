export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2500);
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const input = document.createElement('textarea');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
}

export function readFileAsText(file: File): Promise<string> {
  return file.text();
}

export function loadImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('อ่านไฟล์ภาพไม่ได้'));
    image.src = src;
  });
}

export async function exportMaskPng(parts: { polygons: [number, number][][] }[], width: number, height: number, expand = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas ไม่พร้อมใช้งาน');
  ctx.fillStyle = '#ffffff';
  for (const part of parts) {
    for (const poly of part.polygons) {
      if (poly.length < 3) continue;
      ctx.beginPath();
      poly.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x / 1000 * width, y / 1000 * height);
        else ctx.lineTo(x / 1000 * width, y / 1000 * height);
      });
      ctx.closePath();
      ctx.fill();
      if (expand > 0) {
        ctx.lineWidth = expand * 2;
        ctx.strokeStyle = '#ffffff';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }
  }
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('สร้าง PNG ไม่สำเร็จ')), 'image/png'));
}
