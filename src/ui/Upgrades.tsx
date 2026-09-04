import { Columns3, Coins, Crosshair, Heart, Magnet, Shield, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SaveData, UpgradeId } from '../game/types';
import { UPGRADES, upgradeCost } from '../game/content';
import { CoinChip, ScreenHeader } from './bits';
import { cn } from '../utils/cn';

const UPGRADE_ICON: Record<UpgradeId, LucideIcon> = {
  power: Crosshair,
  rate: Zap,
  streams: Columns3,
  hull: Heart,
  shield: Shield,
  magnet: Magnet,
};

const UPGRADE_COLOR: Record<UpgradeId, string> = {
  power: '#f472b6',
  rate: '#ffd23f',
  streams: '#38bdf8',
  hull: '#4ade80',
  shield: '#22d3ee',
  magnet: '#c084fc',
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
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/85 backdrop-blur-md">
      <div className="safe-top">
        <ScreenHeader title="АНГАР" sub="ПОСТОЯННЫЕ УЛУЧШЕНИЯ — НАВСЕГДА" onBack={onBack} right={<CoinChip value={save.coins} />} />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ touchAction: 'pan-y' }}>
        <div className="flex flex-col gap-2.5">
          {UPGRADES.map((def, idx) => {
            const lvl = save.upgrades[def.id];
            const cost = upgradeCost(def.id, lvl);
            const maxed = lvl >= def.max;
            const afford = save.coins >= cost;
            const Icon = UPGRADE_ICON[def.id];
            const color = UPGRADE_COLOR[def.id];
            return (
              <div
                key={def.id}
                className={cn('glass pop-in flex items-center gap-3 rounded-2xl p-3')}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${color}1f`, boxShadow: `0 0 14px ${color}33 inset` }}
                >
                  <Icon size={20} style={{ color }} strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-extrabold tracking-[0.12em] text-slate-100">{def.name}</div>
                  <div className="text-[10px] font-medium text-slate-400">{def.sub}</div>
                  <div className="mt-1.5 flex gap-1">
                    {Array.from({ length: def.max }).map((_, i) => (
                      <span
                        key={i}
                        className="h-1.5 w-4 rounded-full transition-all"
                        style={{ background: i < lvl ? color : 'rgba(255,255,255,0.12)', boxShadow: i < lvl ? `0 0 6px ${color}` : undefined }}
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
                    maxed
                      ? 'cursor-default bg-white/5 text-slate-500'
                      : afford
                        ? 'btn-primary'
                        : 'btn-ghost text-slate-500',
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
        <div className="mt-4 text-center text-[10px] font-semibold tracking-[0.14em] text-slate-500">
          ВЫЖИВАЙ · СОБИРАЙ МОНЕТЫ · СТАНОВИСЬ СИЛЬНЕЕ
        </div>
      </div>
    </div>
  );
}
