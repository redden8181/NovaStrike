import { Award, Flag, Home, RotateCcw, Sparkles, Wrench } from 'lucide-react';
import type { RunResult, SaveData } from '../game/types';
import { ACHIEVEMENT_MAP } from '../game/content';
import { fmtTime, StatCell } from './bits';
import { cn } from '../utils/cn';

export function GameOver({
  result,
  save,
  onRetry,
  onMenu,
  onUpgrades,
}: {
  result: RunResult;
  save: SaveData;
  onRetry: () => void;
  onMenu: () => void;
  onUpgrades: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/78 backdrop-blur-md">
      <div className="safe-top flex flex-1 flex-col items-center justify-center px-6">
        <div className="pop-in text-center">
          <div className="text-[10px] font-extrabold tracking-[0.5em] text-rose-300/80">SIGNAL LOST</div>
          <h2
            className="animate-flicker mt-2 text-5xl leading-none font-black tracking-[0.06em] text-rose-400"
            style={{ textShadow: '0 0 30px rgba(244,63,94,0.5), 0 0 90px rgba(244,63,94,0.25)' }}
          >
            GAME
            <br />
            OVER
          </h2>
          {result.newBest && (
            <div className="animate-pulse-soft mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-400/15 px-4 py-1.5 text-[11px] font-black tracking-[0.24em] text-amber-300">
              <Sparkles size={13} strokeWidth={2.6} />
              NEW RECORD
            </div>
          )}
        </div>

        <div className="pop-in-1 mt-6 grid w-full max-w-[320px] grid-cols-2 gap-2">
          <StatCell label="SCORE" value={`${result.score}`} accent="#a5f3fc" />
          <StatCell label="BEST" value={`${result.best}`} accent={result.newBest ? '#fbbf24' : '#e6f1ff'} />
          <StatCell label="COINS EARNED" value={`+${result.coins}`} accent="#fbbf24" />
          <StatCell label="THREAT LVL" value={`${result.level}`} accent="#fb923c" />
        </div>
        <div className="pop-in-1 num mt-2 text-[11px] font-semibold tracking-wider text-slate-400">
          {result.kills} KILLS · {fmtTime(result.time)} SURVIVED
          {result.startCheckpoint > 0 ? ` · FROM CP ${result.startCheckpoint}` : ''}
        </div>

        {(result.newCheckpoints.length > 0 || result.newAchievements.length > 0) && (
          <div className="pop-in-2 mt-4 flex w-full max-w-[320px] flex-col gap-1.5">
            {result.newCheckpoints.map((cp) => (
              <div
                key={cp}
                className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-3.5 py-2.5"
              >
                <Flag size={14} className="shrink-0 text-emerald-300" strokeWidth={2.6} />
                <span className="text-[11px] font-extrabold tracking-[0.14em] text-emerald-200">
                  CHECKPOINT {cp} UNLOCKED
                </span>
              </div>
            ))}
            {result.newAchievements.map((id) => {
              const a = ACHIEVEMENT_MAP[id];
              if (!a) return null;
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3.5 py-2.5"
                >
                  <Award size={14} className="shrink-0 text-amber-300" strokeWidth={2.6} />
                  <span className="text-[11px] font-extrabold tracking-[0.14em] text-amber-200">
                    {a.name} <span className="num font-bold text-amber-300/90">+{a.reward}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="safe-bottom pop-in-2 px-6 pb-6">
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-primary flex h-15 w-full items-center justify-center gap-2.5 rounded-2xl text-lg font-black tracking-[0.28em]"
        >
          <RotateCcw size={20} strokeWidth={3} />
          RETRY
        </button>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onUpgrades}
            className={cn(
              'btn btn-ghost flex h-13 items-center justify-center gap-2 rounded-2xl text-xs font-black tracking-[0.2em]',
              save.coins > 0 && 'text-amber-200',
            )}
          >
            <Wrench size={16} strokeWidth={2.4} />
            UPGRADES
          </button>
          <button
            type="button"
            onClick={onMenu}
            className="btn btn-ghost flex h-13 items-center justify-center gap-2 rounded-2xl text-xs font-black tracking-[0.2em] text-slate-200"
          >
            <Home size={16} strokeWidth={2.4} />
            MENU
          </button>
        </div>
      </div>
    </div>
  );
}
