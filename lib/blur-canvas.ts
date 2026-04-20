import type { BBox } from './face-detector';

function expandBox(box: BBox, factor: number, maxW: number, maxH: number): BBox {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const nw = box.w * factor;
  const nh = box.h * factor;
  const nx = Math.max(0, cx - nw / 2);
  const ny = Math.max(0, cy - nh / 2);
  const finalW = Math.min(nw, maxW - nx);
  const finalH = Math.min(nh, maxH - ny);
  return { x: nx, y: ny, w: finalW, h: finalH, score: box.score };
}

export function applyBlurToFaces(img: HTMLImageElement, boxes: BBox[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  for (const box of boxes) {
    const padded = expandBox(box, 1.4, canvas.width, canvas.height);
    const radius = Math.max(20, Math.min(padded.w, padded.h) * 0.25);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      padded.x + padded.w / 2,
      padded.y + padded.h / 2,
      padded.w / 2,
      padded.h / 2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.clip();
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      mime,
      quality,
    );
  });
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
