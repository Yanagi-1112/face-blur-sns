'use client';

import { useEffect, useState } from 'react';

type Props = {
  blurredUrl: string;
  fileName: string;
  blob: Blob;
  faceCount: number;
  onDownload: () => void;
};

export function ImagePreview({ blurredUrl, fileName, blob, faceCount, onDownload }: Props) {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    try {
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      setCanShare(typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] }));
    } catch {
      setCanShare(false);
    }
  }, [blob, fileName]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const file = new File([blob], `blurred-${fileName}`, { type: blob.type || 'image/jpeg' });
      await navigator.share({ files: [file], title: fileName });
    } catch {
      /* user cancelled or unsupported */
    }
  };

  return (
    <div className="group relative block w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      <button
        type="button"
        onClick={onDownload}
        aria-label={`${fileName} をダウンロード`}
        className="block w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={blurredUrl} alt="" className="block w-full h-auto" />
      </button>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-3 py-1.5 text-xs text-white">
        <span className="truncate">{fileName}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span>顔 {faceCount}</span>
          {canShare && (
            <button
              type="button"
              onClick={handleShare}
              aria-label="共有"
              className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30"
            >
              共有
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            aria-label="ダウンロード"
            className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30"
          >
            ↓
          </button>
        </div>
      </div>
    </div>
  );
}
