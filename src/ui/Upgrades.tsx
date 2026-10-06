import { useEffect, useRef, useState } from 'react';
import {
  Bomb,
  Columns3,
  Coins,
  Crosshair,
  Gauge,
  Heart,
  Magnet,
  Rocket,
  Shield,
  ShieldHalf,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SaveData, TechId, UpgradeId } from '../game/types';
import {
  DAMAGE,
  MAX_STAR,
  TECHS,
  abilityOf,
  TEST_MODE,
  UPGRADES,
  capOf,
  isFullyUpgraded,
  resolveShip,
  shipUpgradesOf,
  starOf,
  starRank,
  starUpCost,
  upgradeCost,
} from '../game/content';
import { drawGlow, drawShip } from '../game/sprites';
import { CoinChip, ScreenHeader } from './bits';
import { cn } from '../utils/cn';

const UPGRADE_ICON: Record<UpgradeId, LucideIcon> = {
  power: Crosshair,
  rate: Zap,
  streams: Columns3,
  hull: Heart,
  armor: ShieldHalf,
  shield: Shield,
  magnet: Magnet,
  tech: Sparkles,
  turretL: Target,
  turretR: Target,
  turretPower: Crosshair,
  turretRate: Gauge,
  turretStreams: Columns3,
};

const UPGRADE_COLOR: Record<UpgradeId, string> = {
  power: '#f472b6',
  rate: '#ffd23f',
  streams: '#38bdf8',
  hull: '#4ade80',
  armor: '#60a5fa',
  shield: '#22d3ee',
  magnet: '#c084fc',
  tech: '#818cf8',
  turretL: '#fbbf24',
  turretR: '#fbbf24',
  turretPower: '#fb923c',
  turretRate: '#fde047',
  turretStreams: '#f59e0b',
};

const TECH_ICON: Record<TechId, LucideIcon> = {
  missiles: Rocket,
  lightning: Zap,
  bombs: Bomb,
  drones: Sparkles,
  singularity: Sparkles,
};

type Tab = 'weapon' | 'hull' | 'turret';

const BASE_FIRE_RATE = 4.1;

const TABS: { id: Tab; label: string; color: string }[] = [
  { id: 'weapon', label: 'ОРУЖИЕ', color: '#f472b6' },
  { id: 'hull', label: 'КОРПУС', color: '#4ade80' },
  { id: 'turret', label: 'ТУРЕЛИ', color: '#fbbf24' },
];

