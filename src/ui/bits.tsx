import type { ReactNode } from 'react';
import { ChevronLeft, Coins } from 'lucide-react';
import { cn } from '../utils/cn';

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CoinChip({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('glass flex items-center gap-1.5 rounded-full px-3 py-1.5', className)}>
      <Coins size={14} className="text-amber-300" strokeWidth={2.4} />
      <span className="num text-sm font-bold text-amber-200">{value}</span>
    </div>
  );
}

export function ProgressBar({ k, color = '#22d3ee', className }: { k: number; color?: string; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/10', className)}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, k * 100))}%`, background: color, boxShadow: `0 0 8px ${color}` }}
      />
    </div>
  );
}

export function ScreenHeader({
  title,
  sub,
  right,
  onBack,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3">
      <button
        type="button"
        onClick={onBack}
        className="btn glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-cyan-100"
        aria-label="Назад"
      >
        <ChevronLeft size={22} strokeWidth={2.4} />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="truncate text-sm font-extrabold tracking-[0.22em] text-cyan-100">{title}</div>
        {sub && <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center justify-end">{right}</div>
    </div>
  );
}

export function StatCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="glass flex flex-col items-center rounded-2xl px-2 py-3">
      <div className="num text-lg leading-none font-extrabold" style={{ color: accent ?? '#e6f1ff' }}>
        {value}
      </div>
      <div className="mt-1.5 text-[9px] font-bold tracking-[0.2em] text-slate-400">{label}</div>
    </div>
  );
}
