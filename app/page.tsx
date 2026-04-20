'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { DropZone } from '@/components/DropZone';
import { ImagePreview } from '@/components/ImagePreview';
import { detectFaces, getDetector } from '@/lib/face-detector';
import { applyBlurToFaces, canvasToBlob, loadImage } from '@/lib/blur-canvas';

type ProcessedImage = {
  id: string;
  fileName: string;
  blurredUrl: string;
  blob: Blob;
  faceCount: number;
};

type FailedImage = {
  id: string;
  fileName: string;
  error: string;
};

function outputFileName(original: string): string {
  const dot = original.lastIndexOf('.');
  const base = dot > 0 ? original.slice(0, dot) : original;
  return `blurred-${base}.jpg`;
}

export default function Home() {
  const [results, setResults] = useState<ProcessedImage[]>([]);
  const [failures, setFailures] = useState<FailedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [lastBatchFaces, setLastBatchFaces] = useState<number | null>(null);
  const resultsRef = useRef(results);
  resultsRef.current = results;

  useEffect(() => {
    getDetector().catch(console.error);
  }, []);

  useEffect(() => {
    return () => {
      resultsRef.current.forEach((r) => URL.revokeObjectURL(r.blurredUrl));
    };
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    setBusy(true);
    setFailures([]);
    setLastBatchFaces(null);
    const processed: ProcessedImage[] = [];
    const failed: FailedImage[] = [];
    try {
      await getDetector();
    } catch {
      setFailures(
        files.map((f) => ({
          id: crypto.randomUUID(),
          fileName: f.name,
          error: '顔検出モデルの読み込みに失敗しました（ネットワーク要確認）',
        })),
      );
      setBusy(false);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`${i + 1}/${files.length}`);
      try {
        const img = await loadImage(file);
        const boxes = await detectFaces(img);
        const canvas = applyBlurToFaces(img, boxes);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
        processed.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          blurredUrl: URL.createObjectURL(blob),
          blob,
          faceCount: boxes.length,
        });
      } catch (e) {
        console.error(e);
        failed.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          error: e instanceof Error ? e.message : '処理失敗',
        });
      }
    }
    setResults((prev) => [...processed, ...prev]);
    setFailures(failed);
    setLastBatchFaces(processed.reduce((s, r) => s + r.faceCount, 0));
    setBusy(false);
    setProgress('');
  }, []);

  const downloadOne = (item: ProcessedImage) => saveAs(item.blob, outputFileName(item.fileName));

  const downloadAll = async () => {
    if (results.length === 0) return;
    if (results.length === 1) return downloadOne(results[0]);
    const zip = new JSZip();
    for (const r of results) zip.file(outputFileName(r.fileName), r.blob);
    saveAs(await zip.generateAsync({ type: 'blob' }), 'blurred-images.zip');
  };

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-4">顔ぼかし</h1>

        <DropZone onFiles={processFiles} disabled={busy} />

        {busy && <p className="mt-3 text-sm text-zinc-500" aria-live="polite">処理中 {progress}...</p>}

        {!busy && lastBatchFaces !== null && (
          <p
            className="mt-3 text-base font-medium text-emerald-700 completion-pop"
            aria-live="polite"
          >
            {lastBatchFaces > 0
              ? `✓ ${lastBatchFaces}人の顔をぼかしました`
              : '✓ 処理完了（顔は検出されませんでした）'}
          </p>
        )}

        {failures.length > 0 && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p className="font-medium">処理できなかった画像 {failures.length}件:</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {failures.map((f) => (
                <li key={f.id}>
                  {f.fileName} — {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{results.length}枚 · サムネイルをクリックでDL</p>
              {results.length > 1 && (
                <button
                  type="button"
                  onClick={downloadAll}
                  className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                >
                  まとめてDL (ZIP)
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {results.map((r) => (
                <ImagePreview
                  key={r.id}
                  blurredUrl={r.blurredUrl}
                  fileName={r.fileName}
                  blob={r.blob}
                  faceCount={r.faceCount}
                  onDownload={() => downloadOne(r)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
