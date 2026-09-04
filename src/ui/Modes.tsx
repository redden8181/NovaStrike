import { CalendarDays, Flag, Infinity as InfinityIcon, Lock, Play, Skull, Swords, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GameMode, SaveData } from '../game/types';
import { MODES, isModeUnlocked } from '../game/modes';
import { MILESTONES } from '../game/content';
import { buildDaily } from '../game/dailyRun';
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
  const unlockedCps = MILESTONES.filter((m) => m.kind === 'checkpoint' && save.checkpoints.includes(m.score)).map(
    (m) => m.score,
  );

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/85 backdrop-blur-md">
      <div className="safe-top">
        <ScreenHeader title="ЗАДАЧИ" sub="ВЫБОР ВЫЛЕТА" onBack={onBack} right={<CoinChip value={save.coins} />} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ touchAction: 'pan-y' }}>
        <div className="flex flex-col gap-2.5">
          {MODES.map((mode, idx) => {
            const unlocked = isModeUnlocked(save, mode.id);
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
                  <div className="mt-2.5 rounded-2xl border border-amber-300/25 bg-amber-400/5 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black tracking-[0.26em] text-amber-300/90">ЗАДАНИЕ ДНЯ</span>
                      <span className="num text-[10px] font-bold text-amber-200">{daily.label}</span>
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
                    </div>
                    <div className="mt-1.5 text-[9px] leading-snug font-medium text-slate-400">
                      {daily.mutators.map((m) => m.desc).join(' · ')}
                    </div>
                    {save.daily.runs > 0 && (
                      <div className="num mt-1 text-[9px] font-bold text-amber-300/80">
                        СЕГОДНЯ ВЫЛЕТОВ: {save.daily.runs} · ЛУЧШИЙ {save.daily.best}
                      </div>
                    )}
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
                  {unlocked ? (
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
