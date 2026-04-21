import type { BBox } from './face-detector';

export function applyBlurToFaces(img: HTMLImageElement, boxes: BBox[]): HTMLCanvasElement {
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  if (boxes.length === 0) return canvas;

  // ぼかし強度を顔の平均サイズから決定（小さい顔には弱め、大きい顔には強め）
  const avgFaceSide = boxes.reduce((s, b) => s + Math.min(b.w, b.h), 0) / boxes.length;
  const blurRadius = Math.max(8, avgFaceSide * 0.22);

  // 全画像を一度だけぼかした版を作る
  const blurred = document.createElement('canvas');
  blurred.width = W;
  blurred.height = H;
  const bctx = blurred.getContext('2d')!;
  bctx.filter = `blur(${blurRadius}px)`;
  bctx.drawImage(img, 0, 0);
  bctx.filter = 'none';

  // 顔の位置にソフトなradial gradientを累積描画してマスクを作る
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const mctx = mask.getContext('2d')!;
  for (const box of boxes) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h * 0.48; // 目鼻寄りにわずかに上げる
    // 顔からはみ出さないよう1.2倍に拡大（BBoxより一回り外まで包む）
    const rx = (box.w * 1.2) / 2;
    const ry = (box.h * 1.2) / 2;
    const maxR = Math.max(rx, ry);

    const g = mctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,1)'); // 70%までは完全に不透明 → 顔本体を確実にカバー
    g.addColorStop(1, 'rgba(255,255,255,0)'); // 外側30%でフェード → 柔らかさ維持

    mctx.save();
    mctx.translate(cx, cy);
    mctx.scale(rx / maxR, ry / maxR);
    mctx.translate(-cx, -cy);
    mctx.fillStyle = g;
    mctx.beginPath();
    mctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    mctx.fill();
    mctx.restore();
  }

  // ぼかしキャンバスをマスクで切り抜き、原画像に重ねる
  bctx.globalCompositeOperation = 'destination-in';
  bctx.drawImage(mask, 0, 0);
  ctx.drawImage(blurred, 0, 0);

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
