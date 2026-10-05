import { Activity, Columns2, Columns3, Flame, HeartPulse, Magnet, Pause, Shield, Sparkles, Wind, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AbilityHud, HudState, PowerupType } from '../game/types';
import type { AbilityIcon } from '../game/abilities';
import { POWERUPS } from '../game/content';
import { cn } from '../utils/cn';

const PU_ICON: Record<PowerupType, LucideIcon> = {
  rapid: Zap,
  double: Columns2,
  triple: Columns3,
  shield: Shield,
  power: Flame,
  magnet: Magnet,
  repair: HeartPulse,
};

const PU_COLOR = POWERUPS.reduce((acc, p) => ((acc[p.id] = p.color), acc), {} as Record<PowerupType, string>);

const ABILITY_ICON: Record<AbilityIcon, LucideIcon> = {
  dash: Wind,
  flame: Flame,
  shield: Shield,
  beam: Zap,
  rift: Sparkles,
};

const ABILITY_ICON_BY_ID: Record<AbilityHud['id'], LucideIcon> = {
  dash: ABILITY_ICON.dash,
  afterburner: ABILITY_ICON.flame,
  fortress: ABILITY_ICON.shield,
  novabeam: ABILITY_ICON.beam,
  collapse: ABILITY_ICON.rift,
};

