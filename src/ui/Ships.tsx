import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Coins,
  Combine,
  Crosshair,
  Flag,
  Gauge,
  Heart,
  Lock,
  Move,
  Shield,
  Sparkles,
  Target,
  Unlink,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { BaseShipId, SaveData, ShipId } from '../game/types';
import {
  DAMAGE,
  FUSION_COST,
  SHIPS,
  TECHS,
  TEST_MODE,
  abilityOf,
  allShips,
  buildFusion,
  fusionId,
  isFullyUpgraded,
  resolveShip,
  shipUpgradesOf,
  starOf,
  starRank,
} from '../game/content';

import { drawGlow, drawShip } from '../game/sprites';
import { CoinChip, ScreenHeader } from './bits';
import { cn } from '../utils/cn';

// базовые величины движка — чтобы в карточке показывать реальные цифры
const BASE_FIRE_RATE = 4.1;

function ShipPreview({ id, accent }: { id: ShipId; accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 200;
    const H = 96;
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
      drawGlow(ctx, `${accent}66`, W / 2, H / 2 + 6, 48, 0.8);
      ctx.save();
      ctx.translate(W / 2, H / 2 + Math.sin(t * 1.7) * 3.5);
      ctx.scale(2.2, 2.2);
      drawShip(ctx, id, t, 0.75);
      ctx.restore();
      ctx.strokeStyle = 'rgba(148,180,255,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 54, H - 9);
      ctx.lineTo(W / 2 + 54, H - 9);
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [id, accent]);
  return <canvas ref={ref} className="mx-auto" />;
}

/** Строка характеристики: полное название + точное значение + шкала + разница с текущим. */
function Stat({
  icon: Icon,
  label,
  value,
  unit,
  k,
  color,
  delta,
  better = 'up',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  k: number;
  color: string;
  delta?: number;
  better?: 'up' | 'down';
}) {
  const sign = delta === undefined || Math.abs(delta) < 0.001 ? 0 : delta > 0 ? 1 : -1;
  const good = sign === 0 ? null : better === 'up' ? sign > 0 : sign < 0;
  return (
    <div className="flex items-center gap-2">
      <Icon size={12} style={{ color }} strokeWidth={2.6} className="shrink-0" />
      <span className="w-[108px] shrink-0 text-[9.5px] font-bold tracking-[0.04em] text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(100, Math.max(3, k * 100))}%`,
            background: color,
            boxShadow: `0 0 7px ${color}`,
          }}
        />
      </div>
      <span className="num w-[62px] shrink-0 text-right text-[10.5px] font-black" style={{ color }}>
        {value}
        {unit && <span className="ml-0.5 text-[8px] font-bold text-slate-500">{unit}</span>}
      </span>
      <span
        className={cn(
          'num w-[30px] shrink-0 text-right text-[8.5px] font-black',
          good === null ? 'text-transparent' : good ? 'text-emerald-400' : 'text-rose-400',
        )}
      >
        {good === null ? '—' : `${sign > 0 ? '+' : '−'}${Math.abs(delta!) >= 10 ? Math.round(Math.abs(delta!)) : Math.abs(delta!).toFixed(1)}`}
      </span>
    </div>
  );
}

/** Всплывающее уведомление о созданном гибриде. */
function FusionToast({ def, onClose }: { def: ShipDefLike; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#02030a]/80 p-6 backdrop-blur-md">
      <div
        className="glass pop-in w-full max-w-[320px] rounded-3xl p-5 text-center"
        style={{ borderColor: `${def.accent}66`, boxShadow: `0 0 40px ${def.accent}33` }}
      >
        <div className="animate-pulse-soft text-[10px] font-black tracking-[0.4em] text-indigo-300">
          СЛИЯНИЕ ЗАВЕРШЕНО
        </div>
        <div className="mt-2 text-[26px] leading-none font-black tracking-[0.08em]" style={{ color: def.accent }}>
          {def.name}
        </div>
        <div className="mt-1 text-[10px] font-bold tracking-[0.2em] text-slate-400">НОВЫЙ КОРПУС СОЗДАН</div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/5 py-2">
            <div className="num text-[15px] leading-none font-black text-emerald-300">{def.mods.hp}</div>
            <div className="mt-1 text-[8px] font-bold tracking-[0.14em] text-slate-500">ПРОЧНОСТЬ</div>
          </div>
          <div className="rounded-xl bg-white/5 py-2">
            <div className="num text-[15px] leading-none font-black text-pink-300">×{def.mods.damage.toFixed(1)}</div>
            <div className="mt-1 text-[8px] font-bold tracking-[0.14em] text-slate-500">УРОН</div>
          </div>
        </div>

        <div
          className="mt-2.5 rounded-2xl px-3 py-2 text-left"
          style={{ background: `${def.ab.color}14`, border: `1px solid ${def.ab.color}40` }}
        >
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} style={{ color: def.ab.color }} strokeWidth={3} />
            <span className="text-[9.5px] font-black tracking-[0.1em]" style={{ color: def.ab.color }}>
              {def.ab.name}
            </span>
          </div>
          <div className="mt-0.5 text-[9.5px] leading-snug font-medium text-slate-400">{def.ab.desc}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn btn-primary mt-4 h-12 w-full rounded-2xl text-[12px] font-black tracking-[0.24em]"
        >
          ОТЛИЧНО
        </button>
      </div>
    </div>
  );
}

