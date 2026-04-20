import * as ort from 'onnxruntime-web';

export type BBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
};

const MODEL_URL = '/models/yolov11n-face.onnx';
const INPUT_SIZE = 640;

// onnxruntime-web の WASM は jsdelivr CDN から取得（セルフホストより setup シンプル）
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

async function loadSession(): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ['webgl', 'wasm'],
    graphOptimizationLevel: 'all',
  });
}

export function getDetector(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = loadSession().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

// 画像をアスペクト比を保ったまま INPUT_SIZE 正方形に letterbox
function letterbox(img: HTMLImageElement): {
  canvas: HTMLCanvasElement;
  scale: number;
  padX: number;
  padY: number;
} {
  const r = Math.min(INPUT_SIZE / img.naturalWidth, INPUT_SIZE / img.naturalHeight);
  const newW = Math.round(img.naturalWidth * r);
  const newH = Math.round(img.naturalHeight * r);
  const padX = Math.floor((INPUT_SIZE - newW) / 2);
  const padY = Math.floor((INPUT_SIZE - newH) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  // YOLO は通常 padding を灰色 (114,114,114) で埋める
  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, padX, padY, newW, newH);

  return { canvas, scale: r, padX, padY };
}

// Canvas → Float32 NCHW [1,3,H,W] (正規化 0-1, RGB)
function canvasToTensor(canvas: HTMLCanvasElement): ort.Tensor {
  const ctx = canvas.getContext('2d')!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const n = canvas.width * canvas.height;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = data[i * 4] / 255; // R
    out[i + n] = data[i * 4 + 1] / 255; // G
    out[i + 2 * n] = data[i * 4 + 2] / 255; // B
  }
  return new ort.Tensor('float32', out, [1, 3, canvas.height, canvas.width]);
}

// YOLOv11 出力 [1, 5, 8400] を [(cx, cy, w, h, conf), ...] にデコード → letterbox を元座標に戻す
function decodeOutput(
  output: ort.Tensor,
  scale: number,
  padX: number,
  padY: number,
  imgW: number,
  imgH: number,
  confThreshold: number,
): BBox[] {
  const data = output.data as Float32Array;
  const [, channels, anchors] = output.dims as number[];
  if (channels !== 5) {
    throw new Error(`unexpected YOLO output channels: ${channels}`);
  }
  const boxes: BBox[] = [];
  for (let i = 0; i < anchors; i++) {
    const score = data[4 * anchors + i];
    if (score < confThreshold) continue;
    const cx = data[0 * anchors + i];
    const cy = data[1 * anchors + i];
    const w = data[2 * anchors + i];
    const h = data[3 * anchors + i];
    // letterbox 逆変換
    const origX = (cx - w / 2 - padX) / scale;
    const origY = (cy - h / 2 - padY) / scale;
    const origW = w / scale;
    const origH = h / scale;
    // 画像範囲にクランプ
    const x = Math.max(0, origX);
    const y = Math.max(0, origY);
    const right = Math.min(imgW, origX + origW);
    const bottom = Math.min(imgH, origY + origH);
    if (right <= x || bottom <= y) continue;
    boxes.push({ x, y, w: right - x, h: bottom - y, score });
  }
  return boxes;
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

async function detectOnRegion(
  session: ort.InferenceSession,
  img: HTMLImageElement | HTMLCanvasElement,
  regionW: number,
  regionH: number,
  offsetX: number,
  offsetY: number,
  imgW: number,
  imgH: number,
  confThreshold: number,
): Promise<BBox[]> {
  // letterbox用に一時canvasに描画
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = regionW;
  srcCanvas.height = regionH;
  const srcCtx = srcCanvas.getContext('2d')!;
  if (img instanceof HTMLImageElement) {
    srcCtx.drawImage(img, offsetX, offsetY, regionW, regionH, 0, 0, regionW, regionH);
  } else {
    srcCtx.drawImage(img, 0, 0);
  }

  // letterbox → tensor → infer
  const srcImg = { naturalWidth: regionW, naturalHeight: regionH } as HTMLImageElement;
  Object.defineProperty(srcImg, 'src', { value: srcCanvas.toDataURL() });
  const r = Math.min(INPUT_SIZE / regionW, INPUT_SIZE / regionH);
  const newW = Math.round(regionW * r);
  const newH = Math.round(regionH * r);
  const padX = Math.floor((INPUT_SIZE - newW) / 2);
  const padY = Math.floor((INPUT_SIZE - newH) / 2);

  const letter = document.createElement('canvas');
  letter.width = INPUT_SIZE;
  letter.height = INPUT_SIZE;
  const lctx = letter.getContext('2d')!;
  lctx.fillStyle = 'rgb(114,114,114)';
  lctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  lctx.imageSmoothingEnabled = true;
  lctx.imageSmoothingQuality = 'high';
  lctx.drawImage(srcCanvas, 0, 0, regionW, regionH, padX, padY, newW, newH);

  const tensor = canvasToTensor(letter);
  const feeds = { [session.inputNames[0]]: tensor };
  const results = await session.run(feeds);
  const output = results[session.outputNames[0]];

  const localBoxes = decodeOutput(output, r, padX, padY, regionW, regionH, confThreshold);
  return localBoxes.map((b) => {
    const x = b.x + offsetX;
    const y = b.y + offsetY;
    return {
      x,
      y,
      w: Math.min(b.w, imgW - x),
      h: Math.min(b.h, imgH - y),
      score: b.score,
    };
  });
}

function isPlausibleFace(b: BBox, imgW: number, imgH: number): boolean {
  const aspect = b.w / b.h;
  if (aspect < 0.45 || aspect > 2.0) return false;
  const minSide = Math.min(imgW, imgH);
  if (Math.min(b.w, b.h) < minSide * 0.006) return false;
  if (Math.min(b.w, b.h) < 10) return false;
  return true;
}

export async function detectFaces(img: HTMLImageElement): Promise<BBox[]> {
  const session = await getDetector();
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const maxSide = Math.max(imgW, imgH);
  const confThreshold = 0.22;

  const all: BBox[] = [];

  all.push(...(await detectOnRegion(session, img, imgW, imgH, 0, 0, imgW, imgH, confThreshold)));

  if (maxSide >= 1400) {
    const tileSize = maxSide >= 2800 ? 640 : 480;
    const overlap = 0.35;
    const stride = Math.floor(tileSize * (1 - overlap));
    for (let y = 0; y < imgH; y += stride) {
      for (let x = 0; x < imgW; x += stride) {
        const w = Math.min(tileSize, imgW - x);
        const h = Math.min(tileSize, imgH - y);
        if (w < 180 || h < 180) continue;
        all.push(...(await detectOnRegion(session, img, w, h, x, y, imgW, imgH, confThreshold)));
      }
    }
  }

  const deduped = nonMaxSuppression(all, 0.55);
  return deduped.filter((b) => isPlausibleFace(b, imgW, imgH));
}
