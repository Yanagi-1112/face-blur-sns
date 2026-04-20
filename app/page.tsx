'use client';

import { useCallback, useEffect, useState } from 'react';
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

function outputFileName(original: string): string {
  const dot = original.lastIndexOf('.');
  const base = dot > 0 ? original.slice(0, dot) : original;
  return `blurred-${base}.jpg`;
}

export default function Home() {
  const [results, setResults] = useState<ProcessedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    getDetector().catch(console.error);
  }, []);

  useEffect(() => {
    return () => {
      results.forEach((r) => URL.revokeObjectURL(r.blurredUrl));
    };
  }, [results]);

  const processFiles = useCallback(async (files: File[]) => {
    setBusy(true);
    try {
      await getDetector();
      const processed: ProcessedImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`${i + 1}/${files.length}`);
        const img = await loadImage(file);
        const boxes = await detectFaces(img);
        const canvas = applyBlurToFaces(img, boxes);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
        processed.push({
          id: `${Date.now()}-${i}`,
          fileName: file.name,
          blurredUrl: URL.createObjectURL(blob),
          blob,
          faceCount: boxes.length,
        });
      }
      setResults((prev) => [...processed, ...prev]);
    } finally {
      setBusy(false);
      setProgress('');
    }
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

        {busy && (
          <p className="mt-3 text-sm text-zinc-500">処理中 {progress}...</p>
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
