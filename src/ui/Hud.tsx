import { Activity, Columns2, Columns3, Flame, Magnet, Pause, Shield, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HudState, PowerupType } from '../game/types';
import { POWERUPS } from '../game/content';
import { cn } from '../utils/cn';

const PU_ICON: Record<PowerupType, LucideIcon> = {
  rapid: Zap,
  double: Columns2,
  triple: Columns3,
  shield: Shield,
  power: Flame,
  magnet: Magnet,
};

const PU_COLOR = POWERUPS.reduce(
  (acc, p) => ((acc[p.id] = p.color), acc),
  {} as Record<PowerupType, string>,
);

export function Hud({ hud, onPause }: { hud: HudState; onPause: () => void }) {
  const bossK = hud.boss ? hud.boss.hp / hud.boss.max : 0;
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="safe-top px-4">
        <div className="flex items-start justify-between pt-2">
          {/* score */}
          <div>
            <div className="text-[9px] font-bold tracking-[0.3em] text-cyan-300/80">SCORE</div>
            <div className="num text-glow -mt-0.5 text-3xl leading-none font-extrabold text-cyan-50">
              {hud.score}
            </div>
            <div className="num mt-1 text-[10px] font-semibold text-slate-400">
              BEST <span className="text-slate-200">{hud.best}</span>
            </div>
          </div>
          {/* right cluster */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <Activity size={12} className="text-orange-300" strokeWidth={2.6} />
                <span className="num text-[11px] font-bold text-orange-200">LVL {hud.level}</span>
              </div>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPause();
                }}
                className="btn glass pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-cyan-100"
                aria-label="Pause"
              >
                <Pause size={18} strokeWidth={2.4} />
              </button>
            </div>
            {hud.coins > 0 && (
              <div className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                <span className="num text-[11px] font-bold text-amber-200">{hud.coins}</span>
              </div>
            )}
          </div>
        </div>

        {/* integrity pips */}
        <div className="mt-2 flex items-center gap-1.5">
          {Array.from({ length: hud.maxHp }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'inline-block h-2 w-3.5 -skew-x-12 rounded-[2px] transition-all duration-200',
                i < hud.hp ? 'bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]' : 'bg-white/12',
              )}
            />
          ))}
          {hud.shielded && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[9px] font-extrabold tracking-[0.16em] text-cyan-200">
              <Shield size={10} strokeWidth={2.8} />
              SHIELD
            </span>
          )}
        </div>

        {/* active power-ups with remaining time */}
        {hud.powerups.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {hud.powerups.map((p) => {
              const Icon = PU_ICON[p.type];
              const color = PU_COLOR[p.type];
              return (
                <div
                  key={p.type}
                  className="glass relative flex items-center gap-1.5 overflow-hidden rounded-full py-1 pr-2.5 pl-1.5"
                  style={{ boxShadow: `0 0 12px ${color}44 inset` }}
                >
                  <Icon size={12} style={{ color }} strokeWidth={2.8} />
                  <span className="num text-[10px] font-extrabold" style={{ color }}>
                    {Math.ceil(p.left)}s
                  </span>
                  <span
                    className="absolute bottom-0 left-0 h-[2px] transition-all duration-150"
                    style={{ width: `${(p.left / p.total) * 100}%`, background: color }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* boss bar */}
        {hud.boss && (
          <div className="mx-auto mt-2 max-w-[75%]">
            <div className="mb-1 text-center text-[9px] font-extrabold tracking-[0.28em] text-pink-300 drop-shadow-[0_0_6px_rgba(244,114,182,0.6)]">
              {hud.boss.name}
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-pink-300/30 bg-black/50">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${bossK * 100}%`,
                  background: 'linear-gradient(90deg,#f472b6,#fb7185,#fbbf24)',
                  boxShadow: '0 0 10px rgba(244,114,182,0.8)',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
