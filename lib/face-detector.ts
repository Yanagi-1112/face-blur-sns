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
  return {
    x: box.originX,
    y: box.originY,
    w: box.width,
    h: box.height,
    score,
  };
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

async function detectOnCanvas(
  detector: FaceDetector,
  source: HTMLCanvasElement,
  scale: number,
): Promise<BBox[]> {
  const result = detector.detect(source);
  return result.detections
    .map((d) => toBBox(d))
    .filter((b): b is BBox => b !== null)
    .map((b) => ({
      x: b.x / scale,
      y: b.y / scale,
      w: b.w / scale,
      h: b.h / scale,
      score: b.score,
    }));
}

function drawToCanvas(img: HTMLImageElement, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function detectFaces(img: HTMLImageElement): Promise<BBox[]> {
  const detector = await getDetector();

  const maxSide = Math.max(img.naturalWidth, img.naturalHeight);
  const scales: number[] = [1];
  if (maxSide < 3000) scales.push(1.8);
  if (maxSide < 1800) scales.push(2.5);

  const all: BBox[] = [];
  for (const s of scales) {
    const cv = drawToCanvas(img, s);
    const boxes = await detectOnCanvas(detector, cv, s);
    all.push(...boxes);
  }

  return nonMaxSuppression(all, 0.4);
}
