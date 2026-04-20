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
      className="group relative block w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
      title={`クリックでダウンロード: ${fileName}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={blurredUrl} alt="" className="block w-full h-auto" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-1.5 text-xs text-white">
        <span className="truncate">{fileName}</span>
        <span className="shrink-0 ml-2">顔 {faceCount} · ↓</span>
      </div>
    </button>
  );
}
