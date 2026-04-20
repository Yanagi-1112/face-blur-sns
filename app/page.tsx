'use client';

import { useCallback, useEffect, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { DropZone } from '@/components/DropZone';
import { ImagePreview } from '@/components/ImagePreview';
import { ProcessingIndicator } from '@/components/ProcessingIndicator';
import { detectFaces, getDetector } from '@/lib/face-detector';
import { applyBlurToFaces, canvasToBlob, loadImage } from '@/lib/blur-canvas';

type ProcessedImage = {
  id: string;
  fileName: string;
  originalUrl: string;
  blurredUrl: string;
  blob: Blob;
  faceCount: number;
};

type Progress = {
  current: number;
  total: number;
  message: string;
} | null;

function outputFileName(original: string): string {
  const dot = original.lastIndexOf('.');
  const base = dot > 0 ? original.slice(0, dot) : original;
  return `face-blurred-${base}.jpg`;
}

export default function Home() {
  const [results, setResults] = useState<ProcessedImage[]>([]);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDetector().catch((e) => {
      console.error(e);
      setError('顔検出モデルの読み込みに失敗しました。ネットワーク接続を確認してください。');
    });
  }, []);

  useEffect(() => {
    return () => {
      results.forEach((r) => {
        URL.revokeObjectURL(r.originalUrl);
        URL.revokeObjectURL(r.blurredUrl);
      });
    };
  }, [results]);

  const processFiles = useCallback(async (files: File[]) => {
    setError(null);
    setProgress({ current: 0, total: files.length, message: 'モデルを準備中...' });
    try {
      await getDetector();
      const processed: ProcessedImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({
          current: i,
          total: files.length,
          message: `処理中: ${file.name}`,
        });
        const img = await loadImage(file);
        const boxes = await detectFaces(img);
        const canvas = applyBlurToFaces(img, boxes);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
        const originalUrl = URL.createObjectURL(file);
        const blurredUrl = URL.createObjectURL(blob);
        processed.push({
          id: `${Date.now()}-${i}`,
          fileName: file.name,
          originalUrl,
          blurredUrl,
          blob,
          faceCount: boxes.length,
        });
      }
      setResults((prev) => [...processed, ...prev]);
      setProgress(null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '処理中にエラーが発生しました');
      setProgress(null);
    }
  }, []);

  const downloadOne = (item: ProcessedImage) => {
    saveAs(item.blob, outputFileName(item.fileName));
  };

  const downloadAllZip = async () => {
    if (results.length === 0) return;
    const zip = new JSZip();
    for (const r of results) {
      zip.file(outputFileName(r.fileName), r.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'face-blurred-images.zip');
  };

  const clearAll = () => {
    results.forEach((r) => {
      URL.revokeObjectURL(r.originalUrl);
      URL.revokeObjectURL(r.blurredUrl);
    });
    setResults([]);
  };

  const isProcessing = progress !== null;
  const totalFaces = results.reduce((sum, r) => sum + r.faceCount, 0);

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-14">
        <header className="mb-8 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
            顔ぼかしSNS用ツール
          </h1>
          <p className="mt-2 text-sm md:text-base text-zinc-600 dark:text-zinc-400">
            画像をドロップするだけで、写っている人の顔を自動でぼかします。
            <span className="block mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              画像はこのブラウザ内だけで処理され、サーバーには送信されません。
            </span>
          </p>
        </header>

        <section className="mb-6">
          <DropZone onFiles={processFiles} disabled={isProcessing} />
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {progress && (
          <section className="mb-6">
            <ProcessingIndicator
              current={progress.current}
              total={progress.total}
              message={progress.message}
            />
          </section>
        )}

        {results.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {results.length}枚処理済み / 合計{totalFaces}件の顔をぼかし
              </p>
              <div className="flex items-center gap-2">
                {results.length > 1 && (
                  <button
                    type="button"
                    onClick={downloadAllZip}
                    className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                  >
                    全てZIPでダウンロード
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  クリア
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {results.map((r) => (
                <ImagePreview
                  key={r.id}
                  originalUrl={r.originalUrl}
                  blurredUrl={r.blurredUrl}
                  fileName={r.fileName}
                  faceCount={r.faceCount}
                  onDownload={() => downloadOne(r)}
                />
              ))}
            </div>
          </section>
        )}

        <footer className="mt-14 text-xs text-zinc-400 dark:text-zinc-600 text-center">
          Powered by MediaPipe Tasks Vision — all processing runs locally in your browser.
        </footer>
      </div>
    </main>
  );
}
