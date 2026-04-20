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
      const images = Array.from(list).filter((f) => f.type.startsWith('image/'));
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
          ? 'border-zinc-300 bg-zinc-100 text-zinc-400 cursor-not-allowed'
          : isDragging
            ? 'border-black bg-zinc-100 text-black'
            : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50',
      ].join(' ')}
    >
      <p className="text-base">
        {disabled ? '処理中...' : isDragging ? 'ドロップ' : '画像をドロップ or クリック'}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
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
