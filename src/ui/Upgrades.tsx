import { Bomb, Columns3, Coins, Crosshair, Heart, Magnet, Rocket, Shield, Sparkles, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SaveData, TechId, UpgradeId } from '../game/types';
import { SHIP_MAP, TECHS, UPGRADES, shipUpgradesOf, upgradeCost } from '../game/content';
import { CoinChip, ScreenHeader } from './bits';
import { cn } from '../utils/cn';

const UPGRADE_ICON: Record<UpgradeId, LucideIcon> = {
  power: Crosshair,
  rate: Zap,
  streams: Columns3,
  hull: Heart,
  shield: Shield,
  magnet: Magnet,
  tech: Sparkles,
};

const UPGRADE_COLOR: Record<UpgradeId, string> = {
  power: '#f472b6',
  rate: '#ffd23f',
  streams: '#38bdf8',
  hull: '#4ade80',
  shield: '#22d3ee',
  magnet: '#c084fc',
  tech: '#818cf8',
};

const TECH_ICON: Record<TechId, LucideIcon> = {
  missiles: Rocket,
  lightning: Zap,
  bombs: Bomb,
  drones: Sparkles,
  singularity: Sparkles,
};

export function Upgrades({
  save,
  onBack,
  onBuy,
}: {
  save: SaveData;
  onBack: () => void;
  onBuy: (id: UpgradeId) => void;
}) {
  const ship = SHIP_MAP[save.ship] ?? SHIP_MAP.falcon;
  const levels = shipUpgradesOf(save, save.ship);
  const tech = TECHS[ship.tech];

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/85 backdrop-blur-md">
      <div className="safe-top">
        <ScreenHeader
          title="АНГАР"
          sub="ПРОКАЧКА ОТДЕЛЬНО ДЛЯ КАЖДОГО КОРПУСА"
          onBack={onBack}
          right={<CoinChip value={save.coins} />}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ touchAction: 'pan-y' }}>
        {/* активный корпус */}
        <div
          className="glass pop-in mb-3 flex items-center gap-3 rounded-2xl p-3"
          style={{ borderColor: `${ship.accent}55`, boxShadow: `0 0 20px ${ship.accent}22` }}
        >
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${ship.accent}1f` }}
          >
            <Rocket size={20} style={{ color: ship.accent }} strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold tracking-[0.26em] text-slate-500">АКТИВНЫЙ КОРПУС</div>
            <div className="text-sm font-black tracking-[0.16em]" style={{ color: ship.accent }}>
              {ship.name}
            </div>
          </div>
          <div className="text-right text-[9px] leading-tight font-bold tracking-[0.12em] text-slate-500">
            У КАЖДОГО
            <br />
            СВОЯ ПРОКАЧКА
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {UPGRADES.map((def, idx) => {
            const isTech = def.id === 'tech';
            const lvl = levels[def.id];
            const cost = upgradeCost(def.id, lvl);
            const maxed = lvl >= def.max;
            const afford = save.coins >= cost;
            const Icon = isTech ? TECH_ICON[ship.tech] : UPGRADE_ICON[def.id];
            const color = isTech ? tech.color : UPGRADE_COLOR[def.id];
            const name = isTech ? tech.name : def.name;
            const sub = isTech ? tech.desc : def.sub;

            return (
              <div
                key={def.id}
                className={cn('glass pop-in flex items-center gap-3 rounded-2xl p-3')}
                style={{
                  animationDelay: `${idx * 0.05}s`,
                  borderColor: isTech ? `${color}55` : undefined,
                  boxShadow: isTech ? `0 0 18px ${color}22` : undefined,
                }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${color}1f`, boxShadow: `0 0 14px ${color}33 inset` }}
                >
                  <Icon size={20} style={{ color }} strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-extrabold tracking-[0.1em] text-slate-100">{name}</span>
                    {isTech && (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-px text-[7px] font-black tracking-[0.14em]"
                        style={{ background: `${color}26`, color }}
                      >
                        ТЕХНИКА
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] leading-snug font-medium text-slate-400">{sub}</div>
                  <div className="mt-1.5 flex gap-1">
                    {Array.from({ length: def.max }).map((_, i) => (
                      <span
                        key={i}
                        className="h-1.5 w-4 rounded-full transition-all"
                        style={{
                          background: i < lvl ? color : 'rgba(255,255,255,0.12)',
                          boxShadow: i < lvl ? `0 0 6px ${color}` : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={maxed || !afford}
                  onClick={() => onBuy(def.id)}
                  className={cn(
                    'btn flex h-11 min-w-[76px] shrink-0 items-center justify-center gap-1 rounded-xl px-2 text-[12px] font-black tracking-wider',
                    maxed ? 'cursor-default bg-white/5 text-slate-500' : afford ? 'btn-primary' : 'btn-ghost text-slate-500',
                  )}
                >
                  {maxed ? (
                    'МАКС'
                  ) : (
                    <>
                      <Coins size={13} strokeWidth={2.6} />
                      <span className="num">{cost}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center text-[10px] leading-relaxed font-semibold tracking-[0.12em] text-slate-500">
          СМЕНИШЬ КОРАБЛЬ — УВИДИШЬ ЕГО СОБСТВЕННУЮ ПРОКАЧКУ.
          <br />
          ПРОГРЕСС СТАРОГО КОРПУСА НИКУДА НЕ ДЕНЕТСЯ.
        </div>
      </div>
    </div>
  );
}
