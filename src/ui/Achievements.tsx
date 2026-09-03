import { Award, Check, Coins } from 'lucide-react';
import type { SaveData } from '../game/types';
import { ACHIEVEMENTS } from '../game/content';
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
    default:
      return 0;
  }
}

export function Achievements({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const done = save.achievements.length;
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/85 backdrop-blur-md">
      <div className="safe-top">
        <ScreenHeader
          title="MEDALS"
          sub={`${done} / ${ACHIEVEMENTS.length} EARNED`}
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
        <div className="flex flex-col gap-2.5">
          {ACHIEVEMENTS.map((a, idx) => {
            const unlocked = save.achievements.includes(a.id);
            const k = progressOf(a.id, save);
            return (
              <div
                key={a.id}
                className={cn('glass pop-in flex items-center gap-3 rounded-2xl p-3.5', !unlocked && 'opacity-70')}
                style={{ animationDelay: `${idx * 0.05}s` }}
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
                    <div className={cn('text-[12px] font-extrabold tracking-[0.14em]', unlocked ? 'text-amber-200' : 'text-slate-200')}>
                      {a.name}
                    </div>
                    <div className="num flex items-center gap-1 text-[10px] font-bold text-amber-300/80">
                      <Coins size={11} strokeWidth={2.6} />+{a.reward}
                    </div>
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">{a.desc}</div>
                  {!unlocked && <ProgressBar k={k} color="#fbbf24" className="mt-1.5" />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-center text-[10px] font-semibold tracking-[0.18em] text-slate-500">
          MEDALS GRANT BONUS COINS IMMEDIATELY
        </div>
      </div>
    </div>
  );
}
