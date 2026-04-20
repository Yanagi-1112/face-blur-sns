'use client';

type Props = {
  current: number;
  total: number;
  message: string;
};

export function ProcessingIndicator({ current, total, message }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{message}</span>
        <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
          {current}/{total}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
