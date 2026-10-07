import { CalendarDays, Flag, Infinity as InfinityIcon, Lock, Play, Rocket, Skull, Swords, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GameMode, SaveData } from '../game/types';
import { MODES, isModeUnlocked } from '../game/modes';
import { MILESTONES, TEST_MODE } from '../game/content';
import { DAILY_ATTEMPTS, DAILY_COIN_CAP, buildDaily, todayKey } from '../game/dailyRun';
import { buildFusion } from '../game/content';
import { CoinChip, ScreenHeader } from './bits';
import { cn } from '../utils/cn';

const MODE_ICON: Record<GameMode, LucideIcon> = {
  classic: Target,
  endless: InfinityIcon,
  bossrush: Swords,
  hardcore: Skull,
  daily: CalendarDays,
};

function unlockScoreFor(unlock: string): number {
  return MILESTONES.find((m) => m.unlock === unlock)?.score ?? 0;
}

export function Modes({
  save,
  startCp,
  setStartCp,
  onPlay,
  onBack,
}: {
  save: SaveData;
  startCp: number;
  setStartCp: (v: number) => void;
  onPlay: (mode: GameMode, cp: number) => void;
  onBack: () => void;
}) {
  const daily = buildDaily();
  const eventShip = buildFusion(daily.ship[0], daily.ship[1]);
  const usedToday = save.daily.date === todayKey() ? save.daily.runs : 0;
  const left = Math.max(0, DAILY_ATTEMPTS - usedToday);
  const unlockedCps = MILESTONES.filter((m) => m.checkpoint && save.checkpoints.includes(m.score)).map((m) => m.score);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/85 backdrop-blur-md">
      <div className="safe-top">
        <ScreenHeader title="ЗАДАЧИ" sub="ВЫБОР ВЫЛЕТА" onBack={onBack} right={<CoinChip value={save.coins} />} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ touchAction: 'pan-y' }}>
        <div className="flex flex-col gap-2.5">
          {MODES.map((mode, idx) => {
            const unlocked = TEST_MODE || isModeUnlocked(save, mode.id);
            const Icon = MODE_ICON[mode.id];
            const best = mode.id === 'daily' ? save.daily.best : (save.bestByMode[mode.id] ?? 0);
            const req = mode.unlock ? unlockScoreFor(mode.unlock) : 0;
            const isDaily = mode.id === 'daily';

            return (
              <div
                key={mode.id}
                className={cn('glass pop-in overflow-hidden rounded-3xl p-3.5', !unlocked && 'opacity-70')}
                style={{
                  animationDelay: `${idx * 0.05}s`,
                  boxShadow: unlocked ? `0 0 22px ${mode.color}22` : undefined,
                  borderColor: unlocked ? `${mode.color}55` : undefined,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: `${mode.color}1f`, boxShadow: `0 0 16px ${mode.color}33 inset` }}
                  >
                    {unlocked ? (
                      <Icon size={22} style={{ color: mode.color }} strokeWidth={2.3} />
                    ) : (
                      <Lock size={20} className="text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black tracking-[0.16em] text-slate-100">{mode.name}</span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[8px] font-black tracking-[0.14em]"
                        style={{ background: `${mode.color}22`, color: mode.color }}
                      >
                        {mode.tag}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] leading-snug font-medium text-slate-400">{mode.desc}</div>
                    <div className="num mt-1 text-[9px] font-bold tracking-[0.12em] text-slate-500">
                      РЕКОРД <span className="text-slate-300">{best}</span>
                      {mode.id === 'bossrush' && save.stats.bossRushBest > 0 && <> · {save.stats.bossRushBest} ЛИНКОРОВ</>}
                    </div>
                  </div>
                </div>

                {isDaily && unlocked && (
                  <div
                    className="mt-2.5 rounded-2xl p-2.5"
                    style={{ background: `${daily.event.color}10`, border: `1px solid ${daily.event.color}3a` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="truncate text-[10px] font-black tracking-[0.14em]"
                        style={{ color: daily.event.color }}
                      >
                        {daily.event.name}
                      </span>
                      <span className="num shrink-0 text-[9px] font-bold text-slate-400">{daily.label}</span>
                    </div>
                    <div className="text-[9.5px] leading-snug font-medium text-slate-400">{daily.event.tagline}</div>

                    {/* эталонный корабль события */}
                    <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-1.5">
                      <Rocket size={13} style={{ color: eventShip.accent }} strokeWidth={2.6} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] font-black tracking-[0.1em]" style={{ color: eventShip.accent }}>
                          {eventShip.name}
                        </div>
                        <div className="num text-[8.5px] font-bold text-slate-500">
                          ЭТАЛОН · {eventShip.mods.hp} HP · ×{eventShip.mods.damage.toFixed(1)} УРОН
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[7.5px] font-black tracking-[0.1em] text-slate-300">
                        ВЫДАЁТСЯ
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {daily.mutators.map((m) => (
                        <span
                          key={m.id}
                          className="rounded-full px-2 py-0.5 text-[9px] font-black tracking-[0.1em]"
                          style={{ background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}44` }}
                          title={m.desc}
                        >
                          {m.name}
                        </span>
                      ))}
                      <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-2 py-0.5 text-[9px] font-black tracking-[0.1em] text-amber-300">
                        ×{daily.coinMul.toFixed(1)} · ДО {DAILY_COIN_CAP} МОНЕТ
                      </span>
                      <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[9px] font-black tracking-[0.1em] text-rose-300">
                        ВРАГИ ×2
                      </span>
                    </div>
                    <div className="mt-1.5 text-[9px] leading-snug font-medium text-slate-400">
                      {daily.mutators.map((m) => m.desc).join(' · ')}
                    </div>

                    {/* попытки */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex gap-1">
                        {Array.from({ length: DAILY_ATTEMPTS }).map((_, i) => (
                          <span
                            key={i}
                            className="h-2 w-6 rounded-full transition-all"
                            style={{
                              background: i < left ? '#fbbf24' : 'rgba(255,255,255,0.12)',
                              boxShadow: i < left ? '0 0 7px #fbbf24' : undefined,
                            }}
                          />
                        ))}
                      </div>
                      <span className="num text-[9px] font-black text-amber-300">
                        {left > 0 ? 'ПОПЫТКА ДОСТУПНА' : 'ПОПЫТКА ИСПОЛЬЗОВАНА'}
                      </span>
                      {save.daily.best > 0 && usedToday > 0 && (
                        <span className="num ml-auto text-[9px] font-bold text-slate-400">
                          ЛУЧШИЙ {save.daily.best}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 text-[8.5px] leading-snug font-semibold text-slate-500">
                      Одна попытка в сутки, добыча ограничена {DAILY_COIN_CAP} монетами. Рекорд, медали и вехи здесь не
                      начисляются — только место в таблице дня. Завтра другое событие и другой корабль.
                    </div>
                  </div>
                )}

                {mode.id === 'classic' && unlockedCps.length > 0 && (
                  <div className="mt-2.5">
                    <div className="mb-1.5 text-[9px] font-bold tracking-[0.24em] text-slate-500">СТАРТ С ТОЧКИ</div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {[0, ...unlockedCps].map((cp) => (
                        <button
                          key={cp}
                          type="button"
                          onClick={() => setStartCp(cp)}
                          className={cn(
                            'btn flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[10px] font-extrabold tracking-wider',
                            startCp === cp ? 'btn-primary' : 'btn-ghost text-slate-300',
                          )}
                        >
                          <Flag size={10} strokeWidth={3} />
                          {cp === 0 ? 'БАЗА' : cp}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-2.5">
                  {isDaily && left <= 0 ? (
                    <div className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/5 text-[10px] font-bold tracking-[0.14em] text-slate-500">
                      <Lock size={13} />
                      ПОПЫТКИ ИСЧЕРПАНЫ · ЖДИ НОВОЕ СОБЫТИЕ
                    </div>
                  ) : unlocked ? (
                    <button
                      type="button"
                      onClick={() => onPlay(mode.id, mode.id === 'classic' ? startCp : 0)}
                      className="btn flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[12px] font-black tracking-[0.28em]"
                      style={{
                        background: `linear-gradient(135deg, ${mode.color}dd, ${mode.color}99)`,
                        color: '#04070f',
                        boxShadow: `0 8px 26px -8px ${mode.color}aa`,
                      }}
                    >
                      <Play size={16} strokeWidth={3} className="fill-current" />В БОЙ
                    </button>
                  ) : (
                    <div className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/5 text-[10px] font-bold tracking-[0.14em] text-slate-500">
                      <Lock size={13} />
                      ОТКРОЕТСЯ НА {req.toLocaleString('ru-RU')} ОЧКАХ
                    </div>
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
