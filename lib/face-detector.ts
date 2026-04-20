import { FaceDetector, FilesetResolver, type Detection } from '@mediapipe/tasks-vision';

export type BBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
};

let detectorPromise: Promise<FaceDetector> | null = null;

async function loadDetector(): Promise<FaceDetector> {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm',
  );
  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
      delegate: 'GPU',
    },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.3,
    minSuppressionThreshold: 0.3,
  });
}

export function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = loadDetector().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

function toBBox(det: Detection): BBox | null {
  const box = det.boundingBox;
  if (!box) return null;
  const score = det.categories?.[0]?.score ?? 0;
  return { x: box.originX, y: box.originY, w: box.width, h: box.height, score };
}

function iou(a: BBox, b: BBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return inter / union;
}

function nonMaxSuppression(boxes: BBox[], threshold: number): BBox[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const kept: BBox[] = [];
  for (const b of sorted) {
    if (kept.every((k) => iou(b, k) < threshold)) kept.push(b);
  }
  return kept;
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

async function detectOnCanvas(
  detector: FaceDetector,
  canvas: HTMLCanvasElement,
  transform: (b: BBox) => BBox,
): Promise<BBox[]> {
  const result = detector.detect(canvas);
  return result.detections
    .map(toBBox)
    .filter((b): b is BBox => b !== null)
    .map(transform);
}

// 全画像を指定スケールで1パス
async function detectFullScale(
  detector: FaceDetector,
  img: HTMLImageElement,
  scale: number,
): Promise<BBox[]> {
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return detectOnCanvas(detector, canvas, (b) => ({
    x: b.x / scale,
    y: b.y / scale,
    w: b.w / scale,
    h: b.h / scale,
    score: b.score,
  }));
}

// タイル分割して各タイルで検出（群衆の奥の小さい顔向け）
async function detectTiled(
  detector: FaceDetector,
  img: HTMLImageElement,
  tileSize: number,
  overlap: number,
): Promise<BBox[]> {
  const stride = Math.floor(tileSize * (1 - overlap));
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const all: BBox[] = [];
  const canvas = createCanvas(tileSize, tileSize);
  const ctx = canvas.getContext('2d')!;

  for (let y = 0; y < imgH; y += stride) {
    for (let x = 0; x < imgW; x += stride) {
      const w = Math.min(tileSize, imgW - x);
      const h = Math.min(tileSize, imgH - y);
      if (w < 128 || h < 128) continue;
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      const boxes = await detectOnCanvas(detector, canvas, (b) => ({
        x: b.x + x,
        y: b.y + y,
        w: b.w,
        h: b.h,
        score: b.score,
      }));
      all.push(...boxes);
    }
  }
  return all;
}

// 顔として妥当かを形状・信頼度・サイズで判定（FP抑制強化）
function isPlausibleFace(b: BBox, imgW: number, imgH: number): boolean {
  const aspect = b.w / b.h;
  // 顔は概ね縦長気味の正方形〜縦長。横長すぎ・縦長すぎは除外
  if (aspect < 0.62 || aspect > 1.5) return false;
  const minSide = Math.min(imgW, imgH);
  const boxMin = Math.min(b.w, b.h);
  // サイズ下限
  if (boxMin < minSide * 0.012) return false;
  if (boxMin < 16) return false;
  // 信頼度段階ゲート: 小さいほど高い信頼度を要求
  if (boxMin < minSide * 0.02 && b.score < 0.5) return false;
  if (boxMin < minSide * 0.035 && b.score < 0.42) return false;
  if (b.score < 0.35) return false;
  return true;
}

export async function detectFaces(img: HTMLImageElement): Promise<BBox[]> {
  const detector = await getDetector();
  const maxSide = Math.max(img.naturalWidth, img.naturalHeight);
  const all: BBox[] = [];

  all.push(...(await detectFullScale(detector, img, 1)));

  // タイル分割で奥の小顔を拾う。小さめのタイル+高オーバーラップで小顔の相対サイズを稼ぐ
  if (maxSide >= 1200) {
    const tileSize = maxSide >= 2400 ? 600 : maxSide >= 1800 ? 500 : 400;
    all.push(...(await detectTiled(detector, img, tileSize, 0.35)));
  }

  const deduped = nonMaxSuppression(all, 0.25);
  return deduped.filter((b) => isPlausibleFace(b, img.naturalWidth, img.naturalHeight));
}