/** Живое превью корпуса со всеми купленными модификациями. */
function HangarPreview({ save }: { save: SaveData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ship = resolveShip(save, save.ship);
  const up = shipUpgradesOf(save, save.ship);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 260;
    const H = 150;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;

    let raf = 0;
    const t0 = performance.now();
    const streams = 1 + up.streams + ship.mods.streams;
    const tStreams = 1 + up.turretStreams;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = (now - t0) / 1000;
      const cx = W / 2;
      const cy = H / 2 + 8 + Math.sin(t * 1.6) * 3;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // ореол двигателей — ярче с прокачкой темпа
      const engineGlow = 0.5 + up.rate * 0.08;
      drawGlow(ctx, `${ship.accent}66`, cx, cy + 22, 52 * engineGlow, 0.85);

      // стволы мультизалпа — по одному за ствол
      for (let i = 0; i < streams; i++) {
        const off = (i - (streams - 1) / 2) * 13;
        const gx = cx + off;
        drawGlow(ctx, '#67e8f9', gx, cy - 34, 9, 0.8, true);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(gx - 1.6, cy - 42, 3.2, 14);
        ctx.fillStyle = '#67e8f9';
        ctx.fillRect(gx - 1.6, cy - 44, 3.2, 3);
      }

      // боковые турели
      for (const side of [-1, 1] as const) {
        const owned = side < 0 ? up.turretL > 0 : up.turretR > 0;
        if (!owned) continue;
        const tx = cx + side * 40;
        const ty = cy + 14;
        drawGlow(ctx, '#fbbf24', tx, ty, 16, 0.85, true);
        ctx.fillStyle = '#44403c';
        ctx.fillRect(tx - 7, ty - 7, 14, 14);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(tx - 7, ty - 7, 14, 14);
        for (let i = 0; i < tStreams; i++) {
          const bx = tx + (i - (tStreams - 1) / 2) * 5;
          ctx.fillStyle = '#a8a29e';
          ctx.fillRect(bx - 1.4, ty + 5, 2.8, 15);
        }
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(tx - 2, ty + 18, 4, 2.5);
      }

      // сам корпус
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(2.5, 2.5);
      drawShip(ctx, ship.id, t, 0.6 + up.rate * 0.06);
      ctx.restore();

      // кольцо щита
      if (up.shield > 0) {
        ctx.strokeStyle = `rgba(34,211,238,${0.2 + up.shield * 0.1})`;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath();
        ctx.arc(cx, cy, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // бронепластины
      if (up.armor > 0 || ship.mods.armor > 0) {
        ctx.strokeStyle = 'rgba(96,165,250,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 40, Math.PI * 0.75, Math.PI * 2.25);
        ctx.stroke();
      }

      // пол ангара
      ctx.strokeStyle = 'rgba(148,180,255,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 80, H - 12);
      ctx.lineTo(cx + 80, H - 12);
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [save, ship, up]);

  return <canvas ref={ref} className="mx-auto" />;
}

export function Upgrades({
  save,
  onBack,
  onBuy,
  onStarUp,
}: {
  save: SaveData;
  onBack: () => void;
  onBuy: (id: UpgradeId) => void;
  onStarUp: () => void;
}) {
  const [tab, setTab] = useState<Tab>('weapon');
  const ship = resolveShip(save, save.ship);
  const levels = shipUpgradesOf(save, save.ship);
  const tech = TECHS[ship.tech];
  const shipAbility = abilityOf(ship);
  const star = starOf(save, save.ship);
  const rank = starRank(star);
  const nextRank = star < MAX_STAR ? starRank(star + 1) : null;
  const starCost = starUpCost(star);
  const canStarUp = !!nextRank && (TEST_MODE || save.coins >= starCost) && isFullyUpgraded(save, save.ship);
  const statMul = rank.statMul;

  const maxHp = Math.round(ship.mods.hp * statMul + 25 * levels.hull);
  const armor = Math.min(DAMAGE.armorCap, Math.round(ship.mods.armor * statMul) + 4 * levels.armor);
  const perBullet = Math.max(1, Math.round(DAMAGE.bullet * (1 - armor / 100)));
  const hasTurret = levels.turretL > 0 || levels.turretR > 0;

  // ── боевые показатели: что есть сейчас и что даст следующий уровень ──
  const dmgOf = (lv: number) => 1 * (1 + 0.18 * lv) * ship.mods.damage * statMul;
  const rateOf = (lv: number) => BASE_FIRE_RATE * (1 + 0.22 * lv) * ship.mods.rate * statMul;
  const guns = 1 + levels.streams + ship.mods.streams;

  const shotDmg = dmgOf(levels.power);
  const fireRate = rateOf(levels.rate);
  const dps = shotDmg * fireRate * guns;

  const turretCount = levels.turretL + levels.turretR;
  const turretDmgOf = (lv: number) => shotDmg * (0.34 + 0.2 * lv);
  const turretRateOf = (lv: number) => 1.6 * (1 + 0.2 * lv);
  const turretShot = turretDmgOf(levels.turretPower);
  const turretDps = turretCount * turretShot * turretRateOf(levels.turretRate) * (1 + levels.turretStreams);
  const totalDps = dps + turretDps;

  /** Прирост показателя от следующего уровня улучшения — для подписи на кнопке. */
  const gainFor = (id: UpgradeId): string | null => {
    const lv = levels[id];
    if (lv >= capOf(ship, id, star)) return null;
    switch (id) {
      case 'power':
        return `${shotDmg.toFixed(2)} → ${dmgOf(lv + 1).toFixed(2)} урона`;
      case 'rate':
        return `${fireRate.toFixed(1)} → ${rateOf(lv + 1).toFixed(1)} выстр/с`;
      case 'streams':
        return `${guns} → ${guns + 1} ствола · DPS ${dps.toFixed(0)} → ${(shotDmg * fireRate * (guns + 1)).toFixed(0)}`;
      case 'hull':
        return `${maxHp} → ${maxHp + 25} HP`;
      case 'armor': {
        const next = Math.min(DAMAGE.armorCap, armor + 4);
        return `${armor}% → ${next}% · попадание −${Math.max(1, Math.round(DAMAGE.bullet * (1 - next / 100)))} HP`;
      }
      case 'turretPower':
        return `${turretShot.toFixed(2)} → ${turretDmgOf(lv + 1).toFixed(2)} урона`;
      case 'turretRate':
        return `${turretRateOf(levels.turretRate).toFixed(1)} → ${turretRateOf(lv + 1).toFixed(1)} выстр/с`;
      case 'turretStreams':
        return `${1 + lv} → ${2 + lv} снаряда у каждой`;
      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/88 backdrop-blur-md">
      <div className="safe-top">
        <ScreenHeader title="АНГАР" sub={ship.name} onBack={onBack} right={<CoinChip value={save.coins} />} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-6" style={{ touchAction: 'pan-y' }}>
        {/* ── док с кораблём ── */}
        <div
          className="glass pop-in relative overflow-hidden rounded-3xl p-2"
          style={{ borderColor: `${ship.accent}44`, boxShadow: `0 0 28px ${ship.accent}1f` }}
        >
          <HangarPreview save={save} />
          <div className="mt-1 grid grid-cols-4 gap-1.5 px-1">
            <div className="rounded-xl bg-white/5 py-1.5 text-center">
              <div className="num text-[13px] leading-none font-black text-emerald-300">{maxHp}</div>
              <div className="mt-0.5 text-[7.5px] font-bold tracking-[0.12em] text-slate-500">ПРОЧНОСТЬ</div>
            </div>
            <div className="rounded-xl bg-white/5 py-1.5 text-center">
              <div className="num text-[13px] leading-none font-black text-sky-300">{armor}%</div>
              <div className="mt-0.5 text-[7.5px] font-bold tracking-[0.12em] text-slate-500">БРОНЯ</div>
            </div>
            <div className="rounded-xl bg-white/5 py-1.5 text-center">
              <div className="num text-[13px] leading-none font-black text-cyan-200">
                {1 + levels.streams + ship.mods.streams}
              </div>
              <div className="mt-0.5 text-[7.5px] font-bold tracking-[0.12em] text-slate-500">СТВОЛОВ</div>
            </div>
            <div className="rounded-xl bg-white/5 py-1.5 text-center">
              <div className="num text-[13px] leading-none font-black text-amber-300">
                {levels.turretL + levels.turretR}
              </div>
              <div className="mt-0.5 text-[7.5px] font-bold tracking-[0.12em] text-slate-500">ТУРЕЛЕЙ</div>
            </div>
          </div>
          <div className="num mt-1.5 text-center text-[9px] font-bold tracking-[0.1em] text-slate-500">
            ПОПАДАНИЕ: −{perBullet} HP · ТАРАН: −{Math.max(1, Math.round(DAMAGE.crash * (1 - armor / 100)))} HP
          </div>
        </div>

        {/* ── боевая мощь: конкретные цифры урона ── */}
        <div className="glass pop-in-1 mt-2.5 rounded-2xl p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Crosshair size={12} className="text-pink-400" strokeWidth={2.8} />
            <span className="text-[9px] font-black tracking-[0.24em] text-pink-300/90">БОЕВАЯ МОЩЬ</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold text-slate-400">Урон одного снаряда</span>
              <span className="num text-[12px] font-black text-pink-300">{shotDmg.toFixed(2)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold text-slate-400">Скорострельность</span>
              <span className="num text-[12px] font-black text-amber-300">{fireRate.toFixed(1)} выстр/с</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold text-slate-400">Залп ({guns} ств.)</span>
              <span className="num text-[12px] font-black text-cyan-300">{(shotDmg * guns).toFixed(2)}</span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2 border-t border-white/10 pt-1.5">
              <span className="text-[10px] font-bold text-slate-300">Урон носа в секунду</span>
              <span className="num text-[14px] font-black text-orange-300">{dps.toFixed(1)}</span>
            </div>
            {turretCount > 0 && (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-semibold text-slate-400">
                    Турели ×{turretCount} — снаряд {turretShot.toFixed(2)}
                  </span>
                  <span className="num text-[12px] font-black text-amber-300">+{turretDps.toFixed(1)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-t border-white/10 pt-1.5">
                  <span className="text-[10px] font-black text-slate-200">ОБЩИЙ УРОН В СЕКУНДУ</span>
                  <span className="num text-[15px] font-black text-emerald-300">{totalDps.toFixed(1)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── способность корпуса ── */}
        <div
          className="glass pop-in-1 mt-2.5 rounded-2xl px-3 py-2"
          style={{ background: `${shipAbility.color}10`, borderColor: `${shipAbility.color}3a` }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="flex min-w-0 items-center gap-1.5 text-[10px] font-black tracking-[0.1em]"
              style={{ color: shipAbility.color }}
            >
              <Sparkles size={11} strokeWidth={3} className="shrink-0" />
              <span className="truncate">{shipAbility.name}</span>
            </span>
            <span className="num shrink-0 text-[9px] font-bold text-slate-400">
              {shipAbility.duration.toFixed(1)}с / {shipAbility.cooldown}с
            </span>
          </div>
        </div>

        {/* ── ранг корпуса: звёзды ── */}
        <div
          className="glass pop-in-1 mt-2.5 rounded-2xl p-3"
          style={{ borderColor: `${rank.color}44`, boxShadow: star > 0 ? `0 0 20px ${rank.color}22` : undefined }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] font-black tracking-[0.24em] text-slate-500">РАНГ КОРПУСА</div>
              <div className="flex items-baseline gap-2">
                <span className="text-[15px] font-black tracking-[0.1em]" style={{ color: rank.color }}>
                  {rank.name}
                </span>
                <span className="num text-[9px] font-bold text-slate-500">×{rank.statMul.toFixed(2)} к статам</span>
              </div>
            </div>
            {nextRank ? (
              <button
                type="button"
                disabled={!canStarUp}
                onClick={onStarUp}
                className={cn(
                  'btn flex h-11 min-w-[104px] shrink-0 flex-col items-center justify-center rounded-xl px-2.5',
                  canStarUp ? 'btn-primary' : 'btn-ghost text-slate-500',
                )}
              >
                <span className="text-[10px] font-black tracking-[0.1em]">{nextRank.name}</span>
                <span className="num text-[8.5px] font-bold">
                  {TEST_MODE ? 'ТЕСТ' : starCost.toLocaleString('ru-RU')}
                </span>
              </button>
            ) : (
              <span className="text-[10px] font-black tracking-[0.1em] text-pink-300">ПРЕДЕЛ</span>
            )}
          </div>
          <div className="mt-1.5 flex gap-1">
            {Array.from({ length: MAX_STAR }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background: i < star ? starRank(i + 1).color : 'rgba(255,255,255,0.1)',
                  boxShadow: i < star ? `0 0 6px ${starRank(i + 1).color}` : undefined,
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 text-[9px] leading-snug font-semibold text-slate-400">
            {nextRank
              ? canStarUp
                ? `Повышение откроет +${nextRank.capBonus - rank.capBonus} пункт(ов) к каждой ветке прокачки`
                : 'Прокачай «Оружие» и «Корпус» до предела — турели для ранга не нужны'
              : 'Корпус достиг максимального ранга'}
          </div>
        </div>

        {/* ── вкладки ── */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'btn h-10 rounded-xl text-[10px] font-black tracking-[0.16em] transition-colors',
                tab === t.id ? 'text-[#04070f]' : 'btn-ghost text-slate-300',
              )}
              style={tab === t.id ? { background: t.color, boxShadow: `0 6px 20px -6px ${t.color}` } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'turret' && !hasTurret && (
          <div className="mt-2.5 rounded-2xl border border-amber-300/25 bg-amber-400/5 p-2.5 text-[10px] leading-snug font-semibold text-amber-200/90">
            Турели ведут автоматический огонь <b>назад</b> — по тем, кто уже прорвался за корму. Урон ниже основного
            калибра, но они бьют без твоего участия.
          </div>
        )}

        {/* ── список улучшений выбранной вкладки ── */}
        <div className="mt-2.5 flex flex-col gap-2">
          {UPGRADES.filter((u) => u.group === tab).map((def, idx) => {
            const isTech = def.id === 'tech';
            const lvl = levels[def.id];
            const cap = capOf(ship, def.id, star);
            const cost = upgradeCost(def.id, lvl);
            const maxed = lvl >= cap;
            const afford = TEST_MODE || save.coins >= cost;
            const needsTurret = def.group === 'turret' && def.max > 1 && !hasTurret;
            const Icon = isTech ? TECH_ICON[ship.tech] : UPGRADE_ICON[def.id];
            const color = isTech ? tech.color : UPGRADE_COLOR[def.id];
            const name = isTech ? tech.name : def.name;
            const sub = isTech ? tech.desc : def.sub;
            const isToggle = def.max === 1;

            return (
              <div
                key={def.id}
                className={cn('glass pop-in flex items-center gap-3 rounded-2xl p-3', needsTurret && 'opacity-45')}
                style={{
                  animationDelay: `${idx * 0.04}s`,
                  borderColor: isTech || (isToggle && maxed) ? `${color}55` : undefined,
                }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${color}1f`, boxShadow: `0 0 14px ${color}2e inset` }}
                >
                  <Icon size={20} style={{ color }} strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-extrabold tracking-[0.08em] text-slate-100">{name}</div>
                  <div className="text-[9.5px] leading-snug font-medium text-slate-400">{sub}</div>
                  {/* точный прирост от следующего уровня */}
                  {!maxed && gainFor(def.id) && (
                    <div className="num mt-0.5 text-[9px] font-bold" style={{ color }}>
                      {gainFor(def.id)}
                    </div>
                  )}
                  {!isToggle && (
                    <div className="mt-1.5 flex items-center gap-1">
                      {Array.from({ length: cap }).map((_, i) => (
                        <span
                          key={i}
                          className="h-1.5 flex-1 rounded-full transition-all"
                          style={{
                            background: i < lvl ? color : 'rgba(255,255,255,0.12)',
                            boxShadow: i < lvl ? `0 0 6px ${color}` : undefined,
                          }}
                        />
                      ))}
                      <span className="num ml-0.5 shrink-0 text-[8.5px] font-black text-slate-500">
                        {lvl}/{cap}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={maxed || !afford || needsTurret}
                  onClick={() => onBuy(def.id)}
                  className={cn(
                    'btn flex h-11 min-w-[78px] shrink-0 items-center justify-center gap-1 rounded-xl px-2 text-[12px] font-black tracking-wider',
                    maxed
                      ? 'cursor-default bg-white/5 text-emerald-300'
                      : afford && !needsTurret
                        ? 'btn-primary'
                        : 'btn-ghost text-slate-500',
                  )}
                >
                  {maxed ? (
                    isToggle ? (
                      'ЕСТЬ'
                    ) : (
                      'МАКС'
                    )
                  ) : TEST_MODE ? (
                    'ТЕСТ'
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

        <div className="mt-4 text-center text-[10px] leading-relaxed font-semibold tracking-[0.1em] text-slate-500">
          У КАЖДОГО КОРПУСА СВОЯ ПРОКАЧКА — ОНА СОХРАНЯЕТСЯ ПРИ СМЕНЕ КОРАБЛЯ
        </div>
      </div>
    </div>
  );
}