function AbilityButton({ ability, onFire }: { ability: AbilityHud; onFire: () => void }) {
  const Icon = ABILITY_ICON_BY_ID[ability.id];
  const ready = ability.phase === 'ready';
  const active = ability.phase === 'active' || ability.phase === 'charging';
  const k = ability.total > 0 ? 1 - ability.left / ability.total : 1;
  const ring = active ? 1 : ready ? 1 : k;
  const color = ability.color;

  return (
    <button
      type="button"
      // pointerdown даёт мгновенную реакцию и не крадёт указатель-касание у канваса
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onFire();
      }}
      className={cn(
        'btn pointer-events-auto relative flex h-[74px] w-[74px] items-center justify-center rounded-full',
        ready ? 'animate-pulse-soft' : '',
      )}
      style={{
        background: ready ? `radial-gradient(circle at 50% 40%, ${color}44, rgba(6,10,20,0.85))` : 'rgba(6,10,20,0.75)',
        border: `1.5px solid ${ready || active ? color : 'rgba(148,180,255,0.22)'}`,
        boxShadow: ready ? `0 0 22px ${color}66, 0 0 0 1px ${color}33 inset` : '0 4px 18px rgba(0,0,0,0.45)',
      }}
      aria-label={`Способность ${ability.name}`}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={active ? color : ready ? color : `${color}cc`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0, Math.min(1, ring)) * 283} 283`}
          opacity={ready ? 0.9 : 0.75}
        />
      </svg>
      <div className="flex flex-col items-center">
        <Icon size={22} strokeWidth={2.4} style={{ color: ready || active ? color : '#94a3b8' }} />
        <span
          className="num mt-0.5 text-[10px] leading-none font-black tracking-wider"
          style={{ color: ready || active ? color : '#94a3b8' }}
        >
          {ready ? 'ГОТОВ' : ability.left.toFixed(1)}
        </span>
      </div>
    </button>
  );
}

export function Hud({ hud, onPause, onAbility }: { hud: HudState; onPause: () => void; onAbility: () => void }) {
  const bossK = hud.boss ? hud.boss.hp / hud.boss.max : 0;
  const hardcore = hud.mode === 'hardcore';

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="safe-top px-4">
        <div className="flex items-start justify-between pt-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold tracking-[0.3em] text-cyan-300/80">СЧЁТ</span>
              {hud.scoreMul > 1.01 && (
                <span className="num rounded-full bg-amber-400/15 px-1.5 py-px text-[9px] font-black text-amber-300">
                  ×{hud.scoreMul.toFixed(2).replace(/0$/, '')}
                </span>
              )}
            </div>
            <div className="num text-glow -mt-0.5 text-3xl leading-none font-extrabold text-cyan-50">{hud.score}</div>
            <div className="num mt-1 text-[10px] font-semibold text-slate-400">
              РЕКОРД <span className="text-slate-200">{hud.best}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <div
                className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={
                  hardcore
                    ? { borderColor: 'rgba(239,68,68,0.5)', boxShadow: '0 0 14px rgba(239,68,68,0.35) inset' }
                    : undefined
                }
              >
                <Activity size={12} style={{ color: hud.modeColor }} strokeWidth={2.6} />
                <span className="num text-[10px] font-black tracking-wider" style={{ color: hud.modeColor }}>
                  {hud.modeLabel}
                </span>
              </div>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPause();
                }}
                className="btn glass pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-cyan-100"
                aria-label="Пауза"
              >
                <Pause size={18} strokeWidth={2.4} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <span className="text-[10px] font-bold text-orange-300">УР.</span>
                <span className="num text-[11px] font-bold text-orange-200">{hud.level}</span>
              </div>
              {hud.coins > 0 && (
                <div className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                  <span className="num text-[11px] font-bold text-amber-200">{hud.coins}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* прочность + щит + двигатель Бездны */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {Array.from({ length: Math.min(hud.maxHp, 10) }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'inline-block h-2 w-3.5 -skew-x-12 rounded-[2px] transition-all duration-200',
                i < hud.hp
                  ? hardcore
                    ? 'bg-rose-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]'
                    : 'bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]'
                  : 'bg-white/12',
              )}
            />
          ))}
          {hud.shielded && (
            <span className="flex items-center gap-1 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[9px] font-extrabold tracking-[0.16em] text-cyan-200">
              <Shield size={10} strokeWidth={2.8} />
              ЩИТ
            </span>
          )}
          {hud.voidBonus > 0 && (
            <span className="num flex items-center gap-1 rounded-full bg-indigo-400/15 px-2 py-0.5 text-[9px] font-extrabold tracking-[0.14em] text-indigo-200">
              БЕЗДНА +{Math.round(hud.voidBonus * 100)}%
            </span>
          )}
          {hud.mode === 'bossrush' && (
            <span className="num rounded-full bg-pink-400/15 px-2 py-0.5 text-[9px] font-extrabold tracking-[0.14em] text-pink-200">
              {hud.bossesDown} СБИТО
            </span>
          )}
        </div>

        {/* синергии */}
        {hud.synergies.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {hud.synergies.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{ background: `${s.color}22`, border: `1px solid ${s.color}66`, boxShadow: `0 0 12px ${s.color}44` }}
              >
                <Sparkles size={9} style={{ color: s.color }} strokeWidth={3} />
                <span className="text-[9px] font-black tracking-[0.14em]" style={{ color: s.color }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* активные усилители */}
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
                    {Math.ceil(p.left)}с
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

        {/* полоса босса + фаза */}
        {hud.boss && (
          <div className="mx-auto mt-2 max-w-[80%]">
            <div className="mb-1 flex items-center justify-center gap-2">
              <span className="text-[9px] font-extrabold tracking-[0.18em] text-pink-300 drop-shadow-[0_0_6px_rgba(244,114,182,0.6)]">
                {hud.boss.name}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-px text-[8px] font-black tracking-[0.16em]',
                  hud.boss.critical ? 'animate-pulse-soft bg-red-500/25 text-red-300' : 'bg-amber-400/20 text-amber-300',
                )}
              >
                {hud.boss.critical ? 'КРИТИЧНО' : `ФАЗА ${hud.boss.phase}`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-pink-300/30 bg-black/50">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${bossK * 100}%`,
                  background: hud.boss.critical
                    ? 'linear-gradient(90deg,#ef4444,#f87171,#fbbf24)'
                    : 'linear-gradient(90deg,#f472b6,#fb7185,#fbbf24)',
                  boxShadow: '0 0 10px rgba(244,114,182,0.8)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* способность — большая кнопка под большой палец, в стороне от зоны драга */}
      {hud.ability && (
        <div className="safe-bottom absolute right-4 bottom-0">
          <div className="pb-5">
            <AbilityButton ability={hud.ability} onFire={onAbility} />
          </div>
        </div>
      )}
    </div>
  );
}
