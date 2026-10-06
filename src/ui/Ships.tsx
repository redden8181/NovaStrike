import { useEffect, useRef } from 'react';
import { Check, Coins, Flag, Lock, Sparkles } from 'lucide-react';
import type { SaveData, ShipId } from '../game/types';
import { SHIPS, TECHS, shipUpgradesOf } from '../game/content';
import { ABILITIES } from '../game/abilities';
import { drawGlow, drawShip } from '../game/sprites';
import { CoinChip, ProgressBar, ScreenHeader } from './bits';
import { cn } from '../utils/cn';

function ShipPreview({ id, accent }: { id: ShipId; accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 190;
    const H = 92;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawGlow(ctx, `${accent}66`, W / 2, H / 2 + 6, 46, 0.8);
      ctx.save();
      ctx.translate(W / 2, H / 2 + Math.sin(t * 1.7) * 3.5);
      ctx.scale(2.1, 2.1);
      drawShip(ctx, id, t, 0.75);
      ctx.restore();
      ctx.strokeStyle = 'rgba(148,180,255,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 52, H - 10);
      ctx.lineTo(W / 2 + 52, H - 10);
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [id, accent]);
  return <canvas ref={ref} className="mx-auto" />;
}

function StatRow({ label, k, color }: { label: string; k: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[8px] font-extrabold tracking-[0.18em] text-slate-400">{label}</span>
      <ProgressBar k={k} color={color} className="flex-1" />
    </div>
  );
}

export function Ships({
  save,
  onBack,
  onSelect,
  onBuy,
}: {
  save: SaveData;
  onBack: () => void;
  onSelect: (id: ShipId) => void;
  onBuy: (id: ShipId) => void;
}) {
  const maxCp = save.checkpoints.length ? Math.max(...save.checkpoints) : 0;
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/85 backdrop-blur-md">
      <div className="safe-top">
        <ScreenHeader title="КОРАБЛИ" sub="У КАЖДОГО СВОЯ СПОСОБНОСТЬ" onBack={onBack} right={<CoinChip value={save.coins} />} />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ touchAction: 'pan-y' }}>
        <div className="flex flex-col gap-3">
          {SHIPS.map((ship, idx) => {
            const owned = save.shipsOwned.includes(ship.id);
            const active = save.ship === ship.id;
            const secret = !!ship.requiresUnlock;
            const unlockedSecret = secret ? save.unlocks.includes(ship.requiresUnlock!) : true;
            const lockedCp = (ship.requires > 0 && maxCp < ship.requires) || !unlockedSecret;
            const afford = save.coins >= ship.cost;
            const ability = ABILITIES[ship.ability];
            const techDef = TECHS[ship.tech];
            const techLvl = shipUpgradesOf(save, ship.id).tech;

            return (
              <div
                key={ship.id}
                className={cn('glass pop-in rounded-3xl p-3', active && 'border-cyan-300/50')}
                style={{ animationDelay: `${idx * 0.06}s`, boxShadow: active ? `0 0 24px ${ship.accent}33` : undefined }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black tracking-[0.16em] text-slate-100">{ship.name}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[8px] font-black tracking-[0.16em]"
                        style={{ background: `${ship.accent}22`, color: ship.accent }}
                      >
                        {ship.tag}
                      </span>
                    </div>
                    <div className="mt-0.5 max-w-[200px] text-[10px] leading-snug font-medium text-slate-400">{ship.desc}</div>
                  </div>
                  {lockedCp && <Lock size={16} className="text-slate-500" />}
                </div>

                <div className={cn('relative', lockedCp && 'opacity-40 grayscale')}>
                  <ShipPreview id={ship.id} accent={ship.accent} />
                  <div className="mx-auto flex max-w-[210px] flex-col gap-1">
                    <StatRow label="СКР" k={ship.mods.speed / 1.8} color="#a78bfa" />
                    <StatRow label="ОГН" k={ship.mods.rate / 1.5} color="#ffd23f" />
                    <StatRow label="УРН" k={ship.mods.damage / 2.5} color="#f472b6" />
                    <StatRow label="HP" k={ship.mods.hp / 220} color="#4ade80" />
                    <StatRow label="БРН" k={ship.mods.armor / 30} color="#38bdf8" />
                  </div>
                </div>

                {/* карточка способности */}
                <div
                  className="mt-2.5 rounded-2xl px-3 py-2"
                  style={{ background: `${ability.color}12`, border: `1px solid ${ability.color}33` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.16em]" style={{ color: ability.color }}>
                      <Sparkles size={11} strokeWidth={3} />
                      {ability.name}
                    </span>
                      <span className="num text-[9px] font-bold text-slate-400">
                        {ship.mods.hp} HP · {ship.mods.armor}% БРН · КД {ability.cooldown}с
                      </span>
                  </div>
                  <div className="mt-0.5 text-[9.5px] leading-snug font-medium text-slate-400">{ability.desc}</div>
                </div>

                {/* уникальная техника корпуса */}
                <div
                  className="mt-1.5 rounded-2xl px-3 py-2"
                  style={{ background: `${techDef.color}10`, border: `1px solid ${techDef.color}2e` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] font-black tracking-[0.12em]" style={{ color: techDef.color }}>
                      ⚙ {techDef.name}
                    </span>
                    {techLvl > 0 && (
                      <span className="num shrink-0 text-[9px] font-bold" style={{ color: techDef.color }}>
                        УР. {techLvl}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[9.5px] leading-snug font-medium text-slate-400">{techDef.desc}</div>
                </div>

                <div className="mt-2.5">
                  {active ? (
                    <div className="flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400/15 text-[11px] font-black tracking-[0.2em] text-cyan-200">
                      <Check size={15} strokeWidth={3} />
                      ВЫБРАН
                    </div>
                  ) : owned ? (
                    <button
                      type="button"
                      onClick={() => onSelect(ship.id)}
                      className="btn btn-ghost h-11 w-full rounded-xl text-[11px] font-black tracking-[0.22em] text-cyan-100"
                    >
                      ВЫБРАТЬ
                    </button>
                  ) : lockedCp ? (
                    <div className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/5 text-[10px] font-bold tracking-[0.14em] text-slate-500">
                      <Flag size={13} />
                      ОТКРОЕТСЯ НА {ship.requires.toLocaleString('ru-RU')} ОЧКАХ
                    </div>
                  ) : ship.cost === 0 ? (
                    <button
                      type="button"
                      onClick={() => onBuy(ship.id)}
                      className="btn btn-primary h-11 w-full rounded-xl text-[11px] font-black tracking-[0.22em]"
                    >
                      ЗАБРАТЬ ПРОТОТИП
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!afford}
                      onClick={() => onBuy(ship.id)}
                      className={cn(
                        'btn flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[11px] font-black tracking-[0.22em]',
                        afford ? 'btn-primary' : 'btn-ghost text-slate-500',
                      )}
                    >
                      <Coins size={14} strokeWidth={2.6} />
                      КУПИТЬ — <span className="num">{ship.cost}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
