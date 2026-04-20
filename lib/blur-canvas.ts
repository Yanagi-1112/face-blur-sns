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
    const padded = expandBox(box, 1.08, canvas.width, canvas.height);
    const cx = padded.x + padded.w / 2;
    const cy = padded.y + padded.h / 2;
    // 顔領域にフィットする正円の半径（短辺の55%程度）
    const clipR = Math.min(padded.w, padded.h) * 0.55;
    const blurR = Math.max(16, clipR * 0.5);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, clipR, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = `blur(${blurR}px)`;
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

function isHeic(file: File): boolean {
  return (
    /\.hei[cf]$/i.test(file.name) ||
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.type === 'image/heic-sequence' ||
    file.type === 'image/heif-sequence'
  );
}

async function decodeHeic(file: File): Promise<Blob> {
  const { heicTo } = await import('heic-to');
  return heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
}

export async function fileToImageBlob(file: File): Promise<Blob> {
  if (isHeic(file)) {
    return decodeHeic(file);
  }
  return file;
}

export function loadImage(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(new Error('画像の読み込みに失敗しました（形式未対応の可能性）'));
        return;
      }
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像の読み込みに失敗しました'));
    };
    img.src = url;
  });
}