interface ShipDefLike {
  name: string;
  accent: string;
  mods: { hp: number; damage: number };
  ab: { name: string; desc: string; color: string };
}

export function Ships({
  save,
  onBack,
  onSelect,
  onBuy,
  onFuse,
  onUnfuse,
}: {
  save: SaveData;
  onBack: () => void;
  onSelect: (id: ShipId) => void;
  onBuy: (id: ShipId) => void;
  onFuse: (a: BaseShipId, b: BaseShipId) => void;
  onUnfuse: (id: ShipId) => void;
}) {
  const maxCp = save.checkpoints.length ? Math.max(...save.checkpoints) : 0;
  const current = resolveShip(save, save.ship);
  const cur = current.mods;
  const list = allShips(save);

  // кандидаты на слияние — полностью прокачанные базовые корпуса
  const fusable = SHIPS.filter((s) => save.shipsOwned.includes(s.id) && (TEST_MODE || isFullyUpgraded(save, s.id)));
  const [fuseA, setFuseA] = useState<BaseShipId | null>(null);

  const [toast, setToast] = useState<ShipDefLike | null>(null);

  const pickFuse = (id: BaseShipId) => {
    if (fuseA === id) {
      setFuseA(null);
      return;
    }
    if (!fuseA) {
      setFuseA(id);
      return;
    }
    const exists = save.fusions?.some((f) => f.id === fusionId(fuseA, id));
    if (!exists) {
      const def = buildFusion(fuseA, id);
      const ab = abilityOf(def);
      onFuse(fuseA, id);
      setToast({
        name: def.name,
        accent: def.accent,
        mods: { hp: def.mods.hp, damage: def.mods.damage },
        ab: { name: ab.name, desc: ab.desc, color: ab.color },
      });
    }
    setFuseA(null);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/88 backdrop-blur-md">
      {toast && <FusionToast def={toast} onClose={() => setToast(null)} />}
      <div className="safe-top">
        <ScreenHeader
          title="КОРАБЛИ"
          sub={`СРАВНЕНИЕ С: ${current.name}`}
          onBack={onBack}
          right={<CoinChip value={save.coins} />}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ touchAction: 'pan-y' }}>
        {/* ── верстак слияния ── */}
        <div className="glass pop-in mb-3 rounded-3xl p-3" style={{ borderColor: '#818cf844' }}>
          <div className="flex items-center gap-1.5">
            <Combine size={13} className="text-indigo-300" strokeWidth={2.8} />
            <span className="text-[9px] font-black tracking-[0.24em] text-indigo-300">ВЕРСТАК СЛИЯНИЯ</span>
          </div>
          <div className="mt-1 text-[9.5px] leading-snug font-medium text-slate-400">
            Выбери два полностью прокачанных корпуса — получится гибрид с новым обликом, способностью первого и
            техникой второго.
            {!TEST_MODE && ` Стоимость: ${FUSION_COST.toLocaleString('ru-RU')} монет.`}
          </div>
          {fusable.length < 2 ? (
            <div className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-[9.5px] font-bold text-slate-500">
              Нужно минимум два корпуса, прокачанных до предела.
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fusable.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickFuse(s.id as BaseShipId)}
                  className={cn(
                    'btn h-9 rounded-full px-3 text-[10px] font-black tracking-[0.08em] transition-all',
                    fuseA === s.id ? 'text-[#04070f]' : 'btn-ghost text-slate-300',
                  )}
                  style={fuseA === s.id ? { background: s.accent, boxShadow: `0 4px 16px -4px ${s.accent}` } : undefined}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {fuseA && (
            <div className="num mt-1.5 text-[9px] font-black text-indigo-300">
              ВЫБРАН {resolveShip(save, fuseA).name} — ТЕПЕРЬ УКАЖИ ВТОРОЙ
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {list.map((ship, idx) => {
            const owned = save.shipsOwned.includes(ship.id);
            const active = save.ship === ship.id;
            const secret = !!ship.requiresUnlock;
            const unlockedSecret = secret ? save.unlocks.includes(ship.requiresUnlock!) : true;
            const lockedCp = TEST_MODE ? false : (ship.requires > 0 && maxCp < ship.requires) || !unlockedSecret;
            const afford = TEST_MODE || save.coins >= ship.cost;
            const ability = abilityOf(ship);
            const techDef = TECHS[ship.tech];
            const techLvl = shipUpgradesOf(save, ship.id).tech;
            const star = starOf(save, ship.id);
            const rank = starRank(star);
            const fused = !!ship.fusedFrom;
            // ранг корпуса усиливает характеристики — показываем итоговые
            const sm = rank.statMul;
            const m = {
              speed: ship.mods.speed * sm,
              rate: ship.mods.rate * sm,
              damage: ship.mods.damage * sm,
              hp: Math.round(ship.mods.hp * sm),
              armor: Math.round(ship.mods.armor * sm),
              streams: ship.mods.streams,
            };

            // производные, понятные игроку величины
            const shots = BASE_FIRE_RATE * m.rate;
            const perBullet = Math.max(1, Math.round(DAMAGE.bullet * (1 - m.armor / 100)));
            const hitsSurvived = Math.ceil(m.hp / perBullet);
            const dps = shots * m.damage * (1 + m.streams);
            const curShots = BASE_FIRE_RATE * cur.rate;
            const curPerBullet = Math.max(1, Math.round(DAMAGE.bullet * (1 - cur.armor / 100)));
            const curHits = Math.ceil(cur.hp / curPerBullet);
            const curDps = curShots * cur.damage * (1 + cur.streams);

            return (
              <div
                key={ship.id}
                className={cn('glass pop-in rounded-3xl p-3', active && 'border-cyan-300/50')}
                style={{ animationDelay: `${idx * 0.06}s`, boxShadow: active ? `0 0 26px ${ship.accent}2e` : undefined }}
              >
                {/* заголовок */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-black tracking-[0.16em] text-slate-100">{ship.name}</span>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black tracking-[0.16em]"
                        style={{ background: `${ship.accent}22`, color: ship.accent }}
                      >
                        {ship.tag}
                      </span>
                      {star > 0 && (
                        <span
                          className="num shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black tracking-[0.1em]"
                          style={{ background: `${rank.color}26`, color: rank.color }}
                        >
                          {rank.name} ×{rank.statMul.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-snug font-medium text-slate-400">{ship.desc}</div>
                  </div>
                  {lockedCp && <Lock size={16} className="shrink-0 text-slate-500" />}
                </div>

                <div className={cn(lockedCp && 'opacity-40 grayscale')}>
                  <ShipPreview id={ship.id} accent={ship.accent} />

                  {/* характеристики — полные названия и точные числа */}
                  <div className="mt-1 flex flex-col gap-[7px] px-0.5">
                    <Stat
                      icon={Heart}
                      label="Прочность"
                      value={`${m.hp}`}
                      unit="HP"
                      k={m.hp / 220}
                      color="#4ade80"
                      delta={active ? undefined : m.hp - cur.hp}
                    />
                    <Stat
                      icon={Shield}
                      label="Броня"
                      value={`${m.armor}`}
                      unit="%"
                      k={m.armor / 30}
                      color="#60a5fa"
                      delta={active ? undefined : m.armor - cur.armor}
                    />
                    <Stat
                      icon={Crosshair}
                      label="Урон снаряда"
                      value={`×${m.damage.toFixed(2)}`}
                      k={m.damage / 2.45}
                      color="#f472b6"
                      delta={active ? undefined : (m.damage - cur.damage) * 100}
                    />
                    <Stat
                      icon={Zap}
                      label="Скорострельность"
                      value={shots.toFixed(1)}
                      unit="в/с"
                      k={shots / (BASE_FIRE_RATE * 1.45)}
                      color="#ffd23f"
                      delta={active ? undefined : shots - curShots}
                    />
                    <Stat
                      icon={Move}
                      label="Манёвренность"
                      value={`×${m.speed.toFixed(2)}`}
                      k={m.speed / 1.7}
                      color="#a78bfa"
                      delta={active ? undefined : (m.speed - cur.speed) * 100}
                    />
                    <Stat
                      icon={Target}
                      label="Стволов на носу"
                      value={`${1 + m.streams}`}
                      unit="шт"
                      k={(1 + m.streams) / 2}
                      color="#38bdf8"
                      delta={active ? undefined : m.streams - cur.streams}
                    />
                    <Stat
                      icon={Gauge}
                      label="Урон в секунду"
                      value={dps.toFixed(1)}
                      k={dps / 12}
                      color="#fb923c"
                      delta={active ? undefined : dps - curDps}
                    />
                  </div>

                  {/* живучесть простым языком */}
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <div className="rounded-xl bg-white/5 px-2 py-1.5 text-center">
                      <div className="num text-[13px] leading-none font-black text-emerald-300">{hitsSurvived}</div>
                      <div className="mt-0.5 text-[8px] font-bold tracking-[0.1em] text-slate-500">
                        ПОПАДАНИЙ ВЫДЕРЖИТ
                        {!active && (
                          <span className={cn('ml-1', hitsSurvived >= curHits ? 'text-emerald-400' : 'text-rose-400')}>
                            {hitsSurvived >= curHits ? '+' : '−'}
                            {Math.abs(hitsSurvived - curHits)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/5 px-2 py-1.5 text-center">
                      <div className="num text-[13px] leading-none font-black text-sky-300">−{perBullet} HP</div>
                      <div className="mt-0.5 text-[8px] font-bold tracking-[0.1em] text-slate-500">ЦЕНА ПОПАДАНИЯ</div>
                    </div>
                  </div>
                </div>

                {/* способность */}
                <div
                  className="mt-2.5 rounded-2xl px-3 py-2"
                  style={{ background: `${ability.color}12`, border: `1px solid ${ability.color}33` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="flex min-w-0 items-center gap-1.5 text-[10px] font-black tracking-[0.12em]"
                      style={{ color: ability.color }}
                    >
                      <Sparkles size={11} strokeWidth={3} className="shrink-0" />
                      <span className="truncate">СПОСОБНОСТЬ: {ability.name}</span>
                    </span>
                    <span className="num shrink-0 text-[9px] font-bold text-slate-400">
                      {ability.duration >= 1 ? `${ability.duration.toFixed(1)}с` : 'миг'} / {ability.cooldown}с
                    </span>
                  </div>
                  <div className="mt-0.5 text-[9.5px] leading-snug font-medium text-slate-400">{ability.desc}</div>
                </div>

                {/* уникальная техника */}
                <div
                  className="mt-1.5 rounded-2xl px-3 py-2"
                  style={{ background: `${techDef.color}10`, border: `1px solid ${techDef.color}2e` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="min-w-0 truncate text-[10px] font-black tracking-[0.12em]"
                      style={{ color: techDef.color }}
                    >
                      ⚙ ТЕХНИКА: {techDef.name}
                    </span>
                    <span className="num shrink-0 text-[9px] font-bold" style={{ color: techDef.color }}>
                      {techLvl > 0 ? `УР. ${techLvl}` : 'НЕ КУПЛЕНА'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[9.5px] leading-snug font-medium text-slate-400">{techDef.desc}</div>
                </div>

                {/* действие */}
                <div className="mt-2.5 flex gap-2">
                  {fused && (
                    <button
                      type="button"
                      onClick={() => onUnfuse(ship.id)}
                      className="btn btn-ghost flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-rose-300"
                      aria-label="Разобрать гибрид"
                    >
                      <Unlink size={16} strokeWidth={2.6} />
                    </button>
                  )}
                  {active ? (
                    <div className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400/15 text-[11px] font-black tracking-[0.2em] text-cyan-200">
                      <Check size={15} strokeWidth={3} />
                      ВЫБРАН
                    </div>
                  ) : owned || fused ? (
                    <button
                      type="button"
                      onClick={() => onSelect(ship.id)}
                      className="btn btn-ghost h-11 w-full rounded-xl text-[11px] font-black tracking-[0.22em] text-cyan-100"
                    >
                      ВЫБРАТЬ
                    </button>
                  ) : lockedCp ? (
                    <div className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/5 text-[10px] font-bold tracking-[0.12em] text-slate-500">
                      <Flag size={13} />
                      ОТКРОЕТСЯ НА {ship.requires.toLocaleString('ru-RU')} ОЧКАХ
                    </div>
                  ) : ship.cost === 0 || TEST_MODE ? (
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
                      КУПИТЬ — <span className="num">{ship.cost.toLocaleString('ru-RU')}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center text-[10px] leading-relaxed font-semibold tracking-[0.08em] text-slate-500">
          ЗЕЛЁНЫЕ И КРАСНЫЕ ЧИСЛА СПРАВА — РАЗНИЦА С ТЕКУЩИМ КОРАБЛЁМ.
          <br />У КАЖДОГО КОРПУСА СВОЯ ПРОКАЧКА В АНГАРЕ.
        </div>
      </div>
    </div>
  );
}
