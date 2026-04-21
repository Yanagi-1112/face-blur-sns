'use client';

type Props = {
  blurredUrl: string;
  fileName: string;
  faceCount: number;
  onDownload: () => void;
};

export function ImagePreview({ blurredUrl, fileName, faceCount, onDownload }: Props) {
  return (
    <button
      type="button"
      onClick={onDownload}
      aria-label={`${fileName} をダウンロード`}
      className="group relative block w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-left"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={blurredUrl} alt="" className="block w-full h-auto" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-3 py-1.5 text-xs text-white">
        <span className="truncate">{fileName}</span>
        <span className="shrink-0">顔 {faceCount} · クリックでダウンロード</span>
      </div>
    </button>
  );
}
