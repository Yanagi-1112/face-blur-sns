'use client';

import { useState } from 'react';

type Props = {
  originalUrl: string;
  blurredUrl: string;
  fileName: string;
  faceCount: number;
  onDownload: () => void;
};

export function ImagePreview({ originalUrl, blurredUrl, fileName, faceCount, onDownload }: Props) {
  const [mode, setMode] = useState<'after' | 'before'>('after');

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate max-w-[60vw]">
            {fileName}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {faceCount}件の顔を検出・ぼかし適用
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-zinc-100 p-0.5 text-xs font-medium dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setMode('before')}
              className={[
                'px-3 py-1 rounded-full transition-colors',
                mode === 'before'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400',
              ].join(' ')}
            >
              元画像
            </button>
            <button
              type="button"
              onClick={() => setMode('after')}
              className={[
                'px-3 py-1 rounded-full transition-colors',
                mode === 'after'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400',
              ].join(' ')}
            >
              ぼかし後
            </button>
          </div>
          <button
            type="button"
            onClick={onDownload}
            className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition-colors"
          >
            ダウンロード
          </button>
        </div>
      </div>
      <div className="relative bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center overflow-hidden max-h-[80vh]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mode === 'after' ? blurredUrl : originalUrl}
          alt={mode === 'after' ? 'ぼかし後' : '元画像'}
          className="max-w-full max-h-[80vh] object-contain"
        />
      </div>
    </div>
  );
}
