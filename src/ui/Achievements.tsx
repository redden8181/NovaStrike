import { Award, Check, Coins, Flag, Lock } from 'lucide-react';
import type { SaveData } from '../game/types';
import { ACHIEVEMENTS, MILESTONES } from '../game/content';
import { ProgressBar, ScreenHeader } from './bits';
import { cn } from '../utils/cn';

function progressOf(id: string, save: SaveData): number {
  switch (id) {
    case 'kills100':
      return save.stats.kills / 100;
    case 'coins500':
      return save.stats.totalCoins / 500;
    case 'survive300':
      return save.stats.bestTime / 300;
    case 'score10k':
      return save.best / 10000;
    case 'boss1':
      return save.stats.bossKills >= 1 ? 1 : 0;
    case 'synergy':
      return save.stats.synergiesTriggered >= 1 ? 1 : 0;
    case 'bossrush5':
      return save.stats.bossRushBest / 5;
    case 'hardcore10k':
      return save.stats.hardcoreBest / 10000;
    case 'daily':
      return save.daily.runs >= 1 ? 1 : 0;
    case 'voidmax':
      return 0;
    default:
      return 0;
  }
}

export function Achievements({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const done = save.achievements.length;
  const nextMilestone = MILESTONES.find((m) => !save.checkpoints.includes(m.score));

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/85 backdrop-blur-md">
      <div className="safe-top">
        <ScreenHeader
          title="ПРОГРЕСС"
          sub={`ВЕХ ${save.checkpoints.length}/${MILESTONES.length} · МЕДАЛЕЙ ${done}/${ACHIEVEMENTS.length}`}
          onBack={onBack}
          right={
            <div className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <Award size={14} className="text-amber-300" strokeWidth={2.4} />
              <span className="num text-sm font-bold text-amber-200">{done}</span>
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ touchAction: 'pan-y' }}>
        {/* ── лестница вех ── */}
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[9px] font-black tracking-[0.3em] text-cyan-300/80">ВЕХИ</span>
          {nextMilestone && (
            <span className="num text-[9px] font-bold text-slate-500">
              ДАЛЕЕ {nextMilestone.score.toLocaleString('ru-RU')}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {MILESTONES.map((m, idx) => {
            const reached = save.checkpoints.includes(m.score);
            const k = Math.min(1, save.best / m.score);
            return (
              <div
                key={m.score}
                className={cn('glass pop-in flex items-center gap-3 rounded-2xl px-3 py-2.5', !reached && 'opacity-75')}
                style={{
                  animationDelay: `${idx * 0.03}s`,
                  borderColor: reached ? `${m.color}55` : undefined,
                  boxShadow: reached ? `0 0 16px ${m.color}22` : undefined,
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: reached ? `${m.color}22` : 'rgba(255,255,255,0.05)' }}
                >
                  {reached ? (
                    <Flag size={16} style={{ color: m.color }} strokeWidth={2.6} />
                  ) : (
                    <Lock size={15} className="text-slate-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="truncate text-[11px] font-extrabold tracking-[0.12em]"
                      style={{ color: reached ? m.color : '#cbd5e1' }}
                    >
                      {m.name}
                    </span>
                    <span className="num shrink-0 text-[9px] font-bold text-slate-500">
                      {m.score.toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <div className="text-[9px] font-medium text-slate-400">{m.detail}</div>
                  {!reached && <ProgressBar k={k} color={m.color} className="mt-1" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── медали ── */}
        <div className="mt-5 mb-2 px-1 text-[9px] font-black tracking-[0.3em] text-amber-300/80">МЕДАЛИ</div>
        <div className="flex flex-col gap-2.5">
          {ACHIEVEMENTS.map((a, idx) => {
            const unlocked = save.achievements.includes(a.id);
            const k = progressOf(a.id, save);
            return (
              <div
                key={a.id}
                className={cn('glass pop-in flex items-center gap-3 rounded-2xl p-3.5', !unlocked && 'opacity-70')}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                    unlocked ? 'bg-amber-400/20 text-amber-300' : 'bg-white/5 text-slate-500',
                  )}
                  style={unlocked ? { boxShadow: '0 0 16px rgba(251,191,36,0.35)' } : undefined}
                >
                  {unlocked ? <Check size={20} strokeWidth={2.8} /> : <Award size={20} strokeWidth={2.2} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className={cn('text-[12px] font-extrabold tracking-[0.12em]', unlocked ? 'text-amber-200' : 'text-slate-200')}>
                      {a.name}
                    </div>
                    <div className="num flex items-center gap-1 text-[10px] font-bold text-amber-300/80">
                      <Coins size={11} strokeWidth={2.6} />+{a.reward}
                    </div>
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">{a.desc}</div>
                  {!unlocked && k > 0 && <ProgressBar k={k} color="#fbbf24" className="mt-1.5" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── карьера ── */}
        <div className="mt-5 mb-2 px-1 text-[9px] font-black tracking-[0.3em] text-slate-400">КАРЬЕРА</div>
        <div className="glass grid grid-cols-3 gap-y-3 rounded-2xl p-3.5">
          {[
            ['ЗАБЕГИ', save.stats.runs],
            ['УБИТО', save.stats.kills],
            ['БОССЫ', save.stats.bossKills],
            ['СИНЕРГИИ', save.stats.synergiesTriggered],
            ['СПОСОБНОСТИ', save.stats.abilitiesUsed],
            ['РУШ-РЕКОРД', save.stats.bossRushBest],
          ].map(([label, value]) => (
            <div key={label as string} className="text-center">
              <div className="num text-base leading-none font-extrabold text-cyan-100">{value as number}</div>
              <div className="mt-1 text-[8px] font-bold tracking-[0.14em] text-slate-500">{label as string}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
