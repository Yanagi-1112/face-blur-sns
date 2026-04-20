'use client';

import { useCallback, useRef, useState } from 'react';

type Props = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

export function DropZone({ onFiles, disabled = false }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const images = Array.from(list).filter(
        (f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name),
      );
      if (images.length > 0) onFiles(images);
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click();
      }}
      className={[
        'flex items-center justify-center w-full py-20 rounded-xl border-2 border-dashed cursor-pointer select-none transition-colors',
        disabled
          ? 'border-zinc-800 bg-zinc-900/50 text-zinc-600 cursor-not-allowed'
          : isDragging
            ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
            : 'border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-600',
      ].join(' ')}
    >
      <p className="text-base">
        {disabled ? '処理中...' : isDragging ? 'ドロップ' : '画像をドロップ or クリック'}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
